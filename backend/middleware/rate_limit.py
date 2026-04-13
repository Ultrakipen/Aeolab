from fastapi import HTTPException
from datetime import date

# MONTHLY_LIMITS는 plan_gate.py의 PLAN_LIMITS에서 파생.
# manual_scan_daily × 22영업일 기준 상한을 참고값으로 사용하되,
# 실제 월 한도는 아래 _get_monthly_limit()에서 PLAN_LIMITS를 직접 조회한다.
# 독립적인 dict 유지 시 plan_gate.py와 불일치가 발생할 수 있으므로 단일 소스 원칙 적용.
# (plan_gate.py PLAN_LIMITS의 manual_scan_daily 기준값: free=0, basic=2, startup=3, pro=5, biz/enterprise=999)


def _get_monthly_limit(plan: str) -> int:
    """plan_gate.PLAN_LIMITS에서 월 스캔 한도 계산.

    manual_scan_daily × 22 공식으로 월 한도를 산출한다.
    999(무제한) 플랜은 그대로 999 반환.
    free 플랜은 check_manual_scan_limit에서 별도 처리하므로 여기선 0 반환.
    """
    from middleware.plan_gate import PLAN_LIMITS
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
    daily = limits.get("manual_scan_daily", 0)
    if daily >= 999:
        return 999
    if daily == 0:
        return 0
    # 월 영업일 22일 기준 상한
    return daily * 22


async def check_monthly_scan_limit(user_id: str, supabase, is_auto_scan: bool = False):
    """이번 달 스캔 횟수 확인 및 제한.

    is_auto_scan=True 이면 스케줄러 자동 스캔 — 월 한도 카운트에서 제외한다.
    자동 스캔은 플랜별로 횟수가 정해진 별도 동작이며, 수동 스캔 한도를 소모하지 않아야 한다.
    """
    if is_auto_scan:
        return  # 자동 스캔은 월 한도 체크 스킵

    from middleware.plan_gate import get_user_plan
    from db.supabase_client import execute as _exec

    plan = await get_user_plan(user_id, supabase)

    # free 플랜은 check_manual_scan_limit에서 첫 1회 허용 여부를 처리
    if plan == "free":
        return

    limit = _get_monthly_limit(plan)
    if limit == 0:
        return  # 예외 케이스 안전 처리

    month_start = date.today().replace(day=1)
    # scan_results has no user_id column — join via businesses
    biz_res = await _exec(
        supabase.table("businesses")
        .select("id")
        .eq("user_id", user_id)
    )
    biz_ids = [b["id"] for b in (biz_res.data or [])]
    if not biz_ids:
        return  # no businesses → no scans possible

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
