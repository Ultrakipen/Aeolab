from playwright.async_api import async_playwright
import asyncio
import logging
import random
import re

from services.keyword_taxonomy import log_ad_only_mismatch
from services.ai_scanner import apply_stealth, get_proxy_config, get_random_ua, get_naver_cookies, build_chrome_ua, block_heavy_resources, attach_bandwidth_counter, note_proxy_result
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
        mentioned        = False
        in_briefing      = False
        excerpt          = ""
        rank             = None
        page_text        = ""
        in_ai_tab        = False
        ai_tab_excerpt   = ""
        ad_only          = False
        source_urls:     list      = []
        source_blog_ids: list[str] = []
        source_image_map: dict[str, bool] = {}  # blog_id -> 이미지 썸네일과 함께 인용됐는지

        try:
            url = f"https://search.naver.com/search.naver?query={query}"
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            note_proxy_result(None)  # goto 성공 — 프록시 정상, 실패 카운터 리셋
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
                    "source_urls": [], "source_blog_ids": [], "source_image_map": {},
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
                            # ── 정보형 AI 브리핑 출처 URL 추출 ──────────────
                            # fds-aib-multi-source-scroll-area 하위 <a href> 수집.
                            # 광고(클립·피드백) 링크는 className으로 필터링.
                            try:
                                source_urls = await el.evaluate("""el => {
                                    const src_area = el.querySelector(
                                        'div[class*="fds-aib-multi-source-scroll-area"]'
                                    );
                                    if (!src_area) return [];
                                    const seen = new Set();
                                    const links = [];
                                    src_area.querySelectorAll('a[href]').forEach(a => {
                                        const url = a.href;
                                        if (!seen.has(url) &&
                                            !a.className.includes('sds-rego-feedback') &&
                                            !a.className.includes('_shortform_trigger')) {
                                            seen.add(url);
                                            links.push(url);
                                        }
                                    });
                                    return links;
                                }""")
                                for _su in (source_urls or []):
                                    _m = re.search(r'blog\.naver\.com/([^/]+)/', _su)
                                    if _m:
                                        _bid = _m.group(1)
                                        if _bid not in source_blog_ids:
                                            source_blog_ids.append(_bid)
                            except Exception as _se:
                                logger.debug(f"[naver_scanner] source_urls extraction failed — {_se}")

                            # ── 이미지 인용 소스 추출 (2026-07-18 실측 재점검으로 신설) ──────
                            # 최초 구현은 위 multi-source-scroll-area 안의 <img>로 이미지 인용을
                            # 판정했으나, 실제 DOM을 직접 열어 확인한 결과 그 영역의 이미지는
                            # 전부 16x16 원형 "블로거 프로필 아바타"였음(거의 모든 소스에 항상 존재
                            # — 의미 있는 신호 아님). 실제 콘텐츠 썸네일은 완전히 별도 영역인
                            # fds-multimedia-container(252x168, <a href>로 개별 글에 연결)에 있고,
                            # 같은 글이 텍스트 소스 목록과 이미지 목록 양쪽에 동시에 나올 수 있어
                            # 서로 배타적이지 않음(naeo.kr "텍스트 N / 이미지 M"이 합이 총량과
                            # 안 맞던 이유와 일치) — 별도 영역·별도 판정으로 분리.
                            try:
                                image_urls = await el.evaluate("""el => {
                                    const media_area = el.querySelector(
                                        'div[class*="fds-multimedia-container"]'
                                    );
                                    if (!media_area) return [];
                                    const seen = new Set();
                                    const links = [];
                                    media_area.querySelectorAll('a[href]').forEach(a => {
                                        const url = a.href;
                                        if (!seen.has(url)) {
                                            seen.add(url);
                                            links.push(url);
                                        }
                                    });
                                    return links;
                                }""")
                                for _iu in (image_urls or []):
                                    _im = re.search(r'blog\.naver\.com/([^/]+)/', _iu)
                                    if _im:
                                        source_image_map[_im.group(1)] = True
                            except Exception as _ie:
                                logger.debug(f"[naver_scanner] image_urls extraction failed — {_ie}")
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
            note_proxy_result(e)

        return {
            "platform":        "naver",
            "mentioned":       mentioned or in_briefing,
            "in_briefing":     in_briefing,
            "rank":            rank,
            "excerpt":         excerpt,
            "_query_used":     query,
            "in_ai_tab":       in_ai_tab,
            "ai_tab_excerpt":  ai_tab_excerpt,
            "ad_only":         ad_only,
            "queries_used":    [query],
            "source_urls":     source_urls,
            "source_blog_ids": source_blog_ids,
            "source_image_map": source_image_map,
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
                "queries_used": [], "source_urls": [], "source_blog_ids": [], "source_image_map": {},
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


def extract_my_blog_id(blog_url: str) -> str | None:
    """businesses.blog_url(네이버 블로그)에서 blog_id만 추출. routers/scan.py·scheduler/jobs.py
    3개 호출부가 동일 로직을 각자 구현하던 것을 2026-07-18 재점검 중 하나로 통합."""
    if not blog_url:
        return None
    m = re.search(r'blog\.naver\.com/([^/?]+)', blog_url)
    return m.group(1) if m else None


def compute_naver_mention_format(my_blog_id: str | None, kw_r: dict) -> str | None:
    """내 블로그가 이번 검색결과의 텍스트 소스 목록(source_blog_ids)·이미지 소스 목록
    (source_image_map)에 각각 실제로 있었는지로 인용 형식을 판정.

    2026-07-18 실측 DOM 검증 발견: 두 목록은 서로 다른 DOM 영역(텍스트=
    fds-aib-multi-source-scroll-area, 이미지=fds-multimedia-container)이라
    상호배타적이지 않음 — 같은 글이 양쪽에 동시 인용될 수 있어 text_and_image 반환 가능.
    둘 다 아니면 None(업종명은 언급됐어도 내 블로그가 실제 소스가 아닌 경우 포함).
    """
    texted = bool(my_blog_id and my_blog_id in (kw_r.get("source_blog_ids") or []))
    imaged = bool(my_blog_id and kw_r.get("source_image_map", {}).get(my_blog_id))
    if texted and imaged:
        return "text_and_image"
    if imaged:
        return "image"
    if texted:
        return "text"
    return None
