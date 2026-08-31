"""
backend/services/startup_competitor_readiness.py

창업 시장 분석 — 실제 경쟁사(소상공인시장진흥공단 상가정보 API가 반환한 실존 사업장)의
네이버 스마트플레이스 "공개 페이지" 완성도 체크 (2026-08-31 신설, 2026-08-31 재설계).

⚠️ 범위 제한 (사용자 승인, 2026-08-31): 이 기능은 로그인 우회·AI 브리핑 노출 확인을
절대 하지 않는다 — 공개 페이지(Playwright, 비로그인) 조회만 수행한다.
`docs/naver_scraping_legal_risk_assessment_v1.0.md`의 "정당 목적(제48조 방어 논리)"은
"고객 본인 사업장 확인"을 전제로 한 것이라, AEOlab과 아무 관계 없는 제3자(비고객)
사업장을 무단 조회하는 이 기능에는 그대로 적용되지 않는다 — 그래서 로그인이 필요한
기능(AI 브리핑 등)은 의도적으로 배제하고, 이미 "경쟁사 관리" 기능에서 실사용 중인
공개 페이지 크롤러(competitor_place_crawler.py)만 재사용한다.

이 기능은 /api/startup/report(인증+플랜게이트+월 5~10회 한도)에서만 호출한다 —
/api/startup/market(비로그인 공개 미리보기)에서는 절대 호출 금지(무제한 크롤링 유발 위험).

── "많은 사용자" 대비 설계 (2026-08-31, 사용자 논의 반영) ──────────────────────
1단계: 기존 competitors 테이블(실제 AEOlab 고객이 이미 등록·동기화해둔 경쟁사)에서
       이름+주소 정확 매칭 조회 — 네이버 요청 0건, 무료.
       ⚠️ 이것만으로는 불충분(사용자 지적, 2026-08-31): 창업 예정자가 조회하는 지역·
       업종은 대부분 기존 고객과 무관해 매칭률이 우연에 가까움 — "AEOlab 내부 데이터로만
       외부 시장을 답하려는" 순환 논리였음. 그래서 2단계가 필수.
2단계: 캐시 미스 시 실제 네이버 조회. 단, 캐시 키는 지역 "텍스트"가 아니라 업체
       단위(dedup_key: 이름+주소)로 — 실측 확인(2026-08-31): "강남"/"강남구"/
       "서울 강남구"/"서울강남구" 4개 표기가 전부 동일한 실제 업체 5곳을 반환함
       (SBIZ 결과는 문자열 표기와 무관하게 실제 위치 기준으로 결정론적). 지역
       텍스트로 캐시하면 같은 데이터가 표기 차이로 쪼개져 불필요한 네이버 요청이
       늘어남 — 업체 단위 캐시라야 "질문한 사용자 수"가 아니라 "실제로 존재하는
       고유 업체 수"에 비례해서 네이버 요청이 발생함(사용자가 몰려도 완만하게 증가).
       매칭 실패("이 업체는 네이버플레이스가 없음")도 캐시 — 같은 실패를 반복 시도해
       할당량을 낭비하지 않기 위함.
3단계: 이 기능 전용 격리 일일 상한(_DAILY_CAP, 핵심 AI브리핑 스캔의 전역 상한
       250건/일과 완전 분리) — 아무리 캐시 미스가 몰려도 핵심 기능 예산을 잠식하지
       않음. 상한 도달 시 조용히 스킵(예외 아님, 그레이스풀).

⚠️ 미구현 사항(2026-08-31 기준): 2단계의 실제 네이버 place_id 탐색은 현재 기존
`local_search.find_naver_place_id()`(네이버 지역검색 오픈API의 link 필드 파싱)를
그대로 쓰는데, 실측 확인(2026-08-31) 결과 이 방식은 스타벅스 등 대형 프랜차이즈에도
거의 항상 실패한다 — 오픈API의 link 필드가 "네이버플레이스 링크"가 아니라 업체가
등록한 "홈페이지 URL"이기 때문(구조적 한계, 버그 아님). 더 신뢰도 높은 방법(네이버
지도 검색 페이지를 Playwright로 직접 렌더링해 결과 URL에서 place_id 추출)은 별도
구현이 필요한 새 자동화라 이번 세션에서 보류 — 캐시·격리상한·1단계 재사용 인프라만
먼저 갖춰두고, 2단계 탐색 방식 자체는 다음 세션에서 별도 검증 후 교체할 것.

⚠️ 캐시의 실질 한계(2026-08-31 발견): `utils/cache.py`는 프로세스 인메모리(Redis
미도입)라 backend 재시작(배포)마다 전부 초기화된다 — "30일 캐시"는 설계상 TTL일 뿐,
실제로는 배포 주기만큼만 유지됨. 개발 초기(잦은 배포)엔 캐시 효과가 이론값보다
약하고, 서비스가 안정화(배포 빈도 감소)될수록 효과가 커진다. 영속 캐시가 필요해지면
전용 DB 테이블 또는 Redis 도입이 별도 필요(기존 다른 in-memory 캐시들도 동일 한계
공유 — 이 파일만의 문제 아님).
"""
import logging
import os
from datetime import date as _date

_logger = logging.getLogger("aeolab.startup_competitor_readiness")

_MAX_COMPETITORS = 3  # 요청-응답 지연 시간 고려(Playwright 전역 세마포어=1이라 사실상 순차 실행)
_CACHE_TTL_SEC = 30 * 24 * 3600  # 30일 — 스마트플레이스 완성도는 자주 안 바뀜

# 이 기능 전용 격리 일일 상한 — 핵심 AI브리핑 스캔의 전역 상한(ai_scanner.check_naver_playwright_quota,
# 기본 250건/일)과 완전히 분리된 별도 카운터. "많은 사용자가 몰려도 핵심 기능 예산을
# 잠식하지 않는다"는 설계 원칙 구현.
_DAILY_CAP = int(os.getenv("STARTUP_READINESS_DAILY_CAP", "25"))
_quota_date: str = ""
_quota_count: int = 0


def _check_isolated_quota() -> bool:
    global _quota_date, _quota_count
    today = _date.today().isoformat()
    if _quota_date != today:
        _quota_date = today
        _quota_count = 0
    if _quota_count >= _DAILY_CAP:
        return False
    _quota_count += 1
    return True


async def _lookup_existing_competitor(name: str, address: str) -> dict | None:
    """1단계: 기존 competitors 테이블에서 정확 매칭 조회(네이버 요청 0건).
    이름 앞 5글자로 1차 후보를 좁힌 뒤 dedup_key로 정확 매칭 — 짧은 이름의
    오매칭(다른 업체 데이터를 잘못 보여주는 것)을 방지."""
    if not name:
        return None
    from db.supabase_client import get_client, execute
    from services.local_search import dedup_key

    supabase = get_client()
    target_key = dedup_key(name, address)
    try:
        res = await execute(
            supabase.table("competitors")
            .select("name, address, has_intro, has_recent_post, naver_photo_count, naver_review_count")
            .eq("is_active", True)
            .not_.is_("naver_place_id", "null")
            .ilike("name", f"{name[:5]}%")
        )
    except Exception as e:
        _logger.warning("competitors 테이블 조회 실패: %s", e)
        return None

    for row in (res.data or []):
        if dedup_key(row.get("name", ""), row.get("address", "")) == target_key:
            return {
                "name": name,
                "has_intro": bool(row.get("has_intro")),
                "has_recent_post": bool(row.get("has_recent_post")),
                "photo_count": row.get("naver_photo_count", 0) or 0,
                "review_count": row.get("naver_review_count", 0) or 0,
            }
    return None


async def _check_one(s: dict, region: str) -> dict | None:
    """업체 1곳 준비도 조회 — 캐시 → 1단계(기존 테이블) → 2단계(네이버 실조회, 격리
    상한 적용) 순. 실패(포함 "네이버플레이스 없음")도 캐시해 재시도 낭비를 막음."""
    from services.local_search import dedup_key
    from utils import cache as _cache

    name = s.get("name", "")
    address = s.get("address", "")
    if not name:
        return None

    # 캐시 값은 {"found": bool, "data": dict|None} 래퍼 사용 — 실패(None)를 그대로 저장하면
    # _cache.get()이 "캐시 없음"과 "캐시된 실패" 둘 다 None을 반환해 구분이 안 되는 버그가
    # 있었음(2026-08-31 실측 발견: 2번째 동일 호출도 quota를 또 소모함을 확인해 발견).
    cache_key = _cache._make_key("startup_competitor_readiness", dedup_key(name, address))
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached["data"]

    result = await _lookup_existing_competitor(name, address)
    quota_exhausted = False

    if result is None:
        if _check_isolated_quota():
            from services.local_search import find_naver_place_id
            from services.competitor_place_crawler import fetch_competitor_place_data

            place_id = await find_naver_place_id(name, address, region)
            if place_id:
                data = await fetch_competitor_place_data(place_id)
                if not data.get("error"):
                    result = {
                        "name": name,
                        "has_intro": bool(data.get("has_intro")),
                        "has_recent_post": bool(data.get("has_recent_post")),
                        "photo_count": data.get("photo_count", 0),
                        "review_count": data.get("review_count", 0),
                    }
        else:
            quota_exhausted = True

    # 격리 상한 도달로 이번 회차에 아예 시도 못 한 경우는 캐시하지 않음 — 상한은
    # 내일 리셋되므로 "찾을 수 없음"으로 30일 박제하면 리셋 후에도 영영 재시도가 안 됨.
    # 실제로 시도했는데 못 찾은 경우(2단계 실패)만 "찾을 수 없음"으로 캐시.
    if not quota_exhausted:
        _cache.set(cache_key, {"found": result is not None, "data": result}, _CACHE_TTL_SEC)
    return result


async def check_competitors_readiness(samples: list[dict], region: str) -> dict:
    """SBIZ 실제 경쟁사 목록(name, address) → 스마트플레이스 공개 완성도 요약.

    개별 건 실패(장소 미매칭·크롤링 실패·격리 상한 도달)는 건너뛰고, 최소 1건 이상
    성공하면 available=True. 전부 실패해도 예외를 던지지 않음(호출부의 graceful
    패턴과 일관).
    """
    if not samples:
        return {"available": False, "checked": 0, "items": []}

    targets = samples[:_MAX_COMPETITORS]
    results: list[dict] = []
    for s in targets:
        try:
            r = await _check_one(s, region)
        except Exception as e:
            _logger.warning("competitor readiness 체크 실패(%s): %s", s.get("name"), e)
            r = None
        if r:
            results.append(r)

    if not results:
        return {"available": False, "checked": len(targets), "items": []}

    return {
        "available": True,
        "checked": len(results),
        "no_intro_count": sum(1 for r in results if not r["has_intro"]),
        "no_recent_post_count": sum(1 for r in results if not r["has_recent_post"]),
        "items": results,
    }
