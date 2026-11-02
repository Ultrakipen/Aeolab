"""정기 알림톡 종류별 최소 발송 간격 (2026-11-02).

문제: `daily_kakao_notify`(Pro·Biz·창업, 매일 09:10)가 사업장마다 "이달 할 일"(가이드가 있으면 매번)·AI 인용(24시간 안에 언급이 있으면 매일)·
점수 변화(±3점, 측정 흔들림이 큰 가게는 거의 매일)를 보내 구독자 한 명에게 하루 3~4건, 주 20건 넘게 갈 수 있었다(운영자 계정에서 매일 3~4건 실측).
알림이 잦으면 신뢰를 깎는다(지침 8) → 종류별로 마지막 '전달 성공' 이후 일정 기간은 보내지 않는다.

기록은 사업장 단위로 notifications 테이블에 type=`cadence_<종류>`로 남긴다(알림 발송 로그 `_log_notification`은 user_id·business_id 없이 쌓여 사업장별로 셀 수 없다).
- 전달 성공이 확인된 때만 기록한다(실패를 '보냄'으로 남기면 그 기간 재시도까지 막힌다 — 2026-10-31 post_remind 사고).
- 기록을 읽지 못하면 보내지 않는다(확인 못 하면 알리지 않는 쪽 — 잘못된 알림이 빠진 알림보다 신뢰를 더 깎는다).
- 간격은 **제안값**(근거 없음, 실사용자 반응으로 조정) → 환경변수 `NOTIFY_MIN_DAYS_<종류>`로 즉시 바꿀 수 있다.
"""
import logging
import os
from datetime import datetime, timedelta, timezone

_logger = logging.getLogger("aeolab")

MIN_INTERVAL_DAYS = {
    "action_items": 28,    # 승인 템플릿 이름이 "이달 할 일" — 매일이 아니라 한 달에 한 번
    "ai_citation": 14,     # 새 인용이 있어도 2주에 한 번이면 충분(매일 같은 종류가 오면 가치가 떨어진다)
    "score_change": 7,     # 주간 성적표(월요일)와 겹치지 않게 주 1회 — 주간 성적표를 보내면 이 기록도 함께 남긴다
}


def record_type(kind: str) -> str:
    return f"cadence_{kind}"


def min_days(kind: str) -> int:
    default = MIN_INTERVAL_DAYS[kind]
    raw = os.getenv(f"NOTIFY_MIN_DAYS_{kind.upper()}", "").strip()
    try:
        v = int(raw) if raw else default
    except ValueError:
        return default
    return v if v >= 0 else default


async def is_due(db, supabase, business_id: str, kind: str, now: datetime | None = None) -> bool:
    """이 사업장에 이 종류 알림을 지금 보내도 되는가. 기록을 읽지 못하면 False."""
    days = min_days(kind)
    if days == 0:
        return True
    try:
        since = ((now or datetime.now(timezone.utc)) - timedelta(days=days)).isoformat()
        res = await db(
            supabase.table("notifications")
            .select("id")
            .eq("business_id", business_id)
            .eq("type", record_type(kind))
            .gte("sent_at", since)
            .limit(1)
        )
        return not (res and res.data)
    except Exception as e:
        _logger.warning("[notify_cadence] 간격 확인 실패(알림 생략) kind=%s biz=%s: %s", kind, business_id, e)
        return False


async def mark_sent(db, supabase, business_id: str, kind: str, now: datetime | None = None) -> bool:
    """전달 성공 후 호출 — 다음 발송 가능 시점을 정하는 기록을 남긴다. 실패해도 예외를 올리지 않는다(이미 보낸 알림을 막지 않기 위해)."""
    try:
        today = (now or datetime.now(timezone.utc)).date().isoformat()
        await db(
            supabase.table("notifications").insert({
                "business_id": business_id,
                "type": record_type(kind),
                "channel": "internal",
                "idempotency_key": f"{record_type(kind)}_{business_id}_{today}",
                "payload": {"kind": kind},
            })
        )
        return True
    except Exception as e:
        _logger.warning("[notify_cadence] 간격 기록 실패 kind=%s biz=%s: %s", kind, business_id, e)
        return False
