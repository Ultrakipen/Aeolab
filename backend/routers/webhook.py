import httpx
import os
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException
from models.schemas import PaymentConfirm, BillingIssueRequest
from db.supabase_client import get_client, execute

logger = logging.getLogger("aeolab")

router = APIRouter()

PLAN_PRICES = {
    9900: "basic",
    29900: "pro",
    79900: "biz",
    39900: "startup",
    200000: "enterprise",
}


@router.post("/toss/confirm")
async def confirm_payment(body: PaymentConfirm):
    """토스페이먼츠 결제 확정 → 구독 활성화"""
    async with httpx.AsyncClient(timeout=30) as c:
        resp = await c.post(
            "https://api.tosspayments.com/v1/payments/confirm",
            auth=(os.getenv("TOSS_SECRET_KEY", ""), ""),
            json={
                "paymentKey": body.paymentKey,
                "orderId": body.orderId,
                "amount": body.amount,
            },
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=400, detail=f"결제 확정 실패: {resp.text}")

    data = resp.json()
    plan = PLAN_PRICES.get(body.amount, "basic")
    user_id = _extract_user_id(body.orderId)

    customer_key = f"customer_{user_id}"
    supabase = get_client()
    await execute(
        supabase.table("subscriptions").upsert(
            {
                "user_id": user_id,
                "plan": plan,
                "status": "active",
                "start_at": data.get("approvedAt"),
                "end_at": (datetime.now() + timedelta(days=30)).isoformat(),
                "billing_key": body.paymentKey,
                "customer_key": customer_key,
            }
        )
    )

    return {"status": "success", "plan": plan}


def _extract_user_id(order_id: str) -> str:
    """orderId 형식: aeolab_{user_id}_{timestamp}"""
    import re
    match = re.match(r"aeolab_([a-f0-9\-]{36})_\d+", order_id)
    if not match:
        raise HTTPException(status_code=400, detail="Invalid orderId format")
    return match.group(1)


PLAN_NAME_TO_KEY = {
    "Basic": "basic", "Pro": "pro", "Biz": "biz",
    "창업 패키지": "startup", "Enterprise": "enterprise",
    "basic": "basic", "pro": "pro", "biz": "biz",
}

PLAN_PRICES = {9900: "basic", 29900: "pro", 79900: "biz", 39900: "startup", 200000: "enterprise"}


@router.post("/toss/billing/issue")
async def issue_billing(body: BillingIssueRequest):
    """빌링키 발급 + 첫 결제 → 구독 활성화"""
    secret_key = os.getenv("TOSS_SECRET_KEY", "")

    # 1. 빌링키 발급
    async with httpx.AsyncClient(timeout=30) as c:
        resp = await c.post(
            "https://api.tosspayments.com/v1/billing/authorizations/issue",
            auth=(secret_key, ""),
            json={"authKey": body.authKey, "customerKey": body.customerKey},
        )
    if resp.status_code != 200:
        logger.error(f"빌링키 발급 실패: {resp.text}")
        raise HTTPException(status_code=400, detail=f"빌링키 발급 실패: {resp.text}")

    billing_key = resp.json().get("billingKey")
    if not billing_key:
        raise HTTPException(status_code=500, detail="빌링키를 받지 못했습니다")

    # customerKey 형식: customer_{user_id}
    user_id = body.customerKey.replace("customer_", "", 1)
    plan = PLAN_NAME_TO_KEY.get(body.plan, "basic")
    order_id = f"first_{user_id}_{int(datetime.now().timestamp())}"

    # 2. 첫 결제
    async with httpx.AsyncClient(timeout=30) as c:
        resp = await c.post(
            f"https://api.tosspayments.com/v1/billing/{billing_key}",
            auth=(secret_key, ""),
            json={
                "customerKey": body.customerKey,
                "amount": body.amount,
                "orderId": order_id,
                "orderName": f"AEOlab {body.plan} 구독",
            },
        )
    if resp.status_code != 200:
        logger.error(f"첫 결제 실패: {resp.text}")
        raise HTTPException(status_code=400, detail=f"결제 실패: {resp.text}")

    data = resp.json()

    # 3. 구독 저장
    supabase = get_client()
    await execute(supabase.table("subscriptions").upsert({
        "user_id": user_id,
        "plan": plan,
        "status": "active",
        "start_at": data.get("approvedAt"),
        "end_at": (datetime.now() + timedelta(days=30)).isoformat(),
        "billing_key": billing_key,
        "customer_key": body.customerKey,
    }))

    return {"status": "success", "plan": plan}
