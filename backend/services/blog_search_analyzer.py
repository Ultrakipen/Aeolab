"""
blog_search_analyzer.py — 네이버 블로그 검색 결과 분석 (v1.0)

Playwright로 네이버 블로그 검색을 실행해 상위 10개 포스팅을 추출하고,
내 사업장 포스팅 / 경쟁사 포스팅 여부를 판별해 구조화된 JSON 반환.
"""

import asyncio
import logging
import urllib.parse
from datetime import datetime, timezone

from playwright.async_api import async_playwright

_logger = logging.getLogger("aeolab.blog_analysis")


async def analyze_blog_search(
    keyword: str,
    biz_name: str,
    competitor_names: list[str],
    naver_blog_id: str = "",
) -> dict:
    """네이버 블로그 검색 결과 분석.

    Args:
        keyword: 검색할 키워드 (예: "홍대 카페 추천")
        biz_name: 내 사업장 이름 (포스팅 판별용)
        competitor_names: 경쟁사 이름 목록
        naver_blog_id: 사업장 네이버 블로그 ID (등록 시 URL 매칭 우선 사용)

    Returns:
        {
          "keyword": str,
          "total_found": int,
          "my_rank": int | None,
          "posts": [ { rank, title, url, blog_name, date, is_mine, is_competitor, competitor_name } ],
          "analyzed_at": str  (ISO datetime)
        }
    """
    search_url = (
        f"https://search.naver.com/search.naver"
        f"?where=blog&query={urllib.parse.quote(keyword)}"
    )
    posts: list[dict] = []

    browser = None
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--single-process",
                ],
            )
            ctx = await browser.new_context(
                viewport={"width": 1280, "height": 900},
                locale="ko-KR",
                timezone_id="Asia/Seoul",
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
            )
            page = await ctx.new_page()

            try:
                await page.goto(search_url, timeout=30000)
                await page.wait_for_timeout(2000)

                # 네이버 블로그 검색 결과 DOM 파싱
                # 2024~2026 네이버 블로그 탭 셀렉터 패턴 순서대로 시도
                js_code = """
() => {
    var results = [];
    var allAnchors = Array.from(document.querySelectorAll('a[href]'));

    // 포스트 URL: blog.naver.com/{blogId}/{숫자}
    var postUrlRe = /blog\\.naver\\.com\\/([^/?#]+)\\/([0-9]+)/;

    // 포스트 URL별로 앵커 그룹화
    var urlGroups = {};
    allAnchors.forEach(function(a) {
        if (!a.href) return;
        var m = a.href.match(postUrlRe);
        if (!m) return;
        var postUrl = 'https://blog.naver.com/' + m[1] + '/' + m[2];
        if (!urlGroups[postUrl]) urlGroups[postUrl] = { blogId: m[1], anchors: [] };
        urlGroups[postUrl].anchors.push(a);
    });

    var postUrls = Object.keys(urlGroups).slice(0, 10);

    postUrls.forEach(function(postUrl, idx) {
        var group = urlGroups[postUrl];
        var anchors = group.anchors;

        // 제목 후보: innerText가 있고, blog.naver.com› 포함 안 하고, 날짜로 시작 안 하는 것
        var titleCandidates = anchors.filter(function(a) {
            var t = (a.innerText || '').trim();
            if (!t || t.length < 8) return false;
            if (t.indexOf('blog.naver.com') > -1) return false;  // 블로그명+URL 앵커 제외
            if (/^\\d{4}\\./.test(t)) return false;  // 날짜로 시작하는 excerpt 제외
            return true;
        });

        // 가장 짧은 것 = 제목 (excerpt보다 짧음)
        titleCandidates.sort(function(a, b) {
            return (a.innerText || '').trim().length - (b.innerText || '').trim().length;
        });

        var title = titleCandidates.length > 0 ? titleCandidates[0].innerText.trim() : '';

        // 블로그명: blog.naver.com› 포함된 앵커에서 앞부분 추출
        var blogName = '';
        var blogAnchor = anchors.find(function(a) {
            return (a.innerText || '').indexOf('blog.naver.com') > -1;
        });
        if (blogAnchor) {
            blogName = blogAnchor.innerText.trim().split('\\n')[0].trim();
        }

        // 날짜: excerpt 앵커(날짜로 시작)에서 추출
        var dateStr = '';
        var excerptAnchor = anchors.find(function(a) {
            return /^\\d{4}\\./.test((a.innerText || '').trim());
        });
        if (excerptAnchor) {
            var dm = excerptAnchor.innerText.match(/\\d{4}[.\\-]\\d{1,2}[.\\-]\\d{1,2}/);
            if (dm) dateStr = dm[0];
        }

        if (title) {
            results.push({ rank: idx + 1, title: title, url: postUrl, blog_name: blogName, date: dateStr });
        }
    });

    // 구형 DOM 폴백: li.bx 방식
    if (results.length === 0) {
        var items = Array.from(document.querySelectorAll('li.bx, .view_wrap li.bx, .total_area li.bx'));
        items.slice(0, 10).forEach(function(el, idx) {
            var tEl = el.querySelector('.title_area a, a.title_link, a[class*="title"]');
            var bEl = el.querySelector('.user_info .name, .blog_name, .api_name');
            var dEl = el.querySelector('.date, .api_time, span[class*="date"]');
            var title = tEl ? tEl.innerText.trim() : '';
            if (title) {
                results.push({ rank: idx + 1, title: title, url: tEl ? tEl.href : '', blog_name: bEl ? bEl.innerText.trim() : '', date: dEl ? dEl.innerText.trim() : '' });
            }
        });
    }

    return results;
}
"""
                raw_posts = await page.evaluate(js_code)
                posts = raw_posts or []
                _logger.info(
                    f"blog_search parsed | kw={keyword!r} count={len(posts)}"
                )

            except Exception as page_exc:
                _logger.warning(
                    f"blog_search page error | kw={keyword!r} err={page_exc}"
                )
            finally:
                await page.close()
                await ctx.close()
                await browser.close()
                browser = None

    except Exception as pw_exc:
        _logger.warning(
            f"blog_search playwright error | kw={keyword!r} err={pw_exc}"
        )
        if browser:
            try:
                await browser.close()
            except Exception:
                pass

    # is_mine / is_competitor 판별
    biz_tokens = _normalize_tokens(biz_name)
    comp_token_map: dict[str, list[str]] = {
        comp: _normalize_tokens(comp) for comp in competitor_names
    }
    _naver_blog_id = naver_blog_id.strip().lower()

    import re as _re
    _post_url_re = _re.compile(r"blog\.naver\.com/([^/?#]+)/")

    my_rank: int | None = None

    for post in posts:
        title_lower = _normalize(post.get("title", ""))
        blog_lower = _normalize(post.get("blog_name", ""))
        post_url = post.get("url", "").lower()

        # URL에서 블로그 ID 추출해 post에 포함 (UI 표시 및 is_mine 판별 보조)
        m = _post_url_re.search(post_url)
        extracted_blog_id = m.group(1) if m else ""
        post["blog_id"] = extracted_blog_id

        # naver_blog_id가 등록된 경우: URL로 정확히 매칭
        if _naver_blog_id:
            is_mine = extracted_blog_id == _naver_blog_id or _naver_blog_id in post_url
        else:
            # 미등록: 제목·블로그명 토큰 매칭 (정확도 낮음 — 블로그 ID 등록 권장)
            is_mine = _tokens_match(biz_tokens, title_lower) or _tokens_match(
                biz_tokens, blog_lower
            )
        post["is_mine"] = is_mine
        if is_mine and my_rank is None:
            my_rank = post["rank"]

        post["is_competitor"] = False
        post["competitor_name"] = None
        for comp, tokens in comp_token_map.items():
            if _tokens_match(tokens, title_lower) or _tokens_match(tokens, blog_lower):
                post["is_competitor"] = True
                post["competitor_name"] = comp
                break

    return {
        "keyword": keyword,
        "total_found": len(posts),
        "my_rank": my_rank,
        "posts": posts,
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
        "blog_id_registered": bool(_naver_blog_id),
    }


# ── 내부 유틸 ──────────────────────────────────────────────

def _normalize(text: str) -> str:
    """공백·특수문자 제거 + 소문자 변환."""
    return text.lower().replace(" ", "").replace("_", "").replace("-", "")


def _normalize_tokens(name: str) -> list[str]:
    """사업장명 → 의미 있는 토큰 목록."""
    normalized = _normalize(name)
    if not normalized:
        return []
    return [normalized]


def _tokens_match(tokens: list[str], target: str) -> bool:
    """토큰 목록 중 하나라도 target에 포함되면 True."""
    return any(tok in target for tok in tokens if len(tok) >= 2)
