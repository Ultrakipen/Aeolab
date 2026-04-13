"""
backend/routers/business_search.py

GET /api/businesses/search?query=&region=

네이버 지역검색 + 카카오 로컬 API 병렬 실행 후 중복 제거하여 최대 10개 반환.
인증 불필요 — 경쟁사 등록 전 검색, 체험 사용자 모두 호출 가능.
"""
import asyncio
import os
import re
import logging
import aiohttp
from fastapi import APIRouter, HTTPException, Query

router = APIRouter()

_logger = logging.getLogger("aeolab.business_search")

_KAKAO_LOCAL_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"
_NAVER_LOCAL_URL = "https://openapi.naver.com/v1/search/local.json"


def _strip_tags(text: str) -> str:
    """HTML 태그 제거 (<b>, </b> 등)"""
    return re.sub(r"<[^>]+>", "", text or "")


def _dedup_key(name: str, address: str) -> str:
    """중복 제거용 키: 이름 앞 5글자 + 주소 앞 10글자"""
    return f"{name[:5]}|{address[:10]}"


async def _search_kakao(query: str, region: str) -> list[dict]:
    """카카오 로컬 REST API 기반 지역 사업장 검색."""
    rest_key = os.getenv("KAKAO_REST_API_KEY")
    if not rest_key:
        return []

    full_query = f"{region.split()[0]} {query}".strip() if region else query

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                _KAKAO_LOCAL_URL,
                params={"query": full_query, "size": 15},
                headers={"Authorization": f"KakaoAK {rest_key}"},
                timeout=aiohttp.ClientTimeout(total=5),
            ) as res:
                if res.status != 200:
                    _logger.warning("kakao_search_fail status=%s", res.status)
                    return []
                data = await res.json()

        results = []
        for doc in data.get("documents", []):
            # 네이버 플레이스 URL 및 ID는 카카오에서 제공하지 않음
            results.append(
                {
                    "name": doc.get("place_name", ""),
                    "address": doc.get("road_address_name") or doc.get("address_name", ""),
                    "category": doc.get("category_name", ""),
                    "phone": doc.get("phone", ""),
                    "naver_place_url": "",
                    "naver_place_id": "",
                    "kakao_place_id": doc.get("id", ""),
                    "review_count": 0,
                    "avg_rating": 0.0,
                    "source": "kakao",
                }
            )
        return results

    except (aiohttp.ClientError, asyncio.TimeoutError) as e:
        _logger.warning("kakao_search_error: %s", e)
        return []


async def _search_naver(query: str, region: str) -> list[dict]:
    """네이버 지역 검색 API."""
    client_id = os.getenv("NAVER_CLIENT_ID")
    client_secret = os.getenv("NAVER_CLIENT_SECRET")
    if not client_id or not client_secret:
        return []

    full_query = f"{region.split()[0]} {query}".strip() if region else query

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                _NAVER_LOCAL_URL,
                params={"query": full_query, "display": 15, "sort": "random"},
                headers={
                    "X-Naver-Client-Id": client_id,
                    "X-Naver-Client-Secret": client_secret,
                },
                timeout=aiohttp.ClientTimeout(total=5),
            ) as res:
                if res.status != 200:
                    _logger.warning("naver_search_fail status=%s", res.status)
                    return []
                data = await res.json()

        results = []
        for item in data.get("items", []):
            link = item.get("link", "")
            # 네이버 플레이스 ID 추출 (link 예시: https://map.naver.com/v5/entry/place/12345678)
            naver_place_id = ""
            m = re.search(r"/place/(\d+)", link)
            if m:
                naver_place_id = m.group(1)

            results.append(
                {
                    "name": _strip_tags(item.get("title", "")),
                    "address": item.get("roadAddress") or item.get("address", ""),
                    "category": item.get("category", ""),
                    "phone": item.get("telephone", ""),
                    "naver_place_url": link,
                    "naver_place_id": naver_place_id,
                    "kakao_place_id": "",
                    "review_count": 0,
                    "avg_rating": 0.0,
                    "source": "naver",
                }
            )
        return results

    except (aiohttp.ClientError, asyncio.TimeoutError) as e:
        _logger.warning("naver_search_error: %s", e)
        return []


def _merge_results(kakao_results: list[dict], naver_results: list[dict]) -> list[dict]:
    """
    두 소스 결과를 중복 제거하여 병합.
    - 중복 기준: 이름 앞 5글자 + 주소 앞 10글자 일치
    - 중복 시 카카오 데이터 우선 (데이터 품질이 더 좋음)
    - source 필드는 "both"로 업데이트
    """
    seen: dict[str, dict] = {}

    for item in kakao_results:
        key = _dedup_key(item["name"], item["address"])
        seen[key] = item

    for item in naver_results:
        key = _dedup_key(item["name"], item["address"])
        if key in seen:
            # 카카오 데이터에 네이버 URL/ID 보강 후 source="both"
            seen[key]["naver_place_url"] = item["naver_place_url"]
            seen[key]["naver_place_id"] = item["naver_place_id"]
            seen[key]["source"] = "both"
        else:
            seen[key] = item

    return list(seen.values())


@router.get("/search")  # public — 인증 불필요 (체험 사용자 + 경쟁사 등록 전 검색 모두 허용)
async def search_businesses(
    query: str = Query(..., min_length=2, description="검색어 (최소 2글자)"),
    region: str = Query("", description="지역명 (예: 창원, 서울 강남구)"),
):
    """
    네이버 + 카카오 병렬 지역 검색 — 인증 불필요.

    중복 제거 후 최대 10개 반환. 카카오 데이터 우선.
    """
    if len(query.strip()) < 2:
        raise HTTPException(status_code=422, detail="query는 최소 2글자 이상이어야 합니다.")

    kakao_task = asyncio.create_task(_search_kakao(query.strip(), region.strip()))
    naver_task = asyncio.create_task(_search_naver(query.strip(), region.strip()))

    kakao_results, naver_results = await asyncio.gather(kakao_task, naver_task)

    merged = _merge_results(kakao_results, naver_results)

    if not merged:
        raise HTTPException(
            status_code=503,
            detail="지역 검색 API 연결 오류. 잠시 후 다시 시도하세요.",
        )

    return merged[:10]
