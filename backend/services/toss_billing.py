import httpx
import os
import logging
from datetime import date
from config.prices import PLAN_PRICE_MAP, YEARLY_PRICE_MAP

logger = logging.getLogger("aeolab")

TOSS_API_BASE = "https://api.tosspayments.com/v1"


async def issue_billing_key(customer_key: str, auth_key: str) -> str:
    """최초 결제 시 빌링키 발급 (이후 자동결제에 사용)"""
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(
            f"{TOSS_API_BASE}/billing/authorizations/issue",
            auth=(os.getenv("TOSS_SECRET_KEY", ""), ""),
            json={"authKey": auth_key, "customerKey": customer_key},
        )
    r.raise_for_status()
    data = r.json()
    return data["billingKey"]


def compute_renewal_amount(subscription: dict) -> int:
    """구독 plan/billing_cycle 기준 갱신 청구액 계산 — retry_billing과 이중청구 방지
    가드(webhook.py·settings.py·jobs.py) 양쪽에서 같은 금액 기준을 쓰기 위해 분리."""
    plan = subscription.get("plan", "basic")
    if subscription.get("billing_cycle") == "yearly":
        return YEARLY_PRICE_MAP.get(plan, PLAN_PRICE_MAP.get(plan, 11900))
    return PLAN_PRICE_MAP.get(plan, 11900)


async def retry_billing(subscription: dict) -> bool:
    """구독 갱신 자동결제 시도"""
    billing_key = subscription.get("billing_key")
    if not billing_key:
        logger.warning(f"No billing_key for subscription {subscription.get('id')}")
        return False

    amount = compute_renewal_amount(subscription)

    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(
                f"{TOSS_API_BASE}/billing/{billing_key}",
                auth=(os.getenv("TOSS_SECRET_KEY", ""), ""),
                json={
                    "customerKey": subscription["customer_key"],
                    "amount": amount,
                    "orderId": f"renewal_{subscription['id']}_{date.today()}",
                    "orderName": f"AEOlab {subscription['plan']} 구독 갱신",
                },
            )
        from utils.payment_event_log import record_payment_event
        if r.status_code == 200:
            logger.info(f"Billing success for subscription {subscription['id']}")
            await record_payment_event(subscription.get("user_id"), "renewal", "success", amount)
            return True
        else:
            logger.warning(f"Billing failed ({r.status_code}) for subscription {subscription['id']}: {r.text}")
            await record_payment_event(subscription.get("user_id"), "renewal", "failed", amount, r.text)
            return False
    except Exception as e:
        logger.error(f"Billing error for subscription {subscription['id']}: {e}")
        try:
            from utils.payment_event_log import record_payment_event
            await record_payment_event(subscription.get("user_id"), "renewal", "failed", amount, str(e))
        except Exception as log_err:
            logger.warning(f"[toss_billing] 결제 이벤트 기록 실패: {log_err}")
        return False
