"""
네이버 키워드 검색 순위 측정 (Playwright)
service_unification_v1.0.md §4.1 / §5.3 측정 환경 표준화 적용

측정 대상:
  - PC 통합검색 (search.naver.com)
  - 모바일 통합검색 (m.search.naver.com)
  - 플레이스/지도 섹션 (PC 검색 결과 내 플레이스 카드)

측정 환경 (재현성 보장):
  - 위치: 서버 IP (서울 기준 가정 — 측정 환경은 measurement_context에 기록)
  - 디바이스: User-Agent 분리 (PC Chrome / 모바일 iPhone)
  - 비로그인
  - 측정 시각

빈 상태·에러 폴백 (작업 지침 #7):
  - 사업장 매칭 실패 → rank=None (미노출)
  - Timeout → rank=None + measurement_context["timeout"]=True
  - Playwright 자체 실패 → 전체 None + measurement_context["error"]=str(e)
  - 임의 수치 절대 금지

서버 부담:
  - 1키워드 × 3채널 = ~6초/키워드
  - BACKEND_MAX_CONCURRENCY 환경변수로 동시 실행 제한 (기본 2)
"""
import os
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from playwright.async_api import async_playwright, Page, TimeoutError as PWTimeout

_logger = logging.getLogger("aeolab")

# 환경변수 분리 (CLAUDE.md 운영 서버 주의사항 + 작업 지침 #7)
MAX_CONCURRENCY = int(os.getenv("BACKEND_MAX_CONCURRENCY", "2"))
PAGE_TIMEOUT_MS = int(os.getenv("KEYWORD_RANK_TIMEOUT_MS", "15000"))
RESULT_LIMIT = int(os.getenv("KEYWORD_RANK_LIMIT", "20"))  # 1페이지 상위 20개

_semaphore = asyncio.Semaphore(MAX_CONCURRENCY)

UA_PC = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
UA_MOBILE = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) "
    "Version/17.0 Mobile/15E148 Safari/604.1"
)


def _norm(s: str) -> str:
    """비교용 정규화: 공백·특수문자 제거 + 소문자."""
    if not s:
        return ""
    return "".join(c for c in s.lower() if c.isalnum())


async def _find_rank_in_page(
    page: Page,
    biz_name: str,
    place_id: Optional[str],
    selector: str,
    text_attr: str = "innerText",
) -> Optional[int]:
    """페이지 내 검색 결과 요소를 순회하며 사업장 매칭 위치 반환.

    매칭 우선순위:
      1. place_id가 href·data-* 속성에 포함되면 우선 매칭 (가장 정확)
      2. biz_name 정규화 일치 (공백·특수문자 제거 후)

    반환: 1-based rank 또는 None (미노출)
    """
    try:
        elements = await page.query_selector_all(selector)
    except Exception as e:
        _logger.warning(f"keyword_rank: selector '{selector}' 실패: {e}")
        return None

    target_norm = _norm(biz_name)
    if not target_norm:
        return None

    for idx, el in enumerate(elements[:RESULT_LIMIT], start=1):
        try:
            # place_id 매칭 (href 등)
            if place_id:
                html = await el.evaluate("e => e.outerHTML")
                if place_id in (html or ""):
                    return idx
            # 텍스트 매칭
            text = await el.evaluate(f"e => e.{text_attr} || ''")
            if target_norm in _norm(text):
                return idx
        except Exception:
            continue
    return None


async def _measure_pc(
    page: Page,
    keyword: str,
    biz_name: str,
    place_id: Optional[str],
) -> tuple[Optional[int], Optional[int]]:
    """PC 통합검색 + 플레이스 섹션 순위 동시 측정.
    반환: (pc_rank, place_rank)
    """
    url = f"https://search.naver.com/search.naver?query={keyword}"
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=PAGE_TIMEOUT_MS)
    except PWTimeout:
        _logger.warning(f"keyword_rank PC timeout: {keyword}")
        return (None, None)
    except Exception as e:
        _logger.warning(f"keyword_rank PC nav 실패 ({keyword}): {e}")
        return (None, None)

    # PC 통합검색: 일반 검색 결과 링크
    pc_rank = await _find_rank_in_page(
        page, biz_name, place_id,
        selector="div.total_wrap a.link_tit, ul.lst_total li a.api_txt_lines, .total_area a"
    )
    # 플레이스 섹션: 지도/플레이스 카드
    place_rank = await _find_rank_in_page(
        page, biz_name, place_id,
        selector="ul.list_place li, .place_card, .map_search_result li, .lst_total li.bx"
    )
    return (pc_rank, place_rank)


async def _measure_mobile(
    page: Page,
    keyword: str,
    biz_name: str,
    place_id: Optional[str],
) -> Optional[int]:
    """모바일 통합검색 순위 측정."""
    url = f"https://m.search.naver.com/search.naver?query={keyword}"
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=PAGE_TIMEOUT_MS)
    except PWTimeout:
        _logger.warning(f"keyword_rank mobile timeout: {keyword}")
        return None
    except Exception as e:
        _logger.warning(f"keyword_rank mobile nav 실패 ({keyword}): {e}")
        return None

    return await _find_rank_in_page(
        page, biz_name, place_id,
        selector=".api_subject_bx li, .bx_item, ._search_list li, a.api_txt_lines"
    )


async def measure_keywords(
    keywords: list[str],
    biz_name: str,
    place_id: Optional[str] = None,
) -> dict:
    """키워드 리스트의 PC/모바일/플레이스 순위 측정.

    반환 형식 (scan_results.keyword_ranks JSONB와 호환):
        {
          "keyword1": {
            "pc_rank": int | None,
            "mobile_rank": int | None,
            "place_rank": int | None,
            "measured_at": ISO 8601
          },
          ...,
          "_context": {
            "location": "Seoul",
            "logged_in": False,
            "playwright": "1.x",
            "scanned_at": "...",
            "errors": [...]
          }
        }

    빈 상태:
        keywords가 빈 리스트면 {"_context": {"empty": True}} 반환.

    score_engine.calc_keyword_search_rank_score()와 직접 호환.
    """
    if not keywords:
        return {"_context": {"empty": True, "scanned_at": _now_iso()}}

    if not biz_name:
        return {"_context": {"error": "biz_name 누락", "scanned_at": _now_iso()}}

    async with _semaphore:
        return await _run_with_browser(keywords, biz_name, place_id)


async def _run_with_browser(
    keywords: list[str],
    biz_name: str,
    place_id: Optional[str],
) -> dict:
    """Playwright 브라우저 1회 기동 후 모든 키워드 순차 측정 (RAM 절약)."""
    started_at = _now_iso()
    errors: list[str] = []
    results: dict = {}

    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
            )
            try:
                # PC 컨텍스트
                pc_ctx = await browser.new_context(locale="ko-KR", user_agent=UA_PC)
                # 모바일 컨텍스트 (별도 viewport)
                mobile_ctx = await browser.new_context(
                    locale="ko-KR",
                    user_agent=UA_MOBILE,
                    viewport={"width": 390, "height": 844},
                )

                pc_page = await pc_ctx.new_page()
                mobile_page = await mobile_ctx.new_page()

                for kw in keywords:
                    if not kw or not isinstance(kw, str):
                        continue
                    try:
                        pc_rank, place_rank = await _measure_pc(pc_page, kw, biz_name, place_id)
                        mobile_rank = await _measure_mobile(mobile_page, kw, biz_name, place_id)
                        results[kw] = {
                            "pc_rank": pc_rank,
                            "mobile_rank": mobile_rank,
                            "place_rank": place_rank,
                            "measured_at": _now_iso(),
                        }
                    except Exception as e:
                        _logger.warning(f"keyword_rank '{kw}' 실패: {e}")
                        errors.append(f"{kw}: {type(e).__name__}")
                        results[kw] = {
                            "pc_rank": None, "mobile_rank": None, "place_rank": None,
                            "measured_at": _now_iso(),
                            "error": type(e).__name__,
                        }
            finally:
                await browser.close()
    except Exception as e:
        _logger.warning(f"keyword_rank Playwright 자체 실패: {e}")
        errors.append(f"playwright: {type(e).__name__}: {e}")

    results["_context"] = {
        "location": os.getenv("KEYWORD_RANK_LOCATION", "Seoul"),
        "device": "PC+mobile",
        "logged_in": False,
        "started_at": started_at,
        "scanned_at": _now_iso(),
        "errors": errors,
        "max_concurrency": MAX_CONCURRENCY,
    }
    return results


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
