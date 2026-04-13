"""
블로그 URL 분석 서비스

- 네이버 블로그: 네이버 검색 API blog.json 사용 (직접 크롤링 절대 금지 — robots.txt 위반)
- 외부 블로그(티스토리/워드프레스/기타): aiohttp fetch + HTML 파싱
- 분석 항목: 포스트 수, 최신성, 키워드 커버리지, AI 브리핑 인용 가능성
"""
import re
import os
import ipaddress
import logging
from datetime import date, datetime
from typing import Optional
from urllib.parse import urlparse, urljoin

import aiohttp

from services.keyword_taxonomy import KEYWORD_TAXONOMY

_logger = logging.getLogger("aeolab")


# ── SSRF 방지 ─────────────────────────────────────────────────────────────────

# 허용된 외부 도메인 화이트리스트 (naver 검색 API — _analyze_naver_blog 전용)
_NAVER_API_HOST = "openapi.naver.com"

# 외부 블로그 허용 호스트 접미사 (티스토리·워드프레스·기타 공개 블로그)
_ALLOWED_BLOG_SUFFIXES = (
    ".tistory.com",
    ".wordpress.com",
    ".blog.me",        # 구 네이버 블로그 (blog.me)
    "blog.naver.com",  # 네이버 블로그 — _analyze_external_blog 경로에서 도달하지 않음
)

def _is_ssrf_blocked(url: str) -> bool:
    """
    SSRF 차단 판정.

    True를 반환하면 해당 URL로의 요청을 차단해야 한다.

    차단 기준:
    1. 스킴이 http/https 가 아닌 경우 (file://, dict://, gopher:// 등)
    2. 호스트가 프라이빗/루프백/링크로컬 IP 주소인 경우
       - 127.0.0.0/8  (loopback)
       - ::1          (IPv6 loopback)
       - 10.0.0.0/8   (private)
       - 172.16.0.0/12 (private)
       - 192.168.0.0/16 (private)
       - 169.254.0.0/16 (link-local / AWS metadata)
       - 100.64.0.0/10 (CGNAT — iwinv 내부망 가능성)
       - fc00::/7      (IPv6 unique local)
       - fe80::/10     (IPv6 link-local)
    3. 포트가 80/443 이외의 명시적 포트인 경우 (내부 서비스 방지)
    """
    try:
        parsed = urlparse(url)
    except Exception:
        return True

    # 1. 스킴 검사
    if parsed.scheme not in ("http", "https"):
        return True

    host = parsed.hostname or ""
    port = parsed.port  # None이면 스킴 기본 포트 사용

    # 2. 비표준 포트 차단 (블로그는 80/443만 허용)
    if port is not None and port not in (80, 443):
        return True

    # 3. IP 주소 직접 접근 차단
    try:
        addr = ipaddress.ip_address(host)
        if (
            addr.is_loopback
            or addr.is_private
            or addr.is_link_local
            or addr.is_reserved
            or addr.is_multicast
            or addr.is_unspecified
        ):
            return True
        # CGNAT 대역 100.64.0.0/10
        if addr.version == 4 and addr in ipaddress.ip_network("100.64.0.0/10"):
            return True
        # IPv6 unique local fc00::/7
        if addr.version == 6 and addr in ipaddress.ip_network("fc00::/7"):
            return True
    except ValueError:
        # 호스트네임 — IP가 아님
        pass

    # 4. 호스트네임에 "localhost" 포함 차단
    if "localhost" in host.lower():
        return True

    return False

_TIMEOUT = aiohttp.ClientTimeout(total=8, connect=5)
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; AEOlab-BlogChecker/1.0)",
    "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
}
_MAX_BODY_BYTES = 307_200  # 300KB


# ── 플랫폼 감지 ──────────────────────────────────────────────────────────────

def _detect_blog_platform(url: str) -> str:
    """블로그 플랫폼 자동 감지"""
    if "blog.naver.com" in url:
        return "naver"
    elif "tistory.com" in url:
        return "tistory"
    elif "wordpress.com" in url or "wp-content" in url or "wp-json" in url:
        return "wordpress"
    return "other"


# ── 키워드 커버리지 계산 ─────────────────────────────────────────────────────

def _calc_keyword_coverage(texts: list[str], category: str) -> dict:
    """키워드 커버리지 계산 공통 함수"""
    # _CATEGORY_ALIASES: taxonomy 키 정규화
    _ALIASES: dict[str, str] = {
        "restaurant": "restaurant", "food": "restaurant",
        "cafe": "cafe", "coffee": "cafe",
        "beauty": "beauty", "hair": "beauty",
        "clinic": "clinic", "hospital": "clinic",
        "academy": "academy", "education": "academy",
        "legal": "legal", "law": "legal",
        "fitness": "fitness", "gym": "fitness",
        "pet": "pet", "vet": "pet",
        "shopping": "shopping",
    }
    normalized = _ALIASES.get(category, category)
    taxonomy = KEYWORD_TAXONOMY.get(normalized, KEYWORD_TAXONOMY.get("restaurant", {}))

    all_keywords: list[str] = []
    for cat_data in taxonomy.values():
        if isinstance(cat_data, dict) and "keywords" in cat_data:
            all_keywords.extend(cat_data["keywords"])

    unique_keywords = list(dict.fromkeys(all_keywords))[:20]
    combined_text = " ".join(texts)

    covered = [kw for kw in unique_keywords if kw in combined_text]
    missing = [kw for kw in unique_keywords if kw not in combined_text]

    return {
        "coverage": round(len(covered) / max(len(unique_keywords), 1) * 100, 1),
        "covered_keywords": covered,
        "missing_keywords": missing[:10],
    }


# ── AI 브리핑 인용 가능성 체크 ───────────────────────────────────────────────

def _calc_blog_ai_readiness(
    posts_texts: list[str],
    post_dates: list,
    region: str = "",
) -> dict:
    """AI 브리핑 인용 가능성 체크"""
    items = []
    combined = " ".join(posts_texts)

    # 1. 질문형/조건형 키워드 포함 여부
    question_patterns = ["하는 법", "추천", "어디서", "리뷰", "후기", "근처", "맛집", "가격", "예약"]
    has_question = any(p in combined for p in question_patterns)
    items.append({
        "label": "검색 의도 키워드 포함 (추천/리뷰/근처 등)",
        "passed": has_question,
        "tip": "포스트 제목에 '추천', '리뷰', '근처' 등의 검색 의도 키워드를 포함하면 AI 인용률이 높아집니다.",
    })

    # 2. 지역 정보 포함 여부 — 시(市) 단위 정규화 후 검사 ("창원시" → "창원"도 매칭)
    region_clean = re.sub(r"(특별시|광역시|특별자치시|특별자치도|시|도|군|구)$", "", region.strip().split()[0]) if region else ""
    has_region = bool(region_clean) and (region_clean in combined or (region and region in combined))
    items.append({
        "label": f"지역 키워드 포함 ({region_clean or region or '지역명'})",
        "passed": has_region,
        "tip": "블로그 본문에 지역명을 자연스럽게 포함하면 로컬 AI 검색에서 인용됩니다.",
    })

    # 3. 최신성 체크
    latest_date: Optional[date] = None
    recent = False
    freshness = "outdated"
    if post_dates:
        valid_dates = [d for d in post_dates if d is not None]
        if valid_dates:
            latest_date = max(valid_dates)
            days_since = (date.today() - latest_date).days
            recent = days_since <= 30
            if recent:
                freshness = "fresh"
            elif days_since <= 90:
                freshness = "stale"

    items.append({
        "label": "최근 30일 이내 포스트 존재",
        "passed": recent,
        "tip": "한 달에 1~2개 포스트를 올리면 AI가 최신 정보로 인식합니다.",
    })

    # 4. 포스트 길이 체크 (평균 300자 이상)
    has_content = len(combined) > 300
    items.append({
        "label": "충분한 본문 내용 (300자 이상)",
        "passed": has_content,
        "tip": "AI가 인용할 내용이 충분하려면 포스트당 최소 300자 이상 작성이 필요합니다.",
    })

    passed_count = sum(1 for i in items if i["passed"])
    score = round(passed_count / len(items) * 100)

    return {
        "score": score,
        "items": items,
        "freshness": freshness,
        "latest_post_date": latest_date.isoformat() if latest_date else None,
    }


# ── 네이버 블로그 분석 (검색 API 사용) ──────────────────────────────────────

def _get_top_category_keywords(category: str, limit: int = 3) -> list[str]:
    """업종별 상위 키워드 반환 (다중 쿼리 생성용)"""
    _ALIASES: dict[str, str] = {
        "restaurant": "restaurant", "food": "restaurant",
        "cafe": "cafe", "coffee": "cafe",
        "beauty": "beauty", "hair": "beauty",
        "clinic": "clinic", "hospital": "clinic",
        "academy": "academy", "education": "academy",
        "legal": "legal", "law": "legal",
        "fitness": "fitness", "gym": "fitness",
        "pet": "pet", "vet": "pet",
        "shopping": "shopping",
        "photo": "photo", "사진": "photo",
    }
    normalized = _ALIASES.get(category, category)
    taxonomy = KEYWORD_TAXONOMY.get(normalized, {})
    keywords: list[str] = []
    for cat_data in taxonomy.values():
        if isinstance(cat_data, dict) and "keywords" in cat_data:
            keywords.extend(cat_data["keywords"])
            if len(keywords) >= limit:
                break
    return keywords[:limit]


async def _search_naver_blog_once(
    session: aiohttp.ClientSession,
    query: str,
    client_id: str,
    client_secret: str,
    blog_id: str,
) -> list[dict]:
    """단일 쿼리로 네이버 블로그 검색 → blog_id 필터링 → 결과 반환"""
    def strip_tags(text: str) -> str:
        return re.sub(r"<[^>]+>", "", text or "").strip()

    try:
        async with session.get(
            "https://openapi.naver.com/v1/search/blog.json",
            params={"query": query, "display": 10, "sort": "date"},
            headers={
                "X-Naver-Client-Id": client_id,
                "X-Naver-Client-Secret": client_secret,
            },
        ) as resp:
            if resp.status != 200:
                return []
            data = await resp.json()
    except aiohttp.ClientError as e:
        _logger.warning(f"naver blog search failed for query='{query}': {e}")
        return []

    raw_items = data.get("items", [])

    # blog_id 있으면 해당 블로그 포스트만 필터
    if blog_id:
        filtered = [i for i in raw_items if blog_id.lower() in (i.get("bloggerlink") or "").lower()]
        # 필터 결과 없으면 전체 사용 (사업장명이 bloggerlink에 없는 경우 대비)
        if not filtered:
            filtered = raw_items
    else:
        filtered = raw_items

    result = []
    for item in filtered:
        title = strip_tags(item.get("title", ""))
        desc  = strip_tags(item.get("description", ""))
        link  = item.get("link", "")
        bloggerlink = item.get("bloggerlink", "")
        postdate = item.get("postdate", "")
        result.append({
            "title": title,
            "desc": desc,
            "link": link,
            "bloggerlink": bloggerlink,
            "postdate": postdate,
        })
    return result


async def _analyze_naver_blog(
    blog_id: str,
    business_name: str,
    category: str,
    region: str,
) -> dict:
    """
    네이버 검색 API blog.json을 통한 블로그 분석 (다중 쿼리 전략)

    단일 쿼리의 한계(API는 제목+snippet 150자만 반환):
    여러 쿼리를 병렬 실행해서 최대한 많은 포스트를 커버함.
      - 쿼리 1: 사업장명 (현재 운영 중인 포스트 탐색)
      - 쿼리 2: blog_id 직접 검색 (블로거 ID로 등록된 포스트 탐색)
      - 쿼리 3~4: 지역 + 업종 상위 키워드 (예: "창원 웨딩스냅")
    직접 크롤링 절대 금지 — NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수 사용
    """
    client_id = os.getenv("NAVER_CLIENT_ID")
    client_secret = os.getenv("NAVER_CLIENT_SECRET")

    if not client_id or not client_secret:
        return {
            "platform": "naver",
            "post_count": 0,
            "keyword_coverage": 0.0,
            "covered_keywords": [],
            "missing_keywords": [],
            "ai_readiness_score": 0.0,
            "ai_readiness_items": [],
            "freshness": "outdated",
            "latest_post_date": None,
            "top_recommendation": "네이버 API 키가 설정되지 않아 분석할 수 없습니다.",
            "error": "NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 미설정",
        }

    # 다중 쿼리 생성
    queries: list[str] = []
    if business_name:
        queries.append(business_name)
    if blog_id and blog_id not in queries:
        queries.append(blog_id)
    # 지역 + 업종 상위 키워드 쿼리 추가 (블로그 포스트 내용 커버리지 향상)
    top_kws = _get_top_category_keywords(category, limit=3)
    if region and top_kws:
        city = region.strip().split()[0]  # "창원시 성산구" → "창원시"
        for kw in top_kws[:2]:
            q = f"{city} {kw}"
            if q not in queries:
                queries.append(q)
    elif top_kws:
        for kw in top_kws[:1]:
            if kw not in queries:
                queries.append(kw)

    # 다중 쿼리 순차 실행 (API Rate Limit 고려) + 중복 제거
    seen_links: set[str] = set()
    all_items: list[dict] = []

    async with aiohttp.ClientSession(timeout=_TIMEOUT) as session:
        for query in queries[:4]:  # 최대 4개 쿼리
            items = await _search_naver_blog_once(
                session=session,
                query=query,
                client_id=client_id,
                client_secret=client_secret,
                blog_id=blog_id,
            )
            for item in items:
                link = item.get("link", "")
                if link and link not in seen_links:
                    seen_links.add(link)
                    all_items.append(item)
                elif not link:
                    all_items.append(item)

    if not all_items:
        return {
            "platform": "naver",
            "post_count": 0,
            "keyword_coverage": 0.0,
            "covered_keywords": [],
            "missing_keywords": [],
            "ai_readiness_score": 0.0,
            "ai_readiness_items": [],
            "freshness": "outdated",
            "latest_post_date": None,
            "top_recommendation": "블로그 포스트를 찾을 수 없습니다. 사업장명 또는 블로그 주소를 확인해주세요.",
            "error": None,
        }

    # 포스트 텍스트 및 날짜 수집
    posts_texts: list[str] = []
    post_dates: list[Optional[date]] = []

    for item in all_items:
        title = item.get("title", "")
        desc  = item.get("desc", "")
        if title or desc:
            posts_texts.append(f"{title} {desc}")

        pub_date_str = item.get("postdate", "")
        if pub_date_str and len(pub_date_str) == 8:
            try:
                post_dates.append(date(
                    int(pub_date_str[:4]),
                    int(pub_date_str[4:6]),
                    int(pub_date_str[6:8]),
                ))
            except ValueError:
                post_dates.append(None)
        else:
            post_dates.append(None)

    kw_result = _calc_keyword_coverage(posts_texts, category)
    readiness = _calc_blog_ai_readiness(posts_texts, post_dates, region)

    post_count = len(all_items)
    top_rec = _build_top_recommendation(
        post_count=post_count,
        coverage=kw_result["coverage"],
        readiness_score=readiness["score"],
        freshness=readiness["freshness"],
        missing_keywords=kw_result["missing_keywords"],
    )

    return {
        "platform": "naver",
        "post_count": post_count,
        "keyword_coverage": kw_result["coverage"],
        "covered_keywords": kw_result["covered_keywords"],
        "missing_keywords": kw_result["missing_keywords"],
        "ai_readiness_score": float(readiness["score"]),
        "ai_readiness_items": readiness["items"],
        "freshness": readiness["freshness"],
        "latest_post_date": readiness["latest_post_date"],
        "top_recommendation": top_rec,
        "error": None,
    }


# ── 외부 블로그 분석 (aiohttp) ───────────────────────────────────────────────

async def _analyze_external_blog(
    url: str,
    category: str,
    region: str,
) -> dict:
    """
    외부 블로그(티스토리/워드프레스/기타) aiohttp 파싱
    website_checker.py 패턴 동일 — 최대 300KB, 8초 타임아웃
    SSRF 방지: 내부 IP / localhost / 비표준 포트 차단
    """
    platform = _detect_blog_platform(url)

    if not url.startswith("http"):
        url = "https://" + url.strip()

    # SSRF 차단 — 내부 IP, localhost, 비표준 포트 접근 금지
    if _is_ssrf_blocked(url):
        _logger.warning(f"SSRF attempt blocked: {url}")
        return _error_result(platform, "허용되지 않는 URL입니다. 공개 블로그 주소를 입력해주세요.")

    try:
        async with aiohttp.ClientSession(timeout=_TIMEOUT, headers=_HEADERS) as session:
            async with session.get(url, allow_redirects=True, ssl=False) as resp:
                if resp.status >= 400:
                    return _error_result(platform, f"HTTP {resp.status}")
                content_type = resp.headers.get("Content-Type", "")
                if "html" not in content_type.lower():
                    return _error_result(platform, "HTML 페이지가 아님")
                raw = await resp.content.read(_MAX_BODY_BYTES)
                html = raw.decode("utf-8", errors="replace")
    except aiohttp.ClientConnectorError:
        return _error_result(platform, "사이트 접속 불가")
    except aiohttp.ServerTimeoutError:
        return _error_result(platform, "응답 시간 초과")
    except Exception as e:
        _logger.warning(f"external blog fetch error for {url}: {e}")
        return _error_result(platform, "페이지 로드 실패")

    # 포스트 제목 추출 (h1/h2/h3 태그)
    headings = re.findall(r'<h[1-3][^>]*>(.*?)</h[1-3]>', html, re.DOTALL | re.IGNORECASE)
    post_titles = [re.sub(r'<[^>]+>', '', h).strip() for h in headings if h.strip()]

    # 본문 텍스트 (최대 5000자)
    body_text = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
    body_text = re.sub(r'<style[^>]*>.*?</style>', '', body_text, flags=re.DOTALL | re.IGNORECASE)
    body_text = re.sub(r'<[^>]+>', ' ', body_text)
    body_text = re.sub(r'\s+', ' ', body_text).strip()[:5000]

    posts_texts = post_titles + [body_text]

    # 날짜 추출 (ISO 형식, 한국어 날짜 패턴)
    post_dates: list[Optional[date]] = []
    date_patterns = [
        r'(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})',  # 2024.03.15 / 2024-03-15
        r'(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일',   # 2024년 3월 15일
    ]
    for pattern in date_patterns:
        for m in re.finditer(pattern, html):
            try:
                post_dates.append(date(int(m.group(1)), int(m.group(2)), int(m.group(3))))
            except ValueError:
                pass
        if post_dates:
            break

    # 티스토리: article count 추정
    post_count = len(re.findall(r'<article', html, re.IGNORECASE))
    if post_count == 0:
        post_count = len([t for t in post_titles if len(t) > 5])

    kw_result = _calc_keyword_coverage(posts_texts, category)
    readiness = _calc_blog_ai_readiness(posts_texts, post_dates, region)

    top_rec = _build_top_recommendation(
        post_count=post_count,
        coverage=kw_result["coverage"],
        readiness_score=readiness["score"],
        freshness=readiness["freshness"],
        missing_keywords=kw_result["missing_keywords"],
    )

    return {
        "platform": platform,
        "post_count": post_count,
        "keyword_coverage": kw_result["coverage"],
        "covered_keywords": kw_result["covered_keywords"],
        "missing_keywords": kw_result["missing_keywords"],
        "ai_readiness_score": float(readiness["score"]),
        "ai_readiness_items": readiness["items"],
        "freshness": readiness["freshness"],
        "latest_post_date": readiness["latest_post_date"],
        "top_recommendation": top_rec,
        "error": None,
    }


# ── 에러 결과 헬퍼 ────────────────────────────────────────────────────────────

def _error_result(platform: str, error_msg: str) -> dict:
    return {
        "platform": platform,
        "post_count": 0,
        "keyword_coverage": 0.0,
        "covered_keywords": [],
        "missing_keywords": [],
        "ai_readiness_score": 0.0,
        "ai_readiness_items": [],
        "freshness": "outdated",
        "latest_post_date": None,
        "top_recommendation": f"블로그 분석 실패: {error_msg}",
        "error": error_msg,
    }


# ── 주요 개선 권고 생성 ───────────────────────────────────────────────────────

def _build_top_recommendation(
    post_count: int,
    coverage: float,
    readiness_score: float,
    freshness: str,
    missing_keywords: list[str],
) -> str:
    """분석 결과를 바탕으로 가장 중요한 개선 사항 1줄 생성"""
    if post_count == 0:
        return "블로그 포스트가 없습니다. 첫 번째 포스트를 작성해 AI 브리핑 신호를 만드세요."
    if freshness == "outdated":
        return "마지막 포스트가 90일 이상 지났습니다. 이번 주 안에 포스트 1개를 올려 최신성을 회복하세요."
    if freshness == "stale":
        return "최근 포스트가 30~90일 전입니다. 이달 내 포스트 1개를 추가하면 AI 인용 가능성이 높아집니다."
    if coverage < 30:
        top_kw = missing_keywords[0] if missing_keywords else "업종 핵심 키워드"
        return f"키워드 커버리지가 낮습니다. 다음 포스트 제목에 '{top_kw}'를 포함하세요."
    if readiness_score < 50:
        return "포스트 제목에 '추천', '후기', '근처' 등 검색 의도 키워드를 포함하면 AI 인용률이 높아집니다."
    return "블로그 관리가 양호합니다. 월 2회 이상 꾸준한 발행으로 AI 브리핑 노출을 유지하세요."


# ── 메인 분석 함수 ────────────────────────────────────────────────────────────

async def analyze_blog(
    blog_url: str,
    business_name: str,
    category: str,
    region: str = "",
) -> dict:
    """
    블로그 URL 분석 메인 함수

    Args:
        blog_url      : 블로그 URL (네이버/티스토리/워드프레스/기타)
        business_name : 사업장 이름 (네이버 API 검색 쿼리 사용)
        category      : 업종 코드 (keyword_taxonomy 키 기준)
        region        : 지역명 (AI 브리핑 지역 키워드 체크 용도)

    Returns:
        platform, post_count, latest_post_date, keyword_coverage,
        covered_keywords, missing_keywords, ai_readiness_score,
        ai_readiness_items, freshness, top_recommendation, error
    """
    if not blog_url or not blog_url.strip():
        return _error_result("unknown", "블로그 URL이 없습니다")

    if not blog_url.startswith("http"):
        blog_url = "https://" + blog_url.strip()

    # SSRF 사전 차단 — 메인 진입점에서 1차 검증 (naver API 경로 포함)
    if _is_ssrf_blocked(blog_url):
        _logger.warning(f"SSRF attempt blocked at entry: {blog_url}")
        return _error_result("unknown", "허용되지 않는 URL입니다. 공개 블로그 주소를 입력해주세요.")

    platform = _detect_blog_platform(blog_url)

    if platform == "naver":
        # 네이버 블로그 ID 추출 (blog.naver.com/{blog_id})
        parsed = urlparse(blog_url)
        path_parts = [p for p in parsed.path.split("/") if p]
        blog_id = path_parts[0] if path_parts else ""
        return await _analyze_naver_blog(
            blog_id=blog_id,
            business_name=business_name,
            category=category,
            region=region,
        )
    else:
        return await _analyze_external_blog(
            url=blog_url,
            category=category,
            region=region,
        )
