"""
팀 계정 관리 API (Biz 플랜 전용 — 최대 5명)
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from db.supabase_client import get_client, execute
from middleware.plan_gate import get_current_user

router = APIRouter()

TEAM_LIMIT = {"biz": 5}


class TeamInviteRequest(BaseModel):
    email: EmailStr
    role: str = "member"  # member | viewer


async def _get_plan(user_id: str) -> tuple[str, str]:
    """(plan, status) 반환 — status는 호출부의 "active"/"grace_period" 게이트 그대로 통과시키기 위한
    유효 상태다. plan_gate.get_user_plan()이 cancelled+end_at 미래를 유료로 인정하는 것과 어긋나지
    않도록, 그 경우 status를 "active"로 승격한다(teams/api_keys가 이 판정을 별도로 중복구현하지 않음)."""
    from middleware.plan_gate import get_user_plan
    supabase = get_client()
    sub = (
        await execute(
            supabase.table("subscriptions")
            .select("plan, status")
            .eq("user_id", user_id)
            .maybe_single()
        )
    ).data
    status = (sub or {}).get("status", "inactive")
    effective_plan = await get_user_plan(user_id, supabase)
    if effective_plan != "free" and status == "cancelled":
        status = "active"
    return effective_plan, status


@router.get("/members")
async def list_members(user=Depends(get_current_user)):
    """팀 멤버 목록 조회 (Biz+ 전용)"""
    x_user_id = user["id"]
    plan, status = await _get_plan(x_user_id)
    if plan not in ("biz", "enterprise") or status not in ("active", "grace_period"):
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "required_plans": ["biz"]},
        )
    supabase = get_client()
    members = (
        await execute(
            supabase.table("team_members")
            .select("id, owner_id, email, role, status, invited_at, joined_at")
            .eq("owner_id", x_user_id)
        )
    ).data or []
    return members


@router.post("/invite")
async def invite_member(req: TeamInviteRequest, user=Depends(get_current_user)):
    """팀원 초대 이메일 발송 (Biz+ 전용)"""
    x_user_id = user["id"]
    plan, status = await _get_plan(x_user_id)
    if plan not in ("biz", "enterprise") or status not in ("active", "grace_period"):
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "required_plans": ["biz"]},
        )

    supabase = get_client()
    limit = TEAM_LIMIT.get(plan, 5)

    current_count = len(
        (
            await execute(
                supabase.table("team_members")
                .select("id")
                .eq("owner_id", x_user_id)
            )
        ).data or []
    )
    if current_count >= limit:
        raise HTTPException(
            status_code=400,
            detail={"code": "TEAM_LIMIT_REACHED", "limit": limit},
        )

    # 초대 기록 생성 (이메일로 초대 링크 발송은 별도 구현)
    result = await execute(supabase.table("team_members").insert({
        "owner_id": x_user_id,
        "email": req.email,
        "role": req.role,
        "status": "pending",
    }))
    return result.data[0] if result.data else {"status": "invited"}


@router.delete("/members/{member_id}")
async def remove_member(member_id: str, user=Depends(get_current_user)):
    """팀원 제거 (Biz+ 전용)"""
    x_user_id = user["id"]
    plan, status = await _get_plan(x_user_id)
    if plan not in ("biz", "enterprise") or status not in ("active", "grace_period"):
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "required_plans": ["biz"]},
        )
    supabase = get_client()
    await execute(
        supabase.table("team_members").delete().eq("id", member_id).eq(
            "owner_id", x_user_id
        )
    )
    return {"deleted": True}


@router.patch("/members/{member_id}/role")
async def update_member_role(member_id: str, role: str, user=Depends(get_current_user)):
    """팀원 역할 변경 (member ↔ viewer, Biz+ 전용)"""
    x_user_id = user["id"]
    plan, status = await _get_plan(x_user_id)
    if plan not in ("biz", "enterprise") or status not in ("active", "grace_period"):
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "required_plans": ["biz"]},
        )
    if role not in ("member", "viewer"):
        raise HTTPException(status_code=400, detail="role must be member or viewer")
    supabase = get_client()
    await execute(
        supabase.table("team_members").update({"role": role}).eq("id", member_id).eq(
            "owner_id", x_user_id
        )
    )
    return {"updated": True}
