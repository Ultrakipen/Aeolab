from playwright.async_api import async_playwright
import asyncio
import logging
import random
import re

from services.keyword_taxonomy import log_ad_only_mismatch
from services.ai_scanner import apply_stealth, get_proxy_config, get_random_ua, get_naver_cookies, build_chrome_ua, block_heavy_resources, attach_bandwidth_counter
from services.ai_scanner.bandwidth_tracker import record_usage_mb

logger = logging.getLogger("aeolab")

# AI 브리핑 셀렉터 (네이버 DOM 변경 대응 — 우선순위 순)
# 2026-06-30 실측: 실제 DOM 클래스 접두사 = fds-aib (fds-aib-expandable-container, fds-aib-answer-expa 등)
BRIEFING_SELECTORS = [
    # ── 2026 네이버 AI 브리핑 최신 DOM (fds-aib 접두사, 2026-06-30 실측 확인) ──
    "div[class*='fds-aib-expandable-container']",   # 메인 확장 컨테이너
    "div[class*='fds-aib-answer']",                 # 답변 영역 (expa/expand 변형 포함)
    "div[class*='fds-aib-static-position']",        # 정적 위치 컨테이너
    "div[class*='fds-aib']",                        # fds-aib 전체 fallback
    # ── 구버전 DOM (2025 이전) ──
    ".ai_answer_area",
    "div[class*='AiAnswerArea']",
    "div[class*='ai_answer_area']",
    ".a_ai_area",
    "div[data-type='ai_summary']",
    ".ai-answer-wrap",
    "#ai-answer",
    "div.ai_summary",
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

# AI탭 셀렉터 (통합검색 내 섹션 — 별도 URL 없음)
AI_TAB_SELECTORS = [
    "[data-tab='ai']",
    "[data-section='ai_tab']",
    "div[class*='AiTab']",
    "div[class*='ai_tab']",
    ".ai_tab_section",
    "#ai_tab",
]

# 광고 영역 셀렉터 (Q2 광고 출시 전 — 현재 False 반환 예상)
AD_BRIEFING_SELECTORS = [
    "[data-ad='ai_brief']",
    "[data-section='ad']",
    "span.ad_marker",
    "div[class*='AdBrief']",
    "div[class*='ad_brief']",
    ".ai_answer_area[data-ad='true']",
]


async def _detect_ad_briefing(page) -> bool:
    """AI 브리핑이 광고 영역 노출인지 감지. Q2 광고 출시 전엔 False."""
    for sel in AD_BRIEFING_SELECTORS:
        try:
            el = await page.query_selector(sel)
            if el:
                return True
        except Exception as _e:
            logger.debug(f"[naver_scanner] ad_briefing selector failed — {_e}")
            continue
    return False


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

    async def _check_single_page(self, page, query: str, target: str, category: str = "") -> dict:
        """단일 페이지에서 AI 브리핑 및 플레이스 결과 확인"""
        mentioned      = False
        in_briefing    = False
        excerpt        = ""
        rank           = None
        page_text      = ""
        in_ai_tab      = False
        ai_tab_excerpt = ""
        ad_only        = False

        try:
            url = f"https://search.naver.com/search.naver?query={query}"
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(random.randint(2800, 4800))  # 인간 편차 딜레이

            try:
                page_text = await page.inner_text("body") or ""
            except Exception as _e:
                logger.warning(f"[naver_scanner] page inner_text failed — {_e}")
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
                    "in_ai_tab": False, "ai_tab_excerpt": "", "ad_only": False,
                    "queries_used": [query],
                }

            # ── AI 브리핑 "펼쳐서 더보기" 확장 ─────────────────────
            # 정보형 AI 브리핑은 기본 텍스트가 잘려 있어 사업장명이 숨겨질 수 있음.
            # 2026-06-30 실측: 버튼이 <button> 태그가 아닐 수 있음 → 여러 방법 시도
            try:
                expand_btn = (
                    await page.query_selector("button:has-text('펼쳐서 더보기')") or
                    await page.query_selector("[class*='fds-aib-expandable'] [role='button']") or
                    await page.query_selector("[class*='fds-aib'] button") or
                    await page.query_selector("[aria-label*='더보기']") or
                    await page.query_selector("[class*='expand']")
                )
                if expand_btn:
                    # ElementHandle.click()은 overlay로 타임아웃됨 → JS evaluate 우선
                    try:
                        await page.evaluate("el => el.click()", expand_btn)
                        await page.wait_for_timeout(800)
                        page_text = await page.inner_text("body") or ""
                        logger.debug("[naver_scanner] 더보기 JS evaluate 클릭 성공")
                    except Exception:
                        pass
            except Exception as _e:
                logger.debug(f"[naver_scanner] 더보기 클릭 실패 (무시): {_e}")

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
                except Exception as _e:
                    logger.debug(f"[naver_scanner] briefing selector failed — {_e}")
                    continue

            # ── AI탭 섹션 감지 ──────────────────────────────────
            for sel in AI_TAB_SELECTORS:
                try:
                    el = await page.query_selector(sel)
                    if el:
                        text = await el.inner_text()
                        if _name_in_text(target, text):
                            in_ai_tab = True
                            lines = [l for l in text.split("\n") if _name_in_text(target, l)]
                            ai_tab_excerpt = lines[0][:120] if lines else ""
                        break
                except Exception as _e:
                    logger.debug(f"[naver_scanner] ai_tab selector failed — {_e}")
                    continue

            # ── 광고 영역 감지 + taxonomy 교차 검증 ─────────────
            if in_briefing:
                ad_only = await _detect_ad_briefing(page)
                if ad_only:
                    logger.debug(
                        "[P2-1 ad_only] DOM 감지: ad_only=True (query=%r, category=%r)",
                        query,
                        category,
                    )
                    if category:
                        log_ad_only_mismatch(category, scanned_ad_only=True)

            # ── 플레이스 결과 순위 확인 ──────────────────────────
            for sel in PLACE_SELECTORS:
                try:
                    items = await page.query_selector_all(sel)
                    if not items:
                        continue
                    for i, item in enumerate(items[:15]):
                        try:
                            name = await item.inner_text()
                        except Exception as _e:
                            logger.debug(f"[naver_scanner] place item text failed — {_e}")
                            name = ""
                        if _name_in_text(target, name):
                            mentioned = True
                            rank = i + 1
                            break
                    if mentioned:
                        break
                except Exception as _e:
                    logger.debug(f"[naver_scanner] place selector failed — {_e}")
                    continue

            # ── 셀렉터 전부 실패 시 전체 텍스트로 fallback ────────
            if not mentioned and page_text and _name_in_text(target, page_text):
                mentioned = True

        except Exception as e:
            logger.warning(f"NaverAIBriefingScanner page check error for '{query}': {e}")

        return {
            "platform":      "naver",
            "mentioned":     mentioned or in_briefing,
            "in_briefing":   in_briefing,
            "rank":          rank,
            "excerpt":       excerpt,
            "_query_used":   query,
            "in_ai_tab":     in_ai_tab,
            "ai_tab_excerpt": ai_tab_excerpt,
            "ad_only":       ad_only,
            "queries_used":  [query],
        }

    async def check_mention(self, query: str, target: str, category: str = "") -> dict:
        proxy = get_proxy_config()
        ua = build_chrome_ua()
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True,
                channel="chrome",
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-blink-features=AutomationControlled",
                ],
                proxy=proxy,
            )
            ctx = await browser.new_context(
                viewport={"width": 1280, "height": 800},
                locale="ko-KR",
                timezone_id="Asia/Seoul",
                user_agent=ua,
            )
            naver_cookies = get_naver_cookies()
            if naver_cookies:
                await ctx.add_cookies(naver_cookies)
            await ctx.route("**/*", block_heavy_resources)
            _bw_counter = attach_bandwidth_counter(ctx)
            page = await ctx.new_page()
            # apply_stealth 제거 — 봇 감지 유발 (2026-06-28 AI탭 실측 확인)
            try:
                result = await self._check_single_page(page, query, target, category=category)
            finally:
                await browser.close()
                await record_usage_mb(_bw_counter[0] / 1024 / 1024)
        return result

    async def check_mention_multi(self, queries: list[str], target: str, category: str = "") -> dict:
        """여러 키워드를 하나의 브라우저 세션에서 순차 실행 (RAM 절약)

        Returns: 최선 결과 + keyword_results 리스트
        """
        if not queries:
            return {
                "platform": "naver", "mentioned": False, "in_briefing": False,
                "rank": None, "excerpt": "", "keyword_results": [],
                "in_ai_tab": False, "ai_tab_excerpt": "", "ad_only": False,
                "queries_used": [],
            }

        proxy = get_proxy_config()
        ua = build_chrome_ua()
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True,
                channel="chrome",
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-blink-features=AutomationControlled",
                ],
                proxy=proxy,
            )
            ctx = await browser.new_context(
                viewport={"width": 1280, "height": 800},
                locale="ko-KR",
                timezone_id="Asia/Seoul",
                user_agent=ua,
            )
            naver_cookies = get_naver_cookies()
            if naver_cookies:
                await ctx.add_cookies(naver_cookies)
            await ctx.route("**/*", block_heavy_resources)
            _bw_counter = attach_bandwidth_counter(ctx)
            keyword_results = []
            for q in queries:
                page = await ctx.new_page()
                # apply_stealth 제거 — 봇 감지 유발 (2026-06-28 AI탭 실측 확인)
                try:
                    r = await self._check_single_page(page, q, target, category=category)
                finally:
                    await page.close()
                keyword_results.append(r)
                if r.get("captcha_detected"):
                    break
                await asyncio.sleep(random.uniform(2, 4))
            await browser.close()
            await record_usage_mb(_bw_counter[0] / 1024 / 1024)

        # 최선 결과: in_briefing+excerpt > in_briefing > mentioned > first
        best = (
            next((r for r in keyword_results if r.get("in_briefing") and r.get("excerpt")), None)
            or next((r for r in keyword_results if r.get("in_briefing")), None)
            or next((r for r in keyword_results if r.get("mentioned")), None)
            or keyword_results[0]
        )
        return {**best, "keyword_results": keyword_results, "queries_used": queries}
