"""
네이버 키워드 검색 순위 측정 (Playwright + 공식 API 혼합)
service_unification_v1.0.md §4.1 / §5.3 측정 환경 표준화 적용

측정 대상:
  - PC 통합검색 (search.naver.com, Playwright)
  - 모바일 통합검색 (m.search.naver.com, Playwright)
  - 플레이스 탭 순위 (공식 지역검색 API `local.json`, 2026-08-08부터 Playwright→API 전환)

2026-08-08 변경 사유(naver_scraping_legal_risk_resolution_plan_v1.0.md §3 후속):
  search.naver.com/robots.txt가 `User-agent: * / Disallow: /`로 전체 차단 확인됨.
  PC/모바일 통합검색 순위는 대응하는 공식 API가 없어 Playwright를 유지하지만,
  플레이스 순위는 네이버 API Hub의 "지역 정보 검색" API(무료, 일 25,000건 한도 공유)로
  이미 `services/naver_visibility.py`가 사용 중이던 것과 동일 소스 — 중복 구현 없이
  재사용해 Playwright 요청을 키워드당 3건→2건으로 줄인다(약 33% 감소, 로봇배제 위반 요소 제거).

측정 환경 (재현성 보장):
  - 위치: 서버 IP (서울 기준 가정 — 측정 환경은 measurement_context에 기록)
  - 디바이스: User-Agent 분리 (PC Chrome / 모바일 iPhone)
  - 비로그인
  - 측정 시각

빈 상태·에러 폴백 (작업 지침 #7):
  - 사업장 매칭 실패 → rank=None (미노출)
  - Timeout → rank=None + measurement_context["timeout"]=True
  - Playwright 자체 실패 → 전체 None + measurement_context["error"]=str(e)
  - 임의 수치 절대 금지

서버 부담:
  - 1키워드 × (Playwright 2채널 + API 1건) = ~6초/키워드(종전 ~9초)
  - BACKEND_MAX_CONCURRENCY 환경변수로 동시 실행 제한 (기본 2)
"""
import os
import re
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from playwright.async_api import async_playwright, Page, TimeoutError as PWTimeout
from services.naver_visibility import _get as _naver_open_api_get, _name_matches as _nv_name_matches
from services.ai_scanner import check_naver_playwright_quota, naver_playwright_quota_usage

_logger = logging.getLogger("aeolab")

MAX_CONCURRENCY = int(os.getenv("BACKEND_MAX_CONCURRENCY", "2"))
PAGE_TIMEOUT_MS = int(os.getenv("KEYWORD_RANK_TIMEOUT_MS", "15000"))
RESULT_LIMIT = int(os.getenv("KEYWORD_RANK_LIMIT", "20"))

_semaphore = asyncio.Semaphore(MAX_CONCURRENCY)

# 선택적 재확인(목록이 비었을 때 새로고침 등)은 일일 상한의 이 비율 안에서만 한다 — 필수 측정이 우선
RECHECK_QUOTA_RATIO = float(os.getenv("KEYWORD_RANK_RECHECK_QUOTA_RATIO", "0.8"))
# 재확인 사용량 집계(프로세스 단위) — 로그와 측정 결과 _context로 노출해 실제 증가량을 잰다
_recheck_stats = {"rechecks": 0, "reloads": 0, "skipped": 0}

UA_PC = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)
UA_MOBILE = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) "
    "Version/17.0 Mobile/15E148 Safari/604.1"
)


def _norm(s: str) -> str:
    """비교용 정규화: 공백·특수문자 제거 + 소문자."""
    if not s:
        return ""
    return "".join(c for c in s.lower() if c.isalnum())


def _is_match(biz_name_norm: str, text: str) -> bool:
    """사업장 이름 매칭.

    - 정방향: 텍스트 안에 사업장 이름이 포함 (기존)
    - 역방향: 텍스트가 사업장 이름의 일부 (짧은 상호명 표시 대응, 최소 4자)
    """
    text_norm = _norm(text)
    if not text_norm or not biz_name_norm:
        return False
    if biz_name_norm in text_norm:
        return True
    if len(text_norm) >= 4 and text_norm in biz_name_norm:
        return True
    return False


async def _page_contains_place_id(page: Page, place_id: str) -> bool:
    """페이지 HTML 전체에 place_id 존재 여부 (폴백 검출용)."""
    try:
        return bool(await page.evaluate(
            f"() => document.documentElement.innerHTML.includes('{place_id}')"
        ))
    except Exception:
        return False


async def _find_rank_in_elements(
    page: Page,
    selector: str,
    biz_name_norm: str,
    place_id: Optional[str],
) -> Optional[int]:
    """주어진 셀렉터로 요소를 수집하여 순위 반환."""
    try:
        elements = await page.query_selector_all(selector)
    except Exception:
        return None

    if not elements:
        return None

    for idx, el in enumerate(elements[:RESULT_LIMIT], start=1):
        try:
            if place_id:
                html = await el.evaluate("e => e.outerHTML")
                if place_id in (html or ""):
                    return idx
            text = await el.evaluate("e => e.innerText || ''")
            if _is_match(biz_name_norm, text):
                return idx
        except Exception:
            continue
    return None


# ── 검색 화면 카드 목록 공유 캐시 (2026-10-27, 사용자 증가 대비) ─────────────────────────────
# PC·모바일 순위는 "검색어 한 번 열어서 읽은 가게 카드 목록"에서 내 가게 위치를 찾는 것이다. 목록은 검색어와 기기만으로
# 정해지므로(비로그인, 같은 서버 위치) 같은 검색어를 쓰는 다른 사업장(같은 지역·업종의 기본 키워드 등)은 페이지를 다시 열지
# 않고 같은 목록에서 자기 순위를 구할 수 있다. 정기 잡이 한 시간 안에 여러 사업장을 순차 처리하는 경우를 겨냥한 짧은 캐시다.
# 프로세스 메모리, TTL 기본 6시간(제안값, KEYWORD_RANK_CARD_CACHE_TTL_SEC=0이면 끔). 빈 목록은 저장하지 않는다
# (네이버가 목록 없이 내려준 일시 오류일 수 있어 "미노출"을 퍼뜨리지 않기 위해). 적중/실패는 card_cache_snapshot()으로 본다.
import time as _time

_CARD_CACHE: dict = {}                 # (device, query) -> (epoch, cards)
_CARD_CACHE_MAX = 500
_card_cache_stats = {"hit": 0, "miss": 0}


def _card_cache_ttl() -> float:
    try:
        return float(os.getenv("KEYWORD_RANK_CARD_CACHE_TTL_SEC", "21600"))
    except ValueError:
        return 21600.0


def _card_cache_get(device: str, query: str) -> Optional[list]:
    ttl = _card_cache_ttl()
    if ttl <= 0:
        return None
    hit = _CARD_CACHE.get((device, _norm(query)))
    if hit and (_time.time() - hit[0]) <= ttl:
        _card_cache_stats["hit"] += 1
        return list(hit[1])
    _card_cache_stats["miss"] += 1
    return None


def _card_cache_put(device: str, query: str, cards: Optional[list]) -> None:
    if _card_cache_ttl() <= 0 or not cards:
        return
    if len(_CARD_CACHE) >= _CARD_CACHE_MAX:
        _CARD_CACHE.pop(min(_CARD_CACHE, key=lambda k: _CARD_CACHE[k][0]), None)
    _CARD_CACHE[(device, _norm(query))] = (_time.time(), list(cards))


def _card_seen(device: str, query: str) -> bool:
    return (device, _norm(query)) in _CARD_CACHE


def card_cache_snapshot() -> dict:
    h, m = _card_cache_stats["hit"], _card_cache_stats["miss"]
    return {"entries": len(_CARD_CACHE), "ttl_sec": _card_cache_ttl(), "hit": h, "miss": m,
            "hit_rate_pct": round(h / (h + m) * 100, 1) if (h + m) else None, "since": "프로세스 시작 이후"}


def reset_card_cache_for_tests() -> None:
    _CARD_CACHE.clear()
    _card_cache_stats.update({"hit": 0, "miss": 0})


def rank_from_cards(cards: list, biz_name_norm: str, place_id: Optional[str]) -> Optional[int]:
    """카드 목록(화면 순서)에서 내 가게 순위. 광고 카드는 목록에 없으므로 광고 제외 순위다."""
    for idx, c in enumerate(cards[:RESULT_LIMIT], start=1):
        if place_id and c.get("id") == str(place_id):
            return idx
        if not place_id and _is_match(biz_name_norm, c.get("text", "")):
            return idx
    return None


class NaverSearchBlocked(Exception):
    """검색 화면이 CAPTCHA·차단 화면으로 내려왔다 — 가게가 없는 것(미노출)이 아니라 측정 불가."""


_BLOCK_URL_KW = ("captcha", "nid.naver.com", "login.naver.com")
_BLOCK_TITLE_KW = ("로봇", "자동화", "captcha", "CAPTCHA", "보안문자")
_BLOCK_TEXT_RE = re.compile(r"로봇이 아님|자동화된 요청|비정상적인 접근|보안 문자")


async def _is_search_blocked(page: Page) -> bool:
    """가게 카드가 하나도 없을 때만 호출한다(정상 화면에는 비용이 없다). 네트워크 요청 없이 현재 화면만 읽는다."""
    try:
        from services.naver_block import is_naver_block_page
        url = page.url or ""
        title = await page.title() or ""
        body = await page.evaluate("() => (document.body && document.body.innerText) || ''") or ""
        return (
            any(k in url for k in _BLOCK_URL_KW)
            or any(k in title for k in _BLOCK_TITLE_KW)
            or bool(_BLOCK_TEXT_RE.search(body[:500]))
            or is_naver_block_page(body)
        )
    except Exception:
        return False


_PLACE_CARD_JS = r"""
() => {
  const re = /(?:\/place\/|place\.naver\.com\/[a-z]+\/)(\d{6,})/;
  const ids = [], text = {};
  document.querySelectorAll('a[href]').forEach(a => {
    const m = a.href.match(re);
    if (!m) return;
    if (!ids.includes(m[1])) ids.push(m[1]);
    text[m[1]] = (text[m[1]] || '') + ' ' + (a.innerText || '');
  });
  return ids.slice(0, 30).map(id => ({ id, text: text[id] }));
}
"""


_PLACE_LINK_WAIT_JS = r"""
() => Array.from(document.querySelectorAll('a[href]')).some(a => /\/place\/\d{6,}|place\.naver\.com\/[a-z]+\/\d{6,}/.test(a.href))
"""


async def _place_card_rank(
    page: Page,
    biz_name_norm: str,
    place_id: Optional[str],
    cards_out: Optional[dict] = None,
) -> Optional[int]:
    """검색 결과 화면의 가게(플레이스) 카드 노출 순서에서 내 가게 순위를 구한다.

    2026-10-26: 예전엔 li/a 요소 인덱스에서 이름 부분일치로 찾아 블로그 언급·광고에도
    걸렸고, 최후 폴백(HTML에 ID 문자열만 있어도 1위)이 실제 2위를 1위로 부풀렸다.
    이제는 플레이스 링크를 가진 카드만, 화면 순서대로, ID(없으면 카드 글자의 이름)로 찾는다.
    카드에서 못 찾으면 None(미노출) — 임의 대체 금지.
    광고 카드는 플레이스 링크가 아닌 광고 링크라 세지 않는다 — 즉 "광고 제외 순위"다
    (2026-10-26 화면 대조: 같은 가게가 화면에서는 광고 3칸 아래인 4번째로 보여도 1위로 보고됨).
    """
    try:
        # 가게 목록은 페이지 이동 직후가 아니라 조금 뒤에 그려진다 — 가게 링크가 나타날 때까지 기다린다
        # (고정 대기만 쓰면 PC에서 간헐적으로 빈 목록을 읽어 "미노출"로 오판했음)
        try:
            await page.wait_for_function(_PLACE_LINK_WAIT_JS, timeout=8000)
        except Exception:
            pass  # 가게 목록이 아예 없는 검색어일 수 있음 — 아래에서 빈 목록 → None
        await page.wait_for_timeout(800)
        cards = await page.evaluate(_PLACE_CARD_JS)
    except Exception as e:
        _logger.warning(f"keyword_rank 카드 수집 실패: {e}")
        return None
    def _find(cards_: list) -> Optional[int]:
        return rank_from_cards(cards_, biz_name_norm, place_id)

    if cards_out is not None:
        cards_out["cards"] = cards      # 호출자가 공유 캐시에 넣을 수 있게 마지막으로 읽은 목록을 돌려준다
    if not cards and await _is_search_blocked(page):
        raise NaverSearchBlocked()          # 차단 화면은 새로고침하지 않는다(요청을 더 쌓지 않는다)
    rank = _find(cards)
    if rank is None:
        # 간헐적 오판 방지: 네이버가 가끔 가게 목록 없이 광고 블록만 먼저 내려주거나(목록 0개),
        # 목록이 덜 그려진 채 읽힌다. 목록이 비었으면 새로고침 후, 아니면 2초 더 기다린 뒤 한 번 더 확인한다.
        # 실제 미노출이면 같은 결과이므로 비용은 몇 초뿐이다.
        used, cap = naver_playwright_quota_usage()
        if cap > 0 and used >= cap * RECHECK_QUOTA_RATIO:
            _recheck_stats["skipped"] += 1  # 상한 임박 — 선택적 재확인은 건너뛴다(필수 측정 우선)
            return rank
        try:
            _recheck_stats["rechecks"] += 1
            if not cards and check_naver_playwright_quota("naver_keyword_rank.reload"):
                _recheck_stats["reloads"] += 1
                await page.reload(wait_until="domcontentloaded", timeout=PAGE_TIMEOUT_MS)
                try:
                    await page.wait_for_function(_PLACE_LINK_WAIT_JS, timeout=8000)
                except Exception:
                    pass
            await page.wait_for_timeout(2000)
            cards = await page.evaluate(_PLACE_CARD_JS)
            if cards_out is not None:
                cards_out["cards"] = cards
            rank = _find(cards)
        except Exception as e:
            _logger.warning(f"keyword_rank 카드 재확인 실패: {e}")
    return rank


# (구) 요소 인덱스 방식 셀렉터 — 카드 순서 방식으로 대체됨, 참고용으로만 유지
# PC 통합검색 셀렉터 목록 (우선순위 순)
_PC_SELECTORS = [
    "#main_pack li.bx",
    ".api_subject_bx li",
    ".total_wrap li",
    "section li",
    "#main_pack a[href]",
]

# 모바일 셀렉터 목록
_MOBILE_SELECTORS = [
    "#ct li.bx",
    ".api_subject_bx li",
    "li.bx",
    "ul li",
]


async def _measure_pc(
    page: Page,
    keyword: str,
    biz_name_norm: str,
    place_id: Optional[str],
) -> Optional[int]:
    """PC 통합검색 순위."""
    url = f"https://search.naver.com/search.naver?query={keyword}"
    try:
        await page.goto(url, wait_until="networkidle", timeout=PAGE_TIMEOUT_MS)
    except PWTimeout:
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=PAGE_TIMEOUT_MS)
        except Exception:
            _logger.warning(f"keyword_rank PC timeout: {keyword}")
            return None
    except Exception as e:
        _logger.warning(f"keyword_rank PC nav 실패 ({keyword}): {e}")
        return None

    _out: dict = {}
    rank = await _place_card_rank(page, biz_name_norm, place_id, _out)
    _card_cache_put("pc", keyword, _out.get("cards"))
    return rank


async def _measure_place_api(
    keyword: str,
    biz_name: str,
    place_id: Optional[str],
) -> Optional[int]:
    """네이버 플레이스 순위를 공식 지역검색 API(local.json)로 측정.

    2026-08-08: Playwright `where=place` 스크래핑 대신 공식 API로 전환(모듈 docstring 참조).
    place_id가 검색결과 link에 포함되면 그걸 우선 신뢰(가장 정확), 없으면 상호명 매칭.
    """
    data = await _naver_open_api_get(
        "local", {"query": keyword, "display": RESULT_LIMIT, "sort": "sim"}
    )
    if not isinstance(data, dict):
        return None
    for i, item in enumerate(data.get("items", [])):
        link = item.get("link", "") or ""
        if place_id and place_id in link:
            return i + 1
        name = re.sub(r"<[^>]+>", "", item.get("title", "") or "")
        if _nv_name_matches(biz_name, name):
            return i + 1
    return None


async def _measure_mobile(
    page: Page,
    keyword: str,
    biz_name_norm: str,
    place_id: Optional[str],
) -> Optional[int]:
    """모바일 통합검색 순위."""
    url = f"https://m.search.naver.com/search.naver?query={keyword}"
    try:
        await page.goto(url, wait_until="networkidle", timeout=PAGE_TIMEOUT_MS)
    except PWTimeout:
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=PAGE_TIMEOUT_MS)
        except Exception:
            _logger.warning(f"keyword_rank mobile timeout: {keyword}")
            return None
    except Exception as e:
        _logger.warning(f"keyword_rank mobile nav 실패 ({keyword}): {e}")
        return None

    _out: dict = {}
    rank = await _place_card_rank(page, biz_name_norm, place_id, _out)
    _card_cache_put("mobile", keyword, _out.get("cards"))
    return rank


async def measure_keywords(
    keywords: list[str],
    biz_name: str,
    place_id: Optional[str] = None,
    region: Optional[str] = None,
) -> dict:
    """키워드 리스트의 PC/모바일/플레이스 순위 측정."""
    if not keywords:
        return {"_context": {"empty": True, "scanned_at": _now_iso()}}
    if not biz_name:
        return {"_context": {"error": "biz_name 누락", "scanned_at": _now_iso()}}

    async with _semaphore:
        return await _run_with_browser(keywords, biz_name, place_id, region or "")


async def _run_with_browser(
    keywords: list[str],
    biz_name: str,
    place_id: Optional[str],
    region: str = "",
) -> dict:
    """Playwright 브라우저 1회 기동 후 모든 키워드 순차 측정 (RAM 절약)."""
    started_at = _now_iso()
    errors: list[str] = []
    results: dict = {}
    biz_name_norm = _norm(biz_name)

    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
            )
            try:
                pc_ctx = await browser.new_context(locale="ko-KR", user_agent=UA_PC)
                mobile_ctx = await browser.new_context(
                    locale="ko-KR",
                    user_agent=UA_MOBILE,
                    viewport={"width": 390, "height": 844},
                    is_mobile=True,
                    has_touch=True,
                )

                pc_page = await pc_ctx.new_page()
                mobile_page = await mobile_ctx.new_page()

                region_norm = _norm(region)

                for kw in keywords:
                    if not kw or not isinstance(kw, str):
                        continue
                    kw_norm = _norm(kw)
                    # 키워드에 지역 단어(시·군·구 등)가 이미 있으면 다시 붙이지 않는다
                    # ("성동구 미용실"에 "서울 성동구"를 붙여 "서울 성동구 성동구 미용실"이 되던 문제)
                    _region_in_kw = region_norm in kw_norm or any(
                        len(_norm(t)) >= 2 and _norm(t) in kw_norm for t in region.split()
                    )
                    if region and region_norm and not _region_in_kw:
                        search_query = f"{region} {kw}"
                    else:
                        search_query = kw

                    from services.naver_access_guard import begin_search_access, report_search_block, report_search_ok
                    if not begin_search_access("naver_keyword_rank")[0]:
                        # 검색 화면 차단 쿨다운 중 — 네이버 요청 없이 측정 불가로 남긴다(미노출 0점 아님)
                        results[kw] = {"pc_rank": None, "mobile_rank": None, "place_rank": None,
                                       "measured_at": _now_iso(), "search_query": search_query,
                                       "error": "naver_search_cooldown"}
                        continue
                    try:
                        # 2026-08-08: 기존 순차 실행 타이밍 패턴 유지(봇탐지 회피 목적 변경 없음) —
                        # place_rank만 Playwright→공식API로 교체, PC/모바일 순서·간격은 그대로.
                        # 전역 일일 상한(check_naver_playwright_quota) 도달 시 해당 채널은 None
                        # (미측정) — 임의 수치 대체 없음, 다음 사이클에 재시도.
                        _pc_cards = _card_cache_get("pc", search_query)
                        if _pc_cards is not None:     # 같은 검색어를 최근에 읽었다 — 네이버 접속 없이 목록에서 순위만 구한다
                            pc_rank = rank_from_cards(_pc_cards, biz_name_norm, place_id)
                        else:
                            pc_rank = (
                                await _measure_pc(pc_page, search_query, biz_name_norm, place_id)
                                if check_naver_playwright_quota("naver_keyword_rank.pc") else None
                            )
                        # 장소 API 실패가 PC·모바일 결과까지 버리지 않도록 채널별로 격리
                        # (2026-10-26: kind "local.json" ValueError가 전 채널을 None으로 만든 사고)
                        try:
                            place_rank = await _measure_place_api(search_query, biz_name, place_id)
                        except Exception as pe:
                            _logger.warning(f"keyword_rank place API 실패 ({search_query}): {pe}")
                            errors.append(f"{kw}: place:{type(pe).__name__}")
                            place_rank = None
                        _mob_cards = _card_cache_get("mobile", search_query)
                        if _mob_cards is not None:
                            mobile_rank = rank_from_cards(_mob_cards, biz_name_norm, place_id)
                        else:
                            mobile_rank = (
                                await _measure_mobile(mobile_page, search_query, biz_name_norm, place_id)
                                if check_naver_playwright_quota("naver_keyword_rank.mobile") else None
                            )
                        _logger.info(
                            f"keyword_rank '{search_query}': "
                            f"PC={pc_rank} Place={place_rank} Mobile={mobile_rank}"
                        )
                        results[kw] = {
                            "pc_rank": pc_rank,
                            "mobile_rank": mobile_rank,
                            "place_rank": place_rank,
                            "measured_at": _now_iso(),
                            "search_query": search_query,
                        }
                        if _card_seen("pc", search_query) or _card_seen("mobile", search_query):
                            report_search_ok()      # 가게 카드가 있는 정상 화면을 읽었다 — 차단 회복 확인
                    except NaverSearchBlocked:
                        report_search_block("naver_keyword_rank")
                        errors.append(f"{kw}: search_blocked")
                        results[kw] = {"pc_rank": None, "mobile_rank": None, "place_rank": None,
                                       "measured_at": _now_iso(), "search_query": search_query,
                                       "error": "naver_search_blocked"}
                        continue          # 다음 키워드는 위 쿨다운 검사에서 건너뛴다
                    except Exception as e:
                        _logger.warning(f"keyword_rank '{kw}' 실패: {e}")
                        errors.append(f"{kw}: {type(e).__name__}")
                        results[kw] = {
                            "pc_rank": None, "mobile_rank": None, "place_rank": None,
                            "measured_at": _now_iso(),
                            "search_query": search_query,
                            "error": type(e).__name__,
                        }
            finally:
                await browser.close()
    except Exception as e:
        _logger.warning(f"keyword_rank Playwright 자체 실패: {e}")
        errors.append(f"playwright: {type(e).__name__}: {e}")

    results["_context"] = {
        "location": os.getenv("KEYWORD_RANK_LOCATION", "Seoul"),
        "device": "PC+mobile+place",
        "logged_in": False,
        "started_at": started_at,
        "scanned_at": _now_iso(),
        "errors": errors,
        "max_concurrency": MAX_CONCURRENCY,
        "rechecks": dict(_recheck_stats),  # 누적(프로세스 시작 이후): 재확인·새로고침·상한 임박 스킵 횟수
    }
    return results


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
