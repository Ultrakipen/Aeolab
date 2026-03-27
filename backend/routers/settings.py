from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from typing import Optional
from db.supabase_client import get_client, execute

router = APIRouter()


class ProfileUpdate(BaseModel):
    phone: Optional[str] = None
    kakao_phone: Optional[str] = None  # 카카오 알림톡 수신 번호


@router.get("/me")
async def get_my_settings(x_user_id: str = Header(...)):
    """사용자 프로필 + 구독 정보 조회"""
    supabase = get_client()

    # 사업장 목록
    businesses = (
        await execute(
            supabase.table("businesses")
            .select("id, name, category, region, is_active, created_at")
            .eq("user_id", x_user_id)
            .eq("is_active", True)
        )
    ).data

    # 구독 정보
    sub = (
        await execute(
            supabase.table("subscriptions")
            .select("*")
            .eq("user_id", x_user_id)
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

    return {
        "user_id": x_user_id,
        "subscription": sub or {"plan": "free", "status": "inactive"},
        "businesses": businesses,
        "scan_count_this_month": scan_count,
    }


@router.patch("/me")
async def update_my_settings(body: ProfileUpdate, x_user_id: str = Header(...)):
    """카카오 알림 수신 번호 등 업데이트"""
    supabase = get_client()

    if body.phone is None:
        return {"status": "no_change"}

    # profiles 테이블 upsert (카카오 알림톡 수신 번호)
    await execute(
        supabase.table("profiles").upsert(
            {"user_id": x_user_id, "phone": body.phone},
            on_conflict="user_id",
        )
    )

    # businesses 테이블에도 동기화 (전화번호 표시용)
    await execute(supabase.table("businesses").update({"phone": body.phone}).eq("user_id", x_user_id))

    return {"status": "updated"}


@router.post("/cancel")
async def cancel_subscription(x_user_id: str = Header(...)):
    """구독 해지 요청 (end_at까지 서비스 유지, status→cancelled)"""
    supabase = get_client()
    sub = (
        await execute(
            supabase.table("subscriptions")
            .select("*")
            .eq("user_id", x_user_id)
            .maybe_single()
        )
    ).data
    if not sub or sub.get("status") not in ("active", "grace_period"):
        raise HTTPException(status_code=400, detail={"code": "NO_ACTIVE_SUBSCRIPTION"})

    await execute(supabase.table("subscriptions").update({"status": "cancelled"}).eq("user_id", x_user_id))
    return {"status": "cancelled", "end_at": sub.get("end_at")}
