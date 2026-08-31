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
    "restaurant": [("indsMclsCd", c) for c in ["I201", "I202", "I203", "I204", "I205", "I206", "I207"]],
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

_DEFAULT_RADIUS_M = 3000  # 행정구역 깊이 판별 실패 시(키워드검색 폴백 등)의 중간값 기본치

# 행정구역 단위별 반경(m) — 2026-08-31 실측(강남구 중심 1.5~5km 스캔, 응답시간은 반경과
# 무관하게 0.3~0.6초로 일정함을 확인해 반경 확대에 성능 부담 없음도 검증). 정확한 면적
# 수치는 별도 검증하지 않았음(추정 금지 원칙) — 다만 "동 < 구/시 < 군" 순으로 실제 면적이
# 커지는 것은 행정구역 체계상 일반적 사실이며, 고정 2km 하나로는 동은 과대, 구는 과소,
# 특히 면적 편차가 큰 군은 극단적 과소 집계될 위험이 있어 단위별로 반경을 분리함.
_RADIUS_DONG_M = 1200      # 동/읍/면 매칭(region_3depth_name 존재)
_RADIUS_GU_M = 3000        # 구/시 매칭(region_2depth_name 존재, "군" 아님)
_RADIUS_GUN_M = 6000       # 군 매칭(region_2depth_name이 "군"으로 끝남) — 군은 면적 편차가 매우 커서
                           # 이 반경으로도 여전히 상당수 군에서 과소 집계될 수 있음(아래 신뢰도 라벨 참조)
_RADIUS_NO_GU_M = 4000     # 세종 등 구 없는 광역단체(region_2depth_name 자체가 없음) — 군과 동일한 이유로 저신뢰

# 반경 추정 신뢰도 — 2026-08-31 신설. 동/구는 행정구역 면적과 반경이 비교적 근접해 신뢰도
# "양호", 군·구없는광역단체는 실제 면적이 반경보다 훨씬 큰 경우가 흔해 "낮음"(과소 집계 위험 명시),
# 키워드검색 폴백(행정구역 정보 자체가 없음)은 "중간"으로 구분.
_CONFIDENCE_GOOD = "good"
_CONFIDENCE_MEDIUM = "medium"
_CONFIDENCE_LOW = "low"


def _radius_for_address(region_2: str, region_3: str) -> tuple[int, str]:
    if region_3:
        return _RADIUS_DONG_M, _CONFIDENCE_GOOD
    if region_2.endswith("군"):
        return _RADIUS_GUN_M, _CONFIDENCE_LOW
    if region_2:
        return _RADIUS_GU_M, _CONFIDENCE_GOOD
    return _RADIUS_NO_GU_M, _CONFIDENCE_LOW


async def _geocode_region(region: str) -> tuple[float, float, int, str] | None:
    """지역 자유텍스트 → (경도, 위도, 추천 반경m, 신뢰도). 주소검색 우선, 실패 시
    키워드검색으로 폴백(2026-08-31 실측: "서울 강남구"는 주소검색, "강남"처럼 행정구역명이
    아닌 약칭은 주소검색이 못 찾을 수 있어 키워드검색이 보완).

    반경은 주소검색 응답의 행정구역 매칭 깊이로 결정(추가 API 호출 없이 같은 응답 재사용,
    2026-08-31 신설) — 동/읍/면까지 매칭되면 좁게, 구/시 단위면 넓게, 군 단위면 더 넓게.
    키워드검색 폴백(행정구역 정보 없음)은 중간값(_DEFAULT_RADIUS_M) + 중간 신뢰도 사용.
    """
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
                        radius, confidence = _radius_for_address(
                            addr.get("region_2depth_name", ""), addr.get("region_3depth_name", "")
                        )
                        return float(addr["x"]), float(addr["y"]), radius, confidence

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
                        return float(docs[0]["x"]), float(docs[0]["y"]), _DEFAULT_RADIUS_M, _CONFIDENCE_MEDIUM
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


async def get_sbiz_market_count(category: str, region: str, radius: int | None = None) -> dict | None:
    """국세청·카드사 기반 실제 등록 사업자 수 조회 — 매핑 안 된 카테고리·API 실패 시 None
    (호출부에서 카카오 fallback으로 전환). radius를 명시하지 않으면(기본) `_geocode_region()`이
    입력 지역의 행정구역 매칭 깊이(동/구/군)로 자동 산정한 반경을 사용 — 2026-08-31 실측으로
    고정 2km 하나로는 동은 과대·구는 과소·군은 극단적 과소 집계됐던 문제를 해소. 그래도
    원형 검색이라 실제 행정구역 경계(불규칙 폴리곤)와는 정확히 일치하지 않는 근사치임(한계,
    한글 캐비엇에 명시, 실사용 반경은 응답의 radius_m로 노출).
    """
    codes = SBIZ_CATEGORY_CODES.get(category)
    if not codes:
        return None

    coords = await _geocode_region(region)
    if coords is None:
        return None
    cx, cy, auto_radius, auto_confidence = coords
    used_radius = radius if radius is not None else auto_radius
    # 호출부가 radius를 직접 넘기면(테스트 등) 행정구역 매칭 신뢰도 정보가 없으므로 중간값 처리
    confidence = auto_confidence if radius is None else _CONFIDENCE_MEDIUM

    results = await asyncio.gather(
        *[_query_code(cx, cy, code_type, code, used_radius) for code_type, code in codes]
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

    # 밀도(㎢당 개수) — 절대 개수만으로는 지역·업종 간 비교가 안 되는 문제 보완(2026-08-31).
    # 원의 면적(πr²)로 나눔 — 반경 자체가 근사치라 밀도도 근사치이나, 상대 비교엔 유용.
    import math
    radius_km = used_radius / 1000
    area_km2 = math.pi * radius_km * radius_km
    density_per_km2 = round(total_count / area_km2, 1) if area_km2 > 0 else 0.0

    return {
        "available": True,
        "total_count": total_count,
        "samples": list(seen.values())[:5],
        "source": "sbiz",
        "stdr_ym": stdr_ym,
        "radius_m": used_radius,
        "density_per_km2": density_per_km2,
        "confidence": confidence,
    }
