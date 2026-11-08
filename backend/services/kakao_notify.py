import httpx
import os
import logging
import re
from datetime import date
from typing import Optional

logger = logging.getLogger("aeolab")
_logger = logger   # 대행 서비스 알림 함수(send_delivery_*)가 쓰는 이름 — 2026-05-18부터 미정의라 "템플릿 미설정 건너뜀" 경로가 NameError였다


# ── 점수 → 텍스트 등급 변환 헬퍼 ────────────────────────────────────────────
def _grade(score: float) -> str:
    """점수 → 단계 이름. 대시보드와 같은 단일 소스(services/stage_names)를 쓴다 — 시작 전/보강 단계/개선 중/양호, 경계 30/55/75.

    2026-11-01: 알림톡만 우수/양호/보통/개선 필요, 경계 80/60/40을 따로 써서 같은 가게가 알림에서는 "양호"인데 대시보드에서는 "개선 중"으로
    보였고(점수 62), 알림의 '등급 상승' 시점도 대시보드의 단계 변화와 어긋났다. 10-28 이름 통일에서 이 함수만 빠져 있었다.
    """
    from services.stage_names import stage_code_for_score, stage_name
    return stage_name(stage_code_for_score(score))


def _weekly_direction(prev: float, curr: float) -> str:
    """주간 성적표의 추세 화살표 — 오차 범위의 점수 차이로 ▲/▼를 말하지 않는다(2026-11-08).

    같은 가게 일간 변화 중앙값이 약 3.9점이라 ±2점은 오차인데, 이전에는 점수가 0.1만 올라도 ▲를 보냈다.
    화면과 같은 규칙(stage_names.headline_direction): 변화폭이 HEADLINE_BIG_DELTA 이상이거나, 등급이 바뀌고 변화폭이
    HEADLINE_BAND_MIN_DELTA 이상일 때만 방향을 말하고 나머지는 '→'(변화 없음)이다.
    """
    from services.stage_names import HEADLINE_BIG_DELTA, HEADLINE_BAND_MIN_DELTA
    delta = curr - prev
    if abs(delta) >= HEADLINE_BIG_DELTA or (_grade(prev) != _grade(curr) and abs(delta) >= HEADLINE_BAND_MIN_DELTA):
        return "▲" if delta > 0 else "▼"
    return "→"


def _grade_label(score: float, rank: int = 0) -> str:
    """등급 + 순위 조합 레이블. rank=0이면 등급만."""
    g = _grade(score)
    if rank > 0:
        return f"{g} · 업종 {rank}위"
    return g


def _normalize_phone(phone) -> str:
    """수신번호를 숫자만(01012345678)으로 정리. 휴대전화 형식이 아니거나 비어 있으면 빈 문자열.

    프로필에는 '010-1234-5678'(하이픈)과 빈 값이 섞여 있는데, 이전에는 그대로 NHN에 보냈다(2026-10-31, 알림톡 전체 -1031 실패 조사).
    NHN이 하이픈·빈 번호를 받아 주는지는 문서 원문으로 확인하지 못했으나, 형식을 맞추고 빈 번호는 보내지 않는 쪽이 안전하다.
    """
    digits = re.sub(r"\D", "", str(phone or ""))
    if digits.startswith("82"):
        digits = "0" + digits[2:]
    return digits if re.fullmatch(r"01[0-9]\d{7,8}", digits) else ""


def _template_params(params: dict) -> dict:
    """templateParameter 키에서 '#{ }' 껍데기를 벗긴다 ('#{사업장명}' → '사업장명').

    NHN Cloud API는 변수 이름만 받는다. 코드는 처음부터 '#{사업장명}' 형태로 보내 왔고, 2026-10-31 관리자 번호 시험 발송에서
    껍데기가 있으면 변수를 다 채워도 -3004(Please check template parameter)로 실패하고 벗기면 성공했다(알림톡 전체 -1031 실패의 원인 중 하나).
    """
    out = {}
    for k, v in (params or {}).items():
        m = re.fullmatch(r"#\{(.+)\}", str(k))
        name = m.group(1) if m else k
        v = "" if v is None else str(v)
        # 마지막 안전망: 한도를 넘는 값은 발송 자체가 실패하므로(알림이 아예 안 감) 잘라서라도 보낸다. 긴 문장은 호출 쪽에서 _short로 미리 대체한다.
        out[name] = v if len(v) <= _VALUE_MAX_CHARS else v[:_VALUE_MAX_CHARS - 1] + "…"
    return out


async def _subscription_ended(phone: str) -> bool:
    """해지·만료로 서비스 기간이 끝난 계정의 번호인가(services/notify_gate.py)."""
    from services.notify_gate import is_blocked
    return await is_blocked(phone)


def _kakao_response_ok(resp) -> bool:
    """`KakaoNotifier._send`가 돌려준 응답이 실제 발송 성공인가.

    HTTP 200이어도 본문 `header.isSuccessful`이 false면 실패다(예: resultCode -1031 "All of receivers are failed to send").
    응답이 없으면(앱키 미설정으로 건너뜀 등) 성공이 아니다.
    """
    if resp is None:
        return False
    try:
        if resp.status_code >= 400:
            return False
        return bool((resp.json().get("header") or {}).get("isSuccessful", True))
    except Exception:
        return getattr(resp, "status_code", 500) < 400


def _kakao_failure_summary(resp) -> str:
    """실패 응답의 원인 요약(전화번호는 넣지 않는다). 이전 로그는 본문 앞 200자만 남겨 수신자별 사유가 잘렸다."""
    try:
        j = resp.json()
        header = j.get("header") or {}
        results = (j.get("message") or {}).get("sendResults") or []
        per = "; ".join(
            f"seq{x.get('recipientSeq')}:{x.get('resultCode')} {str(x.get('resultMessage'))[:80]}" for x in results[:3]
        )
        return f"header={header.get('resultCode')} {header.get('resultMessage')} | {per}"
    except Exception:
        return str(getattr(resp, "text", ""))[:200]


_LONG_DIGITS_RE = re.compile(r"\d{9,}")


def _failure_note(resp=None, exc: BaseException | None = None) -> str:
    """notifications.content["error"]에 남길 실패 사유(전화번호처럼 긴 숫자는 가린다, 최대 240자).

    2026-11-01: 실패한 알림 행에 사유가 없어(로그에만 있고 로그는 순환) 나중에 원인을 알 수 없었다.
    """
    try:
        note = _kakao_failure_summary(resp) if resp is not None else f"{type(exc).__name__}: {exc}"
    except Exception:
        note = "사유 확인 불가"
    return _LONG_DIGITS_RE.sub("***", note)[:240]


def _grade_change(prev: float, curr: float) -> str:
    """등급 변화 방향 텍스트 — 알림톡 변수 값은 14자 이하여야 한다(15자부터 전체 실패, 안전망이 끝을 잘라 문장이 끊긴다).

    2026-11-01: 이전 문구("↑ 보통 → 양호 한 단계 성장!" 18자 등)가 14자를 넘어 "…"로 잘려 나갔고, 같은 등급 안에서 점수가 조금 내려가도
    "등급 하락"이라고 알렸다(등급이 바뀌지 않았는데 하락으로 단정). 이제 등급이 실제로 바뀐 경우에만 '등급 상승/하락'이라 한다.
    점수 변화 알림은 이전·현재 등급을 본문에 따로 보여 주므로 여기서는 방향만 짧게 쓴다.
    """
    pg, cg = _grade(prev), _grade(curr)
    if pg != cg:
        return "등급 상승" if curr > prev else "등급 하락"
    # 같은 등급 안의 점수 차이는 대부분 오차다(같은 가게 일간 변화 중앙값 약 3.9점, 2026-11-08) — 큰 변화일 때만 방향을 말한다.
    from services.stage_names import HEADLINE_BIG_DELTA
    if curr - prev >= HEADLINE_BIG_DELTA:
        return "등급 내 상승"
    if prev - curr >= HEADLINE_BIG_DELTA:
        return "등급 내 하락"
    return "큰 변동 없음"


def _grade_transition(prev: float, curr: float) -> str:
    """"보통 → 양호"처럼 등급이 바뀐 경우를 그대로 보여 주는 값(14자 이하). 등급이 같으면 방향만."""
    pg, cg = _grade(prev), _grade(curr)
    if pg != cg:
        return f"{pg} → {cg}"
    return _grade_change(prev, curr)


# ── 카카오 알림톡 실패 시 이메일 fallback (AEOLAB_SCORE_01 우선 적용) ─────────
# 카카오 템플릿 코드 → 이메일 제목/본문 매핑
# 본문 템플릿 변수: {user_name}, {score_before}, {score_after}, {biz_name}
EMAIL_TEMPLATES: dict[str, dict] = {
    "AEOLAB_SCORE_01": {
        "subject": "[AEOlab] {biz_name} 점수 변화 알림",
        "body_template": (
            "<div style='font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1e293b;'>"
            "<h2 style='color:#1d4ed8;margin-bottom:8px;'>{biz_name} AI 노출 점수 변화</h2>"
            "<p style='font-size:16px;'>상태가 <strong>{score_before}</strong> → "
            "<strong style='color:#16a34a;'>{score_after}</strong>(으)로 변동했습니다.</p>"
            "<p style='font-size:13px;color:#64748b;'>자세한 내용은 대시보드에서 확인하세요.<br>"
            "<a href='https://aeolab.co.kr/dashboard'>https://aeolab.co.kr/dashboard</a></p>"
            "<hr style='border:none;border-top:1px solid #e2e8f0;margin:20px 0;'>"
            "<p style='font-size:11px;color:#94a3b8;'>카카오 알림톡 발송 실패로 이메일로 대체 발송됩니다.<br>"
            "AEOlab · contact@aeolab.co.kr</p>"
            "</div>"
        ),
    },
}
# 개정 템플릿(SCORE_02)은 같은 안내를 등급 텍스트로 보낸다 — 같은 이메일 본문을 쓴다(변수 이름만 다름: 이전등급·현재등급).
EMAIL_TEMPLATES["AEOLAB_SCORE_02"] = EMAIL_TEMPLATES["AEOLAB_SCORE_01"]


async def _email_fallback(
    user_id: str,
    template_code: str,
    payload: dict,
) -> None:
    """카카오 알림톡 발송 실패 시 이메일로 대체 발송.

    현재 AEOLAB_SCORE_01 템플릿만 지원. 나머지 4종은 다음 스프린트.
    실패 시 logger.warning만 남기고 호출자에 예외 전파하지 않음.
    """
    tmpl = EMAIL_TEMPLATES.get(template_code)
    if not tmpl:
        logger.debug("[email_fallback] template %s 미지원 — fallback 건너뜀", template_code)
        return

    # profiles 테이블에서 이메일 조회
    try:
        from db.supabase_client import get_client
        supabase = get_client()
        prof = supabase.table("profiles").select("email").eq("user_id", user_id).maybe_single().execute()
        to_email = (prof.data or {}).get("email") if (prof and prof.data) else None
        if not to_email:
            # profiles.email 없으면 auth.users 조회 (supabase admin API)
            try:
                # get_client()는 서비스 롤 키로 만든 클라이언트다(get_service_client라는 함수는 없다)
                from db.supabase_client import get_client as get_service_client
                service_sb = get_service_client()
                user_info = service_sb.auth.admin.get_user_by_id(user_id)
                to_email = (user_info.user.email if user_info and user_info.user else None)
            except Exception as _auth_e:
                logger.warning("[email_fallback] auth.users 이메일 조회 실패: %s", _auth_e)
    except Exception as db_e:
        logger.warning("[email_fallback] profiles 이메일 조회 실패: %s", db_e)
        return

    if not to_email:
        logger.warning("[email_fallback] user_id=%s 이메일 없음 — fallback 불가", user_id)
        return

    # 이메일 제목·본문 렌더링
    biz_name = payload.get("#{사업장명}", "")
    score_before = payload.get("#{이전점수}") or payload.get("#{이전등급}", "")
    score_after = payload.get("#{현재점수}") or payload.get("#{현재등급}", "")
    subject = tmpl["subject"].format(biz_name=biz_name)
    html_body = tmpl["body_template"].format(
        biz_name=biz_name,
        score_before=score_before,
        score_after=score_after,
        user_name=biz_name,
    )

    # 이메일 발송 (email_sender.send_email 사용)
    try:
        from services.email_sender import send_email, _mask_email
        sent = await send_email(to=to_email, subject=subject, html=html_body)
        if sent:
            logger.info(
                "[email_fallback] 발송 완료: to=%s template=%s",
                _mask_email(to_email), template_code,
            )
            # notifications 테이블에 email_fallback 채널로 기록
            try:
                supabase.table("notifications").insert({
                    "user_id": user_id,
                    "type": "score_change",
                    "content": {"template": template_code, **payload},
                    "channel": "email_fallback",
                    "status": "sent",
                }).execute()
            except Exception as log_e:
                logger.debug("[email_fallback] notifications 기록 실패: %s", log_e)
        else:
            logger.warning("[email_fallback] 발송 실패: to=%s template=%s", _mask_email(to_email), template_code)
    except Exception as send_e:
        logger.warning("[email_fallback] send_email 예외: %s", send_e)


_ACTION_LIST_MAX_CHARS = 14   # AEOLAB_ACTION_01 #{할일목록} 값 길이 한도(실측)
_FREE_TEXT_ENABLED = os.getenv("KAKAO_ALLOW_FREE_TEXT", "").strip().lower() in ("1", "true", "yes")   # 기본 꺼짐(위 _send_raw 주석)
_VALUE_MAX_CHARS = 14         # 승인 템플릿 변수 값 길이 한도 — 2026-10-31 시험 발송 실측: 14자 성공·15자 실패(-1028), ACTION·CITE·SCAN·GROWTH·NEWS 모두


def _short(text, fallback: str) -> str:
    """변수 값이 한도(14자)를 넘으면 문장을 자르지 않고(뜻이 바뀐다) 짧은 대체 문구를 쓴다."""
    t = (text or "").strip()
    return t if t and len(t) <= _VALUE_MAX_CHARS else fallback

TEMPLATES = {
    "score_change":         "AEOLAB_SCORE_01",
    "ai_citation":          "AEOLAB_CITE_01",
    "competitor":           "AEOLAB_COMP_01",
    "market_news":          "AEOLAB_NEWS_01",
    "action_items":         "AEOLAB_ACTION_01",
    "competitor_overtake":  "AEOLAB_COMP_02",
    "scan_complete":        "AEOLAB_SCAN_01",
    "monthly_report":       "AEOLAB_MONTHLY_01",
    "growth_stage_up":      "AEOLAB_GROWTH_01",
    "weekly_report":        "AEOLAB_WEEKLY_01",
    "notice":               "AEOLAB_NOTICE_01",
    # v3.1 키워드 변동 알림 (service_unification_v1.0.md §4.5)
    # 비즈센터 신청·승인 후 환경변수 KAKAO_TEMPLATE_KEYWORD_CHANGE 설정 필요. 미설정 시 "" → graceful skip
    "keyword_change":       os.getenv("KAKAO_TEMPLATE_KEYWORD_CHANGE", ""),
}

# 개정 템플릿 전환 스위치(2026-11-02, SCORE_02·SCAN_02 승인): 환경변수가 비어 있으면 기존 템플릿(SCORE_01·SCAN_01)을 쓴다.
# 값이 알려진 개정 코드가 아니면 무시한다 — 변수 구성이 다른 템플릿에 엉뚱한 값을 보내면 전부 -3004로 실패하기 때문(코드가 변수를 채우는 방식은 템플릿별이다).
_TEMPLATE_ENV_OVERRIDE = {
    "score_change": ("KAKAO_TEMPLATE_SCORE_CHANGE", "AEOLAB_SCORE_02"),
    "scan_complete": ("KAKAO_TEMPLATE_SCAN_COMPLETE", "AEOLAB_SCAN_02"),
}


def resolve_template_code(ttype: str) -> str:
    """이 알림 종류로 지금 보낼 템플릿 코드. `_send` 안에서 `template_code` 지역변수와 이름이 겹치지 않게 다른 이름을 쓴다."""
    spec = _TEMPLATE_ENV_OVERRIDE.get(ttype)
    if spec:
        env_name, allowed = spec
        value = os.getenv(env_name, "").strip()
        if value == allowed:
            return value
        if value:
            logger.warning("%s=%r 는 알려진 개정 템플릿(%s)이 아니라 무시한다 — 기존 템플릿 유지", env_name, value, allowed)
    return TEMPLATES[ttype]


class KakaoNotifier:
    _BASE_TMPL = "https://kakaotalk-bizmessage.api.nhncloudservice.com/alimtalk/v2.3/appkeys/{appkey}"

    @property
    def BASE(self):
        return self._BASE_TMPL.format(appkey=os.getenv("KAKAO_APP_KEY", ""))

    async def send_score_change(
        self, phone: str, biz_name: str, prev: float, curr: float, prev_r: int, curr_r: int,
        user_id: str | None = None, curr_total: int | None = None,
    ):
        """점수 변화 알림. 점수 수치 대신 등급+순위 텍스트로 발송. 실제 전달 성공 여부를 돌려준다(호출자의 발송 간격 기록용).

        `KAKAO_TEMPLATE_SCORE_CHANGE=AEOLAB_SCORE_02`이면 승인된 개정 본문(2026-11-02 콘솔 캡처: 고정 '점'·'위' 없음)의 변수로 채운다.
        curr_total: 현재 업종 내 집계 사업장 수 — 3곳 미만이면 순위를 말하지 않는다(성장 화면의 '비교 데이터 수집 중'과 같은 기준).
        """
        if resolve_template_code("score_change") == "AEOLAB_SCORE_02":
            # 승인 본문이 "등급 변동 안내 … 변경 내역이 확인될 경우 발송"이다 — 등급이 그대로인데 "이전 등급: 개선 중 → 현재 등급: 개선 중"을 보내면
            # 본문 목적과 어긋나고(2026-11-02 재현 문장 점검), 측정이 흔들리는 가게는 같은 등급 안의 3점 변화가 거의 매일 나와 노이즈가 된다.
            if _grade(prev) == _grade(curr):
                logger.info("send_score_change(SCORE_02) 건너뜀: 등급이 바뀌지 않았다")
                return False
            ranked = bool(curr_r) and curr_total is not None and curr_total >= 3
            resp = await self._send(
                phone,
                "score_change",
                {
                    "#{사업장명}": biz_name,
                    "#{스캔일시}": date.today().strftime("%Y-%m-%d"),
                    "#{이전등급}": _grade(prev),
                    "#{현재등급}": _grade(curr),
                    "#{변화}": _grade_change(prev, curr),
                    "#{순위}": f"{curr_r}위" if ranked else "집계 전",   # 측정·집계가 안 된 것은 0위·-위가 아니라 '집계 전'(지침 9)
                },
                user_id=user_id,
            )
            return _kakao_response_ok(resp)
        resp = await self._send(
            phone,
            "score_change",
            {
                "#{사업장명}": biz_name,
                # 순위는 본문의 "지역 순위" 줄에 따로 나온다 — 값에 "· 업종 N위"를 넣으면 순위가 두 번 나오고 "점"이 붙은 문장이 어색해진다(2026-11-01).
                # 승인 본문이 "#{이전점수}점"이라 값은 숫자 대신 등급 텍스트(점수 숫자 노출 금지 원칙)를 쓰며, 자연스러운 문장은 본문 개정(재신청)이 필요하다.
                "#{이전점수}": _grade(prev),
                "#{현재점수}": _grade(curr),
                "#{변화}": _grade_change(prev, curr),
                "#{이전순위}": str(prev_r) if prev_r else "-",
                "#{현재순위}": str(curr_r) if curr_r else "-",
                # 승인된 AEOLAB_SCORE_01 본문이 요구하는 변수(2026-10-31 시험 발송 실측: 빠지면 -3004 "Please check template parameter")
                "#{스캔일시}": date.today().strftime("%Y-%m-%d"),
            },
            user_id=user_id,
        )
        return _kakao_response_ok(resp)

    async def send_keyword_change(
        self, phone: str, biz_name: str, keyword: str, prev_rank: int, curr_rank: int
    ):
        """키워드 순위 변동 알림 (AEOLAB_KW_01).
        prev/curr_rank: 99=미노출, 그 외 1-based 순위.
        KAKAO_TEMPLATE_KEYWORD_CHANGE 미설정 시 graceful skip (비즈센터 승인 전).
        """
        template_code = TEMPLATES.get("keyword_change", "")
        if not template_code:
            logger.debug("[keyword_change] graceful skip — KAKAO_TEMPLATE_KEYWORD_CHANGE 미설정")
            return
        def _fmt(r: int) -> str:
            return "미노출" if r >= 99 else f"{r}위"
        delta = prev_rank - curr_rank  # 양수=상승
        sign = "↑" if delta > 0 else ("↓" if delta < 0 else "→")
        await self._send(
            phone,
            "keyword_change",  # 템플릿 키 (실제 ID는 _send 내부 매핑)
            {
                "#{사업장명}": biz_name,
                "#{키워드}": keyword[:20],
                "#{이전순위}": _fmt(prev_rank),
                "#{현재순위}": _fmt(curr_rank),
                "#{변화}": f"{sign}{abs(delta)}" if delta else "변동 없음",
            },
        )

    async def send_ai_citation(
        self, phone: str, biz_name: str, platform: str, query: str, excerpt: str
    ) -> bool:
        """AI 인용 알림. 실제 전달 성공 여부를 돌려준다(호출자의 발송 간격 기록용)."""
        resp = await self._send(
            phone,
            "ai_citation",
            {
                "#{사업장명}": biz_name,
                "#{AI플랫폼}": platform,
                "#{검색어}": query,
                "#{인용내용}": _short(excerpt, "AI 답변에 언급됨"),
                "#{확인일시}": date.today().strftime("%Y-%m-%d"),
            },
        )
        return _kakao_response_ok(resp)

    async def send_competitor_change(self, phone: str, biz_name: str, comp_name: str, change_text: str) -> bool:
        """경쟁사 변화 알림(AEOLAB_COMP_01). `순위변화` 변수에는 점수 증감 숫자가 아니라 "AI 노출 상승/하락" 같은 텍스트를 넣는다.

        이전에는 점수 증감(int)을 넣었고(점수 숫자 직접 노출 금지 위반) 주간 경로는 항상 0을 보냈다(2026-11-01 수정).
        실제 전달 성공일 때만 True — 호출자가 '발송됨'으로 기록해도 되는지 판단하게 한다.
        """
        try:
            resp = await self._send(
                phone,
                "competitor",
                {
                    "#{사업장명}": biz_name,
                    "#{경쟁사명}": comp_name,
                    "#{순위변화}": str(change_text),
                    "#{확인일시}": date.today().strftime("%Y-%m-%d"),
                },
            )
            return _kakao_response_ok(resp)
        except Exception as e:
            masked = f"{phone[:3]}****{phone[-2:]}" if len(phone) >= 5 else "***"
            logger.warning(f"send_competitor_change 실패 ({masked}): {e}")
            return False

    async def send_action_items(self, phone: str, biz_name: str, items: list) -> bool:
        """이달 할 일 알림. 실제 발송 성공 여부를 돌려준다(호출자가 '발송됨'으로 기록해도 되는지 판단하게)."""
        # 승인된 AEOLAB_ACTION_01의 #{할일목록}은 14자를 넘으면 -1028("more than 14 characters in template value")로 실패한다
        # (2026-10-31 시험 발송: 14자 성공·15자 실패). 긴 문장을 자르면 뜻이 바뀌므로 건수만 알리고 내용은 대시보드에서 보게 한다.
        # 긴 목록을 보내려면 비즈센터에서 이 변수의 길이 제한이 없는 템플릿으로 재신청해야 한다.
        items_text = "\n".join(f"• {item}" for item in items[:3])
        if len(items_text) > _ACTION_LIST_MAX_CHARS:
            items_text = f"할 일 {min(len(items), 3)}건 확인 필요"
        resp = await self._send(
            phone,
            "action_items",
            {
                "#{사업장명}": biz_name,
                "#{할일목록}": items_text,
                "#{기준일}": date.today().strftime("%Y-%m-%d"),
            },
        )
        return _kakao_response_ok(resp)

    async def send_post_remind(self, phone: str, biz_name: str, days: int = 14) -> bool:
        """소식 N일 미작성 알림 (action_items 템플릿 재활용).

        AI 브리핑 적시성(Timeliness) 점수 유지 환기 — 14일 미작성 시 발송.
        실제 발송 성공 여부를 돌려준다 — 이전에는 반환값이 없어 잡이 실패한 발송도 '발송됨'으로 기록했다(2026-10-31).
        """
        # #{할일목록}은 14자 제한이라(send_action_items 주석) 긴 문장 3줄은 보낼 수 없다 — 사실만 짧게
        return await self.send_action_items(phone, biz_name, [f"소식 {days}일 미작성"])

    async def send_market_news(self, phone: str, biz_name: str, category: str, news: str):
        await self._send(
            phone,
            "market_news",
            {
                "#{사업장명}": biz_name,
                "#{업종}": category,
                "#{시장동향}": _short(news, "대시보드에서 확인"),
            },
        )

    async def send_expire_warning(self, phone: str, plan: str, days_left: int):
        """구독 만료 D-7 알림 (승인 템플릿 AEOLAB_EXPIRE_01: #{플랜명}·#{잔여일})"""
        await self._send_delivery_template(
            phone=phone, template_code="AEOLAB_EXPIRE_01",
            params={"#{플랜명}": str(plan).upper(), "#{잔여일}": str(days_left)}, log_tag="expire_warning",
        )

    async def send_payment_failed(self, phone: str):
        """자동결제 실패 알림 (승인 템플릿 AEOLAB_PAYFAIL_01, 변수 없음)"""
        await self._send_delivery_template(phone=phone, template_code="AEOLAB_PAYFAIL_01", params={}, log_tag="payment_failed")

    async def send_suspended(self, phone: str):
        """구독 정지 알림 (승인 템플릿 AEOLAB_SUSPEND_01, 변수 없음)"""
        await self._send_delivery_template(phone=phone, template_code="AEOLAB_SUSPEND_01", params={}, log_tag="suspended")

    async def send_payment_recovered(self, phone: str):
        """유예 기간 중 자동결제 재시도 성공 알림 (승인 템플릿 AEOLAB_RESUME_01, 변수 없음)"""
        await self._send_delivery_template(phone=phone, template_code="AEOLAB_RESUME_01", params={}, log_tag="payment_recovered")

    async def send_notice(self, phone: str, message: str) -> bool:
        """관리자 공지 발송. 실제 발송 성공이면 True(승인된 공지 템플릿이 없어 지금은 False)."""
        return await self._send_raw(phone, f"[AEOlab 공지]\n{message}", template_code="AEOLAB_NOTICE_01")

    async def send_price_increase_notice(self, phone: str, regular_price: int):
        """첫 달 50% 할인 종료 D-3 사전고지 (legal_compliance_and_infra_resilience_audit_v1.0.md B축 P1).

        전자상거래법 시행령 — 정기결제 대금 증액 시 그 증액 시점 임박 시 별도 고지 의무.
        가입 시점 1회 안내(PayButton.tsx)만으로는 이 요건을 충족하는지 해석이 갈려
        실무 관행에 따라 증액 3일 전 별도 알림을 추가한다.
        """
        await self._send_delivery_template(
            phone=phone, template_code="AEOLAB_PRICEUP_01",
            params={"#{정상가}": f"{regular_price:,}"}, log_tag="price_increase",
        )

    async def send_subscription_cancelled(self, phone: str, refunded: bool, refund_amount: int | None = None):
        """구독 해지 완료 알림 (7일 이내 자동환불 여부에 따라 문구 분기)"""
        if refunded:
            amount_str = f"{refund_amount:,}원" if refund_amount else "결제하신 금액"
            message = (
                "[AEOlab] 구독 해지 및 전액 환불이 완료되었습니다.\n"
                f"환불 금액: {amount_str}\n"
                "영업일 기준 3~5일 내 결제하신 수단으로 환불됩니다."
            )
        else:
            message = (
                "[AEOlab] 구독 해지가 완료되었습니다.\n"
                "현재 결제 기간 만료일까지 서비스를 계속 이용하실 수 있습니다."
            )
        if refunded:
            # 환불 완료 안내 승인 템플릿은 아직 등록되지 않았다(2026-10-31, 사용자 확인) — 등록 후 코드를 환경변수에 넣으면 보낸다.
            # 변수: #{환불금액}. 미설정이면 보내지 않고 기록한다(자유 문구는 전달되지 않는다).
            refund_tmpl = os.getenv("KAKAO_TEMPLATE_CANCEL_REFUND", "").strip()
            if refund_tmpl:
                await self._send_delivery_template(
                    phone=phone, template_code=refund_tmpl,
                    params={"#{환불금액}": f"{refund_amount:,}원" if refund_amount else "결제 금액"}, log_tag="subscription_cancelled_refund",
                )
            else:
                logger.warning("send_subscription_cancelled: 환불 안내 알림톡 템플릿 미등록(KAKAO_TEMPLATE_CANCEL_REFUND) — 발송 안 함")
                self._log_notification(None, "subscription_cancelled_refund", {"reason": "template_not_registered"}, "skipped")
        else:
            await self._send_delivery_template(phone=phone, template_code="AEOLAB_CANCEL_01", params={}, log_tag="subscription_cancelled")

    async def send_competitor_overtake(
        self, phone: str, biz_name: str, comp_name: str,
        my_score: float, comp_score: float, gap: float,
    ):
        """경쟁사 역전 알림 (템플릿 코드: AEOLAB_COMP_02)"""
        # 이전에는 격차 20점 이상일 때만 불려서 "근소한 차이로"는 나올 수 없었고 항상 "큰 격차로"였다. 경쟁사 점수는 간이 추정치라
        # 격차 크기를 단정하지 않는다(2026-11-02). 승인 본문 "(#{격차설명} 앞서고 있어요)"에 맞는 짧은 값. gap 인자는 호출 호환용.
        gap_note = "추정상"
        # 승인 템플릿 변수로 보낸다(자유 문구 _send_raw 경로는 변수를 채우지 않아 승인 템플릿과 맞지 않았다 — 2026-10-31 콘솔 본문 대조)
        await self._send(
            phone,
            "competitor_overtake",
            {
                "#{사업장명}": biz_name,
                "#{경쟁사명}": comp_name,
                "#{내등급}": _grade(my_score),
                "#{경쟁사등급}": _grade(comp_score),
                "#{격차설명}": gap_note,
            },
        )

    async def send_scan_complete(
        self, phone: str, biz_name: str, score: float, grade: str,
        weekly_change: float, top_platform: str, top_improvement: str,
    ):
        """스캔 완료 즉시 알림 (템플릿 코드: AEOLAB_SCAN_01, `KAKAO_TEMPLATE_SCAN_COMPLETE=AEOLAB_SCAN_02`이면 개정본)

        grade: 직전 스캔의 단계 이름(비교할 수 없으면 빈 문자열). 개정본의 '지난 스캔 대비' 값이 된다.
        """
        if resolve_template_code("scan_complete") == "AEOLAB_SCAN_02":
            # 승인 개정 본문(2026-11-02 콘솔 캡처)에는 '가장 많이 언급됨'·개선포인트·등급변화메모 줄이 없어 언급 플랫폼 조건이 필요 없다.
            # 대신 이 알림은 스캔마다 가므로 주간 상한 모듈이 번호당 주 1건으로 막는다(services/notify_weekly_cap.PER_TYPE_WEEKLY).
            curr_stage = _grade(score)
            prev_stage = (grade or "").strip()
            change = "비교 전" if not prev_stage else ("단계 유지" if prev_stage == curr_stage else f"{prev_stage} → {curr_stage}")
            resp = await self._send(
                phone,
                "scan_complete",
                {
                    "#{사업장명}": biz_name,
                    "#{스캔일시}": date.today().strftime("%Y-%m-%d"),
                    "#{현재단계}": curr_stage,
                    "#{변화}": change,
                },
            )
            return _kakao_response_ok(resp)
        # 승인 본문에 "#{최다플랫폼}에서 가장 많이 언급됨" 줄이 고정으로 있어, 언급이 확인된 플랫폼이 없을 때 "AI 검색"(정기 스캔)·"없음"(수동 스캔)을
        # 넣으면 한 번도 언급되지 않은 가게에도 "가장 많이 언급됨"이 나간다(2026-11-01 콘솔 본문 대조로 발견, 지침 9: 사실 아닌 문구 금지).
        # 줄을 뺄 수 없으므로 근거가 없으면 보내지 않는다 — 본문을 바꾼 템플릿이 승인되면 이 조건을 다시 본다.
        if (top_platform or "").strip() in ("", "없음", "AI 검색"):
            logger.info("send_scan_complete skipped: 언급이 확인된 플랫폼이 없어 '가장 많이 언급됨' 줄을 채울 수 없다")
            self._log_notification(None, "scan_complete", {"reason": "no_platform_mention"}, "skipped")
            return
        curr_grade = _grade(score)
        grade_change_note = f"({grade} → {curr_grade})" if grade and grade != curr_grade else "(유지)"
        await self._send(
            phone,
            "scan_complete",
            {
                "#{사업장명}": biz_name,
                "#{현재등급}": curr_grade,
                "#{등급변화메모}": grade_change_note,
                "#{추세}": _grade_change(score - weekly_change, score),
                "#{최다플랫폼}": top_platform or "AI 검색",
                "#{개선포인트}": _short(top_improvement, "가이드에서 확인"),
            },
        )

    async def send_gap_card_url(self, phone: str, biz_name: str, card_url: str):
        """주간 갭 카드 PNG URL 알림 — 카카오톡 공유 유도"""
        message = (
            f"[AEOlab] {biz_name} 이번 주 경쟁 현황\n\n"
            f"📊 AI 경쟁 순위 카드가 생성되었습니다.\n\n"
            f"▼ 카드 보기 (카카오톡으로 공유 가능)\n"
            f"{card_url}\n\n"
            f"같은 상권 사장님들과 공유해보세요."
        )
        await self._send_raw(phone, message, template_code="AEOLAB_NOTICE_01")

    async def send_monthly_report(
        self, phone: str, biz_name: str, score_change: Optional[float],
        scan_count: int, citation_count: int, month_str: str,
    ):
        """월간 성장 리포트 알림 (템플릿 코드: AEOLAB_MONTHLY_01)

        score_change=None은 '비교할 수 없다'(기록이 한 건뿐이거나 없음, 또는 비교하는 스캔에 네이버 측정이 빠짐)는 뜻이다 —
        0.0으로 넘기면 "변동 없음"이라는 거짓 단정이 되므로 별도 문구를 쓴다(스캔 횟수·인용 건수는 사실이라 그대로 보낸다).
        """
        app_key = os.getenv("KAKAO_APP_KEY", "")
        if not app_key:
            masked = f"{phone[:3]}****{phone[-2:]}" if len(phone) >= 5 else "***"
            logger.warning(f"send_monthly_report skipped (KAKAO_APP_KEY 미설정): {masked}")
            return False
        if score_change is None:
            trend = "비교 데이터 부족"          # 8자 — 알림톡 변수 14자 한도 이내
        else:
            # 방향은 화면과 같은 기준으로 말한다(오차 범위 3점 미만은 변화로 말하지 않음, 10점 이상이 '뚜렷한' 변화 — stage_names).
            from services.stage_names import HEADLINE_BIG_DELTA, HEADLINE_BAND_MIN_DELTA
            if abs(score_change) < HEADLINE_BAND_MIN_DELTA:
                trend = "큰 변동 없음"
            elif score_change >= HEADLINE_BIG_DELTA:
                trend = "뚜렷한 상승세"
            elif score_change > 0:
                trend = "소폭 상승"
            elif score_change > -HEADLINE_BIG_DELTA:
                trend = "소폭 하락"
            else:
                trend = "하락 — 점검 필요"
        month = str(int(month_str)) if str(month_str).isdigit() else str(month_str)
        resp = await self._send(
            phone,
            "monthly_report",
            {
                "#{월}": month,
                "#{사업장명}": biz_name,
                "#{추세}": trend,
                "#{스캔횟수}": str(scan_count),
                "#{인용건수}": str(citation_count),
            },
        )
        # 실제로 전달됐을 때만 True — 호출부가 '보냈다'고 기록하는 근거다(지침 9: 발송 실패를 성공으로 기록하지 않는다)
        return _kakao_response_ok(resp)

    async def send_delivery_received(
        self, order_id: str, user_phone: str, package_name: str, business_name: str
    ) -> None:
        """대행 서비스 접수 완료 알림 (KAKAO_TEMPLATE_DELIVERY_01).

        결제 확인 후 status → paid 전환 시점에 호출.
        환경변수 KAKAO_TEMPLATE_DELIVERY_01 미설정 시 graceful skip.
        """
        template = os.getenv("KAKAO_TEMPLATE_DELIVERY_01", "")
        if not template:
            _logger.debug("[delivery] send_delivery_received skip — KAKAO_TEMPLATE_DELIVERY_01 미설정")
            return
        app_key = os.getenv("KAKAO_APP_KEY", "")
        if not app_key:
            masked = f"{user_phone[:3]}****{user_phone[-2:]}" if len(user_phone) >= 5 else "***"
            _logger.debug(f"[delivery] send_delivery_received skip — KAKAO_APP_KEY 미설정 ({masked})")
            return
        await self._send_delivery_template(
            phone=user_phone,
            template_code=template,
            params={
                "#{주문번호}": str(order_id)[:8],
                "#{패키지명}": re.sub(r"^\d+\s*", "", str(package_name)),
                "#{사업장명}": business_name,
            },
            log_tag="delivery_received",
        )

    async def send_delivery_in_progress(
        self,
        order_id: str,
        user_phone: str,
        package_name: str,
        business_name: str,
        expected_days: int = 3,
    ) -> None:
        """대행 서비스 작업 시작 알림 (KAKAO_TEMPLATE_DELIVERY_02).

        관리자가 status → in_progress 전환 시 호출.
        환경변수 KAKAO_TEMPLATE_DELIVERY_02 미설정 시 graceful skip.
        """
        template = os.getenv("KAKAO_TEMPLATE_DELIVERY_02", "")
        if not template:
            _logger.debug("[delivery] send_delivery_in_progress skip — KAKAO_TEMPLATE_DELIVERY_02 미설정")
            return
        app_key = os.getenv("KAKAO_APP_KEY", "")
        if not app_key:
            masked = f"{user_phone[:3]}****{user_phone[-2:]}" if len(user_phone) >= 5 else "***"
            _logger.debug(f"[delivery] send_delivery_in_progress skip — KAKAO_APP_KEY 미설정 ({masked})")
            return
        await self._send_delivery_template(
            phone=user_phone,
            template_code=template,
            params={
                "#{주문번호}": str(order_id)[:8],
                "#{패키지명}": re.sub(r"^\d+\s*", "", str(package_name)),
                "#{사업장명}": business_name,
                "#{예상일수}": str(expected_days),
            },
            log_tag="delivery_in_progress",
        )

    async def send_delivery_completed(
        self, order_id: str, user_phone: str, package_name: str, business_name: str
    ) -> None:
        """대행 서비스 완료 알림 (KAKAO_TEMPLATE_DELIVERY_03).

        관리자가 status → completed 전환 시 호출.
        환경변수 KAKAO_TEMPLATE_DELIVERY_03 미설정 시 graceful skip.
        """
        template = os.getenv("KAKAO_TEMPLATE_DELIVERY_03", "")
        if not template:
            _logger.debug("[delivery] send_delivery_completed skip — KAKAO_TEMPLATE_DELIVERY_03 미설정")
            return
        app_key = os.getenv("KAKAO_APP_KEY", "")
        if not app_key:
            masked = f"{user_phone[:3]}****{user_phone[-2:]}" if len(user_phone) >= 5 else "***"
            _logger.debug(f"[delivery] send_delivery_completed skip — KAKAO_APP_KEY 미설정 ({masked})")
            return
        await self._send_delivery_template(
            phone=user_phone,
            template_code=template,
            params={
                "#{주문번호}": str(order_id)[:8],
                "#{패키지명}": re.sub(r"^\d+\s*", "", str(package_name)),
                "#{사업장명}": business_name,
            },
            log_tag="delivery_completed",
        )

    async def send_delivery_rescan(
        self,
        order_id: str,
        user_phone: str,
        business_name: str,
        score_before: float,
        score_after: float,
    ) -> None:
        """대행 완료 후 재스캔 결과 알림 (KAKAO_TEMPLATE_DELIVERY_04).

        작업 완료 후 재스캔 점수가 기록된 시점에 호출.
        환경변수 KAKAO_TEMPLATE_DELIVERY_04 미설정 시 graceful skip.
        """
        template = os.getenv("KAKAO_TEMPLATE_DELIVERY_04", "")
        if not template:
            _logger.debug("[delivery] send_delivery_rescan skip — KAKAO_TEMPLATE_DELIVERY_04 미설정")
            return
        app_key = os.getenv("KAKAO_APP_KEY", "")
        if not app_key:
            masked = f"{user_phone[:3]}****{user_phone[-2:]}" if len(user_phone) >= 5 else "***"
            _logger.debug(f"[delivery] send_delivery_rescan skip — KAKAO_APP_KEY 미설정 ({masked})")
            return
        await self._send_delivery_template(
            phone=user_phone,
            template_code=template,
            params={
                "#{주문번호}": str(order_id)[:8],
                "#{사업장명}": business_name,
                "#{등급변화}": _grade_transition(score_before, score_after),
            },
            log_tag="delivery_rescan",
        )

    async def _send_delivery_template(
        self,
        phone: str,
        template_code: str,
        params: dict,
        log_tag: str = "delivery",
    ) -> None:
        """대행 서비스 알림톡 발송 내부 공통 헬퍼.

        _send()와 달리 TEMPLATES dict를 사용하지 않고 template_code를 직접 받음.
        실패 시 _logger.warning 기록 후 silently return (호출자 응답에 영향 없음).
        """
        phone = _normalize_phone(phone)
        if not phone:
            logger.warning(f"[{log_tag}] 알림톡 건너뜀: 수신번호 없음 또는 형식 오류 (template={template_code})")
            self._log_notification(None, log_tag, {"template": template_code}, "skipped")
            return
        if not os.getenv("KAKAO_APP_KEY", ""):
            logger.warning(f"[{log_tag}] 알림톡 건너뜀: KAKAO_APP_KEY 미설정")
            self._log_notification(None, log_tag, {"template": template_code}, "skipped")
            return
        masked = f"{phone[:3]}****{phone[-2:]}" if len(phone) >= 5 else "***"
        status = "sent"
        fail_note = None
        try:
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.post(
                    f"{self.BASE}/messages",
                    headers={"X-Secret-Key": os.getenv("KAKAO_SECRET_KEY", "")},
                    json={
                        "senderKey": os.getenv("KAKAO_SENDER_KEY", ""),
                        "templateCode": template_code,
                        "recipientList": [
                            {"recipientNo": phone, "templateParameter": _template_params(params)}
                        ],
                    },
                )
            body_ok = True
            if r.status_code < 400:
                try:
                    body_ok = r.json().get("header", {}).get("isSuccessful", True)
                except Exception:
                    body_ok = True
            if r.status_code >= 400 or not body_ok:
                status = "failed"
                fail_note = _failure_note(resp=r)
                logger.warning(
                    f"[{log_tag}] 알림톡 발송 실패 {r.status_code} "
                    f"({masked}, template={template_code}): {r.text[:200]}"
                )
            else:
                logger.info(f"[{log_tag}] 알림톡 발송 완료 → {masked}")
        except Exception as e:
            status = "failed"
            fail_note = _failure_note(exc=e)
            logger.warning(f"[{log_tag}] 알림톡 발송 오류 ({masked}): {e}")
        finally:
            _content = {"phone": masked, **{k: v for k, v in params.items() if "전화" not in k}}
            if fail_note:
                _content["error"] = fail_note
            self._log_notification(None, log_tag, _content, status)

    async def send_text(self, phone: str, message: str) -> bool:
        """단문 텍스트 알림 발송. 실제 발송 성공이면 True."""
        return await self._send_raw(phone, message, template_code="AEOLAB_NOTICE_01")


    async def send_first_exposure(
        self,
        phone: str,
        biz_name: str,
        platform: str = "네이버 AI 브리핑",
    ) -> bool:
        """처음으로 AI에 노출됐을 때 알림 — AEOLAB_CITE_01 재활용"""
        try:
            resp = await self._send(
                phone,
                "ai_citation",
                {
                    "#{사업장명}": biz_name,
                    "#{AI플랫폼}": platform,
                    "#{검색어}": "AI 검색",
                    "#{인용내용}": "처음 AI 노출 확인",
                    "#{확인일시}": date.today().strftime("%Y-%m-%d"),
                },
            )
            return _kakao_response_ok(resp)
        except Exception as e:
            masked = f"{phone[:3]}****{phone[-2:]}" if len(phone) >= 5 else "***"
            logger.warning(f"send_first_exposure 실패 ({masked}): {e}")
            return False

    async def send_growth_stage_upgrade(
        self, phone: str, biz_name: str, prev_stage: str, curr_stage: str, this_week_action: str = ""
    ):
        """성장 단계 업그레이드 알림 (템플릿 코드: AEOLAB_GROWTH_01)

        prev_stage/curr_stage: 호출측(jobs.py)에서 이미 한글 레이블(시작 전/보강 단계/개선 중/양호 — services/stage_names.STAGE_NAME)로 전달됨.
        this_week_action: 이번 주 추천 액션(gap_analyzer._build_growth_stage 반환값) — 숫자 아님.
        """
        await self._send(
            phone,
            "growth_stage_up",
            {
                "#{사업장명}": biz_name,
                "#{이전단계}": prev_stage,
                "#{현재단계}": curr_stage,
                "#{이번주추천}": _short(this_week_action, "개선 가이드 확인"),
            },
        )

    async def _send_raw(self, phone: str, text: str, template_code: str = "AEOLAB_NOTICE_01", gated: bool = True) -> bool:
        """알림톡 자유 메시지 발송 (SMS fallback 포함). 발송 성공이면 True, 실패·미설정(skipped)이면 False.

        NHN Cloud 알림톡 API v2.3: resendType=SMS로 템플릿 미승인 시에도 SMS 대체 발송.
        KAKAO_APP_KEY 미설정 시 skipped 처리 (graceful degradation).
        반환값(2026-10-28): 이전에는 아무것도 돌려주지 않아 호출한 쪽이 실패를 성공으로 기록했다(별점 알림 잡이 실패한 알림을 '발송됨'으로
        남기고 영영 재시도하지 않음). 기존 호출처는 반환값을 쓰지 않으므로 동작은 그대로다.
        """
        phone = _normalize_phone(phone)
        if not phone:
            logger.warning("_send_raw skipped: 수신번호 없음 또는 형식 오류")
            self._log_notification(None, "notice", {"text": text[:200]}, "skipped")
            return False
        if gated and await _subscription_ended(phone):
            logger.info("_send_raw skipped: 서비스 기간이 끝난 계정")
            self._log_notification(None, "notice", {"text": text[:200]}, "skipped")
            return False
        if not _FREE_TEXT_ENABLED:
            # 2026-10-31 시험 발송 실측: AEOLAB_NOTICE_01은 존재하지 않는 템플릿(-3003 Template does not exist)이고, 다른 승인 코드에 자유 문구를
            # 얹으면 변수 불일치(-3004)로 실패한다 — 알림톡은 승인된 본문의 변수만 채울 수 있다. 매번 실패 요청을 보내지 않고 건너뛴다.
            # 이 경로를 쓰던 알림은 승인 템플릿(_send 또는 _send_delivery_template)으로 옮기거나 새 템플릿을 등록한 뒤에 보낼 수 있다.
            logger.warning("_send_raw 건너뜀: 자유 문구를 보낼 승인 템플릿이 없음 (template=%s)", template_code)
            self._log_notification(None, "notice", {"text": text[:200], "reason": "no_approved_template"}, "skipped")
            return False
        app_key = os.getenv("KAKAO_APP_KEY", "")
        if not app_key:
            masked = f"{phone[:3]}****{phone[-2:]}" if len(phone) >= 5 else "***"
            logger.warning(f"_send_raw skipped: KAKAO_APP_KEY 미설정 ({masked})")
            self._log_notification(None, "notice", {"text": text[:200]}, "skipped")
            return False
        masked = f"{phone[:3]}****{phone[-2:]}" if len(phone) >= 5 else "***"
        status = "sent"
        fail_note = None
        try:
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.post(
                    f"{self.BASE}/messages",
                    headers={"X-Secret-Key": os.getenv("KAKAO_SECRET_KEY", "")},
                    json={
                        "senderKey": os.getenv("KAKAO_SENDER_KEY", ""),
                        "templateCode": template_code,
                        "recipientList": [{
                            "recipientNo": phone,
                            "content": text,
                            "resendType": "SMS",
                            "resendContent": text[:80],
                        }],
                    },
                )
            body_ok = True
            if r.status_code < 400:
                try:
                    body_ok = r.json().get("header", {}).get("isSuccessful", True)
                except Exception:
                    body_ok = True
            if r.status_code >= 400 or not body_ok:
                status = "failed"
                fail_note = _failure_note(resp=r)
                logger.warning(f"Kakao _send_raw failed {r.status_code}: {r.text[:200]}")
            else:
                logger.info(f"Kakao notify -> {masked}: {text[:50]}...")
        except Exception as e:
            status = "failed"
            fail_note = _failure_note(exc=e)
            logger.warning(f"Kakao _send_raw error: {e}")
        finally:
            _content = {"phone": masked, "text": text[:200]}
            if fail_note:
                _content["error"] = fail_note
            self._log_notification(None, "notice", _content, status)
        return status == "sent"

    async def _send(self, phone: str, ttype: str, params: dict, user_id: str | None = None):
        """알림톡 발송. AEOLAB_SCORE_01 실패 시 이메일 fallback 자동 실행.

        Args:
            user_id: 이메일 fallback에 필요한 사용자 ID (None이면 fallback 불가).
        """
        phone = _normalize_phone(phone)
        if not phone:
            logger.warning(f"_send skipped: 수신번호 없음 또는 형식 오류 (ttype={ttype})")
            self._log_notification(None, ttype, {"reason": "no_phone", **params}, "skipped")
            if ttype == "score_change" and user_id:
                template_code = resolve_template_code(ttype) if ttype in TEMPLATES else ""
                if template_code:
                    await _email_fallback(user_id, template_code, params)
            return None
        if await _subscription_ended(phone):
            logger.info("_send skipped: 서비스 기간이 끝난 계정 (ttype=%s)", ttype)
            self._log_notification(None, ttype, {"reason": "subscription_ended", **params}, "skipped")
            return None
        app_key = os.getenv("KAKAO_APP_KEY", "")
        if not app_key:
            masked = f"{phone[:3]}****{phone[-2:]}" if len(phone) >= 5 else "***"
            logger.warning(f"_send skipped: KAKAO_APP_KEY 미설정 ({masked}, ttype={ttype})")
            self._log_notification(None, ttype, {"reason": "no_app_key", "phone": masked, **params}, "skipped")
            # KAKAO_APP_KEY 미설정 시에도 score_change는 이메일 fallback 시도
            if ttype == "score_change" and user_id:
                template_code = resolve_template_code(ttype) if ttype in TEMPLATES else ""
                if template_code:
                    await _email_fallback(user_id, template_code, params)
            return None
        # 사용자(번호)당 정기 알림 주간 상한(services/notify_weekly_cap, 사용자 결정 2026-11-02: 주 3건). 막히면 None을 돌려줘 호출자가 '전달 안 됨'으로 다룬다
        # (종류별 발송 간격 기록도 시작되지 않아 다음 기회에 다시 시도). 결제·구독·대행 안내는 이 함수를 거치지 않는다.
        from services import notify_weekly_cap as _wcap
        if not await _wcap.allowed(phone, ttype):
            logger.info("_send skipped: 주간 정기 알림 상한 (ttype=%s)", ttype)
            self._log_notification(None, ttype, {"reason": "weekly_cap", **params}, "skipped")
            return None
        status = "sent"
        kakao_failed = False
        fail_note = None
        try:
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.post(
                    f"{self.BASE}/messages",
                    headers={"X-Secret-Key": os.getenv("KAKAO_SECRET_KEY", "")},
                    json={
                        "senderKey": os.getenv("KAKAO_SENDER_KEY", ""),
                        "templateCode": resolve_template_code(ttype),
                        "recipientList": [
                            {"recipientNo": phone, "templateParameter": _template_params(params)}
                        ],
                    },
                )
            body_ok = True
            if r.status_code < 400:
                try:
                    body_ok = r.json().get("header", {}).get("isSuccessful", True)
                except Exception:
                    body_ok = True
            if r.status_code >= 400 or not body_ok:
                status = "failed"
                kakao_failed = True
                fail_note = _failure_note(resp=r)
                logger.warning(f"Kakao _send failed {r.status_code} ({ttype}): {_kakao_failure_summary(r)}")
                # AEOLAB_SCORE_01 발송 실패 시 이메일 fallback
                if ttype == "score_change" and user_id:
                    template_code = resolve_template_code(ttype) if ttype in TEMPLATES else ""
                    if template_code:
                        await _email_fallback(user_id, template_code, params)
            else:
                masked = f"{phone[:3]}****{phone[-2:]}" if len(phone) >= 5 else "***"
                logger.info(f"Kakao notify ({ttype}) -> {masked}")
                await _wcap.record(phone, ttype)       # 전달 성공이 확인된 때만 센다
            return r
        except Exception as e:
            status = "failed"
            kakao_failed = True
            fail_note = _failure_note(exc=e)
            logger.warning(f"Kakao send failed ({ttype}): {e}")
            # 예외 발생 시에도 score_change 이메일 fallback
            if ttype == "score_change" and user_id:
                try:
                    template_code = resolve_template_code(ttype) if ttype in TEMPLATES else ""
                    if template_code:
                        await _email_fallback(user_id, template_code, params)
                except Exception as fb_e:
                    logger.warning("[email_fallback] fallback 예외: %s", fb_e)
            raise
        finally:
            _fin_masked = f"{phone[:3]}****{phone[-2:]}" if len(phone) >= 5 else "***"
            _content = {"phone": _fin_masked, **params}
            if fail_note:
                _content["error"] = fail_note
            self._log_notification(None, ttype, _content, status)

    async def send_weekly_score_report(
        self,
        phone: str,
        business_name: str,
        current_score: float,
        prev_score: float,
        top_action: str,
    ) -> bool:
        """주간 성적표 알림 (카카오 알림톡 또는 콘솔 로그)

        매주 월요일 오전 9시 scheduler에서 호출.
        KAKAO_APP_KEY 미설정 시 로그만 남기고 True 반환 (graceful degradation).
        """
        curr_grade = _grade(current_score)
        prev_grade = _grade(prev_score)
        grade_note = f"{prev_grade} → {curr_grade}" if curr_grade != prev_grade else curr_grade
        direction = _weekly_direction(prev_score, current_score)

        app_key = os.getenv("KAKAO_APP_KEY", "")
        masked = f"{phone[:3]}****{phone[-2:]}" if len(phone) >= 5 else "***"

        if not app_key:
            abs_diff = abs(current_score - prev_score)
            logger.info(
                "[weekly_report] %s %s → %s점 (%s%.1f): %s",
                masked, business_name, int(current_score), direction, abs_diff, top_action[:30],
            )
            return True

        try:
            # 승인 템플릿 AEOLAB_WEEKLY_01: #{사업장명}·#{등급변화}·#{추세방향}·#{할일} (이전에는 SCORE_01 코드로 자유 문구를 보냈다)
            resp = await self._send(
                phone,
                "weekly_report",
                {
                    "#{사업장명}": business_name,
                    "#{등급변화}": grade_note,
                    "#{추세방향}": direction,
                    "#{할일}": _short(top_action, "대시보드에서 확인"),
                },
            )
            return _kakao_response_ok(resp)
        except Exception as e:
            logger.warning("send_weekly_score_report 실패 (%s): %s", masked, e)
            return False

    async def send_v31_migration(self, phone: str, biz_name: str) -> bool:
        """v3.1 점수 모델 전환 안내 알림톡 (SCORE_MODEL_VERSION=v3_1 토글 ON 시 1회).

        신규 카카오 알림톡 템플릿 승인 전까지 AEOLAB_NOTICE_01 공지 템플릿을 재사용.
        KAKAO_APP_KEY 미설정 시 로그만 남기고 True 반환 (graceful degradation).
        """
        app_key = os.getenv("KAKAO_APP_KEY", "")
        masked = f"{phone[:3]}****{phone[-2:]}" if len(phone) >= 5 else "***"
        message = (
            f"[AEOlab] {biz_name}\n\n"
            f"AI 가시성 점수 모델이 v3.1로 업데이트되었습니다.\n\n"
            f"변경점: 키워드 순위 항목이 추가되어 점수 계산이 더 정밀해졌습니다.\n\n"
            f"키워드 3개 이상 등록 시 다음 측정부터 자동 반영됩니다.\n"
            f"대시보드에서 키워드를 확인하세요.\n\n"
            f"aeolab.co.kr/dashboard"
        )
        if not app_key:
            logger.info("[v31_migration] %s %s: 카카오 미설정 — 로그만 기록", masked, biz_name)
            return True
        try:
            await self._send_raw(phone, message, template_code="AEOLAB_NOTICE_01")
            return True
        except Exception as e:
            logger.warning("send_v31_migration 실패 (%s): %s", masked, e)
            return False

    def _log_notification(self, user_id, ntype: str, content: dict, status: str):
        """notifications 테이블에 발송 이력 기록 (daemon thread로 non-blocking)

        동기 함수이지만 daemon thread에서 DB 호출을 실행하여 async 컨텍스트 블로킹 방지.
        """
        try:
            import threading

            def _do():
                try:
                    from db.supabase_client import get_client
                    supabase = get_client()
                    supabase.table("notifications").insert({
                        "user_id": user_id,
                        "type": ntype,
                        "content": content,
                        "channel": "kakao",
                        "status": status,
                    }).execute()
                except Exception as inner_e:
                    logger.debug(f"Notification log thread failed: {inner_e}")

            threading.Thread(target=_do, daemon=True).start()
        except Exception as e:
            logger.debug(f"Notification log failed: {e}")
