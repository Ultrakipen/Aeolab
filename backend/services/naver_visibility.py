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
    """내 가게명이 검색결과 업체명과 동일한지 판단.
    단방향 매칭: target(내 가게명) in candidate(검색결과명) 방향만 허용.
    접두어 오매칭 방지: candidate에 접두어가 있으면 거부.
    예) '홍스튜디오' vs '더홍스튜디오' → False (접두어 '더' 존재)
    예) '홍스튜디오' vs '홍스튜디오 창원점' → True (접미어만 존재)
    """
    t = re.sub(r"[\s\-_·&]", "", target).lower()
    c = re.sub(r"[\s\-_·&]", "", candidate).lower()
    if not t or not c:
        return False
    # 완전 일치
    if t == c:
        return True
    # target이 candidate 안에 포함되는 경우
    if t in c and len(t) >= 2:
        idx = c.find(t)
        prefix = c[:idx]   # target 앞의 텍스트
        # 접두어가 1글자 이상 있으면 다른 업소명으로 판단 → 거부
        if prefix:
            return False
        # 접두어 없이 시작 (= t로 시작) → 허용 (뒤에 지점명 등 붙을 수 있음)
        return True
    return False


def _clean_keyword(keyword: str) -> str:
    """검색어의 특수문자 제거 — 네이버 API 오동작 방지 (·, /, ·, 괄호 등)"""
    # 슬래시·가운뎃점·특수기호 → 공백으로 대체 후 중복 공백 제거
    cleaned = re.sub(r"[·/\\|·•·]", " ", keyword or "")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


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
    네이버 검색 가시성 종합 분석

    Returns:
        search_query              : 실제 사용한 검색어
        my_rank                   : 내 가게 순위 (None = 미노출)
        is_smart_place            : 스마트플레이스 등록 여부
        blog_mentions             : 블로그 언급 총 건수
        naver_place_rank          : 지역 검색 내 순위 (미노출 시 None)
        naver_competitors         : 상위 가게 [{rank, name, address, category, telephone}]
        top_blogs                 : 내 가게 블로그 포스트 3건 [{title, link, description, postdate}]
        top_competitor_name       : 지역 검색 1위 경쟁사 이름 (내 가게 제외)
        top_competitor_blog_count : 1위 경쟁사 블로그 언급 건수
    """
    import asyncio

    # ── 검색어 구성 ────────────────────────────────────────────────
    # 행정단위 접미사(시·도·군·구·특별시·광역시) 제거 → "창원시" → "창원"
    import re as _re
    _raw_region = region.split()[0] if region else (region or "")
    region_prefix = _re.sub(r"(특별시|광역시|특별자치시|특별자치도|시|도|군|구)$", "", _raw_region).strip()
    # 키워드 특수문자 정리 ("웨딩 스냅·영상" → "웨딩 스냅 영상")
    clean_kw = _clean_keyword(keyword)
    search_query = f"{region_prefix} {clean_kw}".strip()

    # ── 블로그 쿼리: 가장 정확한 쿼리 우선 ────────────────────────
    # 1. 지역 + 업체명:  "창원 홍스튜디오"   ← 가장 정확 (내 가게 특정)
    # 2. 업체명 단독:    "홍스튜디오"         ← 전국 동명업체 포함 가능
    # 3. 지역+업체명+키워드: "창원 홍스튜디오 웨딩" (keyword 있을 때)
    #    ※ 업체명+키워드 단순 조합은 키워드 전체 포스트를 잡아 수백만 건 오반환 위험
    blog_query_region  = f"{region_prefix} {business_name}".strip() if region_prefix else business_name
    blog_query_name    = business_name
    # 키워드 첫 단어만 사용 (복합 키워드가 전체 카테고리 포스트를 끌어올리는 문제 방지)
    _kw_first = clean_kw.split()[0] if clean_kw else ""
    blog_query_keyword = (
        f"{region_prefix} {business_name} {_kw_first}".strip()
        if (region_prefix and _kw_first) else blog_query_region
    )

    # ── 병렬 호출: 지역 검색(20개) + 블로그 3종 + 최신 포스트 ─────
    local_data, blog_name_data, blog_region_data, blog_kw_data, blog_posts_data = await asyncio.gather(
        _get("local.json", {"query": search_query,         "display": 20, "sort": "sim"}),
        _get("blog.json",  {"query": blog_query_name,      "display": 1}),
        _get("blog.json",  {"query": blog_query_region,    "display": 1}),
        _get("blog.json",  {"query": blog_query_keyword,   "display": 1}),
        _get("blog.json",  {"query": blog_query_region,    "display": 5, "sort": "date"}),
        return_exceptions=True,
    )

    # ── 지역 검색 파싱 (상위 15개) ───────────────────────────────
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

    # ── Fallback 1: 지역+업체명으로 직접 검색 (전국 동명업체 구분) ─────────
    if not is_smart_place and business_name and region_prefix:
        direct_data = await _get("local.json", {
            "query": f"{region_prefix} {business_name}",
            "display": 5,
            "sort": "sim",
        })
        if isinstance(direct_data, dict):
            for i, item in enumerate(direct_data.get("items", [])):
                name = _strip_html(item.get("title", ""))
                if _name_matches(business_name, name):
                    is_smart_place = True
                    if my_rank is None:
                        my_rank = i + 1
                    _logger.debug(f"[naver_visibility] fallback 지역+업체명 검색으로 등록 확인: {name}")
                    break

    # ── Fallback 2: 업체명 단독 검색 (지역이 없거나 Fallback 1 실패 시) ─────────
    if not is_smart_place and business_name:
        direct_data2 = await _get("local.json", {
            "query": business_name,
            "display": 5,
            "sort": "sim",
        })
        if isinstance(direct_data2, dict):
            for i, item in enumerate(direct_data2.get("items", [])):
                name = _strip_html(item.get("title", ""))
                addr = item.get("roadAddress") or item.get("address", "")
                # 지역이 있으면 주소도 대조 — 전국 동명업체 오매칭 방지
                addr_ok = (not region_prefix) or (region_prefix in addr)
                if _name_matches(business_name, name) and addr_ok:
                    is_smart_place = True
                    if my_rank is None:
                        my_rank = i + 1
                    _logger.debug(f"[naver_visibility] fallback 업체명 단독 검색으로 등록 확인: {name} ({addr})")
                    break

    # ── 내 가게를 제외한 지역 검색 1위 경쟁사 ────────────────────
    top_competitor_name = None
    for comp in naver_competitors:
        if not _name_matches(business_name, comp["name"]):
            top_competitor_name = comp["name"]
            break

    # ── 2차 호출: 1위 경쟁사 블로그 건수 + 키워드 블로그 건수 (있을 때만) ─────
    top_competitor_blog_count = 0
    competitor_kw_blog_count  = 0
    if top_competitor_name:
        if _kw_first:
            comp_base, comp_kw = await asyncio.gather(
                _get("blog.json", {"query": top_competitor_name,                  "display": 1}),
                _get("blog.json", {"query": f"{top_competitor_name} {_kw_first}", "display": 1}),
            )
            if isinstance(comp_base, dict):
                top_competitor_blog_count = int(comp_base.get("total", 0))
            if isinstance(comp_kw, dict):
                competitor_kw_blog_count  = int(comp_kw.get("total", 0))
        else:
            comp_blog_data = await _get("blog.json", {"query": top_competitor_name, "display": 1})
            if isinstance(comp_blog_data, dict):
                top_competitor_blog_count = int(comp_blog_data.get("total", 0))

    # ── 내 가게 블로그 언급 수: 정확도 우선 선택 ────────────────────────
    # 우선순위: 지역+업체명 > 업체명 단독 > 지역+업체명+키워드(보조)
    # ※ max() 방식 제거 — 키워드 전체 카테고리 포스트까지 잡아 수백만 건 오반환 위험
    blog_name_count    = int(blog_name_data.get("total",   0)) if isinstance(blog_name_data,   dict) else 0
    blog_region_count  = int(blog_region_data.get("total", 0)) if isinstance(blog_region_data, dict) else 0
    blog_kw_count      = int(blog_kw_data.get("total",    0))  if isinstance(blog_kw_data,     dict) else 0

    # 지역+업체명 결과 우선 (가장 정확), 없으면 업체명 단독
    # 지역+업체명+키워드는 참고값만 (보조)
    if region_prefix and blog_region_count > 0:
        blog_mentions = blog_region_count
    else:
        blog_mentions = blog_name_count

    # ── 최신 블로그 포스트 5건 ────────────────────────────────────
    top_blogs = []
    if isinstance(blog_posts_data, dict):
        for item in blog_posts_data.get("items", []):
            title = _strip_html(item.get("title", ""))
            desc  = _strip_html(item.get("description", ""))
            # 지역 포함 여부 확인 (region_prefix가 있으면 제목이나 설명에 지역명이 있어야 함)
            if region_prefix:
                combined = (title + desc).lower()
                biz_clean = re.sub(r"[\s\-_·&]", "", business_name).lower()
                # 업체명 or 지역명이 포함된 포스트만 포함 (전국 동명 체인 필터링)
                if biz_clean not in re.sub(r"[\s\-_·&]", "", combined) and region_prefix not in combined:
                    continue
            top_blogs.append({
                "title":       title,
                "link":        item.get("link", ""),
                "description": desc[:100],
                "postdate":    item.get("postdate", ""),
            })

    _logger.info(
        f"[naver_visibility] query='{search_query}' "
        f"biz='{business_name}' "
        f"is_smart_place={is_smart_place} my_rank={my_rank} "
        f"total_results={len(naver_competitors)} "
        f"blog_mentions={blog_mentions}"
    )

    return {
        "search_query":              search_query,
        "my_rank":                   my_rank,
        "naver_place_rank":          my_rank,       # 명확한 필드명 추가
        "is_smart_place":            is_smart_place,
        "blog_mentions":             blog_mentions,
        "blog_name_count":           blog_name_count,
        "blog_region_count":         blog_region_count,
        "blog_kw_count":             blog_kw_count,
        "naver_competitors":         naver_competitors,
        "top_blogs":                 top_blogs,
        "top_competitor_name":       top_competitor_name,
        "top_competitor_blog_count": top_competitor_blog_count,
        "competitor_kw_blog_count":  competitor_kw_blog_count,
    }


def blog_mention_score(count: int) -> float:
    """블로그 언급 수 → 점수 (0~100)"""
    if count == 0:   return 5.0
    if count <= 5:   return 20.0
    if count <= 20:  return 40.0
    if count <= 50:  return 60.0
    if count <= 100: return 80.0
    return 100.0


async def get_naver_visibility_multi(business_name: str, keywords: list[str], region: str) -> dict:
    """
    여러 키워드로 네이버 가시성 순차 측정 → 최선 결과 반환
    - 키워드별로 get_naver_visibility 순차 호출 (최대 4개, 0.4초 간격)
    - my_rank 있는 결과 우선, 없으면 blog_mentions 최대 결과 반환
    - blog_mentions는 모든 결과 중 최대값으로 보정
    """
    import asyncio

    # 키워드 없으면 카테고리 기반 단일 호출로 fallback
    if not keywords:
        return await get_naver_visibility(business_name, "", region)

    # 최대 4개 순차 호출 (병렬 시 Naver API 429 Rate Limit 방지 — 0.4초 간격)
    results = []
    for kw in keywords[:4]:
        r = await get_naver_visibility(business_name, kw, region)
        results.append(r)
        await asyncio.sleep(0.4)

    valid = [r for r in results if isinstance(r, dict) and r]
    if not valid:
        return {}

    # 우선순위: my_rank 있는 것 중 순위 가장 높은 것 → 없으면 blog_mentions 최대
    ranked = [r for r in valid if r.get("my_rank") is not None]
    best = min(ranked, key=lambda r: r["my_rank"]) if ranked else max(valid, key=lambda r: r.get("blog_mentions", 0))

    # blog_mentions 보정: 모든 결과 중 최소값 사용 (정확도 우선)
    # ※ max() 제거 — 키워드 쿼리가 전체 카테고리 블로그까지 잡아 수백만 건 오반환 위험
    # 여러 키워드 결과에서 blog_mentions이 가장 낮은 값이 가장 정확한 (내 가게 특정 쿼리)
    nonzero_blogs = [r.get("blog_mentions", 0) for r in valid if r.get("blog_mentions", 0) > 0]
    best = dict(best)
    best["blog_mentions"] = min(nonzero_blogs) if nonzero_blogs else 0
    best["multi_query_count"] = len(valid)
    best["all_queries"] = [r.get("search_query", "") for r in valid]
    # 키워드별 순위 목록 추가 (UI에서 "키워드별 순위" 표시용)
    best["keyword_ranks"] = [
        {
            "query":   r.get("search_query", ""),
            "rank":    r.get("my_rank"),
            "exposed": r.get("my_rank") is not None,
        }
        for r in valid
    ]

    # 키워드별 블로그 비교 목록
    best["keyword_blog_comparison"] = [
        {
            "keyword":          (r.get("search_query", "").split(" ", 1)[-1] if " " in r.get("search_query", "") else r.get("search_query", "")),
            "my_count":         r.get("blog_kw_count", 0),
            "competitor_name":  r.get("top_competitor_name") or "",
            "competitor_count": r.get("competitor_kw_blog_count", 0),
        }
        for r in valid
        if r.get("blog_kw_count", 0) > 0 or r.get("competitor_kw_blog_count", 0) > 0
    ]

    return best
