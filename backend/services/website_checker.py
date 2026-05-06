"""
독립 웹사이트 SEO 자동 체크
- Schema.org LocalBusiness JSON-LD 마크업 여부
- Open Graph 메타태그 여부
- 모바일 viewport 설정 여부
- favicon 존재 여부
- HTTPS 프로토콜 여부
- ChatGPT·Gemini·Google AI 인용 가능성 판단에 사용
"""
import re
import logging
from urllib.parse import urlparse

import aiohttp

_logger  = logging.getLogger("aeolab")
_TIMEOUT = aiohttp.ClientTimeout(total=8, connect=5)
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; AEOlab-SEOChecker/1.0)",
    "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
}

_EMPTY = {
    "has_json_ld": False,
    "has_schema_local_business": False,
    "has_open_graph": False,
    "is_mobile_friendly": False,
    "has_favicon": False,
    "is_https": False,
    "title": "",
    "error": None,
}


async def check_website_seo(url: str) -> dict:
    """웹사이트 SEO 요소 자동 체크 (최대 8초)

    Returns:
        has_json_ld               : Schema.org JSON-LD 마크업 존재 여부
        has_schema_local_business : LocalBusiness/Restaurant/Store 스키마 구체적 포함 여부
        has_open_graph            : og:title 등 Open Graph 태그 여부
        is_mobile_friendly        : viewport meta 태그 여부
        has_favicon               : favicon 링크 여부
        is_https                  : HTTPS 프로토콜 여부
        title                     : 페이지 <title> 텍스트 (최대 100자)
        error                     : 오류 메시지 (정상이면 None)
    """
    result = dict(_EMPTY)

    if not url or not url.strip():
        result["error"] = "URL 없음"
        return result

    # https:// 없으면 추가
    if not url.startswith("http"):
        url = "https://" + url.strip()

    parsed = urlparse(url)
    result["is_https"] = parsed.scheme == "https"

    try:
        async with aiohttp.ClientSession(timeout=_TIMEOUT, headers=_HEADERS) as session:
            async with session.get(url, allow_redirects=True, ssl=False) as resp:
                if resp.status >= 400:
                    result["error"] = f"HTTP {resp.status}"
                    return result

                content_type = resp.headers.get("Content-Type", "")
                if "html" not in content_type.lower():
                    result["error"] = "HTML 페이지가 아님"
                    return result

                # 최대 200KB만 읽어 파싱 부하 최소화
                raw = await resp.content.read(204_800)
                html = raw.decode("utf-8", errors="replace")

    except aiohttp.ClientConnectorError:
        result["error"] = "사이트 접속 불가"
        return result
    except aiohttp.ServerTimeoutError:
        result["error"] = "응답 시간 초과"
        return result
    except Exception as e:
        _logger.warning(f"website_checker error for {url}: {e}")
        result["error"] = f"체크 실패"
        return result

    # ── JSON-LD 확인 ──────────────────────────────────────────────────
    json_ld_blocks = re.findall(
        r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html, re.DOTALL | re.IGNORECASE,
    )
    if json_ld_blocks:
        result["has_json_ld"] = True
        for block in json_ld_blocks:
            if re.search(r'"@type"\s*:\s*"(LocalBusiness|Restaurant|Store|FoodEstablishment|MedicalBusiness|HealthAndBeautyBusiness|AutoRepair|HomeAndConstructionBusiness)', block, re.IGNORECASE):
                result["has_schema_local_business"] = True
                break

    # ── Open Graph 확인 ───────────────────────────────────────────────
    if re.search(
        r'<meta[^>]+property=["\']og:(title|description|image)["\']',
        html, re.IGNORECASE,
    ):
        result["has_open_graph"] = True

    # ── 모바일 viewport 확인 ─────────────────────────────────────────
    if re.search(r'<meta[^>]+name=["\']viewport["\']', html, re.IGNORECASE):
        result["is_mobile_friendly"] = True

    # ── favicon 확인 ─────────────────────────────────────────────────
    if re.search(
        r'<link[^>]+rel=["\'][^"\']*icon[^"\']*["\']',
        html, re.IGNORECASE,
    ) or re.search(
        r'<link[^>]+href=["\'][^"\']*favicon[^"\']*["\']',
        html, re.IGNORECASE,
    ):
        result["has_favicon"] = True

    # ── 페이지 타이틀 추출 ────────────────────────────────────────────
    title_match = re.search(
        r'<title[^>]*>(.*?)</title>', html, re.IGNORECASE | re.DOTALL,
    )
    if title_match:
        raw_title = re.sub(r'<[^>]+>', '', title_match.group(1)).strip()
        result["title"] = raw_title[:100]

    return result
