"""
backend/services/local_search.py

네이버 지역검색 + 카카오 로컬 API 공용 래퍼.
원래 routers/business_search.py 안에 있던 로직을 서비스 레이어로 분리(2026-08-30) —
startup_report.py 등 다른 서비스에서도 재사용하기 위함(라우터 파일을 다른 라우터가
import하는 건 이 코드베이스에 선례가 없어 서비스 레이어로 옮김).

실제 시장 밀도(get_market_density) 용도 배경:
- 카카오 로컬 API meta.total_count는 실제로 의미 있게 변하는 진짜 검색결과 총 개수
  (2026-08-30 실측: "서울 강남구 미용실"=3945, "세종 반려동물미용"=37, "고성군 옹기공방"=0)
- 네이버 지역검색 API의 total은 display와 동일하게 5로 클램프되어 밀도 지표로 쓸 수 없음
  (2026-08-30 실측: display=15로 요청해도 실제로는 5개만 반환되고 total도 5로 동일)
- 따라서 밀도 숫자는 카카오만 신뢰, 실제 업체 이름 예시는 네이버+카카오 병합 유지
  (AEOlab이 네이버 스마트플레이스 중심 서비스라 naver_place_url 딥링크 가치가 있음)
"""
import asyncio
import os
import re
import logging
import aiohttp

_logger = logging.getLogger("aeolab.local_search")

_KAKAO_LOCAL_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"
_NAVER_LOCAL_URL = "https://openapi.naver.com/v1/search/local.json"


def strip_tags(text: str) -> str:
    """HTML 태그 제거 (<b>, </b> 등)"""
    return re.sub(r"<[^>]+>", "", text or "")


def dedup_key(name: str, address: str) -> str:
    """중복 제거용 키: 이름 앞 5글자 + 주소 앞 10글자"""
    return f"{name[:5]}|{address[:10]}"


async def search_kakao(query: str, region: str) -> tuple[list[dict], int | None]:
    """카카오 로컬 REST API 기반 지역 사업장 검색.

    반환: (상위 15개 결과, meta.total_count — 실제 매칭 총 개수. API 실패/키 미설정 시
    ([], None)).
    """
    rest_key = os.getenv("KAKAO_REST_API_KEY")
    if not rest_key:
        return [], None

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
                    return [], None
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
        total_count = (data.get("meta") or {}).get("total_count")
        return results, total_count

    except (aiohttp.ClientError, asyncio.TimeoutError) as e:
        _logger.warning("kakao_search_error: %s", e)
        return [], None


async def search_naver(query: str, region: str) -> list[dict]:
    """네이버 지역 검색 API.

    display 실제 상한은 5 — 그 이상을 보내도 API가 조용히 5로 클램프한다(2026-08-30
    실측 확인, 이전엔 15를 보내던 무효값이었음). total 필드도 display와 동일하게
    클램프되어 실제 전체 검색결과 개수를 의미하지 않으므로 밀도 지표로 사용 금지.
    """
    client_id = os.getenv("NAVER_CLIENT_ID")
    client_secret = os.getenv("NAVER_CLIENT_SECRET")
    if not client_id or not client_secret:
        return []

    full_query = f"{region.split()[0]} {query}".strip() if region else query

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                _NAVER_LOCAL_URL,
                params={"query": full_query, "display": 5, "sort": "random"},
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
                    "name": strip_tags(item.get("title", "")),
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


def merge_results(kakao_results: list[dict], naver_results: list[dict]) -> list[dict]:
    """
    두 소스 결과를 중복 제거하여 병합.
    - 중복 기준: 이름 앞 5글자 + 주소 앞 10글자 일치
    - 중복 시 카카오 데이터 우선 (데이터 품질이 더 좋음)
    - source 필드는 "both"로 업데이트
    """
    seen: dict[str, dict] = {}

    for item in kakao_results:
        key = dedup_key(item["name"], item["address"])
        seen[key] = item

    for item in naver_results:
        key = dedup_key(item["name"], item["address"])
        if key in seen:
            # 카카오 데이터에 네이버 URL/ID 보강 후 source="both"
            seen[key]["naver_place_url"] = item["naver_place_url"]
            seen[key]["naver_place_id"] = item["naver_place_id"]
            seen[key]["source"] = "both"
        else:
            seen[key] = item

    return list(seen.values())


async def get_market_density(category: str, region: str) -> dict:
    """실제 시장 밀도 조회 — AEOlab 가입 사업장 수와 무관하게 항상 실측값을 반환.

    창업 시장 분석(startup_report.py, startup.py)에서 "AEOlab 등록 사업장 0건 =
    데이터 수집 중"만 보여주던 한계를 보완하기 위해 신설(2026-08-30).

    2단계 우선순위(2026-08-31):
    1) 소상공인시장진흥공단 상가정보 API(sbiz_api.py) — 국세청·카드사 기반 실제 등록
       사업자 수. category가 SBIZ_CATEGORY_CODES에 매핑된 경우만 사용(2026-08-31 실측
       검증한 카테고리만 매핑 — 나머지는 추측하지 않고 카카오로 폴백).
    2) 카카오 키워드 검색 total_count — SBIZ 매핑이 없거나 API 실패 시 폴백. 네이버
       total은 display와 동일하게 클램프되어 무의미하므로 밀도 지표로 쓰지 않음(카카오만
       신뢰). 실제 업체 이름 예시는 네이버+카카오 병합 결과 사용.

    region은 반드시 전체 문자열을 그대로 사용 — search_kakao/search_naver의
    `region.split()[0]`(첫 단어만) 방식을 그대로 재사용하면 안 됨. 실측 확인(2026-08-31):
    "서울 강남"을 첫 단어만 써서 "서울 카페"로 검색하면 서울 전체(28,384건, 강남과 무관한
    주소들)가 나옴. 반대로 마지막 단어만 쓰는 것도 위험 — "일산 서구"에서 "서구"만 쓰면
    고양시 일산서구가 아닌 대전 서구로 잘못 resolve됨(구 이름이 여러 도시에 중복 존재).
    전체 문자열("서울 강남구 카페" 등)을 그대로 넘기는 것만 모든 테스트 케이스에서
    정확한 지역으로 resolve됨.
    """
    try:
        from services.sbiz_api import get_sbiz_market_count
        sbiz_result = await get_sbiz_market_count(category, region)
        if sbiz_result is not None:
            return sbiz_result
    except Exception as e:
        _logger.warning("sbiz_market_count 실패 (카카오로 폴백): %s", e)

    from services.schema_generator import CATEGORY_KO
    category_ko = CATEGORY_KO.get(category, category)
    full_query = f"{region.strip()} {category_ko}".strip() if region.strip() else category_ko

    (kakao_results, total_count), naver_results = await asyncio.gather(
        search_kakao(full_query, ""),
        search_naver(full_query, ""),
    )
    samples = merge_results(kakao_results, naver_results)[:5]

    return {
        "available": total_count is not None,
        "total_count": total_count or 0,
        "source": "kakao",
        "samples": [
            {
                "name": s["name"],
                "address": s["address"],
                "naver_place_url": s.get("naver_place_url", ""),
            }
            for s in samples
        ],
    }


async def find_naver_place_id(name: str, address: str, region: str = "") -> str | None:
    """이름+주소로 네이버 지역검색 API를 호출해 place_id 조회 — 로그인·크롤링 없이
    공개 오픈API(openapi.naver.com)만 사용(2026-08-31, routers/competitor.py의
    `_find_naver_place_id`와 동일 로직을 서비스 레이어로 옮겨 재사용 — startup 관련
    서비스가 라우터를 import하지 않도록 하기 위함, get_market_density와 동일 이유)."""
    client_id = os.getenv("NAVER_CLIENT_ID")
    client_secret = os.getenv("NAVER_CLIENT_SECRET")
    if not client_id or not client_secret:
        return None

    headers = {"X-Naver-Client-Id": client_id, "X-Naver-Client-Secret": client_secret}
    region_prefix = region.split()[0] if region else (address.split()[0] if address else "")
    query = f"{region_prefix} {name}".strip()

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                _NAVER_LOCAL_URL, params={"query": query, "display": 5},
                headers=headers, timeout=aiohttp.ClientTimeout(total=8),
            ) as res:
                if res.status != 200:
                    return None
                data = await res.json()
                for item in data.get("items", []):
                    item_name = strip_tags(item.get("title", ""))
                    link = item.get("link", "")
                    m = re.search(r"/place/(\d+)", link)
                    if m and name in item_name:
                        return m.group(1)
    except (aiohttp.ClientError, asyncio.TimeoutError) as e:
        _logger.warning("find_naver_place_id 실패: %s — %s", name, e)
    return None
