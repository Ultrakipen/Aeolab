"""
경쟁사 네이버 플레이스 데이터 크롤러
naver_place_stats.py 패턴 참고 — 경쟁사용 추가 필드(has_faq, has_recent_post, has_menu) 포함
Playwright 인스턴스는 순차 실행 (asyncio.Semaphore(1)) — RAM 보호
"""
import asyncio
import logging
import os
import random
import re
from datetime import datetime, timezone
from typing import Optional

import aiohttp
from playwright.async_api import async_playwright
from services.ai_scanner import apply_stealth as _apply_stealth, get_proxy_config as _get_proxy_config

_logger = logging.getLogger(__name__)

# Playwright 세마포어: multi_scanner.PLAYWRIGHT_SEMAPHORE 공유 (동시 Playwright 전역 1개 보장)
# naver_place_stats.py와 동일한 lazy import 패턴 — 순환 import 방지
def _get_playwright_sem():
    from services.ai_scanner.multi_scanner import PLAYWRIGHT_SEMAPHORE
    return PLAYWRIGHT_SEMAPHORE

# place_name 검증: pcmap 페이지 헤더/오버레이(모달·팝업 닫기 버튼 등)에 나타나는 비정상 값 목록
# "페이지 닫기" 실사고(2026-07-14): 경쟁사 5곳이 전부 이 문자열을 업체명으로 오인식해
# 블로그 검색 쿼리가 동일해지고, blog_mention_count가 5곳 모두 같은 값(296)으로 오염됨
_INVALID_PLACE_NAMES: set[str] = {
    "플레이스", "네이버", "지도", "place", "naver", "map",
    "페이지 닫기", "닫기", "확인", "동의", "취소", "더보기", "홈",
}

# User-Agent 로테이션 (Chrome 최신 버전 교대 — 단일 UA 봇 패턴 탐지 회피)
_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
]

# 뷰포트 후보 (일반적인 데스크탑 해상도 3종)
_VIEWPORTS = [
    {"width": 1366, "height": 768},
    {"width": 1920, "height": 1080},
    {"width": 1440, "height": 900},
]

# 경쟁사 간 크롤링 간격 (초) — 균일 패턴 차단 회피
_CRAWL_DELAY_MIN = 7
_CRAWL_DELAY_MAX = 15


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
        async with _get_playwright_sem():
            return await asyncio.wait_for(_run_place_crawl(naver_place_id), timeout=90)
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

    # _run_place_crawl 스코프용 default — IP 차단 등 조기 반환 시 사용
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

    _ua = random.choice(_USER_AGENTS)
    _vp = random.choice(_VIEWPORTS)
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
            proxy=_get_proxy_config(),
        )
        ctx = await browser.new_context(
            locale="ko-KR",
            timezone_id="Asia/Seoul",
            user_agent=_ua,
            viewport=_vp,
        )
        page = await ctx.new_page()
        await _apply_stealth(page)
        try:
            # ── 1단계: 홈 탭 로드 ─────────────────────────────────────
            await page.goto(f"{base_url}/home", timeout=20000, wait_until="domcontentloaded")
            await page.wait_for_timeout(5000)

            body_text = await page.inner_text("body")

            # ── IP 차단 감지 ──────────────────────────────────────────
            if "서비스 이용이 제한되었습니다" in body_text or "과도한 접근 요청" in body_text:
                _logger.warning(f"competitor_place_crawler IP blocked [{naver_place_id}]")
                await browser.close()
                return {**default, "error": "ip_blocked"}

            # ── 사업장명 파싱 ─────────────────────────────────────────
            # 2026-07-14 실측 재확인: 네이버가 lines[1]에 접근성용 "페이지 닫기" 스킵링크를
            # 추가해 기존 lines[1] 기준이 깨짐 — 실제 업체명은 lines[0](3개 업체 실측 일치:
            # '히든태'/'창원음악창작소 플레이스튜디오'/'아이리스넵'). lines[1]은 폴백용으로만 유지.
            place_name = ""
            lines = [l.strip() for l in body_text.split("\n") if l.strip()]
            for candidate in (lines[0] if lines else None, lines[1] if len(lines) >= 2 else None):
                if candidate and candidate.lower() not in _INVALID_PLACE_NAMES and len(candidate) > 1:
                    place_name = candidate
                    break

            # ── 서브스텝 부분 실패 추적 (빈 리스트 = 완전 성공) ──────────
            partial_failures: list[str] = []

            # ── 리뷰 수 파싱 ─────────────────────────────────────────
            # 패턴 우선순위: 블로그 리뷰 → 방문자 리뷰 → 카테고리 접두 리뷰(예: "장소대여리뷰 22") → 리뷰N(붙음)
            # 2026-07-14 실측 발견: 업종별 카테고리가 "리뷰" 앞에 붙고 숫자 앞에 공백이 있는
            # 형식("장소대여리뷰 22", "음반기획,제작리뷰 125")이 기존 3개 패턴 모두와 불일치해
            # review_count가 항상 0으로 나오던 버그 — 리뷰 4번째 패턴으로 공백 허용 일반형 추가.
            review_count = 0
            _review_patterns = [
                r"블로그\s*리뷰\s*(\d[\d,]*)",
                r"방문자\s*리뷰\s*(\d[\d,]*)",
                r"리뷰(\d[\d,]+)",
                r"리뷰[ \t]+(\d[\d,]*)",  # 줄바꿈은 제외(같은 줄 내 공백만) — 탭 라벨 "리뷰" 뒤 무관한 숫자 오탐 방지
            ]
            for _pat in _review_patterns:
                _m = re.search(_pat, body_text)
                if _m:
                    review_count = int(_m.group(1).replace(",", ""))
                    break

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
            except Exception as e:
                _logger.warning("avg_rating JS eval failed [%s]: %s", naver_place_id, e)

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
                    except Exception as e:
                        _logger.warning("avg_rating CSS selector [%s] failed [%s]: %s", sel, naver_place_id, e)

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
                except Exception as e:
                    _logger.warning("avg_rating review tab retry failed [%s]: %s", naver_place_id, e)
                    partial_failures.append("review_tab")

            # ── 탭 목록 확인 (네비게이션 영역 텍스트로 탭 추출) ──────────
            # lines[5:35]로 넓게 잡아 업종별 UI 구조 차이 대응 (구: lines[8:20])
            nav_area = "\n".join(lines[5:35]) if len(lines) > 35 else "\n".join(lines)

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
                except Exception as e:
                    _logger.warning("feed tab load failed [%s]: %s", naver_place_id, e)
                    partial_failures.append("recent_post")
                # 홈으로 복귀
                try:
                    await page.goto(f"{base_url}/home", timeout=15000, wait_until="domcontentloaded")
                    await page.wait_for_timeout(3000)
                    body_text = await page.inner_text("body")
                except Exception as e:
                    _logger.warning("home recovery after feed failed [%s]: %s", naver_place_id, e)

            # ── 메뉴/가격표/상품 등록 여부 ──────────────────────────────
            # 탐지 전략:
            #   0) CSS selector로 메뉴 탭 링크 직접 확인 (가장 신뢰)
            #   1) nav_area 확장(lines[5:35])에서 "메뉴" 탭 텍스트 확인 후 /menu 이동
            #   2) 홈 body에 "가격표" 키워드 있으면 True (스튜디오 등 비음식 업종)
            #   3) 정보(/info) 탭에서 "가격표" 확인 (홈에 없는 경우 대비)
            has_menu = False
            menu_text = ""

            # 0) CSS selector: 메뉴·상품·가격 탭 링크 (href 패턴)
            try:
                menu_tab = page.locator(
                    "a[href*='/menu'], a[href*='/product'], a[href*='/price']"
                ).first
                if await menu_tab.is_visible(timeout=2000):
                    has_menu = True
            except Exception as e:
                _logger.warning("menu CSS selector check failed [%s]: %s", naver_place_id, e)
                partial_failures.append("menu")

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
                except Exception as e:
                    _logger.warning("menu tab navigation (nav_area_extended) failed [%s]: %s", naver_place_id, e)
                    if "menu" not in partial_failures:
                        partial_failures.append("menu")
                try:
                    await page.goto(f"{base_url}/home", timeout=15000, wait_until="domcontentloaded")
                    await page.wait_for_timeout(2000)
                    body_text = await page.inner_text("body")
                except Exception as e:
                    _logger.warning("home recovery after menu nav (extended) failed [%s]: %s", naver_place_id, e)

            # 기존 nav_area("메뉴" in nav_area)도 fallback으로 유지
            if not has_menu and "메뉴" in nav_area:
                try:
                    await page.goto(f"{base_url}/menu", timeout=15000, wait_until="domcontentloaded")
                    await page.wait_for_timeout(3000)
                    menu_text = await page.inner_text("body")
                    menu_lines = [l.strip() for l in menu_text.split("\n") if l.strip()]
                    has_menu = len(menu_lines) > 20 and len(menu_text.strip()) > 400
                except Exception as e:
                    _logger.warning("menu tab navigation (nav_area fallback) failed [%s]: %s", naver_place_id, e)
                    if "menu" not in partial_failures:
                        partial_failures.append("menu")
                try:
                    await page.goto(f"{base_url}/home", timeout=15000, wait_until="domcontentloaded")
                    await page.wait_for_timeout(2000)
                    body_text = await page.inner_text("body")
                except Exception as e:
                    _logger.warning("home recovery after menu nav (fallback) failed [%s]: %s", naver_place_id, e)

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
                partial_failures.append("info_intro")

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
            except Exception as e:
                _logger.warning("photo count failed [%s]: %s", naver_place_id, e)
                partial_failures.append("photo")

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

            # ── 소개글/메뉴 원문 보관 (키워드 격차 분석용, 2026-07-13) ──
            # 위에서 boolean 판정에만 쓰던 info_text/menu_text를 그대로 버리지 않고
            # 500자 이내로 보관 — 경쟁사 키워드 노출 분석의 실제 소스로 사용
            # 알려진 제약: has_menu가 0)CSS selector 경로(line ~300)로 확정된 경우 /menu 탭을
            # 방문하지 않아 menu_text가 빈 채로 남음 — 신규 페이지 방문 추가는 네이버 요청 증가로
            # 이어져(차단 위험) 의도적으로 보완하지 않음. place_intro_text(/information, 항상 방문)는
            # 이 경로에서도 정상 수집됨.
            place_intro_text = ""
            if info_text:
                # has_intro 판정(line 392)과 동일한 정규식 우선 사용 — "메뉴 소개"·"공간 소개" 등
                # 다른 섹션이 "소개"로 먼저 매칭되는 오탐 방지, 실패 시 기존 find() fallback 유지
                intro_match = re.search(r"소개\s*\n(.+)", info_text)
                if intro_match:
                    place_intro_text = intro_match.group(1).strip()[:500]
                else:
                    idx = info_text.find("소개")
                    if idx >= 0:
                        place_intro_text = info_text[idx + 2:idx + 500].strip()
            place_menu_sample = menu_text.strip()[:500] if menu_text else ""

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
            except Exception as e:
                _logger.warning("website URL extraction failed [%s]: %s", naver_place_id, e)

            return {
                "naver_place_id": naver_place_id,
                "place_name": place_name,
                "review_count": review_count,
                "avg_rating": avg_rating,
                "has_faq": has_faq,
                "has_recent_post": has_recent_post,
                "has_menu": has_menu,
                "has_intro": has_intro,
                "place_intro_text": place_intro_text,
                "place_menu_sample": place_menu_sample,
                "photo_count": photo_count,
                "website_url": website_url,
                "partial_failures": partial_failures,
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
        async with _get_playwright_sem():
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


# competitor_scores 컬럼(TEXT[] 아닌 JSONB) breakdown 산정 — Gemini "미언급" 판정 시 모든
# 경쟁사가 소수점까지 동일한 고정값(15.0, 그 배수 breakdown)을 받던 버그 수정 (2026-07-14).
# 이 함수 이전에는 scan.py 2곳 + competitor.py _scan_new_competitor 3곳이 각각 다른 고정
# 상수(15.0/30.0/60.0)와 breakdown 배수 공식을 따로 갖고 있었음 — 단일 소스로 통합.
def compute_competitor_score(
    comp_row: dict,
    mentioned: bool,
    exposure_freq: float = 0,
    excerpt: str = "",
) -> tuple[float, dict]:
    """경쟁사 점수+breakdown 계산 — Gemini 신호(AI 언급) + 크롤링 실측(리뷰·완성도·SEO·블로그) 병합.

    설계 원칙(허위 수치 금지):
    - naver_exposure_confirmed/multi_ai_exposure: Gemini가 실제로 측정한 유일한 항목이므로
      mentioned=False면 정직하게 0 (예전처럼 base_score의 배수로 부풀리지 않음)
    - review_quality/smart_place_completeness/schema_seo/online_mentions_t2: competitor_place_crawler가
      실제로 크롤링한 값(naver_review_count/avg_rating/has_intro/has_menu/has_recent_post/
      website_seo_score/blog_mention_count)에서 직접 산출 — 더 이상 base_score의 임의 배수 아님
    - google_presence: 경쟁사에 대해 측정한 적 없는 항목 — 0 유지(과거에도 미측정이었고 여전히 미측정)
    - 크롤링이 한 번도 안 된 경쟁사(detail_synced_at 없음)는 review_quality 등 실측 항목을
      0으로 강제하지 않고 평균 계산에서 제외 — "측정 안 됨"과 "측정했더니 0점"을 구분

    Returns:
        (score, breakdown) — score는 breakdown 중 실제로 계산된 항목들의 평균(0~100)
    """
    if mentioned:
        excerpt_len = len(excerpt) if excerpt else 0
        freq_bonus = min(20, (exposure_freq or 0) * 2)
        ai_signal = min(80.0, (55.0 if excerpt_len > 100 else 40.0) + freq_bonus)
    else:
        ai_signal = 0.0

    components: list[float] = [ai_signal]
    breakdown: dict[str, float] = {
        "naver_exposure_confirmed": round(ai_signal, 1),
        "multi_ai_exposure": round(ai_signal, 1),
        "google_presence": 0.0,  # 경쟁사 Google 노출 미측정
    }

    is_crawled = bool(comp_row.get("detail_synced_at"))
    if is_crawled:
        review_count = comp_row.get("naver_review_count") or 0
        rating = comp_row.get("naver_avg_rating") or 0.0
        has_intro = bool(comp_row.get("has_intro"))
        has_menu = bool(comp_row.get("has_menu"))
        has_recent_post = bool(comp_row.get("has_recent_post"))
        blog_count = comp_row.get("blog_mention_count") or 0
        seo_score = comp_row.get("website_seo_score")

        review_quality = round(min(100.0, min(70.0, review_count * 3.5) + (rating / 5.0 * 30.0 if rating else 0.0)), 1)
        smart_place = round((34.0 if has_intro else 0.0) + (33.0 if has_menu else 0.0) + (33.0 if has_recent_post else 0.0), 1)
        online_mentions = round(min(100.0, blog_count * 5.0), 1)

        breakdown["review_quality"] = review_quality
        breakdown["smart_place_completeness"] = smart_place
        breakdown["online_mentions_t2"] = online_mentions
        components += [review_quality, smart_place, online_mentions]

        if seo_score is not None:
            schema_seo = round(float(seo_score), 1)
            breakdown["schema_seo"] = schema_seo
            components.append(schema_seo)

    covered_kw = comp_row.get("comp_keywords") or []
    if covered_kw:
        keyword_gap = round(min(100.0, len(covered_kw) * 20.0), 1)
        breakdown["keyword_gap_score"] = keyword_gap
        components.append(keyword_gap)

    score = round(sum(components) / len(components), 1) if components else 0.0
    return score, breakdown


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
    registered_name: str = "",
) -> dict:
    """
    경쟁사 네이버 플레이스 크롤링 후 competitors 테이블 업데이트.
    blog_mention_count, website_seo_score, website_seo_result, detail_synced_at 포함.

    registered_name: DB에 등록된 경쟁사 이름. place_name 파싱 실패 시 블로그 검색 fallback으로 사용.

    Returns:
        크롤링 결과 dict (error 키 포함 여부로 성공/실패 판단)
    """
    from db.supabase_client import execute

    # region/category — competitors → businesses 테이블에서 조회 (category는 comp_keywords 계산에 필요)
    resolved_region = region
    category = ""
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
                .select("region, category")
                .eq("id", comp_row.data["business_id"])
                .maybe_single()
            )
            if biz_row.data:
                if not resolved_region:
                    resolved_region = biz_row.data.get("region", "")
                category = biz_row.data.get("category", "")
    except Exception as e:
        _logger.warning(f"sync_competitor_place region/category 조회 실패 [{competitor_id}]: {e}")

    data = await fetch_competitor_place_data(naver_place_id)
    if data.get("error"):
        _logger.warning(
            f"sync_competitor_place [{competitor_id}] 실패: {data['error']}"
        )
        return data

    parsed_place_name = data.get("place_name", "")
    # place_name 파싱 실패(헤더 텍스트 등) 시 DB 등록명 fallback
    competitor_name = parsed_place_name if parsed_place_name else registered_name

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

    # 경쟁사 자체 키워드 프로필 — 소개글/메뉴 원문에서 업종 키워드 추출해 comp_keywords.covered로 저장.
    # 과거엔 이 컬럼을 쓰는 코드가 어디에도 없어 프론트 "경쟁사 보유 키워드" 섹션이 항상 빈 상태였음 (2026-07-14 발견).
    # "missing"/"pioneer"(내 가게 대비 격차)는 여기서 계산하지 않음 — 이 함수는 내 가게 텍스트에 접근하지 않으므로
    # gap_analyzer.py가 이미 올바르게 계산하는 competitor_keyword_sources/pioneer_keywords를 프론트에서 사용한다.
    comp_keywords_covered: list[str] = []
    if category:
        _real_text = " ".join(filter(None, [
            data.get("place_intro_text"), data.get("place_menu_sample"),
        ])).strip()
        if _real_text:
            try:
                from services.keyword_taxonomy import analyze_keyword_coverage
                comp_keywords_covered = analyze_keyword_coverage(
                    category=category,
                    review_excerpts=[_real_text],
                )["covered"]
            except Exception as e:
                _logger.warning(f"comp_keywords 계산 실패 [{competitor_id}]: {e}")

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
    # place_intro_text/place_menu_sample: 경쟁사 키워드 노출 분석용 원문 (2026-07-13)
    if data.get("place_intro_text"):
        update_payload["place_intro_text"] = data["place_intro_text"]
    if data.get("place_menu_sample"):
        update_payload["place_menu_sample"] = data["place_menu_sample"]
    if data.get("place_intro_text") or data.get("place_menu_sample"):
        update_payload["place_text_updated_at"] = now_iso
    if comp_keywords_covered:
        # comp_keywords 컬럼은 TEXT[](단순 문자열 배열) — {"covered": [...]} 같은 객체를 넣으면
        # "expected JSON array" 에러로 update() 전체가 실패함(2026-07-14 백필 중 실측 발견).
        # 이 컬럼엔 covered 목록만 저장하므로 배열 그대로 저장.
        update_payload["comp_keywords"] = comp_keywords_covered

    optional_columns = ("has_intro", "place_intro_text", "place_menu_sample", "place_text_updated_at", "comp_keywords")

    # 신규 컬럼(has_intro/place_intro_text 등) 미존재 시 fallback: 에러에 실제 언급된 컬럼만
    # 한 번에 하나씩 제외하며 재시도 (여러 컬럼이 동시에 없어도 PostgREST는 1개씩만 보고하므로 루프 필요)
    for _attempt in range(len(optional_columns) + 1):
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
            break
        except Exception as e:
            err_str = str(e)
            missing = [c for c in optional_columns if c in err_str and c in update_payload]
            if not missing:
                _logger.warning(f"sync_competitor_place DB 업데이트 실패 [{competitor_id}]: {e}")
                data["db_error"] = str(e)
                break
            _logger.warning(f"컬럼 없음 {missing} [{competitor_id}] — 제외 재시도")
            for c in missing:
                update_payload.pop(c, None)
    else:
        _logger.warning(f"sync_competitor_place DB 업데이트 재시도 소진 [{competitor_id}]")
        data["db_error"] = "update retry exhausted"

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
        result = await sync_competitor_place(
            competitor_id, naver_place_id, supabase,
            registered_name=row.get("name", ""),
        )
        results.append({"competitor_id": competitor_id, "name": row["name"], **result})

        # IP 차단 감지 → 배치 전체 조기 중단
        if result.get("error") == "ip_blocked":
            _logger.warning(
                f"sync_all_competitor_places: IP 차단 감지, 배치 중단 "
                f"[biz={business_id}] (완료={len(results)-1}, 남음={len(rows)-len(results)})"
            )
            break

        # 순차 처리 — 네이버 크롤링 간 랜덤 딜레이 (균일 패턴 차단 회피)
        _delay = random.uniform(_CRAWL_DELAY_MIN, _CRAWL_DELAY_MAX)
        await asyncio.sleep(_delay)

    return results
