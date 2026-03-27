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
    """AI Visibility Score 조회 (breakdown 포함) — 본인 사업장만"""
    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])
    result = await execute(
        supabase.table("scan_results")
        .select("id, scanned_at, total_score, exposure_freq, score_breakdown, competitor_scores, query_used")
        .eq("business_id", biz_id)
        .order("scanned_at", desc=True)
        .limit(1)
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="No scan results found")
    return result.data[0]


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
    """업종·지역 조건으로 최신 점수 목록 조회"""
    q = supabase.table("businesses").select("id").eq("is_active", True)
    if category:
        q = q.eq("category", category)
    if region:
        # 접두어 매칭(prefix)으로 B-tree 인덱스 활용 가능 (%로 시작하지 않음)
        region_prefix = region.split()[0]
        q = q.ilike("region", f"{region_prefix}%")
    businesses = (await execute(q.limit(200))).data or []
    if not businesses:
        return []

    biz_ids = [b["id"] for b in businesses]
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
            latest[s["business_id"]] = s["total_score"]
    return list(latest.values())


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
            .select("id, name, category, region, address, phone, website_url, keywords, has_schema")
            .eq("id", biz_id)
            .single()
        )
    ).data
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")

    latest_scan = (
        await execute(
            supabase.table("scan_results")
            .select("*")
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
            .select("*")
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
            .select("total_score, exposure_freq, created_at")
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
        "scanned_at": s.get("created_at", ""),
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
            .select("*")
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
