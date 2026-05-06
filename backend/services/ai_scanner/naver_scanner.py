from playwright.async_api import async_playwright
import asyncio
import logging
import re

logger = logging.getLogger("aeolab")

# AI 브리핑 셀렉터 (네이버 DOM 변경 대응 — 우선순위 순, 2026-04-14 업데이트)
BRIEFING_SELECTORS = [
    # 2025~2026 네이버 AI 브리핑 최신 DOM
    ".ai_answer_area",
    "div[class*='AiAnswerArea']",
    "div[class*='ai_answer_area']",
    ".a_ai_area",
    "div[data-type='ai_summary']",
    ".ai-answer-wrap",
    "#ai-answer",
    "div.ai_summary",
    # 레거시 (2024 이전)
    ".ai_answer",
    ".cai_cont",
    "[class*='ai_brief']",
    "[class*='ai_answer']",
    "[class*='cai_']",
    "[class*='clue_ai']",
    ".ai_wrap",
    "#ai_wrap",
    "[data-section='ai']",
]

# 플레이스 결과 셀렉터 (네이버 DOM 변경 대응 — 우선순위 순)
PLACE_SELECTORS = [
    ".place_bluelink",
    ".cpc_place_title",
    "[class*='place_bluelink']",
    ".place_link",
    ".api_subject_bx .place_bluelink",
    ".flicking-panel .place_bluelink",
    "a[class*='PlaceItem']",
    ".place_section a[role='button']",
    ".O8[href*='place.naver.com']",
    "a[href*='place.naver.com']",
]


def _normalize(text: str) -> str:
    """공백·특수문자 제거 소문자 변환"""
    import re
    return re.sub(r"[\s\-_·&·]", "", text or "").lower()


def _name_in_text(target: str, text: str) -> bool:
    """업체명이 텍스트에 포함되는지 확인 (공백 무시, 부분 매칭)"""
    t = _normalize(target)
    c = _normalize(text)
    return t in c or (len(t) >= 2 and c in t)


class NaverAIBriefingScanner:
    """
    네이버 AI 브리핑(플레이스형)에서 사업장 노출 여부 파싱
    Playwright로 실제 검색 결과를 렌더링 후 DOM 파싱
    """

    async def _check_single_page(self, page, query: str, target: str) -> dict:
        """단일 페이지에서 AI 브리핑 및 플레이스 결과 확인"""
        mentioned   = False
        in_briefing = False
        excerpt     = ""
        rank        = None
        page_text   = ""

        try:
            url = f"https://search.naver.com/search.naver?query={query}"
            await page.goto(url, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(3000)  # AI 브리핑 로딩 대기

            try:
                page_text = await page.inner_text("body") or ""
            except Exception:
                page_text = ""

            # ── 캡챠 / 차단 감지 ─────────────────────────────────
            current_url = page.url
            page_title  = await page.title()
            if (
                any(kw in current_url for kw in ["captcha", "nid.naver.com", "login.naver.com"]) or
                any(kw in page_title  for kw in ["로봇", "자동화", "captcha", "CAPTCHA", "보안문자"]) or
                bool(re.search(r"로봇이 아님|자동화된 요청|비정상적인 접근|보안 문자", page_text[:500]))
            ):
                logger.warning(f"[naver_scanner] captcha/block detected for query: {query}")
                return {
                    "platform": "naver", "mentioned": False, "in_briefing": False,
                    "rank": None, "excerpt": "", "captcha_detected": True,
                    "error": "captcha_or_blocked", "_query_used": query,
                }

            # ── AI 브리핑 영역 확인 ──────────────────────────────
            for sel in BRIEFING_SELECTORS:
                try:
                    el = await page.query_selector(sel)
                    if el:
                        text = await el.inner_text()
                        if _name_in_text(target, text):
                            in_briefing = True
                            lines = [l for l in text.split("\n") if _name_in_text(target, l)]
                            excerpt = lines[0][:120] if lines else ""
                        break
                except Exception:
                    continue

            # ── 플레이스 결과 순위 확인 ──────────────────────────
            for sel in PLACE_SELECTORS:
                try:
                    items = await page.query_selector_all(sel)
                    if not items:
                        continue
                    for i, item in enumerate(items[:15]):
                        try:
                            name = await item.inner_text()
                        except Exception:
                            name = ""
                        if _name_in_text(target, name):
                            mentioned = True
                            rank = i + 1
                            break
                    if mentioned:
                        break
                except Exception:
                    continue

            # ── 셀렉터 전부 실패 시 전체 텍스트로 fallback ────────
            if not mentioned and page_text and _name_in_text(target, page_text):
                mentioned = True

        except Exception as e:
            logger.warning(f"NaverAIBriefingScanner page check error for '{query}': {e}")

        return {
            "platform":    "naver",
            "mentioned":   mentioned or in_briefing,
            "in_briefing": in_briefing,
            "rank":        rank,
            "excerpt":     excerpt,
            "_query_used": query,
        }

    async def check_mention(self, query: str, target: str) -> dict:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
            )
            ctx = await browser.new_context(
                locale="ko-KR",
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
            )
            page = await ctx.new_page()
            try:
                result = await self._check_single_page(page, query, target)
            finally:
                await browser.close()
        return result

    async def check_mention_multi(self, queries: list[str], target: str) -> dict:
        """여러 키워드를 하나의 브라우저 세션에서 순차 실행 (RAM 절약)

        Returns: 최선 결과 + keyword_results 리스트
        """
        if not queries:
            return {
                "platform": "naver", "mentioned": False, "in_briefing": False,
                "rank": None, "excerpt": "", "keyword_results": [],
            }

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
            )
            ctx = await browser.new_context(
                locale="ko-KR",
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
            )
            keyword_results = []
            for q in queries:
                page = await ctx.new_page()
                try:
                    r = await self._check_single_page(page, q, target)
                finally:
                    await page.close()
                keyword_results.append(r)
                if r.get("captcha_detected"):
                    break
                await asyncio.sleep(0.8)
            await browser.close()

        # 최선 결과: in_briefing+excerpt > in_briefing > mentioned > first
        best = (
            next((r for r in keyword_results if r.get("in_briefing") and r.get("excerpt")), None)
            or next((r for r in keyword_results if r.get("in_briefing")), None)
            or next((r for r in keyword_results if r.get("mentioned")), None)
            or keyword_results[0]
        )
        return {**best, "keyword_results": keyword_results}
