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
import ipaddress
import logging
from urllib.parse import urlparse

import aiohttp

_logger  = logging.getLogger("aeolab")


def _is_safe_url(raw: str) -> bool:
    """SSRF 방지 — 사설/루프백 IP 리터럴 차단. 도메인명은 통과(DNS는 요청 시점에 해석됨).

    scan.py 트라이얼(비인증) 경로에 있던 동일 로직을 여기로 통합해 인증된
    스트림/전체 스캔 경로도 동일하게 보호한다 (2026-07-11 보안 감사 F1).
    """
    try:
        p = urlparse(raw)
        if p.scheme not in ("http", "https"):
            return False
        host = p.hostname or ""
        try:
            addr = ipaddress.ip_address(host)
            return addr.is_global
        except ValueError:
            return True  # 도메인명 — 허용
    except Exception:  # noqa: intentional-fallback — URL 파싱 오류 시 안전하게 차단
        return False
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
    "ai_crawler_blocked_bots": [],
    "ai_crawler_checked": False,
}

# AEOlab이 실제로 측정하는 채널(ChatGPT·Gemini)에 대응하는 크롤러만 추적한다.
# GPTBot=OpenAI 학습 크롤러, OAI-SearchBot=ChatGPT 실시간 검색 인용 크롤러,
# Google-Extended=Gemini 학습 크롤러 — 단 Google AI Overview는 Googlebot을 쓰므로
# Google-Extended 차단은 AI Overview 노출과 무관함 (2026-09-08 WebSearch로 확인, 혼동 금지)
_AI_BOT_LABELS = {
    "gptbot": "GPTBot(ChatGPT 학습)",
    "oai-searchbot": "OAI-SearchBot(ChatGPT 실시간 인용)",
    "google-extended": "Google-Extended(Gemini 학습)",
}


def _parse_blocked_ai_bots(robots_txt: str) -> list[str]:
    """robots.txt에서 AI 봇(GPTBot 등)이 루트 전체(Disallow: /)로 차단됐는지 확인.

    단순화된 파서 — User-agent 그룹별 최우선 규칙(allow/disallow 우선순위)까지는
    반영하지 않고, "루트 전체 차단" 여부만 본다(실무에서 가장 흔한 실수 케이스).
    """
    blocked: set[str] = set()
    current_agents: list[str] = []
    seen_directive = False

    for raw_line in robots_txt.splitlines():
        line = raw_line.split("#", 1)[0].strip()
        if not line or ":" not in line:
            continue
        key, _, value = line.partition(":")
        key = key.strip().lower()
        value = value.strip()

        if key == "user-agent":
            if seen_directive:
                current_agents = []
                seen_directive = False
            current_agents.append(value.lower())
        elif key == "disallow":
            seen_directive = True
            if value == "/":
                for agent in current_agents:
                    if agent == "*":
                        blocked.update(_AI_BOT_LABELS.keys())
                    elif agent in _AI_BOT_LABELS:
                        blocked.add(agent)
        elif key in ("allow", "crawl-delay", "sitemap"):
            seen_directive = True

    return sorted(_AI_BOT_LABELS[b] for b in blocked)


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

    if not _is_safe_url(url):
        result["error"] = "허용되지 않는 URL"
        return result

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
            if re.search(
                r'"@type"\s*:\s*"('
                r'LocalBusiness|Restaurant|FoodEstablishment|Bakery|Cafe|CafeOrCoffeeShop|BarOrPub|'
                r'Store|ClothingStore|ShoppingCenter|'
                r'BeautySalon|HairSalon|NailSalon|DaySpa|'
                r'MedicalBusiness|Physician|Dentist|MedicalClinic|'
                r'Pharmacy|'
                r'SportsActivityLocation|ExerciseGym|'
                r'VeterinaryCare|AnimalShelter|'
                r'EducationalOrganization|School|'
                r'Attorney|LegalService|'
                r'RealEstateAgent|'
                r'HomeAndConstructionBusiness|HousePainter|Plumber|Electrician|RoofingContractor|'
                r'AutoRepair|AutoDealer|'
                r'LodgingBusiness|Hotel|BedAndBreakfast|'
                r'TouristAttraction|EntertainmentBusiness|AmusementPark|'
                r'Florist|PetStore|MovieTheater|PhotographyBusiness'
                r')',
                block, re.IGNORECASE,
            ):
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

    # ── robots.txt AI 크롤러 차단 확인 (best-effort, 실패해도 전체 체크는 성공 처리) ──
    try:
        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
        async with aiohttp.ClientSession(timeout=_TIMEOUT, headers=_HEADERS) as session:
            async with session.get(robots_url, allow_redirects=True, ssl=False) as resp:
                if resp.status < 400:
                    robots_raw = await resp.content.read(51_200)
                    robots_txt = robots_raw.decode("utf-8", errors="replace")
                    result["ai_crawler_blocked_bots"] = _parse_blocked_ai_bots(robots_txt)
                result["ai_crawler_checked"] = True
    except Exception as e:
        _logger.warning(f"robots.txt check failed for {url}: {e}")
        result["ai_crawler_checked"] = False

    return result
