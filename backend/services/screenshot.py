import asyncio
import logging
import uuid
import os
import re
import base64
from typing import Optional
from playwright.async_api import async_playwright

_logger = logging.getLogger("aeolab")


# Playwright 세마포어: multi_scanner.PLAYWRIGHT_SEMAPHORE 공유 (동시 Playwright 전역 1개 보장)
# competitor_place_crawler.py와 동일한 lazy import 패턴 — 순환 import 방지
def _get_playwright_sem():
    from services.ai_scanner.multi_scanner import PLAYWRIGHT_SEMAPHORE
    return PLAYWRIGHT_SEMAPHORE

# ── 네이버 블로그 캡처 JS ────────────────────────────────────────────────────
# 최종 확정 v2 (2026-05-15):
#   URL: search.naver.com?where=nexearch (통합검색)
#   이유: 사용자가 실제 검색할 때 보는 화면 = 통합검색의 "인기글" 섹션
#         section.blog.naver.com 은 순위가 달라 사용자 블로그가 나타나지 않음
#   방식: full_page=True + PIL 크롭 (viewport 한계 없음)
#   JS 역할: 헤더/GNB만 숨김 (섹션 조작 없음 — "인기글" Y좌표로 크롭)
_NAVER_BLOG_CLEAN_JS = """
(function() {
    function hide(el) {
        try { el.style.setProperty('display', 'none', 'important'); } catch(e) {}
    }
    // 1. 헤더·GNB·탭바 제거 (fixed 요소 겹침 방지)
    [
        '#header','#hd','#header_wrap','.header_wrap',
        '.gnb','#gnb','.fds-comps-header','.sc_nb',
        '.fds-tabs-header','.tab_area','#tab'
    ].forEach(function(s) {
        try { document.querySelectorAll(s).forEach(hide); } catch(e) {}
    });
    // 2. 클래스 기반 플레이스·지도·쇼핑 블록 제거
    //    실측(2026-05-16): Naver VIEW 탭 플레이스 블록 실제 클래스 = place-app-root, place_on_pcnx
    [
        '.place-app-root', '.place_on_pcnx',
        '.place_order','.bx_plc','.content_place',
        '.sp_nplace','.lst_place',
        '[data-type="place"]','[data-blocktype="place"]'
    ].forEach(function(s) {
        try { document.querySelectorAll(s).forEach(hide); } catch(e) {}
    });
    // 3. TreeWalker 기반: 섹션 제목 텍스트 노드 탐색 → 최상위 컨테이너 제거
    //    실측(2026-05-16): 쇼핑 섹션 H2 클래스가 obfuscated(nqAxdu9h)이고 컨테이너 클래스 없음
    //    → 클래스 선택자 불가 → 텍스트 노드 직접 탐색이 유일한 방법
    var HIDDEN_SECTIONS = [
        '플레이스', '쇼핑', '지식백과', '어학사전', '지식iN',
        '네이버 가격비교', '네이버플러스 스토어', '네이버쇼핑'
    ];
    try {
        var walker2 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker2.nextNode()) {
            var tn = walker2.currentNode;
            var txt = (tn.textContent || '').trim();
            if (HIDDEN_SECTIONS.indexOf(txt) !== -1) {
                var el = tn.parentElement;
                var sec = el && el.closest(
                    '#main_pack > div, #main_pack > section, section.sc_new, .api_subject_bx'
                );
                if (sec) hide(sec);
            }
        }
    } catch(e) {}
    // 4. iframe 포함 블록 제거 (일부 Naver 지도는 iframe 사용)
    try {
        var bxList = document.querySelectorAll('#main_pack > div, .lst_view > li');
        for (var j = 0; j < bxList.length; j++) {
            if (bxList[j].querySelector('iframe')) hide(bxList[j]);
        }
    } catch(e) {}
})();
"""

# 통합검색 "인기글" 섹션 Y 탐색
# 1순위: 제목이 "인기글"인 .sc_new 섹션
# 2순위: VIEW 섹션 (인기글 없는 키워드 폴백)
# 3순위: 0 반환 (상단부터 전체 캡처)
_NAVER_BLOG_START_JS = """
() => {
    var scrollY = window.pageYOffset || 0;
    function getY(el) {
        var rect = el.getBoundingClientRect();
        return Math.max(0, Math.round(rect.top + scrollY) - 8);
    }
    // 1순위: "인기글" 제목을 가진 섹션
    var secs = document.querySelectorAll('.sc_new');
    for (var i = 0; i < secs.length; i++) {
        var titleEls = secs[i].querySelectorAll('h2, h3, strong, .tit_area, .mod_title, .fds-comps-base-text');
        for (var j = 0; j < titleEls.length; j++) {
            if (/인기글/.test(titleEls[j].textContent || '')) {
                var rect = secs[i].getBoundingClientRect();
                if (rect.height > 100) return getY(secs[i]);
            }
        }
    }
    // 2순위: VIEW 섹션 폴백
    var viewSels = ['[data-block-type="view"]', '.view_wrap', '.mod_view'];
    for (var k = 0; k < viewSels.length; k++) {
        var el = document.querySelector(viewSels[k]);
        if (el) {
            var r = el.getBoundingClientRect();
            if (r.height > 100) return getY(el);
        }
    }
    return 0;
}
"""

# Google 봇 감지 지표 — URL 경로 또는 셀렉터로 판단
_GOOGLE_CAPTCHA_URL_HINTS = ("/sorry/", "recaptcha", "ipv4.google.com/sorry")
_GOOGLE_CAPTCHA_SELECTORS = ("div.g-recaptcha", "form#captcha-form", "#recaptcha")


async def _capture_google_via_dataforseo(query: str) -> Optional[bytes]:
    """DataForSEO Screenshot API — DATAFORSEO_LOGIN/PASSWORD 없으면 None 반환.

    데이터센터 IP CAPTCHA 100% 발생으로 Playwright Google 캡처가 제거된 이후
    대체 수단으로 사용 (구독자 50명 이후 활성화 예정 — CLAUDE.md 참조).
    비용: ~$0.002/건 → 50명 × 월 1회 = 월 $0.10 수준

    환경변수:
        DATAFORSEO_LOGIN   — DataForSEO 계정 로그인
        DATAFORSEO_PASSWORD — DataForSEO 계정 비밀번호
    """
    import aiohttp as _aiohttp

    login = os.getenv("DATAFORSEO_LOGIN")
    password = os.getenv("DATAFORSEO_PASSWORD")
    if not login or not password:
        _logger.debug("[dataforseo] Google 스크린샷 skip — DATAFORSEO_LOGIN/PASSWORD 미설정")
        return None

    url = "https://api.dataforseo.com/v3/serp/google/organic/live/advanced"
    payload = [{
        "keyword": query,
        "language_code": "ko",
        "location_code": 2410,        # 대한민국
        "calculate_rectangles": True,
        "screenshot": True,
    }]
    try:
        async with _aiohttp.ClientSession() as session:
            async with session.post(
                url,
                json=payload,
                auth=_aiohttp.BasicAuth(login, password),
                timeout=_aiohttp.ClientTimeout(total=30),
            ) as resp:
                if resp.status >= 400:
                    _logger.warning(
                        f"[dataforseo] API 오류 {resp.status}: query={query!r}"
                    )
                    return None
                data = await resp.json()
                screenshot_b64 = (
                    data.get("tasks", [{}])[0]
                    .get("result", [{}])[0]
                    .get("screenshot")
                )
                if screenshot_b64:
                    return base64.b64decode(screenshot_b64)
                _logger.debug(f"[dataforseo] screenshot 필드 없음: query={query!r}")
    except Exception as e:
        _logger.warning(f"[dataforseo] Google 스크린샷 실패: {e}")
    return None


async def _is_google_captcha(page) -> bool:
    cur_url = page.url
    if any(h in cur_url for h in _GOOGLE_CAPTCHA_URL_HINTS):
        return True
    for sel in _GOOGLE_CAPTCHA_SELECTORS:
        try:
            if await page.query_selector(sel):
                return True
        except Exception as _e:
            _logger.debug("captcha selector check failed: sel=%s err=%s", sel, _e)
    return False


async def capture_ai_result(
    platform: str, query: str, biz_id: str, capture_type: str = "before"
) -> Optional[str]:
    """AI 검색 결과 스크린샷 캡처 → Supabase Storage 업로드.
    Google CAPTCHA 감지 시 None 반환 (저장 안 함).

    google 플랫폼:
      1순위 — DataForSEO API (DATAFORSEO_LOGIN/PASSWORD 설정 시, CAPTCHA 우회)
      2순위 — Playwright 폴백 (데이터센터 IP CAPTCHA 가능성 있음)
    """
    # google 플랫폼: DataForSEO를 먼저 시도 (Playwright 없이)
    if platform == "google":
        dataforseo_bytes = await _capture_google_via_dataforseo(query)
        if dataforseo_bytes is not None:
            from db.supabase_client import get_storage
            fname_dfs = f"{biz_id}_google_{capture_type}_{uuid.uuid4().hex[:8]}.png"
            path_dfs = f"screenshots/{biz_id}/{fname_dfs}"
            storage_dfs = get_storage()
            storage_dfs.from_("before-after").upload(
                path_dfs,
                dataforseo_bytes,
                file_options={"content-type": "image/png", "cache-control": "3600"},
            )
            return storage_dfs.from_("before-after").get_public_url(path_dfs)
        # DataForSEO 미설정 또는 실패 시 Playwright 폴백으로 진행
        _logger.debug(f"[google] DataForSEO 미설정/실패 — Playwright 폴백 시도: query={query!r}")

    img_bytes: Optional[bytes] = None
    fname: Optional[str] = None
    _y_offset: int = 0
    _naver_full: bool = False  # naver 블로그: full_page+PIL 크롭 사용 여부

    if platform in ("naver", "naver_ai", "naver_ai_tab"):
        from services.ai_scanner import check_naver_playwright_quota as _check_naver_quota
        if not _check_naver_quota(f"screenshot.capture_ai_result:{platform}"):
            return None

    async with _get_playwright_sem():
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox"],
            )
            ctx = await browser.new_context(
                viewport={"width": 1280, "height": 800},
                locale="ko-KR",
                timezone_id="Asia/Seoul",
            )
            page = await ctx.new_page()

            try:
                if platform == "naver":
                    import urllib.parse as _urlparse
                    _enc_q = _urlparse.quote(query)
                    # where=view: "인기글" 전용 탭 — headless에서도 블로그 목록 직접 렌더링
                    await page.goto(
                        f"https://search.naver.com/search.naver?where=view&query={_enc_q}",
                        timeout=30000,
                    )
                    await page.wait_for_timeout(3000)
                    await page.evaluate(_NAVER_BLOG_CLEAN_JS)
                    _y_offset = 0  # view 탭: 상단부터 블로그 목록 바로 시작
                    _naver_full = True
                    await page.wait_for_timeout(300)
                elif platform == "perplexity":
                    await page.goto("https://www.perplexity.ai", timeout=30000)
                    await page.fill("textarea[placeholder]", query)
                    await page.keyboard.press("Enter")
                    await page.wait_for_timeout(5000)
                elif platform == "naver_ai":
                    import urllib.parse as _urlparse
                    _enc_q_ai = _urlparse.quote(query)
                    await page.goto(
                        f"https://search.naver.com/search.naver?where=nexearch&query={_enc_q_ai}",
                        timeout=30000,
                    )
                    await page.wait_for_timeout(3000)
                elif platform == "naver_ai_tab":
                    import urllib.parse as _urlparse
                    _enc_q_ait = _urlparse.quote(query)
                    await page.goto(
                        f"https://search.naver.com/search.naver?where=nexearch&query={_enc_q_ait}",
                        timeout=30000,
                    )
                    await page.wait_for_timeout(3000)
                elif platform == "google":
                    # DataForSEO 실패 후 Playwright 폴백
                    await page.goto(
                        f"https://www.google.com/search?q={query}",
                        timeout=30000,
                    )
                    await page.wait_for_timeout(2000)
                    # CAPTCHA 감지 — 봇 차단 페이지는 저장하지 않음
                    if await _is_google_captcha(page):
                        _logger.warning(
                            f"Google CAPTCHA detected for query='{query}', skip screenshot"
                        )
                        return None

                fname = f"{biz_id}_{platform}_{capture_type}_{uuid.uuid4().hex[:8]}.png"
                if platform == "naver" and _naver_full:
                    # full_page + PIL 크롭: viewport 한계 없이 블로그 섹션만 캡처
                    from PIL import Image as _PILImage
                    import io as _io
                    _fb = await page.screenshot(full_page=True)
                    _pil = _PILImage.open(_io.BytesIO(_fb))
                    _pw, _ph = _pil.size
                    _cy0 = min(_y_offset, max(0, _ph - 200))
                    _cy1 = min(_cy0 + 3500, _ph)
                    _buf = _io.BytesIO()
                    _pil.crop((0, _cy0, _pw, _cy1)).save(_buf, format='PNG')
                    img_bytes = _buf.getvalue()
                else:
                    if platform in ("naver_ai", "naver_ai_tab"):
                        capture_height = 2500
                    else:
                        capture_height = 1200
                    img_bytes = await page.screenshot(
                        clip={"x": 0, "y": _y_offset, "width": 1280, "height": capture_height}
                    )
            finally:
                await browser.close()

    if img_bytes is None or fname is None:
        return None

    # Supabase Storage 업로드
    from db.supabase_client import get_storage

    path = f"screenshots/{biz_id}/{fname}"
    storage = get_storage()
    storage.from_("before-after").upload(
        path,
        img_bytes,
        file_options={"content-type": "image/png", "cache-control": "3600"},
    )
    public_url = storage.from_("before-after").get_public_url(path)
    return public_url


# 영문 → 한글 키워드 변환 테이블 (사용자가 영문으로 입력한 경우 대응)
_EN_TO_KO: dict[str, str] = {
    "cafe": "카페",
    "coffee": "커피",
    "bakery": "베이커리",
    "beauty": "미용",
    "hair": "헤어",
    "nail": "네일",
    "fitness": "피트니스",
    "gym": "헬스",
    "yoga": "요가",
    "pilates": "필라테스",
    "dental": "치과",
    "clinic": "의원",
    "hospital": "병원",
    "pharmacy": "약국",
    "law": "법률",
    "lawyer": "변호사",
    "academy": "학원",
    "school": "학원",
    "restaurant": "음식점",
    "food": "음식",
    "chicken": "치킨",
    "pizza": "피자",
    "sushi": "초밥",
    "ramen": "라멘",
    "design": "디자인",
    "photo": "사진·영상",
    "video": "영상",
    "studio": "스튜디오",
    "wedding": "웨딩",
    "travel": "여행",
    "hotel": "호텔",
    "pet": "반려동물",
    "dog": "강아지",
    "cat": "고양이",
    "car": "자동차",
    "repair": "수리",
    "cleaning": "청소",
    "moving": "이사",
    "interior": "인테리어",
    "print": "인쇄",
    "printing": "인쇄",
    "shop": "가게",
    "store": "매장",
    "market": "마켓",
    "delivery": "배달",
    "kids": "어린이",
    "baby": "유아",
    "clothes": "의류",
    "fashion": "패션",
    "shoes": "신발",
    "jewelry": "주얼리",
    "massage": "마사지",
    "spa": "스파",
    "skincare": "피부관리",
    "it": "IT",
    "software": "소프트웨어",
    "web": "웹",
    "app": "앱",
    "game": "게임",
    "news": "뉴스",
    "broadcasting": "방송",
    "music": "음악",
    "art": "미술",
    "gallery": "갤러리",
    "book": "도서",
    "education": "교육",
    "consulting": "컨설팅",
    "marketing": "마케팅",
    "accounting": "회계",
    "tax": "세무",
    "real estate": "부동산",
    "realestate": "부동산",
    "insurance": "보험",
    "finance": "금융",
    "sports": "스포츠",
    "golf": "골프",
    "swimming": "수영",
    "taekwondo": "태권도",
    "boxing": "복싱",
}


def _normalize_keyword(kw: str) -> str | None:
    """영문 키워드를 한글로 변환. 번역 불가 영문은 None 반환(쿼리 제외)"""
    stripped = kw.strip()
    lower = stripped.lower()
    if lower in _EN_TO_KO:
        return _EN_TO_KO[lower]
    # 영문(ASCII 위주)이면서 번역 테이블에 없으면 제외
    if re.match(r"^[a-zA-Z0-9\s\-_]+$", stripped):
        return None
    return stripped


def _extract_city(region: str) -> str:
    """지역명에서 시(市) 단위만 추출
    예: "창원 성산구" → "창원", "서울특별시 강남구" → "서울"
    """
    if not region:
        return region
    first = region.strip().split()[0]
    cleaned = re.sub(r"(특별시|광역시|특별자치시|특별자치도|시|도)$", "", first)
    return cleaned if cleaned else first


def _extract_district(region: str) -> str:
    """지역명에서 구(區) 단위 추출
    예: "창원 성산구" → "성산구", "서울 강남구" → "강남구", "창원" → ""
    """
    if not region:
        return ""
    parts = region.strip().split()
    # 두 번째 토큰이 구/군/동으로 끝나면 반환
    if len(parts) >= 2:
        candidate = parts[1]
        if re.search(r"(구|군|동)$", candidate):
            return candidate
    # 첫 번째 토큰 자체가 구/군이면 반환 (구 단위로만 등록된 경우)
    if re.search(r"(구|군)$", parts[0]):
        return parts[0]
    return ""


def build_queries(biz: dict) -> list:
    """사업장 정보로 대표 검색 쿼리 생성
    우선순위: 등록 키워드 > 카테고리 한글명
    - 키워드 있으면: {지역} {키워드} 추천 (최대 2개) + 카테고리 fallback
    - 키워드 없으면: {지역} {카테고리} 추천 + 구 단위 쿼리 + 가게명 직접 검색
    - 영문 키워드는 자동으로 한글 변환
    """
    # 순환 import 방지: _CATEGORY_KO를 함수 내부에서 import
    try:
        from routers.scan import _CATEGORY_KO as _SCAN_CATEGORY_KO
    except Exception:
        _SCAN_CATEGORY_KO = {}

    region = biz.get("region", "")
    category = biz.get("category", "")
    keywords = biz.get("keywords") or []
    name = biz.get("name", "")
    city = _extract_city(region)          # "창원 성산구" → "창원"
    district = _extract_district(region)  # "창원 성산구" → "성산구"
    category_ko = _SCAN_CATEGORY_KO.get(category, category)

    # 유효한 키워드 필터링 (공백·영문만·1글자 이하 제외, 영문은 한글로 변환)
    valid_keywords = []
    for kw in keywords:
        normalized = _normalize_keyword(kw)
        if normalized and len(normalized) >= 2:
            valid_keywords.append(normalized)

    queries = []

    if valid_keywords:
        # 키워드 우선: 실제 고객 검색 패턴 반영 (최대 3개)
        for kw in valid_keywords[:3]:
            q = f"{city} {kw} 추천"
            if q not in queries:
                queries.append(q)
        # fallback: 카테고리 쿼리
        q_cat = f"{city} {category_ko} 추천"
        if q_cat not in queries:
            queries.append(q_cat)
    else:
        # 키워드 없으면 카테고리 기반
        queries.append(f"{city} {category_ko} 추천")
        if district:
            queries.append(f"{city} {district} {category_ko} 추천")
        # 가게 이름 직접 검색
        if name:
            queries.append(f"{name} {category_ko}")

    return queries[:4]  # 최대 4개


# 네이버 AI 브리핑 대상 업종 (ACTIVE + LIKELY)
_NAVER_AI_ELIG_CATS = {
    "restaurant", "cafe", "bakery", "bar", "accommodation",   # ACTIVE
    "beauty", "nail", "skincare", "massage", "spa",           # LIKELY
    "pet", "fitness", "yoga", "pharmacy", "dance", "ballet",
}


def _needs_naver_ai_shot(category: str, is_franchise: bool) -> bool:
    """INACTIVE 업종이면 네이버 AI 브리핑 스크린샷 불필요"""
    # P2 TODO: AI탭 스크린샷 추가 시 이 함수를 재사용하지 말 것 — 별도 _needs_ai_tab_shot() 생성 필요 (모든 업종 포함)
    if is_franchise:
        return False
    return (category or "").lower() in _NAVER_AI_ELIG_CATS


async def capture_batch(biz_id: str, queries: list,
                        category: str = "", is_franchise: bool = False) -> list:
    """가입 시점 Before 일괄 캡처 — 순차 실행 (RAM 4GB 서버 보호)
    RAM 원칙: Playwright 인스턴스 1개 ≈ 300~500MB → 동시 2개 이상 금지
    순서: naver_blog → naver_ai (ACTIVE/LIKELY 업종만)
    Google: 제거 — 데이터센터 IP CAPTCHA 100%, 구독자 50명 이후 DataForSEO API로 재도입.
    """
    results = []
    # 1. 네이버 블로그 (모든 업종)
    for q in queries[:2]:
        try:
            url = await capture_ai_result("naver", q, biz_id, "before")
            results.append(url)
        except Exception as exc:
            _logger.warning(f"capture_batch fail | biz={biz_id} platform=naver q={q!r} err={exc}")
            results.append(None)
        await asyncio.sleep(3)
    # 2. 네이버 AI 브리핑 — ACTIVE/LIKELY 업종만
    if _needs_naver_ai_shot(category, is_franchise):
        for q in queries[:2]:
            try:
                url = await capture_ai_result("naver_ai", q, biz_id, "before_naver_ai")
                results.append(url)
            except Exception as exc:
                _logger.warning(f"capture_batch fail | biz={biz_id} platform=naver_ai q={q!r} err={exc}")
                results.append(None)
            await asyncio.sleep(3)
    else:
        _logger.info(f"naver_ai screenshot skipped (INACTIVE category={category}): biz_id={biz_id}")
    return results


async def capture_naver_blog_screenshot(keyword: str, biz_id: str, region: str = "") -> str | None:
    """네이버 블로그 전용 검색 페이지 스크린샷 — 광고·쇼핑·웹문서 없는 순수 블로그 결과
    소상공인 서비스 원칙: 지역명 + 키워드로 검색 (예: "창원 웨딩본식 추천")
    URL: https://search.naver.com/search.naver?where=nexearch&query={region} {keyword} 추천
    저장: before-after 버킷 blog/{biz_id}/{keyword_safe}/
    DB:  before_after 테이블 (capture_type='blog_keyword', keyword=keyword)
    RAM 원칙: 각 호출마다 브라우저를 열고 닫음 — 호출자가 순차 실행 책임
    """
    import re as _re
    import datetime
    import hashlib

    # 지역명에서 시(市) 단위 추출 (기존 _extract_city 함수 활용)
    city = _extract_city(region) if region else ""
    # 검색 쿼리: 지역명 + 키워드 ("추천" 제외 — "추천" 유무로 인기글 순위 달라짐)
    # 목적: 사용자가 실제로 검색하는 기본 키워드로 인기글 순위 표시
    search_query = f"{city} {keyword.strip()}".strip() if city else keyword.strip()

    # Supabase Storage는 한글 경로 거부 → MD5 해시로 ASCII 경로 생성
    keyword_hash = hashlib.md5(keyword.strip().encode('utf-8')).hexdigest()[:12]

    from services.ai_scanner import check_naver_playwright_quota as _check_naver_quota
    if not _check_naver_quota("screenshot.capture_naver_blog_screenshot"):
        return None

    async with _get_playwright_sem():
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
            )
            ctx = await browser.new_context(
                viewport={"width": 1280, "height": 900},
                locale="ko-KR",
                timezone_id="Asia/Seoul",
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/131.0.0.0 Safari/537.36"
                ),
            )
            page = await ctx.new_page()

            try:
                import urllib.parse
                encoded_kw = urllib.parse.quote(search_query)
                # where=view: 네이버 "인기글" 전용 탭 — 통합검색에서 "인기글" 클릭 시 이동하는 URL
                # nexearch(통합검색)는 headless 브라우저에 "인기글" 섹션을 렌더링하지 않음(봇 감지)
                # view 탭은 동일한 블로그 목록을 직접 렌더링 → lazy load 없음
                url = f"https://search.naver.com/search.naver?where=view&query={encoded_kw}"
                await page.goto(url, timeout=30000)
                await page.wait_for_timeout(3000)  # 블로그 목록 완전 로딩 대기

                # 디버그: 블로그 포스트가 DOM에 존재하는지 확인
                _post_count = await page.evaluate(
                    "() => document.querySelectorAll('.view_wrap .total_wrap .api_subject_bx, "
                    ".view_wrap .lst_view > li, .lst_view > .bx').length"
                )
                _logger.info(
                    f"blog capture(view tab) post_count={_post_count} biz={biz_id} "
                    f"kw={keyword!r} query={search_query!r}"
                )

                await page.evaluate(_NAVER_BLOG_CLEAN_JS)
                await page.wait_for_timeout(300)

                # full_page=True: 전체 블로그 목록 캡처
                full_bytes = await page.screenshot(full_page=True)

                # PIL 크롭: 상단 4000px만 (블로그 목록 10~15개 포함)
                from PIL import Image as _PILImage
                import io as _io
                _pil = _PILImage.open(_io.BytesIO(full_bytes))
                _pw, _ph = _pil.size
                _cy1 = min(4000, _ph)
                _buf = _io.BytesIO()
                _pil.crop((0, 0, _pw, _cy1)).save(_buf, format='PNG')
                img_bytes = _buf.getvalue()

                _logger.info(
                    f"blog capture: biz={biz_id} kw={keyword!r} "
                    f"img_size={len(img_bytes)} full_h={_ph}"
                )
            finally:
                await browser.close()

    # Supabase Storage 업로드
    from db.supabase_client import get_storage, get_client, execute

    fname = f"{uuid.uuid4().hex[:8]}.png"
    storage_path = f"blog/{biz_id}/{keyword_hash}/{fname}"
    storage = get_storage()
    storage.from_("before-after").upload(
        storage_path,
        img_bytes,
        file_options={"content-type": "image/png", "cache-control": "3600"},
    )
    public_url = storage.from_("before-after").get_public_url(storage_path)

    # 기존 blog_keyword 항목 삭제 후 새 항목 삽입 (구 통합검색 스크린샷 교체)
    supabase = get_client()
    await execute(
        supabase.table("before_after")
        .delete()
        .eq("business_id", biz_id)
        .eq("capture_type", "blog_keyword")
        .eq("keyword", keyword.strip())
    )
    await execute(
        supabase.table("before_after").insert({
            "business_id": biz_id,
            "capture_type": "blog_keyword",
            "platform": "naver_blog",
            "image_url": public_url,
            "query_used": f"네이버 블로그: {search_query}",
            "keyword": keyword.strip(),
            "score_at_capture": None,
        })
    )
    return public_url
