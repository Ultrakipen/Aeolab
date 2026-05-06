import base64
import httpx
import os
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from models.schemas import PaymentConfirm, BillingIssueRequest
from db.supabase_client import get_client, execute
from config.prices import (
    PLAN_PRICES,
    YEARLY_AMOUNTS,
    FIRST_MONTH_DISCOUNT_PRICES,
    DISCOUNT_TO_REGULAR,
)

logger = logging.getLogger("aeolab")

router = APIRouter()


async def _is_first_time_subscriber(user_id: str) -> bool:
    """이전에 구독한 이력이 전혀 없는 사용자인지 확인 — 첫 달 할인 자격 검증용"""
    supabase = get_client()
    res = await execute(
        supabase.table("subscriptions")
        .select("id, status, plan")
        .eq("user_id", user_id)
        .limit(1)
    )
    rows = res.data or []
    return len(rows) == 0


def _verify_toss_auth(request: Request) -> None:
    """Toss Basic Auth 검증 — Authorization: Basic base64(secret_key:)"""
    secret_key = os.getenv("TOSS_SECRET_KEY", "")
    if not secret_key:
        raise HTTPException(status_code=500, detail="결제 검증 키 미설정 — TOSS_SECRET_KEY 환경변수를 확인하세요")
    expected = base64.b64encode(f"{secret_key}:".encode()).decode()
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Basic "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    provided = auth_header[len("Basic "):]
    if provided != expected:
        raise HTTPException(status_code=401, detail="Invalid Toss secret key")


@router.post("/toss/confirm")
async def confirm_payment(request: Request, body: PaymentConfirm):
    """토스페이먼츠 결제 확정 → 구독 활성화"""
    _verify_toss_auth(request)

    # orderId 멱등성 — 같은 paymentKey가 이미 활성화된 구독이면 이중 처리 방지
    _idem_check = await execute(
        get_client().table("subscriptions")
        .select("id, status")
        .eq("billing_key", body.paymentKey)
        .limit(1)
    )
    if _idem_check and _idem_check.data:
        logger.info(f"[confirm_payment] 중복 요청 무시 — paymentKey={body.paymentKey}")
        return {"status": "already_confirmed"}

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
        _err_msg = resp.json().get("message", "결제 오류") if resp.headers.get("content-type", "").startswith("application/json") else "결제 확정 실패"
        raise HTTPException(status_code=400, detail=_err_msg)

    data = resp.json()
    # 서버에서 amount 기준으로 플랜 결정 (클라이언트 조작 방지)
    plan_by_amount = PLAN_PRICES.get(body.amount)
    # plan 필드가 있을 경우 교차 검증
    PLAN_NAME_MAP = {"basic": "basic", "pro": "pro", "biz": "biz", "startup": "startup"}
    plan_by_name = PLAN_NAME_MAP.get((body.plan or "").lower()) if body.plan else None
    if plan_by_amount and plan_by_name and plan_by_amount != plan_by_name:
        logger.warning(f"플랜 교차검증 불일치: amount={body.amount} -> {plan_by_amount}, plan={body.plan} -> {plan_by_name}")
    if not plan_by_amount:
        logger.warning(f"알 수 없는 결제 금액: {body.amount}, plan={body.plan}")
        raise HTTPException(status_code=400, detail="유효하지 않은 결제 금액입니다")
    plan = plan_by_amount
    is_yearly = body.amount in YEARLY_AMOUNTS
    billing_cycle = "yearly" if is_yearly else "monthly"
    end_at = (datetime.now() + timedelta(days=365 if is_yearly else 30)).isoformat()

    user_id = _extract_user_id(body.orderId)

    # 첫 달 50% 할인가 검증: 신규 가입자만 허용
    is_discount_amount = body.amount in DISCOUNT_TO_REGULAR
    discount_until = None
    if is_discount_amount:
        if not await _is_first_time_subscriber(user_id):
            logger.warning(f"할인가 결제 시도 거부 — 기존 구독자: user_id={user_id}, amount={body.amount}")
            raise HTTPException(status_code=400, detail="첫 달 할인은 신규 가입자에게만 적용됩니다")
        discount_until = (datetime.now() + timedelta(days=30)).date().isoformat()

    customer_key = f"customer_{user_id}"
    supabase = get_client()
    sub_payload = {
        "user_id": user_id,
        "plan": plan,
        "status": "active",
        "billing_cycle": billing_cycle,
        "start_at": data.get("approvedAt"),
        "end_at": end_at,
        "billing_key": body.paymentKey,
        "customer_key": customer_key,
        "first_payment_amount": body.amount,
    }
    if discount_until:
        sub_payload["first_month_discount_until"] = discount_until
    await execute(supabase.table("subscriptions").upsert(sub_payload, on_conflict="user_id"))

    return {
        "status": "success",
        "plan": plan,
        "billing_cycle": billing_cycle,
        "discount_applied": is_discount_amount,
    }


def _extract_user_id(order_id: str) -> str:
    """orderId 형식: aeolab_{user_id}_{timestamp}"""
    import re
    match = re.match(r"aeolab_([a-f0-9\-]{36})_\d+", order_id)
    if not match:
        raise HTTPException(status_code=400, detail="Invalid orderId format")
    return match.group(1)


PLAN_NAME_TO_KEY = {
    "Basic": "basic", "Pro": "pro", "Biz": "biz",
    "창업 패키지": "startup",
    "basic": "basic", "pro": "pro", "biz": "biz", "startup": "startup",
}


@router.post("/toss/billing/issue")
async def issue_billing(body: BillingIssueRequest):
    """빌링키 발급 + 첫 결제 → 구독 활성화"""
    import re as _re
    if not _re.match(r"^customer_[a-f0-9\-]{36}$", body.customerKey):
        raise HTTPException(status_code=400, detail="유효하지 않은 customerKey 형식입니다")
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
    # amount 기반으로 플랜 결정 (클라이언트 plan 필드 조작 방지)
    plan_by_amount = PLAN_PRICES.get(body.amount)
    plan_by_name = PLAN_NAME_TO_KEY.get(body.plan, "basic")
    if plan_by_amount and plan_by_name != plan_by_amount:
        logger.warning(f"issue_billing 플랜 교차검증 불일치: amount={body.amount} -> {plan_by_amount}, plan={body.plan} -> {plan_by_name}")
    plan = plan_by_amount or plan_by_name  # amount 우선, amount 없으면 name 기반

    # 첫 달 50% 할인가 검증: 신규 가입자만 허용
    is_discount_amount = body.amount in DISCOUNT_TO_REGULAR
    discount_until = None
    if is_discount_amount:
        if not await _is_first_time_subscriber(user_id):
            logger.warning(f"할인가 결제 시도 거부 — 기존 구독자: user_id={user_id}, amount={body.amount}")
            raise HTTPException(status_code=400, detail="첫 달 할인은 신규 가입자에게만 적용됩니다")
        discount_until = (datetime.now() + timedelta(days=30)).date().isoformat()

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
    is_yearly_issue = body.amount in YEARLY_AMOUNTS
    billing_cycle_issue = "yearly" if is_yearly_issue else "monthly"
    end_at_issue = (datetime.now() + timedelta(days=365 if is_yearly_issue else 30)).isoformat()

    supabase = get_client()
    sub_payload = {
        "user_id": user_id,
        "plan": plan,
        "status": "active",
        "billing_cycle": billing_cycle_issue,
        "start_at": data.get("approvedAt"),
        "end_at": end_at_issue,
        "billing_key": billing_key,
        "customer_key": body.customerKey,
        "first_payment_amount": body.amount,
    }
    if discount_until:
        sub_payload["first_month_discount_until"] = discount_until
    await execute(supabase.table("subscriptions").upsert(sub_payload, on_conflict="user_id"))

    return {
        "status": "success",
        "plan": plan,
        "billing_cycle": billing_cycle_issue,
        "discount_applied": is_discount_amount,
    }
