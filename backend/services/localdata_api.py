"""
행정안전부 지방행정 인허가 통합 API 클라이언트
폐업율(역대 누적) 계산 — 영업/폐업 건수 totalCount 비교 방식

⚠️ 구독자 500명 이상 시 캐싱·쿼터 전략 재검토 필요
   data.go.kr 일반 한도: 10,000회/일
   BEP 20명 기준 최악 40회/일(한도의 0.4%) — 24h 인메모리 캐시로 추가 보호
"""
import asyncio
import logging
import os
import urllib.parse
from typing import Optional

import aiohttp

from utils import cache

_logger = logging.getLogger(__name__)

# URL-encoded 키(data.go.kr에서 받은 %2F 포함 형태)를 디코딩해 aiohttp params에 전달
# → 이중 인코딩(%2F → %252F) 방지. 이미 디코딩된 키가 들어와도 idempotent.
_API_KEY_RAW = os.getenv("LOCALDATA_API_KEY", "")
_API_KEY = urllib.parse.unquote(_API_KEY_RAW) if _API_KEY_RAW else ""

if not _API_KEY:
    _logger.warning(
        "[localdata_api] LOCALDATA_API_KEY 미설정 — 폐업율 조회 전체 비활성(available: False 반환)"
    )

_BASE_URL = "https://apis.data.go.kr/1741000"
_CACHE_TTL = 86_400  # 24시간 (행정 인허가 데이터는 일 단위 변동 미미)

# LOTNO_ADDR::LIKE는 부분일치이지만 첫 토큰이 공식 시도명이 아니면 0건으로 실패한다.
# UI(StartupClient)가 "서울 강남"처럼 시도명 축약형 입력을 예시로 권장하는데,
# 행안부 인허가 데이터의 LOTNO_ADDR는 항상 공식 명칭("서울특별시")으로 시작해
# 축약형("서울")로는 매칭이 안 됨(2026-09-01 라이브 브라우저 검증에서
# "서울 강남구" 입력 시 active_count=0/closed_count=0 no_data 재현·발견).
_SIDO_SHORT_TO_OFFICIAL: dict[str, str] = {
    "서울": "서울특별시", "부산": "부산광역시", "대구": "대구광역시",
    "인천": "인천광역시", "광주": "광주광역시", "대전": "대전광역시",
    "울산": "울산광역시", "세종": "세종특별자치시", "경기": "경기도",
    "강원": "강원특별자치도", "충북": "충청북도", "충남": "충청남도",
    "전북": "전북특별자치도", "전남": "전라남도", "경북": "경상북도",
    "경남": "경상남도", "제주": "제주특별자치도",
}


def _normalize_region_for_lotno(region: str) -> str:
    """첫 토큰이 시도 축약형이면 LOTNO_ADDR 표기(공식 명칭)로 치환."""
    tokens = (region or "").strip().split()
    if not tokens:
        return region
    first = tokens[0]
    if first in _SIDO_SHORT_TO_OFFICIAL:
        tokens[0] = _SIDO_SHORT_TO_OFFICIAL[first]
        return " ".join(tokens)
    return region

# ──────────────────────────────────────────────────────────────────────────────
# 업종 → 인허가 API 엔드포인트 경로 매핑
# 출처: docs/closure_rate_data_source_investigation_v1.0.md "AEOlab 업종별 매핑" 표
# ──────────────────────────────────────────────────────────────────────────────
# 미매핑 업종(yoga, shopping, legal 등): 키 없음 → available: False, reason: uncovered_category
ENDPOINT_MAP: dict[str, str] = {
    # ACTIVE 업종 (네이버 AI 브리핑 플레이스형 대상)
    "restaurant":    "general_restaurants",
    "cafe":          "rest_cafes",       # 휴게음식점
    "bakery":        "rest_cafes",       # 휴게음식점 동일 데이터셋
    "bar":           "general_restaurants",  # BAR_FILTER(BZSTAT_SE_NM::LIKE=호프) 별도 적용
    "accommodation": "lodgings",
    # LIKELY 업종 (AI 브리핑 확대 예정)
    "beauty":        "beauty_salons",    # 미용업 (15154918)
    "nail":          "beauty_salons",
    "skincare":      "beauty_salons",
    "semi_permanent":"beauty_salons",
    "massage":       "medical_related_businesses",  # 의료유사업(안마원)
    "spa":           "medical_related_businesses",
    "pet":           "animal_hospitals", # 동물병원 (15154952)
    "fitness":       "comprehensive_sports_facilities",  # 종합체육시설업
    "pharmacy":      "pharmacies",       # 건강약국 (15154822)
    "dance":         "dance_academies",  # 무도학원업
    "ballet":        "dance_academies",
    "martial_arts":  "martial_arts_dojo",# 체육도장업
    # 기타 커버 업종
    "optics":        "optical_shops",   # 안경업 (15154899)
    "norebang":      "karaoke_rooms",   # 노래연습장업 (15155135)
    "billiards":     "billiard_halls",  # 당구장업 (15155011)
    # yoga/pilates, study_cafe, climbing, escape: 인허가 대상 자체가 아님 → 키 없음
}

# bar 카테고리: general_restaurants + BZSTAT_SE_NM::LIKE=호프 필터
# (호프/통닭 212,900건 + 감성주점 2,210건 실측 확인 — 조사 문서 §bar 섹션)
BAR_FILTER = "호프"

# 업종별 전국 누적 폐업율 (2026-09-01 실측 근거 있는 것만)
# 나머지 업종: None → 전국 평균 대비 comparison 생략
#
# ⚠️ bar는 restaurant 전국평균(70.5%)을 재사용하지 않는다(2026-09-01 외부조사로 정정) —
# 국세청 TASIS 기반 복수 보도(세정일보·한국경제 등)에 따르면 호프주점은 100대 생활업종 중
# 40~60세·60세 이상 연령대 3년 생존율 최저 업종이며, 사업자 수가 2018→2026 8년간 46.1%
# 감소(기타음식점 5.2%·분식점 5.1%보다 훨씬 급격)해 general_restaurants 전체 평균과 뚜렷이
# 다른(더 나쁜) 폐업 패턴을 보인다. restaurant 값을 재사용하면 bar 폐업율을 실제보다 좋아
# 보이게 왜곡할 위험이 있어 None으로 유지 — bar 전용 전국평균은 별도 실측 필요.
NATIONAL_AVG: dict[str, Optional[float]] = {
    "restaurant":    70.5,  # 전국 229만 건 중 폐업 161만 건 (data.go.kr 실측)
    "bar":           None,
    "cafe":          None,
    "bakery":        None,
    "accommodation": None,
    "beauty":        None,
    "nail":          None,
    "skincare":      None,
    "semi_permanent":None,
    "massage":       None,
    "spa":           None,
    "pet":           None,
    "fitness":       None,
    "pharmacy":      None,
    "dance":         None,
    "ballet":        None,
    "martial_arts":  None,
    "optics":        None,
    "norebang":      None,
    "billiards":     None,
}


async def _fetch_count(
    endpoint: str,
    region: str,
    status_cd: str,
    bzstat_filter: Optional[str],
    session: aiohttp.ClientSession,
) -> Optional[int]:
    """
    행정안전부 인허가 API에서 영업(01) 또는 폐업(03) totalCount만 조회.
    numOfRows=1로 최소 응답만 받아 카운트 획득 (개별 레코드 불필요).
    cond[LOTNO_ADDR::LIKE]=<region> — 약 0.9% 언더카운트(상대 비교엔 무방).
    에러·타임아웃 시 None 반환 (호출부 get_closure_rate가 graceful 처리).

    ⚠️ region은 시도명까지 포함한 완전 문자열 필요
       예) "서울특별시 강남구" (O) / "강남" (X — 전국 중구 오매칭 위험)
    """
    if not _API_KEY:
        return None

    url = f"{_BASE_URL}/{endpoint}/info"
    params: dict = {
        "serviceKey": _API_KEY,
        "pageNo": "1",
        "numOfRows": "1",
        "returnType": "json",
        "cond[SALS_STTS_CD::EQ]": status_cd,
        "cond[LOTNO_ADDR::LIKE]": region,
    }
    if bzstat_filter:
        params["cond[BZSTAT_SE_NM::LIKE]"] = bzstat_filter

    try:
        async with session.get(url, params=params) as resp:
            if resp.status != 200:
                _logger.warning(
                    "[localdata_api] HTTP %d — endpoint=%s status_cd=%s region=%s",
                    resp.status, endpoint, status_cd, region,
                )
                return None
            data = await resp.json(content_type=None)
            # 표준 응답: {"response": {"header": {...}, "body": {"totalCount": N, ...}}}
            body = data.get("response", {}).get("body") or {}
            total = body.get("totalCount")
            if total is None:
                _logger.warning(
                    "[localdata_api] totalCount 누락 — endpoint=%s status_cd=%s body=%s",
                    endpoint, status_cd, str(body)[:200],
                )
            return total
    except asyncio.TimeoutError:
        _logger.warning(
            "[localdata_api] 타임아웃(70s) — endpoint=%s status_cd=%s region=%s",
            endpoint, status_cd, region,
        )
        return None
    except Exception as e:
        _logger.warning(
            "[localdata_api] 조회 오류 — endpoint=%s status_cd=%s region=%s: %s",
            endpoint, status_cd, region, e,
        )
        return None


async def get_closure_rate(category: str, region: str) -> dict:
    """
    지역·업종 폐업율(역대 누적) 계산. 24h 인메모리 캐시 적용.

    반환 dict:
    {
        "available": bool,
        "reason": str | None,         # uncovered_category / no_data / api_timeout / api_key_missing
        "closure_rate": float | None, # 누적 폐업율 %
        "active_count": int | None,
        "closed_count": int | None,
        "national_avg": float | None,
        "comparison": "lower"|"similar"|"higher"|None,
        "category": str,
        "region": str,
    }

    절대 허위 수치 반환 금지 — available: False 반환으로 graceful fallback.
    """
    if not _API_KEY:
        return {
            "available": False, "reason": "api_key_missing",
            "closure_rate": None, "active_count": None, "closed_count": None,
            "national_avg": None, "comparison": None,
            "category": category, "region": region,
        }

    endpoint = ENDPOINT_MAP.get(category)
    if not endpoint:
        return {
            "available": False, "reason": "uncovered_category",
            "closure_rate": None, "active_count": None, "closed_count": None,
            "national_avg": None, "comparison": None,
            "category": category, "region": region,
        }

    lotno_region = _normalize_region_for_lotno(region)

    cache_key = f"closure_rate:{category}:{lotno_region.strip().lower()}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    bzstat_filter: Optional[str] = BAR_FILTER if category == "bar" else None

    active_count: Optional[int] = None
    closed_count: Optional[int] = None
    try:
        # beauty_salons이 실측 30초+ 소요 — 70초 타임아웃으로 여유 확보
        timeout = aiohttp.ClientTimeout(total=70)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            active_count, closed_count = await asyncio.gather(
                _fetch_count(endpoint, lotno_region, "01", bzstat_filter, session),
                _fetch_count(endpoint, lotno_region, "03", bzstat_filter, session),
            )
    except Exception as e:
        _logger.warning("[localdata_api] 세션 오류 (graceful): %s", e)

    # 어느 한쪽이라도 None이면 타임아웃/에러 처리 (캐시 저장 안 함 — 다음 호출에서 재시도)
    if active_count is None or closed_count is None:
        return {
            "available": False, "reason": "api_timeout",
            "closure_rate": None, "active_count": None, "closed_count": None,
            "national_avg": None, "comparison": None,
            "category": category, "region": region,
        }

    total = active_count + closed_count
    if total == 0:
        result = {
            "available": False, "reason": "no_data",
            "closure_rate": None, "active_count": 0, "closed_count": 0,
            "national_avg": None, "comparison": None,
            "category": category, "region": region,
        }
        cache.set(cache_key, result, _CACHE_TTL)
        return result

    closure_rate_val = round(closed_count / total * 100, 1)
    national_avg = NATIONAL_AVG.get(category)

    comparison: Optional[str] = None
    if national_avg is not None:
        diff = closure_rate_val - national_avg
        if diff < -5.0:
            comparison = "lower"
        elif diff > 5.0:
            comparison = "higher"
        else:
            comparison = "similar"

    result = {
        "available": True,
        "reason": None,
        "closure_rate": closure_rate_val,
        "active_count": active_count,
        "closed_count": closed_count,
        "national_avg": national_avg,
        "comparison": comparison,
        "category": category,
        "region": region,
    }
    cache.set(cache_key, result, _CACHE_TTL)
    return result
