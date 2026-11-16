"""
/api/area — 우리 동네 상권 (비로그인 공개)

방문자 요청은 미리 수집된 스냅샷 파일만 읽는다. 외부 API(data.go.kr·카카오·네이버)와 Supabase를 부르지 않는다.
"""
from fastapi import APIRouter, HTTPException

from services.area_snapshot import get_area, list_available, list_categories, list_regions
from services.area_data import is_valid

router = APIRouter()


# public — 비로그인 공개 엔드포인트 (의도적, 마케팅 SEO용 집계 수치만 노출)
@router.get("/meta")
async def area_meta():
    return {"regions": list_regions(), "categories": list_categories()}


# public — 비로그인 공개 엔드포인트 (의도적, 사이트맵용 — 값이 있는 조합만)
@router.get("/available")
async def area_available():
    return {"items": list_available()}


# public — 비로그인 공개 엔드포인트 (의도적)
@router.get("/{region_slug}/{category}")
async def area_detail(region_slug: str, category: str):
    if not is_valid(region_slug, category):
        raise HTTPException(status_code=404, detail="지원하지 않는 지역 또는 업종입니다")
    return get_area(region_slug, category)
