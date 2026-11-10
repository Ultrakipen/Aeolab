"""소프트 런치 기간 하루 1회 읽기 전용 점검 (2026-11-10).

사용(서버): cd /var/www/aeolab/backend && PYTHONPATH=. /var/www/aeolab/venv/bin/python scripts/daily_launch_check.py

DB 읽기만 한다 — 네이버 접속·쓰기·알림 발송 없음. 개인 식별 정보(이메일·번호·해시)는 출력하지 않고 건수만 낸다.
조회가 실패한 항목은 '정상'이 아니라 '확인 못 함'으로 표시한다(error ≠ 0건). pm2 로그는 따로 본다.
"""
import asyncio
import os
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone

_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _BACKEND)

KST = timezone(timedelta(hours=9))
NID_SES_REPLACE_BY = datetime(2026, 11, 24, tzinfo=KST)     # 2026-11-10 서버 확인: 10-25 발급 + 30일 주기
NID_SES_WARN_FROM = datetime(2026, 11, 17, tzinfo=KST)


def cookie_reminder(now: datetime) -> str:
    left = (NID_SES_REPLACE_BY - now).days
    if now >= NID_SES_REPLACE_BY:
        return f"NID_SES 교체 시한(11-24) 지남 — 사용자가 즉시 교체 (직접 확인 필요)"
    if now >= NID_SES_WARN_FROM:
        return f"NID_SES 교체 임박: {left}일 남음 (사용자 작업)"
    return f"NID_SES 교체까지 {left}일(11-24 전후, 사용자 작업 — 11-17부터 경고)"


MILESTONES = (20, 50, 100)   # scheduler/jobs.py _check_data_wiring_readiness_job 의 구독자 수 트리거와 같은 값


def subscriber_breakdown(rows, admin_ids, paid_user_ids):
    """활성 구독 행을 (전체, 관리자·내부 제외, 실제 결제 기록 있음)으로 나눈다.

    스케줄러 트리거는 status='active' 행을 전부 세므로(관리자·시험 계정 포함) 외부 구독자 수보다 크게 나온다.
    '결제 기록 있음'은 payment_events에 성공한 결제가 있는 사용자만 센다(탈퇴한 사용자는 구독 행이 없어 제외됨).
    """
    active = [r for r in rows if r.get("status") == "active"]
    non_admin = [r for r in active if r.get("user_id") not in admin_ids]
    paid = [r for r in non_admin if r.get("user_id") in paid_user_ids]
    return {"활성 전체(스케줄러 트리거 기준)": len(active), "관리자 제외": len(non_admin), "결제 기록 있는 외부": len(paid)}


def milestone_gap(count: int) -> str:
    nxt = next((m for m in MILESTONES if count < m), None)
    return f"다음 트리거 {nxt}명까지 {nxt - count}명" if nxt else "모든 트리거(20·50·100명) 지남"


def summarize_usage(rows, cap: int, days: int = 7) -> str:
    """네이버 일별 사용량 이력(페이지=쿼터 cost 단위)의 최근 N일 요약. 표본이 작으면 참고용이다."""
    recent = [r for r in (rows or []) if isinstance(r, dict) and isinstance(r.get("used"), (int, float))][-days:]
    if not recent:
        return "이력 없음"
    used = [r["used"] for r in recent]
    peak = max(used)
    pct = f"{peak / cap * 100:.0f}%" if cap else "상한 미상"
    return f"최근 {len(recent)}일 합계 {int(sum(used))}페이지, 하루 최대 {int(peak)}페이지(상한 {cap} 대비 {pct}) — 야간 스캔 대상이 적을 때의 값이라 참고용"


def summarize_blocks(rows) -> str:
    """naver_block_events 최근 건수를 (화면, 사건)별로 센다. 차단(block)이 있으면 앞에 경고를 붙인다."""
    if not rows:
        return "0건"
    c = Counter(f"{r.get('surface')}:{r.get('event')}" for r in rows)
    blocked = any(r.get("event") != "recover" for r in rows)
    return ("⚠ 차단 사건 있음 — " if blocked else "회복 기록만 — ") + f"{len(rows)}건 {dict(c)}"


def summarize_keys(rows, now) -> str:
    """재가입 방어 보관 키: 지금 효력이 있는 것(해제·만료 제외)과 해제·만료된 것을 나눠 센다. 해제한 시험 키를 효력 있는 키로 세면 안 된다."""
    live, off = Counter(), 0
    for r in rows or []:
        exp = _parse_ts(r.get("expires_at"))
        if r.get("released_at") or (exp and exp <= now):
            off += 1
        else:
            live[r.get("purpose")] += 1
    return f"효력 있음 {sum(live.values())}건 {dict(live)} / 해제·만료 {off}건"


def _parse_ts(v):
    try:
        d = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def summarize_lifecycle(rows, admin_ids, now, refund_days: int = 7, renewal_days: int = 7) -> str:
    """관리자 제외 활성 구독 중 ①7일 환불 구간 안(시작일 기준) ②앞으로 7일 안에 갱신일이 오는 건수와 가장 이른 날짜.

    환불 구간은 첫 자동 측정이 돌면 끝난다(정기 자동 측정도 이용으로 센다) — 구간 안 사용자에게는 이 점을 안내한다.
    """
    act = [r for r in rows if r.get("status") == "active" and r.get("user_id") not in admin_ids]
    refund, renew = [], []
    for r in act:
        st, en = _parse_ts(r.get("start_at")), _parse_ts(r.get("end_at"))
        if st and timedelta(0) <= now - st <= timedelta(days=refund_days):
            refund.append(st + timedelta(days=refund_days))
        if en and timedelta(0) <= en - now <= timedelta(days=renewal_days):
            renew.append(en)
    fmt = lambda xs: f"{len(xs)}건" + (f"(가장 이른 {min(xs).astimezone(KST):%m-%d})" if xs else "")
    return f"7일 환불 구간 안 {fmt(refund)} / 7일 내 갱신 예정 {fmt(renew)} — 외부 활성 구독 {len(act)}건 기준"


async def _count(label, fn):
    try:
        return await fn()
    except Exception as e:  # 조회 실패는 '0건'이 아니다
        return f"확인 못 함({type(e).__name__})"


async def main() -> int:
    from dotenv import load_dotenv

    load_dotenv(os.path.join(_BACKEND, ".env"))
    from db.supabase_client import get_client, execute

    now = datetime.now(KST)
    since = (now - timedelta(hours=24)).astimezone(timezone.utc).isoformat()
    sb = get_client()
    print(f"== 일일 런치 점검 {now:%Y-%m-%d %H:%M} KST (읽기 전용) ==")
    print(f"- {cookie_reminder(now)}")

    async def subs():
        rows = (await execute(sb.table("subscriptions").select("user_id,status"))).data or []
        paid = {r["user_id"] for r in (await execute(sb.table("payment_events").select("user_id").eq("status", "success"))).data or [] if r.get("user_id")}
        admins = {u.strip() for u in os.getenv("ADMIN_USER_IDS", "").split(",") if u.strip()}
        b = subscriber_breakdown(rows, admins, paid)
        by_status = dict(Counter(r.get("status") for r in rows))
        return f"{b} / 상태별 {by_status} / 외부 결제 기준 {milestone_gap(b['결제 기록 있는 외부'])} (스케줄러는 활성 전체 {b['활성 전체(스케줄러 트리거 기준)']}명으로 판단)"

    async def scans():
        rows = (await execute(sb.table("scan_results").select("business_id").gte("scanned_at", since))).data or []
        return f"{len(rows)}건 / 사업장 {len({r['business_id'] for r in rows})}곳"

    async def alerts():
        rows = (await execute(sb.table("system_alerts").select("subject,source").gte("created_at", since))).data or []
        c = Counter((r.get("source") or "?") for r in rows)
        return f"{len(rows)}건 {dict(c)}" if rows else "0건"

    async def notes():
        rows = (await execute(sb.table("notifications").select("type,status").gte("sent_at", since))).data or []
        c = Counter(f"{r.get('type')}:{r.get('status')}" for r in rows)
        return f"{len(rows)}건 {dict(c)}" if rows else "0건"

    async def pay():
        rows = (await execute(sb.table("payment_events").select("event_type").gte("created_at", since))).data or []
        c = Counter(r.get("event_type") for r in rows)
        return f"{len(rows)}건 {dict(c)}" if rows else "0건"

    async def trials():
        rows = (await execute(sb.table("trial_scans").select("id").gte("scanned_at", since))).data or []
        return f"{len(rows)}건"

    async def keys():
        rows = (await execute(sb.table("discount_used_keys").select("purpose,released_at,expires_at"))).data or []
        return summarize_keys(rows, now)

    async def naver_usage():
        from services.ai_scanner import naver_quota_history
        cap = int(os.getenv("NAVER_PLAYWRIGHT_DAILY_CAP", "600"))
        return summarize_usage(naver_quota_history(30), cap)

    async def naver_blocks():
        since7 = (now - timedelta(days=7)).astimezone(timezone.utc).isoformat()
        rows = (await execute(sb.table("naver_block_events").select("surface,event").gte("occurred_at", since7))).data or []
        return summarize_blocks(rows)

    async def lifecycle():
        rows = (await execute(sb.table("subscriptions").select("user_id,status,start_at,end_at"))).data or []
        admins = {u.strip() for u in os.getenv("ADMIN_USER_IDS", "").split(",") if u.strip()}
        return summarize_lifecycle(rows, admins, now)

    for label, fn in (("구독 상태", subs), ("최근 24h 스캔 저장", scans), ("최근 24h 운영 알림(system_alerts)", alerts),
                      ("최근 24h 알림톡 기록", notes), ("최근 24h 결제 이벤트", pay), ("최근 24h 무료 체험", trials),
                      ("재가입 방어 보관 키(건수만)", keys),
                      ("환불 구간·갱신 예정", lifecycle), ("네이버 사용량(일별 이력)", naver_usage),
                      ("네이버 차단·회복 사건(최근 7일)", naver_blocks)):
        print(f"- {label}: {await _count(label, fn)}")
    print(f"- 가드 설정: DISCOUNT_KEY_GUARD_ENABLED={os.getenv('DISCOUNT_KEY_GUARD_ENABLED', '(미설정=꺼짐)')}")
    print("- 별도 확인: pm2 logs aeolab-backend --err --lines 60 --nostream (0건이 정상), /health")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
