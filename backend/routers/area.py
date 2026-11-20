"""
/api/area — 우리 동네 상권 (비로그인 공개)

방문자 요청은 미리 수집된 스냅샷 파일만 읽는다. 외부 API(data.go.kr·카카오·네이버)와 Supabase를 부르지 않는다.
"""
from fastapi import APIRouter, HTTPException, Query, Request

from services import area_nearby
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


def _client_ip(request: Request) -> str:
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"


def _guard(request: Request) -> None:
    try:
        area_nearby.check_rate(_client_ip(request))
    except area_nearby.RateLimited:
        raise HTTPException(status_code=429, detail="요청이 너무 잦아요. 잠시 뒤에 다시 시도해 주세요.")


# public — 비로그인 공개 (의도적). 가게 이름·주소 → 후보 최대 5곳. 호출마다 카카오를 부르므로 IP당 분당 한도.
# 단일 세그먼트 경로라 아래 /{region_slug}/{category} 와 겹치지 않는다.
@router.get("/locate")
async def area_locate(request: Request, q: str = Query(..., min_length=2, max_length=60)):
    _guard(request)
    places = await area_nearby.search_places(q)
    if places is None:
        raise HTTPException(status_code=503, detail="위치 검색을 잠시 쓸 수 없어요. 잠시 뒤에 다시 시도해 주세요.")
    return {"places": places}


# public — 비로그인 공개 (의도적). 좌표 중심 반경 300m 업종별 업소 수(집계만, 가게 이름 없음).
@router.get("/nearby")
async def area_nearby_counts(request: Request, lon: float = Query(...), lat: float = Query(...)):
    if not area_nearby.valid_coords(lon, lat):
        raise HTTPException(status_code=422, detail="국내 좌표만 조회할 수 있어요.")
    _guard(request)
    try:
        return await area_nearby.nearby(lon, lat, ip=_client_ip(request))
    except area_nearby.DailyLimit:
        return {"available": False, "reason": "daily_limit", "radius_m": area_nearby.RADIUS_M}
    except area_nearby.IpDailyLimit:
        return {"available": False, "reason": "ip_limit", "radius_m": area_nearby.RADIUS_M}


# public — 비로그인 공개 엔드포인트 (의도적)
@router.get("/{region_slug}/{category}")
async def area_detail(region_slug: str, category: str):
    if not is_valid(region_slug, category):
        raise HTTPException(status_code=404, detail="지원하지 않는 지역 또는 업종입니다")
    return get_area(region_slug, category)
