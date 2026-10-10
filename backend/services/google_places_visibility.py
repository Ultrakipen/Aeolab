"""
구글 지도 노출 확인 (무료 체험 전용)
- Serper.dev /places (구글 지도 검색 상위 10곳, 호출당 1크레딧)
- "서울 성동구 미용실"로 검색했을 때 내 가게가 상위 10곳에 있는지, 내 가게와 상위 가게의 평점·리뷰 수

카카오 측정(kakao_visibility)과 같은 원칙:
  ① 시·군·구 단위로 검색하고 ② 같은 브랜드의 다른 지점·다른 구의 같은 이름은 내 가게로 잡지 않으며
  ③ 조회가 실패하면 "등록 안 됨"이 아니라 알 수 없음(None)으로 둔다.
상위 10곳에 없으면 가게 이름으로 한 번 더 찾아 등록 여부와 평점·리뷰 수를 확인한다(체험 1건당 최대 2크레딧).
"""
import os
import logging
import aiohttp

from services.kakao_visibility import _norm, _region_query_prefix, _district_token, _same_name

_logger = logging.getLogger("aeolab")
_URL = "https://google.serper.dev/places"
_TIMEOUT = aiohttp.ClientTimeout(total=10)


def _api_key() -> str:
    return os.getenv("SERPER_API_KEY", "")


def _is_my_place(target: str, place: dict, district: str) -> bool:
    name = _norm(place.get("title", ""))
    t = _norm(target)
    if not t or not name or not _same_name(t, name):
        return False
    if district and district not in (place.get("address") or ""):
        return False
    return True


def _brief(i: int, p: dict) -> dict:
    return {
        "rank": i + 1,
        "name": p.get("title", ""),
        "rating": p.get("rating"),
        "rating_count": p.get("ratingCount"),
        "address": p.get("address", ""),
    }


async def _search(session: aiohttp.ClientSession, query: str):
    """성공하면 places 리스트, 실패하면 None (빈 결과 []와 구분)"""
    try:
        async with session.post(
            _URL,
            headers={"X-API-KEY": _api_key(), "Content-Type": "application/json"},
            json={"q": query, "gl": "kr", "hl": "ko"},
        ) as resp:
            if resp.status != 200:
                _logger.warning("[google_places] Serper HTTP %s", resp.status)
                return None
            data = await resp.json()
            return data.get("places") or []
    except Exception as e:
        _logger.warning("[google_places] Serper error: %s", e)
        return None


async def get_google_places_visibility(business_name: str, keyword: str, region: str) -> dict:
    """
    Returns:
        search_query         : 실제 검색어
        my_rank              : 상위 10곳 중 내 가게 순위 (None = 10곳 안에 없음)
        is_on_google         : 구글 지도 등록 여부 (True/False, 조회 실패·키 없음이면 None)
        my_place             : 내 가게 {name, rating, rating_count, address} (못 찾으면 None)
        top                  : 상위 5곳 [{rank, name, rating, rating_count, address}]
        registration_checked : 등록 여부를 실제로 확인했는지
    """
    unknown = {"search_query": "", "my_rank": None, "is_on_google": None, "my_place": None, "top": [], "registration_checked": False}
    if not _api_key():
        return unknown

    prefix = _region_query_prefix(region)
    query = f"{prefix} {keyword}".strip()
    district = _district_token(region)

    async with aiohttp.ClientSession(timeout=_TIMEOUT) as session:
        places = await _search(session, query)
        if places is None:
            return {**unknown, "search_query": query}

        top = [_brief(i, p) for i, p in enumerate(places[:5])]
        idx = next((i for i, p in enumerate(places) if _is_my_place(business_name, p, district)), None)
        if idx is not None:
            mine = _brief(idx, places[idx])
            return {
                "search_query": query, "my_rank": idx + 1, "is_on_google": True,
                "my_place": {k: mine[k] for k in ("name", "rating", "rating_count", "address")},
                "top": top, "registration_checked": True,
            }

        by_name = await _search(session, f"{prefix} {business_name}".strip())
        if by_name is None:
            return {"search_query": query, "my_rank": None, "is_on_google": None, "my_place": None, "top": top, "registration_checked": False}
        j = next((i for i, p in enumerate(by_name) if _is_my_place(business_name, p, district)), None)
        if j is None:
            return {"search_query": query, "my_rank": None, "is_on_google": False, "my_place": None, "top": top, "registration_checked": True}
        mine = _brief(j, by_name[j])
        return {
            "search_query": query, "my_rank": None, "is_on_google": True,
            "my_place": {k: mine[k] for k in ("name", "rating", "rating_count", "address")},
            "top": top, "registration_checked": True,
        }
