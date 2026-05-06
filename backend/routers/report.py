import csv
import io
import logging
from datetime import date
from fastapi import APIRouter, BackgroundTasks, Body, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse, Response
from db.supabase_client import get_client, execute
from middleware.plan_gate import get_current_user
from utils import cache as _cache

_logger = logging.getLogger(__name__)

router = APIRouter()


def _csv_safe(s):
    """CSV 인젝션 방어: =, +, -, @ 시작 문자열에 작은따옴표 prefix."""
    if not isinstance(s, str):
        return s
    if s and s[0] in ("=", "+", "-", "@"):
        return "'" + s
    return s

# 캐시 TTL 상수
_TTL_RANKING   = 1800   # 랭킹: 30분
_TTL_BENCHMARK = 3600   # 벤치마크: 1시간


async def _verify_biz_ownership(supabase, biz_id: str, user_id: str) -> None:
    """사업장 소유권 검증 — 타인 소유 또는 없는 경우 404 반환
    (403 대신 404: 존재 자체를 노출하지 않음)
    """
    row = (
        await execute(
            supabase.table("businesses")
            .select("id")
            .eq("id", biz_id)
            .eq("user_id", user_id)
            .maybe_single()
        )
    ).data
    if not row:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")


@router.get("/score/{biz_id}")
async def get_score(biz_id: str, user=Depends(get_current_user)):
    """DiagnosisReport — AI Visibility Score 전체 조회 (Domain 1)
    channel_scores, website_health, score_breakdown 포함
    """
    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])

    row = (await execute(
        supabase.table("scan_results")
        .select(
            "id, scanned_at, total_score, exposure_freq, score_breakdown, "
            "competitor_scores, query_used, "
            "naver_channel_score, global_channel_score, "
            "website_check_result, kakao_result, "
            "track1_score, track2_score, unified_score, keyword_coverage, is_keyword_estimated"
        )
        .eq("business_id", biz_id)
        .order("scanned_at", desc=True)
        .limit(1)
    )).data
    if not row:
        raise HTTPException(status_code=404, detail="No scan results found")

    # 블로그 분석 기여 여부 조회 (blog_url + blog_analyzed_at 존재 여부)
    biz_blog_row = (await execute(
        supabase.table("businesses")
        .select("blog_url, blog_analyzed_at, blog_post_count, blog_keyword_coverage")
        .eq("id", biz_id)
        .single()
    )).data or {}

    r = row[0]
    total = float(r.get("total_score") or 0)
    grade = "A" if total >= 80 else "B" if total >= 60 else "C" if total >= 40 else "D"

    naver_ch  = float(r.get("naver_channel_score") or 0)
    global_ch = float(r.get("global_channel_score") or 0)
    gap       = abs(naver_ch - global_ch)
    if gap < 10:
        dominant = "balanced"
    elif naver_ch > global_ch:
        dominant = "naver"
    else:
        dominant = "global"

    # website_health — WebsiteHealth 도메인 모델 구조로 변환
    wc = r.get("website_check_result") or {}
    website_health = {
        "has_json_ld":                wc.get("has_json_ld", False),
        "has_schema_local_business":  wc.get("has_schema_local_business", False),
        "has_open_graph":             wc.get("has_open_graph", False),
        "is_mobile_friendly":         wc.get("is_mobile_friendly", False),
        "has_favicon":                wc.get("has_favicon", False),
        "is_https":                   wc.get("is_https", False),
        "title":                      wc.get("title", ""),
        "error":                      wc.get("error"),
        "checked": bool(wc),
    }

    return {
        "id":          r["id"],
        "scanned_at":  r["scanned_at"],
        "query_used":  r.get("query_used"),
        "exposure_freq": r.get("exposure_freq", 0),
        # DiagnosisReport — score_result (v3.0 듀얼트랙 필드 포함)
        "score_result": {
            "total_score":   total,
            "grade":         grade,
            "breakdown":     r.get("score_breakdown") or {},
            "track1_score":  r.get("track1_score"),
            "track2_score":  r.get("track2_score"),
            "unified_score": r.get("unified_score"),
            "keyword_coverage": r.get("keyword_coverage"),
            # 블로그 기여 정보 — 스캔 결과에 블로그 분석이 반영됐는지 여부
            "blog_contribution": {
                "active": bool(biz_blog_row.get("blog_url") and biz_blog_row.get("blog_analyzed_at") and not r.get("is_keyword_estimated", True)),
                "post_count": biz_blog_row.get("blog_post_count") or 0,
                "keyword_coverage": float(biz_blog_row.get("blog_keyword_coverage") or 0),
                "analyzed_at": biz_blog_row.get("blog_analyzed_at"),
                "blog_url": biz_blog_row.get("blog_url"),
            },
        },
        # DiagnosisReport — channel_scores
        "channel_scores": {
            "naver_channel":   naver_ch,
            "global_channel":  global_ch,
            "dominant_channel": dominant,
            "channel_gap":     round(gap, 1),
        },
        # DiagnosisReport — website_health
        "website_health": website_health,
        # 하위호환 필드 (기존 대시보드 컴포넌트 지원)
        "total_score":      total,
        "grade":            grade,
        "score_breakdown":  r.get("score_breakdown") or {},
        "naver_channel_score":  naver_ch,
        "global_channel_score": global_ch,
        "competitor_scores":    r.get("competitor_scores"),
        # v3.0 최상위 레벨 (DualTrackCard 직접 참조용)
        "track1_score":     r.get("track1_score"),
        "track2_score":     r.get("track2_score"),
        "unified_score":    r.get("unified_score"),
        "keyword_coverage": r.get("keyword_coverage"),
    }


@router.get("/history/{biz_id}")
async def get_history(biz_id: str, user=Depends(get_current_user)):
    """점수 추세 — scan_results 직접 읽기 (competitor_scores 포함), 플랜별 행 수 제한"""
    from middleware.plan_gate import get_user_plan, PLAN_LIMITS
    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])
    plan = await get_user_plan(user["id"], supabase)
    history_days = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["history_days"]
    limit_rows = history_days if history_days < 999 else 3650
    if limit_rows == 0:
        return []

    result = await execute(
        supabase.table("scan_results")
        .select("scanned_at, total_score, track1_score, track2_score, unified_score, competitor_scores")
        .eq("business_id", biz_id)
        .order("scanned_at", desc=True)
        .limit(limit_rows)
    )
    rows = result.data or []
    # score_date 별칭 추가 (하위 호환)
    for row in rows:
        row["score_date"] = (row.get("scanned_at") or "")[:10]
    return rows


@router.get("/competitors/{biz_id}")
async def get_competitors(biz_id: str, user=Depends(get_current_user)):
    """경쟁사 비교 분석 (gap 분석) — 본인 사업장만"""
    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])

    my_score = (
        await execute(
            supabase.table("scan_results")
            .select("total_score, score_breakdown")
            .eq("business_id", biz_id)
            .order("scanned_at", desc=True)
            .limit(1)
        )
    ).data
    competitors = (
        await execute(
            supabase.table("competitors")
            .select("id, name, address, is_active, created_at")
            .eq("business_id", biz_id)
            .eq("is_active", True)
        )
    ).data
    return {
        "my_score": my_score[0] if my_score else None,
        "competitors": competitors,
    }


@router.get("/before-after/{biz_id}")
async def get_before_after(biz_id: str, user=Depends(get_current_user)):
    """Before/After 스크린샷 히스토리 — 본인 사업장만"""
    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])
    result = await execute(
        supabase.table("before_after")
        .select("id, capture_type, platform, image_url, query_used, score_at_capture, created_at")
        .eq("business_id", biz_id)
        .order("created_at", desc=True)
    )
    return result.data


@router.get("/ranking/{category}/{region}")
async def get_industry_ranking(category: str, region: str):
    """업종·지역 AI 노출 랭킹 TOP10 (캐시 30분)"""
    cache_key = _cache._make_key("ranking", category, region)
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    supabase = get_client()
    businesses = (
        await execute(
            supabase.table("businesses")
            .select("id, name")
            .eq("category", category)
            .eq("region", region)
            .eq("is_active", True)
            .limit(20)
        )
    ).data or []
    if not businesses:
        return []

    biz_ids = [b["id"] for b in businesses]
    biz_map = {b["id"]: b["name"] for b in businesses}

    # N+1 제거: score_history 단일 IN 쿼리로 모든 사업장 최신 점수 조회
    scores_raw = (
        await execute(
            supabase.table("score_history")
            .select("business_id, total_score, exposure_freq, score_date")
            .in_("business_id", biz_ids)
            .order("score_date", desc=True)
            .limit(len(biz_ids) * 2)
        )
    ).data or []
    latest: dict = {}
    for s in scores_raw:
        bid = s["business_id"]
        if bid not in latest:
            latest[bid] = s

    results = [
        {
            "business_id": bid,
            "name": biz_map[bid],
            "total_score": s["total_score"],
            "exposure_freq": s.get("exposure_freq", 0),
            "scanned_at": s.get("score_date"),
        }
        for bid, s in latest.items()
    ]
    results.sort(key=lambda x: x["total_score"], reverse=True)
    for i, r in enumerate(results[:10]):
        r["rank"] = i + 1
    top10 = results[:10]

    _cache.set(cache_key, top10, _TTL_RANKING)
    return top10


def _compute_benchmark_stats(scores: list[float], category: str, region: str | None) -> dict:
    """점수 목록 → 벤치마크 통계 딕셔너리"""
    scores = sorted(scores)
    count = len(scores)
    avg_score = round(sum(scores) / count, 1)
    top10_idx = max(0, int(count * 0.9))
    top10_score = round(scores[top10_idx], 1)
    bands = [0, 20, 40, 60, 80, 100]
    distribution = [
        {"range": f"{bands[i]}~{bands[i+1]}", "count": sum(1 for s in scores if bands[i] <= s < bands[i+1])}
        for i in range(len(bands) - 1)
    ]
    return {
        "sample_count": count,
        "count": count,  # 하위호환
        "avg_score": avg_score,
        "top10_score": top10_score,
        "distribution": distribution,
        "category": category,
        "region": region,
    }


async def _query_benchmark_scores(supabase, category: str | None, region: str | None) -> list[float]:
    """업종·지역 조건으로 최신 점수 목록 조회
    구독 사업장(score_history) + 무료 체험(trial_scans) 데이터를 합산
    → 초기 데이터 부족 문제 해소 + 더 넓은 모집단으로 정확한 벤치마크
    """
    import asyncio

    region_prefix = region.split()[0] if region else None

    # ── 1. 구독 사업장 최신 점수 ──────────────────────────────────
    async def _registered_scores() -> list[float]:
        q = supabase.table("businesses").select("id").eq("is_active", True)
        if category:
            q = q.eq("category", category)
        if region_prefix:
            q = q.ilike("region", f"{region_prefix}%")
        businesses = (await execute(q.limit(200))).data or []
        if not businesses:
            return []
        biz_ids    = [b["id"] for b in businesses]
        scores_raw = (
            await execute(
                supabase.table("score_history")
                .select("business_id, total_score")
                .in_("business_id", biz_ids)
                .order("score_date", desc=True)
                .limit(len(biz_ids) * 2)
            )
        ).data or []
        latest: dict = {}
        for s in scores_raw:
            if s["business_id"] not in latest:
                latest[s["business_id"]] = float(s["total_score"])
        return list(latest.values())

    # ── 2. 무료 체험 스캔 점수 (최근 90일) ───────────────────────
    async def _trial_scores() -> list[float]:
        from datetime import datetime, timedelta, timezone
        cutoff = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
        q = (
            supabase.table("trial_scans")
            .select("total_score")
            .gte("scanned_at", cutoff)
            .not_.is_("total_score", "null")
        )
        if category:
            q = q.eq("category", category)
        if region_prefix:
            q = q.ilike("region", f"{region_prefix}%")
        rows = (await execute(q.limit(500))).data or []
        return [float(r["total_score"]) for r in rows if r.get("total_score") is not None]

    registered, trial = await asyncio.gather(
        _registered_scores(), _trial_scores(), return_exceptions=True
    )
    if isinstance(registered, Exception):
        registered = []
    if isinstance(trial, Exception):
        trial = []

    return registered + trial


@router.get("/benchmark/{category}/{region}")
async def get_benchmark(category: str, region: str):
    """업종·지역 벤치마크 통계 (평균·상위10%·분포) — 데이터 부족 시 3단계 Fallback (캐시 1시간)"""
    cache_key = _cache._make_key("benchmark", category, region)
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    supabase = get_client()

    # 1순위: 해당 업종 + 해당 지역
    scores = await _query_benchmark_scores(supabase, category=category, region=region)
    if scores and len(scores) >= 5:
        result = _compute_benchmark_stats(scores, category, region)
        _cache.set(cache_key, result, _TTL_BENCHMARK)
        return result

    # 2순위: 해당 업종 + 전국
    scores = await _query_benchmark_scores(supabase, category=category, region=None)
    if scores and len(scores) >= 3:
        result = _compute_benchmark_stats(scores, category, None)
        result["fallback"] = "region"
        result["fallback_message"] = f"{region} 지역 데이터가 부족하여 전국 {category} 평균을 표시합니다"
        _cache.set(cache_key, result, _TTL_BENCHMARK)
        return result

    # 3순위: 전체 서비스 평균
    scores = await _query_benchmark_scores(supabase, category=None, region=None)
    if scores:
        result = _compute_benchmark_stats(scores, None, None)
        result["fallback"] = "global"
        result["fallback_message"] = "데이터 수집 중입니다. 전체 평균을 표시합니다"
        _cache.set(cache_key, result, _TTL_BENCHMARK)
        return result

    empty = {"sample_count": 0, "count": 0, "avg_score": 0, "top10_score": 0, "distribution": [],
             "fallback": "global", "fallback_message": "아직 비교 데이터가 없습니다"}
    _cache.set(cache_key, empty, 300)  # 빈 결과는 5분만 캐시
    return empty


@router.get("/market/{biz_id}")
async def get_market(biz_id: str, user=Depends(get_current_user)):
    """MarketLandscape — 업종·지역 시장 현황 통합 조회 (Domain 2)
    MarketPosition, CompetitorProfile[], MarketDistribution 포함
    """
    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])

    cache_key = _cache._make_key("market", biz_id)
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    # 사업장 기본 정보
    biz = (await execute(
        supabase.table("businesses")
        .select("id, name, category, region, business_type")
        .eq("id", biz_id)
        .single()
    )).data
    if not biz:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")

    context  = biz.get("business_type") or "location_based"
    category = biz["category"]
    region   = biz.get("region") if context == "location_based" else None

    # 내 최신 점수 + 카테고리 내 순위
    my_hist = (await execute(
        supabase.table("score_history")
        .select("total_score, rank_in_category, total_in_category, score_date")
        .eq("business_id", biz_id)
        .order("score_date", desc=True)
        .limit(1)
    )).data
    my_score      = float(my_hist[0]["total_score"])     if my_hist else 0.0
    my_rank       = my_hist[0].get("rank_in_category")   if my_hist else None
    total_in_cat  = my_hist[0].get("total_in_category")  if my_hist else None

    # 등록 경쟁사 목록
    comp_rows = (await execute(
        supabase.table("competitors")
        .select("id, name, address")
        .eq("business_id", biz_id)
        .eq("is_active", True)
    )).data or []

    # 경쟁사 점수 (최신 스캔의 competitor_scores JSONB)
    scan_row = (await execute(
        supabase.table("scan_results")
        .select("competitor_scores")
        .eq("business_id", biz_id)
        .order("scanned_at", desc=True)
        .limit(1)
    )).data
    raw_comp_scores = {}
    if scan_row:
        raw = scan_row[0].get("competitor_scores") or {}
        if isinstance(raw, dict):
            raw_comp_scores = raw

    competitor_profiles = []
    for c in comp_rows:
        entry = raw_comp_scores.get(c["id"]) or {}
        score = float(entry.get("score", 0)) if isinstance(entry, dict) else float(entry or 0)
        competitor_profiles.append({
            "id":      c["id"],
            "name":    c["name"],
            "address": c.get("address"),
            "score":   score,
        })
    competitor_profiles.sort(key=lambda x: x["score"], reverse=True)

    # 업종·지역 벤치마크 (MarketDistribution)
    benchmark_scores = await _query_benchmark_scores(supabase, category=category, region=region)
    avg_score = top10_score = 0.0
    distribution = []
    percentile   = None

    if benchmark_scores:
        sorted_scores = sorted(benchmark_scores)
        count         = len(sorted_scores)
        avg_score     = round(sum(sorted_scores) / count, 1)
        top10_idx     = max(0, int(count * 0.9))
        top10_score   = round(sorted_scores[top10_idx], 1)

        bands  = [0, 20, 40, 60, 80, 100]
        grades = ["D", "D", "C", "B", "A"]
        distribution = [
            {
                "grade": grades[i],
                "range": f"{bands[i]}~{bands[i+1]}",
                "count": sum(1 for s in sorted_scores if bands[i] <= s < bands[i+1]),
            }
            for i in range(len(bands) - 1)
        ]
        below_me   = sum(1 for s in sorted_scores if s < my_score)
        percentile = round(below_me / count * 100, 1)

    result = {
        "biz_id":   biz_id,
        "context":  context,
        "category": category,
        "region":   region,
        # MarketPosition
        "market_position": {
            "my_score":          my_score,
            "my_rank":           my_rank,
            "total_in_category": total_in_cat or len(benchmark_scores),
            "percentile":        percentile,
            "avg_score":         avg_score,
            "top10_score":       top10_score,
        },
        # CompetitorProfile[]
        "competitors":    competitor_profiles,
        # MarketDistribution
        "distribution":   distribution,
        "sample_count":   len(benchmark_scores),
    }
    _cache.set(cache_key, result, _TTL_RANKING)
    return result


@router.get("/export/{biz_id}")
async def export_csv(biz_id: str, user=Depends(get_current_user)):
    """Basic+ 전용: 스캔 히스토리 CSV 내보내기"""
    supabase = get_client()
    x_user_id = user["id"]
    await _verify_biz_ownership(supabase, biz_id, x_user_id)

    from middleware.plan_gate import get_user_plan, PLAN_HIERARCHY
    plan = await get_user_plan(x_user_id, supabase)
    if PLAN_HIERARCHY.get(plan, 0) < PLAN_HIERARCHY.get("basic", 1):
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "required_plans": ["basic", "startup", "pro", "biz"]},
        )

    rows = (
        await execute(
            supabase.table("scan_results")
            .select("scanned_at, total_score, track1_score, track2_score, unified_score, exposure_freq, query_used, score_breakdown")
            .eq("business_id", biz_id)
            .order("scanned_at", desc=True)
            .limit(100)
        )
    ).data

    output = io.StringIO()
    writer = csv.writer(output)
    # v3.0 듀얼트랙 항목 (Track1: 네이버채널 / Track2: 글로벌AI)
    writer.writerow([
        "스캔일시", "통합점수", "트랙1(네이버)", "트랙2(글로벌AI)", "검색쿼리",
        "키워드커버리지", "리뷰품질", "스마트플레이스완성도", "네이버AI브리핑노출",
        "글로벌AI노출", "웹사이트구조화", "온라인언급", "GoogleAI노출",
    ])
    for r in rows:
        bd = r.get("score_breakdown") or {}
        writer.writerow([
            r["scanned_at"],
            r.get("total_score") or r.get("unified_score", ""),
            r.get("track1_score", ""),
            r.get("track2_score", ""),
            r["query_used"],
            bd.get("keyword_gap_score", ""),
            bd.get("review_quality", ""),
            bd.get("smart_place_completeness", ""),
            bd.get("naver_exposure_confirmed", ""),
            bd.get("multi_ai_exposure", ""),
            bd.get("schema_seo", ""),
            bd.get("online_mentions_t2", bd.get("online_mentions", "")),
            bd.get("google_presence", ""),
        ])

    # ── 키워드 노출 현황 섹션 (keyword_ranks 기반, 측정 미완료 시 안내 행) ──────
    kw_rows = (
        await execute(
            supabase.table("scan_results")
            .select("scanned_at, keyword_ranks")
            .eq("business_id", biz_id)
            .not_.is_("keyword_ranks", "null")
            .order("scanned_at", desc=True)
            .limit(30)
        )
    ).data or []

    writer.writerow([])  # 빈 행으로 구분
    writer.writerow(["[키워드 노출 현황]", "", "", "", "", "", "", ""])
    writer.writerow([
        "측정일", "키워드", "PC순위", "모바일순위", "플레이스순위", "비고", "", "",
    ])

    if not kw_rows:
        writer.writerow(["측정 후 표시", "키워드 순위 측정이 아직 실행되지 않았습니다", "", "", "", "", "", ""])
    else:
        # keyword_ranks: {keyword: {pc: int|None, mobile: int|None, place: int|None}}
        # 최근 30일치를 키워드별로 집계 → 평균·최저·최고 (None=미노출=99로 취급)
        from collections import defaultdict
        kw_stats: dict[str, list[dict]] = defaultdict(list)
        for scan_row in kw_rows:
            scan_date = (scan_row.get("scanned_at") or "")[:10]
            ranks = scan_row.get("keyword_ranks") or {}
            if isinstance(ranks, dict):
                for kw, rank_data in ranks.items():
                    if isinstance(rank_data, dict):
                        kw_stats[kw].append({
                            "date": scan_date,
                            "pc": rank_data.get("pc"),
                            "mobile": rank_data.get("mobile"),
                            "place": rank_data.get("place"),
                        })

        def _fmt_rank(v) -> str:
            if v is None:
                return "미노출"
            try:
                iv = int(v)
                return "미노출" if iv >= 99 else str(iv)
            except (TypeError, ValueError):
                return "미노출"

        def _avg_rank(vals: list) -> str:
            nums = [int(v) for v in vals if v is not None and int(v) < 99]
            if not nums:
                return "미노출"
            return str(round(sum(nums) / len(nums), 1))

        for kw, entries in sorted(kw_stats.items()):
            pc_vals    = [e["pc"] for e in entries]
            mob_vals   = [e["mobile"] for e in entries]
            place_vals = [e["place"] for e in entries]
            # 최근 7일 평균
            recent_7 = entries[:7]
            pc_7    = [e["pc"] for e in recent_7]
            mob_7   = [e["mobile"] for e in recent_7]
            place_7 = [e["place"] for e in recent_7]
            writer.writerow([
                _csv_safe(f"{entries[0]['date']} (최근 측정일)"), _csv_safe(kw),
                _avg_rank(pc_7), _avg_rank(mob_7), _avg_rank(place_7),
                "7일평균", "", "",
            ])
            writer.writerow([
                _csv_safe(f"30일 전체 ({len(entries)}회 측정)"), _csv_safe(kw),
                _avg_rank(pc_vals), _avg_rank(mob_vals), _avg_rank(place_vals),
                "30일평균", "", "",
            ])

    output.seek(0)
    import urllib.parse
    _raw_name = f"aeolab_report_{biz_id[:8]}.csv"
    _enc_name = urllib.parse.quote(_raw_name)
    return StreamingResponse(
        iter([output.getvalue().encode("utf-8-sig")]),  # utf-8-sig: 한글 엑셀 호환
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{_enc_name}"},
    )


@router.get("/pdf/{biz_id}")
async def export_pdf(biz_id: str, user=Depends(get_current_user)):
    """Pro+ 전용: AI Visibility 리포트 PDF 다운로드"""
    supabase = get_client()
    x_user_id = user["id"]
    await _verify_biz_ownership(supabase, biz_id, x_user_id)

    # 플랜 확인
    from middleware.plan_gate import get_user_plan, PLAN_HIERARCHY
    plan = await get_user_plan(x_user_id, supabase)
    if PLAN_HIERARCHY.get(plan, 0) < PLAN_HIERARCHY.get("pro", 1):
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "required_plans": ["pro", "biz"]},
        )

    # 데이터 조회 (PDF 생성에 필요한 필드만 선택)
    biz = (
        await execute(
            supabase.table("businesses")
            .select("id, name, category, region, address, phone, website_url, keywords")
            .eq("id", biz_id)
            .single()
        )
    ).data
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")

    latest_scan = (
        await execute(
            supabase.table("scan_results")
            .select("id, scanned_at, total_score, exposure_freq, score_breakdown, naver_channel_score, global_channel_score, query_used, gemini_result, chatgpt_result, naver_result, google_result")
            .eq("business_id", biz_id)
            .order("scanned_at", desc=True)
            .limit(1)
        )
    ).data
    if not latest_scan:
        raise HTTPException(status_code=404, detail="No scan results found")

    history = (
        await execute(
            supabase.table("score_history")
            .select("score_date, total_score, track1_score, track2_score, unified_score, exposure_freq, rank_in_category, total_in_category, weekly_change")
            .eq("business_id", biz_id)
            .order("score_date", desc=True)
            .limit(30)
        )
    ).data

    guide = (
        await execute(
            supabase.table("guides")
            .select("summary, items_json")
            .eq("business_id", biz_id)
            .order("generated_at", desc=True)
            .limit(1)
        )
    ).data

    # 키워드 순위 이력 조회 (keyword_ranks 컬럼 있는 스캔만, 최근 30개)
    kw_rank_history = (
        await execute(
            supabase.table("scan_results")
            .select("scanned_at, keyword_ranks")
            .eq("business_id", biz_id)
            .not_.is_("keyword_ranks", "null")
            .order("scanned_at", desc=True)
            .limit(30)
        )
    ).data or []

    from services.pdf_generator import generate_pdf_report
    pdf_bytes = generate_pdf_report(
        biz=biz,
        latest_scan=latest_scan[0],
        history=history,
        guide=guide[0] if guide else None,
        keyword_ranks_history=kw_rank_history if kw_rank_history else None,
    )

    filename = f"aeolab_{biz.get('name', biz_id[:8])}_report.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"},
    )


@router.get("/keyword-rank-csv/{biz_id}")
async def export_keyword_rank_csv(biz_id: str, user=Depends(get_current_user)):
    """Pro+ 전용: 키워드 순위 측정 이력 CSV 다운로드 (KeywordRankCard 연동)

    scan_results.keyword_ranks JSONB에서 최근 30일 시계열을 추출하여
    키워드별 PC·모바일·플레이스 순위 이력을 CSV로 반환합니다.
    측정 데이터가 없으면 "측정 후 표시" 안내 행 1줄만 포함합니다.
    """
    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])

    # 플랜 확인 — Pro+ 전용 (basic은 /export에 키워드 섹션이 포함되므로 pro+ 게이트)
    sub = (
        await execute(
            supabase.table("subscriptions")
            .select("plan, status")
            .eq("user_id", user["id"])
            .maybe_single()
        )
    ).data
    plan   = (sub or {}).get("plan", "free")
    status = (sub or {}).get("status", "")
    if plan not in ("pro", "biz", "startup", "enterprise") or status not in ("active", "grace_period"):
        raise HTTPException(
            status_code=403,
            detail={
                "code": "PLAN_REQUIRED",
                "required_plans": ["pro", "biz"],
                "message": "Pro 플랜 이상에서 키워드 순위 CSV를 다운로드할 수 있습니다",
            },
        )

    # keyword_ranks가 있는 스캔 결과만 최근 30개 조회
    kw_rows = (
        await execute(
            supabase.table("scan_results")
            .select("scanned_at, keyword_ranks")
            .eq("business_id", biz_id)
            .not_.is_("keyword_ranks", "null")
            .order("scanned_at", desc=True)
            .limit(30)
        )
    ).data or []

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "측정일", "키워드", "PC순위", "모바일순위", "플레이스순위",
        "PC순위(미노출=99)", "모바일순위(미노출=99)", "플레이스순위(미노출=99)",
    ])
    writer.writerow(["※ 측정 시점·기기·로그인 상태에 따라 순위가 달라질 수 있습니다.", "", "", "", "", "", "", ""])

    if not kw_rows:
        writer.writerow([
            "측정 후 표시", "키워드 순위 측정이 아직 실행되지 않았습니다",
            "", "", "", "", "", "",
        ])
    else:
        def _display(v) -> str:
            if v is None:
                return "미노출"
            try:
                iv = int(v)
                return "미노출" if iv >= 99 else str(iv)
            except (TypeError, ValueError):
                return "미노출"

        def _raw(v) -> str:
            if v is None:
                return "99"
            try:
                return str(int(v))
            except (TypeError, ValueError):
                return "99"

        for row in kw_rows:
            scan_date = (row.get("scanned_at") or "")[:10]
            ranks = row.get("keyword_ranks") or {}
            if not isinstance(ranks, dict):
                continue
            for kw, rank_data in sorted(ranks.items()):
                if not isinstance(rank_data, dict):
                    continue
                pc    = rank_data.get("pc")
                mob   = rank_data.get("mobile")
                place = rank_data.get("place")
                writer.writerow([
                    _csv_safe(scan_date), _csv_safe(kw),
                    _display(pc), _display(mob), _display(place),
                    _raw(pc), _raw(mob), _raw(place),
                ])

    output.seek(0)
    biz_name_row = (
        await execute(
            supabase.table("businesses").select("name").eq("id", biz_id).single()
        )
    ).data or {}
    import urllib.parse
    safe_name = (biz_name_row.get("name") or biz_id[:8]).replace("/", "_").replace(" ", "_")
    filename = f"aeolab_keyword_rank_{safe_name}.csv"
    _enc_filename = urllib.parse.quote(filename)
    return StreamingResponse(
        iter([output.getvalue().encode("utf-8-sig")]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{_enc_filename}"},
    )


# ── Share Card (공유 가능한 AI 성적표) ────────────────────────────────────────

@router.get("/share/{biz_id}")
async def get_share_page_data(biz_id: str):
    """공개 공유 페이지용 데이터 (민감 정보 제외, 인증 불필요)"""
    supabase = get_client()
    biz = (await execute(supabase.table("businesses").select("name, category, region").eq("id", biz_id).single())).data
    if not biz:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")

    score_data = (
        await execute(
            supabase.table("score_history")
            .select("total_score, exposure_freq, score_date")
            .eq("business_id", biz_id)
            .order("score_date", desc=True)
            .limit(1)
        )
    ).data
    if not score_data:
        raise HTTPException(status_code=404, detail="스캔 결과가 없습니다")

    s = score_data[0]
    score = s["total_score"]
    grade = "A" if score >= 80 else "B" if score >= 60 else "C" if score >= 40 else "D"
    return {
        "business_name": biz["name"],
        "category": biz["category"],
        "region": biz["region"],
        "score": score,
        "grade": grade,
        "gemini_frequency": s.get("exposure_freq", 0),
        "scanned_at": s.get("score_date", ""),
    }


@router.get("/share-card/{biz_id}")
async def generate_share_card(biz_id: str):
    """SNS 공유용 AI 성적표 이미지 생성 (PNG, 1080×1080)"""
    supabase = get_client()
    biz = (await execute(supabase.table("businesses").select("name, category, region").eq("id", biz_id).single())).data
    if not biz:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")

    score_data = (
        await execute(
            supabase.table("score_history")
            .select("total_score, exposure_freq")
            .eq("business_id", biz_id)
            .order("score_date", desc=True)
            .limit(1)
        )
    ).data
    if not score_data:
        raise HTTPException(status_code=404, detail="스캔 결과가 없습니다")

    score = score_data[0]["total_score"]
    grade = "A" if score >= 80 else "B" if score >= 60 else "C" if score >= 40 else "D"
    freq = score_data[0].get("exposure_freq", 0)

    try:
        from PIL import Image, ImageDraw, ImageFont
        import io as _io
        from datetime import datetime

        img = Image.new("RGB", (1080, 1080), color="#0f172a")
        draw = ImageDraw.Draw(img)

        # 폰트 로드 (서버에 없으면 기본 폰트 사용)
        try:
            font_large = ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc", 120)
            font_medium = ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", 48)
            font_small = ImageFont.truetype("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", 32)
        except Exception as e:
            _logger.warning("NotoSansCJK 폰트 로드 실패 — 기본 폰트로 대체 (한글 깨짐 가능): %s", e)
            font_large = ImageFont.load_default()
            font_medium = font_large
            font_small = font_large

        grade_colors = {"A": "#22c55e", "B": "#3b82f6", "C": "#eab308", "D": "#f97316"}
        grade_color = grade_colors.get(grade, "#94a3b8")

        draw.text((80, 80), "AEOlab AI 성적표", fill="#60a5fa", font=font_small)
        draw.text((80, 160), biz["name"][:12], fill="#ffffff", font=font_medium)
        draw.text((80, 230), f"{biz['category']} · {biz['region']}", fill="#94a3b8", font=font_small)
        draw.text((80, 380), str(int(score)), fill=grade_color, font=font_large)
        draw.text((300, 470), "/100점", fill="#64748b", font=font_medium)
        draw.text((80, 560), f"{grade}등급", fill=grade_color, font=font_medium)
        draw.text((80, 640), f"AI 100회 검색 중 {freq}회 언급", fill="#94a3b8", font=font_small)
        draw.text((80, 980), "aeolab.co.kr", fill="#475569", font=font_small)

        buf = _io.BytesIO()
        img.save(buf, format="PNG", optimize=True)
        return Response(
            content=buf.getvalue(),
            media_type="image/png",
            headers={
                "Content-Disposition": f'attachment; filename="aeolab_score_{biz_id}.png"',
                "Cache-Control": "public, max-age=3600",
            },
        )
    except ImportError:
        raise HTTPException(status_code=500, detail="이미지 생성 라이브러리(Pillow)가 설치되지 않았습니다")


# ── AEO 인증 배지 ────────────────────────────────────────────────────────────

@router.get("/badge/{biz_id}")
async def get_badge(biz_id: str, user=Depends(get_current_user)):
    """인증 배지 JSON + 삽입 코드 반환 (점수 70점 이상 조건, 소유자 전용)"""
    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])
    score_data = (
        await execute(
            supabase.table("score_history")
            .select("total_score")
            .eq("business_id", biz_id)
            .order("score_date", desc=True)
            .limit(1)
        )
    ).data
    if not score_data:
        raise HTTPException(status_code=404, detail="스캔 결과가 없습니다")

    score = score_data[0]["total_score"]
    if score < 70:
        raise HTTPException(status_code=403, detail="점수 70점 이상인 사업장만 배지를 받을 수 있습니다")

    from datetime import datetime
    grade = "A" if score >= 80 else "B"
    issued_at = datetime.now().strftime("%Y.%m")
    embed_code = (
        f'<a href="https://aeolab.co.kr/share/{biz_id}">'
        f'<img src="https://aeolab.co.kr/api/report/badge/{biz_id}.svg" '
        f'alt="AEOlab AI 검색 인증 배지" width="200" height="60"></a>'
    )
    return {
        "eligible": True,
        "grade": grade,
        "score": score,
        "issued_at": issued_at,
        "svg_url": f"/api/report/badge/{biz_id}.svg",
        "embed_code": embed_code,
    }


@router.get("/badge/{biz_id}.svg", response_class=Response)
async def get_badge_svg(biz_id: str):
    """배지 SVG 파일 직접 반환"""
    supabase = get_client()
    score_data = (
        await execute(
            supabase.table("score_history")
            .select("total_score")
            .eq("business_id", biz_id)
            .order("score_date", desc=True)
            .limit(1)
        )
    ).data
    if not score_data or score_data[0]["total_score"] < 70:
        raise HTTPException(status_code=403, detail="배지 발급 조건 미충족 (70점 이상 필요)")

    from datetime import datetime
    score = score_data[0]["total_score"]
    grade = "A" if score >= 80 else "B"
    issued_at = datetime.now().strftime("%Y.%m")
    svg = f"""<svg width="200" height="60" viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg">
  <rect width="200" height="60" rx="8" fill="#0f172a"/>
  <text x="10" y="22" fill="#60a5fa" font-size="11" font-family="sans-serif" font-weight="bold">AEOlab 인증</text>
  <text x="10" y="42" fill="white" font-size="14" font-family="sans-serif" font-weight="bold">AI 검색 최적화 {grade}등급</text>
  <text x="10" y="55" fill="#94a3b8" font-size="9" font-family="sans-serif">{issued_at} · aeolab.co.kr</text>
</svg>"""
    return Response(
        content=svg,
        media_type="image/svg+xml",
        headers={"Cache-Control": "public, max-age=86400"},
    )


# ── AI 언급 맥락 분석 (Pro+) ──────────────────────────────────────────────────

@router.get("/mention-context/{biz_id}")
async def get_mention_context(biz_id: str, user=Depends(get_current_user)):
    """최근 스캔의 AI 인용 맥락 데이터 조회 (Pro+ 전용)"""
    supabase = get_client()
    x_user_id = user["id"]
    await _verify_biz_ownership(supabase, biz_id, x_user_id)

    # 플랜 확인
    sub = (
        await execute(
            supabase.table("subscriptions")
            .select("plan")
            .eq("user_id", x_user_id)
            .in_("status", ["active", "grace_period"])
            .maybe_single()
        )
    ).data
    plan = (sub or {}).get("plan", "free")
    if plan not in ("pro", "biz"):
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "required_plans": ["pro", "biz"]},
        )

    # 최근 3회 스캔 ID
    scan_ids_res = await execute(
        supabase.table("scan_results")
        .select("id")
        .eq("business_id", biz_id)
        .order("scanned_at", desc=True)
        .limit(3)
    )
    scan_ids = [r["id"] for r in (scan_ids_res.data or []) if r.get("id")]

    _PLABEL = {
        "naver": "네이버 AI 브리핑", "gemini": "Google Gemini",
        "chatgpt": "ChatGPT", "google": "Google AI Overview",
    }
    raw = []
    if scan_ids:
        raw = (await execute(
            supabase.table("ai_citations")
            .select("id, platform, query, mentioned, excerpt, sentiment, mention_type, created_at")
            .in_("scan_id", scan_ids)
            .order("created_at", desc=True)
            .limit(20)
        )).data or []

    citations = [
        {**c, "platform_label": _PLABEL.get(c.get("platform", ""), c.get("platform", ""))}
        for c in raw
        if not (c.get("excerpt") or "").strip().endswith("(구체적 인용문 없음)")
    ]
    return {
        "biz_id": biz_id,
        "platforms": citations,
        "summary": {
            "positive_count": sum(1 for c in citations if c.get("sentiment") == "positive"),
            "negative_count": sum(1 for c in citations if c.get("sentiment") == "negative"),
            "neutral_count": sum(1 for c in citations if c.get("sentiment") == "neutral"),
            "total": len(citations),
        },
    }


@router.get("/gap-card/{biz_id}")
async def get_gap_card(biz_id: str, user=Depends(get_current_user)):
    """갭 카드 PNG 즉시 생성 — 경쟁사 AI 순위 시각화 (Basic+)"""
    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])

    # Basic+ 플랜 체크
    from middleware.plan_gate import get_user_plan, PLAN_HIERARCHY
    plan = await get_user_plan(user["id"], supabase)
    if PLAN_HIERARCHY.get(plan, 0) < PLAN_HIERARCHY.get("basic", 1):
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "message": "Basic 이상 플랜에서 이용할 수 있습니다", "upgrade_url": "/pricing"},
        )

    # 사업장 정보
    biz = (
        await execute(supabase.table("businesses").select("id, name, category, region, business_type").eq("id", biz_id).maybe_single())
    ).data
    if not biz:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")

    # 최신 스캔 결과
    scan = (
        await execute(
            supabase.table("scan_results")
            .select("total_score, competitor_scores, score_breakdown")
            .eq("business_id", biz_id)
            .order("scanned_at", desc=True)
            .limit(1)
            .maybe_single()
        )
    ).data

    if not scan:
        raise HTTPException(status_code=404, detail="스캔 결과가 없습니다. 먼저 AI 스캔을 실행해주세요.")

    my_score = float(scan.get("total_score", 0))
    competitor_scores: dict = scan.get("competitor_scores") or {}

    # 경쟁사 이름 조회
    comp_rows = (
        await execute(
            supabase.table("competitors")
            .select("id, name")
            .eq("business_id", biz_id)
            .eq("is_active", True)
        )
    ).data or []
    comp_name_map = {c["id"]: c["name"] for c in comp_rows}

    competitor_items = [
        {"name": comp_name_map.get(cid, "경쟁사"), "score": float(v.get("score", 0))}
        for cid, v in competitor_scores.items()
    ]

    # 개선 힌트 — 가장 낮은 항목 기반 (소상공인 언어로 표현)
    breakdown = scan.get("score_breakdown") or {}
    HINT_MESSAGES = {
        "keyword_gap_score":        "리뷰·소개글에 업종 키워드를 추가하세요",
        "review_quality":           "리뷰를 늘리면 AI 노출이 올라갑니다",
        "smart_place_completeness": "스마트플레이스 소개글·소식을 채우세요",
        "naver_exposure_confirmed":  "네이버 AI 브리핑에 아직 노출되지 않았습니다",
        "multi_ai_exposure":        "구글 비즈니스 프로필을 등록해보세요",
        "schema_seo":               "온라인 가게 정보를 더 채워주세요",
    }
    numeric_breakdown = {k: float(v) for k, v in breakdown.items() if isinstance(v, (int, float))}
    lowest = min(numeric_breakdown.items(), key=lambda x: x[1], default=(None, None))
    hint = HINT_MESSAGES.get(lowest[0], "") if lowest[0] else ""

    from services.gap_card import generate_gap_card
    png_bytes = generate_gap_card(
        business_name=biz["name"],
        region=biz.get("region", ""),
        category=biz.get("category", ""),
        my_score=my_score,
        competitor_items=competitor_items,
        hint=hint,
    )

    return Response(content=png_bytes, media_type="image/png")


# ── GapAnalysis — 도메인 모델 v2.1 § 7 ────────────────────────────────────────

@router.get("/gap/{biz_id}")
async def get_gap_analysis(biz_id: str, user=Depends(get_current_user)):
    """격차 분석 — 내 점수와 1위 경쟁사의 항목별 격차 계산 (Basic+)"""
    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])

    # Basic+ 플랜 체크 — free 플랜은 gap 분석 불가
    from middleware.plan_gate import get_user_plan, PLAN_HIERARCHY
    plan = await get_user_plan(user["id"], supabase)
    if PLAN_HIERARCHY.get(plan, 0) < PLAN_HIERARCHY.get("basic", 1):
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "message": "Basic 이상 플랜에서 이용할 수 있습니다", "upgrade_url": "/pricing"},
        )

    from services.gap_analyzer import analyze_gap_from_db, analyze_review_keyword_distribution
    from db.supabase_client import execute
    result = await analyze_gap_from_db(biz_id, supabase)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail="격차 분석에 필요한 스캔 데이터 또는 경쟁사 데이터가 없습니다. 먼저 AI 스캔을 실행하고 경쟁사를 등록해주세요.",
        )

    gap_dict = result.model_dump(mode="json")

    # 리뷰 키워드 카테고리별 분포 분석 — AI 호출 0회, 데이터 없으면 data_unavailable=True
    try:
        biz_res = await execute(
            supabase.table("businesses")
            .select("id, blog_analysis_json, review_sample, category")
            .eq("id", biz_id)
            .maybe_single()
        )
        biz_row = biz_res.data if (biz_res and biz_res.data) else {}

        comp_res = await execute(
            supabase.table("competitors")
            .select("id, blog_analysis_json, review_sample")
            .eq("business_id", biz_id)
            .eq("is_active", True)
            .limit(10)
        )
        comp_rows = comp_res.data if (comp_res and comp_res.data) else []

        gap_dict["review_keyword_distribution"] = analyze_review_keyword_distribution(
            biz_row, comp_rows
        )
    except Exception as e:
        import logging as _log
        _log.getLogger("aeolab").warning(f"review_keyword_distribution failed (biz={biz_id}): {e}")
        gap_dict["review_keyword_distribution"] = {"data_unavailable": True, "reason": "query_error"}

    return gap_dict


@router.get("/ai-tab-preview/{biz_id}")
async def get_ai_tab_preview(biz_id: str, user=Depends(get_current_user)):
    """AI탭 답변 시뮬레이션 — Basic+ 전용, AI 호출 0회.

    네이버 AI탭이 생성할 가능성이 높은 답변을 등록 정보·키워드 기반으로 추정합니다.
    ACTIVE/LIKELY 업종만 반환. INACTIVE 업종은 available=false.
    1시간 캐시 적용.
    """
    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])

    # Basic+ 플랜 체크
    from middleware.plan_gate import get_user_plan, PLAN_HIERARCHY
    plan = await get_user_plan(user["id"], supabase)
    if PLAN_HIERARCHY.get(plan, 0) < PLAN_HIERARCHY.get("basic", 1):
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "message": "Basic 이상 플랜에서 이용할 수 있습니다", "upgrade_url": "/pricing"},
        )

    # 1시간 캐시
    _cache_key = f"ai_tab_preview:{biz_id}"
    cached = _cache.get(_cache_key)
    if cached is not None:
        return cached

    # 사업장 정보 조회
    biz_res = await execute(
        supabase.table("businesses")
        .select("id, name, category, region, keywords, is_franchise")
        .eq("id", biz_id)
        .maybe_single()
    )
    if not (biz_res and biz_res.data):
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")
    biz = biz_res.data

    # ACTIVE/LIKELY 업종 확인 — INACTIVE이면 available=false 반환
    from services.score_engine import get_briefing_eligibility
    eligibility = get_briefing_eligibility(
        biz.get("category", ""),
        bool(biz.get("is_franchise", False)),
    )
    if eligibility == "inactive":
        result = {
            "biz_id": biz_id,
            "available": False,
            "reason": "inactive_category",
            "message": "이 업종은 네이버 AI탭 대상이 아닙니다. ChatGPT·Gemini·Google AI 노출 개선에 집중하세요.",
        }
        _cache.set(_cache_key, result, ttl=_TTL_BENCHMARK)
        return result

    # 최신 스캔 결과 조회 (옵션)
    scan_res = await execute(
        supabase.table("scan_results")
        .select("id, keyword_coverage, score_breakdown")
        .eq("business_id", biz_id)
        .order("scanned_at", desc=True)
        .limit(1)
    )
    scan_row = (scan_res.data[0] if scan_res and scan_res.data else None)

    from services.briefing_engine import simulate_ai_tab_answer
    preview = simulate_ai_tab_answer(biz, scan_row)

    result = {
        "biz_id": biz_id,
        "available": True,
        "eligibility": eligibility,
        **preview,
    }
    _cache.set(_cache_key, result, ttl=_TTL_BENCHMARK)
    return result


# ── 대시보드 전환 섹션: 스캔 기반 맞춤 개선 팁 ───────────────────────────────

@router.get("/conversion-tips/{biz_id}")
async def get_conversion_tips(biz_id: str, user=Depends(get_current_user)):
    """대시보드 "점수를 올리는 방법" 맞춤 팁.

    실제 스캔 결과(ai_citations·keyword_gap·score_breakdown·스마트플레이스 상태)를
    근거로 가장 효과 큰 개선 행동 3~4개를 제시합니다.

    AI API 호출 없이 기존 gap_analyzer + briefing_engine 템플릿만 조합합니다.
    Free 플랜은 상위 2개 팁의 복사 텍스트만 공개, 나머지는 locked.
    """
    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])

    from middleware.plan_gate import get_user_plan, PLAN_HIERARCHY
    from services.gap_analyzer import analyze_gap_from_db
    from services.briefing_engine import build_direct_briefing_paths, _clean_keyword

    plan = await get_user_plan(user["id"], supabase)
    plan_rank = PLAN_HIERARCHY.get(plan, 0)
    is_paid = plan_rank >= PLAN_HIERARCHY.get("basic", 0)

    # 사업장 + 최신 스캔 로드
    biz_row = (await execute(
        supabase.table("businesses")
        .select("id, name, category, region, naver_place_id, keywords, has_faq, has_intro, has_recent_post, review_count")
        .eq("id", biz_id)
        .single()
    )).data
    if not biz_row:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")

    scan_row = (await execute(
        supabase.table("scan_results")
        .select("id, total_score, track1_score, score_breakdown, chatgpt_result, google_result, naver_result, gemini_result, scanned_at")
        .eq("business_id", biz_id)
        .order("scanned_at", desc=True)
        .limit(1)
    )).data or []

    scan = scan_row[0] if scan_row else {}
    breakdown: dict = scan.get("score_breakdown") or {}

    # 플랫폼별 언급 여부 판단 (AI citations 기반)
    platform_mentioned: dict[str, bool | None] = {"chatgpt": None, "gemini": None, "naver": None, "google": None}

    def _extract_mentioned(result: dict | None) -> bool | None:
        if not isinstance(result, dict):
            return None
        if "mentioned" in result:
            return bool(result.get("mentioned"))
        if "exposure_count" in result:
            try:
                return int(result.get("exposure_count", 0)) > 0
            except (TypeError, ValueError):
                return None
        if result.get("mentions") and isinstance(result.get("mentions"), list):
            return len(result["mentions"]) > 0
        return None

    platform_mentioned["chatgpt"] = _extract_mentioned(scan.get("chatgpt_result"))
    platform_mentioned["gemini"] = _extract_mentioned(scan.get("gemini_result"))
    platform_mentioned["naver"] = _extract_mentioned(scan.get("naver_result"))
    platform_mentioned["google"] = _extract_mentioned(scan.get("google_result"))

    # ai_citations 최근 20개 조회 (언급된 플랫폼 보강)
    try:
        cit_rows = (await execute(
            supabase.table("ai_citations")
            .select("platform, mentioned")
            .eq("business_id", biz_id)
            .order("created_at", desc=True)
            .limit(20)
        )).data or []
        for c in cit_rows:
            p = (c.get("platform") or "").lower()
            if p in platform_mentioned and platform_mentioned[p] is not True:
                platform_mentioned[p] = bool(c.get("mentioned"))
    except Exception as e:  # noqa: BLE001
        logging.getLogger("aeolab").warning(f"ai_citations query failed: {e}")

    missing_platforms_ko = []
    _platform_ko = {"chatgpt": "ChatGPT", "gemini": "Gemini", "naver": "네이버 AI 브리핑", "google": "구글 AI Overview"}
    for p, mentioned in platform_mentioned.items():
        if mentioned is False:
            missing_platforms_ko.append(_platform_ko[p])

    # Gap 분석 (경쟁사 없어도 growth_stage/keyword_gap 일부 계산됨)
    gap = None
    try:
        gap = await analyze_gap_from_db(biz_id, supabase)
    except Exception as e:  # noqa: BLE001
        logging.getLogger("aeolab").warning(f"gap analysis failed: {e}")

    missing_keywords: list[str] = []
    pioneer_keywords: list[str] = []
    competitor_only: list[str] = []
    existing_keywords: list[str] = []
    if gap is not None:
        kgap = getattr(gap, "keyword_gap", None)
        if kgap:
            missing_keywords = list(getattr(kgap, "missing_keywords", []) or [])
            pioneer_keywords = list(getattr(kgap, "pioneer_keywords", []) or [])
            competitor_only = list(getattr(kgap, "competitor_only_keywords", []) or [])
            existing_keywords = list(getattr(kgap, "existing_keywords", []) or [])

    # fallback: businesses.keywords 일부를 existing으로 사용
    if not existing_keywords:
        existing_keywords = list(biz_row.get("keywords") or [])[:5]

    # briefing paths 생성 (AI 호출 없음, 순수 템플릿)
    paths = build_direct_briefing_paths(
        biz=biz_row,
        missing_keywords=missing_keywords,
        competitor_only_keywords=competitor_only,
        existing_keywords=existing_keywords,
    )
    paths_by_id = {p["path_id"]: p for p in paths}

    # 팁 후보 생성 — 진단 근거 + 복사 텍스트 결합
    business_name = biz_row.get("name") or "우리 가게"
    tips: list[dict] = []

    # Tip 1: FAQ 등록 (가장 직접적 + 복사 가능 Q&A 3쌍 제공)
    faq_path = paths_by_id.get("faq")
    if faq_path:
        top_kw = (competitor_only[:1] or missing_keywords[:1] or [""])[0]
        top_kw_clean = _clean_keyword(top_kw) if top_kw else ""
        if top_kw_clean:
            reason = f"'{top_kw_clean}' 키워드가 경쟁사 리뷰엔 있지만 내 가게엔 아직 없습니다. 소개글 안 Q&A 섹션에 이 키워드를 포함하면 AI 브리핑 인용 후보가 됩니다."
        elif "네이버 AI 브리핑" in missing_platforms_ko:
            reason = "네이버 AI 브리핑 스캔에서 내 가게가 확인되지 않았습니다. 소개글 안 Q&A 섹션은 AI 브리핑 인용 후보로 가장 자주 활용되는 콘텐츠입니다."
        else:
            sp_score = float(breakdown.get("smart_place_completeness", 100))
            reason = f"스마트플레이스 완성도 {sp_score:.0f}점 — FAQ 미등록이 가장 큰 감점 요인입니다." if sp_score < 70 else "FAQ에 5개 이상 답변이 있으면 AI 브리핑 인용 확률이 크게 올라갑니다."
        tips.append({
            "id": "faq_from_gap",
            "title": faq_path["path_name"],
            "reason": reason,
            "evidence_type": "keyword_gap" if top_kw_clean else "smart_place",
            "evidence_badge": f"키워드: {top_kw_clean}" if top_kw_clean else "스마트플레이스",
            "urgency": faq_path.get("urgency", "do_now"),
            "urgency_label": faq_path.get("urgency_label", "지금 당장"),
            "estimated_time": faq_path.get("estimated_time", "5분"),
            "impact": faq_path.get("impact", ""),
            "copy_text": faq_path.get("ready_content", ""),
            "action_url": faq_path.get("action_url"),
            "action_label": "스마트플레이스 소개글 열기",
            "action_steps": faq_path.get("action_steps", []),
            "locked": False,
        })

    # Tip 2: 리뷰 답변 (미답변 리뷰 있을 때 가장 빠른 효과)
    review_path = paths_by_id.get("review_response")
    if review_path:
        review_count = int(biz_row.get("review_count") or 0)
        review_quality = float(breakdown.get("review_quality", 0))
        if review_count > 0 and review_quality < 60:
            reason = f"리뷰 {review_count}건이 쌓여 있는데 답변 품질 점수({review_quality:.0f}점)가 낮습니다. 답변에 키워드를 자연스럽게 포함하면 AI 신호가 강화됩니다."
            evidence = f"리뷰 {review_count}건"
        elif review_count == 0:
            reason = "아직 리뷰가 없습니다. 단골에게 리뷰 1건만 요청하고, 받은 리뷰에 즉시 키워드 답변을 다세요."
            evidence = "리뷰 0건"
        else:
            reason = "사장님 답변 텍스트도 AI 브리핑이 읽습니다. 답변에 목표 키워드를 포함하면 별도 콘텐츠 없이 신호가 쌓입니다."
            evidence = "답변 커버리지"
        tips.append({
            "id": "review_response",
            "title": review_path["path_name"],
            "reason": reason,
            "evidence_type": "review",
            "evidence_badge": evidence,
            "urgency": review_path.get("urgency", "do_now"),
            "urgency_label": review_path.get("urgency_label", "지금 당장"),
            "estimated_time": review_path.get("estimated_time", "3분"),
            "impact": review_path.get("impact", ""),
            "copy_text": review_path.get("ready_content", ""),
            "action_url": review_path.get("action_url"),
            "action_label": "리뷰 관리 열기",
            "locked": not is_paid,
        })

    # Tip 3: 소개글 수정 (pioneer_keywords 활용해서 차별화)
    intro_path = paths_by_id.get("intro")
    if intro_path:
        if pioneer_keywords:
            pk = _clean_keyword(pioneer_keywords[0])
            reason = f"'{pk}' 키워드는 주변 경쟁사엔 없고 내 가게만 가진 강점입니다. 소개글에 명시하면 이 조건 검색을 독점할 수 있습니다."
            evidence = f"독점 키워드: {pk}"
            evidence_type = "keyword_gap"
        elif missing_keywords:
            mk = _clean_keyword(missing_keywords[0])
            reason = f"소개글에 '{mk}' 키워드가 빠져 있습니다. 한 번만 수정하면 영구적으로 AI 브리핑 키워드 기반이 됩니다."
            evidence = f"누락 키워드: {mk}"
            evidence_type = "keyword_gap"
        else:
            ic = float(breakdown.get("info_completeness", 100))
            reason = f"정보 완성도 {ic:.0f}점 — 소개글 키워드 보강이 가장 가성비 좋은 개선입니다." if ic < 80 else "소개글을 한 번 손보면 영구적으로 AI 브리핑 신호가 유지됩니다."
            evidence = "정보 완성도"
            evidence_type = "smart_place"
        tips.append({
            "id": "intro_rewrite",
            "title": intro_path["path_name"],
            "reason": reason,
            "evidence_type": evidence_type,
            "evidence_badge": evidence,
            "urgency": intro_path.get("urgency", "this_month"),
            "urgency_label": intro_path.get("urgency_label", "이번 달 중"),
            "estimated_time": intro_path.get("estimated_time", "10분"),
            "impact": intro_path.get("impact", ""),
            "copy_text": intro_path.get("ready_content", ""),
            "action_url": intro_path.get("action_url"),
            "action_label": "기본 정보 편집",
            "locked": not is_paid,
        })

    # Tip 4: 글로벌 AI 노출 (ChatGPT/Google 미노출 시)
    if "ChatGPT" in missing_platforms_ko or "구글 AI Overview" in missing_platforms_ko:
        post_path = paths_by_id.get("post")
        missed = [p for p in missing_platforms_ko if p in ("ChatGPT", "구글 AI Overview")]
        kw_clean = _clean_keyword(missing_keywords[0]) if missing_keywords else ""
        reason = f"{', '.join(missed)} 스캔에서 내 가게가 검출되지 않았습니다. 소식 업데이트로 최신성 신호를 주 1회 발신하세요."
        tips.append({
            "id": "post_global",
            "title": (post_path or {}).get("path_name", "스마트플레이스 소식 업데이트"),
            "reason": reason,
            "evidence_type": "ai_citation",
            "evidence_badge": f"{missed[0]} 미노출",
            "urgency": (post_path or {}).get("urgency", "this_week"),
            "urgency_label": (post_path or {}).get("urgency_label", "이번 주"),
            "estimated_time": (post_path or {}).get("estimated_time", "5분"),
            "impact": (post_path or {}).get("impact", ""),
            "copy_text": (post_path or {}).get("ready_content", ""),
            "action_url": (post_path or {}).get("action_url"),
            "action_label": "소식 작성",
            "locked": not is_paid,
        })

    # 최대 4개로 제한 (우선순위: FAQ > 리뷰 > 소개글 > 글로벌)
    tips = tips[:4]

    # 요약 메시지
    low_items: list[str] = []
    for key, label in [
        ("smart_place_completeness", "스마트플레이스"),
        ("review_quality", "리뷰"),
        ("keyword_gap_score", "키워드"),
        ("content_freshness", "최신성"),
    ]:
        if float(breakdown.get(key, 100)) < 60:
            low_items.append(label)
    if missing_platforms_ko:
        summary = f"{', '.join(missing_platforms_ko[:2])}에서 아직 내 가게가 확인되지 않았습니다. 아래 {len(tips)}가지로 AI가 읽을 신호를 바로 만들 수 있습니다."
    elif low_items:
        summary = f"{', '.join(low_items[:2])} 점수가 낮아 아래 {len(tips)}가지가 가장 빠르게 반영됩니다."
    else:
        summary = f"스캔 결과 기반으로 가장 효과 큰 {len(tips)}가지를 골랐습니다."

    return {
        "business_name": business_name,
        "plan": plan,
        "summary": summary,
        "tips": tips,
        "missing_platforms": missing_platforms_ko,
        "growth_stage": getattr(gap.growth_stage, "model_dump", lambda: None)() if gap and getattr(gap, "growth_stage", None) else None,
        "locked_count": sum(1 for t in tips if t.get("locked")),
    }


# ── 스마트플레이스 최적화 스코어카드 ─────────────────────────────────────────

@router.get("/smartplace/{biz_id}")
async def get_smartplace_scorecard(biz_id: str, user=Depends(get_current_user)):
    """네이버 스마트플레이스 최적화 스코어카드.

    AI 브리핑 노출에 직결되는 스마트플레이스 7개 항목을 점검합니다.
    추가 API 호출 없이 기존 스캔 결과로 즉시 계산합니다.
    """
    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])

    _biz_res = await execute(
        supabase.table("businesses")
        .select("id, name, category, region, naver_place_id, website_url, keywords, has_faq, has_intro, has_recent_post, has_photos, has_review_response")
        .eq("id", biz_id)
        .single()
    )
    biz = _biz_res.data if _biz_res else None
    if not biz:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다.")

    _scan_res = await execute(
        supabase.table("scan_results")
        .select("naver_result, website_check_result, score_breakdown, smart_place_completeness_result, scanned_at")
        .eq("business_id", biz_id)
        .order("scanned_at", desc=True)
        .limit(1)
    )
    scan_rows = _scan_res.data if _scan_res else None
    scan = scan_rows[0] if scan_rows else {}

    # tools_json은 guides 테이블에 저장됨
    _guide_res = await execute(
        supabase.table("guides")
        .select("tools_json")
        .eq("business_id", biz_id)
        .order("generated_at", desc=True)
        .limit(1)
        .maybe_single()
    )
    guide_row = _guide_res.data if _guide_res else None

    naver = scan.get("naver_result") or {}
    website = scan.get("website_check_result") or {}
    breakdown = scan.get("score_breakdown") or {}
    sp_auto = scan.get("smart_place_completeness_result") or {}  # Playwright 자동 체크 결과
    tools = (guide_row or {}).get("tools_json") or {}

    naver_place_id = biz.get("naver_place_id", "")

    # sp_auto 에서 실제 스마트플레이스 상태 추출 (Playwright 크롤링 결과)
    sp_photo_count = sp_auto.get("photo_count") or 0
    sp_has_faq = bool(sp_auto.get("has_faq"))
    sp_has_recent_post = bool(sp_auto.get("has_recent_post"))
    sp_has_hours = bool(sp_auto.get("has_hours"))
    sp_has_intro = bool(sp_auto.get("has_intro"))

    checks = [
        {
            "key": "registration",
            "label": "스마트플레이스 등록",
            "done": bool(naver_place_id or naver.get("is_smart_place")),
            "impact": "high",
            "action": "smartplace.naver.com 에서 내 가게를 등록하세요.",
            "effect": "AI 브리핑 기본 노출 조건 충족",
            "deeplink": "https://smartplace.naver.com",
        },
        {
            "key": "basic_info",
            "label": "기본 정보 완성 (주소·전화·영업시간)",
            "done": sp_has_hours or bool(naver_place_id),
            "impact": "high",
            "action": "스마트플레이스 > 기본 정보에서 주소·전화번호·영업시간을 모두 입력하세요.",
            "effect": "정보 완성도 +20~30점",
            "deeplink": f"https://smartplace.naver.com/places/{naver_place_id}/info" if naver_place_id else None,
        },
        {
            "key": "photos",
            "label": "대표 사진 10장 이상",
            "done": (sp_photo_count >= 10 if sp_auto else False) or bool(biz.get("has_photos")),
            "count": sp_photo_count,
            "impact": "medium",
            "action": "가게 내외부, 메뉴/서비스 사진을 10장 이상 올리세요.",
            "effect": "AI 조건 검색 매칭 향상",
            "deeplink": f"https://smartplace.naver.com/places/{naver_place_id}/photo" if naver_place_id else None,
        },
        {
            # [2026-05-01] 스마트플레이스 사장님 Q&A 탭 폐기 — 소개글 Q&A 섹션 안내로 전환.
            "key": "intro_qa",
            "label": "소개글에 Q&A 섹션 5개 이상 포함",
            "done": sp_has_faq or ((tools.get("smart_place_faq_count") or 0) >= 3) or bool(biz.get("has_faq")) or bool(biz.get("has_intro")),
            "count": tools.get("smart_place_faq_count") or (1 if sp_has_faq else 0),
            "impact": "medium",
            "action": "스마트플레이스 > 업체정보 > 소개글에 '자주 묻는 질문' 섹션을 추가하고 Q&A 5개를 자연스럽게 포함하세요. 소개글은 AI 브리핑 인용 후보 텍스트입니다.",
            "effect": "AI 브리핑 인용 후보 경로 확보",
            "deeplink": f"https://smartplace.naver.com/bizes/{naver_place_id}/profile" if naver_place_id else None,
        },
        {
            "key": "news_post",
            "label": "소식(News) 최근 1개월 내 업데이트",
            "done": sp_has_recent_post or (breakdown.get("content_freshness", 0) or 0) >= 50 or bool(biz.get("has_recent_post")),
            "impact": "medium",
            "action": "스마트플레이스 > 소식에 메뉴 변경, 이벤트, 운영 안내를 주 1회 게시하세요.",
            "effect": "AI 최신성 점수 유지 + 활성 사업장 인식",
            "deeplink": f"https://smartplace.naver.com/places/{naver_place_id}/news" if naver_place_id else None,
        },
        {
            "key": "review_response",
            "label": "리뷰 답변 활성화 (50% 이상)",
            "done": (naver.get("response_rate") or 0) >= 50 or bool(biz.get("has_review_response")),
            "rate": naver.get("response_rate") or 0,
            "impact": "medium",
            "action": "미답변 리뷰에 키워드가 포함된 자연스러운 답변을 달아주세요.",
            "effect": "리뷰 품질 신호 강화 + 고객 신뢰도 향상",
            "deeplink": f"https://smartplace.naver.com/places/{naver_place_id}/review" if naver_place_id else None,
        },
        {
            "key": "website_schema",
            "label": "웹사이트 AI 인식 정보 추가",
            "done": bool(biz.get("website_url") or website.get("url")) and bool(website.get("has_json_ld")),
            "has_website": bool(biz.get("website_url") or website.get("url")),
            "has_json_ld": bool(website.get("has_json_ld")),
            "impact": "low",
            "action": "독립 웹사이트에 AI 인식 정보 코드를 추가하면 ChatGPT·Gemini에서도 노출됩니다.",
            "effect": "글로벌 AI 채널 +15~20점",
            "deeplink": None,
        },
    ]

    done_count = sum(1 for c in checks if c["done"])
    total = len(checks)
    pct = round(done_count / total * 100)

    if pct >= 85:
        grade, grade_label = "A", "최적화 완료"
    elif pct >= 65:
        grade, grade_label = "B", "일부 개선 필요"
    elif pct >= 40:
        grade, grade_label = "C", "주요 항목 미완성"
    else:
        grade, grade_label = "D", "즉시 개선 필요"

    impact_order = {"high": 0, "medium": 1, "low": 2}
    top_actions = sorted(
        [c for c in checks if not c["done"]],
        key=lambda x: impact_order.get(x["impact"], 9)
    )[:3]

    return {
        "business_id": biz_id,
        "business_name": biz["name"],
        "completion_pct": pct,
        "done_count": done_count,
        "total_count": total,
        "grade": grade,
        "grade_label": grade_label,
        "checks": checks,
        "top_actions": top_actions,
        "naver_place_id": naver_place_id,
        "smartplace_url": f"https://smartplace.naver.com/places/{naver_place_id}" if naver_place_id else "https://smartplace.naver.com",
    }


# ── 스마트플레이스 자동 체크 결과 조회 ──────────────────────────────────────

@router.get("/smart-place/{biz_id}")
async def get_smart_place_result(biz_id: str, user=Depends(get_current_user)):
    """최근 스캔의 스마트플레이스 자동 체크 결과 조회.
    결과 없으면 businesses.naver_place_url 반환 (수동 등록 유도)
    """
    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])

    # 최신 스캔에서 smart_place_completeness_result 조회
    scan = (
        await execute(
            supabase.table("scan_results")
            .select("id, scanned_at, smart_place_completeness_result")
            .eq("business_id", biz_id)
            .order("scanned_at", desc=True)
            .limit(1)
            .maybe_single()
        )
    ).data

    result = (scan or {}).get("smart_place_completeness_result")
    if result and not result.get("error"):
        return {
            "biz_id": biz_id,
            "source": "auto_scan",
            "scanned_at": (scan or {}).get("scanned_at"),
            "completeness_score": result.get("completeness_score", 0),
            "has_faq": result.get("has_faq", False),
            "has_recent_post": result.get("has_recent_post", False),
            "has_intro": result.get("has_intro", False),
            "has_menu": result.get("has_menu", False),
            "has_hours": result.get("has_hours", False),
            "photo_count": result.get("photo_count", 0),
            "raw": result,
        }

    # 결과 없음 — naver_place_url 반환하여 프론트에서 수동 안내
    biz = (
        await execute(
            supabase.table("businesses")
            .select("naver_place_url, naver_place_id, smart_place_auto_checked_at")
            .eq("id", biz_id)
            .maybe_single()
        )
    ).data or {}

    naver_place_url = biz.get("naver_place_url")
    naver_place_id = biz.get("naver_place_id")

    return {
        "biz_id": biz_id,
        "source": "not_scanned",
        "scanned_at": None,
        "completeness_score": None,
        "has_faq": None,
        "has_recent_post": None,
        "has_intro": None,
        "has_menu": None,
        "has_hours": None,
        "photo_count": None,
        "naver_place_url": naver_place_url,
        "smartplace_register_url": (
            f"https://smartplace.naver.com/places/{naver_place_id}"
            if naver_place_id
            else "https://smartplace.naver.com"
        ),
        "message": (
            "스마트플레이스 URL을 등록하면 다음 스캔 시 자동으로 분석됩니다."
            if not naver_place_url
            else "다음 AI 스캔 시 스마트플레이스 완성도를 자동으로 분석합니다."
        ),
        "raw": None,
    }


# ── 성장 리포트 ─────────────────────────────────────────────────────────────

BREAKDOWN_LABELS = {
    "exposure_freq":            "AI 검색 노출",
    "review_quality":           "리뷰 평판",
    "schema_score":             "온라인 정보",
    "online_mentions":          "온라인 언급",
    "info_completeness":        "기본 정보 완성도",
    "content_freshness":        "최근 활동",
    "track1_naver":             "네이버 AI 채널",
    "track2_global":            "글로벌 AI 채널",
    # score_engine.py breakdown 실제 키
    "keyword_gap_score":        "핵심 키워드 보유",
    "smart_place_completeness": "스마트플레이스 완성도",
    "schema_seo":               "AI 검색 등록(JSON-LD)",
    "multi_ai_exposure":        "ChatGPT·구글 AI 노출",
    "naver_exposure_confirmed": "네이버 AI 브리핑 노출",
    "online_mentions_t2":       "온라인 언급",
    "google_presence":          "구글 검색 노출",
    "kakao_completeness":       "카카오맵 정보 완성도",
}


def _score_to_grade(score: float) -> str:
    if score >= 80:
        return "A"
    if score >= 60:
        return "B"
    if score >= 40:
        return "C"
    return "D"


def _next_goal(current_score: float, breakdown: dict) -> dict:
    """다음 등급 목표 계산."""
    grade = _score_to_grade(current_score)
    thresholds = {"D": (40, "C"), "C": (60, "B"), "B": (80, "A"), "A": (80, "A")}
    target_score, target_grade = thresholds[grade]
    gap = max(0.0, round(target_score - current_score, 1))

    # 가장 낮은 breakdown 항목 찾아 action 문구 생성
    action = "스마트플레이스 소개글에 Q&A를 추가하면 AI 브리핑 인용 후보 가능성이 올라갑니다"
    if breakdown:
        valid = {k: v for k, v in breakdown.items() if isinstance(v, (int, float))}
        if valid:
            worst_key = min(valid, key=lambda k: valid[k])
            label = BREAKDOWN_LABELS.get(worst_key, worst_key)
            action = f"{label} 개선으로 점수를 올릴 수 있습니다"

    return {
        "target_score":  float(target_score),
        "target_grade":  target_grade,
        "gap":           gap,
        "action":        action,
    }


def _safe_float(v) -> float:
    try:
        return float(v) if v is not None else 0.0
    except (TypeError, ValueError):
        return 0.0


@router.get("/growth/{biz_id}")
async def get_growth_report(biz_id: str, user=Depends(get_current_user)):
    """성장 리포트 — trial_scans + scan_results 통합 타임라인, 성장 드라이버, 다음 목표.
    - free 플랜: timeline 빈 배열 + locked=True
    - basic 이상: 전체 반환
    - 캐시 30분
    """
    from middleware.plan_gate import get_user_plan

    supabase   = get_client()
    user_id    = user["id"]
    user_email = user.get("email", "")

    # 소유권 검증 + 사업장 기본정보
    biz_row = (
        await execute(
            supabase.table("businesses")
            .select("id, name, category, region, user_id")
            .eq("id", biz_id)
            .eq("user_id", user_id)
            .maybe_single()
        )
    ).data
    if not biz_row:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")

    # 캐시
    cache_key = _cache._make_key("growth", biz_id, user_id)
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    plan = await get_user_plan(user_id, supabase)

    # ── 1. scan_results 이력 조회 (최대 100개, ASC) ───────────────────
    scans_raw = (
        await execute(
            supabase.table("scan_results")
            .select(
                "id, scanned_at, unified_score, track1_score, track2_score, "
                "score_breakdown, growth_stage, top_missing_keywords, "
                "naver_weight, global_weight, naver_result, competitor_scores"
            )
            .eq("business_id", biz_id)
            .order("scanned_at", desc=False)
            .limit(100)
        )
    ).data or []

    # ── 2. trial_scans 최신 1개 (이메일 매칭) ────────────────────────
    trial_raw = None
    if user_email:
        trial_rows = (
            await execute(
                supabase.table("trial_scans")
                .select(
                    "id, scanned_at, business_name, unified_score, "
                    "track1_score, track2_score, score_breakdown, "
                    "growth_stage, top_missing_keywords"
                )
                .eq("email", user_email)
                .order("scanned_at", desc=True)
                .limit(1)
            )
        ).data or []
        if trial_rows:
            trial_raw = trial_rows[0]

    # ── 3. 기준 점수 결정 ────────────────────────────────────────────
    trial_score      = _safe_float((trial_raw or {}).get("unified_score"))
    first_scan_score = _safe_float((scans_raw[0] if scans_raw else {}).get("unified_score"))
    start_score      = trial_score if trial_raw else first_scan_score
    current_score    = _safe_float((scans_raw[-1] if scans_raw else {}).get("unified_score"))

    # ── 4. timeline 구성 ─────────────────────────────────────────────
    prev_score = start_score
    timeline: list[dict] = []
    for scan in scans_raw:
        s     = _safe_float(scan.get("unified_score"))
        delta = round(s - prev_score, 1)
        timeline.append({
            "scanned_at":      scan.get("scanned_at"),
            "unified_score":   s,
            "track1_score":    _safe_float(scan.get("track1_score")),
            "track2_score":    _safe_float(scan.get("track2_score")),
            "growth_stage":    scan.get("growth_stage_label") or scan.get("growth_stage") or "생존기",
            "score_breakdown": scan.get("score_breakdown") or {},
            "delta":           delta,
        })
        prev_score = s

    # ── 5. 성장 드라이버 (첫 스캔 vs 최신 스캔 breakdown 비교) ──────
    growth_drivers: list[dict] = []
    if scans_raw:
        first_bd  = scans_raw[0].get("score_breakdown")  or {}
        latest_bd = scans_raw[-1].get("score_breakdown") or {}
        drivers: list[dict] = []
        all_keys = set(first_bd.keys()) | set(latest_bd.keys())
        for key in all_keys:
            label   = BREAKDOWN_LABELS.get(key, key)
            current = _safe_float(latest_bd.get(key))
            prev    = _safe_float(first_bd.get(key))
            delta   = round(current - prev, 1)
            drivers.append({"label": label, "key": key, "delta": delta, "current": current})
        # delta가 모두 0이면 current 값 기준 정렬 (초기 단계 사용자 대응)
        all_zero = all(d["delta"] == 0 for d in drivers)
        sort_key = (lambda x: x["current"]) if all_zero else (lambda x: x["delta"])
        growth_drivers = sorted(drivers, key=sort_key, reverse=True)[:4]

    # ── 5-B. 헤드라인 문장 ───────────────────────────────────────────
    total_delta_val = round(current_score - start_score, 1)
    headline = ""
    headline_type = "stable"
    if scans_raw:
        latest_comp_raw = scans_raw[-1].get("competitor_scores") or {}
        prev_comp_raw   = scans_raw[-2].get("competitor_scores") if len(scans_raw) >= 2 else {}
        # 경쟁사 중 점수 상승한 곳 있는지 확인
        comp_gaining = any(
            (latest_comp_raw.get(cid) or {}).get("score", 0) >
            (prev_comp_raw.get(cid) or {}).get("score", 0)
            for cid in latest_comp_raw
        )
        if total_delta_val >= 2:
            headline = "AI 검색 노출이 개선되고 있습니다. 잘 하고 계십니다!"
            headline_type = "growth"
        elif total_delta_val <= -2:
            if growth_drivers:
                worst = min(growth_drivers, key=lambda d: d["delta"])
                label = worst["label"]
                headline = f"이번 달 노출이 줄었습니다. 가장 큰 원인은 '{label}' 부족입니다."
            else:
                headline = "이번 달 AI 검색 노출이 줄었습니다. 가이드에서 원인을 확인하세요."
            headline_type = "decline"
        elif comp_gaining and total_delta_val < 1:
            headline = "경쟁 가게가 점수를 올리고 있습니다. 지금 조치가 필요합니다."
            headline_type = "alert"
        else:
            headline = "큰 변화 없이 유지 중입니다. FAQ 추가 1건으로 다음 단계를 노려보세요."
            headline_type = "stable"

    # ── 5-C. 경쟁사 비교 ─────────────────────────────────────────────
    competitor_comparison: list[dict] = []
    if scans_raw:
        latest_comp_scores = scans_raw[-1].get("competitor_scores") or {}
        prev_comp_scores   = scans_raw[-2].get("competitor_scores") if len(scans_raw) >= 2 else {}
        for cid, cdata in latest_comp_scores.items():
            if not isinstance(cdata, dict):
                continue
            cscore = _safe_float(cdata.get("score") or cdata.get("total_score"))
            prev_cscore = _safe_float(
                (prev_comp_scores.get(cid) or {}).get("score") or
                (prev_comp_scores.get(cid) or {}).get("total_score")
            )
            cdelta = round(cscore - prev_cscore, 1) if prev_cscore else 0.0
            competitor_comparison.append({
                "name":  cdata.get("name", "경쟁사"),
                "score": round(cscore, 1),
                "delta": cdelta,
            })
        competitor_comparison.sort(key=lambda x: x["score"], reverse=True)

    # ── 5-D. 행동→결과 연결 ───────────────────────────────────────────
    action_results: list[dict] = []
    try:
        from datetime import datetime as _dt, timezone as _tz, timedelta
        thirty_ago = (_dt.now(_tz.utc) - timedelta(days=30)).date().isoformat()
        logs_res = await execute(
            supabase.table("business_action_log")
            .select("action_label, action_date, score_before, score_after, action_type")
            .eq("business_id", biz_id)
            .gte("action_date", thirty_ago)
            .order("action_date", desc=False)
            .limit(10)
        )
        for log in (logs_res.data or []):
            sb = log.get("score_before")
            sa = log.get("score_after")
            action_results.append({
                "action_label": log.get("action_label", ""),
                "action_date":  log.get("action_date", ""),
                "score_before": round(_safe_float(sb), 1) if sb is not None else None,
                "score_after":  round(_safe_float(sa), 1) if sa is not None else None,
                "action_type":  log.get("action_type", ""),
                "delta":        round(_safe_float(sa) - _safe_float(sb), 1) if (sb is not None and sa is not None) else None,
                "pending":      sb is not None and sa is None,
            })
    except Exception as e:
        _logger.warning("action_results 조회 실패: %s", e)

    # ── 5-E. AI 브리핑 노출 추이 ─────────────────────────────────────
    briefing_trend: list[dict] = []
    for scan in scans_raw:
        naver_r = scan.get("naver_result") or {}
        briefing_trend.append({
            "date":      (scan.get("scanned_at") or "")[:10],
            "mentioned": bool(naver_r.get("briefing_mentioned", False)),
        })
    briefing_total = sum(1 for b in briefing_trend if b["mentioned"])

    # ── 5-F. 키워드 해결 추이 ─────────────────────────────────────────
    keyword_resolution: dict = {"resolved": [], "still_missing": []}
    if len(scans_raw) >= 2:
        first_missing  = set(scans_raw[0].get("top_missing_keywords")  or [])
        latest_missing = set(scans_raw[-1].get("top_missing_keywords") or [])
        keyword_resolution = {
            "resolved":      sorted(first_missing - latest_missing),
            "still_missing": sorted(latest_missing),
        }
    elif scans_raw:
        keyword_resolution["still_missing"] = sorted(
            scans_raw[-1].get("top_missing_keywords") or []
        )

    # ── 5-G. 이번 달 할 일 3가지 ─────────────────────────────────────
    monthly_checklist: list[dict] = []
    if scans_raw:
        latest_bd = scans_raw[-1].get("score_breakdown") or {}
        _checklist_map = {
            "keyword_gap_score":        {"text": "가이드에서 추천 키워드 1개를 포스트 제목에 추가하세요", "link": "/guide", "minutes": 5},
            "smart_place_completeness": {"text": "스마트플레이스 소개글에 Q&A 1개를 추가하세요", "link": "/guide", "minutes": 5},
            "schema_seo":               {"text": "AI 검색 등록(JSON-LD) 코드를 내 사이트에 적용하세요", "link": "/schema", "minutes": 10},
            "review_quality":           {"text": "최근 리뷰에 키워드가 담긴 답변을 달아주세요", "link": "/guide", "minutes": 3},
            "content_freshness":        {"text": "스마트플레이스 소식 1건을 이번 주 안에 올리세요", "link": "/guide", "minutes": 10},
            "naver_exposure_confirmed": {"text": "네이버 AI 브리핑 노출을 확인하세요", "link": "/dashboard", "minutes": 2},
        }
        sorted_bd = sorted(latest_bd.items(), key=lambda x: _safe_float(x[1]))
        for key, _ in sorted_bd:
            if key in _checklist_map and len(monthly_checklist) < 3:
                monthly_checklist.append(_checklist_map[key])
        defaults = [
            {"text": "가이드에서 추천 키워드 1개를 포스트 제목에 추가하세요", "link": "/guide", "minutes": 5},
            {"text": "스마트플레이스 소개글에 Q&A 1개를 추가하세요", "link": "/guide", "minutes": 5},
            {"text": "스마트플레이스 소식 1건을 이번 주 안에 올리세요", "link": "/guide", "minutes": 10},
        ]
        for d in defaults:
            if len(monthly_checklist) >= 3:
                break
            if not any(c["text"] == d["text"] for c in monthly_checklist):
                monthly_checklist.append(d)

    # ── 6. summary ────────────────────────────────────────────────────
    start_stage = (
        (trial_raw or {}).get("growth_stage")
        or (scans_raw[0].get("growth_stage") if scans_raw else None)
        or "생존기"
    )
    current_stage = (
        (scans_raw[-1].get("growth_stage") if scans_raw else None)
        or start_stage
    )

    summary = {
        "start_score":   round(start_score, 1),
        "current_score": round(current_score, 1),
        "total_delta":   round(current_score - start_score, 1),
        "start_grade":   _score_to_grade(start_score),
        "current_grade": _score_to_grade(current_score),
        "start_stage":   start_stage,
        "current_stage": current_stage,
        "scan_count":    len(scans_raw),
    }

    # ── 7. 다음 목표 ──────────────────────────────────────────────────
    latest_bd_for_goal = (scans_raw[-1].get("score_breakdown") if scans_raw else None) or {}
    next_goal = _next_goal(current_score, latest_bd_for_goal)

    # ── 8. days_active ────────────────────────────────────────────────
    from datetime import datetime, timezone
    today      = datetime.now(timezone.utc).date()
    days_active = 0
    anchor_at  = (
        (trial_raw or {}).get("scanned_at")
        or (scans_raw[0].get("scanned_at") if scans_raw else None)
    )
    if anchor_at:
        try:
            anchor_date = datetime.fromisoformat(anchor_at.replace("Z", "+00:00")).date()
            days_active = (today - anchor_date).days
        except Exception as e:
            _logger.warning(f"days_active parse failed: {e}")
            days_active = 0

    # ── 9. trial_scan 직렬화 ──────────────────────────────────────────
    trial_out = None
    if trial_raw:
        trial_out = {
            "scanned_at":      trial_raw.get("scanned_at"),
            "unified_score":   _safe_float(trial_raw.get("unified_score")),
            "track1_score":    _safe_float(trial_raw.get("track1_score")),
            "growth_stage":    trial_raw.get("growth_stage") or "생존기",
            "score_breakdown": trial_raw.get("score_breakdown") or {},
        }

    # ── 10. 플랜 제한 적용 ────────────────────────────────────────────
    locked = plan == "free"
    result = {
        "business_name":         biz_row.get("name"),
        "category":              biz_row.get("category"),
        "region":                biz_row.get("region"),
        "plan":                  plan,
        "days_active":           days_active,
        "trial_scan":            trial_out,
        "timeline":              [] if locked else timeline,
        "summary":               summary,
        "growth_drivers":        [] if locked else growth_drivers,
        "next_goal":             next_goal,
        "locked":                locked,
        "headline":              headline,
        "headline_type":         headline_type,
        "competitor_comparison": [] if locked else competitor_comparison,
        "action_results":        [] if locked else action_results,
        "briefing_trend":        [] if locked else briefing_trend,
        "briefing_total":        0  if locked else briefing_total,
        "keyword_resolution":    {"resolved": [], "still_missing": []} if locked else keyword_resolution,
        "monthly_checklist":     [] if locked else monthly_checklist,
    }

    _cache.set(cache_key, result, _TTL_RANKING)  # 30분
    return result


# ── 키워드 검색량 조회 (Basic+) ───────────────────────────────────────────────

@router.get("/keyword-volumes/{biz_id}")
async def get_keyword_volumes(biz_id: str, user=Depends(get_current_user)):
    """
    Basic+ 전용: gap_analyzer의 missing_keywords + pioneer_keywords 검색량 조회.
    네이버 검색광고 API 미설정 시 gap 데이터만 반환 (graceful degradation).
    """
    from middleware.plan_gate import get_user_plan, PLAN_LIMITS

    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])

    # Basic+ 플랜 확인
    plan = await get_user_plan(user["id"], supabase)
    if plan not in ("basic", "startup", "pro", "biz"):
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "required_plans": ["basic", "startup", "pro", "biz"]},
        )

    # 사업장 카테고리 조회
    biz = (await execute(
        supabase.table("businesses")
        .select("category, name")
        .eq("id", biz_id)
        .maybe_single()
    )).data
    if not biz:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")

    category = biz.get("category", "restaurant")

    # GapAnalysis에서 missing + pioneer 키워드 추출
    from services.gap_analyzer import analyze_gap_from_db
    gap = await analyze_gap_from_db(biz_id, supabase)

    target_keywords: list[str] = []
    if gap and gap.keyword_gap:
        kg = gap.keyword_gap
        target_keywords.extend(kg.missing_keywords[:10])
        target_keywords.extend(kg.pioneer_keywords[:5])
    if not target_keywords:
        return {
            "biz_id": biz_id,
            "category": category,
            "volumes": {},
            "message": "키워드 갭 데이터가 없습니다. 먼저 AI 스캔을 실행해주세요.",
        }

    # 중복 제거 후 최대 15개
    seen: set[str] = set()
    unique_keywords: list[str] = []
    for kw in target_keywords:
        if kw not in seen:
            seen.add(kw)
            unique_keywords.append(kw)
    unique_keywords = unique_keywords[:15]

    # 검색광고 API 호출 (캐시 포함)
    from services.naver_searchad import get_searchad_client
    client = get_searchad_client()
    volumes = await client.get_volumes_with_cache(unique_keywords, category, supabase)

    # 키워드 유형 레이블 추가
    missing_set = set(gap.keyword_gap.missing_keywords) if gap and gap.keyword_gap else set()
    pioneer_set = set(gap.keyword_gap.pioneer_keywords) if gap and gap.keyword_gap else set()

    enriched: dict[str, dict] = {}
    for kw in unique_keywords:
        vol = volumes.get(kw, {})
        enriched[kw] = {
            **vol,
            "type": "missing" if kw in missing_set else "pioneer" if kw in pioneer_set else "unknown",
        }

    return {
        "biz_id": biz_id,
        "category": category,
        "volumes": enriched,
        "keyword_count": len(enriched),
        "api_available": bool(volumes),  # API 미설정 시 False
    }


# ── 업종 트렌드 조회 (공개) ───────────────────────────────────────────────────

@router.get("/industry-trend/{category}")
async def get_industry_trend(category: str, region: str | None = None):
    """
    공개 엔드포인트 (인증 불필요): 업종별 네이버 검색 트렌드.
    DB 캐시 → DataLab API 순으로 조회 (7일 캐시).
    네이버 API 미설정 시 빈 결과 반환.
    """
    _TTL_TREND = 3600  # 1시간 인메모리 캐시

    cache_key = _cache._make_key("industry_trend", category, region or "all")
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    supabase = get_client()

    from services.naver_datalab import get_datalab_client
    client = get_datalab_client()
    result = await client.get_trend_with_cache(category, region, supabase)

    # 에러가 있어도 빈 결과로 처리 (graceful degradation)
    if result.get("error"):
        _logger.debug(f"industry_trend error [{category}/{region}]: {result['error']}")
        empty = {
            "category": category,
            "region": region,
            "trend_data": [],
            "trend_direction": "stable",
            "trend_delta": 0.0,
            "available": False,
            "message": "트렌드 데이터를 불러오는 중입니다.",
        }
        _cache.set(cache_key, empty, 300)  # 에러 시 5분 캐시
        return empty

    result["available"] = bool(result.get("trend_data"))
    _cache.set(cache_key, result, _TTL_TREND)
    return result



# ── 네이버 SearchAd 키워드 볼륨 (등록 키워드 기반) ───────────────────────────

@router.get("/keyword-volume/{biz_id}")
async def get_keyword_volume(biz_id: str, user=Depends(get_current_user)):
    """네이버 검색광고 API로 사업장 등록 키워드의 월간 검색량 조회 (Basic+ 전용, 7일 캐시)"""
    from middleware.plan_gate import get_user_plan

    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])

    plan = await get_user_plan(user["id"], supabase)
    if plan not in ("basic", "startup", "pro", "biz"):
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "required_plans": ["basic", "startup", "pro", "biz"]},
        )

    biz = (await execute(
        supabase.table("businesses").select("keywords, category").eq("id", biz_id).single()
    )).data
    if not biz:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")

    keywords = (biz.get("keywords") or [])[:10]
    if not keywords:
        return {"volumes": {}, "message": "등록된 키워드가 없습니다"}

    from services.naver_searchad import get_searchad_client
    client = get_searchad_client()
    volumes = await client.get_volumes_with_cache(keywords, biz.get("category", ""), supabase)
    return {"volumes": volumes, "keywords": keywords}


# ── 스마트플레이스 vs 경쟁사 1:1 비교표 ──────────────────────────────────────

async def _sync_my_place_completeness(biz_id: str, naver_place_id: str, supabase) -> None:
    """내 가게 스마트플레이스 완성도를 크롤링해 최신 scan_results에 저장."""
    try:
        from services.competitor_place_crawler import fetch_competitor_place_data
        data = await fetch_competitor_place_data(naver_place_id)
        if data.get("error"):
            _logger.warning(f"_sync_my_place_completeness 크롤링 실패 [{biz_id}]: {data['error']}")
            return

        sp_result = {
            "has_faq":         data.get("has_faq", False),
            "has_intro":       data.get("has_intro", False),
            "has_recent_post": data.get("has_recent_post", False),
            "has_menu":        data.get("has_menu", False),
            "has_hours":       data.get("has_hours", False),
            "photo_count":     data.get("photo_count", 0),
            "completeness_score": 0,
        }
        # completeness_score 계산 — [2026-05-01] has_faq 제거 (Q&A 탭 폐기), 30점 재배분
        # has_recent_post 30, has_intro 25, photo 10, menu 20, hours 15 = 100점
        sp_result["completeness_score"] = min(
            sp_result["has_recent_post"] * 30
            + sp_result["has_intro"] * 25
            + min(sp_result["photo_count"], 5) * 2
            + sp_result["has_menu"] * 20
            + sp_result.get("has_hours", False) * 15,
            100
        )

        # 최신 scan_results에 저장
        scan_row = (await execute(
            supabase.table("scan_results")
            .select("id")
            .eq("business_id", biz_id)
            .order("scanned_at", desc=True)
            .limit(1)
            .maybe_single()
        ))
        if scan_row.data:
            await execute(
                supabase.table("scan_results")
                .update({"smart_place_completeness_result": sp_result})
                .eq("id", scan_row.data["id"])
            )
            _logger.info(f"_sync_my_place_completeness 저장 완료 [{biz_id}]")
    except Exception as e:
        _logger.warning(f"_sync_my_place_completeness 오류 [{biz_id}]: {e}")


@router.get("/place-compare/{biz_id}")
async def get_place_compare(biz_id: str, background_tasks: BackgroundTasks, user=Depends(get_current_user)):
    """내 스마트플레이스 vs 경쟁사 항목별 1:1 비교 (Basic+, 1시간 캐시)"""
    from middleware.plan_gate import get_user_plan

    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])

    plan = await get_user_plan(user["id"], supabase)
    if plan not in ("basic", "startup", "pro", "biz"):
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "required_plans": ["basic", "startup", "pro", "biz"]},
        )

    # place_compare는 sp_auto 실시간 조회가 핵심이므로 캐시 스킵
    # (scan 완료 직후 즉시 반영 필요 — 기존 1시간 캐시 제거)
    cache_key = _cache._make_key("place_compare", biz_id)
    _cache.delete(cache_key)  # 혹시 남아있는 구버전 캐시 무효화

    # 내 사업장 정보
    biz = (await execute(
        supabase.table("businesses")
        .select("name, review_count, avg_rating, blog_mention_count, has_faq, has_intro, has_recent_post, naver_place_id")
        .eq("id", biz_id).single()
    )).data
    if not biz:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")

    # 최신 스캔의 smart_place_completeness_result에서 photo_count, has_menu, has_intro 가져오기
    sp_auto: dict = {}
    try:
        sp_row = (await execute(
            supabase.table("scan_results")
            .select("smart_place_completeness_result")
            .eq("business_id", biz_id)
            .not_.is_("smart_place_completeness_result", "null")
            .order("scanned_at", desc=True)
            .limit(1)
            .maybe_single()
        ))
        sp_auto = ((sp_row.data or {}).get("smart_place_completeness_result") or {})
    except Exception as e:
        _logger.warning(f"place_compare sp_auto 조회 실패 [{biz_id}]: {e}")

    sp_auto_syncing = False
    # sp_auto가 완전히 비어있을 때만 백그라운드 크롤링 (이미 데이터 있으면 스킵)
    if not sp_auto and biz.get("naver_place_id"):
        sp_auto_syncing = True
        background_tasks.add_task(
            _sync_my_place_completeness, biz_id, biz["naver_place_id"], supabase
        )

    # 경쟁사 목록 — 플랜별 최대 수 (pro/biz: 10개, 나머지: 5개)
    comp_limit = 10 if plan in ("pro", "biz") else 5
    competitors = (await execute(
        supabase.table("competitors")
        .select("id, name, naver_review_count, naver_avg_rating, has_faq, has_recent_post, has_menu, has_intro, naver_photo_count, blog_mention_count, detail_synced_at")
        .eq("business_id", biz_id)
        .eq("is_active", True)
        .order("naver_review_count", desc=True)
        .limit(comp_limit)
    )).data or []

    # 비교 항목 정의
    FIELDS = [
        {"key": "review_count",    "label": "리뷰 수",       "type": "number", "action": "리뷰를 더 받기 위해 '가이드 → 리뷰 유도 문구'에서 고객용 안내 카드를 인쇄해 카운터에 붙여두세요"},
        {"key": "avg_rating",      "label": "평균 평점",      "type": "rating", "action": "낮은 평점 리뷰에 키워드 담은 답변을 달면 개선됩니다"},
        {"key": "has_faq",         "label": "소개글 Q&A",     "type": "bool",   "action": "소개글 하단에 고객 자주 묻는 질문과 답변 3개를 추가하세요"},
        {"key": "has_intro",       "label": "소개글 등록",    "type": "bool",   "action": "기본정보 탭에 키워드 포함 소개글을 작성하세요"},
        {"key": "has_recent_post", "label": "최근 소식",      "type": "bool",   "action": "소식 탭에 주 1회 이상 게시물을 올리세요"},
        {"key": "has_menu",        "label": "메뉴/상품 등록", "type": "bool",   "action": "메뉴 탭에 대표 상품을 최소 3개 이상 등록하세요"},
        {"key": "photo_count",     "label": "사진 수",        "type": "number", "action": "사진 10장 이상 등록 시 노출 가능성이 높아집니다"},
        {"key": "blog_mention_count", "label": "블로그 언급 수",  "type": "number", "action": "네이버 블로그에 내 가게를 소개하는 글을 늘려 언급 수를 높이세요"},
    ]

    # 내 데이터 매핑 — sp_auto(Playwright 자동 체크) OR businesses 체크박스 (둘 중 True면 True)
    # sp_auto가 False negative를 가질 수 있으므로 businesses 테이블 값도 함께 고려
    my_data = {
        "review_count":    biz.get("review_count") or 0,
        "avg_rating":      float(biz.get("avg_rating")) if biz.get("avg_rating") else None,
        "has_faq":         bool(sp_auto.get("has_faq")) or bool(biz.get("has_faq")),
        "has_intro":       bool(sp_auto.get("has_intro")) or bool(biz.get("has_intro")),
        "has_recent_post": bool(sp_auto.get("has_recent_post")) or bool(biz.get("has_recent_post")),
        "has_menu":        bool(sp_auto.get("has_menu")),
        "photo_count":     int(sp_auto.get("photo_count") or 0),
        "blog_mention_count": int(biz.get("blog_mention_count") or 0),
    }

    # 경쟁사 데이터 매핑
    comp_data = []
    for c in competitors:
        comp_data.append({
            "id": c.get("id", ""),
            "name": c.get("name", ""),
            "synced_at": c.get("detail_synced_at"),
            "data": {
                "review_count":    c.get("naver_review_count") or 0,
                "avg_rating":      float(c.get("naver_avg_rating")) if c.get("naver_avg_rating") else None,
                "has_faq":         bool(c.get("has_faq")),
                "has_intro":       bool(c.get("has_intro")),
                "has_recent_post": bool(c.get("has_recent_post")),
                "has_menu":        bool(c.get("has_menu")),
                "photo_count":     c.get("naver_photo_count") or 0,
                "blog_mention_count": c.get("blog_mention_count") or 0,
            }
        })

    # 갭 분석: 경쟁사 중 최선값 대비 내 가게 차이
    gaps = []
    for field in FIELDS:
        key = field["key"]
        my_val = my_data.get(key, 0 if field["type"] in ("number", "rating") else False)
        best_comp_val = None
        best_comp_name = None
        for c in comp_data:
            cv = c["data"].get(key, 0 if field["type"] in ("number", "rating") else False)
            if cv is None:
                continue
            if best_comp_val is None:
                best_comp_val = cv
                best_comp_name = c["name"]
            elif field["type"] in ("number", "rating"):
                if cv > best_comp_val:
                    best_comp_val = cv
                    best_comp_name = c["name"]
            elif field["type"] == "bool":
                if cv and not best_comp_val:
                    best_comp_val = cv
                    best_comp_name = c["name"]

        needs_action = False
        if field["type"] in ("number", "rating"):
            my_num = my_val if my_val is not None else 0
            best_num = best_comp_val if best_comp_val is not None else 0
            needs_action = my_num < best_num
        elif field["type"] == "bool":
            needs_action = not my_val and bool(best_comp_val)

        gaps.append({
            "field": key,
            "label": field["label"],
            "type": field["type"],
            "my_value": my_val,
            "best_competitor_value": best_comp_val,
            "best_competitor_name": best_comp_name,
            "needs_action": needs_action,
            "action": field["action"] if needs_action else None,
        })

    # 프론트엔드 PlaceCompareTable 형식으로 변환
    # CompareRow: { field, label, type, mine, competitors: [{name, value, synced}], needs_action }
    rows = []
    for field in FIELDS:
        key = field["key"]
        mine_val = my_data.get(key)
        comp_entries = [
            {
                "id": c.get("id", ""),
                "name": c["name"],
                "value": c["data"].get(key),
                "synced": c.get("synced_at") is not None,
            }
            for c in comp_data
        ]
        comp_vals = [e["value"] for e in comp_entries]

        # 업종에 따라 지원되지 않는 항목 자동 제외:
        # bool: 내 가게 + 경쟁사 전체가 False → 이 업종은 해당 기능 없음 (비교 의미 없음)
        # rating: 데이터가 없어도 rows에 포함 → 프론트에서 "동기화 필요" 안내 표시
        if field["type"] == "bool":
            if not mine_val and all(not v for v in comp_vals):
                continue

        # needs_action: gap 분석 결과에서 해당 field 찾기
        gap_entry = next((g for g in gaps if g["field"] == key), None)

        # rating 타입이고 내 가게 + 경쟁사 전체가 None인 경우 → 동기화 필요 힌트 포함
        if field["type"] == "rating" and mine_val is None and all(v is None for v in comp_vals):
            rows.append({
                "field": key,
                "label": field["label"],
                "type": field["type"],
                "mine": None,
                "competitors": comp_entries,
                "needs_action": False,
                "action_hint": "경쟁사 카드에서 '네이버 데이터 동기화' 버튼을 눌러 평점 데이터를 가져오세요.",
            })
            continue

        rows.append({
            "field": key,
            "label": field["label"],
            "type": field["type"],
            "mine": mine_val,
            "competitors": comp_entries,
            "needs_action": gap_entry["needs_action"] if gap_entry else False,
            "action_hint": gap_entry["action"] if gap_entry and gap_entry.get("action") else None,
        })

    # gaps 필드: 프론트엔드는 hint 키 기대 (action → hint 동기화)
    gaps_frontend = [
        {
            "field": g["field"],
            "label": g["label"],
            "needs_action": g["needs_action"],
            "hint": g.get("action") or "",
        }
        for g in gaps
        if g["needs_action"]
    ]

    has_competitor_data = len(comp_data) > 0
    synced_at = None
    if competitors:
        synced_times = [c.get("detail_synced_at") for c in competitors if c.get("detail_synced_at")]
        synced_at = max(synced_times) if synced_times else None

    result = {
        "rows": rows,
        "gaps": gaps_frontend,
        "has_competitor_data": has_competitor_data,
        "synced_at": synced_at,
        # 하위호환 필드 (기존 API 사용자)
        "mine": my_data,
        "mine_name": biz.get("name", "내 가게"),
        "competitors": comp_data,
        "has_competitor_sync": any(c.get("detail_synced_at") for c in competitors),
        "sp_auto_syncing": sp_auto_syncing,
    }
    # place_compare는 캐시 저장 안 함 (sp_auto 실시간 반영 우선)
    return result


@router.get("/multi-biz-summary")
async def get_multi_biz_summary(user=Depends(get_current_user)):
    from middleware.plan_gate import get_user_plan
    from fastapi import HTTPException as _HTTPException
    user_id = user.get("id")
    supabase = get_client()
    plan = await get_user_plan(user_id, supabase)
    if plan not in ("biz",):
        raise _HTTPException(status_code=403, detail="Biz 이상 플랜 필요")
    bizzes = await execute(
        supabase.table("businesses").select("id, name, category, region")
        .eq("user_id", user_id).eq("is_active", True)
    )
    biz_list = bizzes.data or []
    if not biz_list:
        return {"items": []}
    biz_ids = [b["id"] for b in biz_list]
    scans_res = await execute(
        supabase.table("scan_results")
        .select("business_id, unified_score, track1_score, track2_score, total_score, scanned_at")
        .in_("business_id", biz_ids).order("scanned_at", desc=True)
    )
    scan_map: dict = {}
    for s in (scans_res.data or []):
        bid = s["business_id"]
        if bid not in scan_map:
            scan_map[bid] = s
    comp_res = await execute(
        supabase.table("competitors").select("business_id")
        .in_("business_id", biz_ids).eq("is_active", True)
    )
    comp_count: dict = {}
    for c in (comp_res.data or []):
        bid = c["business_id"]
        comp_count[bid] = comp_count.get(bid, 0) + 1
    items = []
    for biz in biz_list:
        bid = biz["id"]
        scan = scan_map.get(bid, {})
        score = scan.get("unified_score") or scan.get("total_score") or 0
        items.append({
            "id": bid,
            "name": biz["name"],
            "category": biz.get("category", ""),
            "region": biz.get("region", ""),
            "unified_score": round(float(score), 1),
            "track1_score": round(float(scan.get("track1_score") or 0), 1),
            "track2_score": round(float(scan.get("track2_score") or 0), 1),
            "competitor_count": comp_count.get(bid, 0),
            "last_scanned_at": scan.get("scanned_at"),
        })
    return {"items": items}


@router.get("/sentiment/{biz_id}")
async def get_review_sentiment(biz_id: str, user=Depends(get_current_user)):
    from utils import cache as _cache
    from fastapi import HTTPException as _HE
    from middleware.plan_gate import get_user_plan
    user_id = user.get("id")
    supabase = get_client()
    plan = await get_user_plan(user_id, supabase)
    if plan == "free":
        raise _HE(status_code=403, detail="Basic 이상 플랜 필요")
    # 소유권 검증 (캐시 확인 전 — 타인 데이터 캐시 반환 방지)
    biz_row = await execute(
        supabase.table("businesses").select("id, name, user_id").eq("id", biz_id).maybe_single()
    )
    if not (biz_row and biz_row.data) or biz_row.data.get("user_id") != user_id:
        raise _HE(status_code=404, detail="사업장을 찾을 수 없습니다")
    cache_key = f"sentiment:{biz_id}"
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached
    biz_name = biz_row.data.get("name", "")
    cit_res = await execute(
        supabase.table("ai_citations").select("excerpt, sentiment")
        .eq("business_id", biz_id).eq("mentioned", True)
        .order("created_at", desc=True).limit(50)
    )
    rows = cit_res.data or []
    labeled = [r for r in rows if r.get("sentiment") in ("positive", "neutral", "negative")]
    if len(labeled) >= 2:
        pos = sum(1 for r in labeled if r["sentiment"] == "positive")
        neu = sum(1 for r in labeled if r["sentiment"] == "neutral")
        neg = sum(1 for r in labeled if r["sentiment"] == "negative")
        result = {"positive": pos, "neutral": neu, "negative": neg,
                  "top_positive": [], "top_negative": [], "total": len(labeled), "status": "ok"}
    else:
        excerpts = [r["excerpt"] for r in rows if r.get("excerpt")]
        if not excerpts:
            scan_res = await execute(
                supabase.table("scan_results")
                .select("gemini_result, naver_result")
                .eq("business_id", biz_id)
                .order("scanned_at", desc=True).limit(1)
            )
            if scan_res.data:
                sr = scan_res.data[0]
                gemini = sr.get("gemini_result") or {}
                naver = sr.get("naver_result") or {}
                excerpts += gemini.get("review_excerpts", []) or []
                excerpts += naver.get("review_excerpts", []) or []
        from services.review_sentiment import analyze_review_sentiment
        result = await analyze_review_sentiment(biz_id, excerpts, biz_name)
    _cache.set(cache_key, result, 3600)
    return result


@router.get("/growth-card/{biz_id}")
async def get_growth_card(biz_id: str, user=Depends(get_current_user)):
    from fastapi import HTTPException as _HE2
    from middleware.plan_gate import get_user_plan
    user_id = user.get("id")
    supabase = get_client()
    plan = await get_user_plan(user_id, supabase)
    if plan == "free":
        raise _HE2(status_code=403, detail="Basic 이상 플랜 필요")
    biz_row = await execute(
        supabase.table("businesses").select("id, user_id").eq("id", biz_id).single()
    )
    if not biz_row.data or biz_row.data.get("user_id") != user_id:
        raise _HE2(status_code=404, detail="사업장을 찾을 수 없습니다")
    # Storage에서 최신 growth 카드 URL 조회
    try:
        result = supabase.storage.from_("before-after").list(f"growth/{biz_id}", {"limit": 10, "sortBy": {"column": "name", "order": "desc"}})
        files = result if isinstance(result, list) else []
        if files:
            latest = files[0]["name"]
            url = supabase.storage.from_("before-after").get_public_url(f"growth/{biz_id}/{latest}")
            return {"card_url": url, "filename": latest}
    except Exception as e:
        import logging
        logging.getLogger("aeolab.report").warning(f"growth_card list error: {e}")
    return {"card_url": None, "filename": None}


@router.get("/ai-citations/{biz_id}")
async def get_ai_citations(
    biz_id: str,
    limit: int = 10,
    user=Depends(get_current_user),
):
    """AI가 실제로 내 가게를 언급한 문장 조회 + 미언급 키워드 합성 (Basic+)"""
    from middleware.plan_gate import get_user_plan
    from fastapi import HTTPException as _HEac

    user_id = user.get("id")
    supabase = get_client()

    # Basic+ 플랜 확인
    plan = await get_user_plan(user_id, supabase)
    if plan == "free":
        raise _HEac(status_code=403, detail="Basic 이상 플랜 필요")

    # 소유권 확인 + keywords / region 동시 조회
    biz_row = await execute(
        supabase.table("businesses")
        .select("id, user_id, keywords, region")
        .eq("id", biz_id)
        .maybe_single()
    )
    if not biz_row.data or biz_row.data.get("user_id") != user_id:
        raise _HEac(status_code=404, detail="사업장을 찾을 수 없습니다")

    biz_data = biz_row.data
    registered_keywords: list = biz_data.get("keywords") or []
    region: str = biz_data.get("region") or ""

    # 최근 3회 스캔 ID 조회
    scan_res = await execute(
        supabase.table("scan_results")
        .select("id")
        .eq("business_id", biz_id)
        .order("scanned_at", desc=True)
        .limit(3)
    )
    scan_ids = [r["id"] for r in (scan_res.data or []) if r.get("id")]

    # ai_citations 실제 데이터 조회 — .eq("mentioned", True) 제거 (미언급 DB 행도 포함)
    real_rows: list = []
    if scan_ids:
        scan_cit = await execute(
            supabase.table("ai_citations")
            .select("platform, query, mentioned, excerpt, sentiment, mention_type, created_at")
            .in_("scan_id", scan_ids)
            .order("created_at", desc=True)
        )
        real_rows = scan_cit.data or []

    # 플랫폼 한글 레이블 매핑
    PLATFORM_LABELS = {
        "gemini": "Google Gemini",
        "chatgpt": "ChatGPT",
        "grok": "Grok",
        "naver": "네이버 AI 브리핑",
        "claude": "Claude",
        "google": "Google AI Overview",
    }

    enriched_real = []
    for c in real_rows:
        enriched_real.append({
            "id": None,
            "platform": c.get("platform", ""),
            "platform_label": PLATFORM_LABELS.get(c.get("platform", ""), c.get("platform", "")),
            "query": c.get("query", ""),
            "excerpt": c.get("excerpt", ""),
            "sentiment": c.get("sentiment", "neutral"),
            "mentioned": c.get("mentioned", False),
            "mention_type": c.get("mention_type", "information"),
            "created_at": c.get("created_at", ""),
        })

    # 미언급 키워드 합성 행 생성
    # DB에 이미 query로 등록된 키워드 추출 (언급/미언급 불문)
    cited_queries: set = {c["query"] for c in enriched_real if c.get("query")}

    synthetic_rows = []
    if registered_keywords:
        for kw in registered_keywords:
            # 이 키워드가 포함된 query가 이미 실제 데이터에 있으면 합성 생략
            kw_already_present = any(kw in q for q in cited_queries)
            if not kw_already_present:
                query_text = f"{region} {kw} 추천" if region else f"{kw} 추천"
                synthetic_rows.append({
                    "id": None,
                    "platform": "naver",
                    "platform_label": "네이버 AI 브리핑",
                    "query": query_text,
                    "excerpt": "",
                    "sentiment": "neutral",
                    "mentioned": False,
                    "mention_type": "synthetic",
                    "created_at": None,
                })

    # 실제 언급(mentioned=True) 먼저, 미언급 DB 행, 합성 행 순으로 정렬 후 limit 적용
    mentioned_rows = [r for r in enriched_real if r.get("mentioned")]
    unmentioned_real = [r for r in enriched_real if not r.get("mentioned")]
    combined = (mentioned_rows + unmentioned_real + synthetic_rows)[:limit]

    return {
        "citations": combined,
        "total": len(combined),
        "has_data": any(r.get("mentioned") for r in combined),
    }


# -----------------------------------------------------------
# v3.1 행동-결과 타임라인 API (A-3, B-4)
# -----------------------------------------------------------

@router.post("/action-log/{biz_id}")
async def log_business_action(
    biz_id: str,
    action_type: str = Body(..., embed=True),
    action_label: str = Body(..., embed=True),
    user: dict = Depends(get_current_user),
):
    """사업장 행동 이력 저장 (체크박스 체크, 가이드 생성 등)"""
    user_id = user["id"]
    supabase = get_client()

    biz = await execute(
        supabase.table("businesses")
        .select("id")
        .eq("id", biz_id)
        .eq("user_id", user_id)
        .maybe_single()
    )
    if not (biz and biz.data):
        raise HTTPException(status_code=403, detail="권한 없음")

    from middleware.plan_gate import get_user_plan
    plan = await get_user_plan(user_id, supabase)
    if plan == "free":
        raise HTTPException(status_code=403, detail="Basic 이상 플랜 필요")

    score_before = None
    try:
        latest_score = await execute(
            supabase.table("score_history")
            .select("unified_score, total_score")
            .eq("business_id", biz_id)
            .order("score_date", desc=True)
            .limit(1)
            .maybe_single()
        )
        if latest_score and latest_score.data:
            score_before = (
                latest_score.data.get("unified_score")
                or latest_score.data.get("total_score")
            )
    except Exception as e:
        _logger.warning("[action_log] score_history 조회 실패: %s", e)

    try:
        await execute(
            supabase.table("business_action_log")
            .insert({
                "business_id": biz_id,
                "action_type": action_type,
                "action_label": action_label,
                "score_before": score_before,
            })
        )
    except Exception as e:
        _logger.warning("[action_log] 저장 실패: %s", e)
        return {
            "ok": False,
            "message": "action_log 테이블이 없습니다. Supabase SQL Editor에서 스키마를 실행해 주세요.",
        }

    return {"ok": True, "score_before": score_before}


@router.get("/action-log/{biz_id}")
async def get_action_log(
    biz_id: str,
    days: int = 30,
    user: dict = Depends(get_current_user),
):
    """사업장 행동 이력 조회 (추세선 오버레이용)"""
    user_id = user["id"]
    supabase = get_client()

    biz = await execute(
        supabase.table("businesses")
        .select("id")
        .eq("id", biz_id)
        .eq("user_id", user_id)
        .maybe_single()
    )
    if not (biz and biz.data):
        raise HTTPException(status_code=403, detail="권한 없음")

    from datetime import date as _date, timedelta as _td
    since = (_date.today() - _td(days=days)).isoformat()

    try:
        logs = await execute(
            supabase.table("business_action_log")
            .select(
                "action_type, action_label, action_date, score_before, score_after, created_at"
            )
            .eq("business_id", biz_id)
            .gte("action_date", since)
            .order("action_date", desc=False)
        )
    except Exception as e:
        _logger.warning("[action_log] 조회 실패: %s", e)
        return {"logs": []}

    return {"logs": (logs.data if logs and hasattr(logs, "data") else logs) or []}


@router.get("/competitor-faq-gap/{biz_id}")
async def get_competitor_faq_gap(
    biz_id: str,
    user: dict = Depends(get_current_user),
):
    """경쟁사 FAQ 갭: 경쟁사 스마트플레이스에 등록된 질문 중 내 가게에 없는 Q 목록.

    v3.4 신규 — 주 1회 수집된 competitor_faqs 데이터로 차이 분석.
    "ChatGPT로는 얻을 수 없는 데이터" 직접 증거.
    """
    user_id = user["id"]
    supabase = get_client()

    biz = await execute(
        supabase.table("businesses")
        .select("id, name")
        .eq("id", biz_id)
        .eq("user_id", user_id)
        .maybe_single()
    )
    if not (biz and biz.data):
        raise HTTPException(status_code=403, detail="권한 없음")

    try:
        comps_resp = await execute(
            supabase.table("competitors")
            .select("id, name, naver_place_id")
            .eq("business_id", biz_id)
            .eq("is_active", True)
        )
        comps = (comps_resp.data if comps_resp and hasattr(comps_resp, "data") else comps_resp) or []
    except Exception as e:
        _logger.warning("[competitor_faq_gap] 경쟁사 조회 실패: %s", e)
        comps = []

    comp_ids = [c.get("id") for c in comps if c.get("id")]
    if not comp_ids:
        return {"gap_count": 0, "competitors": [], "pooled_questions": [], "message": "경쟁사를 등록하면 FAQ 갭 분석이 시작됩니다."}

    try:
        faqs_resp = await execute(
            supabase.table("competitor_faqs")
            .select("competitor_id, questions, collected_at")
            .in_("competitor_id", comp_ids)
            .order("collected_at", desc=True)
        )
        faqs = (faqs_resp.data if faqs_resp and hasattr(faqs_resp, "data") else faqs_resp) or []
    except Exception as e:
        _logger.warning("[competitor_faq_gap] FAQ 조회 실패: %s", e)
        faqs = []

    # 각 경쟁사의 최신 FAQ만 유지
    latest_by_comp: dict[str, dict] = {}
    for f in faqs:
        cid = f.get("competitor_id")
        if cid and cid not in latest_by_comp:
            latest_by_comp[cid] = f

    # 경쟁사별 이름과 질문 매핑 + 전체 풀
    comp_map = {c["id"]: c for c in comps}
    competitor_rows = []
    pooled: dict[str, list[str]] = {}
    for cid, f in latest_by_comp.items():
        qs = f.get("questions") or []
        if not isinstance(qs, list):
            continue
        cname = comp_map.get(cid, {}).get("name", "경쟁사")
        competitor_rows.append({
            "competitor_id": cid,
            "competitor_name": cname,
            "questions": qs,
            "collected_at": f.get("collected_at"),
        })
        for q in qs:
            q_norm = str(q).strip()
            if not q_norm:
                continue
            pooled.setdefault(q_norm, []).append(cname)

    # 경쟁사 2곳 이상 공통 질문 우선순위
    pooled_rows = [
        {"question": q, "asked_by": list(dict.fromkeys(names)), "count": len(set(names))}
        for q, names in pooled.items()
    ]
    pooled_rows.sort(key=lambda r: (-r["count"], r["question"]))

    return {
        "business_name": biz.data.get("name"),
        "gap_count": len(pooled_rows),
        "competitors": competitor_rows,
        "pooled_questions": pooled_rows[:20],
    }


@router.get("/action-timeline/{biz_id}")
async def get_action_timeline(
    biz_id: str,
    user: dict = Depends(get_current_user),
):
    """행동-결과 타임라인: 행동 시점 ±7일 일별 점수 히스토리 반환.

    "7일 후 점수 변화 자동 기록" 랜딩 문구의 사실적 근거.
    각 action_log 항목에 대해 action_date±7일 범위의 score_history를
    조회해 차트용 데이터를 반환한다.
    """
    user_id = user["id"]
    supabase = get_client()

    biz = await execute(
        supabase.table("businesses")
        .select("id, name")
        .eq("id", biz_id)
        .eq("user_id", user_id)
        .maybe_single()
    )
    if not (biz and biz.data):
        raise HTTPException(status_code=403, detail="권한 없음")

    from datetime import date as _date, timedelta as _td
    today = _date.today()
    since = (today - _td(days=30)).isoformat()

    # 최근 30일 행동 로그
    try:
        logs_resp = await execute(
            supabase.table("business_action_log")
            .select("action_type, action_label, action_date, score_before, score_after")
            .eq("business_id", biz_id)
            .gte("action_date", since)
            .order("action_date", desc=False)
        )
        logs = (logs_resp.data if logs_resp and hasattr(logs_resp, "data") else logs_resp) or []
    except Exception as e:
        _logger.warning("[action_timeline] 로그 조회 실패: %s", e)
        logs = []

    # 점수 히스토리 (광역 범위 — 가장 오래된 행동 -7일 ~ 오늘)
    earliest = min([log.get("action_date") for log in logs if log.get("action_date")], default=since)
    try:
        earliest_dt = _date.fromisoformat(str(earliest))
        history_since = (earliest_dt - _td(days=7)).isoformat()
    except Exception:
        history_since = since

    try:
        history_resp = await execute(
            supabase.table("score_history")
            .select("score_date, unified_score, total_score, track1_score, track2_score")
            .eq("business_id", biz_id)
            .gte("score_date", history_since)
            .order("score_date", desc=False)
        )
        history = (history_resp.data if history_resp and hasattr(history_resp, "data") else history_resp) or []
    except Exception as e:
        _logger.warning("[action_timeline] 히스토리 조회 실패: %s", e)
        history = []

    # 각 행동에 대해 ±7일 윈도우를 구성
    windows = []
    for log in logs:
        a_date = log.get("action_date")
        if not a_date:
            continue
        try:
            center = _date.fromisoformat(str(a_date))
        except Exception:
            continue
        lo = (center - _td(days=2)).isoformat()
        hi = (center + _td(days=7)).isoformat()
        window_points = [
            {
                "date": p.get("score_date"),
                "score": p.get("unified_score") if p.get("unified_score") is not None else p.get("total_score"),
                "track1": p.get("track1_score"),
                "track2": p.get("track2_score"),
            }
            for p in history
            if lo <= str(p.get("score_date") or "") <= hi
        ]
        windows.append({
            "action_type": log.get("action_type"),
            "action_label": log.get("action_label"),
            "action_date": a_date,
            "score_before": log.get("score_before"),
            "score_after": log.get("score_after"),
            "timeline": window_points,
        })

    return {
        "business_name": biz.data.get("name"),
        "action_count": len(windows),
        "windows": windows,
        "history": [
            {
                "date": p.get("score_date"),
                "score": p.get("unified_score") if p.get("unified_score") is not None else p.get("total_score"),
            }
            for p in history
        ],
    }


@router.get("/condition-search/{biz_id}")
async def get_condition_search(
    biz_id: str,
    user=Depends(get_current_user),
):
    """조건검색 시뮬레이션 -- 실제 고객 검색 방식으로 AI 노출 확인 (Pro+).

    "강남 주차 가능 식당" 처럼 조건이 붙은 검색어로 내 가게가
    Gemini AI 응답에 언급되는지 업종별 상위 5개 쿼리로 확인합니다.
    결과는 1시간 캐시됩니다.
    """
    from middleware.plan_gate import get_user_plan, PLAN_HIERARCHY
    user_id = user["id"]
    supabase = get_client()

    # Pro+ 플랜 체크
    plan = await get_user_plan(user_id, supabase)
    if PLAN_HIERARCHY.get(plan, 0) < PLAN_HIERARCHY.get("pro", 0):
        raise HTTPException(status_code=403, detail="Pro 이상 플랜에서 이용할 수 있습니다")

    # 소유권 검증
    biz_row = await execute(
        supabase.table("businesses")
        .select("id, name, category, region, keywords")
        .eq("id", biz_id)
        .eq("user_id", user_id)
        .maybe_single()
    )
    if not (biz_row and biz_row.data):
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")

    biz_data = biz_row.data

    # 1시간 캐시 확인
    cache_key = f"condition_search:{biz_id}"
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    # 사업장 등록 키워드로 쿼리 생성 (없으면 카테고리 기반 폴백)
    _biz_keywords = [k.strip() for k in (biz_data.get("keywords") or []) if k.strip() and len(k.strip()) >= 2]
    _region = biz_data.get("region", "") or ""
    _region_short = _region.split()[-1] if _region else _region
    _region_short = (
        _region_short.replace("특별시", "").replace("광역시", "")
        .replace("시", "").replace("군", "").replace("구", "").strip()
    ) or _region_short

    if _biz_keywords:
        # 등록 키워드마다 "{지역} {키워드}" 쿼리 생성 (최대 5개)
        _keyword_queries = [
            f"{_region_short} {kw}" if _region_short else kw
            for kw in _biz_keywords[:5]
        ]
    else:
        _keyword_queries = None  # 폴백: category 기반

    from services.condition_search_scanner import run_condition_search
    results = await run_condition_search(
        business_name=biz_data.get("name", ""),
        category=biz_data.get("category", ""),
        region=_region,
        queries=_keyword_queries,
        business_id=biz_id,
    )

    response = {
        "biz_id": biz_id,
        "results": results,
        "total": len(results),
        "mentioned_count": sum(1 for r in results if r["mentioned"]),
    }
    _cache.set(cache_key, response, ttl=3600)
    return response

# ── 점수 설명 API (Basic+) ─────────────────────────────────────────────────────

@router.get("/score-explanation/{biz_id}")
async def get_score_explanation(biz_id: str, user=Depends(get_current_user)):
    """항목별 점수 설명 — 왜 이 점수가 나왔는지 텍스트로 반환 (Basic+).

    최신 scan_result를 조회하여 각 트랙·항목별 점수 원인을 계산합니다.
    결과는 1시간 TTL 캐시됩니다.
    """
    from middleware.plan_gate import get_user_plan, PLAN_HIERARCHY

    user_id = user["id"]
    supabase = get_client()

    # Basic+ 플랜 체크
    plan = await get_user_plan(user_id, supabase)
    if PLAN_HIERARCHY.get(plan, 0) < PLAN_HIERARCHY.get("basic", 1):
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "message": "Basic 이상 플랜에서 이용할 수 있습니다", "upgrade_url": "/pricing"},
        )

    await _verify_biz_ownership(supabase, biz_id, user_id)

    cache_key = f"score_explanation:{biz_id}"
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    # 사업장 기본 정보
    biz = (
        await execute(
            supabase.table("businesses")
            .select("name, category, has_faq, has_recent_post, has_intro, is_smart_place, review_count, avg_rating, keywords")
            .eq("id", biz_id)
            .maybe_single()
        )
    ).data
    if not biz:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")

    # 최신 스캔 결과
    scan = (
        await execute(
            supabase.table("scan_results")
            .select(
                "total_score, track1_score, track2_score, unified_score, "
                "keyword_coverage, exposure_freq, naver_channel_score, global_channel_score, "
                "score_breakdown, website_check_result, scanned_at"
            )
            .eq("business_id", biz_id)
            .order("scanned_at", desc=True)
            .limit(1)
        )
    ).data
    if not scan:
        raise HTTPException(status_code=404, detail="스캔 결과가 없습니다. 먼저 AI 스캔을 실행해주세요.")

    r = scan[0]
    breakdown: dict = r.get("score_breakdown") or {}
    wc: dict = r.get("website_check_result") or {}

    # ── Track1 설명 생성 ──────────────────────────────────────────────────────
    t1_parts = []

    sp_score = breakdown.get("smart_place_completeness", 0)
    if sp_score < 30:
        missing = []
        if not biz.get("has_faq"):
            missing.append("FAQ 미등록 (-15점)")
        if not biz.get("has_recent_post"):
            missing.append("최근 소식 없음 (-10점)")
        if not biz.get("has_intro"):
            missing.append("소개글 없음 (-8점)")
        if missing:
            t1_parts.append("스마트플레이스 미완성: " + ", ".join(missing))
    elif sp_score < 60:
        t1_parts.append(f"스마트플레이스 일부 완성 (점수 {sp_score:.0f}/100)")
    else:
        t1_parts.append(f"스마트플레이스 잘 완성됨 (점수 {sp_score:.0f}/100)")

    kw_cov = float(r.get("keyword_coverage") or 0)
    if kw_cov < 0.3:
        kw_score = breakdown.get("keyword_gap_score", 0)
        t1_parts.append(f"리뷰 키워드 커버리지 낮음 (현재 {kw_cov*100:.0f}%, 목표 70%+, 점수 {kw_score:.0f}/100)")
    elif kw_cov < 0.6:
        t1_parts.append(f"리뷰 키워드 커버리지 보통 ({kw_cov*100:.0f}%)")
    else:
        t1_parts.append(f"리뷰 키워드 커버리지 양호 ({kw_cov*100:.0f}%)")

    rv = breakdown.get("review_quality", 0)
    rc = biz.get("review_count") or 0
    ar = biz.get("avg_rating") or 0
    if rv < 30:
        t1_parts.append(f"리뷰 부족 (현재 {rc}개, 평점 {ar:.1f} — 리뷰 20개+ / 평점 4.5+ 목표)")
    elif rv < 60:
        t1_parts.append(f"리뷰 점수 보통 ({rc}개, 평점 {ar:.1f})")
    else:
        t1_parts.append(f"리뷰 점수 양호 ({rc}개, 평점 {ar:.1f})")

    naver_exposed = breakdown.get("naver_exposure_confirmed", 0)
    if naver_exposed < 50:
        t1_parts.append("네이버 AI 브리핑 미노출 확인 — 소개글 Q&A 추가와 키워드 보강이 핵심")

    track1_reason = " / ".join(t1_parts) if t1_parts else "트랙 1 데이터 부족"

    # ── Track2 설명 생성 ──────────────────────────────────────────────────────
    t2_parts = []

    multi_ai = breakdown.get("multi_ai_exposure", 0)
    ef = int(r.get("exposure_freq") or 0)
    if multi_ai < 30:
        t2_parts.append(f"글로벌 AI 노출 없음 (Gemini 100회 중 {ef}회 언급) — 웹사이트 Schema·한국어 콘텐츠 부족")
    elif multi_ai < 60:
        t2_parts.append(f"글로벌 AI 간헐적 노출 ({ef}회/100회)")
    else:
        t2_parts.append(f"글로벌 AI 양호한 노출 ({ef}회/100회)")

    schema_seo = breakdown.get("schema_seo", 0)
    if schema_seo < 30:
        seo_issues = []
        if not wc.get("has_json_ld"):
            seo_issues.append("JSON-LD 없음")
        if not wc.get("has_open_graph"):
            seo_issues.append("Open Graph 태그 없음")
        if not wc.get("is_https"):
            seo_issues.append("HTTPS 미적용")
        if not wc.get("is_mobile_friendly"):
            seo_issues.append("모바일 최적화 없음")
        if seo_issues:
            t2_parts.append("웹사이트 SEO 문제: " + ", ".join(seo_issues))
        else:
            t2_parts.append(f"웹사이트 SEO 점수 낮음 ({schema_seo:.0f}/100)")
    elif schema_seo < 60:
        t2_parts.append(f"웹사이트 SEO 개선 중 ({schema_seo:.0f}/100)")
    else:
        t2_parts.append(f"웹사이트 SEO 양호 ({schema_seo:.0f}/100)")

    track2_reason = " / ".join(t2_parts) if t2_parts else "트랙 2 데이터 부족"

    # ── 개선 우선순위 TOP 3 ────────────────────────────────────────────────────
    PRIORITY_MAP = {
        "smart_place_completeness": ("스마트플레이스 소개글·소식 완성", "basic"),
        "keyword_gap_score": ("리뷰 키워드 커버리지 확장", "basic"),
        "review_quality": ("리뷰 수·평점 향상", "basic"),
        "naver_exposure_confirmed": ("네이버 AI 브리핑 노출 확보", "basic"),
        "multi_ai_exposure": ("글로벌 AI 노출 확대", "pro"),
        "schema_seo": ("웹사이트 Schema·SEO 개선", "pro"),
    }
    sorted_items = sorted(breakdown.items(), key=lambda x: float(x[1] or 0))
    top_actions = []
    for k, v in sorted_items[:3]:
        label, needed_plan = PRIORITY_MAP.get(k, (k, "basic"))
        top_actions.append({"item": label, "current_score": round(float(v or 0), 1), "plan": needed_plan})

    result = {
        "biz_id": biz_id,
        "scanned_at": r.get("scanned_at"),
        "track1_reason": track1_reason,
        "track2_reason": track2_reason,
        "track1_score": r.get("track1_score"),
        "track2_score": r.get("track2_score"),
        "unified_score": r.get("unified_score"),
        "top_priority_actions": top_actions,
        "breakdown": breakdown,
    }

    _cache.set(cache_key, result, ttl=3600)
    return result


# ============================================================
# 블로그 키워드 스크린샷 (v3.5)
# ============================================================

@router.get("/blog-screenshots/{biz_id}")
async def get_blog_screenshots(biz_id: str, user=Depends(get_current_user)):
    """사업장 키워드별 최신 블로그 스크린샷 목록 반환
    각 키워드별로 가장 최근 캡처 1개씩 반환
    """
    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])

    # 사업장 키워드 목록 조회
    biz_res = await execute(
        supabase.table("businesses")
        .select("keywords")
        .eq("id", biz_id)
        .maybe_single()
    )
    if not (biz_res and biz_res.data):
        return []

    keywords = biz_res.data.get("keywords") or []
    if not keywords:
        return []

    # blog_keyword 타입의 스크린샷 전체 조회
    shots_res = await execute(
        supabase.table("before_after")
        .select("id, keyword, image_url, created_at")
        .eq("business_id", biz_id)
        .eq("capture_type", "blog_keyword")
        .order("created_at", desc=True)
    )
    shots = shots_res.data or []

    # 키워드별 최신 1개만 추출
    keyword_map: dict = {}
    for shot in shots:
        kw = shot.get("keyword") or ""
        if kw and kw not in keyword_map:
            keyword_map[kw] = {
                "keyword": kw,
                "screenshot_url": shot["image_url"],
                "captured_at": shot["created_at"],
            }

    # 사업장 등록 키워드 순서 기준으로 정렬, 캡처 없는 키워드도 포함(url=None)
    result = []
    for kw in keywords[:10]:
        kw = kw.strip()
        if not kw:
            continue
        if kw in keyword_map:
            result.append(keyword_map[kw])
        else:
            result.append({"keyword": kw, "screenshot_url": None, "captured_at": None})

    return result


@router.post("/capture-blog/{biz_id}")
async def capture_blog_screenshots(
    biz_id: str,
    background_tasks: BackgroundTasks,
    user=Depends(get_current_user),
):
    """사업장 키워드별 블로그 스크린샷 순차 캡처 트리거 (Basic+)
    키워드 최대 5개 순차 실행 — RAM 부족 방지
    """

    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])

    # 플랜 체크 (Basic 이상)
    sub_res = await execute(
        supabase.table("subscriptions")
        .select("plan, status")
        .eq("user_id", user["id"])
        .maybe_single()
    )
    sub = sub_res.data if sub_res else None
    plan = sub["plan"] if (sub and sub.get("status") == "active") else "free"
    if plan not in ("basic", "startup", "pro", "biz", "enterprise"):
        raise HTTPException(status_code=403, detail="Basic 이상 구독이 필요합니다.")

    # 사업장 키워드 + 지역 조회
    biz_res = await execute(
        supabase.table("businesses")
        .select("keywords, region")
        .eq("id", biz_id)
        .maybe_single()
    )
    if not (biz_res and biz_res.data):
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다.")

    keywords = (biz_res.data.get("keywords") or [])[:5]  # 최대 5개
    keywords = [k.strip() for k in keywords if k.strip()]
    region = biz_res.data.get("region", "")

    if not keywords:
        raise HTTPException(status_code=400, detail="등록된 키워드가 없습니다.")

    async def _run_captures():
        import asyncio
        from services.screenshot import capture_naver_blog_screenshot
        from services.screenshot import _extract_city
        import logging
        _log = logging.getLogger("report.blog_capture")
        city = _extract_city(region) if region else ""
        _log.info(f"blog capture start | biz={biz_id} region={region!r} city={city!r} keywords={keywords}")
        for kw in keywords:
            try:
                search_q = f"{city} {kw} 추천".strip() if city else f"{kw} 추천"
                _log.info(f"blog capture query | kw={kw!r} search_q={search_q!r}")
                url = await capture_naver_blog_screenshot(kw, biz_id, region)
                _log.info(f"blog capture ok | biz={biz_id} kw={kw} url={url[:60] if url else '-'}")
            except Exception as exc:
                _log.warning(f"blog capture fail | biz={biz_id} kw={kw} err={exc}")
            await asyncio.sleep(3)  # 브라우저 메모리 해제 대기

    background_tasks.add_task(_run_captures)

    return {
        "message": f"키워드 {len(keywords)}개 블로그 스크린샷 캡처를 시작했습니다.",
        "keywords": keywords,
        "note": "캡처 완료까지 약 1~2분 소요됩니다. 완료 후 페이지를 새로고침하세요.",
    }


# ============================================================
# 블로그 검색 분석 — 구조화 카드 (v3.6)
# ============================================================

_TTL_BLOG_ANALYSIS = 86400  # 24시간 캐시


@router.get("/blog-analysis/{biz_id}")
async def get_blog_analysis(biz_id: str, user=Depends(get_current_user)):
    """키워드별 최신 블로그 검색 분석 결과 반환 (Basic+)

    blog_analysis 테이블에서 각 키워드별 최신 결과 1개씩 반환.
    현재 등록된 naver_blog_id 기준으로 is_mine 재판별 (캐시된 구분석 데이터 보정).
    분석 결과가 없으면 빈 배열 반환.
    """
    import re as _re
    _post_url_re = _re.compile(r"blog\.naver\.com/([^/?#]+)/")

    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])

    # 현재 naver_blog_id 조회 (is_mine 재판별용)
    biz_res = await execute(
        supabase.table("businesses")
        .select("naver_blog_id")
        .eq("id", biz_id)
        .maybe_single()
    )
    naver_blog_id: str = ((biz_res.data or {}).get("naver_blog_id") or "").strip().lower()

    cache_key = _cache._make_key("blog_analysis", biz_id, naver_blog_id or "none")
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    rows_res = await execute(
        supabase.table("blog_analysis")
        .select("keyword, my_rank, posts_json, analyzed_at")
        .eq("business_id", biz_id)
        .order("analyzed_at", desc=True)
    )
    rows = rows_res.data or []

    # 키워드별 최신 1개만 추출 + is_mine 재판별
    seen: set[str] = set()
    result: list[dict] = []
    for row in rows:
        kw = row.get("keyword", "")
        if kw and kw not in seen:
            seen.add(kw)
            posts = row.get("posts_json") or []
            my_rank = row.get("my_rank")

            # naver_blog_id 등록 시 URL 기반 is_mine 재판별 (구분석 데이터 보정)
            if naver_blog_id:
                my_rank = None
                for post in posts:
                    post_url = (post.get("url") or "").lower()
                    m = _post_url_re.search(post_url)
                    extracted_id = m.group(1) if m else ""
                    if not extracted_id:
                        extracted_id = (post.get("blog_id") or "").lower()
                    is_mine = (extracted_id == naver_blog_id) or (naver_blog_id in post_url)
                    post["is_mine"] = is_mine
                    post["blog_id"] = extracted_id or post.get("blog_id", "")
                    if is_mine and my_rank is None:
                        my_rank = post.get("rank")

            result.append({
                "keyword": kw,
                "my_rank": my_rank,
                "posts": posts,
                "analyzed_at": row.get("analyzed_at"),
                "blog_id_registered": bool(naver_blog_id),
            })

    ttl = _TTL_BLOG_ANALYSIS if naver_blog_id else 300  # blog_id 미등록 시 5분만 캐시
    _cache.set(cache_key, result, ttl=ttl)
    return result


@router.post("/blog-analysis/{biz_id}")
async def run_blog_analysis(
    biz_id: str,
    background_tasks: BackgroundTasks,
    user=Depends(get_current_user),
):
    """키워드별 블로그 검색 분석 실행 트리거 (Basic+)

    키워드 최대 5개를 순차 분석 (Playwright 동시 실행 금지, RAM 보호).
    BackgroundTasks로 비동기 실행 — 완료 후 GET으로 결과 조회.
    """
    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])

    # 관리자 여부 확인 (ADMIN_EMAILS 기준)
    from middleware.plan_gate import ADMIN_EMAILS
    is_admin = False
    if ADMIN_EMAILS:
        try:
            admin_resp = supabase.auth.admin.get_user_by_id(user["id"])
            email = (admin_resp.user.email or "").lower() if admin_resp and admin_resp.user else ""
            is_admin = bool(email and email in ADMIN_EMAILS)
        except Exception as e:
            _logger.warning("admin 이메일 조회 실패 (is_admin=False 유지): %s", e)

    # 플랜 체크 (Basic 이상, 관리자 예외)
    sub_res = await execute(
        supabase.table("subscriptions")
        .select("plan, status")
        .eq("user_id", user["id"])
        .maybe_single()
    )
    sub = sub_res.data if sub_res else None
    plan = sub["plan"] if (sub and sub.get("status") == "active") else "free"
    if not is_admin and plan not in ("basic", "startup", "pro", "biz", "enterprise"):
        raise HTTPException(status_code=403, detail="Basic 이상 구독이 필요합니다.")

    # 하루 1회 제한 체크 (관리자 예외)
    if not is_admin:
        last_res = await execute(
            supabase.table("blog_analysis")
            .select("analyzed_at")
            .eq("business_id", biz_id)
            .order("analyzed_at", desc=True)
            .limit(1)
        )
        last_rows = last_res.data or []
        if last_rows:
            from datetime import datetime, timezone, timedelta
            last_at_str = last_rows[0].get("analyzed_at", "")
            try:
                last_at = datetime.fromisoformat(last_at_str.replace("Z", "+00:00"))
                if datetime.now(timezone.utc) - last_at < timedelta(hours=24):
                    remaining = timedelta(hours=24) - (datetime.now(timezone.utc) - last_at)
                    hours = int(remaining.total_seconds() // 3600)
                    mins = int((remaining.total_seconds() % 3600) // 60)
                    raise HTTPException(
                        status_code=429,
                        detail=f"블로그 분석은 하루 1회만 가능합니다. {hours}시간 {mins}분 후 다시 시도하세요."
                    )
            except HTTPException:
                raise
            except Exception as e:
                _logger.warning("블로그 쿨다운 체크 실패 (쿨다운 미적용): %s", e)

    # 사업장 정보 조회
    biz_res = await execute(
        supabase.table("businesses")
        .select("name, keywords, region, naver_blog_id")
        .eq("id", biz_id)
        .maybe_single()
    )
    if not (biz_res and biz_res.data):
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다.")

    biz_data = biz_res.data
    biz_name: str = biz_data.get("name") or ""
    biz_region: str = (biz_data.get("region") or "").strip()
    naver_blog_id: str = (biz_data.get("naver_blog_id") or "").strip().lower()
    keywords: list[str] = [
        k.strip() for k in (biz_data.get("keywords") or []) if k.strip()
    ][:5]

    if not keywords:
        raise HTTPException(status_code=400, detail="등록된 키워드가 없습니다.")

    # 경쟁사 이름 목록 조회
    comp_res = await execute(
        supabase.table("competitors")
        .select("name")
        .eq("business_id", biz_id)
    )
    competitor_names: list[str] = [
        r["name"] for r in (comp_res.data or []) if r.get("name")
    ]

    async def _run_blog_analysis_bg(
        _biz_id: str,
        _biz_name: str,
        _biz_region: str,
        _naver_blog_id: str,
        _keywords: list[str],
        _competitor_names: list[str],
    ) -> None:
        from services.blog_search_analyzer import analyze_blog_search
        import asyncio as _asyncio
        _log = logging.getLogger("report.blog_analysis")

        for kw in _keywords:
            try:
                # 지역+키워드 조합으로 검색 (지역 없으면 키워드만)
                search_query = f"{_biz_region} {kw}".strip() if _biz_region else kw
                result = await analyze_blog_search(search_query, _biz_name, _competitor_names, naver_blog_id=_naver_blog_id)
                _supabase = get_client()
                await execute(
                    _supabase.table("blog_analysis")
                    .upsert(
                        {
                            "business_id": _biz_id,
                            "keyword": kw,  # DB에는 원래 키워드 저장
                            "my_rank": result.get("my_rank"),
                            "posts_json": result.get("posts") or [],
                            "analyzed_at": result.get("analyzed_at"),
                        },
                        on_conflict="business_id,keyword",
                    )
                )
                _log.info(
                    f"blog_analysis ok | biz={_biz_id} query={search_query!r} "
                    f"my_rank={result.get('my_rank')} posts={result.get('total_found')}"
                )
            except Exception as exc:
                _log.warning(f"blog_analysis fail | biz={_biz_id} kw={kw!r} err={exc}")

            # 브라우저 메모리 완전 해제 대기 (Playwright 동시 실행 금지)
            await _asyncio.sleep(5)

        # 캐시 무효화
        cache_key = _cache._make_key("blog_analysis", _biz_id)
        _cache.delete(cache_key)

    background_tasks.add_task(
        _run_blog_analysis_bg, biz_id, biz_name, biz_region, naver_blog_id, keywords, competitor_names
    )

    return {
        "message": "블로그 검색 분석을 시작했습니다. 약 2분 후 새로고침하세요.",
        "keyword_count": len(keywords),
        "keywords": keywords,
    }


@router.get("/score-simulate/{biz_id}")
async def simulate_score(
    biz_id: str,
    action: str,
    user=Depends(get_current_user),
):
    """특정 행동 시 예상 점수 변화 계산 (시뮬레이션).

    action: "add_faq" | "add_recent_post" | "add_intro" | "is_smart_place"
    """
    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])

    # 최신 사업장 정보 조회
    biz_res = await execute(
        supabase.table("businesses")
        .select(
            "id, category, has_faq, has_recent_post, has_intro, is_smart_place, "
            "naver_place_id, kakao_place_id, review_count, avg_rating, "
            "keywords, receipt_review_count"
        )
        .eq("id", biz_id)
        .maybe_single()
    )
    if not (biz_res and biz_res.data):
        raise HTTPException(status_code=404, detail="사업장 정보 없음")
    biz = biz_res.data

    # 최신 스캔 조회
    scan_res = await execute(
        supabase.table("scan_results")
        .select(
            "naver_result, gemini_result, chatgpt_result, perplexity_result, "
            "google_result, kakao_result, website_check_result, "
            "track1_score, track2_score, unified_score"
        )
        .eq("business_id", biz_id)
        .order("scanned_at", desc=True)
        .limit(1)
    )
    if not (scan_res and scan_res.data):
        raise HTTPException(status_code=404, detail="스캔 데이터 없음")

    scan_data = scan_res.data[0]

    # scan_result 키 정규화 (calculate_score 입력 형식에 맞춤)
    normalized_scan = {
        "naver": scan_data.get("naver_result") or {},
        "gemini": scan_data.get("gemini_result") or {},
        "chatgpt": scan_data.get("chatgpt_result") or {},
        "perplexity": scan_data.get("perplexity_result") or {},
        "google": scan_data.get("google_result") or {},
        "kakao_result": scan_data.get("kakao_result") or {},
        "website_check": scan_data.get("website_check_result") or {},
    }

    from services.score_engine import calculate_score

    # 현재 점수 계산
    current_result = calculate_score(normalized_scan, biz)
    current_score = float(current_result.get("unified_score") or current_result.get("total_score") or 0)

    # 시뮬레이션: 행동 적용 후 점수 재계산
    sim_biz = dict(biz)
    action_map = {
        "add_faq":         ("has_faq", True),
        "add_recent_post": ("has_recent_post", True),
        "add_intro":       ("has_intro", True),
        "is_smart_place":  ("is_smart_place", True),
    }
    if action not in action_map:
        raise HTTPException(status_code=400, detail=f"지원하지 않는 action: {action}")

    field, value = action_map[action]
    sim_biz[field] = value

    sim_result = calculate_score(normalized_scan, sim_biz)
    sim_score = float(sim_result.get("unified_score") or sim_result.get("total_score") or 0)

    delta = round(sim_score - current_score, 1)

    action_labels = {
        "add_faq":         "소개글 Q&A 추가",
        "add_recent_post": "소식 업데이트",
        "add_intro":       "소개글 작성",
        "is_smart_place":  "스마트플레이스 등록",
    }
    label = action_labels[action]

    if delta > 0:
        message = f"{label} 시 예상 점수: {round(sim_score, 1)}점 (+{delta}점)"
    else:
        message = f"{label}의 점수 기여가 이미 반영되어 있습니다"

    return {
        "current_score":   round(current_score, 1),
        "simulated_score": round(sim_score, 1),
        "delta":           delta,
        "action":          action,
        "action_label":    label,
        "message":         message,
        "note":            "실제 점수는 다를 수 있습니다 (추정값)",
    }


# ── AI 검색 화면 스크린샷 ────────────────────────────────────────────────────

@router.get("/ai-search-screenshots/{biz_id}")
async def get_ai_search_screenshots(biz_id: str, user=Depends(get_current_user)):
    """AI 검색 화면 스크린샷 조회 — Basic+"""
    from middleware.plan_gate import get_user_plan, PLAN_HIERARCHY
    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])

    plan = await get_user_plan(user["id"], supabase)
    if PLAN_HIERARCHY.get(plan, 0) < PLAN_HIERARCHY.get("basic", 1):
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "message": "Basic 이상 플랜에서 이용할 수 있습니다", "upgrade_url": "/pricing"},
        )

    result = (
        await execute(
            supabase.table("scan_results")
            .select("ai_search_screenshots, scanned_at")
            .eq("business_id", biz_id)
            .not_.is_("ai_search_screenshots", "null")
            .order("scanned_at", desc=True)
            .limit(3)
        )
    )
    rows = (result.data or []) if result else []
    screenshots = []
    for row in rows:
        items = row.get("ai_search_screenshots") or []
        for item in items:
            item["scanned_at"] = row.get("scanned_at")
            screenshots.append(item)
    return {"screenshots": screenshots[:6]}


# ── 네이버 DataLab 키워드 트렌드 (Basic+, 1시간 캐시) ────────────────────────

@router.get("/keyword-trend/{biz_id}")
async def get_keyword_trend(biz_id: str, user=Depends(get_current_user)):
    """네이버 DataLab 키워드 트렌드 조회 (Basic+ 전용, 1시간 캐시).

    사업장 업종의 대표 키워드 최대 5개에 대한 월별 검색 트렌드를 반환합니다.
    DataLab API 미설정 시 빈 결과를 반환합니다 (graceful degradation).

    Response:
        {
            "keywords": [{"keyword": str, "trend": [{"period": str, "ratio": float}], "monthly_volume": int | null}],
            "category": str,
            "region": str
        }
    """
    from middleware.plan_gate import get_user_plan, PLAN_HIERARCHY

    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])

    plan = await get_user_plan(user["id"], supabase)
    if PLAN_HIERARCHY.get(plan, 0) < PLAN_HIERARCHY.get("basic", 1):
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "message": "Basic 이상 플랜에서 이용할 수 있습니다", "upgrade_url": "/pricing"},
        )

    biz = (await execute(
        supabase.table("businesses")
        .select("category, region, keywords")
        .eq("id", biz_id)
        .single()
    )).data
    if not biz:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")

    category = biz.get("category", "")
    region = biz.get("region") or ""

    cache_key = _cache._make_key("keyword_trend", biz_id)
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    # 사용할 키워드: 등록 키워드 우선, 없으면 업종 대표 키워드 자동 선택
    reg_keywords = [k.strip() for k in (biz.get("keywords") or []) if k.strip()][:5]

    from services.naver_datalab import get_datalab_client
    client = get_datalab_client()

    if reg_keywords:
        trend_result = await client.get_keyword_trends(reg_keywords, period="3month")
    else:
        # 업종 대표 키워드로 조회 (get_category_trend 내부 키워드 선택 로직 활용)
        cat_result = await client.get_category_trend(category, region, months=3)
        keywords_used = cat_result.get("keywords_used") or []
        if keywords_used:
            trend_result = await client.get_keyword_trends(keywords_used, period="3month")
        else:
            trend_result = {"keywords": [], "available": False}

    # SearchAd 볼륨 병합 (API 설정된 경우)
    try:
        from services.naver_searchad import get_searchad_client
        all_kws = [item["keyword"] for item in trend_result.get("keywords", []) if item.get("keyword")]
        if all_kws:
            ad_client = get_searchad_client()
            volumes = await ad_client.get_volumes_with_cache(all_kws, category, supabase)
            for item in trend_result.get("keywords", []):
                kw = item.get("keyword", "")
                if kw in volumes:
                    item["monthly_volume"] = volumes[kw].get("monthly_total")
    except Exception as e:
        _logger.warning("keyword_trend SearchAd 병합 실패: %s", e)

    result = {
        "keywords": trend_result.get("keywords", []),
        "category": category,
        "region": region,
        "period": trend_result.get("period", "3month"),
        "available": trend_result.get("available", False),
    }
    _cache.set(cache_key, result, ttl=3600)
    return result


# ── 네이버 검색광고 키워드 월 검색량 (Basic+, 7일 캐시) ──────────────────────

@router.get("/keyword-volume-query")
async def get_keyword_volume_by_query(
    keywords: str,
    biz_id: str,
    user=Depends(get_current_user),
):
    """네이버 검색광고 API로 키워드 월 검색량 조회 (Basic+ 전용, 7일 캐시).

    Args:
        keywords: 쉼표로 구분된 키워드 목록 (예: "주차,단체예약,반려견"), 최대 5개
        biz_id: 사업장 ID (소유권 검증용)

    Response:
        {"volumes": {"주차": {"monthly_pc": int, "monthly_mo": int, "monthly_total": int, "competition": str}, ...}}

    SearchAd API 미설정 시 {"volumes": {}} 반환 (graceful fallback).
    """
    from middleware.plan_gate import get_user_plan, PLAN_HIERARCHY

    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])

    plan = await get_user_plan(user["id"], supabase)
    if PLAN_HIERARCHY.get(plan, 0) < PLAN_HIERARCHY.get("basic", 1):
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "message": "Basic 이상 플랜에서 이용할 수 있습니다", "upgrade_url": "/pricing"},
        )

    # 쿼리 파라미터 파싱 (최대 5개)
    kw_list = [k.strip() for k in keywords.split(",") if k.strip()][:5]
    if not kw_list:
        return {"volumes": {}, "message": "키워드를 1개 이상 입력해주세요"}

    # 사업장 카테고리 조회 (캐시 키·SearchAd 카테고리 파라미터용)
    biz = (await execute(
        supabase.table("businesses")
        .select("category")
        .eq("id", biz_id)
        .single()
    )).data
    category = (biz or {}).get("category", "")

    cache_key = _cache._make_key("kv_query", ",".join(sorted(kw_list)), biz_id)
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        from services.naver_searchad import get_searchad_client
        client = get_searchad_client()
        volumes = await client.get_volumes_with_cache(kw_list, category, supabase)
    except Exception as e:
        _logger.warning("keyword_volume_query SearchAd 오류: %s", e)
        volumes = {}

    result = {"volumes": volumes}
    _cache.set(cache_key, result, ttl=7 * 24 * 3600)  # 7일 캐시
    return result


# ── 스마트플레이스 완성도 단독 체크 (Basic+, Playwright 동시 1개 제한) ─────────

# Playwright 메모리 제한: 서버 RAM 4GB 기준 동시 1개만 허용
_smartplace_sem: "asyncio.Semaphore | None" = None


def _get_smartplace_sem():
    import asyncio
    global _smartplace_sem
    if _smartplace_sem is None:
        _smartplace_sem = asyncio.Semaphore(1)
    return _smartplace_sem


def _extract_place_id(naver_place_url: str) -> str | None:
    """네이버 플레이스 URL에서 place_id 추출.

    지원 형식:
        https://smartplace.naver.com/bizes/{id}/...
        https://map.naver.com/v5/entry/place/{id}
        https://map.naver.com/p/entry/place/{id}
        https://naver.me/...   (단축 URL — 추출 불가, None 반환)
    """
    import re
    patterns = [
        r"/bizes/([0-9]+)",
        r"/place/([0-9]+)",
        r"[?&]entry=([0-9]+)",
    ]
    for pat in patterns:
        m = re.search(pat, naver_place_url)
        if m:
            return m.group(1)
    return None


@router.post("/smartplace-check")
async def post_smartplace_check(
    payload: dict = Body(...),
    user=Depends(get_current_user),
):
    """네이버 스마트플레이스 URL을 직접 체크해 완성도 항목 목록을 반환 (Basic+ 전용).

    Body:
        {"biz_id": str, "naver_place_url": str}

    Response:
        {
            "items": [{"label": str, "passed": bool, "score_impact": int, "action_url": str | null}],
            "total_score": int,
            "max_score": int,
            "place_id": str | null,
            "checked_url": str
        }

    Playwright 동시 실행 1개 제한, 타임아웃 30초.
    """
    import asyncio
    from middleware.plan_gate import get_user_plan, PLAN_HIERARCHY

    biz_id = payload.get("biz_id", "")
    naver_place_url = (payload.get("naver_place_url") or "").strip()

    if not biz_id or not naver_place_url:
        raise HTTPException(status_code=422, detail="biz_id와 naver_place_url이 필요합니다")

    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])

    plan = await get_user_plan(user["id"], supabase)
    if PLAN_HIERARCHY.get(plan, 0) < PLAN_HIERARCHY.get("basic", 1):
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "message": "Basic 이상 플랜에서 이용할 수 있습니다", "upgrade_url": "/pricing"},
        )

    place_id = _extract_place_id(naver_place_url)
    base_sp_url = "https://smartplace.naver.com"

    def _sp_url(path: str) -> str:
        if place_id:
            return f"{base_sp_url}/bizes/{place_id}/{path}"
        return base_sp_url

    # Playwright 동시 1개 제한 + 45초 타임아웃 (3탭 방문 × 탭당 최대 11.5s)
    sem = _get_smartplace_sem()
    try:
        from services.naver_place_stats import check_smart_place_completeness
        async with sem:
            raw = await asyncio.wait_for(
                check_smart_place_completeness(naver_place_url),
                timeout=45,
            )
    except asyncio.TimeoutError:
        _logger.warning("smartplace_check 타임아웃: %s", naver_place_url)
        raise HTTPException(status_code=504, detail="스마트플레이스 체크 타임아웃 (45초). 잠시 후 다시 시도해주세요.")
    except Exception as e:
        _logger.warning("smartplace_check 오류: %s", e)
        raise HTTPException(status_code=502, detail="스마트플레이스 정보를 가져오지 못했습니다. URL을 확인해주세요.")

    if raw.get("error"):
        raise HTTPException(
            status_code=502,
            detail=f"스마트플레이스 체크 오류: {raw['error']}. URL이 올바른지 확인해주세요.",
        )

    # 항목별 결과 구성 (label / passed / score_impact / action_url)
    # [2026-05-01] 사장님 Q&A 탭 폐기 — FAQ 항목 → 소개글 Q&A 섹션 안내. score_impact 0 (점수 미반영).
    items = [
        {
            "label": "소개글에 Q&A 섹션 포함",
            "passed": bool(raw.get("has_intro")),
            "score_impact": 0,
            "detail": "소개글이 작성되어 있다면 Q&A 5개를 자연스럽게 포함하세요" if raw.get("has_intro") else None,
            "action_url": _sp_url("profile"),
        },
        {
            "label": "최근 소식 업데이트",
            "passed": bool(raw.get("has_recent_post")),
            "score_impact": 25,
            "detail": raw.get("recent_post_date"),
            "action_url": _sp_url("posts"),
        },
        {
            "label": "소개글 작성",
            "passed": bool(raw.get("has_intro")),
            "score_impact": 20,
            "detail": f"약 {raw.get('intro_char_count', 0)}자" if raw.get("intro_char_count") else None,
            "action_url": _sp_url("info"),
        },
        {
            "label": "사진 5장 이상",
            "passed": (raw.get("photo_count") or 0) >= 5,
            "score_impact": 10,
            "detail": f"{raw.get('photo_count', 0)}장 등록됨",
            "action_url": _sp_url("photo") if place_id else None,
        },
        {
            "label": "메뉴·서비스 등록",
            "passed": bool(raw.get("has_menu")),
            "score_impact": 15,
            "detail": None,
            "action_url": _sp_url("menu") if place_id else None,
        },
        {
            "label": "영업시간 등록",
            "passed": bool(raw.get("has_hours")),
            "score_impact": 5,
            "detail": None,
            "action_url": _sp_url("info"),
        },
    ]

    total_score = sum(i["score_impact"] for i in items if i["passed"])
    max_score = sum(i["score_impact"] for i in items)

    # businesses 테이블 동기화 — 스마트플레이스 체크 결과를 DB에 반영
    try:
        await execute(
            supabase.table("businesses").update({
                "has_faq":         bool(raw.get("has_faq")),
                "has_intro":       bool(raw.get("has_intro")),
                "has_recent_post": bool(raw.get("has_recent_post")),
            }).eq("id", biz_id)
        )
    except Exception as e:
        _logger.warning("smartplace_check businesses 업데이트 실패 [%s]: %s", biz_id, e)

    return {
        "items": items,
        "total_score": total_score,
        "max_score": max_score,
        "completeness_score": raw.get("completeness_score", total_score),
        "place_id": place_id,
        "checked_url": naver_place_url,
    }


# ── v3.6 — 7일 액션 카드 (2026-04-24) ────────────────────────────────────
@router.get("/onboarding-action/{biz_id}")
async def get_onboarding_action(biz_id: str, user=Depends(get_current_user)):
    """신규 가입자가 가장 먼저 할 1가지 행동 카드 (AI 호출 0).

    pick_top_action()이 score_breakdown + naver_result로 우선순위를 결정.
    같은 날 중복 INSERT 방지 — business_action_log에 멱등 처리.

    Returns:
        {
            "biz_id": ...,
            "scan_id": ...,
            "action": {
                "action_type", "title", "description",
                "expected_impact", "estimated_time_min", "copy_template", "action_url"
            }
        }
    """
    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])

    biz_row = (await execute(
        supabase.table("businesses")
        .select("id, name, category")
        .eq("id", biz_id)
        .single()
    )).data
    if not biz_row:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")

    scan_rows = (await execute(
        supabase.table("scan_results")
        .select("id, scanned_at, score_breakdown, naver_result")
        .eq("business_id", biz_id)
        .order("scanned_at", desc=True)
        .limit(1)
    )).data or []

    if not scan_rows:
        raise HTTPException(
            status_code=412,
            detail="먼저 스캔이 필요합니다. 대시보드에서 [지금 분석하기]를 눌러주세요.",
        )

    scan = scan_rows[0]

    from services.action_tools import pick_top_action
    from services.gap_analyzer import analyze_gap_from_db as _analyze_gap

    # keyword_gap 조회 (graceful — 실패해도 pick_top_action은 계속 실행)
    _keyword_gap = None
    try:
        _gap_result = await _analyze_gap(biz_id, supabase)
        if _gap_result and _gap_result.keyword_gap:
            _keyword_gap = _gap_result.keyword_gap
    except Exception as e:
        _logger.warning(f"[onboarding_action] gap_analyzer 조회 실패: {e}")

    try:
        action = pick_top_action(scan, biz_row.get("category") or "", keyword_gap=_keyword_gap)
    except Exception as e:  # noqa: BLE001
        _logger.warning(f"[onboarding_action] pick_top_action 실패: {e}")
        raise HTTPException(status_code=500, detail="추천 행동을 계산할 수 없습니다")

    # business_action_log INSERT (auto_recommended) — 같은 날 중복 방지
    today_iso = date.today().isoformat()
    try:
        existing = await execute(
            supabase.table("business_action_log")
            .select("id")
            .eq("business_id", biz_id)
            .eq("action_type", "auto_recommended")
            .eq("action_date", today_iso)
            .limit(1)
        )
        if not (existing and existing.data):
            await execute(
                supabase.table("business_action_log")
                .insert({
                    "business_id": biz_id,
                    "action_type": "auto_recommended",
                    "action_label": action.get("title") or "추천 행동",
                })
            )
    except Exception as e:  # noqa: BLE001
        _logger.warning(f"[onboarding_action] action_log 기록 실패 (멱등 무시): {e}")

    return {
        "biz_id": biz_id,
        "scan_id": scan.get("id"),
        "action": action,
    }


# -- 재방문 변화 요약 (2026-04-24) -------------------------------------------
@router.get("/visit-delta/{biz_id}")
async def get_visit_delta(
    biz_id: str,
    background_tasks: BackgroundTasks,
    user=Depends(get_current_user),
):
    """재방문 시 마지막 방문 이후 점수 변화 요약.

    - last_dashboard_visit NULL 또는 3일 미만 경과 -> show: false
    - 3일 이상 경과 -> score_history 기간 첫/마지막 unified_score 비교
    - score_history 없으면 scan_results.total_score fallback
    - abs(delta) < 0.5 -> show: false
    - BackgroundTasks로 last_dashboard_visit = now() 갱신 (응답 지연 없음)
    """
    from datetime import datetime, timezone

    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])

    user_id = user["id"]

    # 1. profiles에서 last_dashboard_visit 조회 (maybe_single → limit(1) — 204 예외 방지)
    # [2026-05-01] profiles 테이블 PK는 user_id (not id) — code-review 점검에서 발견된 컬럼명 오류 수정
    try:
        profile_res = await execute(
            supabase.table("profiles")
            .select("last_dashboard_visit")
            .eq("user_id", user_id)
            .limit(1)
        )
        profile = (profile_res.data or [{}])[0] if (profile_res and profile_res.data) else {}
    except Exception as e:
        _logger.warning(f"[visit_delta] profiles 조회 실패: {e}")
        profile = {}
    last_visit_raw: str | None = (profile or {}).get("last_dashboard_visit")

    # BackgroundTasks: 응답 전송 후 visit 갱신
    async def _update_visit():
        try:
            now_iso = datetime.now(timezone.utc).isoformat()
            await execute(
                supabase.table("profiles")
                .update({"last_dashboard_visit": now_iso})
                .eq("user_id", user_id)
            )
        except Exception as e:
            _logger.warning(f"[visit_delta] last_dashboard_visit 갱신 실패: {e}")

    background_tasks.add_task(_update_visit)

    # 2. NULL 또는 3일 미만 -> show: false
    if not last_visit_raw:
        return {"show": False}

    try:
        last_visit_dt = datetime.fromisoformat(last_visit_raw.replace("Z", "+00:00"))
        if last_visit_dt.tzinfo is None:
            last_visit_dt = last_visit_dt.replace(tzinfo=timezone.utc)
    except (ValueError, AttributeError) as e:
        _logger.warning(f"[visit_delta] last_dashboard_visit 파싱 실패: {e}")
        return {"show": False}

    now_utc = datetime.now(timezone.utc)
    days_away = (now_utc - last_visit_dt).days

    if days_away < 3:
        return {"show": False}

    last_visit_iso = last_visit_dt.isoformat()

    # 3. score_history에서 기간 내 첫/마지막 행 조회
    history_res = await execute(
        supabase.table("score_history")
        .select("unified_score, created_at")
        .eq("business_id", biz_id)
        .gte("created_at", last_visit_iso)
        .order("created_at", desc=False)
    )
    history_rows = (history_res.data or []) if history_res else []

    score_before: float | None = None
    score_now: float | None = None
    has_new_scan = len(history_rows) > 0

    if len(history_rows) >= 2:
        score_before = float(history_rows[0].get("unified_score") or 0)
        score_now    = float(history_rows[-1].get("unified_score") or 0)
    elif len(history_rows) == 1:
        # 기간 내 행이 1개뿐 -> 이전 기록을 before로 사용
        before_res = await execute(
            supabase.table("score_history")
            .select("unified_score, created_at")
            .eq("business_id", biz_id)
            .lt("created_at", last_visit_iso)
            .order("created_at", desc=True)
            .limit(1)
        )
        before_rows = (before_res.data or []) if before_res else []
        if before_rows:
            score_before = float(before_rows[0].get("unified_score") or 0)
            score_now    = float(history_rows[0].get("unified_score") or 0)

    # 4. score_history 0건 -> scan_results fallback
    if score_before is None or score_now is None:
        scan_res = await execute(
            supabase.table("scan_results")
            .select("total_score, scanned_at")
            .eq("business_id", biz_id)
            .gte("scanned_at", last_visit_iso)
            .order("scanned_at", desc=False)
        )
        scan_rows = (scan_res.data or []) if scan_res else []

        if len(scan_rows) >= 2:
            score_before = float(scan_rows[0].get("total_score") or 0)
            score_now    = float(scan_rows[-1].get("total_score") or 0)
            has_new_scan = True
        elif len(scan_rows) == 1:
            before_scan_res = await execute(
                supabase.table("scan_results")
                .select("total_score, scanned_at")
                .eq("business_id", biz_id)
                .lt("scanned_at", last_visit_iso)
                .order("scanned_at", desc=True)
                .limit(1)
            )
            before_scan_rows = (before_scan_res.data or []) if before_scan_res else []
            if before_scan_rows:
                score_before = float(before_scan_rows[0].get("total_score") or 0)
                score_now    = float(scan_rows[0].get("total_score") or 0)
                has_new_scan = True

    if score_before is None or score_now is None:
        return {"show": False}

    # 5. delta 미미하면 show: false
    delta = round(score_now - score_before, 2)
    if abs(delta) < 0.5:
        return {"show": False}

    return {
        "show": True,
        "days_away": days_away,
        "score_before": round(score_before, 2),
        "score_now": round(score_now, 2),
        "delta": delta,
        "has_new_scan": has_new_scan,
    }


# -- 이번 달 할 일 체크리스트 (2026-04-24) ------------------------------------
@router.get("/monthly-checklist/{biz_id}")
async def get_monthly_checklist(biz_id: str, user=Depends(get_current_user)):
    from datetime import datetime, timezone, timedelta

    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])

    now_utc = datetime.now(timezone.utc)
    month_label = f"{now_utc.month}월"

    # 1. businesses에서 review_count, keywords 가져오기
    biz_res = await execute(
        supabase.table("businesses")
        .select("review_count, keywords, category")
        .eq("id", biz_id)
        .limit(1)
    )
    biz_rows = (biz_res.data or []) if biz_res else []
    biz_row = biz_rows[0] if biz_rows else {}
    review_count = int((biz_row.get("review_count") if biz_row else None) or 0)
    registered_keywords = [k for k in (biz_row.get("keywords") or []) if k and str(k).strip()]

    # 경쟁사 평균 점수 조회 (monthly-checklist 기준값 개인화)
    _comp_avg_score: float | None = None
    try:
        _scan_comp_res = await execute(
            supabase.table("scan_results")
            .select("competitor_scores")
            .eq("business_id", biz_id)
            .order("scanned_at", desc=True)
            .limit(1)
        )
        _scan_comp_rows = (_scan_comp_res.data or []) if _scan_comp_res else []
        if _scan_comp_rows:
            _raw_comp = _scan_comp_rows[0].get("competitor_scores") or {}
            if isinstance(_raw_comp, dict) and _raw_comp:
                _comp_scores_vals = [
                    float(v.get("score", 0))
                    for v in _raw_comp.values()
                    if isinstance(v, dict) and v.get("score") is not None
                ]
                if _comp_scores_vals:
                    _comp_avg_score = round(sum(_comp_scores_vals) / len(_comp_scores_vals), 1)
    except Exception as e:
        _logger.warning(f"[monthly_checklist] competitor_scores 조회 실패: {e}")

    # 2. scan_results 최신 1건 (keyword_coverage, score_breakdown, smart_place_completeness_result)
    scan_res = await execute(
        supabase.table("scan_results")
        .select("scanned_at, keyword_coverage, score_breakdown, smart_place_completeness_result")
        .eq("business_id", biz_id)
        .order("scanned_at", desc=True)
        .limit(1)
    )
    scan_rows = (scan_res.data or []) if scan_res else []
    latest = scan_rows[0] if scan_rows else {}

    # --- Bug 2 수정: keyword_coverage 0% 오표시 방지 ---
    score_breakdown = (latest.get("score_breakdown") or {})
    raw_kw_score = float(score_breakdown.get("keyword_gap_score") or 0)

    if raw_kw_score >= 1:
        # score_breakdown에 keyword_gap_score가 있으면 우선 사용
        keyword_coverage = raw_kw_score / 100
    else:
        keyword_coverage = float(latest.get("keyword_coverage") or 0.0)

    # 스캔 기록이 있는데 0%이면 score_engine fallback(30.0)과 동일하게 30% 적용
    if latest and keyword_coverage == 0.0:
        keyword_coverage = 0.30

    # --- Bug 1 수정: 대표 사진 photo_count 기반 완료 조건 ---
    sp_result_raw = latest.get("smart_place_completeness_result") or {}
    if isinstance(sp_result_raw, str):
        import json as _json
        try:
            sp_result_raw = _json.loads(sp_result_raw)
        except Exception:
            sp_result_raw = {}
    photo_count = int(sp_result_raw.get("photo_count") or 0)

    # smart_place_score는 photo_count == 0 && 스캔 결과 없을 때 fallback용으로만 사용
    smart_place_score = float(score_breakdown.get("smart_place_completeness") or 0)

    # photo_count가 0이고 smart_place_completeness_result가 없는 경우(Playwright 미실행)
    # → smart_place_score >= 70이면 사실상 사진 있는 것으로 간주
    photo_done = (photo_count >= 3) or (photo_count == 0 and smart_place_score >= 70 and sp_result_raw == {})

    # 3. 최근 7일 내 스캔 여부
    seven_days_ago = (now_utc - timedelta(days=7)).isoformat()
    recent_scan_res = await execute(
        supabase.table("scan_results")
        .select("id")
        .eq("business_id", biz_id)
        .gte("scanned_at", seven_days_ago)
        .limit(1)
    )
    has_recent_scan = bool((recent_scan_res.data or []) if recent_scan_res else [])

    # 4. 이번 달 business_action_log
    month_start = now_utc.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    action_res = await execute(
        supabase.table("business_action_log")
        .select("id")
        .eq("business_id", biz_id)
        .gte("action_date", month_start)
        .limit(1)
    )
    has_action_this_month = bool((action_res.data or []) if action_res else [])

    # 5. streak 계산
    streak_res = await execute(
        supabase.table("score_history")
        .select("score_date")
        .eq("business_id", biz_id)
        .order("score_date", desc=True)
        .limit(60)
    )
    streak_rows = (streak_res.data or []) if streak_res else []

    streak_days = 0
    if streak_rows:
        today_date = now_utc.date()
        expected = today_date
        for row in streak_rows:
            try:
                d = datetime.fromisoformat(str(row.get("score_date"))).date()
            except (ValueError, TypeError):
                break
            if d == expected:
                streak_days += 1
                expected = expected - timedelta(days=1)
            else:
                break

    # 경쟁사 평균 점수 기반 리뷰 목표 기준값 결정
    _review_target = 20  # 기본값
    _review_desc_suffix = "20개 이상이면 네이버 노출이 유리해집니다"
    if _comp_avg_score is not None:
        _review_desc_suffix = (
            f"지역 경쟁사 평균 점수 {_comp_avg_score}점 기준 — "
            "리뷰를 늘리면 AI 노출 점수가 빠르게 올라갑니다"
        )

    # 6. 체크리스트 항목 생성
    checklist = [
        {
            "id": "review_count",
            "title": f"리뷰 {_review_target}개 달성하기",
            "description": (
                f"현재 리뷰 {review_count}개 — {_review_desc_suffix}"
                if review_count < _review_target
                else f"리뷰 {review_count}개 달성 완료!"
            ),
            "completed": review_count >= _review_target,
            "priority": 1,
        },
        {
            "id": "keyword_coverage",
            "title": "핵심 키워드 3개 블로그에 포함하기",
            "description": (
                f"스마트플레이스에 등록된 키워드 {len(registered_keywords)}개 — 3개 이상 등록하면 AI 노출 확률이 높아집니다"
                if len(registered_keywords) < 3
                else f"핵심 키워드 {len(registered_keywords)}개 등록 완료!"
            ),
            "completed": len(registered_keywords) >= 3,
            "priority": 2,
        },
        {
            "id": "smart_place_photo",
            "title": "대표 사진 3장 업데이트하기",
            "description": (
                f"현재 사진 {photo_count}장 — 3장 이상이면 스마트플레이스 노출이 유리해집니다"
                if not photo_done
                else (
                    f"대표 사진 {photo_count}장 등록 완료!"
                    if photo_count >= 3
                    else f"스마트플레이스 완성도 {int(smart_place_score)}점 — 목표 달성!"
                )
            ),
            "completed": photo_done,
            "priority": 3,
        },
        {
            "id": "weekly_scan",
            "title": "이번 주 AI 스캔 완료",
            "description": (
                "이번 주 스캔 기록이 없습니다 — 스캔하면 변화를 바로 확인할 수 있어요"
                if not has_recent_scan
                else "이번 주 AI 스캔 완료!"
            ),
            "completed": has_recent_scan,
            "priority": 4,
        },
        {
            "id": "guide_action",
            "title": "이달 가이드 1개 실천",
            "description": (
                "아직 이달 실행 기록이 없습니다 — 가이드 탭에서 개선 방안을 확인하세요"
                if not has_action_this_month
                else "이달 가이드 실천 완료!"
            ),
            "completed": has_action_this_month,
            "priority": 5,
        },
    ]

    completed_count = sum(1 for item in checklist if item["completed"])

    return {
        "checklist": checklist,
        "completed_count": completed_count,
        "total_count": len(checklist),
        "streak_days": streak_days,
        "month_label": month_label,
    }


@router.get("/score-attribution/{biz_id}")
async def get_score_attribution(
    biz_id: str,
    days: int = 90,
    user=Depends(get_current_user),
):
    """
    행동-점수 귀인 분석 (Basic+)
    business_action_log + score_history 연결 → "이 행동이 점수에 얼마나 기여했는가"
    AI 호출 없음
    """
    from middleware.plan_gate import get_user_plan, PLAN_HIERARCHY
    supabase = get_client()
    plan = await get_user_plan(user["id"], supabase)
    if PLAN_HIERARCHY.get(plan, 0) < PLAN_HIERARCHY.get("basic", 1):
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "message": "Basic 이상 플랜에서 이용할 수 있습니다", "upgrade_url": "/pricing"},
        )
    await _verify_biz_ownership(supabase, biz_id, user["id"])

    from datetime import datetime, timedelta, timezone
    from services.score_attribution import compute_attributions
    from services.score_engine import get_dual_track_ratio

    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    # 사업장 업종 조회
    try:
        biz_res = await execute(
            supabase.table("businesses")
            .select("category")
            .eq("id", biz_id)
            .single()
        )
        category = (biz_res.data or {}).get("category", "other")
    except Exception:
        category = "other"

    ratio = get_dual_track_ratio(category)
    naver_w = ratio.get("naver", 0.60)
    global_w = ratio.get("global", 0.40)

    # action_log 조회
    try:
        log_res = await execute(
            supabase.table("business_action_log")
            .select("action_type,action_label,action_date,score_before,score_after,created_at")
            .eq("business_id", biz_id)
            .gte("action_date", since[:10])
            .order("action_date", desc=True)
            .limit(30)
        )
        action_logs = log_res.data or []
    except Exception as e:
        _logger.warning("[score_attribution] action_log 조회 실패: %s", e)
        action_logs = []

    # score_history 조회
    # [2026-05-01] score_breakdown 토글: 컬럼 존재 시 사용, 미존재 시 unified_score만 (graceful).
    # ALTER 실행되면 자동으로 score_breakdown 활용 (score-attribution 정밀도 강화).
    try:
        hist_res = await execute(
            supabase.table("score_history")
            .select("score_date,unified_score,score_breakdown,created_at")
            .eq("business_id", biz_id)
            .gte("score_date", since[:10])
            .order("score_date", desc=False)
            .limit(100)
        )
        score_history = hist_res.data or []
    except Exception as e:
        if "score_breakdown" in str(e):
            # ALTER 미실행 fallback — score_breakdown 제외 재시도
            try:
                hist_res = await execute(
                    supabase.table("score_history")
                    .select("score_date,unified_score,created_at")
                    .eq("business_id", biz_id)
                    .gte("score_date", since[:10])
                    .order("score_date", desc=False)
                    .limit(100)
                )
                score_history = hist_res.data or []
            except Exception as e2:
                _logger.warning("[score_attribution] score_history fallback 조회 실패: %s", e2)
                score_history = []
        else:
            _logger.warning("[score_attribution] score_history 조회 실패: %s", e)
            score_history = []

    if not action_logs:
        return {
            "attributions": [],
            "total_attributed_gain": 0,
            "top_effective_action": None,
            "period_start_score": 0,
            "period_end_score": 0,
            "message": "기록된 행동이 없습니다. 가이드를 실행하고 행동을 기록하면 효과를 확인할 수 있습니다.",
        }

    return compute_attributions(action_logs, score_history, naver_w, global_w)


@router.get("/competitor-keyword-delta/{biz_id}")
async def get_competitor_keyword_delta(
    biz_id: str,
    user: dict = Depends(get_current_user),
):
    """경쟁사 키워드 델타 — 내 키워드 변화 및 경쟁사 위협 키워드 분석 (Basic+ 플랜, AI 호출 없음).

    내 최근 2개 스캔의 keyword_coverage를 비교해 gained/lost 키워드를 파악하고,
    경쟁사의 competitor_only_keywords 중 내 covered_keywords에 없는 것을 위협으로 반환한다.
    """
    from middleware.plan_gate import get_user_plan as _get_plan

    user_id = user["id"]
    supabase = get_client()

    # 소유권 검증
    await _verify_biz_ownership(supabase, biz_id, user_id)

    # Basic+ 플랜 체크
    plan = await _get_plan(user_id, supabase)
    if plan == "free":
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "message": "Basic 이상 플랜이 필요합니다", "upgrade_url": "/pricing"},
        )

    _empty = {
        "my_gained": [],
        "my_lost": [],
        "competitor_threats": [],
        "scan_date_current": None,
        "scan_date_previous": None,
        "has_delta": False,
    }

    # 내 최근 2개 스캔 조회
    try:
        my_scans_resp = await execute(
            supabase.table("scan_results")
            .select("id, scanned_at, keyword_coverage")
            .eq("business_id", biz_id)
            .order("scanned_at", desc=True)
            .limit(2)
        )
        my_scans: list[dict] = my_scans_resp.data or []
    except Exception as e:
        _logger.warning("[competitor_keyword_delta] 내 스캔 조회 실패: %s", e)
        return _empty

    if len(my_scans) < 2:
        return _empty

    current_scan = my_scans[0]
    previous_scan = my_scans[1]

    current_cov: dict = current_scan.get("keyword_coverage") or {}
    previous_cov: dict = previous_scan.get("keyword_coverage") or {}

    current_covered: set[str] = set(current_cov.get("covered_keywords") or [])
    previous_covered: set[str] = set(previous_cov.get("covered_keywords") or [])

    my_gained: list[str] = sorted(current_covered - previous_covered)
    my_lost: list[str] = sorted(previous_covered - current_covered)

    scan_date_current: str | None = None
    scan_date_previous: str | None = None
    try:
        scan_date_current = str(current_scan.get("scanned_at", ""))[:10] or None
        scan_date_previous = str(previous_scan.get("scanned_at", ""))[:10] or None
    except Exception as e:
        _logger.warning("[competitor_keyword_delta] 날짜 파싱 실패: %s", e)

    # 경쟁사 조회
    try:
        comps_resp = await execute(
            supabase.table("competitors")
            .select("id, name")
            .eq("business_id", biz_id)
            .eq("is_active", True)
        )
        comps: list[dict] = comps_resp.data or []
    except Exception as e:
        _logger.warning("[competitor_keyword_delta] 경쟁사 조회 실패: %s", e)
        comps = []

    competitor_threats: list[dict] = []

    if comps:
        comp_ids = [c.get("id") for c in comps if c.get("id")]
        comp_map = {c["id"]: c.get("name", "경쟁사") for c in comps}

        # 경쟁사별 최근 스캔 2개 조회
        try:
            comp_scans_resp = await execute(
                supabase.table("scan_results")
                .select("id, business_id, scanned_at, keyword_coverage")
                .in_("business_id", comp_ids)
                .order("scanned_at", desc=True)
                .limit(len(comp_ids) * 2)
            )
            comp_scans_raw: list[dict] = comp_scans_resp.data or []
        except Exception as e:
            _logger.warning("[competitor_keyword_delta] 경쟁사 스캔 조회 실패: %s", e)
            comp_scans_raw = []

        # 경쟁사별 최신 스캔만 추출
        latest_by_comp: dict[str, dict] = {}
        for scan in comp_scans_raw:
            cid = scan.get("business_id")
            if cid and cid not in latest_by_comp:
                latest_by_comp[cid] = scan

        # 경쟁사 위협 키워드 수집
        seen_threats: set[str] = set()
        for cid, scan in latest_by_comp.items():
            comp_cov: dict = scan.get("keyword_coverage") or {}
            comp_name: str = comp_map.get(cid, "경쟁사")

            # competitor_only_keywords: 내 covered에 없는 것 → high urgency
            for kw in (comp_cov.get("competitor_only_keywords") or []):
                kw_str = str(kw).strip()
                if not kw_str:
                    continue
                if kw_str not in current_covered and kw_str not in seen_threats:
                    seen_threats.add(kw_str)
                    competitor_threats.append({
                        "keyword": kw_str,
                        "competitor_name": comp_name,
                        "urgency": "high",
                    })

            # missing_keywords: 경쟁사도 놓치고 있지만 경쟁사 missing 중 내 covered에 없는 것 → medium urgency
            for kw in (comp_cov.get("missing_keywords") or []):
                kw_str = str(kw).strip()
                if not kw_str:
                    continue
                if kw_str not in current_covered and kw_str not in seen_threats:
                    seen_threats.add(kw_str)
                    competitor_threats.append({
                        "keyword": kw_str,
                        "competitor_name": comp_name,
                        "urgency": "medium",
                    })

        # urgency 기준 정렬 (high 우선)
        competitor_threats.sort(key=lambda x: (0 if x["urgency"] == "high" else 1, x["keyword"]))

    has_delta = bool(my_gained or my_lost or competitor_threats)

    return {
        "my_gained": my_gained,
        "my_lost": my_lost,
        "competitor_threats": competitor_threats[:20],
        "scan_date_current": scan_date_current,
        "scan_date_previous": scan_date_previous,
        "has_delta": has_delta,
    }


@router.get("/v31-migration-status/{biz_id}")
async def get_v31_migration_status(biz_id: str, user=Depends(get_current_user)):
    """v3.1 모델 전환 배너 표시 여부.

    토글 ON(SCORE_MODEL_VERSION=v3_1) + 7일 이내 첫 v3.1 스캔이 있으면 show=true 반환.
    토글 OFF 또는 조건 미충족 시 항상 show=false.
    """
    import os as _os
    from datetime import datetime, timedelta, timezone

    model_ver = _os.getenv("SCORE_MODEL_VERSION", "v3_0")
    if model_ver != "v3_1":
        return {"show": False, "model_version": model_ver}

    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])

    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    try:
        # 최근 7일 이내에 keyword_ranks 컬럼이 채워진 스캔이 있는지 확인
        # (v3.1 스캔 = keyword_ranks 존재)
        scan_row = (await execute(
            supabase.table("scan_results")
            .select("id, scanned_at")
            .eq("business_id", biz_id)
            .not_.is_("keyword_ranks", "null")
            .gte("scanned_at", cutoff)
            .order("scanned_at", desc=True)
            .limit(1)
        )).data
        if scan_row:
            return {
                "show": True,
                "model_version": "v3_1",
                "first_v31_scan_at": scan_row[0].get("scanned_at"),
            }
        return {"show": False, "model_version": "v3_1"}
    except Exception as e:
        _logger.warning(f"[v31_migration_status] biz_id={biz_id}: {e}")
        return {"show": False, "model_version": model_ver}
