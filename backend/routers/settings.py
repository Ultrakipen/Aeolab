import os
import asyncio
import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from db.supabase_client import get_client, execute
from supabase import create_client
from middleware.plan_gate import get_current_user

logger = logging.getLogger("aeolab")

router = APIRouter()


class ProfileUpdate(BaseModel):
    phone: Optional[str] = None
    kakao_phone: Optional[str] = None  # 카카오 알림톡 수신 번호
    kakao_scan_notify: Optional[bool] = None   # 스캔 완료 알림
    kakao_competitor_notify: Optional[bool] = None  # 경쟁사 순위변동 알림
    instagram_username: Optional[str] = None  # 인스타그램 계정명 (@제외)
    instagram_follower_count: Optional[int] = None  # 팔로워 수 (사용자 직접 입력)
    instagram_post_count_30d: Optional[int] = None  # 최근 30일 게시물 수 (사용자 직접 입력)


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
            .select("plan, status, start_at, end_at, grace_until")
            .eq("user_id", user_id)
            .maybe_single()
        )
    ).data

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

    return {
        "user_id": user_id,
        "subscription": sub or {"plan": "free", "status": "inactive"},
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

    # Instagram 정보 → businesses 테이블 업데이트
    instagram_biz_update: dict = {}
    if body.instagram_username is not None:
        instagram_biz_update["instagram_username"] = body.instagram_username
    if body.instagram_follower_count is not None:
        instagram_biz_update["instagram_follower_count"] = body.instagram_follower_count
    if body.instagram_post_count_30d is not None:
        instagram_biz_update["instagram_post_count_30d"] = body.instagram_post_count_30d

    if instagram_biz_update:
        try:
            await execute(
                supabase.table("businesses")
                .update(instagram_biz_update)
                .eq("user_id", user_id)
            )
        except Exception as e:
            logger.warning(f"businesses instagram 업데이트 실패 (user={user_id}): {e}")

    return {"status": "updated"}


@router.post("/cancel")
async def cancel_subscription(user: dict = Depends(get_current_user)):
    """구독 해지 요청 (end_at까지 서비스 유지, status→cancelled + 토스 빌링키 삭제)"""
    user_id = user["id"]
    supabase = get_client()
    sub = (
        await execute(
            supabase.table("subscriptions")
            .select("status, end_at, billing_key")
            .eq("user_id", user_id)
            .maybe_single()
        )
    ).data
    if not sub or sub.get("status") not in ("active", "grace_period"):
        raise HTTPException(status_code=400, detail={"code": "NO_ACTIVE_SUBSCRIPTION"})

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

    await execute(supabase.table("subscriptions").update({"status": "cancelled"}).eq("user_id", user_id))
    return {"status": "cancelled", "end_at": sub.get("end_at")}


class CardUpdateRequest(BaseModel):
    authKey: str
    customerKey: str


@router.post("/card/update")
async def update_card(body: CardUpdateRequest, user: dict = Depends(get_current_user)):
    """카드 변경 — 새 빌링키 발급 → 기존 빌링키 삭제 → DB 업데이트"""
    user_id = user["id"]
    supabase = get_client()
    secret_key = os.getenv("TOSS_SECRET_KEY", "")

    # 1. 현재 구독에서 기존 billing_key 조회
    sub = (
        await execute(
            supabase.table("subscriptions")
            .select("billing_key, status")
            .eq("user_id", user_id)
            .maybe_single()
        )
    ).data
    if not sub or sub.get("status") not in ("active", "grace_period"):
        raise HTTPException(status_code=400, detail={"code": "NO_ACTIVE_SUBSCRIPTION"})

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

    new_billing_key = resp.json().get("billingKey")
    if not new_billing_key:
        raise HTTPException(status_code=500, detail="새 빌링키를 받지 못했습니다")

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

    # 4. DB subscriptions 테이블에 billing_key 업데이트
    await execute(
        supabase.table("subscriptions")
        .update({"billing_key": new_billing_key})
        .eq("user_id", user_id)
    )

    logger.info(f"카드 변경 완료 (user={user_id})")
    return {"status": "updated", "message": "카드가 성공적으로 변경되었습니다"}


@router.delete("/account")
async def delete_account(user: dict = Depends(get_current_user)):
    """계정 탈퇴 — 사업장 비활성화 후 Auth 사용자 삭제"""
    user_id = user["id"]
    supabase = get_client()

    # 사업장 비활성화 (스캔 기록 보존)
    await execute(
        supabase.table("businesses")
        .update({"is_active": False})
        .eq("user_id", user_id)
    )

    # 구독 취소 처리
    await execute(
        supabase.table("subscriptions")
        .update({"status": "cancelled"})
        .eq("user_id", user_id)
    )

    # Auth 사용자 삭제 (service role 필요)
    url = os.getenv("SUPABASE_URL", "")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    admin_client = create_client(url, service_key)

    try:
        await asyncio.to_thread(admin_client.auth.admin.delete_user, user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"계정 삭제 중 오류: {str(e)}")

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
