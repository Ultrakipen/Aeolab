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


def _kw_display_label(search_query: str, region_prefix: str) -> str:
    """키워드 블로그 비교 표시용: search_query에서 region_prefix 제거 후 핵심 키워드만 반환."""
    import re as _re_lbl
    sq = search_query.strip()
    if not sq:
        return sq
    # region_prefix가 있으면 앞에서 제거
    if region_prefix and sq.startswith(region_prefix):
        sq = sq[len(region_prefix):].strip()
    # 남은 행정구역 패턴 제거 (시+구+동, 구+동, 동)
    sq = _re_lbl.sub(r"\S+시\s+\S+구\s+\S+동\s*", "", sq).strip()
    sq = _re_lbl.sub(r"^\S+구\s+\S+동\s+", "", sq).strip()
    sq = _re_lbl.sub(r"^\S+동\s+", "", sq).strip()
    return sq or search_query


def _build_region_prefix(region: str) -> str:
    """
    행정구역 → 검색 정밀도 최대화
    "창원시 성산구 상남동" → "성산구 상남동"  (구+동 조합, 가장 정밀)
    "서울특별시 강남구 역삼동" → "강남구 역삼동"
    "창원시 성산구" → "창원 성산구"
    "창원시" → "창원"
    """
    parts = (region or "").strip().split()
    if not parts:
        return ""
    # 시/도 레벨 (첫 토큰) — 접미사 제거
    city = re.sub(r"(특별시|광역시|특별자치시|특별자치도|시|도)$", "", parts[0]).strip()
    if len(parts) == 1:
        return city
    if len(parts) == 2:
        # "창원시 성산구" → "창원 성산구"
        return f"{city} {parts[1]}".strip()
    if len(parts) == 3:
        # "창원시 성산구 상남동" → "성산구 상남동" (구+동, 가장 정밀)
        return f"{parts[1]} {parts[2]}".strip()
    # 4개 이상 (도+시+구+동): "경상남도 창원시 성산구 상남동" → "성산구 상남동"
    # 이전 코드가 parts[1]+parts[2]="창원시 성산구"를 반환하여 동 레벨 정밀도 손실 — 수정
    return f"{parts[2]} {parts[3]}".strip()


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
    # 행정구역 정밀 파싱: "창원시 성산구 상남동" → "성산구 상남동" (구+동 조합이 가장 정밀)
    region_prefix = _build_region_prefix(region)
    # 키워드 특수문자 정리 ("웨딩 스냅·영상" → "웨딩 스냅 영상")
    clean_kw = _clean_keyword(keyword)
    # 키워드 앞에 지역명 중복 방지 (업체명이 키워드로 전달될 때 발생)
    # "성산구 상남동" + kw="창원시 성산구 상남동 제주흑돼지" → "제주흑돼지"
    # startswith 비교 + 정규식 fallback (경상남도 포함 4파트 region이면 startswith 실패하므로)
    import re as _re_kw
    _orig_region = (region or "").strip()
    _ck = clean_kw
    if _orig_region and _ck.startswith(_orig_region):
        _ck = _ck[len(_orig_region):].strip()
    elif region_prefix and _ck.startswith(region_prefix):
        _ck = _ck[len(region_prefix):].strip()
    else:
        # fallback: 키워드 내부 행정구역 패턴(시+구+동, 구+동, 동) 제거
        _ck = _re_kw.sub(r"\S+시\s+\S+구\s+\S+동\s*", "", _ck).strip()
        _ck = _re_kw.sub(r"^\S+구\s+\S+동\s+", "", _ck).strip()
        _ck = _re_kw.sub(r"^\S+동\s+", "", _ck).strip()
    search_query = f"{region_prefix} {_ck}".strip() if _ck else region_prefix

    # ── 블로그 쿼리: 가장 정확한 쿼리 우선 ────────────────────────
    # 업체명을 따옴표로 감싸 exact phrase 검색 → "홍대 육지" 검색 시 홍대/육지 개별 단어 포함
    # 포스트(수만 건 오반환) 방지. 따옴표 없이 검색하면 단어 조합 전체가 잡혀 수천 건 과대 집계됨.
    # 네이버 Search API는 "" 연산자를 지원하여 정확한 업체명 포스트만 반환.
    _quoted_name = f'"{business_name}"'
    blog_query_name    = _quoted_name
    blog_query_region  = f"{region_prefix} {_quoted_name}".strip() if region_prefix else _quoted_name
    # 키워드 첫 단어만 사용 (복합 키워드가 전체 카테고리 포스트를 끌어올리는 문제 방지)
    _kw_first = clean_kw.split()[0] if clean_kw else ""
    blog_query_keyword = (
        f"{region_prefix} {_quoted_name} {_kw_first}".strip()
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
                    # my_rank는 메인 키워드 검색 기준으로만 설정 — fallback rank는 다른 쿼리 기준이라 혼동 유발
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
                    # my_rank는 메인 키워드 검색 기준으로만 설정 — fallback rank는 다른 쿼리 기준이라 혼동 유발
                    _logger.debug(f"[naver_visibility] fallback 업체명 단독 검색으로 등록 확인: {name} ({addr})")
                    break

    # ── 내 가게를 제외한 지역 검색 1위 경쟁사 ────────────────────
    # 키워드가 "단체 예약 가능" 같은 속성 태그일 때 의원·병원·공공기관 등 이종 업종이 상위에 잡히는 문제 방지
    _COMP_SKIP_CATEGORIES = {
        "의원", "병원", "클리닉", "건강검진", "한의원", "치과", "약국",
        "헌혈", "혈액원", "요양", "노인",
        "정신건강", "상담센터", "심리상담", "복지관", "사회복지",
        "학원", "교습", "유치원", "어린이집",
        "협회", "재단", "공공기관", "관공서", "주민센터",
        "부동산", "법무", "세무",
        "교회", "성당", "사찰", "종교",
    }
    _COMP_SKIP_NAME_FRAGMENTS = {
        "건강관리협회", "헌혈의집", "마음건강", "청년마음", "사회복지",
        "주민센터", "동사무소", "보건소", "정신건강", "심리지원",
    }
    # 구(區) 레벨 필터 — 동명 다른 구 경쟁사 제외 (예: 성산구 상남동 vs 합포구 상남동)
    _region_gu = ""
    if region_prefix:
        _gu_parts = [p for p in region_prefix.split() if p.endswith("구")]
        if _gu_parts:
            _region_gu = _gu_parts[0]  # "성산구"
    top_competitor_name = None
    for comp in naver_competitors:
        if _name_matches(business_name, comp["name"]):
            continue
        comp_cat = comp.get("category", "")
        comp_name = comp.get("name", "")
        comp_addr = comp.get("address", "")
        if any(skip in comp_cat for skip in _COMP_SKIP_CATEGORIES):
            _logger.debug(f"[naver_visibility] 이종 업종(카테고리) 경쟁사 제외: {comp_name} ({comp_cat})")
            continue
        if any(frag in comp_name for frag in _COMP_SKIP_NAME_FRAGMENTS):
            _logger.debug(f"[naver_visibility] 이종 업종(이름) 경쟁사 제외: {comp_name}")
            continue
        # 구 레벨 주소 불일치 → 다른 구의 동명 가게 제외
        if _region_gu and comp_addr and _region_gu not in comp_addr:
            _logger.debug(f"[naver_visibility] 다른 구 경쟁사 제외: {comp_name} ({comp_addr}) — 기대 구: {_region_gu}")
            continue
        top_competitor_name = comp_name
        break

    # ── 2차 호출: 1위 경쟁사 블로그 건수 + 키워드 블로그 건수 (있을 때만) ─────
    # 경쟁사도 지역+이름으로 검색 — 이름만 검색 시 전국 동명업체+카테고리 포스트까지 합산되어
    # "제주흑돼지" 같은 공통 음식명이 업체명인 경우 수십만 건 오반환 위험
    top_competitor_blog_count = 0
    competitor_kw_blog_count  = 0
    if top_competitor_name:
        # 경쟁사도 내 가게와 동일하게 업체명 따옴표 exact match — 미적용 시 프랜차이즈 브랜드명이
        # 전국 포스트까지 끌어올려 수천~수만 건 과대 집계 (내 가게 쿼리와 불공정 비교 방지)
        _quoted_comp_name = f'"{top_competitor_name}"'
        comp_region_name = f"{region_prefix} {_quoted_comp_name}".strip() if region_prefix else _quoted_comp_name
        if _kw_first:
            comp_base, comp_kw = await asyncio.gather(
                _get("blog.json", {"query": comp_region_name,                  "display": 1}),
                _get("blog.json", {"query": f"{comp_region_name} {_kw_first}", "display": 1}),
            )
            if isinstance(comp_base, dict):
                top_competitor_blog_count = int(comp_base.get("total", 0))
            if isinstance(comp_kw, dict):
                competitor_kw_blog_count  = int(comp_kw.get("total", 0))
        else:
            comp_blog_data = await _get("blog.json", {"query": comp_region_name, "display": 1})
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

    # 블로그 검색에 실제 사용된 쿼리 계산 (프론트 근거 안내용)
    _blog_search_query = blog_query_region if (region_prefix and blog_region_count > 0) else blog_query_name
    _comp_blog_search_query = comp_region_name if top_competitor_name else ""

    return {
        "search_query":              search_query,
        "my_rank":                   my_rank,
        "naver_place_rank":          my_rank,       # 명확한 필드명 추가
        "is_smart_place":            is_smart_place,
        "blog_mentions":             blog_mentions,
        "blog_name_count":           blog_name_count,
        "blog_region_count":         blog_region_count,
        "blog_kw_count":             blog_kw_count,
        "blog_search_query":         _blog_search_query,
        "comp_blog_search_query":    _comp_blog_search_query,
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


async def get_naver_visibility_multi(business_name: str, keywords: list[str], region: str, category_ko: str = "") -> dict:
    """
    여러 키워드로 네이버 가시성 순차 측정 → 최선 결과 반환
    - 키워드별로 get_naver_visibility 순차 호출 (최대 4개, 0.4초 간격)
    - my_rank 있는 결과 우선, 없으면 blog_mentions 최대 결과 반환
    - blog_mentions는 모든 결과 중 최대값으로 보정
    - category_ko 지정 시 경쟁사는 해당 카테고리 키워드 결과에서만 선택
      (속성 키워드 "단체 예약 가능" 등으로 검색하면 이종 업종이 경쟁사로 잡히는 문제 방지)
    """
    import asyncio

    # 키워드 없으면 카테고리 기반 단일 호출로 fallback
    if not keywords:
        return await get_naver_visibility(business_name, "", region)

    # 최대 4개 순차 호출 (병렬 시 Naver API 429 Rate Limit 방지 — 0.4초 간격)
    kw_list = list(keywords[:4])
    results = []
    for kw in kw_list:
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

    # 경쟁사 오염 방지: category_ko 결과에서 경쟁사 + 순위 리스트를 가져와야 동일 업종 보장
    # 속성 키워드("단체 예약 가능")가 best로 선택된 경우 이종 업종이 경쟁사·순위 리스트에 표시됨
    if category_ko:
        _cat_idx = next((i for i, kw in enumerate(kw_list) if kw == category_ko), -1)
        if 0 <= _cat_idx < len(results) and isinstance(results[_cat_idx], dict):
            _cat_res = results[_cat_idx]
            if _cat_res.get("top_competitor_name"):
                best["top_competitor_name"] = _cat_res["top_competitor_name"]
                best["top_competitor_blog_count"] = _cat_res.get("top_competitor_blog_count", 0)
                best["comp_blog_search_query"] = _cat_res.get("comp_blog_search_query", "")
                best["competitor_kw_blog_count"] = _cat_res.get("competitor_kw_blog_count", 0)
                _logger.debug(f"[naver_visibility_multi] 경쟁사 카테고리({category_ko}) 결과로 교체: {_cat_res['top_competitor_name']}")
            # 순위 리스트도 카테고리 기반으로 교체: 속성 키워드 검색에서는 이종 업종이 상위에 노출됨
            if _cat_res.get("naver_competitors"):
                best["naver_competitors"] = _cat_res["naver_competitors"]
                best["search_query"] = _cat_res.get("search_query", best.get("search_query", ""))
                _logger.debug(f"[naver_visibility_multi] 순위 리스트 카테고리({category_ko}) 결과로 교체")
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
            # region_prefix를 제거해 핵심 키워드만 표시 ("성산구 상남동 흑돼지" → "흑돼지")
            "keyword": _kw_display_label(r.get("search_query", ""), region_prefix),
            "my_count":         r.get("blog_kw_count", 0),
            "competitor_name":  r.get("top_competitor_name") or "",
            "competitor_count": r.get("competitor_kw_blog_count", 0),
        }
        for r in valid
        if r.get("blog_kw_count", 0) > 0 or r.get("competitor_kw_blog_count", 0) > 0
    ]

    return best
