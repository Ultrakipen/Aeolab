from fastapi import HTTPException
from datetime import date

MONTHLY_LIMITS = {"free": 3, "basic": 10, "pro": 999, "biz": 999, "startup": 10, "enterprise": 999}


async def check_monthly_scan_limit(user_id: str, supabase):
    """이번 달 스캔 횟수 확인 및 제한"""
    from middleware.plan_gate import get_user_plan

    plan = await get_user_plan(user_id, supabase)
    limit = MONTHLY_LIMITS.get(plan, 3)

    month_start = date.today().replace(day=1)
    # scan_results has no user_id column — join via businesses
    biz_ids = [
        b["id"]
        for b in (
            supabase.table("businesses")
            .select("id")
            .eq("user_id", user_id)
            .execute()
            .data or []
        )
    ]
    if not biz_ids:
        return  # no businesses → no scans possible

    scans = (
        supabase.table("scan_results")
        .select("id", count="exact")
        .in_("business_id", biz_ids)
        .gte("scanned_at", str(month_start))
        .execute()
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
