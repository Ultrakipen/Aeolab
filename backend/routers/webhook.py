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


# 같은 사업장으로 보는 식별값 컬럼 — 다른(아직 존재하는) 계정이 이 값으로 구독한 적이 있으면 첫 달 할인 대상이 아니다
_SAME_BUSINESS_COLUMNS = ("naver_place_id", "kakao_place_id", "business_registration_no")


async def _is_first_time_subscriber(user_id: str, email: str | None = None) -> bool:
    """첫 달 할인 자격 검증 — ①현재 계정 ②같은 사업장(네이버·카카오 플레이스 ID·사업자등록번호)을 가진 **다른 계정** ③탈퇴한 계정까지(해시, 기본 꺼짐).

    2026-11-10: 이전에는 ②가 네이버 플레이스 ID(첫 사업장) 하나뿐이었고 사업장 식별값이 없으면 곧바로 신규로 봤다. 탈퇴하면 ①②의 근거(구독·사업장 행)가
    모두 지워져 재가입으로 할인을 반복할 수 있었으므로 ③(services/discount_guard, 방침 확정 후 DISCOUNT_KEY_GUARD_ENABLED로 켬)을 더했다.
    """
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

    # 2단계: 현재 계정의 모든 활성 사업장 식별값 → 같은 값을 가진 다른 계정의 구독 이력
    biz_res = await execute(
        supabase.table("businesses")
        .select("naver_place_id, kakao_place_id, business_registration_no")
        .eq("user_id", user_id)
        .eq("is_active", True)
    )
    for biz in (biz_res.data or []):
        for col in _SAME_BUSINESS_COLUMNS:
            val = biz.get(col)
            if not val:
                continue
            same_res = await execute(
                supabase.table("businesses")
                .select("user_id")
                .eq(col, val)
                .neq("user_id", user_id)
                .limit(20)
            )
            for row in (same_res.data or []):
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
                        f"사업장 기준 할인 차단 — 키 종류={col}, 신청 user={user_id}, 기존 구독 user={other_uid}"
                    )
                    return False

    # 3단계: 탈퇴한 계정이 남긴 비식별 키(해시)와 일치하는가 — 꺼져 있거나 조회 실패면 통과(fail-open)
    from services.discount_guard import prior_use_conflict, PURPOSE_DISCOUNT
    if await prior_use_conflict(PURPOSE_DISCOUNT, user_id, email):
        return False

    return True


PLAN_NAME_TO_KEY = {
    "Basic": "basic", "Pro": "pro", "Biz": "biz",
    "창업 패키지": "startup",
    "basic": "basic", "pro": "pro", "biz": "biz", "startup": "startup",
}


async def _already_subscribed_same_plan(user_id: str, amount: int) -> bool:
    """이미 같은 플랜·같은 결제 주기로 이용 중인(status=active, 만료 전) 구독이 있으면 True.

    이 엔드포인트는 서버에서 활성 구독을 확인하지 않아, 구독자가 결제 화면에 다시 들어와 결제하면
    같은 금액이 한 번 더 청구되고 end_at이 덮어써졌다(2026-11-06 점검). 막는 범위는 '같은 플랜·같은 주기'뿐이다:
    - 다른 플랜 결제 = 현재 유일한 업그레이드·변경 경로라 그대로 허용한다(이월·일할 계산은 별도 결정 사항).
    - grace_period(결제 실패 유예)·cancelled(해지 후 잔여기간) = 재결제로 복구·재구독해야 하므로 허용한다.
    - 카드 변경은 /card/update 별도 경로라 영향 없음.
    조회 실패는 막지 않는다(결제 불능이 이중 청구보다 큰 피해이고, 10분 내 재시도 가드가 남아 있다) — 경고 로그만 남긴다.
    """
    plan = PLAN_PRICES.get(amount)
    if not plan:
        return False   # 유효하지 않은 금액은 뒤쪽 검증이 400으로 거부한다
    cycle = "yearly" if amount in YEARLY_AMOUNTS else "monthly"
    try:
        res = await execute(
            get_client().table("subscriptions")
            .select("plan, status, billing_cycle, end_at")
            .eq("user_id", user_id)
            .limit(1)
        )
    except Exception as e:
        logger.warning(f"issue_billing 기존 구독 조회 실패(가드 생략): user_id={user_id}: {e}")
        return False
    if not (res and res.data):
        return False
    row = res.data[0]
    if row.get("status") != "active" or row.get("plan") != plan:
        return False
    if (row.get("billing_cycle") or "monthly") != cycle:
        return False
    from middleware.plan_gate import _end_at_in_future
    return _end_at_in_future(row.get("end_at"))


@router.get("/creb/billing/discount-eligibility")
async def discount_eligibility(user: dict = Depends(get_current_user)):
    """결제 화면이 첫 달 할인가를 보여주기 전에 묻는 자격 조회(읽기 전용, 본인 것만).

    화면이 구독 이력만 보고 할인가를 보여주면, 서버가 다른 근거(같은 사업장·탈퇴 이력)로 거부했을 때 카드를 입력한 뒤에야 알게 된다.
    조회가 실패하면 eligible=None — 화면은 기존 방식으로 진행하고 최종 판정은 결제 서버가 한다.
    """
    try:
        eligible = await _is_first_time_subscriber(user["id"], user.get("email"))
    except Exception as e:
        logger.warning(f"discount_eligibility 조회 실패(화면은 기존 방식 사용): {e}")
        return {"eligible": None}
    return {"eligible": bool(eligible)}


@router.post("/creb/billing/issue")
async def issue_billing(body: BillingIssueRequest, request: Request, user: dict = Depends(get_current_user)):
    """빌링키 발급 + 첫 결제 → 구독 활성화 (크렙). 카드 등록자는 Bearer 토큰으로 확정한다
    (크렙 auth_key 리다이렉트에는 customerKey가 없으므로 클라이언트 값을 신뢰하지 않음)."""
    client_ip = (request.client.host if request.client else "unknown")
    _check_billing_issue_rate_limit(client_ip)

    user_id = user["id"]
    customer_key = f"customer_{user_id}"

    # 0. 신규 구독 수용 한도(기본 꺼짐) — 용량이 찼을 때 빌링키 발급·결제 **이전에** 대기자 안내로 돌린다(기존 구독자는 통과)
    from services.capacity_gate import new_subscriber_blocked
    _blocked = await new_subscriber_blocked(user_id)
    if _blocked:
        raise HTTPException(status_code=409, detail=_blocked)

    # 0-1. 이미 같은 플랜을 이용 중이면 빌링키 발급·결제 이전에 거부 (이중 청구 방지)
    if await _already_subscribed_same_plan(user_id, body.amount):
        logger.warning(f"issue_billing 중복 결제 차단 — 이미 같은 플랜 이용 중: user_id={user_id}, amount={body.amount}")
        raise HTTPException(
            status_code=409,
            detail="이미 같은 플랜을 이용 중입니다. 결제는 진행되지 않았고 청구되지 않았습니다. 대시보드로 이동해 주세요.",
        )

    # 1-0. 빌링키 발급 **이전**에 검증 (2026-11-10): 계정·금액·첫 달 할인 자격은 빌링키와 무관하다. 발급 뒤에 거부하면
    # 크렙에 쓰이지 않는 빌링키가 남고, 1회용 authKey가 소진돼 사용자가 카드 입력부터 다시 해야 했다.
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
        if not await _is_first_time_subscriber(user_id, user.get("email")):
            logger.warning(f"할인가 결제 시도 거부 — 기존 구독자: user_id={user_id}, amount={body.amount}")
            raise HTTPException(status_code=400, detail="첫 달 할인은 신규 가입자에게만 적용됩니다")
        discount_until = (datetime.now() + timedelta(days=30)).date().isoformat()

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

    # 같은 order_id 재요청은 크렙이 새 결제를 만들지 않는다(승인=기존 결과 반환, 실패=재결제 가능, 금액 다르면 거절).
    # 10분 구간·금액을 넣어 타임아웃 뒤 재시도가 같은 주문으로 합쳐지게 한다(구간 경계를 넘는 재시도는 새 주문 — 잔여 한계).
    order_id = f"first_{user_id}_{body.amount}_{int(datetime.now().timestamp()) // 600}"
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
        state, pay_res = await creb_client.settle_uncertain_billpay(order_id, pay_res)
        if state == "pending":
            # 타임아웃·처리 중 등 승인 여부를 모른다 — 실패로 단정하면 재시도가 이중 청구가 된다.
            logger.error(f"첫 결제 결과 불명: order_id={order_id} {pay_res.code} {pay_res.error_code} {pay_res.msg}")
            try:
                from services.email_sender import send_operator_alert
                await send_operator_alert("첫 결제 결과 불명 — 크렙 주문 조회 확인 필요", f"order_id={order_id}, user_id={user_id}, amount={body.amount}")
            except Exception as alert_err:
                logger.warning(f"[webhook] 결과 불명 운영자 알림 실패: {alert_err}")
            raise HTTPException(status_code=409, detail="결제 결과를 확인하는 중입니다. 다시 결제하지 마시고 잠시 후 설정 화면에서 구독 상태를 확인해 주세요.")
        if not pay_res.ok:
            logger.error(f"첫 결제 실패: {pay_res.code} {pay_res.msg}")
            await record_payment_event(user_id, "billing_issue", "failed", body.amount, f"{pay_res.code} {pay_res.msg}")
            raise HTTPException(status_code=400, detail="결제에 실패했습니다. 카드 한도·잔액을 확인 후 다시 시도해 주세요.")

        payment_key = pay_res.data.get("transactionNumber")
        await record_payment_event(user_id, "billing_issue", "success", body.amount, payment_key)
        charge_start_at = utc_now_iso()

    # 첫 달 할인으로 결제가 성공했으면 이용 사실을 비식별 해시로 남긴다(탈퇴 후 재가입 반복 방지, 기본 꺼짐·실패해도 계속).
    # 탈퇴 직전에도 한 번 더 기록한다(결제 뒤에 등록한 사업장 반영 — routers/settings.py delete_account).
    if is_discount_amount:
        from services.discount_guard import record_use, PURPOSE_DISCOUNT
        await record_use(PURPOSE_DISCOUNT, user_id, user.get("email"))

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
