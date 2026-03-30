"""
네이버 검색 가시성 분석 서비스
- 네이버 지역 검색: 키워드로 지역 내 상위 노출 가게 확인
- 네이버 블로그 검색: 사업장 이름 실제 언급 횟수
- 스마트플레이스 등록 여부: 지역 검색 결과에 포함되는지 확인
"""
import re
import os
import logging
import aiohttp

_logger = logging.getLogger("aeolab")

_NAVER_ID     = os.getenv("NAVER_CLIENT_ID", "")
_NAVER_SECRET = os.getenv("NAVER_CLIENT_SECRET", "")
_BASE_URL     = "https://openapi.naver.com/v1/search"
_TIMEOUT      = aiohttp.ClientTimeout(total=6)


def _strip_html(text: str) -> str:
    """네이버 API 응답의 HTML 태그·엔티티 제거"""
    text = re.sub(r"<[^>]+>", "", text or "")
    return (
        text.replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", '"')
            .replace("&#39;", "'")
            .strip()
    )


def _name_matches(target: str, candidate: str) -> bool:
    """공백·대소문자 무시 부분 매칭"""
    t = re.sub(r"\s+", "", target).lower()
    c = re.sub(r"\s+", "", candidate).lower()
    return t in c or c in t


async def _get(endpoint: str, params: dict) -> dict:
    if not _NAVER_ID or not _NAVER_SECRET:
        return {}
    headers = {
        "X-Naver-Client-Id": _NAVER_ID,
        "X-Naver-Client-Secret": _NAVER_SECRET,
    }
    try:
        async with aiohttp.ClientSession(timeout=_TIMEOUT) as session:
            async with session.get(f"{_BASE_URL}/{endpoint}", headers=headers, params=params) as resp:
                if resp.status == 200:
                    return await resp.json()
                _logger.warning(f"Naver API {endpoint} HTTP {resp.status}")
    except Exception as e:
        _logger.warning(f"Naver API {endpoint} error: {e}")
    return {}


async def get_naver_visibility(business_name: str, keyword: str, region: str) -> dict:
    """
    네이버 검색 가시성 종합 분석 (trial 스캔용)

    Returns:
        search_query              : 실제 사용한 검색어
        my_rank                   : 내 가게 순위 (None = 미노출)
        is_smart_place            : 스마트플레이스 등록 여부
        blog_mentions             : 블로그 언급 총 건수
        naver_competitors         : 상위 5개 가게 [{rank, name, address, category, telephone}]
        top_blogs                 : 내 가게 블로그 포스트 3건 [{title, link, description, postdate}]
        top_competitor_name       : 지역 검색 1위 경쟁사 이름 (내 가게 제외)
        top_competitor_blog_count : 1위 경쟁사 블로그 언급 건수
    """
    import asyncio

    # ── 검색어 구성 ────────────────────────────────────────────────
    region_prefix = region.split()[0] if region else region
    search_query  = f"{region_prefix} {keyword}".strip()

    # ── 1차 병렬 호출: 지역 검색 + 내 가게 블로그 ────────────────
    local_data, blog_total_data, blog_posts_data = await asyncio.gather(
        _get("local.json", {"query": search_query, "display": 5, "sort": "random"}),
        _get("blog.json",  {"query": business_name, "display": 1}),
        _get("blog.json",  {"query": business_name, "display": 3, "sort": "date"}),
        return_exceptions=True,
    )

    # ── 지역 검색 파싱 ────────────────────────────────────────────
    naver_competitors = []
    my_rank        = None
    is_smart_place = False

    if isinstance(local_data, dict):
        for i, item in enumerate(local_data.get("items", [])):
            name = _strip_html(item.get("title", ""))
            naver_competitors.append({
                "rank":      i + 1,
                "name":      name,
                "address":   item.get("roadAddress") or item.get("address", ""),
                "category":  item.get("category", ""),
                "telephone": item.get("telephone", ""),
                "link":      item.get("link", ""),
            })
            if _name_matches(business_name, name):
                my_rank        = i + 1
                is_smart_place = True

    # ── 내 가게를 제외한 지역 검색 1위 경쟁사 ────────────────────
    top_competitor_name = None
    for comp in naver_competitors:
        if not _name_matches(business_name, comp["name"]):
            top_competitor_name = comp["name"]
            break

    # ── 2차 호출: 1위 경쟁사 블로그 건수 (있을 때만) ─────────────
    top_competitor_blog_count = 0
    if top_competitor_name:
        comp_blog_data = await _get("blog.json", {"query": top_competitor_name, "display": 1})
        if isinstance(comp_blog_data, dict):
            top_competitor_blog_count = int(comp_blog_data.get("total", 0))

    # ── 내 가게 블로그 언급 수 ────────────────────────────────────
    blog_mentions = 0
    if isinstance(blog_total_data, dict):
        blog_mentions = int(blog_total_data.get("total", 0))

    # ── 최신 블로그 포스트 3건 ────────────────────────────────────
    top_blogs = []
    if isinstance(blog_posts_data, dict):
        for item in blog_posts_data.get("items", []):
            top_blogs.append({
                "title":       _strip_html(item.get("title", "")),
                "link":        item.get("link", ""),
                "description": _strip_html(item.get("description", ""))[:80],
                "postdate":    item.get("postdate", ""),
            })

    return {
        "search_query":              search_query,
        "my_rank":                   my_rank,
        "is_smart_place":            is_smart_place,
        "blog_mentions":             blog_mentions,
        "naver_competitors":         naver_competitors,
        "top_blogs":                 top_blogs,
        "top_competitor_name":       top_competitor_name,
        "top_competitor_blog_count": top_competitor_blog_count,
    }


def blog_mention_score(count: int) -> float:
    """블로그 언급 수 → 점수 (0~100)"""
    if count == 0:   return 5.0
    if count <= 5:   return 20.0
    if count <= 20:  return 40.0
    if count <= 50:  return 60.0
    if count <= 100: return 80.0
    return 100.0
