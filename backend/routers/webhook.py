import httpx
import os
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from models.schemas import BillingIssueRequest
from db.supabase_client import get_client, execute
from config.prices import (
    PLAN_PRICES,
    YEARLY_AMOUNTS,
    DISCOUNT_TO_REGULAR,
)

logger = logging.getLogger("aeolab")

router = APIRouter()


async def _is_first_time_subscriber(user_id: str) -> bool:
    """첫 달 할인 자격 검증 — 계정 기준 + 사업장(naver_place_id) 기준 이중 차단"""
    supabase = get_client()

    # 1단계: 현재 계정 구독 이력 확인
    res = await execute(
        supabase.table("subscriptions")
        .select("id")
        .eq("user_id", user_id)
        .limit(1)
    )
    if res.data:
        return False

    # 2단계: 현재 계정의 사업장 naver_place_id 조회
    biz_res = await execute(
        supabase.table("businesses")
        .select("naver_place_id")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .not_.is_("naver_place_id", "null")
        .limit(1)
    )
    if not (biz_res.data and biz_res.data[0].get("naver_place_id")):
        return True  # place_id 없으면 계정 기준만 적용

    naver_place_id = biz_res.data[0]["naver_place_id"]

    # 3단계: 같은 naver_place_id를 가진 다른 계정의 구독 이력 확인
    same_place_res = await execute(
        supabase.table("businesses")
        .select("user_id")
        .eq("naver_place_id", naver_place_id)
        .neq("user_id", user_id)
        .limit(20)
    )
    for row in (same_place_res.data or []):
        other_uid = row.get("user_id")
        if not other_uid:
            continue
        sub_res = await execute(
            supabase.table("subscriptions")
            .select("id")
            .eq("user_id", other_uid)
            .limit(1)
        )
        if sub_res.data:
            logger.warning(
                f"사업장 기준 할인 차단 — naver_place_id={naver_place_id}, "
                f"신청 user={user_id}, 기존 구독 user={other_uid}"
            )
            return False

    return True


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

    # customerKey 형식: customer_{user_id} — user_id가 실제 존재하는 계정인지 검증
    user_id = body.customerKey.replace("customer_", "", 1)
    _user_check = await execute(
        get_client().table("profiles").select("id").eq("id", user_id).limit(1)
    )
    if not (_user_check and _user_check.data):
        logger.warning(f"issue_billing 미존재 user_id: {user_id}")
        raise HTTPException(status_code=400, detail="유효하지 않은 사용자입니다")
    # amount 기반으로 플랜 결정 (클라이언트 plan 필드 조작 방지)
    # PLAN_PRICES에 없는 금액이면 400 거부 — name 폴백 허용하지 않음 (보안)
    plan_by_amount = PLAN_PRICES.get(body.amount)
    if not plan_by_amount:
        logger.warning(f"issue_billing 유효하지 않은 금액: amount={body.amount}, plan={body.plan}")
        raise HTTPException(status_code=400, detail="유효하지 않은 결제 금액입니다")
    plan_by_name = PLAN_NAME_TO_KEY.get(body.plan, "")
    if plan_by_name and plan_by_name != plan_by_amount:
        logger.warning(f"issue_billing 플랜 교차검증 불일치: amount={body.amount} -> {plan_by_amount}, plan={body.plan} -> {plan_by_name}")
    plan = plan_by_amount

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
    end_at_issue = (datetime.now() + timedelta(days=365 if is_yearly_issue else 30)).date().isoformat()

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
        "first_payment_key": data.get("paymentKey"),
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
