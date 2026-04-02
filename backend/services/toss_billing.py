import httpx
import os
import logging
from datetime import date

logger = logging.getLogger("aeolab")

TOSS_API_BASE = "https://api.tosspayments.com/v1"
PLAN_PRICE = {"basic": 9900, "pro": 22900, "biz": 49900, "startup": 16900, "enterprise": 200000}


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


async def retry_billing(subscription: dict) -> bool:
    """구독 갱신 자동결제 시도"""
    billing_key = subscription.get("billing_key")
    if not billing_key:
        logger.warning(f"No billing_key for subscription {subscription.get('id')}")
        return False

    amount = PLAN_PRICE.get(subscription.get("plan", "basic"), 9900)

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
        if r.status_code == 200:
            logger.info(f"Billing success for subscription {subscription['id']}")
            return True
        else:
            logger.warning(f"Billing failed ({r.status_code}) for subscription {subscription['id']}: {r.text}")
            return False
    except Exception as e:
        logger.error(f"Billing error for subscription {subscription['id']}: {e}")
        return False
