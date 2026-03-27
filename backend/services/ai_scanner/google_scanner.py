from playwright.async_api import async_playwright
import logging

logger = logging.getLogger("aeolab")

AI_OVERVIEW_SELECTORS = [
    "[data-attrid='wa:/description']",
    ".kp-blk",
    "[class*='ai_overview']",
    ".IZ6rdc",
    "[class*='SGWvJb']",
]


class GoogleAIOverviewScanner:
    """Google AI Overview (SGE)에서 사업장 노출 여부 파싱"""

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
            in_ai_overview = False
            excerpt = ""
            rank = None

            try:
                url = f"https://www.google.com/search?q={query}&hl=ko&gl=KR"
                await page.goto(url, wait_until="networkidle", timeout=30000)
                await page.wait_for_timeout(2000)

                # AI Overview 영역 검색
                for sel in AI_OVERVIEW_SELECTORS:
                    try:
                        el = await page.query_selector(sel)
                        if el:
                            text = await el.inner_text()
                            if target in text:
                                in_ai_overview = True
                                lines = [l for l in text.split("\n") if target in l]
                                excerpt = lines[0][:100] if lines else ""
                            break
                    except Exception:
                        continue

                # 일반 검색 결과에서 순위 파악
                try:
                    items = await page.query_selector_all("h3")
                    for i, item in enumerate(items[:10]):
                        name = await item.inner_text()
                        if target in name:
                            mentioned = True
                            rank = i + 1
                            break
                except Exception:
                    pass

            except Exception as e:
                logger.warning(f"GoogleAIOverviewScanner error: {e}")
            finally:
                await browser.close()

        return {
            "platform": "google",
            "mentioned": mentioned or in_ai_overview,
            "in_ai_overview": in_ai_overview,
            "rank": rank,
            "excerpt": excerpt,
        }
