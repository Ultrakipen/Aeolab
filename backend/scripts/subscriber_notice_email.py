"""구독자 안내 이메일 — 기본은 드라이런(아무것도 보내지 않음) (2026-11-02).

용도: 네이버 확인 지연·중단 때 유효 구독자에게 보내는 안내 메일(문안: docs/naver_outage_customer_communication_2026_11_02.md 2~4단계).
알림톡이 아니라 이메일이므로 템플릿 승인은 필요 없다. **문안은 사용자 승인 전 초안이다 — 승인 전에는 --send 를 쓰지 않는다.**

안전 장치
- 기본 동작은 드라이런: 수신자 목록(이메일은 마스킹)·제목·본문 미리보기만 출력하고 DB·Resend에 쓰지 않는다.
- 수신자 = 지금 유료 서비스 자격이 있는 구독자(`scan_scheduling.entitled_user_ids`, 알림·스캔 잡과 같은 기준). 관리자 계정은 기본 제외(--include-admins로만 포함).
- 문안의 {자리표시자} 값이 하나라도 비면 중단한다(`{시작일}`이 그대로 나가는 사고 방지). 값은 HTML 이스케이프한다.
- 실제 발송은 `--send --confirm <수신자 수>` 둘 다 있어야 하며, 확인한 수가 실제 수신자 수와 다르면 중단한다.
- 같은 캠페인(--campaign)에서 이미 보낸 주소는 건너뛴다(로컬 기록 파일, 이메일 해시만 저장). 한 통 실패해도 나머지는 계속하고, 마지막에 성공/실패 수를 보여 준다.
- `--only 주소`로 한 명에게만 시험 발송할 수 있다(수신자 목록과 무관, 중복 기록 안 함). 이메일 주소는 로그·출력에 마스킹해서 쓴다.

사용(서버): cd /var/www/aeolab/backend && /var/www/aeolab/venv/bin/python scripts/subscriber_notice_email.py --stage 2 --start-date 11월 5일 --last-date 11월 4일 --campaign naver-2026-11
  --stage 2 : 3일 이상 지연 — 3일 연장 안내      --stage 3 : 7일 이상 — 2단계 + 환불 선택권
  --stage 4 : 복구 안내(--extended-until 필요)
"""
import argparse
import asyncio
import hashlib
import html
import json
import os
import re
import sys
from datetime import datetime, timezone

_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _BACKEND)


def _load_env() -> None:
    """직접 실행할 때만 .env를 읽는다(테스트가 import해도 환경이 오염되지 않게). email_sender가 import 시점에 RESEND_API_KEY를 읽으므로
    그 import(발송 직전)보다 먼저 호출해야 한다."""
    try:
        from dotenv import load_dotenv

        load_dotenv(os.path.join(_BACKEND, ".env"))
    except ImportError:
        pass


EXTENSION_DAYS = 3  # 사용자 결정(2026-11-02): 장애 기간과 무관하게 고정 3일 연장 — 문안은 이 값에서 만든다
SUPPORT_EMAIL = "support@aeolab.co.kr"  # 개인정보처리방침 페이지의 고객 문의 주소와 같다
_PLACEHOLDER = re.compile(r"\{([^{}]+)\}")

STAGE2_BODY = (
    "안녕하세요, AEOlab입니다.\n"
    "{시작일}부터 네이버 쪽 측정 항목을 확인하지 못하고 있으며, 블로그 진단·경쟁사 정보 갱신 같은 일부 기능도 늦어질 수 있습니다. "
    "원인은 확인 중이며, 확인되기 전에는 추정해서 말씀드리지 않겠습니다.\n"
    "그동안 네이버 항목은 마지막 확인값({날짜})으로 표시되며, 새 결과로 오해되지 않도록 '확인 전' 또는 날짜를 함께 보여 드리고 있습니다. 다른 기능은 정상입니다.\n"
    f"불편을 드린 점에 대해 이용 기간을 {EXTENSION_DAYS}일 연장해 드리겠습니다(별도 신청 불필요). "
    "이 보상은 회사의 자체 정책에 따른 것이며, 이후 정책은 달라질 수 있습니다."   # 약관(제5·8조)을 바꾸지 않는 대신 메일에서 자발적 정책임을 밝힌다(2026-11-02 결정)
)
# 발신 주소가 noreply이고 Reply-To가 없어 '이 메일에 회신'은 문의로 전달되지 않는다 — 반드시 문의 주소를 적는다
STAGE3_EXTRA = f"\n네이버 항목 확인이 7일 이상 이어지지 않아, 원하시면 남은 기간 환불을 선택하실 수 있습니다. {SUPPORT_EMAIL}로 메일 주시면 처리해 드립니다."
STAGE4_BODY = (
    "안녕하세요, AEOlab입니다.\n"
    "네이버 항목 확인이 다시 시작되었습니다. 다음 측정부터 새 값으로 갱신되며, 복구 직후에는 값이 평소와 다르게 보일 수 있습니다. "
    "측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다.\n"
    "연장된 이용 기간은 {연장일}까지입니다."
)
CONTACT = f"\n문의: {SUPPORT_EMAIL}"  # 모든 단계 본문의 맨 끝

STAGES = {
    2: ("[AEOlab] 네이버 항목 확인 지연 안내와 이용 기간 연장", STAGE2_BODY, ("시작일", "날짜")),
    3: ("[AEOlab] 네이버 항목 확인 지연 안내와 이용 기간 연장·환불 선택", STAGE2_BODY + STAGE3_EXTRA, ("시작일", "날짜")),
    4: ("[AEOlab] 네이버 항목 확인이 다시 시작되었습니다", STAGE4_BODY, ("연장일",)),
}


def render(stage: int, values: dict) -> tuple[str, str, str]:
    """(제목, 텍스트 본문, HTML 본문). 필요한 값이 비면 ValueError. 값은 HTML 이스케이프한다."""
    if stage not in STAGES:
        raise ValueError(f"지원하지 않는 단계: {stage} (2·3·4)")
    subject, body, needed = STAGES[stage]
    body += CONTACT
    missing = [k for k in needed if not (values.get(k) or "").strip()]
    if missing:
        raise ValueError("문안 값이 비어 있음: " + ", ".join(missing))
    text = _PLACEHOLDER.sub(lambda m: values[m.group(1)].strip() if m.group(1) in needed else m.group(0), body)
    left = _PLACEHOLDER.findall(text)
    if left:  # 정의되지 않은 자리표시자가 남으면 그대로 나가지 않게 막는다
        raise ValueError("치환되지 않은 자리표시자: " + ", ".join(left))
    return subject, text, _to_html(subject, text)


_EMPHASIS = (f"{EXTENSION_DAYS}일 연장","남은 기간 환불", "다시 시작되었습니다")  # 본문에서 굵게 보일 핵심 구절


def _to_html(subject: str, text: str) -> str:
    """텍스트 본문을 다른 안내 메일과 같은 서식(폭 560px·맑은 고딕·문단 간격)으로 만든다. 값은 이스케이프한 뒤 강조·링크를 씌운다."""
    title = html.escape(re.sub(r"^\[AEOlab\]\s*", "", subject))
    paras = []
    for line in text.split("\n"):
        if not line.strip():
            continue
        esc = html.escape(line)
        for phrase in _EMPHASIS:
            esc = esc.replace(html.escape(phrase), f"<strong>{html.escape(phrase)}</strong>")
        esc = esc.replace(SUPPORT_EMAIL, f'<a href="mailto:{SUPPORT_EMAIL}" style="color:#1d4ed8">{SUPPORT_EMAIL}</a>')
        paras.append(f'<p style="margin:0 0 14px;font-size:15px;line-height:1.75;color:#1e293b;word-break:keep-all">{esc}</p>')
    footer = (
        "서비스 운영 안내 메일입니다. 이 주소(noreply)는 발신 전용이라 회신이 전달되지 않습니다."
    )
    return (
        "<div style=\"font-family:'Apple SD Gothic Neo',Malgun Gothic,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1e293b\">"
        '<div style="font-size:13px;font-weight:700;color:#2563eb;letter-spacing:.02em;margin-bottom:6px">AEOlab</div>'
        f'<h1 style="margin:0 0 20px;font-size:20px;line-height:1.4;color:#0f172a;word-break:keep-all">{title}</h1>'
        + "".join(paras)
        + f'<div style="margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12.5px;line-height:1.6;color:#64748b;word-break:keep-all">{footer}</div>'
        "</div>"
    )


def mask_email(email: str) -> str:
    name, _, domain = (email or "").partition("@")
    if not domain:
        return "***"
    return f"{name[:2]}***@{domain}"


def email_hash(email: str) -> str:
    return hashlib.sha256((email or "").strip().lower().encode("utf-8")).hexdigest()[:16]


def select_recipients(sub_rows: list[dict], admin_ids=(), include_admins: bool = False) -> list[str]:
    """유효 구독자 user_id 목록(정렬·중복 제거). 관리자는 기본 제외."""
    from services.scan_scheduling import entitled_user_ids

    ids = entitled_user_ids(sub_rows)
    if not include_admins:
        ids -= {str(a) for a in admin_ids if a}
    return sorted(ids)


def pending_emails(emails: list[str], already_sent_hashes: set[str]) -> list[str]:
    """이미 보낸 주소·빈 값·잘못된 주소·중복을 뺀다(대소문자 무시, 입력 순서 유지)."""
    out, seen = [], set()
    for e in emails:
        e = (e or "").strip()
        h = email_hash(e)
        if "@" not in e or h in seen or h in already_sent_hashes:
            continue
        seen.add(h)
        out.append(e)
    return out


def _log_path(campaign: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9_.-]", "_", campaign)
    return os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), f".notice_email_sent_{safe}.jsonl")


def load_sent_hashes(campaign: str) -> set[str]:
    path = _log_path(campaign)
    if not os.path.exists(path):
        return set()
    out = set()
    with open(path, encoding="utf-8") as f:
        for line in f:
            try:
                out.add(json.loads(line)["h"])
            except Exception:
                continue
    return out


def record_sent(campaign: str, email: str, stage: int) -> None:
    with open(_log_path(campaign), "a", encoding="utf-8") as f:
        f.write(json.dumps({"h": email_hash(email), "stage": stage, "at": datetime.now(timezone.utc).isoformat()}) + "\n")


def _fetch_recipient_emails(include_admins: bool) -> tuple[list[str], int]:
    """(이메일 목록, 자격 있는 사용자 수). 읽기 전용 — auth.users에서 이메일을 읽는다."""
    from db.supabase_client import get_client

    sb = get_client()
    rows, start = [], 0
    while True:  # 1,000행 상한 페이징
        page = sb.table("subscriptions").select("user_id,status,end_at").range(start, start + 999).execute().data or []
        rows += page
        if len(page) < 1000:
            break
        start += 1000
    admin_ids = [u.strip() for u in os.getenv("ADMIN_USER_IDS", "").split(",") if u.strip()]
    uids = select_recipients(rows, admin_ids, include_admins)
    emails = []
    for uid in uids:
        try:
            u = sb.auth.admin.get_user_by_id(uid)
            em = getattr(getattr(u, "user", u), "email", None)
        except Exception as e:  # 한 명 조회 실패가 전체를 막지 않게 — 조용히 넘기지 않고 알린다
            print(f"  ! 이메일 조회 실패 user={uid[:8]}…: {type(e).__name__}")
            continue
        if em:
            emails.append(em)
    return emails, len(uids)


async def _send_all(emails: list[str], subject: str, page: str, campaign: str, stage: int) -> tuple[int, int]:
    from services.email_sender import send_email

    ok = fail = 0
    for em in emails:
        if await send_email(em, subject, page):
            if campaign:  # --only 시험 발송은 기록하지 않는다(캠페인 중복 방지에 영향 없음)
                record_sent(campaign, em, stage)
            ok += 1
        else:
            fail += 1
            print(f"  ✗ 실패: {mask_email(em)}")
        await asyncio.sleep(0.6)  # Resend 속도 제한(초당 2건)보다 느리게
    return ok, fail


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="구독자 안내 이메일 (기본 드라이런)")
    p.add_argument("--stage", type=int, required=True, choices=sorted(STAGES))
    p.add_argument("--campaign", required=True, help="중복 발송 방지용 이름(예: naver-2026-11). 단계가 달라도 같은 캠페인이면 같은 주소를 건너뛰므로 단계마다 다르게 쓸 것")
    p.add_argument("--start-date", default="", help="2·3단계: 확인을 못 하기 시작한 날(예: 11월 5일)")
    p.add_argument("--last-date", default="", help="2·3단계: 화면에 남은 마지막 확인값 날짜")
    p.add_argument("--extended-until", default="", help="4단계: 연장된 이용 기간 마지막 날")
    p.add_argument("--include-admins", action="store_true")
    p.add_argument("--only", default="", help="이 주소 한 곳에만 시험 발송(--send 필요)")
    p.add_argument("--send", action="store_true", help="실제 발송(기본은 드라이런)")
    p.add_argument("--confirm", type=int, default=-1, help="--send 시 예상 수신자 수를 한 번 더 입력")
    a = p.parse_args(argv)

    try:
        subject, text, page = render(a.stage, {"시작일": a.start_date, "날짜": a.last_date, "연장일": a.extended_until})
    except ValueError as e:
        print("중단:", e)
        return 2

    if a.only:
        emails, entitled, resolved, skipped = [a.only.strip()], 1, 1, 0
    else:
        raw, entitled = _fetch_recipient_emails(a.include_admins)
        sent_before = load_sent_hashes(a.campaign)
        emails = pending_emails(raw, sent_before)
        resolved, skipped = len(raw), len(raw) - len(emails)

    mode = "실제 발송" if a.send else "드라이런(발송 안 함)"
    print(f"== {mode} · 단계 {a.stage} · 캠페인 {a.campaign} ==")
    print(f"자격 있는 구독자 {entitled}명 · 이메일 확인 {resolved}명 · 제외(이미 발송·중복·잘못된 주소) {skipped}명 · 이번 수신 {len(emails)}명")
    if entitled != resolved:
        print(f"  ! 자격자 {entitled}명 중 {entitled - resolved}명은 이메일을 확인하지 못해 대상에서 빠집니다(위 조회 실패 줄 참고).")
    print("수신자:", ", ".join(mask_email(e) for e in emails) or "(없음)")
    print("제목:", subject)
    print("--- 본문 ---")
    print(text)
    print("------------")

    if not a.send:
        print("드라이런이라 아무것도 보내지 않았고 기록도 남기지 않았습니다. 승인된 문안으로 보내려면 --send --confirm", len(emails))
        return 0
    if not emails:
        print("보낼 대상이 없습니다.")
        return 0
    if a.confirm != len(emails):
        print(f"중단: --confirm 값({a.confirm})이 이번 수신자 수({len(emails)})와 다릅니다.")
        return 2
    ok, fail = asyncio.run(_send_all(emails, subject, page, "" if a.only else a.campaign, a.stage))
    print(f"완료: 성공 {ok} · 실패 {fail}")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    _load_env()
    sys.exit(main())
