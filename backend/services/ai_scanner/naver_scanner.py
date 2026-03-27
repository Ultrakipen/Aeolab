from playwright.async_api import async_playwright
import logging

logger = logging.getLogger("aeolab")

# 선택자 fallback 배열 (네이버 DOM 변경 대응)
BRIEFING_SELECTORS = [".ai_answer", ".cai_cont", "[class*='ai_brief']"]
PLACE_SELECTORS = [".place_bluelink", ".cpc_place_title"]


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
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
            )
            page = await ctx.new_page()

            mentioned = False
            in_briefing = False
            excerpt = ""
            rank = None

            try:
                url = f"https://search.naver.com/search.naver?query={query}"
                await page.goto(url, wait_until="networkidle", timeout=30000)
                await page.wait_for_timeout(2000)  # AI 브리핑 로딩 대기

                # AI 브리핑 영역에서 사업장명 검색
                for sel in BRIEFING_SELECTORS:
                    try:
                        el = await page.query_selector(sel)
                        if el:
                            text = await el.inner_text()
                            if target in text:
                                in_briefing = True
                                lines = [l for l in text.split("\n") if target in l]
                                excerpt = lines[0][:100] if lines else ""
                            break
                    except Exception:
                        continue

                # 플레이스 검색 결과에서 순위 파악
                for sel in PLACE_SELECTORS:
                    try:
                        items = await page.query_selector_all(sel)
                        for i, item in enumerate(items[:10]):
                            name = await item.inner_text()
                            if target in name:
                                mentioned = True
                                rank = i + 1
                                break
                        if mentioned:
                            break
                    except Exception:
                        continue

            except Exception as e:
                logger.warning(f"NaverAIBriefingScanner error: {e}")
            finally:
                await browser.close()

        return {
            "platform": "naver",
            "mentioned": mentioned or in_briefing,
            "in_briefing": in_briefing,
            "rank": rank,
            "excerpt": excerpt,
        }
