"""
네이버 플레이스 통계 연동 서비스 (Playwright DOM 파싱)
네이버 플레이스 업주 페이지에서 조회수·저장수·방문 리뷰 수를 파싱
소상공인 AI 검색 최적화 간접 효과 증명용
"""
import asyncio
import logging
import re
from playwright.async_api import async_playwright, Page

logger = logging.getLogger("aeolab")

# RAM 보호: vCPU2/RAM4GB 환경에서 Playwright 동시 실행 한도 2개
_PLAYWRIGHT_SEM = asyncio.Semaphore(2)


class NaverPlaceStatsService:
    async def fetch_stats(self, naver_place_id: str) -> dict:
        """네이버 플레이스 공개 페이지에서 기본 통계 파싱"""
        if not naver_place_id:
            return {"error": "naver_place_id required"}
        try:
            async with _PLAYWRIGHT_SEM:
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
                await page.wait_for_timeout(4000)

                # pcmap.place.naver.com iframe이 실제 플레이스 데이터를 담고 있음
                frame = None
                for f in page.frames:
                    if "pcmap.place.naver.com" in f.url:
                        frame = f
                        break
                target = frame or page

                body_text = await target.inner_text("body")

                # 방문자 리뷰 수 파싱 — "방문자 리뷰 16" 또는 "리뷰 16개" 형식 지원
                visitor_review_count = 0
                review_match = re.search(r"방문자\s*리뷰\s*(\d[\d,]*)", body_text)
                if review_match:
                    visitor_review_count = int(review_match.group(1).replace(",", ""))
                else:
                    review_match2 = re.search(r"리뷰\s*(\d[\d,]+)\s*개?", body_text)
                    if review_match2:
                        visitor_review_count = int(review_match2.group(1).replace(",", ""))

                # 영수증 리뷰 수 파싱
                receipt_review_count = 0
                receipt_match = re.search(r"영수증\s*리뷰\s*(\d[\d,]*)", body_text)
                if receipt_match:
                    receipt_review_count = int(receipt_match.group(1).replace(",", ""))

                # 별점 파싱 — 소수점 선택 사항, 정수형 평점도 수집
                avg_rating = 0.0
                rating_patterns = [
                    r"별점\s*(\d+(?:\.\d{1,2})?)",          # "별점 4" / "별점 4.5"
                    r"평점\s*(\d+(?:\.\d{1,2})?)",           # "평점 4" / "평점4.5"
                    r"(\d+(?:\.\d{1,2})?)\s*(?:점|★)",      # "4점" / "4.5점" / "4.5★"
                    r"★\s*(\d+(?:\.\d{1,2})?)",             # "★ 4" / "★ 4.5"
                    r"(\d+(?:\.\d{1,2})?)\s*/\s*5",         # "4 / 5" / "4.5 / 5"
                    r"score[:\s]+(\d+(?:\.\d{1,2})?)",      # 영문 "score: 4.5"
                    r"리뷰.{0,50}?(\d+(?:\.\d{1,2})?점)",   # 리뷰 근처 "4.5점"
                ]
                for pat in rating_patterns:
                    m = re.search(pat, body_text)
                    if m:
                        val = float(m.group(1))
                        if 0.0 < val <= 5.0:
                            avg_rating = val
                            break

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

                # review_count는 하위호환용으로 visitor_review_count와 동일하게 유지
                review_count = visitor_review_count

                return {
                    "naver_place_id": naver_place_id,
                    "place_name": (name_el or "").strip(),
                    "review_count": review_count,
                    "visitor_review_count": visitor_review_count,
                    "receipt_review_count": receipt_review_count,
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
        async with _PLAYWRIGHT_SEM:
            return await asyncio.wait_for(_check_completeness(naver_place_url), timeout=43)
    except asyncio.TimeoutError:
        logger.warning(f"check_smart_place_completeness timeout: {naver_place_url}")
        return {**default, "error": "timeout"}
    except Exception as e:
        logger.error(f"check_smart_place_completeness error: {e}")
        return {**default, "error": str(e)}


def _normalize_place_base_url(url: str) -> str | None:
    """네이버 플레이스 URL을 m.place.naver.com 베이스 URL로 정규화.

    지원 포맷:
        https://m.place.naver.com/restaurant/12345/home → https://m.place.naver.com/restaurant/12345
        https://m.place.naver.com/place/12345           → https://m.place.naver.com/place/12345
        https://map.naver.com/p/entry/place/12345       → https://m.place.naver.com/place/12345
        https://place.naver.com/restaurant/12345        → https://m.place.naver.com/place/12345
        https://naver.me/xxxxx                          → None (단축 URL 처리 불가)
    Returns None if URL format is unrecognised.
    """
    # 이미 모바일 URL인 경우
    m = re.match(r"(https?://m\.place\.naver\.com/[^/]+/\d+)", url)
    if m:
        return m.group(1)
    # map.naver.com/p/entry/place/{id} 형식
    m = re.search(r"map\.naver\.com/p/entry/place/(\d+)", url)
    if m:
        # restaurant prefix는 업종 무관하게 라우팅 정상 작동 (실측)
        return f"https://m.place.naver.com/place/{m.group(1)}"
    # place.naver.com/{category}/{id} 형식
    m = re.search(r"place\.naver\.com/[^/]+/(\d+)", url)
    if m:
        return f"https://m.place.naver.com/place/{m.group(1)}"
    return None


async def _check_completeness(url: str) -> dict:
    from datetime import datetime, timedelta

    base_url = _normalize_place_base_url(url)
    logger.info(f"[sp_check] base_url={base_url!r} from url={url!r}")

    _USER_AGENT = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
    _TAB_TIMEOUT = 12000   # 탭당 타임아웃 (ms)
    _TAB_WAIT   = 4000     # 탭당 JS 렌더 대기 (ms)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        )
        ctx = await browser.new_context(
            locale="ko-KR",
            timezone_id="Asia/Seoul",
            user_agent=_USER_AGENT,
            viewport={"width": 412, "height": 915},
        )
        page = await ctx.new_page()
        try:
            # ── 1단계: 홈 탭 — 사진·메뉴·is_smart_place ─────────────────
            home_url = f"{base_url}/home" if base_url else url
            await page.goto(home_url, timeout=_TAB_TIMEOUT, wait_until="domcontentloaded")
            await page.wait_for_timeout(_TAB_WAIT)
            body = await page.inner_text("body")
            logger.info(f"[sp_check] home body_len={len(body)} sample={body[:300]!r}")

            # 사진 수
            photo_count = 0
            try:
                photo_count = await page.locator("img[src*='pstatic.net']").count()
                if photo_count == 0:
                    photo_count = max(0, await page.locator("img").count() - 5)
            except Exception:
                pass
            if photo_count == 0:
                photo_match = re.search(r"사진\s*(\d+)", body)
                photo_count = int(photo_match.group(1)) if photo_match else 0

            # 메뉴·서비스 — 홈탭 또는 메뉴탭에서 감지
            has_menu = bool(
                re.search(r"메뉴|서비스\s*가격|레슨\s*요금|수업\s*요금|강의\s*요금|프로그램\s*안내|가격표|메뉴·서비스", body)
            )
            # 홈 탭에서 못 찾으면 /menu 탭 시도
            if not has_menu and base_url:
                try:
                    await page.goto(f"{base_url}/menu", timeout=_TAB_TIMEOUT, wait_until="domcontentloaded")
                    await page.wait_for_timeout(_TAB_WAIT)
                    menu_body = await page.inner_text("body")
                    logger.info(f"[sp_check] menu body_len={len(menu_body)} sample={menu_body[:200]!r}")
                    no_menu_msg = bool(re.search(r"등록된\s*메뉴|메뉴가\s*없|등록된\s*서비스가\s*없", menu_body))
                    has_menu = len(menu_body) > 200 and not no_menu_msg
                except Exception as e:
                    logger.warning(f"check_completeness menu tab skipped: {e}")

            # ── 2단계: 소식 탭 — 최근 30일 게시물 ───────────────────────
            has_recent_post = False
            recent_post_date = None
            if base_url:
                try:
                    await page.goto(f"{base_url}/feed", timeout=_TAB_TIMEOUT, wait_until="domcontentloaded")
                    await page.wait_for_timeout(_TAB_WAIT)
                    feed_body = await page.inner_text("body")
                    has_recent_post, recent_post_date = _detect_recent_post_stats(feed_body)
                except Exception as e:
                    logger.warning(f"check_completeness feed tab skipped: {e}")
            else:
                has_recent_post, recent_post_date = _detect_recent_post_stats(body)

            # ── 3단계: 정보 탭 — 소개글·영업시간·FAQ ────────────────────
            has_intro = False
            has_hours = False
            has_faq   = False
            faq_count = 0
            intro_char_count = 0
            if base_url:
                try:
                    await page.goto(f"{base_url}/information", timeout=_TAB_TIMEOUT, wait_until="domcontentloaded")
                    await page.wait_for_timeout(_TAB_WAIT)
                    info_body = await page.inner_text("body")
                    logger.info(f"[sp_check] info body_len={len(info_body)} sample={info_body[:400]!r}")
                    # 정보 탭이 제대로 안 로드된 경우 /home 탭과 거의 같은 내용 → /info 재시도
                    if len(info_body) < 200:
                        logger.warning(f"[sp_check] info_body too short ({len(info_body)}), retrying /info")
                        await page.goto(f"{base_url}/info", timeout=_TAB_TIMEOUT, wait_until="domcontentloaded")
                        await page.wait_for_timeout(_TAB_WAIT)
                        info_body = await page.inner_text("body")
                        logger.info(f"[sp_check] /info retry body_len={len(info_body)} sample={info_body[:300]!r}")
                    has_intro, intro_char_count = _detect_intro_stats(info_body)
                    has_hours = _detect_hours_stats(info_body)
                    # [2026-05-01] Q&A 탭 폐기. [2026-05-03] _detect_faq_stats CSS 오탐 위험으로 호출 제거.
                    has_faq, faq_count = False, 0
                    logger.info(f"[sp_check] info results: intro={has_intro}({intro_char_count}자) hours={has_hours} faq={has_faq}({faq_count}개)")
                except Exception as e:
                    logger.warning(f"check_completeness information tab skipped: {e}")
            else:
                has_intro, intro_char_count = _detect_intro_stats(body)
                has_hours = _detect_hours_stats(body)
                has_faq, faq_count = False, 0  # Q&A 탭 폐기 + CSS 오탐 위험으로 감지 중단

            # 영업시간: 네이버 홈 탭에도 요약 표시 → 정보 탭에서 못 찾은 경우 홈 탭 fallback
            if not has_hours:
                has_hours = _detect_hours_stats(body)
                if has_hours:
                    logger.info("[sp_check] hours detected from home tab fallback")

            # ── 4단계: 사진 탭 — AI 이미지 필터 카테고리 파싱 ──────────────
            photo_categories: dict = {}
            try:
                photo_categories = await _parse_photo_categories(page)
            except Exception as e:
                logger.warning(f"_parse_photo_categories call failed: {e}")

            score = sum([
                0,                        # has_faq 25점 → 0 (Q&A 탭 폐기, score_engine과 일치)
                has_recent_post * 25,     # 소식 15→25점 재배분 (score_engine v4.1 일치)
                has_intro * 20,
                min(photo_count, 5) * 2,
                has_menu * 15,
                has_hours * 5,
            ])

            return {
                "has_faq": has_faq,
                "faq_count": faq_count,
                "has_recent_post": has_recent_post,
                "recent_post_date": recent_post_date,
                "has_intro": has_intro,
                "intro_char_count": intro_char_count,
                "photo_count": photo_count,
                "has_menu": has_menu,
                "has_hours": has_hours,
                "completeness_score": min(score, 100),
                "photo_categories": photo_categories,  # AI 이미지 필터 카테고리별 사진 수 (실패 시 {})
            }
        finally:
            try:
                await ctx.close()
            except Exception:
                pass
            try:
                await browser.close()
            except Exception:
                pass


def _detect_intro_stats(info_body: str) -> tuple[bool, int]:
    """정보 탭에서 소개글 존재(50자 이상) 여부와 글자수 반환."""
    if not info_body:
        return False, 0
    m = re.search(r"(업체\s*소개|소개글?|대표\s*소개)[\s\S]{0,1500}", info_body)
    if not m:
        return False, 0
    block = m.group(0)
    cleaned = re.sub(r"(업체\s*소개|소개글?|대표\s*소개)\s*", "", block, count=1)
    cleaned = re.sub(r"\s+", "", cleaned)
    return len(cleaned) >= 50, min(len(cleaned), 500)


def _detect_hours_stats(info_body: str) -> bool:
    """정보 탭에서 영업시간 등록 여부: '영업시간' 섹션 + 시간 표기 패턴."""
    if not info_body:
        return False
    has_section = bool(re.search(r"영업\s*시간|운영\s*시간", info_body))
    if not has_section:
        return False
    # 영업시간 섹션 이후 500자 블록 추출해서 시간 표기 감지
    m = re.search(r"(영업\s*시간|운영\s*시간)[\s\S]{0,500}", info_body)
    block = m.group(0) if m else info_body
    # HH:MM 형식 (09:00, 9:30)
    has_hhmm = bool(re.search(r"\d{1,2}:\d{2}", block))
    # 24시간/연중무휴/상시 운영
    has_24h  = bool(re.search(r"24\s*시간|연중\s*무휴|상시\s*운영|항시\s*운영", block))
    # 한국식 표기: "오전 9시", "오후 10시", "9시 30분", "매일 10시"
    has_kr   = bool(re.search(r"(오전|오후|매일)\s*\d+\s*시|\d+\s*시\s*\d*\s*분?", block))
    # 요일 + 시간 표기: "월 09:00", "화요일 10시" 등
    has_day  = bool(re.search(r"[월화수목금토일][요일]?\s*\d", block))
    return has_hhmm or has_24h or has_kr or has_day



async def _parse_photo_categories(page) -> dict:
    """
    네이버 플레이스 사진탭에서 AI 이미지 필터 카테고리 파싱.
    이미 열려 있는 page 객체를 재활용 (별도 Playwright 인스턴스 생성 금지).
    실패 시 {} 반환 (silent fallback 금지 — warning 로그 남김).
    """
    try:
        # 사진 탭 클릭 시도 (여러 셀렉터 순차 시도)
        photo_tab = page.locator('a[data-tab="photo"], button:has-text("사진"), a:has-text("사진")')
        if await photo_tab.count() > 0:
            await photo_tab.first.click()
            await page.wait_for_timeout(1500)

        result = {}
        # AI 이미지 필터 버튼 셀렉터 (네이버 플레이스 UI 구조 다양성 대응)
        filter_btns = page.locator(
            '.place_photo_filter_item, '
            '[class*="filter"] button, '
            '[class*="photoFilter"], '
            '[class*="photo_filter"]'
        )
        count = await filter_btns.count()
        for i in range(min(count, 15)):
            try:
                btn = filter_btns.nth(i)
                text = (await btn.inner_text()).strip()
                # 숫자 추출 — 예: "음식·음료 12" → ("음식·음료", 12)
                m = re.search(r'^(.+?)\s+(\d+)$', text)
                if m:
                    label = m.group(1).strip()
                    num = int(m.group(2))
                    if label not in ('전체', 'ALL', '전체보기', '전체 보기'):
                        result[label] = num
            except Exception as _btn_e:
                logger.warning(f"_parse_photo_categories btn[{i}] parse failed: {_btn_e}")
                continue

        return result
    except Exception as e:
        logger.warning(f"_parse_photo_categories failed: {e}")
        return {}


def _detect_recent_post_stats(feed_body: str) -> tuple[bool, str | None]:
    """소식 탭에서 최근 30일 게시물 여부와 날짜 반환."""
    from datetime import datetime, timedelta, timezone
    if not feed_body:
        return False, None
    if re.search(r"(등록된\s*소식이\s*없|소식이\s*없|게시물이\s*없)", feed_body):
        return False, None

    # "오늘 영업시간" 같은 영업시간 문구 오탐 방지 — 날짜 상대 표현만 허용
    if re.search(r"(\d+\s*시간\s*전|\d+\s*분\s*전|방금)", feed_body):
        return True, None
    if re.search(r"오늘|어제", feed_body) and not re.search(
        r"오늘\s*(영업|운영|휴무|휴일|오픈|닫|쉬)", feed_body
    ):
        return True, None
    m_day = re.search(r"(\d+)\s*일\s*전", feed_body)
    if m_day:
        try:
            recent = int(m_day.group(1)) <= 30
            return recent, None
        except ValueError:
            pass

    today = datetime.now(timezone.utc).date()
    for m in re.finditer(r"(20\d{2})[./\-](\d{1,2})[./\-](\d{1,2})", feed_body):
        try:
            from datetime import datetime as dt
            d = dt(int(m.group(1)), int(m.group(2)), int(m.group(3)), tzinfo=timezone.utc).date()
            if (today - d).days <= 30:
                date_str = f"{m.group(1)}-{m.group(2).zfill(2)}-{m.group(3).zfill(2)}"
                return True, date_str
        except (ValueError, OverflowError):
            continue

    return False, None


async def sync_naver_place_stats(business_id: str, naver_place_id: str):
    """사업장 네이버 플레이스 통계 조회 후 businesses 테이블 업데이트"""
    from db.supabase_client import get_client
    svc = NaverPlaceStatsService()
    stats = await svc.fetch_stats(naver_place_id)
    if stats.get("error"):
        return stats

    supabase = get_client()
    update_data: dict = {}
    if stats.get("review_count") is not None:
        update_data["review_count"] = stats["review_count"]
    if stats.get("visitor_review_count") is not None:
        update_data["visitor_review_count"] = stats["visitor_review_count"]
    if stats.get("receipt_review_count") is not None:
        update_data["receipt_review_count"] = stats["receipt_review_count"]
    if stats.get("avg_rating") is not None and stats["avg_rating"] > 0:
        update_data["avg_rating"] = stats["avg_rating"]

    if update_data:
        try:
            update_data["is_smart_place"] = True  # 플레이스 ID로 데이터 조회 성공 = 스마트플레이스 등록됨
            supabase.table("businesses").update(update_data).eq("id", business_id).execute()
            logger.info(f"Naver place stats updated for {business_id}: {update_data}")
        except Exception as e:
            # is_smart_place 컬럼 없을 경우 fallback: review_count/avg_rating만 업데이트
            if "is_smart_place" in str(e):
                logger.warning(f"is_smart_place column missing, updating without it: {e}")
                fallback = {k: v for k, v in update_data.items() if k != "is_smart_place"}
                if fallback:
                    supabase.table("businesses").update(fallback).eq("id", business_id).execute()
                    logger.info(f"Fallback update done for {business_id}: {fallback}")
            else:
                raise

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
