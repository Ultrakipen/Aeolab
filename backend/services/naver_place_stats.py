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

# RAM 보호: multi_scanner의 PLAYWRIGHT_SEMAPHORE(1)를 공유 — 동시 Playwright 최대 1개 보장
# GitHub Actions 등 multi_scanner import 불가 환경에서는 독립 Semaphore(1) fallback 사용
def _get_playwright_sem():
    """순환 import 방지를 위한 lazy import 패턴. ImportError 시 독립 세마포어 fallback."""
    try:
        from services.ai_scanner.multi_scanner import PLAYWRIGHT_SEMAPHORE
        return PLAYWRIGHT_SEMAPHORE
    except Exception:
        # GitHub Actions 환경 (google-generativeai 등 미설치) — 자체 Semaphore 사용
        if not hasattr(_get_playwright_sem, "_fallback"):
            import asyncio
            _get_playwright_sem._fallback = asyncio.Semaphore(1)
        return _get_playwright_sem._fallback


class NaverPlaceStatsService:
    async def fetch_stats(self, naver_place_id: str) -> dict:
        """네이버 플레이스 공개 페이지에서 기본 통계 파싱"""
        if not naver_place_id:
            return {"error": "naver_place_id required"}
        from services.ai_scanner import check_naver_playwright_quota as _check_naver_quota
        if not _check_naver_quota("naver_place_stats.fetch_stats"):
            return {"error": "quota_exceeded", "naver_place_id": naver_place_id}
        try:
            async with _get_playwright_sem():
                return await asyncio.wait_for(self._run(naver_place_id), timeout=30)
        except asyncio.TimeoutError:
            logger.warning(f"NaverPlaceStats timeout: {naver_place_id}")
            return {"error": "timeout", "naver_place_id": naver_place_id}
        except Exception as e:
            logger.error(f"NaverPlaceStats error: {e}")
            from services.ai_scanner import note_proxy_result
            note_proxy_result(e)
            return {"error": str(e), "naver_place_id": naver_place_id}

    async def _run(self, naver_place_id: str) -> dict:
        from services.ai_scanner import apply_stealth as _as, get_proxy_config as _gpc, get_random_ua as _gua2, block_heavy_resources as _bhr, attach_bandwidth_counter as _abc
        from services.ai_scanner.bandwidth_tracker import record_usage_mb as _rum
        url = f"https://map.naver.com/p/entry/place/{naver_place_id}"
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox"],
                proxy=_gpc(),
            )
            ctx = await browser.new_context(
                locale="ko-KR",
                timezone_id="Asia/Seoul",
                user_agent=_gua2(),
            )
            await ctx.route("**/*", _bhr)
            _bw_counter = _abc(ctx)
            page = await ctx.new_page()
            await _as(page)
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

                # 방문자 리뷰 수 파싱 — 다양한 네이버 플레이스 UI 포맷 지원
                visitor_review_count = 0
                _review_patterns = [
                    r"방문자\s*리뷰\s*(\d[\d,]*)",          # "방문자 리뷰 16"
                    r"방문자리뷰\s*(\d[\d,]*)",              # 공백 없는 변형
                    r"리뷰\s*(\d[\d,]+)\s*개",              # "리뷰 16개"
                    r"(\d[\d,]+)\s*개\s*리뷰",              # "16개 리뷰"
                    r'"visitorReviewCount"\s*:\s*(\d+)',    # JSON 내장 포맷
                    r'"reviewCount"\s*:\s*(\d+)',           # JSON 내장 포맷 변형
                    r"방문자\s+(\d[\d,]+)",                  # "방문자 16"
                    r"리뷰(\d[\d,]+)",                       # 리뷰 탭 상단 "리뷰42"(공백 없음) — 클렌징 후 실제 노출 수, 최우선 신뢰
                    r"리뷰[ \t]+(\d[\d,]*)",                # "장소대여리뷰 22"(업종 카테고리 접두, 공백) — 클렌징 전 집계라 부정확할 수 있음, 최후 폴백
                ]
                for _pat in _review_patterns:
                    _m = re.search(_pat, body_text)
                    if _m:
                        visitor_review_count = int(_m.group(1).replace(",", ""))
                        break

                # 데스크탑 아이프레임에서 미감지 시 모바일 URL로 재시도
                if visitor_review_count == 0:
                    try:
                        mobile_url = f"https://m.place.naver.com/place/{naver_place_id}/home"
                        await page.goto(mobile_url, timeout=12000, wait_until="domcontentloaded")
                        await page.wait_for_timeout(2000)
                        mobile_body = await page.inner_text("body")
                        for _pat in _review_patterns:
                            _m = re.search(_pat, mobile_body)
                            if _m:
                                visitor_review_count = int(_m.group(1).replace(",", ""))
                                break
                        logger.info(f"[place_stats] mobile fallback review_count={visitor_review_count} for {naver_place_id}")
                    except Exception as _e:
                        logger.warning("review mobile fallback failed [%s]: %s", naver_place_id, _e)

                # pcmap.place.naver.com 리뷰 탭 직접 접근으로 항상 재확인·덮어씀(0이어도 실행).
                # 2026-07-14 실측: 위 tier들이 잡는 "카테고리...리뷰 NN"(공백, 홈 탭)은 네이버
                # 리뷰 클렌징 시스템 적용 전 집계라 실제보다 큼(사용자 실측: 91 vs 42). 리뷰 탭
                # (pcmap.place.naver.com/place/{id}/review/visitor, competitor_place_crawler.py와
                # 동일 경로) 상단의 "리뷰NN"(공백없음)이 클렌징 후 진짜 노출 수라 항상 우선함.
                # 이 tier가 못 찾으면(리뷰 0건 등) 위에서 찾은 값을 그대로 유지.
                try:
                    pcmap_url = f"https://pcmap.place.naver.com/place/{naver_place_id}/review/visitor"
                    await page.goto(pcmap_url, timeout=15000, wait_until="domcontentloaded")
                    await page.wait_for_timeout(5000)
                    pcmap_body = await page.inner_text("body")
                    _pcmap_match = re.search(r"리뷰(\d[\d,]+)", pcmap_body)
                    if _pcmap_match:
                        visitor_review_count = int(_pcmap_match.group(1).replace(",", ""))
                    logger.info(f"[place_stats] pcmap review-tab review_count={visitor_review_count} for {naver_place_id}")
                except Exception as _e:
                    logger.warning("review pcmap fallback failed [%s]: %s", naver_place_id, _e)

                # 영수증 리뷰 수 파싱
                receipt_review_count = 0
                receipt_match = re.search(r"영수증\s*리뷰\s*(\d[\d,]*)", body_text)
                if receipt_match:
                    receipt_review_count = int(receipt_match.group(1).replace(",", ""))

                # 별점 파싱 — 1차: body_text 텍스트 / 2차: HTML JSON VisitorReviewStats
                # 네이버는 2021.10 방문자 별점 기능 종료 → 대부분 0. 0이면 None 반환(DB 기존값 유지).
                avg_rating = 0.0
                rating_patterns = [
                    r"별점\s*(\d+(?:\.\d{1,2})?)",      # "별점 4" / "별점 4.5"
                    r"평점\s*(\d+(?:\.\d{1,2})?)",       # "평점 4.5"
                    r"★\s*(\d+(?:\.\d{1,2})?)",         # "★ 4.5"
                    r"(\d+(?:\.\d{1,2})?)\s*/\s*5",     # "4.5 / 5"
                ]
                for pat in rating_patterns:
                    _m = re.search(pat, body_text)
                    if _m:
                        val = float(_m.group(1))
                        if 0.0 < val <= 5.0:
                            avg_rating = val
                            break

                # 2차: HTML 내장 JSON에서 VisitorReviewStats.avgRating 파싱
                if avg_rating == 0.0:
                    try:
                        _html = await page.content()
                        _m_json = re.search(
                            r'"VisitorReviewStats"[^}]{0,200}"avgRating"\s*:\s*([\d.]+)', _html
                        )
                        if _m_json:
                            val = float(_m_json.group(1))
                            if 0.0 < val <= 5.0:
                                avg_rating = val
                    except Exception as e:
                        logger.debug("[naver_place_stats] avg_rating JSON parse failed: %s", e)

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
                    "avg_rating": avg_rating if avg_rating > 0 else None,
                    "source": "naver_place_public",
                }
            finally:
                await browser.close()
                await _rum(_bw_counter[0] / 1024 / 1024)


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

    from services.ai_scanner import check_naver_playwright_quota as _check_naver_quota
    if not _check_naver_quota("naver_place_stats.check_smart_place_completeness"):
        return {**default, "error": "quota_exceeded"}

    try:
        async with _get_playwright_sem():
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

    from services.ai_scanner import apply_stealth as _as2, get_proxy_config as _gpc2, get_random_ua as _gua, block_heavy_resources as _bhr2, attach_bandwidth_counter as _abc2
    from services.ai_scanner.bandwidth_tracker import record_usage_mb as _rum2
    _TAB_TIMEOUT = 12000   # 탭당 타임아웃 (ms)
    _TAB_WAIT   = 4000     # 탭당 JS 렌더 대기 (ms)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
            proxy=_gpc2(),
        )
        ctx = await browser.new_context(
            locale="ko-KR",
            timezone_id="Asia/Seoul",
            user_agent=_gua(),
            viewport={"width": 412, "height": 915},
        )
        await ctx.route("**/*", _bhr2)
        _bw_counter2 = _abc2(ctx)
        page = await ctx.new_page()
        await _as2(page)
        _NAVER_BLOCK = "플레이스 서비스 이용이 제한"
        try:
            # ── 1단계: 홈 탭 — 사진·메뉴·is_smart_place ─────────────────
            home_url = f"{base_url}/home" if base_url else url
            await page.goto(home_url, timeout=_TAB_TIMEOUT, wait_until="domcontentloaded")
            await page.wait_for_timeout(_TAB_WAIT)
            body = await page.inner_text("body")
            logger.info(f"[sp_check] home body_len={len(body)} sample={body[:300]!r}")
            _home_blocked = _NAVER_BLOCK in body
            if _home_blocked:
                logger.warning(f"[sp_check] home tab blocked (IP restriction) [{base_url}]")

            # 사진 수 — 텍스트 패턴("사진 N") 우선
            # img.count() 폴백은 제거 — 내비게이션 아이콘 등 무관한 이미지까지 카운트해 오류 발생
            photo_count: int | None = None
            photo_match = re.search(r"사진\s*(\d[\d,]*)", body)
            if photo_match:
                try:
                    _pc = int(photo_match.group(1).replace(",", ""))
                    if _pc > 0:
                        photo_count = _pc
                except ValueError:
                    pass

            # 예약 연동 여부 — 홈 탭 텍스트·DOM 기반
            # 홈 탭 차단 시 None(측정 불가) — 차단을 "미연동"으로 오판하지 않도록 has_recent_post/has_intro와 동일 패턴 적용
            has_reservation: bool | None
            if _home_blocked:
                has_reservation = None
            else:
                has_reservation = bool(re.search(r"네이버\s*예약|예약하기", body))
                if not has_reservation:
                    try:
                        for _sel in ["a[href*='/booking']", "button[aria-label*='예약']", ".booking_btn", "a[data-type='reservation']"]:
                            if await page.query_selector(_sel):
                                has_reservation = True
                                break
                    except Exception as e:
                        logger.debug("[naver_place_stats] reservation selector check failed: %s", e)

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

            # ── 2단계: 소식 탭 — 최근 90일 내 게시물 ───────────────────────
            has_recent_post: bool | None = None  # None = 측정 불가(차단)
            recent_post_date = None
            if base_url:
                try:
                    await page.goto(f"{base_url}/feed", timeout=_TAB_TIMEOUT, wait_until="domcontentloaded")
                    await page.wait_for_timeout(_TAB_WAIT)
                    feed_body = await page.inner_text("body")
                    if _NAVER_BLOCK in feed_body:
                        logger.warning(f"[sp_check] feed tab blocked (IP restriction) [{base_url}]")
                    else:
                        has_recent_post, recent_post_date = _detect_recent_post_stats(feed_body)
                except Exception as e:
                    logger.warning(f"check_completeness feed tab skipped: {e}")
            else:
                has_recent_post, recent_post_date = _detect_recent_post_stats(body)

            # ── 3단계: 정보 탭 — 소개글·영업시간·FAQ ────────────────────
            has_intro: bool | None = None  # None = 측정 불가(차단)
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
                    if _NAVER_BLOCK in info_body:
                        logger.warning(f"[sp_check] info tab blocked (IP restriction) [{base_url}]")
                    else:
                        # 정보 탭이 너무 짧으면 /info 경로 재시도
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
                        logger.info(f"[sp_check] info results: intro={has_intro}({intro_char_count}자) hours={has_hours}")
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
                photo_categories, photo_tab_total = await _parse_photo_categories(page)
                if photo_tab_total is None:
                    # 사진 탭 네트워크 오류 — 측정 불가, 홈 텍스트 추정값도 0이면 None 유지
                    if not photo_count:
                        photo_count = None
                    logger.warning(f"[sp_check] photo tab unavailable, photo_count={photo_count}")
                elif photo_tab_total > 0:
                    photo_count = photo_tab_total
                    logger.info(f"[sp_check] photo_count updated from tab total: {photo_count}")
            except Exception as e:
                logger.warning(f"_parse_photo_categories call failed: {e}")

            _pc_for_score = photo_count or 0  # None → 0 (점수 계산용)
            _has_rp = bool(has_recent_post)   # None(차단) = False
            _has_intro = bool(has_intro)       # None(차단) = False
            score = sum([
                0,                            # has_faq 25점 → 0 (Q&A 탭 폐기, score_engine과 일치)
                _has_rp * 25,                 # 소식 15→25점 재배분 (score_engine v4.1 일치)
                _has_intro * 20,
                min(_pc_for_score, 5) * 2,
                has_menu * 15,
                has_hours * 5,
            ])

            return {
                "has_faq": has_faq,
                "faq_count": faq_count,
                "has_recent_post": _has_rp,            # bool (차단 시 False)
                "recent_post_measured": has_recent_post is not None,  # 실제 측정 여부
                "recent_post_date": recent_post_date,
                "has_intro": _has_intro,               # bool (차단 시 False)
                "intro_measured": has_intro is not None,              # 실제 측정 여부
                "intro_char_count": intro_char_count,
                "photo_count": photo_count,
                "has_menu": has_menu,
                "has_hours": has_hours,
                "has_reservation": has_reservation,     # None=측정 불가(홈 탭 차단), bool=실측
                "completeness_score": min(score, 100),
                "photo_categories": photo_categories,  # AI 이미지 필터 카테고리별 사진 수 (실패 시 {})
            }
        finally:
            try:
                await ctx.close()
            except Exception as e:
                logger.warning("ctx.close() failed [%s]: %s", url, e)
            try:
                await browser.close()
            except Exception as e:
                logger.warning("browser.close() failed [%s]: %s", url, e)
            await _rum2(_bw_counter2[0] / 1024 / 1024)


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



async def _parse_photo_categories(page) -> tuple[dict, int | None]:
    """
    네이버 플레이스 사진탭에서 AI 이미지 필터 카테고리 파싱.
    이미 열려 있는 page 객체를 재활용 (별도 Playwright 인스턴스 생성 금지).

    Returns:
        (카테고리별 사진 수 dict, 전체 사진 수 int | None)
        None: 사진 탭 네트워크 오류 등 측정 불가 (0과 구분 — UI에서 "스캔 후 확인" 표시)
        전체 사진 수 = "전체" 버튼 숫자 우선, 없으면 카테고리 합계, 없으면 텍스트 패턴 사용.
    """
    try:
        # URL 직접 이동 방식 (클릭보다 안정적 — 네이버 탭 버튼 셀렉터 변경에 무관)
        cur = page.url
        m_url = re.match(r"(https?://m\.place\.naver\.com/[^/]+/\d+)", cur)
        if m_url:
            await page.goto(f"{m_url.group(1)}/photo", timeout=12000, wait_until="domcontentloaded")
            await page.wait_for_timeout(5000)  # 3000 → 5000ms: 사진 API JS 렌더 대기
        else:
            # URL 추출 실패 시 기존 클릭 방식 fallback
            photo_tab = page.locator('a[data-tab="photo"], button:has-text("사진"), a:has-text("사진")')
            if await photo_tab.count() > 0:
                await photo_tab.first.click()
                await page.wait_for_timeout(3000)

        result = {}
        total_from_btn = 0  # "전체" 버튼에 표시된 총 사진 수
        total_from_text = 0  # 페이지 텍스트에서 추출한 총 사진 수 (필터 버튼 실패 대비)

        # 텍스트 기반 total fallback — 필터 버튼 파싱 전에 미리 추출
        # 네트워크 오류 감지: 사진 탭이 서버 차단/오류 시 None 반환 (잘못된 숫자 방지)
        try:
            page_text = await page.inner_text("body")
            if re.search(r"네트워크 오류|Failed to fetch|일시적인.*오류|플레이스 서비스 이용이 제한", page_text or ""):
                logger.warning("[photo_tab] network error or IP block detected — photo_count=None")
                return {}, None
            # 사진 탭 JS 콘텐츠 미로딩 감지 — body가 너무 짧거나 "로딩중" 상태 (headless 감지)
            if len(page_text or "") < 200 or (page_text and "로딩중" in page_text and len(page_text) < 300):
                logger.warning("[photo_tab] photo tab not rendered (loading state) — photo_count=None")
                return {}, None
            m_text = re.search(r"전체\s*([\d,]+)", page_text)
            if m_text:
                total_from_text = int(m_text.group(1).replace(",", ""))
        except Exception as e:
            logger.debug("[naver_place_stats] photo tab text parse failed: %s", e)

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
                    if label in ('전체', 'ALL', '전체보기', '전체 보기'):
                        total_from_btn = num  # 전체 사진 수 따로 저장
                    else:
                        result[label] = num
            except Exception as _btn_e:
                logger.warning(f"_parse_photo_categories btn[{i}] parse failed: {_btn_e}")
                continue

        # 전체 버튼 없는 경우 카테고리 합계 → 텍스트 패턴 순으로 fallback
        total = total_from_btn if total_from_btn > 0 else sum(result.values())
        if total == 0 and total_from_text > 0:
            total = total_from_text

        # pstatic.net img 수 fallback — 필터 버튼·텍스트 패턴 모두 실패한 경우
        if total == 0:
            try:
                img_count = await page.locator("img[src*='pstatic.net']").count()
                if img_count > 0:
                    logger.info(f"[photo_tab] pstatic img fallback: {img_count}장")
                    return result, img_count
            except Exception as _img_e:
                logger.warning(f"[photo_tab] pstatic img fallback failed: {_img_e}")

        return result, total if total > 0 else None
    except Exception as e:
        logger.warning(f"_parse_photo_categories failed: {e}")
        return {}, None


_RECENT_POST_DAYS = 90  # 소식 유효 기간 (30일→90일: 소식 있어도 30일 초과 시 미감지 방지)


def _detect_recent_post_stats(feed_body: str) -> tuple[bool, str | None]:
    """소식 탭에서 최근 90일 게시물 여부와 날짜 반환."""
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
    days = [int(d) for d in re.findall(r"(\d+)\s*일\s*전", feed_body)]
    if days:
        return any(d <= _RECENT_POST_DAYS for d in days), None
    # "N개월 전" — 1개월=30일, 2개월=60일, 3개월=90일 이내 → True
    months = [int(m) for m in re.findall(r"(\d+)\s*개월\s*전", feed_body)]
    if months:
        return any(m * 30 <= _RECENT_POST_DAYS for m in months), None

    today = datetime.now(timezone.utc).date()
    for m in re.finditer(r"(20\d{2})[./\-](\d{1,2})[./\-](\d{1,2})", feed_body):
        try:
            from datetime import datetime as dt
            d = dt(int(m.group(1)), int(m.group(2)), int(m.group(3)), tzinfo=timezone.utc).date()
            if (today - d).days <= _RECENT_POST_DAYS:
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

    from services.ai_scanner import check_naver_playwright_quota as _check_naver_quota
    if not _check_naver_quota("naver_place_stats.get_recent_low_rating_reviews"):
        return []

    try:
        async with _get_playwright_sem():
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

    from services.ai_scanner import apply_stealth as _as3, get_proxy_config as _gpc3, get_random_ua as _gua3, block_heavy_resources as _bhr3, attach_bandwidth_counter as _abc3
    from services.ai_scanner.bandwidth_tracker import record_usage_mb as _rum3
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
            proxy=_gpc3(),
        )
        ctx = await browser.new_context(
            locale="ko-KR",
            timezone_id="Asia/Seoul",
            user_agent=_gua3(),
        )
        await ctx.route("**/*", _bhr3)
        _bw_counter3 = _abc3(ctx)
        page = await ctx.new_page()
        await _as3(page)
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
            except Exception as e:
                logger.warning("review tab click failed [%s]: %s", naver_place_id, e)

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
            await _rum3(_bw_counter3[0] / 1024 / 1024)

    return low_reviews
