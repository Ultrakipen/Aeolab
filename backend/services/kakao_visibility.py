"""
카카오맵 검색 가시성 분석
- 카카오 로컬 키워드 검색 API (dapi.kakao.com)
- 동일 키워드로 카카오맵에서 상위 노출 여부 확인

2026-10-10 정확도 수정 (라이브 실측: 준오헤어 왕십리역점이 "서울 미용실" 검색 5곳에 없다는 이유로 "카카오맵 미등록"으로 기록됨)
  ① 지역을 첫 단어만 쓰던 것("서울 성동구"→"서울")을 시·군·구 단위로 쓴다 — 서울 전체 5곳만 보던 문제.
  ② 순위는 상위 15곳(API 최대)에서 찾고, 등록 여부는 가게 이름으로 따로 확인한다.
     이전에는 상위 5곳에 없으면 곧바로 is_on_kakao=False("미등록")였다. 이 값은 체험 결과 이메일에 "카카오맵 미등록"으로 그대로 나간다.
  ③ 같은 브랜드의 다른 지점이 내 가게로 잡히지 않도록, 이름은 지점 표기만 다를 때(names_match) + 주소에 같은 구·군·시가 있을 때만 일치로 본다.
  ④ 조회 자체가 실패하면 is_on_kakao=None(알 수 없음) — 실패를 "미등록"으로 단정하지 않는다.
"""
import os
import re
import logging
import aiohttp

from services.ai_scanner.chatgpt_scanner import names_match

_logger     = logging.getLogger("aeolab")
_KAKAO_KEY  = os.getenv("KAKAO_REST_API_KEY", "")
_BASE_URL   = "https://dapi.kakao.com/v2/local/search/keyword.json"
_TIMEOUT    = aiohttp.ClientTimeout(total=6)
_RANK_SIZE  = 15  # 카카오 키워드 검색 size 상한
_NAME_SIZE  = 5


def _norm(name: str) -> str:
    """chatgpt_scanner._norm_name과 같은 규칙 — 공백·기호 제거, 소문자"""
    return re.sub(r"[\s\-·.,()\[\]'\"“”‘’]+", "", name or "").lower()


def _region_query_prefix(region: str) -> str:
    """
    검색어에 붙일 지역 — 시·군·구 단위가 남도록 한다.
      "서울 성동구"            → "서울 성동구"
      "서울특별시 성동구"       → "서울 성동구"
      "경상남도 창원시 의창구"  → "창원시 의창구"
      "서울특별시 성동구 성수동" → "성동구 성수동"
      "서울"                   → "서울"
    """
    parts = (region or "").strip().split()
    if not parts:
        return ""
    parts[0] = re.sub(r"(특별시|광역시|특별자치시|특별자치도)$", "", parts[0]) or parts[0]
    if len(parts) <= 2:
        return " ".join(parts)
    return " ".join(parts[-2:])


def _district_token(region: str) -> str:
    """주소 대조에 쓸 구·군(없으면 시) 이름. "서울 성동구 성수동" → "성동구", "원주시" → "원주시", "서울" → "" """
    parts = (region or "").strip().split()
    for p in reversed(parts):
        if re.search(r"[가-힣]+(구|군)$", p):
            return p
    for p in reversed(parts):
        if re.search(r"[가-힣]{2,}시$", p) and p not in ("서울시", "특별시"):
            return p
    return ""


def _same_name(t: str, name: str) -> bool:
    """지점 표기만 다르면 같은 가게 — 규칙은 names_match 하나로 통일(2026-10-10: "점"만 붙은 표기까지 포함하도록 거기서 처리)."""
    return names_match(t, name)


def _is_my_shop(target: str, doc: dict, district: str) -> bool:
    name = _norm(doc.get("place_name", ""))
    t = _norm(target)
    if not t or not name or not _same_name(t, name):
        return False
    if district:
        addr = f"{doc.get('road_address_name', '')} {doc.get('address_name', '')}"
        if district not in addr:
            return False
    return True


async def _search(session: aiohttp.ClientSession, query: str, size: int):
    """성공하면 documents 리스트, 실패하면 None (빈 결과 []와 구분한다)"""
    try:
        async with session.get(
            _BASE_URL,
            headers={"Authorization": f"KakaoAK {_KAKAO_KEY}"},
            params={"query": query, "size": size},
        ) as resp:
            if resp.status != 200:
                _logger.warning(f"Kakao Local API HTTP {resp.status}")
                return None
            data = await resp.json()
            return data.get("documents") or []
    except Exception as e:
        _logger.warning(f"Kakao Local API error: {e}")
        return None


async def get_kakao_visibility(business_name: str, keyword: str, region: str) -> dict:
    """
    카카오맵 검색 가시성 분석

    Returns:
        search_query         : 실제 사용한 검색어
        my_rank              : 내 가게 순위 (None = 상위 15곳 안에 없음)
        is_on_kakao          : 카카오맵 등록 여부 (True/False, 조회 실패·키 없음이면 None)
        kakao_competitors    : 상위 5개 가게 [{rank, name, address, category, phone, url}]
        registration_checked : 등록 여부를 실제로 확인했는지
    """
    unknown = {"search_query": "", "my_rank": None, "is_on_kakao": None, "kakao_competitors": [], "registration_checked": False}
    if not _KAKAO_KEY:
        return unknown

    prefix       = _region_query_prefix(region)
    search_query = f"{prefix} {keyword}".strip()
    district     = _district_token(region)

    async with aiohttp.ClientSession(timeout=_TIMEOUT) as session:
        docs = await _search(session, search_query, _RANK_SIZE)
        if docs is None:
            return {**unknown, "search_query": search_query}

        kakao_competitors = [
            {
                "rank":     i + 1,
                "name":     doc.get("place_name", ""),
                "address":  doc.get("road_address_name") or doc.get("address_name", ""),
                "category": (doc.get("category_name", "") or "").split(" > ")[-1],  # 마지막 카테고리만
                "phone":    doc.get("phone", ""),
                "url":      doc.get("place_url", ""),
            }
            for i, doc in enumerate(docs[:5])
        ]

        my_rank = next((i + 1 for i, doc in enumerate(docs) if _is_my_shop(business_name, doc, district)), None)
        if my_rank is not None:
            return {
                "search_query": search_query, "my_rank": my_rank, "is_on_kakao": True,
                "kakao_competitors": kakao_competitors, "registration_checked": True,
            }

        # 상위 15곳에 없으면 가게 이름으로 등록 여부를 따로 확인한다
        by_name = await _search(session, f"{prefix} {business_name}".strip(), _NAME_SIZE)
        if by_name is None:
            return {
                "search_query": search_query, "my_rank": None, "is_on_kakao": None,
                "kakao_competitors": kakao_competitors, "registration_checked": False,
            }
        return {
            "search_query": search_query, "my_rank": None,
            "is_on_kakao": any(_is_my_shop(business_name, doc, district) for doc in by_name),
            "kakao_competitors": kakao_competitors, "registration_checked": True,
        }
