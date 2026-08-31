"""
backend/services/startup_competitor_readiness.py

창업 시장 분석 — 실제 경쟁사(소상공인시장진흥공단 상가정보 API가 반환한 실존 사업장)의
네이버 스마트플레이스 "공개 페이지" 완성도 체크 (2026-08-31 신설).

⚠️ 범위 제한 (사용자 승인, 2026-08-31): 이 기능은 로그인 우회·AI 브리핑 노출 확인을
절대 하지 않는다 — 공개 페이지(Playwright, 비로그인) 조회만 수행한다.
`docs/naver_scraping_legal_risk_assessment_v1.0.md`의 "정당 목적(제48조 방어 논리)"은
"고객 본인 사업장 확인"을 전제로 한 것이라, AEOlab과 아무 관계 없는 제3자(비고객)
사업장을 무단 조회하는 이 기능에는 그대로 적용되지 않는다 — 그래서 로그인이 필요한
기능(AI 브리핑 등)은 의도적으로 배제하고, 이미 "경쟁사 관리" 기능에서 실사용 중인
공개 페이지 크롤러(competitor_place_crawler.py)만 재사용한다.

이 기능은 /api/startup/report(인증+플랜게이트+월 5~10회 한도)에서만 호출한다 —
/api/startup/market(비로그인 공개 미리보기)에서는 절대 호출 금지(무제한 크롤링 유발 위험).
"""
import asyncio
import logging

_logger = logging.getLogger("aeolab.startup_competitor_readiness")

_MAX_COMPETITORS = 3  # 요청-응답 지연 시간 고려(Playwright 전역 세마포어=1이라 사실상 순차 실행)


async def check_competitors_readiness(samples: list[dict], region: str) -> dict:
    """SBIZ 실제 경쟁사 목록(name, address) → 스마트플레이스 공개 완성도 요약.

    개별 건 실패(장소 미매칭·크롤링 실패)는 건너뛰고, 최소 1건 이상 성공하면
    available=True. 전부 실패해도 예외를 던지지 않음(호출부의 graceful 패턴과 일관).
    """
    if not samples:
        return {"available": False, "checked": 0, "items": []}

    from services.local_search import find_naver_place_id
    from services.competitor_place_crawler import fetch_competitor_place_data

    async def _check_one(s: dict) -> dict | None:
        place_id = await find_naver_place_id(s.get("name", ""), s.get("address", ""), region)
        if not place_id:
            return None
        data = await fetch_competitor_place_data(place_id)
        if data.get("error"):
            return None
        return {
            "name": s.get("name", ""),
            "has_intro": bool(data.get("has_intro")),
            "has_recent_post": bool(data.get("has_recent_post")),
            "photo_count": data.get("photo_count", 0),
            "review_count": data.get("review_count", 0),
        }

    targets = samples[:_MAX_COMPETITORS]
    results: list[dict] = []
    for s in targets:
        try:
            r = await _check_one(s)
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
