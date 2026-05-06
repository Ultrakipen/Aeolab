"""
경쟁사 네이버 플레이스 데이터 크롤러
naver_place_stats.py 패턴 참고 — 경쟁사용 추가 필드(has_faq, has_recent_post, has_menu) 포함
Playwright 인스턴스는 순차 실행 (asyncio.Semaphore(1)) — RAM 보호
"""
import asyncio
import logging
import os
import re
from datetime import datetime, timezone
from typing import Optional

import aiohttp
from playwright.async_api import async_playwright

_logger = logging.getLogger(__name__)

# Playwright 동시 실행 제한: 1개 (RAM 300~500MB/인스턴스, iwinv 4GB RAM 보호)
_PLAYWRIGHT_SEM = asyncio.Semaphore(1)

_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


async def fetch_competitor_place_data(naver_place_id: str) -> dict:
    """
    네이버 플레이스 공개 페이지에서 경쟁사 데이터 크롤링.

    Returns:
        {
            review_count: int,
            avg_rating: float,
            has_faq: bool,
            has_recent_post: bool,
            has_menu: bool,
            photo_count: int,
            place_name: str,
            naver_place_id: str,
            error: str | None
        }
    """
    if not naver_place_id:
        return {"error": "naver_place_id required"}

    default = {
        "naver_place_id": naver_place_id,
        "place_name": "",
        "review_count": 0,
        "avg_rating": 0.0,
        "has_faq": False,
        "has_recent_post": False,
        "has_menu": False,
        "has_intro": False,
        "photo_count": 0,
        "error": None,
    }

    try:
        async with _PLAYWRIGHT_SEM:
            return await asyncio.wait_for(_run_place_crawl(naver_place_id), timeout=30)
    except asyncio.TimeoutError:
        _logger.warning(f"competitor_place_crawler timeout: {naver_place_id}")
        return {**default, "error": "timeout"}
    except Exception as e:
        _logger.warning(f"competitor_place_crawler error [{naver_place_id}]: {e}")
        return {**default, "error": str(e)}


async def _run_place_crawl(naver_place_id: str) -> dict:
    """
    pcmap.place.naver.com 직접 접근으로 경쟁사 플레이스 데이터 크롤링.

    실측 기반 파싱 패턴 (2026-04 검증):
    - 리뷰 수: "블로그 리뷰 8" 또는 "리뷰8" 형식 (방문자 리뷰 → 블로그 리뷰로 UI 변경됨)
    - has_recent_post: 소식 탭 body 길이로 실제 포스팅 존재 여부 판단
    - has_menu: "대표 메뉴" 섹션 존재 여부 (리뷰 텍스트 내 "메뉴" 단어와 혼동 방지)
    - has_faq: Q&A 탭 링크 존재 여부 (CSS selector)
    - photo_count: 사진 탭 pstatic.net 이미지 수
    """
    base_url = f"https://pcmap.place.naver.com/place/{naver_place_id}"

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        )
        ctx = await browser.new_context(
            locale="ko-KR",
            timezone_id="Asia/Seoul",
            user_agent=_USER_AGENT,
        )
        page = await ctx.new_page()
        try:
            # ── 1단계: 홈 탭 로드 ─────────────────────────────────────
            await page.goto(f"{base_url}/home", timeout=20000, wait_until="domcontentloaded")
            await page.wait_for_timeout(5000)

            body_text = await page.inner_text("body")

            # ── 사업장명 파싱 ─────────────────────────────────────────
            place_name = ""
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]
            # 홈 탭에서 두 번째 비어있지 않은 라인이 업체명 (실측: lines[1] = '글래드스냅')
            if len(lines) >= 2:
                place_name = lines[1]

            # ── 리뷰 수 파싱 ─────────────────────────────────────────
            # 실측: "블로그 리뷰 8" 또는 리뷰 탭에서 "리뷰8" (숫자 붙어있음)
            review_count = 0
            m = re.search(r"블로그\s*리뷰\s*(\d[\d,]*)", body_text)
            if m:
                review_count = int(m.group(1).replace(",", ""))
            else:
                # 리뷰탭에서 "리뷰N" (숫자 바로 붙음) 패턴 시도
                m2 = re.search(r"리뷰(\d[\d,]+)", body_text)
                if m2:
                    review_count = int(m2.group(1).replace(",", ""))

            # ── 별점 파싱 ─────────────────────────────────────────────
            avg_rating = 0.0

            # 1) JS로 DOM에서 직접 추출 (클래스명 변경에 무관)
            try:
                avg_rating = await page.evaluate("""() => {
                    const body = document.body.innerText || '';
                    const pats = [
                        /별점\\s*(\\d\\.\\d{1,2})/,
                        /평점\\s*(\\d\\.\\d{1,2})/,
                        /(\\d\\.\\d{2})\\s*(?:점|★)/,
                        /리뷰\\s*[\\d,]+\\s*\\n?\\s*(\\d\\.\\d{1,2})/,
                        /블로그\\s*리뷰[^\\n]*\\n?[^\\n]*(\\d\\.\\d{2})/,
                        /방문자\\s*리뷰[^\\n]*\\n?[^\\n]*(\\d\\.\\d{2})/,
                        /리뷰\\s*(\\d\\.\\d{2})/,
                        /(\\d\\.\\d{2})\\n방문자/,
                        /(\\d\\.\\d{2})\\n블로그/,
                    ];
                    for (const pat of pats) {
                        const m = body.match(pat);
                        if (m) { const v = parseFloat(m[1]); if (v >= 1.0 && v <= 5.0) return v; }
                    }
                    // fallback: "리뷰" 인근 독립 소수점
                    const lines = body.split('\\n').map(l => l.trim()).filter(Boolean);
                    for (let i = 0; i < lines.length; i++) {
                        if (/리뷰|방문자/.test(lines[i])) {
                            const nearby = lines.slice(Math.max(0, i-5), i+10);
                            for (const l of nearby) {
                                const mm = l.match(/^(\\d\\.\\d{1,2})$/);
                                if (mm) { const v = parseFloat(mm[1]); if (v >= 1.0 && v <= 5.0) return v; }
                            }
                        }
                    }
                    return 0;
                }""") or 0.0
            except Exception:
                pass

            # 2) JS 실패 시 CSS selector 시도 (폴백)
            if avg_rating == 0.0:
                for sel in [
                    "span[class*='rating']", "em[class*='num']", "span[class*='score']",
                    "span[class*='Star']", "em[class*='rating']", "strong[class*='rating']",
                ]:
                    try:
                        el = page.locator(sel).first
                        if await el.is_visible(timeout=1000):
                            txt = (await el.inner_text()).strip()
                            m = re.search(r"(\d+\.\d{1,2})", txt)
                            if m:
                                val = float(m.group(1))
                                if 1.0 <= val <= 5.0:
                                    avg_rating = val
                                    break
                    except Exception:
                        pass

            # 3) 리뷰 탭 이동 후 재시도
            if avg_rating == 0.0:
                try:
                    await page.goto(f"{base_url}/review/visitor", timeout=12000, wait_until="domcontentloaded")
                    await page.wait_for_timeout(2000)
                    review_body = await page.inner_text("body")
                    for pat in [
                        r"별점\s*(\d+\.\d{1,2})",
                        r"(\d+\.\d{1,2})\s*점",
                        r"(\d\.\d{2})",
                    ]:
                        rm = re.search(pat, review_body)
                        if rm:
                            val = float(rm.group(1))
                            if 1.0 <= val <= 5.0:
                                avg_rating = val
                                break
                    await page.goto(f"{base_url}/home", timeout=12000, wait_until="domcontentloaded")
                    await page.wait_for_timeout(2000)
                    body_text = await page.inner_text("body")
                    lines = [l.strip() for l in body_text.split("\n") if l.strip()]
                except Exception:
                    pass

            # ── 탭 목록 확인 (네비게이션 영역 텍스트로 탭 추출) ──────────
            # 실측: 홈/소식/리뷰/사진/정보 순서로 탭 배치
            # 탭 이름들은 lines[10:16] 범위에 주로 위치
            nav_area = "\n".join(lines[8:20]) if len(lines) > 20 else "\n".join(lines)

            # ── FAQ(Q&A) 소개글 섹션 존재 여부 ──────────────────────────
            # [2026-05-01] 사장님 Q&A 탭(/qna) 폐기 — nav_area에서는 더 이상 감지 불가.
            # body_text(소개글 전체)에서 "자주 묻는 질문" 패턴 검출로 대체.
            has_faq = bool(re.search(r"자주\s*묻는\s*질문|Q\s*&\s*A", body_text, re.I))

            # ── 최근 소식 존재 여부 ───────────────────────────────────
            # "소식" 탭이 있더라도 실제 포스팅이 없을 수 있음
            # → 소식 탭으로 이동해 body 길이로 판단 (포스팅 있으면 글 내용으로 길어짐)
            has_recent_post = False
            if "소식" in nav_area:
                try:
                    await page.goto(f"{base_url}/feed", timeout=15000, wait_until="domcontentloaded")
                    await page.wait_for_timeout(3000)
                    feed_text = await page.inner_text("body")
                    # 실제 소식 포스팅이 있으면 body 텍스트가 600자 이상
                    has_recent_post = len(feed_text.strip()) > 600
                except Exception:
                    pass
                # 홈으로 복귀
                try:
                    await page.goto(f"{base_url}/home", timeout=15000, wait_until="domcontentloaded")
                    await page.wait_for_timeout(3000)
                    body_text = await page.inner_text("body")
                except Exception:
                    pass

            # ── 메뉴/가격표/상품 등록 여부 ──────────────────────────────
            # 탐지 전략:
            #   0) CSS selector로 메뉴 탭 링크 직접 확인 (가장 신뢰)
            #   1) nav_area 확장(lines[5:35])에서 "메뉴" 탭 텍스트 확인 후 /menu 이동
            #   2) 홈 body에 "가격표" 키워드 있으면 True (스튜디오 등 비음식 업종)
            #   3) 정보(/info) 탭에서 "가격표" 확인 (홈에 없는 경우 대비)
            has_menu = False

            # 0) CSS selector: 메뉴·상품·가격 탭 링크 (href 패턴)
            try:
                menu_tab = page.locator(
                    "a[href*='/menu'], a[href*='/product'], a[href*='/price']"
                ).first
                if await menu_tab.is_visible(timeout=2000):
                    has_menu = True
            except Exception:
                pass

            # nav_area 범위를 lines[5:35]로 확장 (탭이 8:20 범위 밖에 있는 케이스 대응)
            nav_area_extended = (
                "\n".join(lines[5:35]) if len(lines) > 35 else "\n".join(lines)
            )

            # 1) nav_area_extended에서 "메뉴" 탭 텍스트 확인 후 /menu 이동
            if not has_menu and re.search(r"^메뉴$|^메뉴·?가격$|^메뉴/가격$", nav_area_extended, re.MULTILINE):
                try:
                    await page.goto(f"{base_url}/menu", timeout=15000, wait_until="domcontentloaded")
                    await page.wait_for_timeout(3000)
                    menu_text = await page.inner_text("body")
                    menu_lines = [l.strip() for l in menu_text.split("\n") if l.strip()]
                    has_menu = len(menu_lines) > 20 and len(menu_text.strip()) > 400
                except Exception:
                    pass
                try:
                    await page.goto(f"{base_url}/home", timeout=15000, wait_until="domcontentloaded")
                    await page.wait_for_timeout(2000)
                    body_text = await page.inner_text("body")
                except Exception:
                    pass

            # 기존 nav_area("메뉴" in nav_area)도 fallback으로 유지
            if not has_menu and "메뉴" in nav_area:
                try:
                    await page.goto(f"{base_url}/menu", timeout=15000, wait_until="domcontentloaded")
                    await page.wait_for_timeout(3000)
                    menu_text = await page.inner_text("body")
                    menu_lines = [l.strip() for l in menu_text.split("\n") if l.strip()]
                    has_menu = len(menu_lines) > 20 and len(menu_text.strip()) > 400
                except Exception:
                    pass
                try:
                    await page.goto(f"{base_url}/home", timeout=15000, wait_until="domcontentloaded")
                    await page.wait_for_timeout(2000)
                    body_text = await page.inner_text("body")
                except Exception:
                    pass

            # 2) 홈 body에 "가격표" 직접 등장 (스튜디오/서비스 업종)
            if not has_menu:
                has_menu = bool(re.search(
                    r"가격표|대표\s*메뉴|메뉴·서비스\s*가격표|상품\s*\d+개|메뉴\s*\d+개",
                    body_text
                ))

            # 3) 정보 탭(/information) 항상 방문 — 소개글 감지 (/info는 주소·전화 요약, 실제 소개글은 /information)
            info_text = ""
            try:
                await page.goto(f"{base_url}/information", timeout=15000, wait_until="domcontentloaded")
                await page.wait_for_timeout(4000)
                info_text = await page.inner_text("body")
                if not has_menu:
                    has_menu = bool(re.search(r"가격표|대표\s*메뉴|상품\s*\d+개", info_text))
            except Exception as e:
                _logger.warning("competitor /information fetch failed naver_place_id=%s: %s", naver_place_id, e)

            # ── 사진 수 파싱 ──────────────────────────────────────────
            # 사진 탭으로 이동해 실제 사진 이미지 수 카운트
            photo_count = 0
            try:
                await page.goto(f"{base_url}/photo", timeout=15000, wait_until="domcontentloaded")
                await page.wait_for_timeout(4000)
                # pstatic.net = 네이버 이미지 서버 → 실제 플레이스 사진
                photo_count = await page.locator("img[src*='pstatic.net']").count()
                if photo_count == 0:
                    # fallback: 전체 img 수 - UI 아이콘 추정치 5
                    total_imgs = await page.locator("img").count()
                    photo_count = max(0, total_imgs - 5)
            except Exception:
                pass

            # ── 소개글 등록 여부 ─────────────────────────────────────
            # /information 탭에 "소개" 섹션 + 30자 이상 본문이 있으면 등록된 것으로 판단
            has_intro = False
            if info_text:
                intro_match = re.search(r"소개\s*\n(.+)", info_text)
                if intro_match:
                    has_intro = len(intro_match.group(1).strip()) > 30
                if not has_intro:
                    # fallback: "소개" 키워드 이후 충분한 텍스트가 있는지
                    idx = info_text.find("소개")
                    if idx >= 0:
                        after_intro = info_text[idx+2:idx+500].strip()
                        has_intro = len(after_intro) > 50

            # ── 외부 웹사이트 URL 추출 ───────────────────────────────
            website_url = None
            try:
                # 홈으로 복귀 후 외부 링크 확인
                await page.goto(f"{base_url}/home", timeout=15000, wait_until="domcontentloaded")
                await page.wait_for_timeout(2000)
                ext_link = page.locator("a[href^='http']:not([href*='naver.com']):not([href*='kakao.com']):not([href*='google.com'])").first
                if await ext_link.is_visible(timeout=2000):
                    href = await ext_link.get_attribute("href")
                    if href:
                        website_url = href
            except Exception:
                pass

            return {
                "naver_place_id": naver_place_id,
                "place_name": place_name,
                "review_count": review_count,
                "avg_rating": avg_rating,
                "has_faq": has_faq,
                "has_recent_post": has_recent_post,
                "has_menu": has_menu,
                "has_intro": has_intro,
                "photo_count": photo_count,
                "website_url": website_url,
                "error": None,
            }
        finally:
            await browser.close()


async def fetch_competitor_faq_items(naver_place_id: str) -> dict:
    """경쟁사 네이버 플레이스 FAQ(Q&A) 탭에서 질문 텍스트 추출.

    ChatGPT로는 얻을 수 없는 데이터 — 실제 경쟁사 사장님이 등록한 FAQ 목록.
    답변 본문은 저작권 이슈로 저장하지 않고 "질문만" 추출.

    Returns:
        {
            naver_place_id: str,
            questions: list[str],        # 최대 15개 질문 텍스트
            collected_at: iso datetime,
            error: str | None,
        }
    """
    default = {
        "naver_place_id": naver_place_id,
        "questions": [],
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "error": None,
    }
    if not naver_place_id:
        return {**default, "error": "naver_place_id required"}

    try:
        async with _PLAYWRIGHT_SEM:
            return await asyncio.wait_for(_run_faq_crawl(naver_place_id), timeout=25)
    except asyncio.TimeoutError:
        _logger.warning(f"competitor_faq_crawler timeout: {naver_place_id}")
        return {**default, "error": "timeout"}
    except Exception as e:
        _logger.warning(f"competitor_faq_crawler error [{naver_place_id}]: {e}")
        return {**default, "error": str(e)}


async def _run_faq_crawl(naver_place_id: str) -> dict:
    """[2026-05-01] 스마트플레이스 사장님 Q&A 탭(/qna /faq) 폐기로 크롤링 사실상 불가.

    하위 호환을 위해 함수만 잔존 — 빈 결과 + deprecated 에러 코드 반환.
    경쟁사 Q&A 데이터는 정보 탭 본문에서 수집하는 다른 경로로 대체 권장.
    """
    return {
        "naver_place_id": naver_place_id,
        "questions": [],
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "error": "deprecated_qna_tab_removed",
    }


def _extract_city_prefix(region: str) -> str:
    """
    지역명에서 시·군 단위 이름 추출 (블로그 검색 쿼리용).

    "경상남도 창원시 성산구" → "창원"
    "서울특별시 강남구"      → "서울"
    "창원시 성산구"          → "창원"
    "경기도 수원시 팔달구"   → "수원"
    """
    parts = region.strip().split()
    if not parts:
        return ""
    # 도·특별자치도처럼 광역 단위가 첫 번째 토큰인 경우 두 번째 토큰(시·군)을 사용
    if parts[0].endswith(("도", "특별자치도")) and len(parts) > 1:
        raw = parts[1]
    else:
        raw = parts[0]
    return re.sub(r"(특별시|광역시|특별자치시|특별자치도|시|도|군|구)$", "", raw).strip()


async def fetch_competitor_blog_mentions(competitor_name: str, region: str) -> int:
    """네이버 블로그 API로 경쟁사(또는 내 가게) 블로그 언급 수 조회.

    전략: 지역+이름 쿼리 우선 → 0이면 이름 단독 쿼리 재시도.
    지역 접두어는 _extract_city_prefix()로 시·군 단위 추출 ("경상남도 창원시" → "창원").
    실패 시 0 반환.
    """
    naver_id     = os.getenv("NAVER_CLIENT_ID", "")
    naver_secret = os.getenv("NAVER_CLIENT_SECRET", "")
    if not naver_id or not naver_secret:
        return 0

    region_prefix = _extract_city_prefix(region) if region else ""
    query_region  = f"{region_prefix} {competitor_name}".strip() if region_prefix else competitor_name
    query_name    = competitor_name

    headers = {
        "X-Naver-Client-Id": naver_id,
        "X-Naver-Client-Secret": naver_secret,
    }
    timeout = aiohttp.ClientTimeout(total=6)
    best = 0
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            # 1차: 지역+이름 쿼리 (가장 정확)
            async with session.get(
                "https://openapi.naver.com/v1/search/blog.json",
                headers=headers,
                params={"query": query_region, "display": 1},
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    best = int(data.get("total", 0))
                else:
                    _logger.warning(f"naver blog API HTTP {resp.status} for {competitor_name}")

            # 2차: 이름 단독 쿼리 (1차가 0이거나 지역 없는 경우)
            if best == 0 and query_name != query_region:
                async with session.get(
                    "https://openapi.naver.com/v1/search/blog.json",
                    headers=headers,
                    params={"query": query_name, "display": 1},
                ) as resp2:
                    if resp2.status == 200:
                        data2 = await resp2.json()
                        best = int(data2.get("total", 0))
    except Exception as e:
        _logger.warning(f"fetch_competitor_blog_mentions error [{competitor_name}]: {e}")
    return best


async def fetch_competitor_website_seo(website_url: str) -> dict:
    """website_checker.check_website_seo() 래퍼.

    website_url 없으면 {} 반환.
    체크 실패 시 {} 반환 (기존 데이터 유지 원칙).
    """
    if not website_url or not website_url.strip():
        return {}
    try:
        from services.website_checker import check_website_seo
        return await check_website_seo(website_url)
    except Exception as e:
        _logger.warning(f"fetch_competitor_website_seo error [{website_url}]: {e}")
        return {}


async def sync_competitor_place(
    competitor_id: str,
    naver_place_id: str,
    supabase,
    region: str = "",
) -> dict:
    """
    경쟁사 네이버 플레이스 크롤링 후 competitors 테이블 업데이트.
    blog_mention_count, website_seo_score, website_seo_result, detail_synced_at 포함.

    Returns:
        크롤링 결과 dict (error 키 포함 여부로 성공/실패 판단)
    """
    from db.supabase_client import execute

    # region 미전달 시 competitors → businesses 테이블에서 자동 조회
    resolved_region = region
    if not resolved_region:
        try:
            comp_row = await execute(
                supabase.table("competitors")
                .select("business_id")
                .eq("id", competitor_id)
                .maybe_single()
            )
            if comp_row.data:
                biz_row = await execute(
                    supabase.table("businesses")
                    .select("region")
                    .eq("id", comp_row.data["business_id"])
                    .maybe_single()
                )
                if biz_row.data:
                    resolved_region = biz_row.data.get("region", "")
        except Exception as e:
            _logger.warning(f"sync_competitor_place region 조회 실패 [{competitor_id}]: {e}")

    data = await fetch_competitor_place_data(naver_place_id)
    if data.get("error"):
        _logger.warning(
            f"sync_competitor_place [{competitor_id}] 실패: {data['error']}"
        )
        return data

    competitor_name = data.get("place_name", "")

    # 블로그 언급 수 + 웹사이트 SEO 병렬 실행
    async def _zero() -> int:
        return 0

    blog_count, website_seo = await asyncio.gather(
        fetch_competitor_blog_mentions(competitor_name, resolved_region) if competitor_name else _zero(),
        fetch_competitor_website_seo(data.get("website_url", "")),
        return_exceptions=True,
    )
    if isinstance(blog_count, Exception):
        _logger.warning(f"blog_mentions gather error [{competitor_id}]: {blog_count}")
        blog_count = 0
    if isinstance(website_seo, Exception):
        _logger.warning(f"website_seo gather error [{competitor_id}]: {website_seo}")
        website_seo = {}

    # website_seo_score: 통과 항목 수 기반 0~100 점수
    seo_checks = ["has_json_ld", "has_schema_local_business", "has_open_graph",
                  "is_mobile_friendly", "has_favicon", "is_https"]
    seo_score = 0
    if isinstance(website_seo, dict) and not website_seo.get("error"):
        passed = sum(1 for k in seo_checks if website_seo.get(k, False))
        seo_score = round(passed / len(seo_checks) * 100)

    now_iso = datetime.now(timezone.utc).isoformat()
    update_payload: dict = {
        "naver_review_count": data["review_count"],
        "naver_avg_rating": data["avg_rating"] if data.get("avg_rating", 0) > 0 else None,
        "has_faq": data["has_faq"],
        "has_recent_post": data["has_recent_post"],
        "has_menu": data["has_menu"],
        "naver_photo_count": data["photo_count"],
        "naver_place_last_synced_at": now_iso,
        "blog_mention_count": int(blog_count) if blog_count else 0,
        "website_seo_score": seo_score,
        "detail_synced_at": now_iso,
    }
    # place_name 수집 시 이름 업데이트
    if data.get("place_name"):
        update_payload["naver_place_name"] = data["place_name"]
    # 웹사이트 URL 있으면 저장
    if data.get("website_url"):
        update_payload["website_url"] = data["website_url"]
    # SEO 결과 JSON 저장 (오류 없는 경우만)
    if isinstance(website_seo, dict) and website_seo and not website_seo.get("error"):
        update_payload["website_seo_result"] = website_seo
    # has_intro: 컬럼이 존재하면 저장 (없으면 별도 예외 처리)
    if data.get("has_intro") is not None:
        update_payload["has_intro"] = data["has_intro"]

    try:
        await execute(
            supabase.table("competitors")
            .update(update_payload)
            .eq("id", competitor_id)
        )
        _logger.info(
            f"sync_competitor_place [{competitor_id}] 완료: "
            f"reviews={data['review_count']}, rating={data['avg_rating']}, "
            f"menu={data.get('has_menu')}, intro={data.get('has_intro')}, "
            f"blog={blog_count}, seo={seo_score}"
        )
    except Exception as e:
        # has_intro 컬럼 없는 경우 fallback: has_intro 제외하고 재시도
        if "has_intro" in str(e):
            _logger.warning(f"has_intro 컬럼 없음 [{competitor_id}] — 컬럼 제외 재시도")
            update_payload.pop("has_intro", None)
            try:
                await execute(
                    supabase.table("competitors")
                    .update(update_payload)
                    .eq("id", competitor_id)
                )
            except Exception as e2:
                _logger.warning(f"sync_competitor_place DB 업데이트 실패 [{competitor_id}]: {e2}")
                data["db_error"] = str(e2)
        else:
            _logger.warning(f"sync_competitor_place DB 업데이트 실패 [{competitor_id}]: {e}")
            data["db_error"] = str(e)

    data["blog_mention_count"] = int(blog_count) if blog_count else 0
    data["website_seo_score"] = seo_score
    data["website_seo_result"] = website_seo if isinstance(website_seo, dict) else {}
    return data


async def sync_all_competitor_places(business_id: str, supabase) -> list[dict]:
    """
    스케줄러용: business_id의 모든 활성 경쟁사 순차 크롤링.
    Playwright 동시 실행 금지 — 순차 처리 + 2초 간격으로 서버 부하 분산.

    Returns:
        각 경쟁사 크롤링 결과 목록
    """
    from db.supabase_client import execute

    # naver_place_id가 있는 경쟁사만 조회
    rows = (
        await execute(
            supabase.table("competitors")
            .select("id, name, naver_place_id")
            .eq("business_id", business_id)
            .eq("is_active", True)
            .not_.is_("naver_place_id", "null")
        )
    ).data or []

    if not rows:
        _logger.info(f"sync_all_competitor_places: naver_place_id 없음 [{business_id}]")
        return []

    results: list[dict] = []
    for row in rows:
        competitor_id = row["id"]
        naver_place_id = row.get("naver_place_id", "")
        if not naver_place_id:
            continue

        _logger.info(
            f"경쟁사 플레이스 동기화: {row['name']} ({naver_place_id})"
        )
        result = await sync_competitor_place(competitor_id, naver_place_id, supabase)
        results.append({"competitor_id": competitor_id, "name": row["name"], **result})

        # 순차 처리 — 네이버 크롤링 간 2초 간격
        await asyncio.sleep(2)

    return results
