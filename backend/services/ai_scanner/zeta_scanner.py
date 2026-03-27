"""
뤼튼(wrtn.ai) AI 검색 노출 확인 — Playwright DOM 파싱
한국 MAU 402만 명, 사용시간 ChatGPT의 2배 (2026.02 기준)
"""
import asyncio
import logging
from playwright.async_api import async_playwright

logger = logging.getLogger("aeolab")


class ZetaScanner:
    """wrtn.ai (뤼튼) 기반 AI 언급 확인"""

    async def check_mention(self, query: str, target: str) -> dict:
        """wrtn.ai에서 검색 후 대상 사업장 언급 여부 확인"""
        try:
            return await asyncio.wait_for(
                self._run(query, target), timeout=45
            )
        except asyncio.TimeoutError:
            logger.warning(f"ZetaScanner timeout: {query}")
            return {"platform": "zeta", "mentioned": False, "error": "timeout"}
        except Exception as e:
            logger.error(f"ZetaScanner error: {e}")
            return {"platform": "zeta", "mentioned": False, "error": str(e)}

    async def _run(self, query: str, target: str) -> dict:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
            )
            ctx = await browser.new_context(
                viewport={"width": 1280, "height": 900},
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
                await page.goto("https://wrtn.ai", timeout=30000)
                await page.wait_for_timeout(2000)

                # 채팅 입력창 찾기
                selectors = [
                    "textarea[placeholder]",
                    "textarea",
                    "input[type='text']",
                    "[contenteditable='true']",
                ]
                input_el = None
                for sel in selectors:
                    try:
                        el = page.locator(sel).first
                        if await el.is_visible(timeout=3000):
                            input_el = el
                            break
                    except Exception:
                        continue

                if not input_el:
                    return {"platform": "zeta", "mentioned": False, "error": "input_not_found"}

                await input_el.fill(query)
                await page.keyboard.press("Enter")
                await page.wait_for_timeout(8000)  # AI 응답 대기

                # 응답 텍스트 수집
                response_selectors = [
                    ".message-content",
                    ".chat-message",
                    "[data-testid='message']",
                    ".prose",
                    "article",
                ]
                response_text = ""
                for sel in response_selectors:
                    try:
                        els = page.locator(sel)
                        count = await els.count()
                        if count > 0:
                            last = els.nth(count - 1)
                            response_text = await last.inner_text()
                            if response_text:
                                break
                    except Exception:
                        continue

                if not response_text:
                    # fallback: 전체 페이지 텍스트
                    response_text = await page.inner_text("body")

                mentioned = target.lower() in response_text.lower()
                excerpt = ""
                if mentioned:
                    idx = response_text.lower().find(target.lower())
                    excerpt = response_text[max(0, idx - 50): idx + 100].strip()

                return {
                    "platform": "zeta",
                    "mentioned": mentioned,
                    "excerpt": excerpt if mentioned else "",
                    "response_length": len(response_text),
                }

            finally:
                await browser.close()
