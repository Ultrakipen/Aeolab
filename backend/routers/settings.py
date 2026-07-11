import os
import asyncio
import logging
import httpx
from datetime import date, datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from db.supabase_client import get_client, execute
from supabase import create_client
from middleware.plan_gate import get_current_user, _end_at_in_future
from services.email_sender import send_operator_alert
from utils.alert import send_slack_alert
from services.kakao_notify import KakaoNotifier
from config.card_issuers import card_issuer_name

logger = logging.getLogger("aeolab")

router = APIRouter()


async def _check_refund_eligibility(user_id: str, supabase, start_at, first_payment_key) -> bool:
    """7일 청약철회 자동환불 자격 확인 — terms/page.tsx 제5조: 구독 시작일로부터 7일 이내
    + 서비스 미이용(스캔·가이드 생성 등). 판단은 보수적으로(애매하면 환불 거부) — 활성 여부와
    무관하게 사용자 소유의 모든 사업장을 대상으로 스캔·가이드 이력을 확인한다."""
    if not first_payment_key or not start_at:
        return False
    try:
        start_dt = datetime.fromisoformat(str(start_at).replace("Z", "+00:00"))
        if start_dt.tzinfo is None:
            start_dt = start_dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return False
    if datetime.now(timezone.utc) - start_dt > timedelta(days=7):
        return False

    biz_res = await execute(supabase.table("businesses").select("id").eq("user_id", user_id))
    biz_ids = [b["id"] for b in (biz_res.data or [])]
    if not biz_ids:
        return True  # 사업장이 없으면 스캔·가이드 생성 자체가 불가능 → 미이용

    scan_res = await execute(
        supabase.table("scan_results").select("id", count="exact").in_("business_id", biz_ids).limit(1)
    )
    if (scan_res.count or 0) > 0:
        return False

    guide_res = await execute(
        supabase.table("guides").select("id", count="exact").in_("business_id", biz_ids).limit(1)
    )
    if (guide_res.count or 0) > 0:
        return False

    return True


class ProfileUpdate(BaseModel):
    phone: Optional[str] = None
    kakao_phone: Optional[str] = None  # 카카오 알림톡 수신 번호
    kakao_scan_notify: Optional[bool] = None   # 스캔 완료 알림
    kakao_competitor_notify: Optional[bool] = None  # 경쟁사 순위변동 알림


@router.get("/me")
async def get_my_settings(user: dict = Depends(get_current_user)):
    """사용자 프로필 + 구독 정보 조회"""
    user_id = user["id"]
    supabase = get_client()

    # 사업장 목록
    businesses = (
        await execute(
            supabase.table("businesses")
            .select("id, name, category, region, is_active, created_at")
            .eq("user_id", user_id)
            .eq("is_active", True)
        )
    ).data

    # 구독 정보
    sub = (
        await execute(
            supabase.table("subscriptions")
            .select("plan, status, start_at, end_at, grace_until, first_payment_key, card_issuer_code, card_number_masked")
            .eq("user_id", user_id)
            .maybe_single()
        )
    ).data

    # 7일 청약철회 자동환불 자격 (해지 모달에서 안내 문구 분기용)
    refund_eligible = False
    if sub and sub.get("status") in ("active", "grace_period"):
        refund_eligible = await _check_refund_eligibility(
            user_id, supabase, sub.get("start_at"), sub.get("first_payment_key")
        )

    # 이번 달 스캔 횟수 (N+1 제거: 단일 IN 쿼리)
    from datetime import datetime
    month_start = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    scan_count = 0
    if businesses:
        biz_ids = [b["id"] for b in businesses]
        result = await execute(
            supabase.table("scan_results")
            .select("id", count="exact")
            .in_("business_id", biz_ids)
            .gte("scanned_at", month_start)
        )
        scan_count = result.count or 0

    # 프로필 (카카오 알림 설정)
    profile = (
        await execute(
            supabase.table("profiles")
            .select("phone, kakao_scan_notify, kakao_competitor_notify")
            .eq("user_id", user_id)
            .maybe_single()
        )
    ).data

    if sub:
        sub_public = {k: v for k, v in sub.items() if k not in ("first_payment_key", "card_issuer_code")}
        sub_public["card_issuer"] = card_issuer_name(sub.get("card_issuer_code"))
    else:
        sub_public = {"plan": "free", "status": "inactive"}

    return {
        "user_id": user_id,
        "subscription": sub_public,
        "refund_eligible": refund_eligible,
        "businesses": businesses,
        "scan_count_this_month": scan_count,
        "profile": profile or {},
    }


@router.patch("/me")
async def update_my_settings(body: ProfileUpdate, user: dict = Depends(get_current_user)):
    """카카오 알림 수신 번호 등 업데이트"""
    user_id = user["id"]
    supabase = get_client()

    profile_data: dict = {"user_id": user_id}
    if body.phone is not None:
        profile_data["phone"] = body.phone
    if body.kakao_scan_notify is not None:
        profile_data["kakao_scan_notify"] = body.kakao_scan_notify
    if body.kakao_competitor_notify is not None:
        profile_data["kakao_competitor_notify"] = body.kakao_competitor_notify

    if len(profile_data) == 1:  # user_id만 있으면 변경사항 없음
        return {"status": "no_change"}

    await execute(
        supabase.table("profiles").upsert(profile_data, on_conflict="user_id")
    )

    if body.phone is not None:
        await execute(supabase.table("businesses").update({"phone": body.phone}).eq("user_id", user_id))

    return {"status": "updated"}


async def _cancel_subscription_core(user_id: str) -> dict:
    """구독 해지 핵심 로직. 7일 청약철회 자격(구독 시작 7일 이내+미이용)이면 토스 결제취소로 즉시 전액환불,
    아니면 기존처럼 end_at까지 서비스 유지 + status→cancelled + 토스 빌링키 삭제.

    사용자 본인 해지(POST /settings/cancel)와 관리자 강제 해지/환불(POST /admin/subscriptions/{user_id}/cancel)
    양쪽이 이 함수를 공유한다 — 안전장치(경쟁조건 방어·DB 갱신 실패 알림·7일 분기)를 두 경로에서
    동일하게 보장하기 위해 분리했다(admin_functional_gaps_implementation_plan_v1.0.md §5).
    """
    supabase = get_client()
    sub = (
        await execute(
            supabase.table("subscriptions")
            .select("status, start_at, end_at, billing_key, first_payment_key, first_payment_amount")
            .eq("user_id", user_id)
            .maybe_single()
        )
    ).data
    if not sub or sub.get("status") not in ("active", "grace_period"):
        raise HTTPException(status_code=400, detail={"code": "NO_ACTIVE_SUBSCRIPTION"})

    # 7일 청약철회 자동환불 판정 — terms/page.tsx 제5조 근거 (docs/subscription_lifecycle_inspection_v1.0.md §5/§6)
    refunded = False
    refund_amount = None
    if await _check_refund_eligibility(user_id, supabase, sub.get("start_at"), sub.get("first_payment_key")):
        secret_key = os.getenv("TOSS_SECRET_KEY", "")
        try:
            async with httpx.AsyncClient(timeout=15) as c:
                cancel_resp = await c.post(
                    f"https://api.tosspayments.com/v1/payments/{sub['first_payment_key']}/cancel",
                    auth=(secret_key, ""),
                    json={"cancelReason": "7일 이내 청약철회"},
                )
            if cancel_resp.status_code == 200:
                refunded = True
                refund_amount = sub.get("first_payment_amount")
                logger.info(f"7일 청약철회 자동환불 성공 (user={user_id}, amount={refund_amount})")
            else:
                # 동시 요청 경쟁조건 방어: 이 요청과 거의 동시에 도착한 다른 요청이 먼저 환불을
                # 완료시켰다면(Toss는 같은 paymentKey 재취소를 4xx로 거부) status가 이미 cancelled로
                # 바뀌어 있다 — 이 경우는 실패가 아니라 정상적인 중복 응답이므로 오탐 알림을 억제한다.
                _recheck = (
                    await execute(
                        supabase.table("subscriptions").select("status").eq("user_id", user_id).maybe_single()
                    )
                ).data
                if (_recheck or {}).get("status") == "cancelled":
                    logger.info(
                        f"7일 청약철회 환불 — 동시 요청으로 이미 처리됨(정상), 오탐 알림 억제 (user={user_id})"
                    )
                else:
                    logger.error(
                        f"7일 청약철회 자동환불 실패 (user={user_id}): status={cancel_resp.status_code} body={cancel_resp.text}"
                    )
                    await send_operator_alert(
                        "7일 청약철회 자동환불 실패 — 수동 확인 필요",
                        f"user_id={user_id}\nfirst_payment_key={sub['first_payment_key']}\n"
                        f"status={cancel_resp.status_code}\nbody={cancel_resp.text}",
                    )
                    await send_slack_alert(
                        "7일 청약철회 자동환불 실패", f"user_id={user_id}, status={cancel_resp.status_code}", level="error"
                    )
        except Exception as e:
            logger.error(f"7일 청약철회 자동환불 요청 오류 (user={user_id}): {e}")
            await send_operator_alert(
                "7일 청약철회 자동환불 오류 — 수동 확인 필요", f"user_id={user_id}\nerror={e}"
            )
            await send_slack_alert("7일 청약철회 자동환불 오류", f"user_id={user_id}, error={e}", level="error")

    # 토스 빌링키 삭제 (실패해도 DB는 취소 처리 — 자동결제 재시도 방지 목적이므로 best-effort)
    billing_key = sub.get("billing_key")
    if billing_key:
        secret_key = os.getenv("TOSS_SECRET_KEY", "")
        try:
            async with httpx.AsyncClient(timeout=15) as c:
                resp = await c.delete(
                    f"https://api.tosspayments.com/v1/billing/{billing_key}",
                    auth=(secret_key, ""),
                )
            if resp.status_code not in (200, 204):
                logger.warning(
                    f"토스 빌링키 삭제 실패 (user={user_id}): status={resp.status_code} body={resp.text}"
                )
            else:
                logger.info(f"토스 빌링키 삭제 완료 (user={user_id})")
        except Exception as e:
            logger.warning(f"토스 빌링키 삭제 요청 오류 (user={user_id}): {e}")

    update_payload = {"status": "cancelled"}
    if refunded:
        update_payload["end_at"] = str(date.today())  # 환불 시 즉시 만료 — 기존처럼 잔여기간 유지 아님
    try:
        await execute(supabase.table("subscriptions").update(update_payload).eq("user_id", user_id))
    except Exception as e:
        # 환불이 이미 처리된 뒤 이 DB 갱신이 실패하면 "환불은 됐는데 상태는 active로 남는" 불일치 발생 —
        # money-moving 이벤트 직후이므로 silent pass 금지, 수동 확인 알림 필수
        logger.error(f"해지/환불 후 DB 상태 갱신 실패 (user={user_id}, refunded={refunded}): {e}")
        if refunded:
            await send_operator_alert(
                "환불 완료 후 DB 상태 갱신 실패 — 수동 확인 필요",
                f"user_id={user_id}\nToss 환불은 이미 처리됨(amount={refund_amount}). "
                f"subscriptions.status를 수동으로 cancelled 처리해야 함.\nerror={e}",
            )
            await send_slack_alert(
                "환불 완료 후 DB 갱신 실패", f"user_id={user_id}, amount={refund_amount}", level="error"
            )
        raise HTTPException(status_code=500, detail="처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.")

    profile = (
        await execute(supabase.table("profiles").select("phone").eq("user_id", user_id).maybe_single())
    ).data
    phone = (profile or {}).get("phone")
    if phone:
        try:
            await KakaoNotifier().send_subscription_cancelled(phone, refunded, refund_amount)
        except Exception as e:
            logger.warning(f"해지 완료 카카오 알림 발송 실패 (user={user_id}): {e}")

    return {
        "status": "cancelled",
        "end_at": update_payload.get("end_at", sub.get("end_at")),
        "refunded": refunded,
        "refund_amount": refund_amount,
    }


@router.post("/cancel")
async def cancel_subscription(user: dict = Depends(get_current_user)):
    """구독 해지 요청 (본인). 로직은 _cancel_subscription_core 참조."""
    return await _cancel_subscription_core(user["id"])


@router.post("/reactivate")
async def reactivate_subscription(user: dict = Depends(get_current_user)):
    """해지 취소(재활성화) — cancelled 상태이고 잔여기간(end_at)이 아직 남은 경우에만 허용.
    토스 빌링키는 해지 시 best-effort로 삭제되므로, 다음 자동갱신 때 결제가 실패해도
    기존 유예기간(grace_period) 재시도 흐름으로 자연스럽게 이어진다 — 카드 재등록이 필요하면
    /settings/card/update로 별도 안내."""
    user_id = user["id"]
    supabase = get_client()
    sub = (
        await execute(
            supabase.table("subscriptions")
            .select("status, end_at")
            .eq("user_id", user_id)
            .maybe_single()
        )
    ).data
    if not sub or sub.get("status") != "cancelled":
        raise HTTPException(status_code=400, detail={"code": "NOT_CANCELLED"})
    if not _end_at_in_future(sub.get("end_at")):
        raise HTTPException(
            status_code=400,
            detail={"code": "PERIOD_EXPIRED", "message": "이미 만료된 구독은 재활성화할 수 없습니다. 새로 구독해주세요."},
        )

    await execute(supabase.table("subscriptions").update({"status": "active"}).eq("user_id", user_id))
    logger.info(f"구독 재활성화 완료 (user={user_id})")
    return {"status": "active", "end_at": sub.get("end_at")}


class CardUpdateRequest(BaseModel):
    authKey: str
    customerKey: str


@router.post("/card/update")
async def update_card(body: CardUpdateRequest, user: dict = Depends(get_current_user)):
    """카드 변경 — 새 빌링키 발급 → 기존 빌링키 삭제 → DB 업데이트"""
    user_id = user["id"]
    supabase = get_client()
    secret_key = os.getenv("TOSS_SECRET_KEY", "")

    # 1. 현재 구독에서 기존 billing_key 조회 (정지 상태 재시도용 필드 포함)
    sub = (
        await execute(
            supabase.table("subscriptions")
            .select("id, plan, billing_cycle, customer_key, billing_key, status")
            .eq("user_id", user_id)
            .maybe_single()
        )
    ).data
    if not sub or sub.get("status") not in ("active", "grace_period", "suspended"):
        raise HTTPException(status_code=400, detail={"code": "NO_ACTIVE_SUBSCRIPTION"})

    was_suspended = sub.get("status") == "suspended"
    old_billing_key = sub.get("billing_key")

    # 2. 토스 API로 새 빌링키 발급
    async with httpx.AsyncClient(timeout=30) as c:
        resp = await c.post(
            "https://api.tosspayments.com/v1/billing/authorizations/issue",
            auth=(secret_key, ""),
            json={"authKey": body.authKey, "customerKey": body.customerKey},
        )
    if resp.status_code != 200:
        logger.error(f"새 빌링키 발급 실패 (user={user_id}): {resp.text}")
        raise HTTPException(status_code=400, detail=f"카드 등록 실패: {resp.text}")

    issue_resp_json = resp.json()
    new_billing_key = issue_resp_json.get("billingKey")
    if not new_billing_key:
        raise HTTPException(status_code=500, detail="새 빌링키를 받지 못했습니다")

    card_info = issue_resp_json.get("card") or {}
    card_issuer_code = card_info.get("issuerCode")
    card_number_masked = card_info.get("number")

    # 3. 기존 빌링키 삭제 (실패해도 새 카드 등록은 유지 — best-effort)
    if old_billing_key and old_billing_key != new_billing_key:
        try:
            async with httpx.AsyncClient(timeout=15) as c:
                del_resp = await c.delete(
                    f"https://api.tosspayments.com/v1/billing/{old_billing_key}",
                    auth=(secret_key, ""),
                )
            if del_resp.status_code not in (200, 204):
                logger.warning(
                    f"기존 빌링키 삭제 실패 (user={user_id}): status={del_resp.status_code} body={del_resp.text}"
                )
            else:
                logger.info(f"기존 빌링키 삭제 완료 (user={user_id})")
        except Exception as e:
            logger.warning(f"기존 빌링키 삭제 요청 오류 (user={user_id}): {e}")

    # 4. DB subscriptions 테이블에 billing_key + 카드정보 업데이트
    await execute(
        supabase.table("subscriptions")
        .update({
            "billing_key": new_billing_key,
            "card_issuer_code": card_issuer_code,
            "card_number_masked": card_number_masked,
        })
        .eq("user_id", user_id)
    )

    # 5. 정지(suspended) 상태였다면 새 카드로 즉시 결제 재시도 — 성공 시 active 복귀 + 기간 연장
    reactivated = False
    if was_suspended:
        from services.toss_billing import retry_billing
        sub["billing_key"] = new_billing_key
        sub["user_id"] = user_id  # select에 user_id가 없어 payment_events 기록 시 NULL 방지

        # 이중 청구 방지: retry_billing(Toss 청구) 성공 후 바로 아래 상태 업데이트가
        # 실패해 사용자가 카드 변경을 재시도하면 재청구로 이어지는 문제 차단
        # (webhook.py issue_billing과 동일 패턴, 2026-07-11)
        from services.toss_billing import compute_renewal_amount
        from utils.payment_event_log import find_recent_success_event
        expected_amount = compute_renewal_amount(sub)
        recent_match = await find_recent_success_event(user_id, "renewal", expected_amount, window_minutes=10)
        if recent_match:
            logger.warning(f"카드변경 재결제 이중청구 방지 — 최근 성공 이벤트 재사용 (user={user_id})")
            success = True
        else:
            success = await retry_billing(sub)
        if success:
            renew_days = 365 if sub.get("billing_cycle") == "yearly" else 30
            new_end = date.today() + timedelta(days=renew_days)
            await execute(
                supabase.table("subscriptions")
                .update({"status": "active", "grace_until": None, "end_at": str(new_end)})
                .eq("user_id", user_id)
            )
            reactivated = True
            logger.info(f"정지 상태에서 카드변경 후 즉시 재결제 성공 (user={user_id})")
        else:
            logger.warning(f"정지 상태에서 카드변경했으나 재결제 실패 (user={user_id})")

    retry_failed = was_suspended and not reactivated
    logger.info(f"카드 변경 완료 (user={user_id}, was_suspended={was_suspended}, reactivated={reactivated})")
    return {
        "status": "updated",
        "message": (
            "카드가 성공적으로 변경되었습니다" + (". 결제가 재시도되어 구독이 재개되었습니다" if reactivated else "")
            if not retry_failed
            else "카드는 변경됐지만 재결제에 실패했습니다. 카드 정보를 다시 확인하거나 다른 카드로 시도해 주세요."
        ),
        "reactivated": reactivated,
        # 정지 상태였는데 새 카드로도 재결제가 실패한 경우 — 구독은 여전히 suspended로 남아있음을
        # 프론트가 명확히 구분해서 안내해야 함(2026-07-10 실측: 이 케이스에서 "카드 변경 완료"
        # 성공 메시지만 뜨고 구독 정지 상태는 그대로라는 사실이 전혀 전달되지 않던 버그).
        "retry_failed": retry_failed,
    }


@router.delete("/account")
async def delete_account(user: dict = Depends(get_current_user)):
    """계정 탈퇴 — 관련 데이터 전체 삭제 후 Auth 사용자 삭제 (개인정보보호법 준수)"""
    user_id = user["id"]
    supabase = get_client()

    # 1. 사업장 ID 수집 (하위 테이블 삭제 기준)
    biz_res = await execute(
        supabase.table("businesses").select("id").eq("user_id", user_id)
    )
    biz_ids = [b["id"] for b in (biz_res.data or [])]

    if biz_ids:
        # 2. scan_results를 참조하는 테이블 먼저 삭제 (FK 순서)
        for table in ("guides", "ai_citations", "score_history", "before_after", "gap_cards", "business_action_log"):
            try:
                await execute(supabase.table(table).delete().in_("business_id", biz_ids))
            except Exception as e:
                logger.warning(f"delete_account {table} 삭제 실패 (user={user_id}): {e}")
        # 3. scan_results 삭제
        try:
            await execute(supabase.table("scan_results").delete().in_("business_id", biz_ids))
        except Exception as e:
            logger.warning(f"delete_account scan_results 삭제 실패 (user={user_id}): {e}")
        # 4. competitors 삭제
        try:
            await execute(supabase.table("competitors").delete().in_("business_id", biz_ids))
        except Exception as e:
            logger.warning(f"delete_account competitors 삭제 실패 (user={user_id}): {e}")

    # 5. businesses 삭제
    await execute(supabase.table("businesses").delete().eq("user_id", user_id))

    # 6. trial_scans 익명화 (IP 해시 집계 데이터는 보존, 개인식별 정보만 제거)
    try:
        await execute(
            supabase.table("trial_scans")
            .update({"converted_user_id": None, "claim_email": None, "claimed_at": None})
            .eq("converted_user_id", user_id)
        )
    except Exception as e:
        logger.warning(f"delete_account trial_scans 익명화 실패 (user={user_id}): {e}")

    # 7. user_id FK 테이블 삭제
    for table in ("profiles", "notifications", "team_members", "api_keys"):
        try:
            await execute(supabase.table(table).delete().eq("user_id", user_id))
        except Exception as e:
            logger.warning(f"delete_account {table} 삭제 실패 (user={user_id}): {e}")

    # 8. 토스 빌링키 삭제 (자동결제 재시도 방지 — best-effort)
    sub_res = await execute(
        supabase.table("subscriptions").select("billing_key").eq("user_id", user_id).maybe_single()
    )
    billing_key = (sub_res.data or {}).get("billing_key")
    if billing_key:
        secret_key = os.getenv("TOSS_SECRET_KEY", "")
        try:
            async with httpx.AsyncClient(timeout=15) as c:
                del_resp = await c.delete(
                    f"https://api.tosspayments.com/v1/billing/{billing_key}",
                    auth=(secret_key, ""),
                )
            if del_resp.status_code not in (200, 204):
                logger.warning(f"delete_account 빌링키 삭제 실패 (user={user_id}): {del_resp.status_code}")
        except Exception as e:
            logger.warning(f"delete_account 빌링키 삭제 오류 (user={user_id}): {e}")

    # 9. subscriptions 삭제
    await execute(supabase.table("subscriptions").delete().eq("user_id", user_id))

    # 10. Auth 사용자 삭제 (service role 필요)
    url = os.getenv("SUPABASE_URL", "")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    admin_client = create_client(url, service_key)

    try:
        await asyncio.to_thread(admin_client.auth.admin.delete_user, user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"계정 삭제 중 오류: {str(e)}")

    logger.info(f"계정 탈퇴 완료 — 전체 데이터 삭제 (user={user_id})")
    return {"status": "deleted"}


@router.get("/onboarding-status")
async def get_onboarding_status(user: dict = Depends(get_current_user)):
    """신규 가입자 7일 온보딩 체크리스트 진행 상태"""
    supabase = get_client()
    uid = user["id"]

    # 구독 생성일 기준 7일 이내만 표시
    sub = (await execute(
        supabase.table("subscriptions").select("created_at, plan")
        .eq("user_id", uid).maybe_single()
    )).data

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)

    if sub and sub.get("created_at"):
        try:
            sub_created = datetime.fromisoformat(sub["created_at"].replace("Z", "+00:00"))
            days_since = (now - sub_created).days
            if days_since > 7:
                return {"show": False, "reason": "7일 온보딩 기간 완료"}
        except Exception as e:
            logger.warning(f"onboarding_status created_at 파싱 오류 (user={uid}): {e}")

    # 내 사업장
    biz = (await execute(
        supabase.table("businesses").select("id").eq("user_id", uid).eq("is_active", True).limit(1)
    )).data
    biz_id = biz[0]["id"] if biz else None

    # 첫 스캔 여부
    has_scan = False
    if biz_id:
        scan_row = (await execute(
            supabase.table("scan_results").select("id").eq("business_id", biz_id).limit(1)
        )).data
        has_scan = bool(scan_row)

    # 경쟁사 등록 여부
    has_competitor = False
    if biz_id:
        comp_row = (await execute(
            supabase.table("competitors").select("id").eq("business_id", biz_id).eq("is_active", True).limit(1)
        )).data
        has_competitor = bool(comp_row)

    # 가이드 생성 여부
    has_guide = False
    if biz_id:
        guide_row = (await execute(
            supabase.table("guides").select("id").eq("business_id", biz_id).limit(1)
        )).data
        has_guide = bool(guide_row)

    # 카카오 알림 번호 등록 여부
    profile = (await execute(
        supabase.table("profiles").select("phone").eq("user_id", uid).maybe_single()
    )).data
    has_phone = bool((profile or {}).get("phone"))

    steps = [
        {"id": "business",   "label": "사업장 등록",      "done": bool(biz_id),      "link": "/onboarding"},
        {"id": "scan",       "label": "첫 AI 스캔",        "done": has_scan,           "link": "/dashboard"},
        {"id": "guide",      "label": "개선 가이드 받기",  "done": has_guide,          "link": "/guide"},
        {"id": "competitor", "label": "경쟁사 등록",       "done": has_competitor,     "link": "/competitors"},
        {"id": "phone",      "label": "카카오 알림 설정",  "done": has_phone,          "link": "/settings"},
    ]
    done_count = sum(1 for s in steps if s["done"])

    return {
        "show": True,
        "steps": steps,
        "done_count": done_count,
        "total": len(steps),
        "all_done": done_count == len(steps),
    }
