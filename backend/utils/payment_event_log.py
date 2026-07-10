"""결제 이벤트(최초 결제·자동 갱신 재시도) 영구 기록 헬퍼.

admin_service_oversight_design_v1.0.md §3-A P1-구조적. "결제했는데 구독이 안
됐어요" 문의 시 subscriptions 현재 상태만으로는 결제 시도 자체가 있었는지,
성공했는지, 실패했는지 구분할 수 없었다. webhook.py issue_billing(최초 결제)과
services/toss_billing.py retry_billing(자동 갱신)에서 호출한다.
"""

import logging

from db.supabase_client import get_client, execute

_logger = logging.getLogger("aeolab")


async def record_payment_event(
    user_id: str | None,
    event_type: str,
    status: str,
    amount: int | None = None,
    detail: str | None = None,
) -> None:
    """payment_events에 결제 이벤트 1건 기록. 실패해도 결제 흐름을 막지 않는다."""
    try:
        supabase = get_client()
        await execute(
            supabase.table("payment_events").insert({
                "user_id": user_id,
                "event_type": event_type,
                "status": status,
                "amount": amount,
                "detail": (detail or "")[:1000] or None,
            })
        )
    except Exception as e:
        _logger.warning(f"[payment_event_log] 결제 이벤트 기록 실패: {e}")
