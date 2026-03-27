"""
네이버 플레이스 통계 연동 서비스 (Playwright DOM 파싱)
네이버 플레이스 업주 페이지에서 조회수·저장수·방문 리뷰 수를 파싱
소상공인 AI 검색 최적화 간접 효과 증명용
"""
import asyncio
import logging
import re
from playwright.async_api import async_playwright

logger = logging.getLogger("aeolab")


class NaverPlaceStatsService:
    async def fetch_stats(self, naver_place_id: str) -> dict:
        """네이버 플레이스 공개 페이지에서 기본 통계 파싱"""
        if not naver_place_id:
            return {"error": "naver_place_id required"}
        try:
            return await asyncio.wait_for(self._run(naver_place_id), timeout=30)
        except asyncio.TimeoutError:
            logger.warning(f"NaverPlaceStats timeout: {naver_place_id}")
            return {"error": "timeout", "naver_place_id": naver_place_id}
        except Exception as e:
            logger.error(f"NaverPlaceStats error: {e}")
            return {"error": str(e), "naver_place_id": naver_place_id}

    async def _run(self, naver_place_id: str) -> dict:
        url = f"https://map.naver.com/p/entry/place/{naver_place_id}"
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox"],
            )
            ctx = await browser.new_context(
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
                await page.goto(url, timeout=20000, wait_until="domcontentloaded")
                await page.wait_for_timeout(3000)

                # iframe 내부 접근 시도
                frame = None
                for f in page.frames:
                    if "place" in f.url:
                        frame = f
                        break
                target = frame or page

                body_text = await target.inner_text("body")

                # 리뷰 수 파싱
                review_match = re.search(r"리뷰\s*[\s\S]*?(\d[\d,]+)\s*개", body_text)
                review_count = int(review_match.group(1).replace(",", "")) if review_match else 0

                # 별점 파싱
                rating_match = re.search(r"(\d\.\d{1,2})\s*(?:점|★)", body_text)
                avg_rating = float(rating_match.group(1)) if rating_match else 0.0

                # 사업장명 파싱
                name_el = None
                for sel in ["h1", ".place_name", "[data-testid='place-name']"]:
                    try:
                        el = target.locator(sel).first
                        if await el.is_visible(timeout=2000):
                            name_el = await el.inner_text()
                            break
                    except Exception:
                        continue

                return {
                    "naver_place_id": naver_place_id,
                    "place_name": (name_el or "").strip(),
                    "review_count": review_count,
                    "avg_rating": avg_rating,
                    "source": "naver_place_public",
                }
            finally:
                await browser.close()


async def sync_naver_place_stats(business_id: str, naver_place_id: str):
    """사업장 네이버 플레이스 통계 조회 후 businesses 테이블 업데이트"""
    from db.supabase_client import get_client
    svc = NaverPlaceStatsService()
    stats = await svc.fetch_stats(naver_place_id)
    if stats.get("error"):
        return stats

    supabase = get_client()
    update_data: dict = {}
    if stats.get("review_count"):
        update_data["review_count"] = stats["review_count"]
    if stats.get("avg_rating"):
        update_data["avg_rating"] = stats["avg_rating"]

    if update_data:
        supabase.table("businesses").update(update_data).eq("id", business_id).execute()
        logger.info(f"Naver place stats updated for {business_id}: {update_data}")

    return stats
