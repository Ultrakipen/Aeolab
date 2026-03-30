"""
Public API 키 관리 (Biz/Enterprise 전용)
개발자·대행사용 API 접근 키 발급 및 관리
"""
import secrets
from fastapi import APIRouter, Depends, HTTPException
from db.supabase_client import get_client, execute
from middleware.plan_gate import get_current_user

router = APIRouter()


async def _check_plan(user_id: str):
    supabase = get_client()
    sub = (
        await execute(
            supabase.table("subscriptions")
            .select("plan, status")
            .eq("user_id", user_id)
            .maybe_single()
        )
    ).data
    plan = (sub or {}).get("plan", "free")
    status = (sub or {}).get("status", "inactive")
    if plan not in ("biz", "enterprise") or status != "active":
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "required_plans": ["biz", "enterprise"]},
        )
    return plan


@router.get("")
async def list_api_keys(user=Depends(get_current_user)):
    """발급된 API 키 목록 조회"""
    x_user_id = user["id"]
    await _check_plan(x_user_id)
    supabase = get_client()
    keys = (
        await execute(
            supabase.table("api_keys")
            .select("id, name, key_prefix, created_at, last_used_at, is_active")
            .eq("user_id", x_user_id)
            .order("created_at", desc=True)
        )
    ).data or []
    return keys


@router.post("")
async def create_api_key(name: str, user=Depends(get_current_user)):
    """API 키 발급 (최대 5개)"""
    x_user_id = user["id"]
    await _check_plan(x_user_id)
    supabase = get_client()

    existing = (
        await execute(
            supabase.table("api_keys")
            .select("id")
            .eq("user_id", x_user_id)
            .eq("is_active", True)
        )
    ).data or []
    if len(existing) >= 5:
        raise HTTPException(status_code=400, detail="최대 5개의 API 키만 발급 가능합니다")

    raw_key = f"aeo_{secrets.token_urlsafe(32)}"
    prefix = raw_key[:12]

    import hashlib
    hashed = hashlib.sha256(raw_key.encode()).hexdigest()

    result = await execute(supabase.table("api_keys").insert({
        "user_id": x_user_id,
        "name": name,
        "key_prefix": prefix,
        "key_hash": hashed,
        "is_active": True,
    }))

    # 발급 시에만 전체 키 노출 (이후 조회 불가)
    data = result.data[0] if result.data else {}
    data["raw_key"] = raw_key
    return data


@router.delete("/{key_id}")
async def revoke_api_key(key_id: str, user=Depends(get_current_user)):
    x_user_id = user["id"]
    """API 키 폐기"""
    supabase = get_client()
    await execute(
        supabase.table("api_keys").update({"is_active": False}).eq("id", key_id).eq(
            "user_id", x_user_id
        )
    )
    return {"revoked": True}
