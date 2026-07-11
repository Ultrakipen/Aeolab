"""결제 이벤트(최초 결제·자동 갱신 재시도) 영구 기록 헬퍼.

admin_service_oversight_design_v1.0.md §3-A P1-구조적. "결제했는데 구독이 안
됐어요" 문의 시 subscriptions 현재 상태만으로는 결제 시도 자체가 있었는지,
성공했는지, 실패했는지 구분할 수 없었다. webhook.py issue_billing(최초 결제)과
services/toss_billing.py retry_billing(자동 갱신)에서 호출한다.
"""

import logging
from datetime import datetime, timedelta

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


async def find_recent_success_event(
    user_id: str | None, event_type: str, expected_amount: int, window_minutes: int = 10
) -> dict | None:
    """Toss 청구는 성공했지만 그 직후 DB 저장이 실패해 재시도가 재청구로 이어지는
    것을 막는 공통 가드. 같은 금액의 성공 이벤트가 window_minutes 이내에 있으면 그
    이벤트 레코드(dict)를, 없으면 None을 반환한다. 호출부는 truthy 체크로 스킵 여부를
    판단하고, 필요하면 record["detail"](예: paymentKey)을 재사용할 수 있다.
    webhook.py issue_billing(최초결제)·settings.py update_card(재활성화)·
    scheduler/jobs.py subscription_lifecycle_job(자동갱신) 3곳에서 공유."""
    if not user_id:
        return None
    try:
        recent = await execute(
            get_client().table("payment_events")
            .select("amount, detail, created_at")
            .eq("user_id", user_id)
            .eq("event_type", event_type)
            .eq("status", "success")
            .order("created_at", desc=True)
            .limit(1)
        )
    except Exception as e:
        _logger.warning(f"[payment_event_log] 이중청구 방지 조회 실패: {e}")
        return None
    if not (recent and recent.data):
        return None
    last = recent.data[0]
    try:
        last_created = datetime.fromisoformat(str(last["created_at"]).replace("Z", "+00:00"))
    except (KeyError, ValueError):
        return None
    if (
        last.get("amount") == expected_amount
        and (datetime.now(last_created.tzinfo) - last_created) < timedelta(minutes=window_minutes)
    ):
        return last
    return None
