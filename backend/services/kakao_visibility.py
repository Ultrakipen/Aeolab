"""
카카오맵 검색 가시성 분석
- 카카오 로컬 키워드 검색 API (dapi.kakao.com)
- 동일 키워드로 카카오맵에서 상위 노출 여부 확인
"""
import os
import re
import logging
import aiohttp

_logger     = logging.getLogger("aeolab")
_KAKAO_KEY  = os.getenv("KAKAO_REST_API_KEY", "")
_BASE_URL   = "https://dapi.kakao.com/v2/local/search/keyword.json"
_TIMEOUT    = aiohttp.ClientTimeout(total=6)


def _name_matches(target: str, candidate: str) -> bool:
    """공백·대소문자 무시 부분 매칭"""
    t = re.sub(r"\s+", "", target).lower()
    c = re.sub(r"\s+", "", candidate).lower()
    return t in c or c in t


async def get_kakao_visibility(business_name: str, keyword: str, region: str) -> dict:
    """
    카카오맵 검색 가시성 분석

    Returns:
        search_query        : 실제 사용한 검색어
        my_rank             : 내 가게 순위 (None = 미노출)
        is_on_kakao         : 카카오맵 등록 여부
        kakao_competitors   : 상위 5개 가게 [{rank, name, address, category, phone, url}]
    """
    if not _KAKAO_KEY:
        return {"search_query": "", "my_rank": None, "is_on_kakao": False, "kakao_competitors": []}

    region_prefix = region.split()[0] if region else region
    search_query  = f"{region_prefix} {keyword}".strip()

    try:
        headers = {"Authorization": f"KakaoAK {_KAKAO_KEY}"}
        params  = {"query": search_query, "size": 5}
        async with aiohttp.ClientSession(timeout=_TIMEOUT) as session:
            async with session.get(_BASE_URL, headers=headers, params=params) as resp:
                if resp.status != 200:
                    _logger.warning(f"Kakao Local API HTTP {resp.status}")
                    return {"search_query": search_query, "my_rank": None, "is_on_kakao": False, "kakao_competitors": []}
                data = await resp.json()
    except Exception as e:
        _logger.warning(f"Kakao Local API error: {e}")
        return {"search_query": search_query, "my_rank": None, "is_on_kakao": False, "kakao_competitors": []}

    kakao_competitors = []
    my_rank     = None
    is_on_kakao = False

    for i, doc in enumerate(data.get("documents", [])):
        name = doc.get("place_name", "")
        kakao_competitors.append({
            "rank":     i + 1,
            "name":     name,
            "address":  doc.get("road_address_name") or doc.get("address_name", ""),
            "category": doc.get("category_name", "").split(" > ")[-1],  # 마지막 카테고리만
            "phone":    doc.get("phone", ""),
            "url":      doc.get("place_url", ""),
        })
        if _name_matches(business_name, name):
            my_rank     = i + 1
            is_on_kakao = True

    return {
        "search_query":      search_query,
        "my_rank":           my_rank,
        "is_on_kakao":       is_on_kakao,
        "kakao_competitors": kakao_competitors,
    }
