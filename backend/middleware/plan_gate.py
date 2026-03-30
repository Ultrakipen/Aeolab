from fastapi import HTTPException, Depends, Header
from functools import wraps
from typing import Optional
from datetime import date
from db.supabase_client import get_client

# ─── 플랜별 한도 정의 ──────────────────────────────────────────────────────────
#
# auto_scan_mode:
#   None     → 자동 스캔 없음 (free)
#   "basic"  → Gemini(100회) + 네이버 매일 / 나머지 6개 AI 월요일만 (basic)
#   "full"   → 8개 AI 매일 (pro / biz / enterprise)
#
# guide_monthly  : 월 Claude Sonnet 가이드 생성 허용 횟수 (999 = 무제한)
# manual_scan_daily : 하루 수동 스캔 허용 횟수 (999 = 무제한)
# history_days   : 점수 히스토리 보관 일수 (999 = 무제한)
# businesses     : 등록 가능 사업장 수
# ──────────────────────────────────────────────────────────────────────────────
PLAN_LIMITS = {
    "free": {
        "competitors": 0,
        "guide_monthly": 0,
        "manual_scan_daily": 0,
        "auto_scan_mode": None,
        "schema": False, "pdf": False, "csv": False,
        "startup_report": False, "api_keys": False,
        "history_days": 0,
        "businesses": 1,
        "ad_defense": False,
    },
    "basic": {
        "competitors": 3,
        "guide_monthly": 2,
        "manual_scan_daily": 2,
        "auto_scan_mode": "basic",
        "schema": True, "pdf": False, "csv": False,
        "startup_report": False, "api_keys": False,
        "history_days": 30,
        "businesses": 1,
        "ad_defense": False,
    },
    "pro": {
        "competitors": 10,
        "guide_monthly": 10,
        "manual_scan_daily": 5,
        "auto_scan_mode": "full",
        "schema": True, "pdf": True, "csv": True,
        "startup_report": False, "api_keys": False,
        "history_days": 90,
        "businesses": 1,
        "ad_defense": True,
    },
    "biz": {
        "competitors": 999,
        "guide_monthly": 999,
        "manual_scan_daily": 999,
        "auto_scan_mode": "full",
        "schema": True, "pdf": True, "csv": True,
        "startup_report": True, "api_keys": True,
        "history_days": 999,
        "businesses": 5,
        "ad_defense": True,
    },
    "startup": {
        "competitors": 10,
        "guide_monthly": 5,
        "manual_scan_daily": 3,
        "auto_scan_mode": "full",
        "schema": True, "pdf": False, "csv": False,
        "startup_report": True, "api_keys": False,
        "history_days": 90,
        "businesses": 1,
        "ad_defense": False,
    },
    "enterprise": {
        "competitors": 999,
        "guide_monthly": 999,
        "manual_scan_daily": 999,
        "auto_scan_mode": "full",
        "schema": True, "pdf": True, "csv": True,
        "startup_report": True, "api_keys": True,
        "history_days": 999,
        "businesses": 20,
        "ad_defense": True,
    },
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


async def check_guide_limit(user_id: str, supabase) -> tuple[bool, int, int]:
    """월 가이드 생성 한도 체크 (guides → businesses → user_id 조인).

    Returns:
        (allowed, used_count, monthly_limit)
    """
    plan = await get_user_plan(user_id, supabase)
    limit = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["guide_monthly"]

    if limit >= 999:
        return True, 0, 999

    biz_rows = supabase.table("businesses").select("id").eq("user_id", user_id).execute().data
    if not biz_rows:
        return True, 0, limit  # 사업장 없음 → 한도 미적용

    biz_ids = [b["id"] for b in biz_rows]
    month_start = date.today().replace(day=1).isoformat()
    result = (
        supabase.table("guides")
        .select("id", count="exact")
        .in_("business_id", biz_ids)
        .gte("generated_at", month_start)
        .execute()
    )
    used = result.count or 0
    return used < limit, used, limit


async def check_manual_scan_limit(user_id: str, supabase) -> tuple[bool, int, int]:
    """하루 수동 스캔 한도 체크.

    Returns:
        (allowed, used_count, daily_limit)
    """
    plan = await get_user_plan(user_id, supabase)
    limit = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["manual_scan_daily"]

    if limit >= 999:
        return True, 0, 999

    today_str = date.today().isoformat()
    result = (
        supabase.table("scan_results")
        .select("id", count="exact")
        .eq("triggered_by", user_id)
        .gte("scanned_at", today_str)
        .execute()
    )
    used = result.count or 0
    return used < limit, used, limit


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
