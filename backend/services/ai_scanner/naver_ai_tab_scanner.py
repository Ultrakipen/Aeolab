"""네이버 AI탭 노출 스캐너 (P2 - 6월 AI탭 전체 확대 후 활성화 예정).

활성화 방법: 환경변수 NAVER_AI_TAB_ENABLED=true 설정

현재 상태: NAVER_AI_TAB_ENABLED=false (기본값) → scan() 호출 시 즉시 None 반환

배경 (2026-05-16):
  - 네이버 AI탭은 2026-04-27 베타 공개 (네이버플러스 우선)
  - 2026년 상반기 전체 확대 예정 → 전체 확대 후 이 스캐너 활성화
  - AI탭은 모든 업종 노출 가능 (AI브리핑의 ACTIVE/LIKELY/INACTIVE 구분 없음)
  - 실제 DOM 셀렉터는 6월 전체 확대 후 재확인 필요 (TODO 주석 참조)
"""

import asyncio
import logging
import os
from typing import Optional

_logger = logging.getLogger("aeolab")

# 환경변수로 활성화 여부 결정 — 기본값 false (6월 확대 후 true로 전환)
NAVER_AI_TAB_ENABLED: bool = os.getenv("NAVER_AI_TAB_ENABLED", "false").lower() == "true"

# Playwright RAM 보호: 동시 1개 제한 (별도 세마포어 — multi_scanner의 PLAYWRIGHT_SEMAPHORE와 공유하지 않음)
_AI_TAB_SEMAPHORE = asyncio.Semaphore(1)

# TODO(P2, 6월 확대 후): 네이버 AI탭 실제 DOM 셀렉터 검증 및 업데이트
# 현재는 베타 기간 기준 예상 셀렉터. 전체 확대 후 실측으로 교체 필요.
_AI_TAB_SELECTORS = [
    "div[data-tab='ai']",       # 예상 AI탭 컨테이너
    "#ai_answer",                # AI 답변 영역 (네이버 AI브리핑 공유 가능)
    ".ai_tab_answer",            # AI탭 전용 예상 클래스
    "div[class*='AiTab']",      # camelCase 변형
    "div[class*='ai_tab']",     # snake_case 변형
    "[data-section='ai_tab']",  # data 속성 변형
]


async def scan(query: str, business_name: str) -> Optional[dict]:
    """네이버 AI탭에서 사업장명 언급 여부를 확인한다.

    Args:
        query: 검색 쿼리 (예: "서울 강남 헬스장 추천")
        business_name: 사업장명 (언급 여부 판단 기준)

    Returns:
        NAVER_AI_TAB_ENABLED=false: None (비활성 상태)
        활성화 시: {
            "mentioned": bool,
            "excerpt": str,       # 언급된 문장 (미언급 시 "")
            "tab_available": bool # AI탭 섹션 DOM 존재 여부
        }
        오류 시: None
    """
    if not NAVER_AI_TAB_ENABLED:
        _logger.debug(f"[naver_ai_tab] scan skip — NAVER_AI_TAB_ENABLED=false (query={query!r})")
        return None

    try:
        async with _AI_TAB_SEMAPHORE:
            return await asyncio.wait_for(
                _run_scan(query, business_name),
                timeout=30.0,
            )
    except asyncio.TimeoutError:
        _logger.warning(f"[naver_ai_tab] scan timeout (30s): query={query!r}")
        return None
    except Exception as e:
        _logger.warning(f"[naver_ai_tab] scan 오류: query={query!r}, error={e}")
        return None


async def _run_scan(query: str, business_name: str) -> Optional[dict]:
    """Playwright로 네이버 AI탭 DOM을 파싱한다 (내부 구현)."""
    import urllib.parse
    from playwright.async_api import async_playwright

    encoded_q = urllib.parse.quote(query)
    url = f"https://search.naver.com/search.naver?query={encoded_q}"

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        )
        ctx = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            locale="ko-KR",
            timezone_id="Asia/Seoul",
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
        )
        page = await ctx.new_page()

        try:
            await page.goto(url, timeout=25000)
            await page.wait_for_timeout(3000)

            # TODO(P2, 6월 확대 후): AI탭 클릭 또는 직접 탭 URL 파라미터 확인
            # 현재는 통합검색 결과 페이지에서 AI탭 섹션 직접 탐색
            tab_available = False
            ai_text = ""

            for selector in _AI_TAB_SELECTORS:
                try:
                    el = await page.query_selector(selector)
                    if el:
                        tab_available = True
                        ai_text = (await el.inner_text()) or ""
                        break
                except Exception:
                    continue

            if not tab_available:
                _logger.debug(
                    f"[naver_ai_tab] AI탭 섹션 미발견 (DOM 미존재 또는 셀렉터 불일치): "
                    f"query={query!r}"
                )
                return {
                    "mentioned": False,
                    "excerpt": "",
                    "tab_available": False,
                }

            # 사업장명 언급 여부 판단
            normalized_name = _normalize(business_name)
            normalized_text = _normalize(ai_text)
            mentioned = normalized_name in normalized_text and len(normalized_name) >= 2

            # 언급된 문장 추출 (언급 시 해당 문장 반환)
            excerpt = ""
            if mentioned:
                for line in ai_text.split("\n"):
                    if normalized_name in _normalize(line):
                        excerpt = line.strip()[:200]
                        break

            _logger.info(
                f"[naver_ai_tab] 스캔 완료: query={query!r}, "
                f"mentioned={mentioned}, tab_available={tab_available}"
            )
            return {
                "mentioned": mentioned,
                "excerpt": excerpt,
                "tab_available": tab_available,
            }

        finally:
            await browser.close()


async def scan_batch(queries: list[str], business_name: str) -> dict:
    """여러 쿼리에 대해 네이버 AI탭 스캔을 순차 실행한다.

    비활성 상태(NAVER_AI_TAB_ENABLED=false)이면 빈 dict 반환.
    순차 실행으로 Playwright RAM 보호 (동시 2개 이상 금지).

    Args:
        queries: 검색 쿼리 목록 (최대 4개 처리)
        business_name: 사업장명

    Returns:
        {query: result_dict} 형태. 오류 발생 쿼리는 None 값으로 포함.
    """
    if not NAVER_AI_TAB_ENABLED:
        _logger.debug("[naver_ai_tab] scan_batch skip — NAVER_AI_TAB_ENABLED=false")
        return {}

    results: dict = {}
    for query in queries[:4]:  # 최대 4개
        result = await scan(query, business_name)
        results[query] = result
        if result is not None:
            # 인스턴스 해제 후 짧은 대기 (RAM 복구)
            await asyncio.sleep(2)
    return results
