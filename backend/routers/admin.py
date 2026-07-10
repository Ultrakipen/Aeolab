import asyncio
import logging
import os
import secrets
import statistics
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Header, Query
from fastapi.responses import HTMLResponse
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


@router.post("/subscriptions/{user_id}/cancel")
async def admin_cancel_subscription(user_id: str, _=Depends(verify_admin)):
    """관리자 강제 구독 해지/환불 — 고객지원 요청 시 사용 (금전 이동 가능).

    _cancel_subscription_core는 settings.py의 본인 해지(POST /settings/cancel)와
    동일한 함수 — 경쟁조건 방어·DB 갱신 실패 시 운영자 알림·7일 청약철회 자동환불 분기
    안전장치를 전부 그대로 공유한다(admin_functional_gaps_implementation_plan_v1.0.md §5).
    별도로 재구현하지 않는다 — 안전장치 누락 재발 방지(2026-06-02 CLAUDE.md 사고 참조).
    """
    from routers.settings import _cancel_subscription_core

    return await _cancel_subscription_core(user_id)


@router.get("/subscriptions")
async def list_subscriptions(
    plan: str = None,
    status: str = None,
    email: str = None,
    _=Depends(verify_admin),
):
    """구독자 목록 (검색/필터 지원).

    status 생략 시 전체 상태(active/cancelled/expired/grace_period/suspended) 조회.
    email 지정 시 부분 일치 검색 — auth.users(email)는 postgrest 조인 대상이 아니므로
    (profiles.email 컬럼은 2026-07-10 기준 라이브 DB에 존재하나 전량 NULL — 가입 트리거가
    채우지 않음) Supabase Auth Admin API로 별도 조회 후 파이썬에서 merge한다.
    subscriptions↔profiles FK 미등록으로 인한 PGRST200 위험(embedded join 함정)도
    이 방식으로 원천 회피된다.
    """
    supabase = get_supabase()
    query = supabase.table("subscriptions").select(
        "id, user_id, plan, status, start_at, end_at, grace_until, customer_key"
    )
    if status:
        query = query.eq("status", status)
    if plan:
        query = query.eq("plan", plan)
    rows = (await execute(query.order("start_at", desc=True))).data or []

    if not rows:
        return rows

    # auth.users에서 이메일 일괄 조회 (최대 1000명 — BEP 20명·목표 100명 규모에서 충분)
    email_map: dict = {}
    try:
        users = await asyncio.to_thread(
            lambda: supabase.auth.admin.list_users(page=1, per_page=1000)
        )
        email_map = {u.id: u.email for u in users}
    except Exception as e:
        _logger.warning(f"[admin] 구독자 이메일 조회 실패(auth.admin.list_users): {e}")

    for row in rows:
        row["email"] = email_map.get(row.get("user_id"))

    if email:
        needle = email.strip().lower()
        rows = [r for r in rows if needle in (r.get("email") or "").lower()]

    return rows


@router.get("/businesses")
async def search_businesses(q: str = None, _=Depends(verify_admin)):
    """사업장 검색(이름 또는 소유자 이메일) — 고객지원용 통합 조회 P0.

    admin_service_oversight_design_v1.0.md §3(P0). 지금까지는 사용자가 문의
    티켓을 남긴 경우에만 support.py 경유로 사업장을 볼 수 있었다 — 임의 사업장을
    직접 검색하는 화면이 없었다. list_subscriptions와 동일하게 auth.admin
    list_users로 이메일을 merge(embedded join 위험 회피).
    """
    supabase = get_supabase()
    rows = (
        await execute(
            supabase.table("businesses")
            .select("id, user_id, name, category, region, is_active, created_at")
            .order("created_at", desc=True)
            .limit(500)  # list_users(per_page=1000)와 동일한 규모 상한 — 드리프트 방지 안전장치
        )
    ).data or []
    if not rows:
        return rows

    email_map: dict = {}
    try:
        users = await asyncio.to_thread(
            lambda: supabase.auth.admin.list_users(page=1, per_page=1000)
        )
        email_map = {u.id: u.email for u in users}
    except Exception as e:
        _logger.warning(f"[admin] 사업장 검색 이메일 조회 실패: {e}")

    for row in rows:
        row["owner_email"] = email_map.get(row.get("user_id"))

    if q:
        needle = q.strip().lower()
        rows = [
            r for r in rows
            if needle in (r.get("name") or "").lower() or needle in (r.get("owner_email") or "").lower()
        ]

    return rows


@router.get("/businesses/{business_id}")
async def get_business_detail(business_id: str, _=Depends(verify_admin)):
    """사업장 상세 — 스캔이력·가이드이력·경쟁사 통합 (P0).

    support.py admin_get_ticket에서 만든 businesses+scan_results dict-merge
    패턴을 독립 엔드포인트로 승격 — 문의 티켓 없이도 임의 사업장을 조회 가능.
    """
    supabase = get_supabase()
    biz_res = await execute(
        supabase.table("businesses")
        .select("id, user_id, name, category, region, is_active, created_at")
        .eq("id", business_id)
        .maybe_single()
    )
    if not (biz_res and biz_res.data):
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")
    biz = biz_res.data

    owner_email = None
    try:
        auth_resp = await asyncio.to_thread(
            lambda: supabase.auth.admin.get_user_by_id(biz["user_id"])
        )
        if auth_resp and auth_resp.user:
            owner_email = auth_resp.user.email
    except Exception as e:
        _logger.warning(f"[admin] 사업장 상세 이메일 조회 실패: {e}")

    scans_res = await execute(
        supabase.table("scan_results")
        .select("id, scanned_at, total_score, track1_score, track2_score, unified_score")
        .eq("business_id", business_id)
        .order("scanned_at", desc=True)
        .limit(10)
    )
    guides_res = await execute(
        supabase.table("guides")
        .select("id, generated_at, summary, context")
        .eq("business_id", business_id)
        .order("generated_at", desc=True)
        .limit(10)
    )
    competitors_res = await execute(
        supabase.table("competitors")
        .select("id, name, address, is_active")
        .eq("business_id", business_id)
        .eq("is_active", True)
    )

    return {
        "business": biz,
        "owner_email": owner_email,
        "scans": scans_res.data or [],
        "guides": guides_res.data or [],
        "competitors": competitors_res.data or [],
    }


@router.get("/audit-log")
async def get_audit_log(limit: int = Query(100, ge=1, le=500), _=Depends(verify_admin)):
    """관리자 액션 감사 로그 조회 (§3-A-E). admin_audit_log는 AdminAuditMiddleware가
    POST/PATCH/DELETE 관리자 요청마다 자동 기록 — 이 엔드포인트는 조회 전용."""
    supabase = get_supabase()
    rows = (
        await execute(
            supabase.table("admin_audit_log")
            .select("id, admin_email, method, path, status_code, body_snippet, created_at")
            .order("created_at", desc=True)
            .limit(limit)
        )
    ).data or []
    return rows


@router.get("/system-alerts")
async def get_system_alerts(limit: int = Query(100, ge=1, le=500), _=Depends(verify_admin)):
    """운영 알림 이력 조회 (§3-A-F). send_operator_alert/send_slack_alert 호출 시
    utils.system_alert_log.record_alert가 자동 기록 — 이 엔드포인트는 조회 전용."""
    supabase = get_supabase()
    rows = (
        await execute(
            supabase.table("system_alerts")
            .select("id, subject, message, level, source, created_at")
            .order("created_at", desc=True)
            .limit(limit)
        )
    ).data or []
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
    """전체 활성 구독자에게 카카오 공지 발송 (profiles.phone 기준).

    subscriptions↔profiles FK 미등록(jobs.py 전역 6곳에 문서화된 기존 P0 클래스,
    2026-07-07 사고)으로 embedded join(profiles(phone))은 매 호출 PGRST200으로
    실패한다 — 분리 조회 후 dict merge로 교체.
    """
    supabase = get_supabase()
    from services.kakao_notify import KakaoNotifier

    active_subs = (
        await execute(
            supabase.table("subscriptions").select("user_id").eq("status", "active")
        )
    ).data or []
    user_ids = [s["user_id"] for s in active_subs if s.get("user_id")]
    phone_map: dict = {}
    if user_ids:
        prof_rows = (
            await execute(
                supabase.table("profiles").select("user_id, phone").in_("user_id", user_ids)
            )
        ).data or []
        phone_map = {p["user_id"]: p.get("phone") for p in prof_rows}

    notifier = KakaoNotifier()
    sent = 0
    for uid in user_ids:
        phone = phone_map.get(uid)
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


# ────────────────────────────────────────────────────────────────
# D.I.A. 점수 분포 — 가이드 품질 모니터링
# ────────────────────────────────────────────────────────────────

@router.get("/dia-stats")
async def get_dia_stats(
    days: int = Query(30, ge=1, le=90, description="최근 N일 데이터 기간"),
    _: None = Depends(verify_admin),
):
    """D.I.A. 품질 점수 분포 — 가이드 생성 품질 모니터링.

    guides.tools_json 내 dia_score 필드(JSONB)를 집계합니다.
    DB에 dia_score 데이터가 없으면 count=0으로 반환 (에러 없음).

    Returns:
        {
            "period_days": int,
            "total_guides": int,          # dia_score 있는 가이드 수
            "bins": [
                {"range": "90-100", "count": N},
                {"range": "70-89",  "count": N},
                {"range": "<70",    "count": N},
            ],
            "avg_score": float | null,
            "regenerated_count": int,     # dia_regenerated >= 1인 가이드 수
            "regenerated_success_rate": float | null,  # 재생성 후 70점+ 비율
        }
    """
    supabase = get_supabase()
    since = (datetime.now() - timedelta(days=days)).isoformat()

    try:
        rows = (
            await execute(
                supabase.table("guides")
                .select("tools_json, generated_at")
                .gte("generated_at", since)
                .limit(2000)
            )
        ).data or []
    except Exception as e:
        _logger.warning("dia-stats: guides 조회 실패 — %s", e)
        rows = []

    scores: list[float] = []
    regenerated_total = 0
    regenerated_success = 0

    for row in rows:
        tools = row.get("tools_json") or {}
        raw_score = tools.get("dia_score")
        if raw_score is None:
            continue
        try:
            score = float(raw_score)
        except (TypeError, ValueError):
            continue
        scores.append(score)

        regen = tools.get("dia_regenerated", 0)
        try:
            regen_int = int(regen)
        except (TypeError, ValueError):
            regen_int = 0
        if regen_int >= 1:
            regenerated_total += 1
            if score >= 70:
                regenerated_success += 1

    total = len(scores)
    bins = [
        {"range": "90-100", "count": sum(1 for s in scores if s >= 90)},
        {"range": "70-89",  "count": sum(1 for s in scores if 70 <= s < 90)},
        {"range": "<70",    "count": sum(1 for s in scores if s < 70)},
    ]
    avg_score = round(sum(scores) / total, 1) if total > 0 else None
    regen_success_rate = (
        round(regenerated_success / regenerated_total * 100, 1)
        if regenerated_total > 0 else None
    )

    return {
        "period_days": days,
        "total_guides": total,
        "bins": bins,
        "avg_score": avg_score,
        "regenerated_count": regenerated_total,
        "regenerated_success_rate": regen_success_rate,
    }


# ────────────────────────────────────────────────────────────────
# AI 비용/사용량 모니터링 (§3-A P1) — CLAUDE.md의 API 비용 수치가 전부
# "추정치"였던 것을 실측으로 보완. 정확한 토큰·원화 비용까지는 범위 밖(별도
# 과제로 분리) — 채널별 "실행 횟수" 집계까지만. DB 변경 없음(전부 기존 테이블).
# ────────────────────────────────────────────────────────────────

@router.get("/ai-usage")
async def get_ai_usage(
    days: int = Query(30, ge=1, le=90, description="집계 기간(일)"),
    _: None = Depends(verify_admin),
):
    """기간별 AI 채널 실행 횟수 + Claude 호출량(가이드·어시스턴트).

    scan_results의 각 *_result 컬럼 not null 여부로 "그 스캔에 해당 채널이
    포함됐는지"를 센다 — 스캔 1건이 내부적으로 Gemini/ChatGPT를 50~100회
    샘플링하므로 이 수치는 API 콜 수가 아니라 "채널이 실행된 스캔 세션 수"다.
    """
    supabase = get_supabase()
    cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()

    total_scans = await execute(
        supabase.table("scan_results").select("id", count="exact").gte("scanned_at", cutoff)
    )
    gemini_scans = await execute(
        supabase.table("scan_results").select("id", count="exact")
        .gte("scanned_at", cutoff).not_.is_("gemini_result", "null")
    )
    chatgpt_scans = await execute(
        supabase.table("scan_results").select("id", count="exact")
        .gte("scanned_at", cutoff).not_.is_("chatgpt_result", "null")
    )
    naver_scans = await execute(
        supabase.table("scan_results").select("id", count="exact")
        .gte("scanned_at", cutoff).not_.is_("naver_result", "null")
    )
    google_scans = await execute(
        supabase.table("scan_results").select("id", count="exact")
        .gte("scanned_at", cutoff).not_.is_("google_result", "null")
    )

    guide_rows = (
        await execute(
            supabase.table("guides").select("context")
            .gte("generated_at", cutoff)
            .limit(5000)
        )
    ).data or []
    guide_by_context: dict = {}
    for g in guide_rows:
        ctx = g.get("context") or "unknown"
        guide_by_context[ctx] = guide_by_context.get(ctx, 0) + 1

    assistant_count = await execute(
        supabase.table("assistant_logs").select("id", count="exact").gte("created_at", cutoff)
    )

    return {
        "period_days": days,
        "scan_counts": {
            "total_scans": total_scans.count or 0,
            "gemini": gemini_scans.count or 0,
            "chatgpt": chatgpt_scans.count or 0,
            "naver": naver_scans.count or 0,
            "google": google_scans.count or 0,
        },
        "guide_generation_count": len(guide_rows),
        "guide_by_context": guide_by_context,
        "assistant_chat_count": assistant_count.count or 0,
    }


# ─── 이메일 미리보기 / 테스트 발송 ────────────────────────────────────────────

_EMAIL_DUMMY = {
    "business_name": "대호흑돼지",
    "category": "restaurant",
    "region": "서울 마포구",
    "score": 38.0,
    "track1_score": 32.0,
    "track2_score": 28.0,
    "ai_mentioned": False,
    "has_intro": True,
    "has_recent_post": False,
    "naver_rank": 8,
    "blog_mentions": 7,
    "top_missing_keywords": ["맛집", "회식"],
    "top_competitor_name": "황금돼지집",
    "top_competitor_blog_count": 23,
    "smart_place_completeness": 48.0,
    "growth_stage": "growth",
    "kakao_rank": None,
    "is_on_kakao": True,
    "is_smart_place": True,
    "grade": "D",
}


def _verify_admin_key(key: str) -> None:
    secret = os.getenv("ADMIN_SECRET_KEY", "")
    if not secret or not key or not secrets.compare_digest(key, secret):
        raise HTTPException(status_code=403, detail="관리자 전용")


@router.get(
    "/email-preview/{email_type}",
    response_class=HTMLResponse,
    summary="이메일 HTML 미리보기 (브라우저 직접 열기)",
    tags=["admin"],
)
async def email_preview(
    email_type: str,
    key: str = Query(..., description="ADMIN_SECRET_KEY"),
    name: str = Query("대호흑돼지", description="사업장명"),
):
    """브라우저 주소창에서 이메일 HTML을 직접 확인합니다.

    email_type: day1 | day3 | day7 | claim | welcome

    예시:
      https://aeolab.co.kr/admin/email-preview/day1?key=SECRET&name=내가게
    """
    _verify_admin_key(key)

    from services.email_sender import _day1_html, _day3_html, _day7_html

    d = dict(_EMAIL_DUMMY)
    d["business_name"] = name

    if email_type == "day1":
        _, html = _day1_html(
            business_name=d["business_name"], category=d["category"],
            score=d["score"], ai_mentioned=d["ai_mentioned"],
            has_intro=d["has_intro"], has_recent_post=d["has_recent_post"],
            naver_rank=d["naver_rank"], top_missing_keywords=d["top_missing_keywords"],
            growth_stage=d["growth_stage"],
        )
    elif email_type == "day3":
        _, html = _day3_html(
            business_name=d["business_name"], category=d["category"],
            score=d["score"], track1_score=d["track1_score"],
            track2_score=d["track2_score"], has_intro=d["has_intro"],
            has_recent_post=d["has_recent_post"],
            smart_place_completeness=d["smart_place_completeness"],
            ai_mentioned=d["ai_mentioned"], blog_mentions=d["blog_mentions"],
            top_competitor_name=d["top_competitor_name"],
            top_missing_keywords=d["top_missing_keywords"],
        )
    elif email_type == "day7":
        _, html = _day7_html(
            business_name=d["business_name"], category=d["category"],
            ai_mentioned=d["ai_mentioned"], has_intro=d["has_intro"],
            has_recent_post=d["has_recent_post"],
        )
    elif email_type == "claim":
        # claim 이메일 (즉시 발송) — 매직 링크 포함 레이아웃 재현
        from services.email_sender import _score_label, _score_color, _CATEGORY_KO
        score = float(d["score"])
        cat_ko = _CATEGORY_KO.get(d["category"], "사업장")
        dummy_link = "https://aeolab.co.kr/signup?preview=1"
        html = f"""<div style="background:#fef9c3;padding:10px 16px;font-size:13px;text-align:center;border-bottom:1px solid #fde047;">⚠️ 미리보기 — 실제 발송 시 24시간 유효 매직 링크 포함</div>
<div style="font-family:'Apple SD Gothic Neo',Malgun Gothic,sans-serif;max-width:560px;margin:0 auto;padding:0 0 32px;color:#1e293b;background:#f8fafc;">
  <div style="background:#1d4ed8;padding:28px 24px;">
    <p style="color:#bfdbfe;font-size:11px;letter-spacing:.08em;margin:0 0 6px;">AI ENGINE OPTIMIZATION LAB</p>
    <h1 style="color:#fff;font-size:22px;margin:0 0 4px;">{d['business_name']} AI 진단 완료</h1>
    <p style="color:#93c5fd;font-size:13px;margin:0;">{d['region']} · {cat_ko}</p>
  </div>
  <div style="padding:24px 20px;">
    <div style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;padding:20px;margin-bottom:20px;text-align:center;">
      <p style="font-size:12px;color:#64748b;margin:0 0 6px;">AI 노출 현황</p>
      <p style="font-size:28px;font-weight:bold;color:{_score_color(score)};margin:0;">{_score_label(score)}</p>
    </div>
    <div style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;padding:20px;margin-bottom:20px;text-align:center;">
      <p style="font-size:14px;color:#1e293b;margin:0 0 14px;">아래 버튼으로 전체 결과를 확인하세요.<br><span style="font-size:12px;color:#64748b;">링크는 24시간 후 만료됩니다</span></p>
      <a href="{dummy_link}" style="background:#1d4ed8;color:#fff;text-decoration:none;padding:13px 28px;border-radius:8px;font-size:14px;font-weight:700;display:inline-block;">
        내 AI 진단 결과 보기 →
      </a>
    </div>
    <p style="font-size:12px;color:#94a3b8;text-align:center;">AEOlab · aeolab.co.kr</p>
  </div>
</div>"""
    elif email_type == "welcome":
        from services.email_sender import send_welcome_promise_email
        # welcome은 async 함수라 HTML만 직접 접근 불가 — 내부 HTML 재현
        html = f"""
<div style="font-family:'Apple SD Gothic Neo',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1e293b;">
  <div style="background:#1d4ed8;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
    <p style="color:#bfdbfe;font-size:12px;margin:0 0 4px;">AI ENGINE OPTIMIZATION LAB</p>
    <h1 style="color:#fff;font-size:22px;margin:0;">{d['business_name']} 등록 완료</h1>
  </div>
  <div style="background:#eff6ff;border-radius:10px;padding:16px 20px;margin-bottom:20px;text-align:center;">
    <p style="font-size:13px;color:#3b82f6;margin:0 0 4px;font-weight:600;">AI 노출 현황</p>
    <p style="font-size:24px;font-weight:bold;color:#1d4ed8;margin:0;">주의 필요</p>
  </div>
  <p style="font-size:14px;color:#475569;">[실제 발송 시 가입 완료 + 스마트플레이스 소개글 안내 포함]</p>
  <p style="font-size:12px;color:#94a3b8;text-align:center;">AEOlab · aeolab.co.kr</p>
</div>"""
    else:
        raise HTTPException(status_code=400, detail=f"지원하지 않는 타입: {email_type}. day1 | day3 | day7 | claim | welcome")

    wrapper = f"""<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>이메일 미리보기 — {email_type}</title>
<style>
  body {{ margin:0; background:#f1f5f9; padding:20px; font-family:sans-serif; }}
  .meta {{ max-width:600px; margin:0 auto 12px; background:#1e293b; color:#e2e8f0;
           border-radius:8px; padding:10px 16px; font-size:13px; display:flex;
           justify-content:space-between; align-items:center; }}
  .meta a {{ color:#93c5fd; font-size:12px; }}
</style></head><body>
<div class="meta">
  <span>📧 미리보기: <strong>{email_type}</strong> · 사업장: {name}</span>
  <span>
    <a href="?key={key}&name={name}&email_type=day1">day1</a> |
    <a href="/admin/email-preview/day3?key={key}&name={name}">day3</a> |
    <a href="/admin/email-preview/day7?key={key}&name={name}">day7</a> |
    <a href="/admin/email-preview/claim?key={key}&name={name}">claim</a>
  </span>
</div>
{html}
</body></html>"""
    return HTMLResponse(content=wrapper)


@router.post(
    "/email-test-send",
    summary="이메일 실제 발송 테스트 (관리자 전용)",
    tags=["admin"],
)
async def email_test_send(
    to_email: str = Query(..., description="수신 이메일 주소"),
    email_type: str = Query("day1", description="day1 | day3 | day7"),
    name: str = Query("대호흑돼지", description="사업장명"),
    _: None = Depends(verify_admin),
):
    """지정 이메일로 테스트 이메일을 실제 발송합니다.

    Swagger UI → X-Admin-Key 헤더 설정 후 호출
    """
    from services.email_sender import send_trial_followup

    d = dict(_EMAIL_DUMMY)
    d["business_name"] = name

    day_map = {"day1": 1, "day3": 3, "day7": 7}
    day = day_map.get(email_type)
    if not day:
        raise HTTPException(status_code=400, detail="email_type은 day1 | day3 | day7")

    sent = await send_trial_followup(
        email=to_email,
        business_name=d["business_name"],
        category=d["category"],
        region=d["region"],
        score=d["score"],
        day=day,
        ai_mentioned=d["ai_mentioned"],
        has_intro=d["has_intro"],
        has_recent_post=d["has_recent_post"],
        naver_rank=d["naver_rank"],
        blog_mentions=d["blog_mentions"],
        top_missing_keywords=d["top_missing_keywords"],
        top_competitor_name=d["top_competitor_name"],
        track1_score=d["track1_score"],
        track2_score=d["track2_score"],
        smart_place_completeness=d["smart_place_completeness"],
        growth_stage=d["growth_stage"],
    )
    if not sent:
        raise HTTPException(status_code=500, detail="발송 실패 — RESEND_API_KEY 확인 또는 서버 로그 점검")
    return {"ok": True, "sent_to": to_email, "type": email_type, "name": name}
