"""사용자(수신 번호)당 정기 알림톡 주간 상한 (2026-11-02, 사용자 결정: 주 3건).

배경: 정기 알림이 잡마다 따로 나가서 한 사람에게 하루 3~4건, 주 20건 넘게 갈 수 있다(운영자 계정 실측). 종류별 간격(`notify_cadence`)만으로는 종류가
많아 합이 줄지 않으므로, **모든 정기 알림이 거치는 `KakaoNotifier._send`에서 번호별 7일 합계를 막는다.**
알림 함수는 전화번호만 받으므로 사용자 판정은 번호 기준이다(`notify_gate`와 같은 방식) — 번호 해시만 저장하고 원번호는 남기지 않는다.

규칙
- 대상: `PERIODIC_TYPES`(템플릿 key). 결제·구독·대행 상태 안내(`_send_delivery_template`)와 공지는 세지도 막지도 않는다.
- 최근 7일(롤링) 전달 성공 건수가 상한(`NOTIFY_WEEKLY_CAP`, 기본 3) 이상이면 보내지 않는다. 0이면 기능 끔(긴급 해제·관리자 시험 발송용).
- 우선순위: 한 칸(`NOTIFY_WEEKLY_RESERVE`, 기본 1)은 높은 가치 알림(주간 성적표·월간 리포트·경쟁사 역전/변화·성장 단계)을 위해 비워 둔다 —
  스캔 완료·AI 인용·할 일 같은 알림이 주 초에 상한을 다 채워 정작 중요한 알림이 막히는 것을 방지.
- 전달 성공이 확인된 때만 센다(실패·건너뜀은 세지 않음). 건수를 읽지 못하면 보내지 않는다(확인 못 하면 알리지 않는 쪽 — 잘못된 알림이 빠진 알림보다 신뢰를 더 깎는다).
- 상한 때문에 건너뛴 알림은 '발송됨'으로 기록되지 않으므로(호출자는 None → 미전달) 종류별 간격 기록도 시작되지 않아 다음 기회에 다시 시도된다.
숫자(3·1)는 사용자 결정(상한)·제안값(예약 칸)이며 실사용자 반응으로 조정한다.
"""
import hashlib
import logging
import os
import re
from datetime import datetime, timedelta, timezone

_logger = logging.getLogger("aeolab")

# `_send`의 템플릿 key. 결제·구독·대행 상태 안내는 `_send_delivery_template`을 쓰므로 여기 없다.
PERIODIC_TYPES = frozenset({
    "score_change", "ai_citation", "competitor", "market_news", "action_items", "competitor_overtake",
    "scan_complete", "monthly_report", "growth_stage_up", "weekly_report", "keyword_change",
})
# 상한이 가득 차 가도 마지막 한 칸을 쓸 수 있는 알림
HIGH_PRIORITY_TYPES = frozenset({"weekly_report", "monthly_report", "competitor_overtake", "competitor", "growth_stage_up"})
LEDGER_TYPE = "periodic_sent"
WINDOW_DAYS = 7


def _int_env(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    try:
        v = int(raw) if raw else default
    except ValueError:
        return default
    return v if v >= 0 else default


def weekly_cap() -> int:
    return _int_env("NOTIFY_WEEKLY_CAP", 3)


def reserve() -> int:
    return _int_env("NOTIFY_WEEKLY_RESERVE", 1)


def limit_for(ttype: str, cap: int | None = None, res: int | None = None) -> int:
    """이 종류가 '최근 7일 N건 미만'일 때 보낼 수 있는 N. 높은 가치 알림은 상한 전체, 나머지는 예약 칸을 뺀 값(최소 1)."""
    cap = weekly_cap() if cap is None else cap
    res = reserve() if res is None else res
    if ttype in HIGH_PRIORITY_TYPES:
        return cap
    return max(cap - res, 1)


def phone_hash(phone) -> str:
    d = re.sub(r"\D", "", str(phone or ""))
    if d.startswith("82"):
        d = "0" + d[2:]
    return hashlib.sha256(d.encode("utf-8")).hexdigest()[:16]


def _db():
    """(supabase 클라이언트, execute). 테스트는 이 함수를 바꿔 가짜 DB를 쓴다."""
    from db.supabase_client import get_client, execute
    return get_client(), execute


def per_type_weekly(ttype: str) -> int:
    """이 종류 알림의 번호당 7일 최대 건수(0이면 종류별 제한 없음). 스캔마다 가는 '스캔 완료'가 주 상한의 낮은 가치 칸을 먼저 채우지 못하게 한다
    (개정 템플릿 SCAN_02는 '언급 플랫폼 없으면 미발송' 조건이 사라져 스캔마다 갈 수 있다 — 2026-11-02, 제안값)."""
    if ttype == "scan_complete":
        return _int_env("NOTIFY_SCAN_COMPLETE_WEEKLY", 1)
    return 0


async def count_recent(phone, now: datetime | None = None, ttype: str | None = None) -> int | None:
    """이 번호가 최근 7일에 받은 정기 알림 수(ttype을 주면 그 종류만). 읽지 못하면 None."""
    try:
        sb, run = _db()
        since = ((now or datetime.now(timezone.utc)) - timedelta(days=WINDOW_DAYS)).isoformat()
        q = (
            sb.table("notifications")
            .select("id")
            .eq("type", LEDGER_TYPE)
            .eq("content->>phone_hash", phone_hash(phone))
        )
        if ttype:
            q = q.eq("content->>ttype", ttype)
        res = await run(q.gte("sent_at", since).limit(50))
        return len((res.data or []) if res else [])
    except Exception as e:
        _logger.warning("[notify_weekly_cap] 주간 건수 확인 실패(이번 알림 생략): %s", e)
        return None


async def allowed(phone, ttype: str, now: datetime | None = None) -> bool:
    """이 번호에 이 종류 정기 알림을 지금 보내도 되는가."""
    cap = weekly_cap()
    if cap <= 0 or ttype not in PERIODIC_TYPES:
        return True
    n = await count_recent(phone, now)
    if n is None:
        return False
    if n >= limit_for(ttype, cap):
        return False
    per_type = per_type_weekly(ttype)
    if per_type > 0:
        nt = await count_recent(phone, now, ttype)
        if nt is None or nt >= per_type:
            return False
    return True


async def record(phone, ttype: str, now: datetime | None = None) -> bool:
    """전달 성공 직후 호출. 실패해도 예외를 올리지 않는다(이미 보낸 알림을 막지 않기 위해)."""
    if weekly_cap() <= 0 or ttype not in PERIODIC_TYPES:
        return False
    try:
        sb, run = _db()
        await run(
            sb.table("notifications").insert({
                "type": LEDGER_TYPE,
                "channel": "internal",
                "content": {"phone_hash": phone_hash(phone), "ttype": ttype},
                "status": "sent",
            })
        )
        return True
    except Exception as e:
        _logger.warning("[notify_weekly_cap] 주간 건수 기록 실패 ttype=%s: %s", ttype, e)
        return False
