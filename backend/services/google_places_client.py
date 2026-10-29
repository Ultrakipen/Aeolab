"""Google Places API (New) 클라이언트 — 채널 정보 일관성 점검 전용 (2026-10-30).

약관·요금 (공식 문서 확인, 2026-10-29):
  - place_id 외 응답 내용은 저장·캐시하지 않는다 → 호출 시점 비교·표시에만 쓴다. 이 모듈은 DB를 건드리지 않는다.
  - FieldMask 필수. reviews 계열 필드는 요청하지 않는다(더 높은 과금 단계). 상수로 고정하고 테스트가 지킨다.
  - 상세 조회(전화·평점·리뷰 수·웹사이트 포함)는 Enterprise 단계(월 1,000건 무료 후 $20/1,000),
    후보 검색(displayName 포함 Text Search)은 Pro 단계(월 5,000건 무료).
  - 표시할 때 구글 출처 표기를 붙인다(프론트 책임).
키는 서버 backend/.env의 GOOGLE_PLACES_API_KEY. 키 값은 로그·예외 메시지에 넣지 않는다.
"""
import asyncio
import logging
import os
import re

import aiohttp

_logger = logging.getLogger("aeolab")

_BASE = "https://places.googleapis.com/v1"
_TIMEOUT = aiohttp.ClientTimeout(total=8)
_PLACE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{10,255}$")

# 요청 필드는 여기서만 정한다. reviews·photos 등 고가 필드를 넣지 않는다.
DETAIL_FIELD_MASK = (
    "id,displayName,formattedAddress,nationalPhoneNumber,websiteUri,"
    "businessStatus,rating,userRatingCount"
)
CANDIDATE_FIELD_MASK = "places.id,places.displayName,places.formattedAddress"


class PlacesError(Exception):
    """code: not_configured | invalid_place_id | forbidden | not_found | rate_limited | bad_request | timeout | network | http_NNN"""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def is_valid_place_id(value) -> bool:
    """URL 경로에 들어가는 값이라 형식을 엄격히 제한한다(경로 조작 방지)."""
    return isinstance(value, str) and bool(_PLACE_ID_RE.match(value))


def map_http_error(status: int) -> str:
    if status in (401, 403):
        return "forbidden"  # 키 제한·결제 계정·API 사용 설정 문제
    if status == 404:
        return "not_found"
    if status == 429:
        return "rate_limited"
    if status == 400:
        return "bad_request"
    return f"http_{status}"


async def _request(method: str, path: str, field_mask: str, json_body: dict | None = None, params: dict | None = None) -> dict:
    key = os.getenv("GOOGLE_PLACES_API_KEY", "")
    if not key:
        raise PlacesError("not_configured")
    headers = {"X-Goog-Api-Key": key, "X-Goog-FieldMask": field_mask}
    try:
        async with aiohttp.ClientSession(timeout=_TIMEOUT) as session:
            async with session.request(method, f"{_BASE}{path}", headers=headers, json=json_body, params=params) as resp:
                if resp.status != 200:
                    _logger.warning("[places] HTTP %s (%s)", resp.status, method)
                    raise PlacesError(map_http_error(resp.status))
                return await resp.json(content_type=None)
    except PlacesError:
        raise
    except asyncio.TimeoutError:
        raise PlacesError("timeout")
    except aiohttp.ClientError:
        raise PlacesError("network")


def _normalize(place: dict) -> dict:
    """응답을 평탄화한다. 구글에 등록되지 않은 항목(예: 전화번호)은 필드가 아예 없을 수 있다 → None."""
    place = place or {}
    return {
        "place_id": place.get("id"),
        "name": (place.get("displayName") or {}).get("text"),
        "address": place.get("formattedAddress"),
        "phone": place.get("nationalPhoneNumber") or None,
        "website": place.get("websiteUri") or None,
        "status": place.get("businessStatus"),
        "rating": place.get("rating"),
        "rating_count": place.get("userRatingCount"),
    }


async def search_candidates(query: str) -> list[dict]:
    """사업장 후보(최대 5곳) — 사장님이 직접 확인해 연결한다(자동 확정 금지: 동명·프랜차이즈 지점 오매칭 방지)."""
    body = {"textQuery": query, "languageCode": "ko", "regionCode": "KR", "pageSize": 5}
    data = await _request("POST", "/places:searchText", CANDIDATE_FIELD_MASK, json_body=body)
    return [_normalize(p) for p in (data.get("places") or [])]


async def get_place_details(place_id: str) -> dict:
    if not is_valid_place_id(place_id):
        raise PlacesError("invalid_place_id")
    data = await _request("GET", f"/places/{place_id}", DETAIL_FIELD_MASK, params={"languageCode": "ko"})
    return _normalize(data)
