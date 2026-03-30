import csv
import io
from datetime import date
from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse, Response
from db.supabase_client import get_client, execute
from middleware.plan_gate import get_current_user
from utils import cache as _cache

router = APIRouter()

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
            "website_check_result, kakao_result"
        )
        .eq("business_id", biz_id)
        .order("scanned_at", desc=True)
        .limit(1)
    )).data
    if not row:
        raise HTTPException(status_code=404, detail="No scan results found")

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
        # DiagnosisReport — score_result
        "score_result": {
            "total_score": total,
            "grade":       grade,
            "breakdown":   r.get("score_breakdown") or {},
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
    }


@router.get("/history/{biz_id}")
async def get_history(biz_id: str, user=Depends(get_current_user)):
    """30일 점수 추세 — 본인 사업장만"""
    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])
    result = await execute(
        supabase.table("score_history")
        .select("score_date, total_score, exposure_freq, rank_in_category, total_in_category, weekly_change")
        .eq("business_id", biz_id)
        .order("score_date", desc=True)
        .limit(30)
    )
    return result.data


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
async def export_csv(biz_id: str, x_user_id: str = Header(...)):
    """Pro+ 전용: 스캔 히스토리 CSV 내보내기"""
    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, x_user_id)

    # 플랜 확인
    sub = (
        await execute(
            supabase.table("subscriptions")
            .select("plan, status")
            .eq("user_id", x_user_id)
            .maybe_single()
        )
    ).data
    plan = (sub or {}).get("plan", "free")
    if plan not in ("pro", "biz", "startup", "enterprise"):
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "required_plans": ["pro", "biz"]},
        )

    rows = (
        await execute(
            supabase.table("scan_results")
            .select("scanned_at, total_score, exposure_freq, query_used, score_breakdown")
            .eq("business_id", biz_id)
            .order("scanned_at", desc=True)
            .limit(100)
        )
    ).data

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["스캔일시", "총점", "AI노출빈도(/100)", "검색쿼리",
                     "AI노출(30%)", "리뷰품질(20%)", "Schema(15%)", "언급빈도(15%)", "정보완성도(10%)", "최신성(10%)"])
    for r in rows:
        bd = r.get("score_breakdown") or {}
        writer.writerow([
            r["scanned_at"],
            r["total_score"],
            r["exposure_freq"],
            r["query_used"],
            bd.get("exposure_freq", ""),
            bd.get("review_quality", ""),
            bd.get("schema_score", ""),
            bd.get("online_mentions", ""),
            bd.get("info_completeness", ""),
            bd.get("content_freshness", ""),
        ])

    output.seek(0)
    filename = f"aeolab_report_{biz_id[:8]}.csv"
    return StreamingResponse(
        iter([output.getvalue().encode("utf-8-sig")]),  # utf-8-sig: 한글 엑셀 호환
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/pdf/{biz_id}")
async def export_pdf(biz_id: str, x_user_id: str = Header(...)):
    """Pro+ 전용: AI Visibility 리포트 PDF 다운로드"""
    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, x_user_id)

    # 플랜 확인
    sub = (
        await execute(
            supabase.table("subscriptions")
            .select("plan, status")
            .eq("user_id", x_user_id)
            .maybe_single()
        )
    ).data
    plan = (sub or {}).get("plan", "free")
    if plan not in ("pro", "biz", "startup", "enterprise"):
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
            .select("score_date, total_score, exposure_freq, rank_in_category, total_in_category, weekly_change")
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

    from services.pdf_generator import generate_pdf_report
    pdf_bytes = generate_pdf_report(
        biz=biz,
        latest_scan=latest_scan[0],
        history=history,
        guide=guide[0] if guide else None,
    )

    filename = f"aeolab_{biz.get('name', biz_id[:8])}_report.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"},
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
        except Exception:
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
async def get_badge(biz_id: str):
    """인증 배지 JSON + 삽입 코드 반환 (점수 70점 이상 조건)"""
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
async def get_mention_context(biz_id: str, x_user_id: str = Header(...)):
    """최근 스캔의 AI 인용 맥락 데이터 조회 (Pro+ 전용)"""
    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, x_user_id)

    # 플랜 확인
    sub = (
        await execute(
            supabase.table("subscriptions")
            .select("plan")
            .eq("user_id", x_user_id)
            .eq("status", "active")
            .maybe_single()
        )
    ).data
    plan = (sub or {}).get("plan", "free")
    if plan not in ("pro", "biz", "enterprise"):
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "required_plans": ["pro", "biz", "enterprise"]},
        )

    citations = (
        await execute(
            supabase.table("ai_citations")
            .select("id, platform, query, mentioned, excerpt, sentiment, mention_type, created_at")
            .eq("business_id", biz_id)
            .order("created_at", desc=True)
            .limit(20)
        )
    ).data or []
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
            .order("scanned_at", { "ascending": False })
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

    # 개선 힌트 — 가장 낮은 항목 기반
    breakdown = scan.get("score_breakdown") or {}
    LABELS = {
        "exposure_freq": "Gemini 노출 빈도",
        "review_quality": "리뷰 품질",
        "schema_score": "Schema 구조화",
        "online_mentions": "온라인 언급",
        "info_completeness": "정보 완성도",
        "content_freshness": "콘텐츠 최신성",
    }
    lowest = min(breakdown.items(), key=lambda x: x[1], default=(None, None))
    hint = f"{LABELS.get(lowest[0], '')} 개선 시 점수 상승 예상" if lowest[0] else ""

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

    from services.gap_analyzer import analyze_gap_from_db
    result = await analyze_gap_from_db(biz_id, supabase)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail="격차 분석에 필요한 스캔 데이터 또는 경쟁사 데이터가 없습니다. 먼저 AI 스캔을 실행하고 경쟁사를 등록해주세요.",
        )
    return result.model_dump(mode="json")
