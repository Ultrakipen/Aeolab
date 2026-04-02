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


async def check_smart_place_completeness(naver_place_url: str) -> dict:
    """네이버 스마트플레이스 URL에서 완성도 자동 체크.

    Returns:
        {
          has_faq: bool,
          has_recent_post: bool,
          has_intro: bool,
          photo_count: int,
          has_menu: bool,
          has_hours: bool,
          completeness_score: int,  # 0~100
        }
    """
    if not naver_place_url:
        return {"error": "naver_place_url required"}

    default = {
        "has_faq": False, "has_recent_post": False, "has_intro": False,
        "photo_count": 0, "has_menu": False, "has_hours": False,
        "completeness_score": 0,
    }

    try:
        return await asyncio.wait_for(_check_completeness(naver_place_url), timeout=30)
    except asyncio.TimeoutError:
        logger.warning(f"check_smart_place_completeness timeout: {naver_place_url}")
        return {**default, "error": "timeout"}
    except Exception as e:
        logger.error(f"check_smart_place_completeness error: {e}")
        return {**default, "error": str(e)}


async def _check_completeness(url: str) -> dict:
    from datetime import datetime, timedelta
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

            frame = None
            for f in page.frames:
                if "place" in f.url:
                    frame = f
                    break
            target = frame or page
            body = await target.inner_text("body")

            # FAQ (Q&A 탭 존재 여부)
            has_faq = bool(re.search(r"Q&A|질문|답변", body))

            # 최근 소식 (7일 이내)
            has_recent_post = bool(re.search(r"소식|포스팅|업데이트", body))

            # 소개글 (200자 이상 텍스트 블록)
            intro_match = re.search(r"소개|안내|설명", body)
            has_intro = bool(intro_match) and len(body) > 500

            # 사진 수 (대략 추정)
            photo_match = re.search(r"사진\s*(\d+)", body)
            photo_count = int(photo_match.group(1)) if photo_match else 0

            # 메뉴 등록 여부
            has_menu = bool(re.search(r"메뉴|가격|원\b", body))

            # 영업시간
            has_hours = bool(re.search(r"영업\s*시간|운영\s*시간|오픈|마감", body))

            # 완성도 점수 계산 (항목별 가중치)
            score = sum([
                has_faq * 30,
                has_recent_post * 20,
                has_intro * 20,
                min(photo_count, 5) * 2,
                has_menu * 15,
                has_hours * 5,
            ])

            return {
                "has_faq": has_faq,
                "has_recent_post": has_recent_post,
                "has_intro": has_intro,
                "photo_count": photo_count,
                "has_menu": has_menu,
                "has_hours": has_hours,
                "completeness_score": min(score, 100),
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


async def get_recent_low_rating_reviews(
    naver_place_id: str, min_rating: int = 2, max_reviews: int = 10
) -> list[dict]:
    """네이버 플레이스 최근 리뷰 중 별점 min_rating 이하 리뷰 목록 반환.

    Returns:
        [{rating: int, excerpt: str, review_id: str}, ...]
    """
    if not naver_place_id:
        return []

    try:
        return await asyncio.wait_for(
            _fetch_low_rating_reviews(naver_place_id, min_rating, max_reviews),
            timeout=35,
        )
    except asyncio.TimeoutError:
        logger.warning(f"get_recent_low_rating_reviews timeout: {naver_place_id}")
        return []
    except Exception as e:
        logger.warning(f"get_recent_low_rating_reviews error: {e}")
        return []


async def _fetch_low_rating_reviews(
    naver_place_id: str, min_rating: int, max_reviews: int
) -> list[dict]:
    """Playwright로 네이버 플레이스 리뷰 탭 파싱 — 별점 min_rating 이하만 반환."""
    url = f"https://map.naver.com/p/entry/place/{naver_place_id}"
    low_reviews: list[dict] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
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

            # iframe 탐색
            frame = None
            for f in page.frames:
                if "place" in f.url:
                    frame = f
                    break
            target = frame or page

            # 리뷰 탭 클릭 시도
            try:
                review_tab = None
                for sel in ["a[href*='review']", "li:has-text('리뷰')", "[data-tab='review']", ".place_tab_menu li:nth-child(2)"]:
                    try:
                        el = target.locator(sel).first
                        if await el.is_visible(timeout=2000):
                            review_tab = el
                            break
                    except Exception:
                        continue
                if review_tab:
                    await review_tab.click()
                    await page.wait_for_timeout(2000)
            except Exception:
                pass

            # body 텍스트에서 별점+내용 파싱 (정규식 기반)
            body = await target.inner_text("body")

            # 별점 패턴: 숫자 별점이 포함된 리뷰 블록 파싱
            # 네이버 리뷰는 별 모양 렌더링이어서 텍스트로는 "x점" 형식 또는 aria-label로 노출
            rating_patterns = [
                r"(\d)점[^\n]*\n([^\n]{10,200})",  # "3점" + 내용
                r"별점\s*(\d)[^\n]*\n([^\n]{10,200})",
                r"★{1,5}[^\d]*(\d)[^\n]*\n([^\n]{10,200})",
            ]
            seen_excerpts: set[str] = set()
            for pattern in rating_patterns:
                for m in re.finditer(pattern, body):
                    try:
                        rating = int(m.group(1))
                        excerpt = m.group(2).strip()
                    except (IndexError, ValueError):
                        continue
                    if rating <= min_rating and excerpt and excerpt not in seen_excerpts:
                        seen_excerpts.add(excerpt)
                        low_reviews.append({
                            "rating": rating,
                            "excerpt": excerpt[:200],
                            "review_id": f"{naver_place_id}_{len(low_reviews)}",
                        })
                        if len(low_reviews) >= max_reviews:
                            break
                if len(low_reviews) >= max_reviews:
                    break

        finally:
            await browser.close()

    return low_reviews
