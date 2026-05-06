"""
업종·지역별 공개 AI 노출 인덱스 (비로그인 접근 가능)
분기별 익명 집계 데이터 제공 — 마케팅 SEO + 무료 체험 전환 유도용
"""
import logging
from fastapi import APIRouter, HTTPException
from db.supabase_client import get_client, execute
from utils import cache as _cache

_logger = logging.getLogger("aeolab")
router = APIRouter()

VALID_CATEGORIES = {
    "restaurant", "cafe", "bakery", "bar", "beauty", "nail",
    "medical", "pharmacy", "fitness", "yoga", "pet",
    "education", "tutoring", "legal", "realestate", "interior",
    "auto", "cleaning", "shopping", "fashion", "photo",
    "video", "design", "accommodation", "other",
}

CATEGORY_KO = {
    "restaurant": "음식점", "cafe": "카페", "bakery": "베이커리",
    "bar": "주점·바", "beauty": "미용·뷰티", "nail": "네일",
    "medical": "병원·의원", "pharmacy": "약국", "fitness": "운동·헬스",
    "yoga": "요가·필라테스", "pet": "반려동물", "education": "교육·학원",
    "tutoring": "과외·튜터링", "legal": "법률·행정", "realestate": "부동산",
    "interior": "인테리어", "auto": "자동차", "cleaning": "청소·세탁",
    "shopping": "쇼핑", "fashion": "패션", "photo": "사진·영상",
    "video": "영상제작", "design": "디자인", "accommodation": "숙박",
    "other": "기타",
}


# public — 비로그인 공개 엔드포인트 (의도적, 마케팅 SEO + 무료 체험 전환 유도용)
@router.get("/summary")
async def get_index_summary():
    """전체 업종 요약 인덱스 (캐시 2시간). 인증 불필요 — 익명 집계 데이터만 노출."""
    cache_key = _cache._make_key("public_index", "summary")
    cached = _cache.get(cache_key)
    if cached:
        return cached

    supabase = get_client()
    # [2026-05-01] 컬럼명 수정 — schema 정의는 avg_unified/p25_unified/p75_unified.
    # 응답 키는 하위 호환을 위해 avg_score/p25_score/p75_score 유지 (프론트엔드 영향 차단).
    try:
        rows = (await execute(
            supabase.table("index_snapshots")
            .select("category, avg_unified, sample_count, quarter, p25_unified, p75_unified")
            .order("quarter", desc=True)
        )).data or []
    except Exception as e:
        _logger.warning(f"index_snapshots query failed: {e}")
        return {"categories": [], "note": "데이터 준비 중입니다"}

    # 최신 분기 데이터만 추출
    latest_by_cat: dict[str, dict] = {}
    for row in rows:
        cat = row.get("category", "")
        if cat not in latest_by_cat:
            latest_by_cat[cat] = row

    categories = []
    for cat, row in latest_by_cat.items():
        if row.get("sample_count", 0) < 5:
            continue
        categories.append({
            "category": cat,
            "category_ko": CATEGORY_KO.get(cat, cat),
            "avg_score": round(row.get("avg_unified", 0) or 0, 1),
            "p25_score": round(row.get("p25_unified", 0) or 0, 1),
            "p75_score": round(row.get("p75_unified", 0) or 0, 1),
            "sample_count": row.get("sample_count", 0),
            "quarter": row.get("quarter", ""),
        })

    categories.sort(key=lambda x: x["avg_score"], reverse=True)
    result = {"categories": categories, "total_categories": len(categories)}
    _cache.set(cache_key, result, ttl=7200)
    return result


# public — 비로그인 공개 엔드포인트 (의도적, 마케팅 SEO + 무료 체험 전환 유도용)
@router.get("/{category}")
async def get_category_index(category: str):
    """특정 업종의 지역별 AI 노출 인덱스 (캐시 2시간). 인증 불필요 — 익명 집계 데이터만 노출."""
    if category not in VALID_CATEGORIES:
        raise HTTPException(status_code=404, detail="지원하지 않는 업종입니다")

    cache_key = _cache._make_key("public_index", category)
    cached = _cache.get(cache_key)
    if cached:
        return cached

    supabase = get_client()
    # [2026-05-01] 컬럼명 수정 — schema 정의는 avg_unified/p25_unified/p75_unified.
    # 응답 키는 하위 호환을 위해 avg_score/p25_score/p75_score 유지.
    try:
        rows = (await execute(
            supabase.table("index_snapshots")
            .select("category, region, avg_unified, sample_count, quarter, p25_unified, p75_unified, platform_stats, top_keywords, growth_dist")
            .eq("category", category)
            .order("quarter", desc=True)
            .limit(50)
        )).data or []
    except Exception as e:
        _logger.warning(f"index_snapshots query failed: {e}")
        return {"category": category, "regions": [], "note": "데이터 준비 중입니다"}

    # 최신 분기 지역별 데이터
    latest_by_region: dict[str, dict] = {}
    for row in rows:
        region = row.get("region") or "전국"
        if region not in latest_by_region:
            latest_by_region[region] = row

    regions = []
    for region, row in latest_by_region.items():
        if row.get("sample_count", 0) < 5:
            continue
        regions.append({
            "region": region,
            "avg_score": round(row.get("avg_unified", 0) or 0, 1),
            "p25_score": round(row.get("p25_unified", 0) or 0, 1),
            "p75_score": round(row.get("p75_unified", 0) or 0, 1),
            "sample_count": row.get("sample_count", 0),
            "quarter": row.get("quarter", ""),
            "top_keywords": (row.get("top_keywords") or [])[:5],
        })

    regions.sort(key=lambda x: x["avg_score"], reverse=True)
    result = {
        "category": category,
        "category_ko": CATEGORY_KO.get(category, category),
        "regions": regions,
        "total_regions": len(regions),
    }
    _cache.set(cache_key, result, ttl=7200)
    return result
