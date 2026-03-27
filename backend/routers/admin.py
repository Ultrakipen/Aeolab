from fastapi import APIRouter, Depends, HTTPException, Header
from db.supabase_client import get_client, execute
from datetime import date, datetime, timedelta
import os
import secrets

router = APIRouter()


def verify_admin(x_admin_key: str = Header(None)):
    secret = os.getenv("ADMIN_SECRET_KEY")
    if not secret:
        raise HTTPException(status_code=503, detail="관리자 키가 설정되지 않았습니다")
    if not x_admin_key or not secrets.compare_digest(x_admin_key, secret):
        raise HTTPException(status_code=403, detail="관리자 전용")


def get_supabase():
    return get_client()


@router.get("/stats")
async def get_stats(_=Depends(verify_admin)):
    """구독자·MRR·BEP 현황 통계"""
    supabase = get_supabase()

    subs = (await execute(supabase.table("subscriptions").select("plan, status"))).data
    total = len(subs)
    active = [s for s in subs if s["status"] in ("active", "grace_period")]

    plan_distribution: dict = {}
    for s in active:
        plan_distribution[s["plan"]] = plan_distribution.get(s["plan"], 0) + 1

    plan_price = {"basic": 9900, "pro": 29900, "biz": 79900, "startup": 39900, "enterprise": 200000}
    mrr = sum(plan_distribution.get(p, 0) * plan_price.get(p, 0) for p in plan_price)

    today = str(date.today())
    month_start = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

    today_scans = await execute(
        supabase.table("scan_results")
        .select("id", count="exact")
        .gte("scanned_at", today)
    )
    month_scans = await execute(
        supabase.table("scan_results")
        .select("id", count="exact")
        .gte("scanned_at", month_start)
    )
    waitlist = await execute(
        supabase.table("waitlist")
        .select("id", count="exact")
    )

    return {
        "total_subscribers": total,
        "active_subscribers": len(active),
        "mrr": mrr,
        "bep_progress": round((len(active) / 20) * 100, 1),
        "plan_distribution": plan_distribution,
        "scan_count_today": today_scans.count or 0,
        "scan_count_month": month_scans.count or 0,
        "waitlist_count": waitlist.count or 0,
    }


@router.get("/subscriptions")
async def list_subscriptions(plan: str = None, status: str = "active", _=Depends(verify_admin)):
    """구독자 목록"""
    supabase = get_supabase()
    query = supabase.table("subscriptions").select("*")
    if status:
        query = query.eq("status", status)
    if plan:
        query = query.eq("plan", plan)
    rows = (await execute(query.order("start_at", desc=True))).data

    # 이메일은 auth.users 조인이 서비스 롤로만 가능 — user_id로 대체
    return rows


@router.get("/revenue")
async def get_revenue(_=Depends(verify_admin)):
    """월별 매출 추이 (최근 12개월)"""
    supabase = get_supabase()
    rows = (
        await execute(
            supabase.table("subscriptions")
            .select("plan, status, start_at")
            .in_("status", ["active", "grace_period", "cancelled", "expired"])
        )
    ).data
    plan_price = {"basic": 9900, "pro": 29900, "biz": 79900, "startup": 39900, "enterprise": 200000}
    monthly: dict = {}
    for row in rows:
        if not row.get("start_at"):
            continue
        month = row["start_at"][:7]  # "YYYY-MM"
        if month not in monthly:
            monthly[month] = {"revenue": 0, "subscriber_count": 0}
        monthly[month]["revenue"] += plan_price.get(row["plan"], 0)
        monthly[month]["subscriber_count"] += 1

    return [
        {"month": m, "revenue": v["revenue"], "subscriber_count": v["subscriber_count"]}
        for m, v in sorted(monthly.items())[-12:]
    ]


@router.get("/scan-logs")
async def get_scan_logs(limit: int = 50, _=Depends(verify_admin)):
    supabase = get_supabase()
    return (
        await execute(
            supabase.table("scan_results")
            .select("id, business_id, scanned_at, total_score, query_used, businesses(name)")
            .order("scanned_at", desc=True)
            .limit(limit)
        )
    ).data


@router.post("/broadcast")
async def broadcast_kakao(message: str, _=Depends(verify_admin)):
    """전체 활성 구독자에게 카카오 공지 발송 (profiles.phone 기준)"""
    supabase = get_supabase()
    from services.kakao_notify import KakaoNotifier

    # 활성 구독자의 profiles.phone 조회
    active_subs = (
        await execute(
            supabase.table("subscriptions")
            .select("user_id, profiles(phone)")
            .eq("status", "active")
        )
    ).data or []
    notifier = KakaoNotifier()
    sent = 0
    for sub in active_subs:
        phone = (sub.get("profiles") or {}).get("phone")
        if phone:
            try:
                await notifier.send_notice(phone, message)
                sent += 1
            except Exception:
                pass
    return {"sent": sent}
