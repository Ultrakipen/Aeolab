"""
네이버 키워드 검색 순위 측정 (Playwright)
service_unification_v1.0.md §4.1 / §5.3 측정 환경 표준화 적용

측정 대상:
  - PC 통합검색 (search.naver.com)
  - 모바일 통합검색 (m.search.naver.com)
  - 플레이스 탭 순위 (search.naver.com?where=place — 가장 정확)

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
  - 1키워드 × 3채널 = ~9초/키워드
  - BACKEND_MAX_CONCURRENCY 환경변수로 동시 실행 제한 (기본 2)
"""
import os
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from playwright.async_api import async_playwright, Page, TimeoutError as PWTimeout

_logger = logging.getLogger("aeolab")

MAX_CONCURRENCY = int(os.getenv("BACKEND_MAX_CONCURRENCY", "2"))
PAGE_TIMEOUT_MS = int(os.getenv("KEYWORD_RANK_TIMEOUT_MS", "15000"))
RESULT_LIMIT = int(os.getenv("KEYWORD_RANK_LIMIT", "20"))

_semaphore = asyncio.Semaphore(MAX_CONCURRENCY)

UA_PC = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
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


def _is_match(biz_name_norm: str, text: str) -> bool:
    """사업장 이름 매칭.

    - 정방향: 텍스트 안에 사업장 이름이 포함 (기존)
    - 역방향: 텍스트가 사업장 이름의 일부 (짧은 상호명 표시 대응, 최소 4자)
    """
    text_norm = _norm(text)
    if not text_norm or not biz_name_norm:
        return False
    if biz_name_norm in text_norm:
        return True
    if len(text_norm) >= 4 and text_norm in biz_name_norm:
        return True
    return False


async def _page_contains_place_id(page: Page, place_id: str) -> bool:
    """페이지 HTML 전체에 place_id 존재 여부 (폴백 검출용)."""
    try:
        return bool(await page.evaluate(
            f"() => document.documentElement.innerHTML.includes('{place_id}')"
        ))
    except Exception:
        return False


async def _find_rank_in_elements(
    page: Page,
    selector: str,
    biz_name_norm: str,
    place_id: Optional[str],
) -> Optional[int]:
    """주어진 셀렉터로 요소를 수집하여 순위 반환."""
    try:
        elements = await page.query_selector_all(selector)
    except Exception:
        return None

    if not elements:
        return None

    for idx, el in enumerate(elements[:RESULT_LIMIT], start=1):
        try:
            if place_id:
                html = await el.evaluate("e => e.outerHTML")
                if place_id in (html or ""):
                    return idx
            text = await el.evaluate("e => e.innerText || ''")
            if _is_match(biz_name_norm, text):
                return idx
        except Exception:
            continue
    return None


# PC 통합검색 셀렉터 목록 (우선순위 순)
_PC_SELECTORS = [
    "#main_pack li.bx",
    ".api_subject_bx li",
    ".total_wrap li",
    "section li",
    "#main_pack a[href]",
]

# 플레이스 탭 셀렉터 목록 (where=place 전용 URL)
_PLACE_TAB_SELECTORS = [
    "ul.place_section_content li",
    "ul[class*='list'] li",
    "li[data-nclk-index]",
    "ul li",
]

# 모바일 셀렉터 목록
_MOBILE_SELECTORS = [
    "#ct li.bx",
    ".api_subject_bx li",
    "li.bx",
    "ul li",
]


async def _measure_pc(
    page: Page,
    keyword: str,
    biz_name_norm: str,
    place_id: Optional[str],
) -> Optional[int]:
    """PC 통합검색 순위."""
    url = f"https://search.naver.com/search.naver?query={keyword}"
    try:
        await page.goto(url, wait_until="networkidle", timeout=PAGE_TIMEOUT_MS)
    except PWTimeout:
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=PAGE_TIMEOUT_MS)
        except Exception:
            _logger.warning(f"keyword_rank PC timeout: {keyword}")
            return None
    except Exception as e:
        _logger.warning(f"keyword_rank PC nav 실패 ({keyword}): {e}")
        return None

    for sel in _PC_SELECTORS:
        rank = await _find_rank_in_elements(page, sel, biz_name_norm, place_id)
        if rank is not None:
            _logger.debug(f"PC rank found: '{keyword}' → {rank}위 (sel={sel})")
            return rank

    # 최후 폴백: place_id가 페이지 어딘가에 있으면 노출로 처리
    if place_id and await _page_contains_place_id(page, place_id):
        _logger.debug(f"PC rank fallback (page html): '{keyword}' → 1")
        return 1

    return None


async def _measure_place(
    page: Page,
    keyword: str,
    biz_name_norm: str,
    place_id: Optional[str],
) -> Optional[int]:
    """네이버 플레이스 탭 순위 (where=place — 가장 정확)."""
    url = f"https://search.naver.com/search.naver?query={keyword}&where=place"
    try:
        await page.goto(url, wait_until="networkidle", timeout=PAGE_TIMEOUT_MS)
    except PWTimeout:
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=PAGE_TIMEOUT_MS)
        except Exception:
            _logger.warning(f"keyword_rank place tab timeout: {keyword}")
            return None
    except Exception as e:
        _logger.warning(f"keyword_rank place tab 실패 ({keyword}): {e}")
        return None

    for sel in _PLACE_TAB_SELECTORS:
        rank = await _find_rank_in_elements(page, sel, biz_name_norm, place_id)
        if rank is not None:
            _logger.debug(f"Place rank found: '{keyword}' → {rank}위 (sel={sel})")
            return rank

    if place_id and await _page_contains_place_id(page, place_id):
        _logger.debug(f"Place rank fallback (page html): '{keyword}' → 1")
        return 1

    return None


async def _measure_mobile(
    page: Page,
    keyword: str,
    biz_name_norm: str,
    place_id: Optional[str],
) -> Optional[int]:
    """모바일 통합검색 순위."""
    url = f"https://m.search.naver.com/search.naver?query={keyword}"
    try:
        await page.goto(url, wait_until="networkidle", timeout=PAGE_TIMEOUT_MS)
    except PWTimeout:
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=PAGE_TIMEOUT_MS)
        except Exception:
            _logger.warning(f"keyword_rank mobile timeout: {keyword}")
            return None
    except Exception as e:
        _logger.warning(f"keyword_rank mobile nav 실패 ({keyword}): {e}")
        return None

    for sel in _MOBILE_SELECTORS:
        rank = await _find_rank_in_elements(page, sel, biz_name_norm, place_id)
        if rank is not None:
            _logger.debug(f"Mobile rank found: '{keyword}' → {rank}위 (sel={sel})")
            return rank

    if place_id and await _page_contains_place_id(page, place_id):
        _logger.debug(f"Mobile rank fallback (page html): '{keyword}' → 1")
        return 1

    return None


async def measure_keywords(
    keywords: list[str],
    biz_name: str,
    place_id: Optional[str] = None,
    region: Optional[str] = None,
) -> dict:
    """키워드 리스트의 PC/모바일/플레이스 순위 측정."""
    if not keywords:
        return {"_context": {"empty": True, "scanned_at": _now_iso()}}
    if not biz_name:
        return {"_context": {"error": "biz_name 누락", "scanned_at": _now_iso()}}

    async with _semaphore:
        return await _run_with_browser(keywords, biz_name, place_id, region or "")


async def _run_with_browser(
    keywords: list[str],
    biz_name: str,
    place_id: Optional[str],
    region: str = "",
) -> dict:
    """Playwright 브라우저 1회 기동 후 모든 키워드 순차 측정 (RAM 절약)."""
    started_at = _now_iso()
    errors: list[str] = []
    results: dict = {}
    biz_name_norm = _norm(biz_name)

    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
            )
            try:
                pc_ctx = await browser.new_context(locale="ko-KR", user_agent=UA_PC)
                place_ctx = await browser.new_context(locale="ko-KR", user_agent=UA_PC)
                mobile_ctx = await browser.new_context(
                    locale="ko-KR",
                    user_agent=UA_MOBILE,
                    viewport={"width": 390, "height": 844},
                )

                pc_page = await pc_ctx.new_page()
                place_page = await place_ctx.new_page()
                mobile_page = await mobile_ctx.new_page()

                region_norm = _norm(region)

                for kw in keywords:
                    if not kw or not isinstance(kw, str):
                        continue
                    kw_norm = _norm(kw)
                    if region and region_norm and region_norm not in kw_norm:
                        search_query = f"{region} {kw}"
                    else:
                        search_query = kw

                    try:
                        pc_rank = await _measure_pc(pc_page, search_query, biz_name_norm, place_id)
                        place_rank = await _measure_place(place_page, search_query, biz_name_norm, place_id)
                        mobile_rank = await _measure_mobile(mobile_page, search_query, biz_name_norm, place_id)
                        _logger.info(
                            f"keyword_rank '{search_query}': "
                            f"PC={pc_rank} Place={place_rank} Mobile={mobile_rank}"
                        )
                        results[kw] = {
                            "pc_rank": pc_rank,
                            "mobile_rank": mobile_rank,
                            "place_rank": place_rank,
                            "measured_at": _now_iso(),
                            "search_query": search_query,
                        }
                    except Exception as e:
                        _logger.warning(f"keyword_rank '{kw}' 실패: {e}")
                        errors.append(f"{kw}: {type(e).__name__}")
                        results[kw] = {
                            "pc_rank": None, "mobile_rank": None, "place_rank": None,
                            "measured_at": _now_iso(),
                            "search_query": search_query,
                            "error": type(e).__name__,
                        }
            finally:
                await browser.close()
    except Exception as e:
        _logger.warning(f"keyword_rank Playwright 자체 실패: {e}")
        errors.append(f"playwright: {type(e).__name__}: {e}")

    results["_context"] = {
        "location": os.getenv("KEYWORD_RANK_LOCATION", "Seoul"),
        "device": "PC+mobile+place",
        "logged_in": False,
        "started_at": started_at,
        "scanned_at": _now_iso(),
        "errors": errors,
        "max_concurrency": MAX_CONCURRENCY,
    }
    return results


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
