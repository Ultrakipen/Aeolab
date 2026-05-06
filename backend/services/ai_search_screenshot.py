"""AI 검색 결과 화면 스크린샷 캡처 서비스

구현:
  - naver_blog : 네이버 블로그 검색 결과 캡처 (AI 브리핑 원천 콘텐츠 확인)
  - chatgpt    : OpenAI API 텍스트 언급 여부 체크 (스크린샷 없음)
"""
import asyncio
import logging
import os
from datetime import date

_logger = logging.getLogger(__name__)

_QUERY_TEMPLATES = {
    "restaurant": "{region} {name} 맛집 추천",
    "cafe": "{region} 카페 추천",
    "beauty": "{region} 미용실 추천",
    "clinic": "{region} 병원 추천",
    "academy": "{region} 학원 추천",
    "fitness": "{region} 헬스장 추천",
    "pet": "{region} 동물병원 추천",
    "legal": "{region} 법무사 추천",
    "default": "{region} {name} 추천",
}


def _build_query(
    category: str,
    business_name: str,
    region: str,
    keywords: list | None = None,
    selected_keyword: str | None = None,
) -> str:
    city = region.strip().split()[0] if region.strip() else region
    if selected_keyword:
        return f"{city} {selected_keyword} 추천"
    if keywords:
        return f"{city} {keywords[0]} 추천"
    template = _QUERY_TEMPLATES.get(category, _QUERY_TEMPLATES["default"])
    return template.format(name=business_name, region=region)


async def _upload_screenshot(sb, path: str, data: bytes) -> str | None:
    """Supabase Storage 업로드 후 공개 URL 반환"""
    import asyncio as _a
    try:
        await _a.to_thread(
            sb.storage.from_("before-after").upload,
            path,
            data,
            {"content-type": "image/png", "upsert": "true"},
        )
        resp = await _a.to_thread(
            sb.storage.from_("before-after").get_public_url,
            path,
        )
        url = resp if isinstance(resp, str) else (resp.data if hasattr(resp, "data") else None)
        return url.rstrip("?") if isinstance(url, str) else None
    except Exception as e:
        _logger.warning("screenshot upload failed (%s): %s", path, e)
        return None


_AD_REMOVE_JS = (
    "document.querySelectorAll("
    "'.ad_area, .ad_wrap, [class*=\"ad_\"], .power_link, .power_link_area'"
    ").forEach(el => el.remove())"
)

# 블로그 탭 상단 쇼핑·플레이스 블록 제거 → 블로그 포스트가 상단으로 올라옴
_BLOG_PREPROCESS_JS = (
    "document.querySelectorAll("
    "'.sc_new.sp_nshop, [data-nscls=\"shopping\"], .nshop_area, "
    ".sp_nshop_detail, [class*=\"nplus\"], "
    ".place_area, .place_wrap, .place_list_wrap, .place_section, "
    "#place_section, [data-nscls=\"place\"], .sc_new.sp_nplace, "
    ".api_subject_bx[data-tab=\"place\"], .lst_place'"
    ").forEach(el => el.remove())"
)

# 블로그 포스트 리스트 시작 Y 좌표 탐지 (쇼핑·플레이스 제거 후 실행)
# 반환값: 스크롤 목표 Y (픽셀). -1이면 탐지 실패 → 고정 오프셋 사용.
_FIND_BLOG_START_JS = """
(function() {
    // 1순위: 블로그 결과 리스트 컨테이너 직접 탐지
    var containers = ['.lst_total_wrap', '.lst_total', '#blog_result', '.type01.lst_total_wrap'];
    for (var i = 0; i < containers.length; i++) {
        var el = document.querySelector(containers[i]);
        if (el) {
            var r = el.getBoundingClientRect();
            var y = Math.round(r.top + window.pageYOffset);
            if (y > 50) return Math.max(0, y - 40);
        }
    }
    // 2순위: 플레이스 블록 이후 첫 번째 blog.naver.com 링크
    var minY = 300;
    var placeEls = document.querySelectorAll(
        '.place_area, .place_wrap, .sc_new.sp_nplace, [data-nscls="local"], [data-nscls="place"]'
    );
    for (var i = 0; i < placeEls.length; i++) {
        var b = Math.round(placeEls[i].getBoundingClientRect().bottom + window.pageYOffset);
        if (b > minY) minY = b;
    }
    var links = document.querySelectorAll('a[href*="blog.naver.com"]');
    for (var i = 0; i < links.length; i++) {
        var y = links[i].getBoundingClientRect().top + window.pageYOffset;
        if (y >= minY) return Math.max(0, Math.round(y) - 80);
    }
    return -1;
})()
"""


async def capture_naver_results(
    query: str,
    business_name: str,
    biz_id: str,
) -> list[dict]:
    """네이버 블로그 + 카페 탭을 하나의 브라우저 세션에서 순차 캡처 (RAM 절약).

    Returns list with two items: naver_blog, naver_cafe
    """
    results: list[dict] = []
    today_str = date.today().isoformat()

    try:
        from playwright.async_api import async_playwright
        from db.supabase_client import get_client

        _sb = get_client()

        import urllib.parse as _urlparse

        # 네이버 탭별 where 파라미터 매핑
        _TAB_WHERE = {"blog": "blog", "cafe": "cafeblog"}
        _TAB_LABEL = {"blog": "네이버 블로그", "cafe": "네이버 카페"}

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )

            for tab_type in ("blog", "cafe"):
                # blog: 1200px — 페이지보다 작아야 스크롤 가능 (2200px이면 스크롤 불가)
                # cafe: 2200px — 기존 동작 유지
                vh = 1200 if tab_type == "blog" else 2200
                page = await browser.new_page(viewport={"width": 1280, "height": vh})
                where_param = _TAB_WHERE[tab_type]
                encoded_query = _urlparse.quote(query)
                url = f"https://search.naver.com/search.naver?where={where_param}&query={encoded_query}"
                is_mentioned = False
                img_url: str | None = None
                try:
                    await page.goto(url, timeout=30000, wait_until="domcontentloaded")
                    await page.wait_for_timeout(2000)
                    await page.evaluate(_AD_REMOVE_JS)

                    content = await page.content()
                    is_mentioned = business_name in content

                    if tab_type == "blog":
                        # 쇼핑·플레이스 DOM 제거 → 블로그 포스트 위치 탐지 → 스크롤
                        await page.evaluate(_BLOG_PREPROCESS_JS)
                        await page.wait_for_timeout(400)
                        blog_y = await page.evaluate(_FIND_BLOG_START_JS)
                        # 탐지 실패 시 1800px 고정 (플레이스 블록 높이 예상치 이후)
                        scroll_y = max(0, blog_y - 40) if blog_y >= 0 else 1800
                        await page.evaluate(f"window.scrollTo(0, {scroll_y})")
                        await page.wait_for_timeout(500)
                        img_bytes = await page.screenshot(full_page=False)
                    else:
                        await page.evaluate("window.scrollTo(0, 120)")
                        await page.wait_for_timeout(200)
                        img_bytes = await page.screenshot(full_page=False)
                    path = f"ai-search/{biz_id}/{today_str}_naver_{tab_type}.png"
                    img_url = await _upload_screenshot(_sb, path, img_bytes)
                except Exception as e:
                    _logger.warning("naver %s screenshot failed: %s", tab_type, e)
                finally:
                    await page.close()

                platform = f"naver_{tab_type}"
                results.append({
                    "platform": platform,
                    "query": query,
                    "is_mentioned": is_mentioned,
                    "url": img_url,
                    "captured_at": today_str,
                    "label": _TAB_LABEL[tab_type],
                })

            await browser.close()

    except ImportError:
        _logger.warning("playwright not installed — naver screenshot skipped")
        if not results:
            for tab_type, label in (("blog", "네이버 블로그"), ("cafe", "네이버 카페")):
                results.append({
                    "platform": f"naver_{tab_type}",
                    "query": query,
                    "is_mentioned": False,
                    "url": None,
                    "captured_at": today_str,
                    "label": label,
                })
    except Exception as e:
        _logger.warning("naver screenshot failed: %s", e)
        # 실패해도 빈 결과 반환
        if not results:
            for tab_type, label in (("blog", "네이버 블로그"), ("cafe", "네이버 카페")):
                results.append({
                    "platform": f"naver_{tab_type}",
                    "query": query,
                    "is_mentioned": False,
                    "url": None,
                    "captured_at": today_str,
                    "label": label,
                })

    return results


async def capture_chatgpt_result(
    query: str,
    business_name: str,
    biz_id: str,
) -> dict:
    """ChatGPT 검색 결과 간이 텍스트 조회 (OpenAI API 활용)"""
    is_mentioned = False
    try:
        import aiohttp
        api_key = os.getenv("OPENAI_API_KEY", "")
        if not api_key:
            return {
                "platform": "chatgpt",
                "query": query,
                "is_mentioned": False,
                "url": None,
                "captured_at": date.today().isoformat(),
                "label": "ChatGPT",
            }

        prompt = (
            f'다음 질문에 답해주세요: "{query}". '
            f'답변에 "{business_name}"이라는 가게가 언급되면 답변 첫 줄에 [MENTIONED]라고 써주세요.'
        )
        async with aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=20)
        ) as session:
            async with session.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 200,
                },
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    text = data["choices"][0]["message"]["content"]
                    is_mentioned = "[MENTIONED]" in text or business_name in text
    except Exception as e:
        _logger.warning("chatgpt result check failed: %s", e)

    return {
        "platform": "chatgpt",
        "query": query,
        "is_mentioned": is_mentioned,
        "url": None,
        "captured_at": date.today().isoformat(),
        "label": "ChatGPT",
    }


async def capture_ai_search_results(
    business_name: str,
    category: str,
    region: str,
    biz_id: str,
    keywords: list | None = None,
    selected_keyword: str | None = None,
) -> list:
    """네이버 블로그 + ChatGPT 결과 캡처"""
    query = _build_query(category, business_name, region, keywords=keywords, selected_keyword=selected_keyword)

    naver_results, chatgpt_result = await asyncio.gather(
        capture_naver_results(query, business_name, biz_id),
        capture_chatgpt_result(query, business_name, biz_id),
        return_exceptions=True,
    )

    output = []
    if isinstance(naver_results, list):
        output.extend(naver_results)
    if isinstance(chatgpt_result, dict):
        output.append(chatgpt_result)
    return output
