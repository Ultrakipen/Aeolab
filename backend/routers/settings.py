import os
import asyncio
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from db.supabase_client import get_client, execute
from middleware.plan_gate import get_current_user
from supabase import create_client

router = APIRouter()


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

    return {"status": "updated"}


@router.post("/cancel")
async def cancel_subscription(user: dict = Depends(get_current_user)):
    """구독 해지 요청 (end_at까지 서비스 유지, status→cancelled)"""
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
    if not sub or sub.get("status") not in ("active", "grace_period"):
        raise HTTPException(status_code=400, detail={"code": "NO_ACTIVE_SUBSCRIPTION"})

    await execute(supabase.table("subscriptions").update({"status": "cancelled"}).eq("user_id", user_id))
    return {"status": "cancelled", "end_at": sub.get("end_at")}


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
