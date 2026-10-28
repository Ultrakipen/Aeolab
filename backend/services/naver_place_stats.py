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



def _exact_count(patterns: list, text: str):
    """패턴 순서대로 첫 '정확한' 개수를 돌려준다(없으면 None).

    숫자 바로 뒤가 '만'이거나 '.숫자만'인 축약 표기("리뷰 1만", "리뷰 1.2만")는 정확한 값이 아니므로 건너뛴다.
    이전에는 마지막 보조 패턴("리뷰" 뒤 공백+숫자)이 "리뷰 1만"에서 1만 읽어(2026-10-26 로그
    mobile fallback review_count=1), 1만 건이 넘는 유명한 가게가 리뷰 1건으로 저장·점수 반영될 수 있었다.
    """
    for pat in patterns:
        for m in re.finditer(pat, text):
            rest = text[m.end(1): m.end(1) + 8]
            if re.match(r"\s*(?:\.\d+)?\s*만", rest):
                continue
            try:
                return int(m.group(1).replace(",", ""))
            except ValueError:
                continue
    return None


class NaverPlaceStatsService:
    async def fetch_stats(self, naver_place_id: str) -> dict:
        """네이버 플레이스 공개 페이지에서 기본 통계 파싱"""
        if not naver_place_id:
            return {"error": "naver_place_id required"}
        # 차단 중에는 네이버 요청 없이 즉시 건너뛴다(차단 연장 방지, services/naver_access_guard.py)
        from services.naver_access_guard import begin_place_access, place_pace
        _ok, _why = begin_place_access("naver_place_stats.fetch_stats")
        if not _ok:
            return {"error": _why, "naver_place_id": naver_place_id}
        from services.ai_scanner import check_naver_playwright_quota as _check_naver_quota
        if not _check_naver_quota("naver_place_stats.fetch_stats", cost=2):  # 데스크톱 + 모바일 재시도 최대 2페이지
            return {"error": "quota_exceeded", "naver_place_id": naver_place_id}
        from services.naver_access_guard import reserve_place_pages
        _rok, _rwhy, _ = await reserve_place_pages(2, "naver_place_stats.fetch_stats")
        if not _rok:
            return {"error": _rwhy, "naver_place_id": naver_place_id}
        try:
            async with _get_playwright_sem():
                await place_pace()
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
                proxy=_gpc("place"),
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

                # 차단 화면이면 통계를 파싱하지 않고 자동 중단 회로를 연다(2026-10-27) — 이전엔 차단 화면을 정상 내용으로 읽었다
                from services.naver_block import is_naver_block_page
                from services.naver_access_guard import report_place_block, report_place_ok
                if is_naver_block_page(body_text):
                    report_place_block("naver_place_stats.fetch_stats")
                    return {"error": "naver_blocked", "naver_place_id": naver_place_id}
                report_place_ok()

                # 방문자 리뷰 수 파싱 — 다양한 네이버 플레이스 UI 포맷 지원
                visitor_review_count = None  # None = 정확한 수를 읽지 못함(측정 못 함). 0과 구분해 기존 값을 덮어쓰지 않는다
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
                visitor_review_count = _exact_count(_review_patterns, body_text)

                # 데스크탑 아이프레임에서 미감지 시 모바일 URL로 재시도
                if visitor_review_count is None:
                    try:
                        mobile_url = f"https://m.place.naver.com/place/{naver_place_id}/home"
                        await page.goto(mobile_url, timeout=12000, wait_until="domcontentloaded")
                        await page.wait_for_timeout(2000)
                        mobile_body = await page.inner_text("body")
                        visitor_review_count = _exact_count(_review_patterns, mobile_body)
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
                    _pcmap_exact = _exact_count([r"리뷰(\d[\d,]+)"], pcmap_body)
                    if _pcmap_exact is not None:
                        visitor_review_count = _pcmap_exact
                    logger.info(f"[place_stats] pcmap review-tab review_count={visitor_review_count} for {naver_place_id}")
                except Exception as _e:
                    logger.warning("review pcmap fallback failed [%s]: %s", naver_place_id, _e)

                # 영수증 리뷰 수 파싱
                receipt_review_count = _exact_count([r"영수증\s*리뷰\s*(\d[\d,]*)"], body_text)

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

    # 차단 중에는 네이버 요청 없이 즉시 건너뛴다(차단 연장 방지, services/naver_access_guard.py)
    from services.naver_access_guard import begin_place_access, place_pace
    _ok, _why = begin_place_access("naver_place_stats.check_smart_place_completeness")
    if not _ok:
        return {**default, "error": _why}

    from services.ai_scanner import check_naver_playwright_quota as _check_naver_quota
    # 홈·메뉴·소식·정보(+사진 탭이 켜져 있으면 사진) 탭을 연다 — 페이지 수만큼 센다(기존엔 호출 1번=1건으로 과소 집계)
    from services.place_page_signals import photo_tab_enabled as _photo_on
    if not _check_naver_quota("naver_place_stats.check_smart_place_completeness", cost=(5 if _photo_on() else 4)):
        return {**default, "error": "quota_exceeded"}

    # 속도 기준(슬라이딩 윈도우) — 빈 자리가 날 때까지 기다린다. 세마포어를 잡기 전에 해야 다른 작업을 막지 않는다.
    from services.naver_access_guard import reserve_place_pages
    _rok, _rwhy, _ = await reserve_place_pages((5 if _photo_on() else 4), "naver_place_stats.check_smart_place_completeness")
    if not _rok:
        return {**default, "error": _rwhy}

    try:
        async with _get_playwright_sem():
            await place_pace()
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
    import random as _random
    # 탭당 JS 렌더 대기 (ms) — 기본 4초에 0~1.5초 무작위를 더해 간격을 일정하게 두지 않는다(2026-10-27, 렌더 대기는 줄이지 않음)
    _TAB_WAIT   = 4000 + _random.randint(0, 1500)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
            proxy=_gpc2("place"),
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
        from services.naver_block import is_naver_block_page  # 줄바꿈으로 나뉜 현재 차단 화면도 감지 (2026-10-27)
        try:
            # ── 1단계: 홈 탭 — 사진·메뉴·is_smart_place ─────────────────
            home_url = f"{base_url}/home" if base_url else url
            await page.goto(home_url, timeout=_TAB_TIMEOUT, wait_until="domcontentloaded")
            await page.wait_for_timeout(_TAB_WAIT)
            body = await page.inner_text("body")
            logger.info(f"[sp_check] home body_len={len(body)} sample={body[:300]!r}")
            _home_blocked = is_naver_block_page(body)
            from services.naver_access_guard import report_place_block, report_place_ok
            if _home_blocked:
                logger.warning(f"[sp_check] home tab blocked (IP restriction) [{base_url}]")
                report_place_block("naver_place_stats.check_completeness.home")  # 이후 플레이스 접속 자동 중단
            else:
                report_place_ok()  # 정상 화면 — 시험 접속이었다면 회복 확인

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

            # 메뉴·서비스 — 홈 화면의 단독 줄 근거(메뉴 탭·메뉴N 섹션·가격표)로만 판정한다.
            # 2026-10-27: 기존엔 본문 어디든 "메뉴"가 있으면 통과라 메뉴 탭이 없는 사진관도 "등록됨"이었다.
            # 근거를 못 찾았다고 "없음"으로 단정하지 않는다(업종별 라벨 차이) — 찾으면 True, 못 찾으면 None(확인 안 됨).
            from services.place_page_signals import detect_menu_evidence, detect_menu_tab_content
            has_menu: bool | None = True if detect_menu_evidence(body) else None
            # 홈에서 근거가 없으면 /menu 탭을 본다 — 메뉴 탭이 없는 가게는 /menu가 홈으로 이동하므로 주소를 확인한다
            if has_menu is None and base_url:
                try:
                    await page.goto(f"{base_url}/menu", timeout=_TAB_TIMEOUT, wait_until="domcontentloaded")
                    await page.wait_for_timeout(_TAB_WAIT)
                    menu_body = await page.inner_text("body")
                    logger.info(f"[sp_check] menu body_len={len(menu_body)} sample={menu_body[:200]!r}")
                    if "/menu" in page.url and not is_naver_block_page(menu_body):
                        has_menu = detect_menu_tab_content(menu_body)
                except Exception as e:
                    logger.warning(f"check_completeness menu tab skipped: {e}")

            # ── 2단계: 소식 탭 — 최근 90일 내 게시물 ───────────────────────
            has_recent_post: bool | None = None  # None = 측정 불가(차단·로딩 미완료·구조 변경)
            recent_post_date = None
            recent_post_state: str | None = None  # recent/old/none/no_tab/unmeasured (feed_post_parser)
            if base_url:
                try:
                    from services.feed_post_parser import analyze_feed_posts, to_has_recent_post
                    await page.goto(f"{base_url}/feed", timeout=_TAB_TIMEOUT, wait_until="domcontentloaded")
                    await page.wait_for_timeout(_TAB_WAIT)
                    feed_body = await page.inner_text("body")
                    if is_naver_block_page(feed_body):
                        logger.warning(f"[sp_check] feed tab blocked (IP restriction) [{base_url}]")
                        report_place_block("naver_place_stats.check_completeness.feed")
                    else:
                        # 게시 시각은 단독 줄만 읽는다(글 본문 문장 속 "소식이 없어"·"1시간 전부터" 오판 방지, 2026-10-27)
                        _fa = analyze_feed_posts(feed_body, page.url)
                        has_recent_post = to_has_recent_post(_fa)
                        recent_post_date = _fa.get("latest_date")
                        recent_post_state = _fa.get("state")
                except Exception as e:
                    logger.warning(f"check_completeness feed tab skipped: {e}")
            # base_url이 없으면 소식 탭에 접근하지 못한 것이므로 홈 본문으로 추정하지 않고 측정 불가로 둔다

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
                    if is_naver_block_page(info_body):
                        logger.warning(f"[sp_check] info tab blocked (IP restriction) [{base_url}]")
                        report_place_block("naver_place_stats.check_completeness.info")
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
            # 2026-10-27: 사진 탭은 서버 헤드리스에서 렌더링되지 않아 전 가게 photo_count=None이었다(6월부터).
            # 얻는 것 없이 페이지만 여는 호출이라 기본으로 열지 않는다(PLACE_PHOTO_TAB_ENABLED=true로 다시 켠다).
            # 끄면 기존 실패 경로와 같은 결과(측정 불가 None)를 낸다 — 미측정을 0으로 세지 않는다.
            from services.place_page_signals import photo_tab_enabled
            if photo_tab_enabled():
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
            elif not photo_count:
                photo_count = None

            _pc_for_score = photo_count or 0  # None → 0 (점수 계산용)
            _has_rp = bool(has_recent_post)   # None(차단) = False
            _has_intro = bool(has_intro)       # None(차단) = False
            _has_menu = bool(has_menu)         # None(확인 안 됨) = False — 표시는 menu_measured로 구분
            score = sum([
                0,                            # has_faq 25점 → 0 (Q&A 탭 폐기, score_engine과 일치)
                _has_rp * 25,                 # 소식 15→25점 재배분 (score_engine v4.1 일치)
                _has_intro * 20,
                min(_pc_for_score, 5) * 2,
                _has_menu * 15,
                has_hours * 5,
            ])

            return {
                "has_faq": has_faq,
                "faq_count": faq_count,
                "has_recent_post": _has_rp,            # bool (차단 시 False)
                "recent_post_measured": has_recent_post is not None,  # 실제 측정 여부
                "recent_post_date": recent_post_date,
                "recent_post_state": recent_post_state,  # no_tab = 소식 탭 자체가 없는 가게
                "has_intro": _has_intro,               # bool (차단 시 False)
                "intro_measured": has_intro is not None,              # 실제 측정 여부
                "intro_char_count": intro_char_count,
                "photo_count": photo_count,
                "has_menu": _has_menu,                  # bool (근거 없으면 False)
                "menu_measured": has_menu is not None,  # False = 근거를 못 찾아 확인 안 됨("없음"이 아님)
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
            from services.naver_block import is_naver_block_page
            _photo_blocked = is_naver_block_page(page_text)
            if _photo_blocked:
                from services.naver_access_guard import report_place_block
                report_place_block("naver_place_stats.photo_tab")
            if re.search(r"네트워크 오류|Failed to fetch|일시적인.*오류", page_text or "") or _photo_blocked:
                logger.warning("[photo_tab] network error or IP block detected — photo_count=None")
                return {}, None
            # 사진 탭 JS 콘텐츠 미로딩 감지 — body가 너무 짧거나 "로딩중" 상태 (headless 감지)
            if len(page_text or "") < 200 or (page_text and "로딩중" in page_text and len(page_text) < 300):
                logger.warning("[photo_tab] photo tab not rendered (loading state) — photo_count=None")
                return {}, None
            # 쉼표만 있어도 매칭돼 int('') 오류가 나던 정규식 수정(2026-10-27) — 숫자로 시작하는 경우만
            from services.place_page_signals import parse_count
            total_from_text = parse_count(re.search(r"전체\s*(\d[\d,]*)", page_text)) or 0
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


def _detect_recent_post_stats(feed_body: str, page_url: str | None = None) -> tuple[bool | None, str | None]:
    """소식 탭에서 최근 90일 게시물 여부와 최신 게시일 반환 — 하위 호환 래퍼.

    판정은 services/feed_post_parser.py가 한다(게시 시각을 단독 줄에서만 읽음). 측정 불가면 (None, None).
    2026-10-27: 본문 전체 정규식이 글 속 문장을 "소식 없음"/"N시간 전"으로 오판하던 문제 수정.
    """
    from services.feed_post_parser import analyze_feed_posts, to_has_recent_post
    a = analyze_feed_posts(feed_body, page_url)
    return to_has_recent_post(a), a.get("latest_date")


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


def parse_low_rating_reviews(
    body: str, naver_place_id: str, min_rating: int, max_reviews: int
) -> tuple[int, list[dict]]:
    """플레이스 리뷰 탭 본문 텍스트에서 별점 min_rating 이하 리뷰를 뽑는다. (별점 표식 수, 낮은 별점 리뷰 목록) 반환.

    2026-10-28 실측(어니언 성수, 리뷰 2,283건): 별점은 "별점" / "5" / "점" 세 줄로 따로 렌더링된다. 이전 정규식 3종은 같은 줄의
    "5점"을 전제해 실제 화면에서 한 번도 일치하지 않았고(별점 알림 누적 0건), 테스트 픽스처가 실제에 없는 형식이라 가려졌다.
    리뷰 블록 = [작성자, "리뷰 N사진 N팔로워 N", "팔로우", "별점", 점수, "점", 방문 정보, 본문…]. 본문은 블록에서 가장 긴 줄로 잡는다.
    review_id는 순번이 아니라 (플레이스, 작성자, 본문) 해시다 — 순번이면 한 번 알림이 나간 뒤 새 낮은 별점 리뷰도 같은 ID로 걸러진다.
    """
    import hashlib

    lines = [ln.strip() for ln in (body or "").split("\n")]
    marks = [
        i for i in range(len(lines) - 2)
        if lines[i] == "별점" and re.fullmatch(r"[1-5]", lines[i + 1]) and lines[i + 2] == "점"
    ]
    out: list[dict] = []
    seen: set[str] = set()
    for k, i in enumerate(marks):
        rating = int(lines[i + 1])
        if rating > min_rating:
            continue
        end = (marks[k + 1] - 3) if k + 1 < len(marks) else len(lines)
        block = [ln for ln in lines[i + 3:max(i + 3, end)] if ln and ln not in ("더보기", "팔로우")]
        # "점" 다음 첫 줄은 방문 정보("점심에 방문예약 없이 이용대기 시간 바로 입장나들이친구")다 — 본문이 짧은 리뷰에서는 이 줄이
        # 가장 길어 인용문으로 잡히므로(2026-10-28 실측) 본문 후보에서 뺀다. 줄이 하나뿐이면 그대로 쓴다.
        if len(block) >= 2:
            block = block[1:]
        excerpt = max(block, key=len)[:200] if block else ""
        author = lines[i - 3] if i >= 3 else ""
        rid = hashlib.md5(f"{naver_place_id}|{author}|{excerpt}".encode("utf-8")).hexdigest()[:16]
        if rid in seen:
            continue
        seen.add(rid)
        out.append({"rating": rating, "excerpt": excerpt, "review_id": f"{naver_place_id}_{rid}"})
        if len(out) >= max_reviews:
            break
    return len(marks), out


async def check_low_rating_reviews_for(
    naver_place_id: str, min_rating: int = 2, max_reviews: int = 10
) -> dict:
    """낮은 별점 리뷰 조회 — **조회했는지**를 함께 돌려준다.

    Returns: {"checked": bool, "reviews": [...], "markers": int, "reason": str | None}
      checked=False 는 "낮은 별점 리뷰가 없다"가 아니라 "확인하지 못했다"(회로·상한·속도 기준에 막힘, 차단 화면, 시간 초과, 오류)이다.
      reason: no_place_id / cooldown / quota / rate / blocked / timeout / error. cooldown·quota·rate·blocked 는 같은 실행의 나머지
      사업장도 막히므로 호출한 쪽이 실행을 멈추는 기준으로 쓴다.
      markers 는 화면에서 읽은 별점 표식 수 — 조회는 됐는데 0이면 리뷰가 없거나 화면 구조가 바뀐 것이다.
    """
    def _res(checked: bool, reason=None, reviews=None, markers=0) -> dict:
        return {"checked": checked, "reviews": reviews or [], "markers": markers, "reason": reason}

    if not naver_place_id:
        return _res(False, "no_place_id")

    # 플레이스 회로 차단기·속도 기준 — 다른 플레이스 진입점과 같은 방식. 2026-10-28 점검에서 이 함수만 빠져 있어
    # 쿨다운 중에도 접속하던 것을 발견(함수 단위 감사). 차단 중에는 네이버 요청 없이 건너뛴다.
    from services.naver_access_guard import begin_place_access, place_pace, reserve_place_pages
    _ok, _why = begin_place_access("naver_place_stats.get_recent_low_rating_reviews")
    if not _ok:
        return _res(False, "cooldown")

    from services.ai_scanner import check_naver_playwright_quota as _check_naver_quota
    # 가게 페이지를 열고 리뷰 탭까지 누르므로 2페이지로 센다
    if not _check_naver_quota("naver_place_stats.get_recent_low_rating_reviews", cost=2):
        return _res(False, "quota")
    _rok, _rwhy, _ = await reserve_place_pages(2, "naver_place_stats.get_recent_low_rating_reviews")
    if not _rok:
        return _res(False, "rate")

    try:
        async with _get_playwright_sem():
            await place_pace()
            return await asyncio.wait_for(
                _fetch_low_rating_reviews(naver_place_id, min_rating, max_reviews),
                timeout=35,
            )
    except asyncio.TimeoutError:
        logger.warning(f"get_recent_low_rating_reviews timeout: {naver_place_id}")
        return _res(False, "timeout")
    except Exception as e:
        logger.warning(f"get_recent_low_rating_reviews error: {e}")
        return _res(False, "error")


async def get_recent_low_rating_reviews(
    naver_place_id: str, min_rating: int = 2, max_reviews: int = 10
) -> list[dict]:
    """네이버 플레이스 최근 리뷰 중 별점 min_rating 이하 리뷰 목록 반환(확인 못 한 경우도 빈 목록).

    확인 여부가 필요하면 check_low_rating_reviews_for 를 쓴다.
    Returns:
        [{rating: int, excerpt: str, review_id: str}, ...]
    """
    return (await check_low_rating_reviews_for(naver_place_id, min_rating, max_reviews))["reviews"]


async def _fetch_low_rating_reviews(
    naver_place_id: str, min_rating: int, max_reviews: int
) -> dict:
    """Playwright로 네이버 플레이스 리뷰 탭 파싱 — 별점 min_rating 이하만 반환(check_low_rating_reviews_for 와 같은 dict)."""
    url = f"https://map.naver.com/p/entry/place/{naver_place_id}"

    from services.ai_scanner import apply_stealth as _as3, get_proxy_config as _gpc3, get_random_ua as _gua3, block_heavy_resources as _bhr3, attach_bandwidth_counter as _abc3
    from services.ai_scanner.bandwidth_tracker import record_usage_mb as _rum3
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
            proxy=_gpc3("place"),
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

            # 리뷰 탭의 기본 정렬은 "추천순"이다(2026-10-28 실측: 날짜가 10.2·10.14·10.11·9.8로 뒤섞임). "최근에 달린" 낮은 별점
            # 리뷰를 찾으려면 "최신순"을 눌러야 한다(클릭 후 10.14·10.11·10.2·10.1…로 내림차순 확인). 같은 페이지 안의 클릭이라 추가 로드는 없다.
            sorted_latest = False
            try:
                sort_el = target.get_by_text("최신순", exact=True).first
                if await sort_el.is_visible(timeout=2000):
                    await sort_el.click()
                    await page.wait_for_timeout(2500)
                    sorted_latest = True
            except Exception as e:
                logger.warning("[low_rating] 최신순 정렬 클릭 실패 [%s]: %s", naver_place_id, e)

            # body 텍스트에서 별점+내용 파싱 (정규식 기반)
            body = await target.inner_text("body")

            # 차단 화면은 "낮은 별점 리뷰 없음"이 아니다 — 회로에 보고하고 빈 결과로 끝낸다(알림 판단 불가)
            from services.naver_block import is_naver_block_page
            from services.naver_access_guard import report_place_block, report_place_ok
            if is_naver_block_page(body):
                report_place_block("naver_place_stats.get_recent_low_rating_reviews")
                return {"checked": False, "reviews": [], "markers": 0, "reason": "blocked"}
            report_place_ok()

            markers, low_reviews = parse_low_rating_reviews(body, naver_place_id, min_rating, max_reviews)
            if markers == 0:
                # 리뷰가 아직 없는 가게일 수도, 화면 구조가 바뀐 것일 수도 있다 — 조용히 넘기지 않고 남긴다(호출한 쪽이 집계).
                logger.warning("[low_rating] 별점 표식 0건 — 리뷰 없는 가게이거나 화면 구조 변경 (place=%s, 본문 %d자)", naver_place_id, len(body or ""))
            elif not sorted_latest:
                # 리뷰는 읽었지만 추천순일 수 있다 — 최신 리뷰가 안 보이므로 "새 낮은 별점 없음"으로 판단하면 안 된다
                logger.warning("[low_rating] 최신순을 확인하지 못해 결과를 쓰지 않음 (place=%s)", naver_place_id)
                return {"checked": False, "reviews": [], "markers": markers, "reason": "sort"}
            return {"checked": True, "reviews": low_reviews, "markers": markers, "reason": None}

        finally:
            await browser.close()
            await _rum3(_bw_counter3[0] / 1024 / 1024)
