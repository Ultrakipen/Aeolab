import logging
import os
import secrets
import statistics
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Header, Query
from db.supabase_client import get_client, execute
from config.prices import PLAN_PRICE_MAP
from services.score_engine import BRIEFING_ACTIVE_CATEGORIES, BRIEFING_LIKELY_CATEGORIES

_logger = logging.getLogger("aeolab")

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
    """구독자 MRR BEP 현황 통계 플랜별 포함"""
    supabase = get_supabase()

    subs = (await execute(supabase.table("subscriptions").select("plan, status, user_id").limit(5000))).data
    total = len(subs)
    active = [s for s in subs if s["status"] in ("active", "grace_period")]

    plan_distribution: dict = {}
    for s in active:
        plan_distribution[s["plan"]] = plan_distribution.get(s["plan"], 0) + 1

    mrr = sum(plan_distribution.get(p, 0) * PLAN_PRICE_MAP.get(p, 0) for p in PLAN_PRICE_MAP)

    today = str(date.today())
    month_start = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

    today_scans = await execute(
        supabase.table("scan_results").select("id", count="exact").gte("scanned_at", today)
    )
    month_scans = await execute(
        supabase.table("scan_results").select("id", count="exact").gte("scanned_at", month_start)
    )
    waitlist = await execute(supabase.table("waitlist").select("id", count="exact"))
    basic_trial_used = await execute(
        supabase.table("profiles").select("user_id", count="exact").eq("basic_trial_used", True)
    )

    # 플랜별 이번 달 스캔 수
    user_plan_map = {s["user_id"]: s["plan"] for s in active if s.get("user_id")}
    plan_scan_counts = {p: 0 for p in PLAN_PRICE_MAP}
    if user_plan_map:
        biz_rows = (await execute(
            supabase.table("businesses").select("id, user_id").in_("user_id", list(user_plan_map.keys()))
        )).data or []
        biz_plan_map = {b["id"]: user_plan_map.get(b["user_id"]) for b in biz_rows}
        if biz_plan_map:
            scan_rows = (await execute(
                supabase.table("scan_results").select("business_id")
                .gte("scanned_at", month_start).in_("business_id", list(biz_plan_map.keys()))
            )).data or []
            for sr in scan_rows:
                p = biz_plan_map.get(sr["business_id"])
                if p and p in plan_scan_counts:
                    plan_scan_counts[p] += 1

    plan_stats = {
        plan: {
            "subscribers": plan_distribution.get(plan, 0),
            "mrr": plan_distribution.get(plan, 0) * price,
            "scan_month": plan_scan_counts.get(plan, 0),
            "price": price,
        }
        for plan, price in PLAN_PRICE_MAP.items()
    }

    return {
        "total_subscribers": total,
        "active_subscribers": len(active),
        "mrr": mrr,
        "bep_progress": round((len(active) / 20) * 100, 1),
        "plan_distribution": plan_distribution,
        "plan_stats": plan_stats,
        "scan_count_today": today_scans.count or 0,
        "scan_count_month": month_scans.count or 0,
        "waitlist_count": waitlist.count or 0,
        "basic_trial_used_count": basic_trial_used.count or 0,
    }


@router.get("/subscriptions")
async def list_subscriptions(plan: str = None, status: str = "active", _=Depends(verify_admin)):
    """구독자 목록"""
    supabase = get_supabase()
    query = supabase.table("subscriptions").select("id, user_id, plan, status, start_at, end_at, grace_until, customer_key")
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
    monthly: dict = {}
    for row in rows:
        if not row.get("start_at"):
            continue
        month = row["start_at"][:7]  # "YYYY-MM"
        if month not in monthly:
            monthly[month] = {"revenue": 0, "subscriber_count": 0}
        monthly[month]["revenue"] += PLAN_PRICE_MAP.get(row["plan"], 0)
        monthly[month]["subscriber_count"] += 1

    return [
        {"month": m, "revenue": v["revenue"], "subscriber_count": v["subscriber_count"]}
        for m, v in sorted(monthly.items())[-12:]
    ]


@router.get("/category-distribution")
async def get_category_distribution(_=Depends(verify_admin)):
    """가입자 사업장의 ACTIVE/LIKELY/INACTIVE 업종 그룹 분포 (P2-4 신설).

    AI 브리핑 게이팅 기준(score_engine.BRIEFING_ACTIVE/LIKELY_CATEGORIES)으로 분류해
    INACTIVE 비율이 큰 경우 UX 우선순위 조정의 근거로 사용.
    """
    supabase = get_supabase()
    rows = (
        await execute(
            supabase.table("businesses").select("id, category")
        )
    ).data or []

    ACTIVE = set(BRIEFING_ACTIVE_CATEGORIES)
    LIKELY = set(BRIEFING_LIKELY_CATEGORIES)

    groups: dict[str, int] = {"active": 0, "likely": 0, "inactive": 0}
    per_category: dict[str, int] = {}
    for r in rows:
        cat = (r.get("category") or "").lower().strip()
        per_category[cat] = per_category.get(cat, 0) + 1
        if cat in ACTIVE:
            groups["active"] += 1
        elif cat in LIKELY:
            groups["likely"] += 1
        else:
            groups["inactive"] += 1

    total = len(rows)
    return {
        "total": total,
        "groups": groups,
        "ratios": {
            "active": round(groups["active"] / total * 100, 1) if total else 0,
            "likely": round(groups["likely"] / total * 100, 1) if total else 0,
            "inactive": round(groups["inactive"] / total * 100, 1) if total else 0,
        },
        "per_category": dict(sorted(per_category.items(), key=lambda x: -x[1])),
    }


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
            except Exception as e:
                _logger.warning("kakao broadcast failed phone=%s: %s", f"{str(phone)[:3]}****{str(phone)[-2:]}", e)
    return {"sent": sent}


# ────────────────────────────────────────────────────────────────
# v3.0 vs v3.1 점수 비교 — Admin 활성화 의사결정 지원 API
# Rate limit: 1분당 10회 (무거운 집계 쿼리 방지)
# ────────────────────────────────────────────────────────────────
_score_cmp_request_times: list = []


def _check_score_cmp_rate_limit() -> None:
    """Admin 점수 비교 엔드포인트 1분당 10회 제한."""
    import time
    now = time.time()
    _score_cmp_request_times[:] = [t for t in _score_cmp_request_times if now - t < 60]
    if len(_score_cmp_request_times) >= 10:
        raise HTTPException(status_code=429, detail="1분당 최대 10회 요청 가능합니다")
    _score_cmp_request_times.append(now)


@router.get("/score-comparison")
async def get_score_comparison(
    days: int = Query(30, ge=7, le=90, description="최근 N일 데이터 기간"),
    _: None = Depends(verify_admin),
):
    """v3.0 vs v3.1 점수 비교 데이터 — v3.1 활성화 의사결정 지원.

    scan_results에서 최근 N일치 + track1_score_v31 IS NOT NULL 데이터를
    그룹별로 집계하여 점수 변동폭·이상치·안전 진단 결과를 반환합니다.

    안전 진단 기준:
      GREEN  — 모든 그룹 diff_avg ≤ 5점, 이상치 비율 < 10%
      YELLOW — 일부 그룹 5 < diff_avg ≤ 10, 또는 이상치 10~20%
      RED    — 어느 그룹이든 diff_avg > 10, 또는 이상치 > 20%

    Returns:
        {
            "total_scans": int,
            "shadow_scans": int,        # v31 데이터 존재 건수
            "period_days": int,
            "groups": {
                "ACTIVE": {"count", "v30_avg", "v31_avg", "diff_avg", "diff_stddev"},
                "LIKELY": {...},
                "INACTIVE": {...},
            },
            "outliers": [{biz_id, category, user_group_v31, v30, v31, diff}],
            "scatter": [{v30, v31, user_group}],    # max 200건
            "safety_diagnosis": "green"|"yellow"|"red",
            "diagnosis_reason": str,
        }
    """
    _check_score_cmp_rate_limit()
    supabase = get_supabase()

    cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()

    # shadow 데이터 존재 행만 조회 (v31 컬럼 NULL 제외)
    _res = await execute(
        supabase.table("scan_results")
        .select(
            "id, business_id, unified_score, track1_score, "
            "track1_score_v31, unified_score_v31, user_group_v31, "
            "scanned_at, businesses(category, name)"
        )
        .gte("scanned_at", cutoff)
        .not_.is_("unified_score_v31", "null")
        .order("scanned_at", desc=True)
        .limit(2000)
    )
    rows = _res.data or []

    if not rows:
        return {
            "total_scans": 0,
            "shadow_scans": 0,
            "period_days": days,
            "groups": {},
            "outliers": [],
            "scatter": [],
            "safety_diagnosis": "green",
            "diagnosis_reason": "Shadow 데이터 없음 — v3.1 비교 데이터 누적 대기 중",
        }

    # 전체 기간 스캔 수 (v31 유무 무관)
    _total_res = await execute(
        supabase.table("scan_results")
        .select("id", count="exact")
        .gte("scanned_at", cutoff)
    )
    total_scans = _total_res.count or len(rows)

    # 그룹별 집계
    group_data: dict[str, list[dict]] = {"ACTIVE": [], "LIKELY": [], "INACTIVE": []}
    all_outliers = []
    scatter_items = []

    for row in rows:
        v30 = float(row.get("unified_score") or 0)
        v31 = float(row.get("unified_score_v31") or 0)
        grp = (row.get("user_group_v31") or "INACTIVE").upper()
        if grp not in group_data:
            grp = "INACTIVE"

        diff = v31 - v30
        biz_info = row.get("businesses") or {}
        category = biz_info.get("category") or ""

        item = {"v30": v30, "v31": v31, "diff": round(diff, 2)}
        group_data[grp].append(item)

        # 이상치: 차이 절대값 20점 이상
        if abs(diff) >= 20:
            all_outliers.append({
                "biz_id": row.get("business_id"),
                "biz_name": biz_info.get("name") or "",
                "category": category,
                "user_group_v31": grp,
                "v30": round(v30, 1),
                "v31": round(v31, 1),
                "diff": round(diff, 2),
            })

        # 산점도 데이터 (최대 200건)
        if len(scatter_items) < 200:
            scatter_items.append({"v30": round(v30, 1), "v31": round(v31, 1), "user_group": grp})

    # 그룹별 통계
    groups_result: dict = {}
    all_diff_avgs: list[float] = []
    for grp, items in group_data.items():
        if not items:
            groups_result[grp] = {
                "count": 0,
                "v30_avg": None,
                "v31_avg": None,
                "diff_avg": None,
                "diff_stddev": None,
            }
            continue
        diffs = [it["diff"] for it in items]
        v30s  = [it["v30"] for it in items]
        v31s  = [it["v31"] for it in items]
        diff_avg = statistics.mean(diffs)
        diff_std = statistics.stdev(diffs) if len(diffs) > 1 else 0.0
        all_diff_avgs.append(abs(diff_avg))
        groups_result[grp] = {
            "count": len(items),
            "v30_avg": round(statistics.mean(v30s), 2),
            "v31_avg": round(statistics.mean(v31s), 2),
            "diff_avg": round(diff_avg, 2),
            "diff_stddev": round(diff_std, 2),
        }

    # 안전 진단
    outlier_ratio = len(all_outliers) / max(len(rows), 1)
    max_diff_avg = max(all_diff_avgs) if all_diff_avgs else 0.0

    if max_diff_avg > 10 or outlier_ratio > 0.20:
        safety = "red"
        reason = (
            f"주의: diff_avg 최대 {max_diff_avg:.1f}점, 이상치 비율 {outlier_ratio*100:.1f}% — "
            "활성화 전 그룹별 원인 분석 필요"
        )
    elif max_diff_avg > 5 or outlier_ratio > 0.10:
        safety = "yellow"
        reason = (
            f"검토 권장: diff_avg 최대 {max_diff_avg:.1f}점, 이상치 비율 {outlier_ratio*100:.1f}% — "
            "이상치 사업장 개별 확인 후 활성화 권장"
        )
    else:
        safety = "green"
        reason = (
            f"활성화 안전: diff_avg 최대 {max_diff_avg:.1f}점, 이상치 비율 {outlier_ratio*100:.1f}% — "
            "v3.1 활성화 시 점수 변동이 예측 범위 내"
        )

    return {
        "total_scans": total_scans,
        "shadow_scans": len(rows),
        "period_days": days,
        "groups": groups_result,
        "outliers": all_outliers[:50],     # 최대 50건
        "scatter": scatter_items,
        "safety_diagnosis": safety,
        "diagnosis_reason": reason,
    }
