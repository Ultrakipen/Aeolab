import os
from fastapi import HTTPException
from datetime import date

# DEV_MODE=true 시 모든 스캔 월 한도 검사를 건너뜀.
_DEV_MODE = os.getenv("DEV_MODE", "").lower() in ("1", "true", "yes")

# MONTHLY_LIMITS는 plan_gate.py의 PLAN_LIMITS에서 파생.
# manual_scan_daily × 22영업일 기준 상한을 참고값으로 사용하되,
# 실제 월 한도는 아래 _get_monthly_limit()에서 PLAN_LIMITS를 직접 조회한다.
# (plan_gate.py PLAN_LIMITS의 manual_scan_daily 기준값: free=0, basic=2, startup=3, pro=5, biz=999)
#
# 플랜별 월 스캔 한도 명시 override (daily x 22 공식 우선순위 낮음)
# Pro: 30회/월, Biz: 50회/월 (2026-04-14 변경)
MONTHLY_SCAN_OVERRIDE = {
    "pro": 30,
    "biz": 50,
}


def _get_monthly_limit(plan: str) -> int:
    """plan_gate.PLAN_LIMITS에서 월 스캔 한도 계산.

    MONTHLY_SCAN_OVERRIDE에 플랜이 있으면 override 값을 우선 적용한다.
    없는 경우 manual_scan_daily x 22 공식으로 월 한도를 산출한다.
    999(무제한) 플랜은 그대로 999 반환.
    free 플랜은 check_manual_scan_limit에서 별도 처리하므로 여기선 0 반환.
    """
    if plan in MONTHLY_SCAN_OVERRIDE:
        return MONTHLY_SCAN_OVERRIDE[plan]

    from middleware.plan_gate import PLAN_LIMITS
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
    daily = limits.get("manual_scan_daily", 0)
    if daily >= 999:
        return 999
    if daily == 0:
        return 0
    return daily * 22


async def check_monthly_scan_limit(user_id: str, supabase, is_auto_scan: bool = False):
    """이번 달 스캔 횟수 확인 및 제한.

    is_auto_scan=True 이면 스케줄러 자동 스캔 — 월 한도 카운트에서 제외한다.
    자동 스캔은 플랜별로 횟수가 정해진 별도 동작이며, 수동 스캔 한도를 소모하지 않아야 한다.
    """
    if is_auto_scan or _DEV_MODE:
        return

    from middleware.plan_gate import get_user_plan
    from db.supabase_client import execute as _exec

    plan = await get_user_plan(user_id, supabase)

    if plan == "free":
        return

    limit = _get_monthly_limit(plan)
    if limit == 0:
        return

    month_start = date.today().replace(day=1)
    biz_res = await _exec(
        supabase.table("businesses")
        .select("id")
        .eq("user_id", user_id)
    )
    biz_ids = [b["id"] for b in (biz_res.data or [])]
    if not biz_ids:
        return

    scans = await _exec(
        supabase.table("scan_results")
        .select("id", count="exact")
        .in_("business_id", biz_ids)
        .gte("scanned_at", str(month_start))
    )
    used = scans.count or 0

    if used >= limit:
        next_month = date.today().replace(day=1)
        if next_month.month == 12:
            reset_date = next_month.replace(year=next_month.year + 1, month=1)
        else:
            reset_date = next_month.replace(month=next_month.month + 1)

        raise HTTPException(
            status_code=429,
            detail={
                "code": "SCAN_LIMIT",
                "used": used,
                "limit": limit,
                "reset_date": str(reset_date),
                "upgrade_url": "/pricing",
            },
        )
