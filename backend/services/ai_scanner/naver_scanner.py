from playwright.async_api import async_playwright
import logging

logger = logging.getLogger("aeolab")

# AI 브리핑 셀렉터 (네이버 DOM 변경 대응 — 우선순위 순)
BRIEFING_SELECTORS = [
    ".ai_answer",
    ".cai_cont",
    "[class*='ai_brief']",
    "[class*='ai_answer']",
    "[class*='cai_']",
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

            mentioned    = False
            in_briefing  = False
            excerpt      = ""
            rank         = None
            page_text    = ""

            try:
                url = f"https://search.naver.com/search.naver?query={query}"
                await page.goto(url, wait_until="networkidle", timeout=30000)
                await page.wait_for_timeout(3000)  # AI 브리핑 로딩 대기 (2→3초)

                # 전체 페이지 텍스트 — 셀렉터 실패 시 fallback
                try:
                    page_text = await page.inner_text("body") or ""
                except Exception:
                    page_text = ""

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
                logger.warning(f"NaverAIBriefingScanner error for '{query}': {e}")
            finally:
                await browser.close()

        return {
            "platform":    "naver",
            "mentioned":   mentioned or in_briefing,
            "in_briefing": in_briefing,
            "rank":        rank,
            "excerpt":     excerpt,
        }
