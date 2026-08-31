"""
backend/services/sbiz_api.py

소상공인시장진흥공단 상가(상권)정보 API(data.go.kr, B553077) 연동.
국세청·카드사 거래 데이터 기반 실제 등록 사업자 수 — 카카오 키워드 검색(local_search.py)
보다 더 권위 있는 시장 밀도 지표. 단, 데이터 기준월이 약 2개월 지연되고(예: 202606),
59개 업종 전부를 상권업종코드로 매핑하지는 못했음(2026-08-31 실측 검증한 것만 매핑).

지역은 코드(행정동코드) 대신 좌표+반경 방식(storeListInRadius) 사용 — 카카오 주소검색으로
자유텍스트 지역명을 좌표로 변환한 뒤 반경 검색. 행정동코드 매핑 테이블이 불필요해짐.

카테고리 코드는 2026-08-31 실제 API 호출로 확인한 값만 사용(추측 금지) — 매핑 안 된 카테고리는
get_market_density()가 카카오 fallback으로 자동 전환.
"""
import asyncio
import logging
import os
import aiohttp

_logger = logging.getLogger("aeolab.sbiz_api")

_SBIZ_BASE_URL = "https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius"
_KAKAO_ADDRESS_URL = "https://dapi.kakao.com/v2/local/search/address.json"
_KAKAO_KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"

# (파라미터명, 코드값) 튜플 리스트 — 한 카테고리에 여러 상권업종코드가 걸치는 경우
# (예: restaurant) 병렬 호출 후 totalCount를 합산한다. 전부 2026-08-31 실측 확인.
SBIZ_CATEGORY_CODES: dict[str, list[tuple[str, str]]] = {
    "restaurant": [("indsMclsCd", c) for c in ["I201", "I202", "I203", "I204", "I205", "I207"]],
    "cafe": [("indsMclsCd", "I212")],
    "bar": [("indsMclsCd", "I211")],
    "bakery": [("indsSclsCd", "I21001")],
    "accommodation": [("indsLclsCd", "I1")],
    "beauty": [("indsSclsCd", "S20701")],
    "nail": [("indsSclsCd", "S20703")],
    "skincare": [("indsSclsCd", "S20702")],
    "massage": [("indsSclsCd", "S20802")],
    "fitness": [("indsSclsCd", "R10307")],
    "pharmacy": [("indsSclsCd", "G21501")],
    "pet": [("indsSclsCd", "G22001")],
    "dental": [("indsSclsCd", "Q10210")],
    "oriental_medicine": [("indsSclsCd", "Q10211")],
    "medical": [("indsLclsCd", "Q1")],
    "optics": [("indsMclsCd", "G216")],
    "golf": [("indsSclsCd", "R10311")],
    "billiards": [("indsSclsCd", "R10310")],
    "swim": [("indsSclsCd", "R10308")],
    "realestate": [("indsLclsCd", "L1")],
    "laundry": [("indsMclsCd", "S209")],
    "flower": [("indsMclsCd", "G219")],
}

_DEFAULT_RADIUS_M = 2000


async def _geocode_region(region: str) -> tuple[float, float] | None:
    """지역 자유텍스트 → (경도, 위도). 주소검색 우선, 실패 시 키워드검색으로 폴백
    (2026-08-31 실측: "서울 강남구"는 주소검색, "강남"처럼 행정구역명이 아닌 약칭은
    주소검색이 못 찾을 수 있어 키워드검색이 보완)."""
    rest_key = os.getenv("KAKAO_REST_API_KEY")
    if not rest_key or not region.strip():
        return None

    headers = {"Authorization": f"KakaoAK {rest_key}"}
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                _KAKAO_ADDRESS_URL,
                params={"query": region.strip()},
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=5),
            ) as res:
                if res.status == 200:
                    data = await res.json()
                    docs = data.get("documents", [])
                    if docs:
                        addr = docs[0]["address"]
                        return float(addr["x"]), float(addr["y"])

            async with session.get(
                _KAKAO_KEYWORD_URL,
                params={"query": region.strip(), "size": 1},
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=5),
            ) as res:
                if res.status == 200:
                    data = await res.json()
                    docs = data.get("documents", [])
                    if docs:
                        return float(docs[0]["x"]), float(docs[0]["y"])
    except (aiohttp.ClientError, asyncio.TimeoutError, ValueError, KeyError) as e:
        _logger.warning("sbiz_geocode_error: %s", e)
    return None


_MAX_ATTEMPTS = 2  # 일반적인 일시적 오류(타임아웃 등) 대비 — 결정론적 400 원인은 해결됨(아래 참조)


async def _query_code(cx: float, cy: float, code_type: str, code: str, radius: int) -> dict | None:
    """storeListInRadius 단일 코드 조회 — (totalCount, items 최대 5개).

    2026-08-31 근본 원인 규명·수정 완료: 이 함수가 main:app(uvicorn) 안의 실제 요청
    처리 중 호출되면 100% 결정론적으로 INVALID_REQUEST_PARAMETER_ERROR(400)가
    발생했던 원인은 Sentry SDK였음 — sentry_sdk.init()이 aiohttp.ClientSession을
    전역 패치해, 활성 요청(span)이 있을 때 생성되는 모든 aiohttp 요청에
    sentry-trace/baggage 추적 헤더를 자동 주입함(기본 trace_propagation_targets=None
    = 전체 대상 전파). 공공데이터포털(data.go.kr) 게이트웨이가 이 낯선 헤더를 거부해
    항상 400 에러가 났던 것 — bare 스크립트(활성 span 없음)에서는 재현이 안 됐던
    이유도 이것. main.py의 sentry_sdk.init()에 trace_propagation_targets=[] 추가로
    해결(외부 서드파티 API로 트레이스 헤더 전파 차단). 카카오·네이버 등 aiohttp를
    쓰는 다른 외부 API 호출도 전역으로 동일 위험이 있었으나 이 한 번의 수정으로
    전부 해소됨.
    """
    service_key = os.getenv("SBIZ_API_KEY")
    if not service_key:
        return None

    params = {
        "serviceKey": service_key,
        "cx": cx,
        "cy": cy,
        "radius": radius,
        "type": "json",
        "numOfRows": 5,
        code_type: code,
    }
    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    _SBIZ_BASE_URL, params=params, timeout=aiohttp.ClientTimeout(total=8),
                ) as res:
                    if res.status != 200:
                        if attempt < _MAX_ATTEMPTS:
                            await asyncio.sleep(0.5 * attempt)
                            continue
                        _body_preview = await res.text()
                        _logger.warning(
                            "sbiz_query_fail(재시도 %d회 소진) status=%s code=%s body=%s",
                            _MAX_ATTEMPTS, res.status, code, _body_preview[:300],
                        )
                        return None
                    data = await res.json()
                    body = data.get("body")
                    if body is None:
                        # OpenAPI_ServiceResponse 형태(인증 실패 등) — body 자체가 없음, 재시도 무의미
                        _logger.warning("sbiz_query_no_body code=%s resp=%s", code, str(data)[:200])
                        return None
                    return {
                        "total_count": body.get("totalCount", 0),
                        "items": body.get("items", []),
                        "stdr_ym": data.get("header", {}).get("stdrYm"),
                    }
        except (aiohttp.ClientError, asyncio.TimeoutError) as e:
            if attempt < _MAX_ATTEMPTS:
                await asyncio.sleep(0.5 * attempt)
                continue
            _logger.warning("sbiz_query_error(재시도 %d회 소진) code=%s: %s", _MAX_ATTEMPTS, code, e)
            return None
    return None


async def get_sbiz_market_count(category: str, region: str, radius: int = _DEFAULT_RADIUS_M) -> dict | None:
    """국세청·카드사 기반 실제 등록 사업자 수 조회 — 매핑 안 된 카테고리·API 실패 시 None
    (호출부에서 카카오 fallback으로 전환). 반경은 "동네 상권" 기준 기본 2km — 지역 입력이
    "동" 단위든 "구" 단위든 고정 반경이라 정밀하지 않을 수 있음(한계, 한글 캐비엇에 명시).
    """
    codes = SBIZ_CATEGORY_CODES.get(category)
    if not codes:
        return None

    coords = await _geocode_region(region)
    if coords is None:
        return None
    cx, cy = coords

    results = await asyncio.gather(
        *[_query_code(cx, cy, code_type, code, radius) for code_type, code in codes]
    )
    valid = [r for r in results if r is not None]
    if not valid:
        return None

    total_count = sum(r["total_count"] for r in valid)
    stdr_ym = next((r["stdr_ym"] for r in valid if r.get("stdr_ym")), None)

    seen: dict[str, dict] = {}
    for r in valid:
        for item in r["items"]:
            biz_id = item.get("bizesId")
            if biz_id and biz_id not in seen:
                seen[biz_id] = {
                    "name": item.get("bizesNm", ""),
                    "address": item.get("rdnmAdr") or item.get("lnoAdr", ""),
                    "naver_place_url": "",
                }

    return {
        "available": True,
        "total_count": total_count,
        "samples": list(seen.values())[:5],
        "source": "sbiz",
        "stdr_ym": stdr_ym,
    }
