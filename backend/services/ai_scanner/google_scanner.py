from playwright.async_api import async_playwright
import logging
import re
import os
import aiohttp
import base64

logger = logging.getLogger("aeolab")

GOOGLE_SCANNER_BACKEND = os.getenv("GOOGLE_SCANNER_BACKEND", "playwright")
DATAFORSEO_LOGIN = os.getenv("DATAFORSEO_LOGIN", "")
DATAFORSEO_PASSWORD = os.getenv("DATAFORSEO_PASSWORD", "")

logger.info("[google_scanner] backend=%s", GOOGLE_SCANNER_BACKEND)

AI_OVERVIEW_SELECTORS = [
    "[data-attrid='wa:/description']",
    ".kp-blk",
    "[class*='ai_overview']",
    ".IZ6rdc",
    "[class*='SGWvJb']",
]


def _name_in_text(business_name: str, text: str) -> bool:
    """공백·특수문자 제거 후 사업장명 부분매칭."""
    if not business_name or not text:
        return False
    normalized_name = re.sub(r"[\s\W]", "", business_name).lower()
    normalized_text = re.sub(r"[\s\W]", "", text).lower()
    return normalized_name in normalized_text


async def _scan_via_dataforseo(query: str, business_name: str) -> dict:
    """DataForSEO SERP API로 Google AI Overview 확인 ($0.002/건)."""
    if not DATAFORSEO_LOGIN or not DATAFORSEO_PASSWORD:
        logger.warning("[google_scanner] dataforseo credentials missing — fallback to 0점")
        return {
            "platform": "google", "mentioned": False, "in_ai_overview": False,
            "rank": None, "excerpt": "", "captcha_detected": False,
            "error": "dataforseo_credentials_missing",
        }

    creds = base64.b64encode(f"{DATAFORSEO_LOGIN}:{DATAFORSEO_PASSWORD}".encode()).decode()
    url = "https://api.dataforseo.com/v3/serp/google/organic/live/advanced"
    payload = [{
        "keyword": query,
        "location_code": 2410,   # 대한민국
        "language_code": "ko",
        "device": "desktop",
        "os": "windows",
        "depth": 10,
    }]

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                url,
                headers={
                    "Authorization": f"Basic {creds}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=aiohttp.ClientTimeout(total=30),
            ) as resp:
                data = await resp.json()

        # AI Overview 항목 파싱
        items = (data.get("tasks") or [{}])[0].get("result") or []
        in_ai_overview = False
        excerpt = ""
        rank = None
        mentioned = False

        for result in items:
            for item in (result.get("items") or []):
                item_type = item.get("type", "")
                # AI Overview / featured snippet 타입 확인
                if item_type in ("featured_snippet", "answer_box", "knowledge_graph"):
                    text = item.get("description") or item.get("text") or ""
                    if _name_in_text(business_name, text):
                        in_ai_overview = True
                        mentioned = True
                        excerpt = text[:200]
                        break
                # 일반 유기 결과에서 순위 파악
                if item_type == "organic" and rank is None:
                    item_title = item.get("title") or ""
                    if _name_in_text(business_name, item_title):
                        mentioned = True
                        rank = item.get("rank_absolute")

        return {
            "platform": "google",
            "mentioned": mentioned,
            "in_ai_overview": in_ai_overview,
            "rank": rank,
            "excerpt": excerpt,
            "captcha_detected": False,
        }
    except Exception as e:
        logger.warning(f"[google_scanner] dataforseo error: {e}")
        return {
            "platform": "google", "mentioned": False, "in_ai_overview": False,
            "rank": None, "excerpt": "", "captcha_detected": False, "error": str(e),
        }


class GoogleAIOverviewScanner:
    """Google AI Overview (SGE)에서 사업장 노출 여부 파싱"""

    async def check_mention(self, query: str, target: str) -> dict:
        if GOOGLE_SCANNER_BACKEND == "dataforseo":
            return await _scan_via_dataforseo(query, target)
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

                # ── CAPTCHA / 차단 감지 ─────────────────────────────────
                current_url = page.url
                page_title = await page.title()
                body_head = ""
                try:
                    body_head = (await page.inner_text("body") or "")[:500]
                except Exception:
                    pass
                if (
                    any(kw in current_url for kw in ["captcha", "sorry", "recaptcha"]) or
                    any(kw in page_title.lower() for kw in ["captcha", "unusual traffic"]) or
                    bool(re.search(r"unusual traffic|automated queries|보안문자|로봇이 아님", body_head, re.IGNORECASE))
                ):
                    logger.warning(f"[google_scanner] captcha/block detected for query: {query}")
                    return {
                        "platform": "google", "mentioned": False, "in_ai_overview": False,
                        "rank": None, "excerpt": "", "captcha_detected": True, "error": "captcha_blocked",
                    }

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
                    except Exception as _e:
                        logger.debug(f"[google_scanner] ai_overview selector failed — {_e}")
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
                except Exception as _e:
                    logger.warning(f"[google_scanner] h3 ranking check failed — {_e}")

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
            "captcha_detected": False,
        }
