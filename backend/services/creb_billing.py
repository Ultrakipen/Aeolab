import logging
from datetime import date

from config.prices import PLAN_PRICE_MAP, YEARLY_PRICE_MAP
from db.supabase_client import get_client, execute
from services import creb_client

logger = logging.getLogger("aeolab")


def compute_renewal_amount(subscription: dict) -> int:
    """구독 plan/billing_cycle 기준 갱신 청구액 계산 — retry_billing과 이중청구 방지
    가드(webhook.py·settings.py·jobs.py) 양쪽에서 같은 금액 기준을 쓰기 위해 분리."""
    plan = subscription.get("plan", "basic")
    if subscription.get("billing_cycle") == "yearly":
        return YEARLY_PRICE_MAP.get(plan, PLAN_PRICE_MAP.get(plan, 17900))
    return PLAN_PRICE_MAP.get(plan, 17900)


async def get_buyer_info(user_id: str, fallback_email: str | None = None) -> dict:
    """빌링 승인(billpay)·웹결제에 필수인 구매자 이름·전화번호 조회.
    profiles에는 이름 컬럼이 없어 첫 사업장 이름 → 이메일 앞부분 → 'AEOlab 회원' 순으로 대체한다.
    전화번호가 없으면 빈 문자열을 그대로 보내 크렙의 검증 결과(실패)에 맡긴다 — 임의 번호 금지."""
    supabase = get_client()
    phone = ""
    name = ""
    try:
        p = (
            await execute(supabase.table("profiles").select("phone").eq("user_id", user_id).maybe_single())
        ).data
        phone = ((p or {}).get("phone") or "").replace("-", "").strip()
    except Exception as e:
        logger.warning(f"[creb_billing] 구매자 전화번호 조회 실패 (user={user_id}): {e}")
    try:
        b = await execute(
            supabase.table("businesses").select("name").eq("user_id", user_id).order("created_at").limit(1)
        )
        if b and b.data:
            name = b.data[0].get("name") or ""
    except Exception as e:
        logger.warning(f"[creb_billing] 구매자 이름 조회 실패 (user={user_id}): {e}")
    if not name and fallback_email:
        name = fallback_email.split("@")[0]
    return {"name": (name or "AEOlab 회원")[:50], "phone": phone, "email": fallback_email}


async def retry_billing(subscription: dict) -> bool:
    """구독 갱신 자동결제 시도"""
    billing_key = subscription.get("billing_key")
    if not billing_key:
        logger.warning(f"No billing_key for subscription {subscription.get('id')}")
        return False

    amount = compute_renewal_amount(subscription)
    user_id = subscription.get("user_id")
    from utils.payment_event_log import record_payment_event

    try:
        buyer = await get_buyer_info(user_id)
        res = await creb_client.billpay(
            order_id=f"renewal_{subscription['id']}_{date.today()}",
            billkey=billing_key,
            amount=amount,
            goods_name=f"AEOlab {subscription['plan']} 구독 갱신",
            buyer_name=buyer["name"],
            buyer_phone=buyer["phone"],
        )
        if res.ok:
            logger.info(f"Billing success for subscription {subscription['id']}")
            await record_payment_event(user_id, "renewal", "success", amount, res.data.get("transactionNumber"))
            return True
        logger.warning(f"Billing failed ({res.code}) for subscription {subscription['id']}: {res.msg}")
        await record_payment_event(user_id, "renewal", "failed", amount, f"{res.code} {res.msg}")
        return False
    except Exception as e:
        logger.error(f"Billing error for subscription {subscription['id']}: {e}")
        try:
            await record_payment_event(user_id, "renewal", "failed", amount, str(e))
        except Exception as log_err:
            logger.warning(f"[creb_billing] 결제 이벤트 기록 실패: {log_err}")
        return False
