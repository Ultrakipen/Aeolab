import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from models.schemas import BillingIssueRequest
from db.supabase_client import get_client, execute
from config.prices import (
    PLAN_PRICES,
    YEARLY_AMOUNTS,
    DISCOUNT_TO_REGULAR,
)
from utils import cache as _cache
from services import creb_client
from middleware.plan_gate import get_current_user

logger = logging.getLogger("aeolab")

router = APIRouter()

# IP당 분당 5회 rate limit (security_audit_v1.0.md M3) — 인증 없는 엔드포인트라
# 잘못된 authKey로도 크렙 API를 무제한 호출해 남용/비용 리스크가 있음. public_briefing.py 패턴 통일.
_BILLING_ISSUE_RATE_LIMIT = 5
_BILLING_ISSUE_RATE_WINDOW = 60  # seconds


def _check_billing_issue_rate_limit(ip: str) -> None:
    key = f"billing_issue:{ip}"
    count: int = _cache.get(key) or 0
    if count >= _BILLING_ISSUE_RATE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "RATE_LIMIT",
                "message": "잠시 후 다시 시도해 주세요 (분당 5회 제한).",
                "retry_after": _BILLING_ISSUE_RATE_WINDOW,
            },
        )
    if count == 0:
        _cache.set(key, 1, _BILLING_ISSUE_RATE_WINDOW)
    else:
        _cache.set(key, count + 1, _BILLING_ISSUE_RATE_WINDOW)


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


@router.post("/creb/billing/issue")
async def issue_billing(body: BillingIssueRequest, request: Request, user: dict = Depends(get_current_user)):
    """빌링키 발급 + 첫 결제 → 구독 활성화 (크렙). 카드 등록자는 Bearer 토큰으로 확정한다
    (크렙 auth_key 리다이렉트에는 customerKey가 없으므로 클라이언트 값을 신뢰하지 않음)."""
    client_ip = (request.client.host if request.client else "unknown")
    _check_billing_issue_rate_limit(client_ip)

    user_id = user["id"]
    customer_key = f"customer_{user_id}"

    # 1. 빌링키 발급
    issue_res = await creb_client.issue_billkey(body.authKey)
    if not issue_res.ok:
        logger.error(f"빌링키 발급 실패: {issue_res.code} {issue_res.msg}")
        raise HTTPException(status_code=400, detail="빌링키 발급에 실패했습니다. 카드 정보를 확인 후 다시 시도해 주세요.")

    billing_key = issue_res.data.get("billKey")
    if not billing_key:
        raise HTTPException(status_code=500, detail="빌링키를 받지 못했습니다")

    # 등록 카드 정보 (설정 페이지에 표시용 — cardNumber는 크렙이 마스킹해 내려줌, 카드사는 한글 이름 그대로 저장)
    card_issuer_code = issue_res.data.get("cardCompany") or issue_res.data.get("cardResultName")
    card_number_masked = issue_res.data.get("cardNumber")

    # user_id가 실제 존재하는 계정인지 검증
    _user_check = await execute(
        get_client().table("profiles").select("user_id").eq("user_id", user_id).limit(1)
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
    is_yearly_issue = body.amount in YEARLY_AMOUNTS
    billing_cycle_issue = "yearly" if is_yearly_issue else "monthly"
    end_at_issue = (datetime.now() + timedelta(days=365 if is_yearly_issue else 30)).date().isoformat()

    # 이중 청구 방지: 청구(2번)는 성공했지만 그 직후 구독 저장(3번)이 실패해
    # 프론트가 에러로 표시 → 사용자가 재시도하면, 같은 금액의 성공 이벤트가 10분
    # 이내에 이미 있으므로 재청구하지 않고 구독 저장만 다시 시도한다.
    from utils.payment_event_log import find_recent_success_event
    recent_match = await find_recent_success_event(user_id, "billing_issue", body.amount, window_minutes=10)
    payment_key = None  # 크렙 transactionNumber(tid) — 7일 환불 시 취소 키
    from utils.kst import utc_now_iso
    charge_start_at = utc_now_iso()   # 시간대가 붙은 UTC — 시간대 없는 서버 시각(KST)을 저장하면 DB가 UTC로 읽어 9시간 뒤로 기록된다
    skip_charge = False
    if recent_match:
        logger.warning(f"issue_billing 중복 청구 방지 — 최근 성공 이벤트 재사용: user_id={user_id}, amount={body.amount}")
        skip_charge = True
        payment_key = recent_match.get("detail")

    if not skip_charge:
        # 2. 첫 결제
        from services.creb_billing import get_buyer_info
        from utils.payment_event_log import record_payment_event
        buyer = await get_buyer_info(user_id, user.get("email"))
        pay_res = await creb_client.billpay(
            order_id=order_id,
            billkey=billing_key,
            amount=body.amount,
            goods_name=f"AEOlab {body.plan} 구독",
            buyer_name=buyer["name"],
            buyer_phone=buyer["phone"],
            buyer_email=buyer["email"],
        )
        if not pay_res.ok:
            logger.error(f"첫 결제 실패: {pay_res.code} {pay_res.msg}")
            await record_payment_event(user_id, "billing_issue", "failed", body.amount, f"{pay_res.code} {pay_res.msg}")
            raise HTTPException(status_code=400, detail="결제에 실패했습니다. 카드 한도·잔액을 확인 후 다시 시도해 주세요.")

        payment_key = pay_res.data.get("transactionNumber")
        await record_payment_event(user_id, "billing_issue", "success", body.amount, payment_key)
        charge_start_at = utc_now_iso()

    # 3. 구독 저장
    supabase = get_client()
    sub_payload = {
        "user_id": user_id,
        "plan": plan,
        "status": "active",
        "billing_cycle": billing_cycle_issue,
        "start_at": charge_start_at,
        "end_at": end_at_issue,
        "billing_key": billing_key,
        "customer_key": customer_key,
        "first_payment_amount": body.amount,
        "first_payment_key": payment_key,
        "card_issuer_code": card_issuer_code,
        "card_number_masked": card_number_masked,
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
