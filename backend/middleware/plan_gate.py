from fastapi import HTTPException, Depends, Header
from functools import wraps
from typing import Optional
from db.supabase_client import get_client

PLAN_LIMITS = {
    "free":       {"scan_monthly": 3,   "competitors": 0,   "guide": False, "schema": False, "pdf": False, "csv": False, "startup_report": False, "api_keys": False},
    "basic":      {"scan_monthly": 10,  "competitors": 5,   "guide": True,  "schema": True,  "pdf": False, "csv": False, "startup_report": False, "api_keys": False},
    "pro":        {"scan_monthly": 999, "competitors": 10,  "guide": True,  "schema": True,  "pdf": True,  "csv": True,  "startup_report": False, "api_keys": False},
    "biz":        {"scan_monthly": 999, "competitors": 20,  "guide": True,  "schema": True,  "pdf": True,  "csv": True,  "startup_report": False, "api_keys": True},
    "startup":    {"scan_monthly": 10,  "competitors": 10,  "guide": True,  "schema": True,  "pdf": False, "csv": False, "startup_report": True,  "api_keys": False},
    "enterprise": {"scan_monthly": 999, "competitors": 999, "guide": True,  "schema": True,  "pdf": True,  "csv": True,  "startup_report": True,  "api_keys": True},
}

PLAN_HIERARCHY = {"free": 0, "basic": 1, "pro": 2, "biz": 3, "startup": 2, "enterprise": 4}


async def get_user_plan(user_id: str, supabase) -> str:
    """현재 사용자의 활성 구독 플랜 반환"""
    row = (
        supabase.table("subscriptions")
        .select("plan")
        .eq("user_id", user_id)
        .eq("status", "active")
        .maybe_single()
        .execute()
    )
    return row.data["plan"] if row.data else "free"


def require_plan(*required_plans: str):
    """플랜 검사 데코레이터 — 함수에 user_id, supabase 의존성 필요"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            user_id = kwargs.get("user_id")
            supabase = kwargs.get("supabase")
            if user_id and supabase:
                plan = await get_user_plan(user_id, supabase)
                if plan not in required_plans:
                    raise HTTPException(
                        status_code=403,
                        detail={
                            "code": "PLAN_REQUIRED",
                            "current_plan": plan,
                            "required_plans": list(required_plans),
                            "upgrade_url": "/pricing",
                        },
                    )
            return await func(*args, **kwargs)
        return wrapper
    return decorator


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Authorization: Bearer <supabase_jwt> 토큰 검증 후 사용자 정보 반환"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="인증 토큰이 필요합니다")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        supabase = get_client()
        response = supabase.auth.get_user(token)
        if not response or not response.user:
            raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다")
        return {"id": response.user.id, "email": response.user.email}
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Token validation failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=401, detail="토큰 검증에 실패했습니다")
