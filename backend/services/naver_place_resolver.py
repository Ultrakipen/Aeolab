"""네이버 플레이스 ID 자동 확정 (2026-10-26)

배경: 등록 화면의 가게 검색(네이버 지역검색 API)은 플레이스 ID를 주지 않고 `link`에 가게 홈페이지만 준다
(예: 어니언 성수 → https://onionkr.com). `_recover_naver_place_id`(scan.py)도 `link`에서 `place/숫자`를 찾는
방식이라 같은 이유로 복구에 실패한다. ID가 없으면 리뷰 수·평점·소식·소개글·키워드 순위가 수집되지 않고
점수에서 0으로 계산돼, 리뷰가 1만 건 넘는 유명한 가게도 "생존 단계"로 저평가된다.

방법: 네이버 검색 결과 화면의 가게 카드 링크(map.naver.com/p/entry/place/<ID>, m.place.naver.com/<업종>/<ID>)에서
ID를 읽고, **카드 이름이 등록한 이름과 일치할 때만** 확정한다(이름이 비슷한 다른 가게를 고르는 오탐 방지).
후보가 둘 이상이거나 일치가 없으면 확정하지 않는다(ambiguous / none) — 추측으로 채우지 않는다.

주의: Playwright 페이지를 쓰므로 전역 세마포어(PLAYWRIGHT_SEMAPHORE)와 네이버 일일 상한을 공유한다.
이미 세마포어를 쥔 코드 안(예: _run_playwright 내부)에서 호출하면 중첩 획득 데드락이 나므로 호출하지 말 것.
"""
import asyncio
import logging
import re
from typing import Optional
from urllib.parse import quote, urlparse

import utils.cache as _cache

logger = logging.getLogger("aeolab")

_NAVER_PLACE_HOSTS = (
    "map.naver.com", "m.map.naver.com", "place.naver.com", "m.place.naver.com",
    "pcmap.place.naver.com", "naver.me",
)
_ID_RE = re.compile(r"(?:/place/|place\.naver\.com/[a-z]+/)(\d{6,})")

_SEARCH_JS = r"""
() => {
  const re = /(?:\/place\/|place\.naver\.com\/[a-z]+\/)(\d{6,})/;
  const out = [];
  document.querySelectorAll('a[href]').forEach(a => {
    const m = a.href.match(re);
    if (m) out.push({ id: m[1], text: (a.innerText || '').trim().slice(0, 60) });
  });
  return out.slice(0, 60);
}
"""

_POSITIVE_TTL = 6 * 3600
_NEGATIVE_TTL = 12 * 3600
_AMBIGUOUS_TTL = 3600


def is_naver_place_url(url: Optional[str]) -> bool:
    """네이버 플레이스/지도 주소인지 — 가게 홈페이지(예: onionkr.com)가 naver_place_url에 섞이는 것을 거른다."""
    if not url:
        return False
    try:
        host = (urlparse(url.strip()).hostname or "").lower()
    except ValueError:
        return False
    return any(host == h or host.endswith("." + h) for h in _NAVER_PLACE_HOSTS)


def extract_place_id(url: Optional[str]) -> Optional[str]:
    """네이버 플레이스 URL에서 숫자 ID 추출. 네이버 주소가 아니거나 형식이 다르면 None."""
    if not url or not is_naver_place_url(url):
        return None
    m = _ID_RE.search(url)
    return m.group(1) if m else None


def canonical_place_url(place_id: str) -> str:
    return f"https://map.naver.com/p/entry/place/{place_id}"


def _norm(s: Optional[str]) -> str:
    return re.sub(r"[\s\-_·&.,()\[\]]", "", s or "").lower()


_ROAD_RE = re.compile(r"([가-힣A-Za-z0-9]+(?:로|길))\s*(\d+(?:-\d+)?)")


def _road_keys(text: str) -> list:
    """주소 문자열에서 (도로명, 건물번호) 쌍을 모두 뽑는다. 예: '서울 성동구 아차산로9길 8 1, 2층' → [('아차산로9길','8')]"""
    return [(m.group(1), m.group(2)) for m in _ROAD_RE.finditer(text or "")]


def address_matches(biz_address: str, page_text: str) -> Optional[bool]:
    """등록 주소와 플레이스 상세 페이지의 도로명 주소가 같은 건물을 가리키는가.
    True/False — 둘 다 도로명 주소가 있어 비교함 / None — 어느 한쪽에 도로명 주소가 없어 비교할 수 없음(지번 주소만 등)."""
    mine = _road_keys(biz_address)
    theirs = set(_road_keys(page_text))
    if not mine or not theirs:
        return None
    return any(k in theirs for k in mine)


def _name_matches(target: str, text: str) -> bool:
    from services.ai_scanner.chatgpt_scanner import names_match
    return names_match(_norm(target), _norm(text))


def _district(region: str, address: str) -> str:
    """검색 질의에 붙일 구·군·시 단위 지역어 (동명이인·지점 구분용). 없으면 ''."""
    parts = (region or "").split()
    if len(parts) >= 2:
        return parts[1]
    if len(parts) == 1:
        return parts[0]
    for tok in (address or "").split():
        if tok.endswith(("구", "군", "시")):
            return tok
    return ""


async def _collect_cards(query: str) -> list:
    """검색 결과 화면에서 가게 카드 링크(ID, 글자)를 모은다. 세마포어를 직접 획득하므로 중첩 호출 금지."""
    from services.ai_scanner import (
        get_proxy_config, build_chrome_ua, block_heavy_resources,
        attach_bandwidth_counter, note_proxy_result,
    )
    from services.ai_scanner.bandwidth_tracker import record_usage_mb
    from services.ai_scanner.multi_scanner import PLAYWRIGHT_SEMAPHORE, PLAYWRIGHT_QUEUE_TIMEOUT_SEC
    from playwright.async_api import async_playwright
    from services.naver_access_guard import begin_search_access

    # 검색 화면 차단 쿨다운 중에는 접속하지 않는다 — 호출처가 "확정하지 못함(error)"으로 처리한다
    if not begin_search_access("naver_place_resolver")[0]:
        raise RuntimeError("naver_search_cooldown")

    await asyncio.wait_for(PLAYWRIGHT_SEMAPHORE.acquire(), timeout=PLAYWRIGHT_QUEUE_TIMEOUT_SEC)
    try:
        async def _run() -> list:
            async with async_playwright() as pw:
                browser = await pw.chromium.launch(
                    headless=True, channel="chrome", proxy=get_proxy_config(),
                    args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
                          "--disable-blink-features=AutomationControlled"],
                )
                counter = [0]
                try:
                    ctx = await browser.new_context(
                        viewport={"width": 1280, "height": 800}, locale="ko-KR",
                        timezone_id="Asia/Seoul", user_agent=build_chrome_ua(),
                    )
                    await ctx.route("**/*", block_heavy_resources)
                    counter = attach_bandwidth_counter(ctx)
                    page = await ctx.new_page()
                    await page.goto(
                        f"https://search.naver.com/search.naver?query={quote(query)}",
                        wait_until="domcontentloaded", timeout=30000,
                    )
                    note_proxy_result(None)
                    await page.wait_for_timeout(3500)
                    return await page.evaluate(_SEARCH_JS)
                except Exception as e:
                    note_proxy_result(e)
                    raise
                finally:
                    await browser.close()
                    await record_usage_mb(counter[0] / 1024 / 1024)
        return await asyncio.wait_for(_run(), timeout=40.0)
    finally:
        PLAYWRIGHT_SEMAPHORE.release()


async def _fetch_place_page_text(place_id: str) -> str:
    """플레이스 상세(모바일 홈) 본문 텍스트 — 주소 대조용. 세마포어를 직접 획득하므로 중첩 호출 금지."""
    from services.ai_scanner import get_proxy_config, block_heavy_resources, attach_bandwidth_counter, note_proxy_result
    from services.ai_scanner.bandwidth_tracker import record_usage_mb
    from services.ai_scanner.multi_scanner import PLAYWRIGHT_SEMAPHORE, PLAYWRIGHT_QUEUE_TIMEOUT_SEC
    from playwright.async_api import async_playwright

    mobile_ua = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 "
                 "(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1")
    await asyncio.wait_for(PLAYWRIGHT_SEMAPHORE.acquire(), timeout=PLAYWRIGHT_QUEUE_TIMEOUT_SEC)
    try:
        async def _run() -> str:
            async with async_playwright() as pw:
                browser = await pw.chromium.launch(
                    headless=True, channel="chrome", proxy=get_proxy_config(),
                    args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
                )
                counter = [0]
                try:
                    ctx = await browser.new_context(
                        viewport={"width": 390, "height": 844}, user_agent=mobile_ua, locale="ko-KR",
                        timezone_id="Asia/Seoul", is_mobile=True, has_touch=True,
                    )
                    await ctx.route("**/*", block_heavy_resources)
                    counter = attach_bandwidth_counter(ctx)
                    page = await ctx.new_page()
                    await page.goto(f"https://m.place.naver.com/place/{place_id}/home",
                                    wait_until="domcontentloaded", timeout=30000)
                    note_proxy_result(None)
                    await page.wait_for_timeout(4000)
                    return await page.inner_text("body")
                except Exception as e:
                    note_proxy_result(e)
                    raise
                finally:
                    await browser.close()
                    await record_usage_mb(counter[0] / 1024 / 1024)
        return await asyncio.wait_for(_run(), timeout=40.0)
    finally:
        PLAYWRIGHT_SEMAPHORE.release()


async def resolve_naver_place(name: str, region: str = "", address: str = "") -> dict:
    """가게 이름(+지역)으로 네이버 플레이스 ID를 찾는다.

    반환: {status, naver_place_id, naver_place_url, matched_name, candidates}
      status: "unique"(이름 일치 1곳 + 주소 확인됨 — 확정) | "ambiguous"(이름 일치 여러 곳) | "none"(일치 없음)
              | "mismatch"(이름은 같지만 주소가 달라 다른 지점으로 보임) | "unverified"(주소가 없거나 비교 불가 — 확정하지 않음)
              | "quota"(일일 상한) | "error"(접속·구조 문제 — 확정하지 못함)
    """
    name = (name or "").strip()
    empty = {"status": "none", "naver_place_id": None, "naver_place_url": None, "matched_name": None, "candidates": []}
    if not name:
        return empty

    # 주소까지 키에 포함: 같은 이름·지역의 다른 지점이 앞서 확정된 ID를 캐시로 받는 오탐 방지(2026-10-26 시험에서 발견)
    cache_key = f"place_resolve:{_norm(name)}:{_norm(region)}:{_norm(address)}"
    cached = _cache.get(cache_key)
    if cached:
        return cached

    from services.ai_scanner import check_naver_playwright_quota
    district = _district(region, address)
    queries = [q for q in dict.fromkeys([f"{district} {name}".strip(), name]) if q]

    result = dict(empty)
    for q in queries:
        if not check_naver_playwright_quota("naver_place_resolver"):
            return {**empty, "status": "quota"}
        try:
            cards = await _collect_cards(q)
        except Exception as e:  # 세마포어 대기 초과·접속 실패·시간 초과 — 확정하지 않음
            logger.warning(f"[place_resolver] '{q}' 조회 실패: {type(e).__name__}: {e}")
            return {**empty, "status": "error"}

        texts_by_id: dict = {}
        for c in cards or []:
            texts_by_id.setdefault(c["id"], []).append(c.get("text") or "")
        matched = [(pid, next((t for t in texts if t and _name_matches(name, t)), None))
                   for pid, texts in texts_by_id.items()]
        matched = [(pid, t) for pid, t in matched if t]
        if len(matched) == 1:
            pid, t = matched[0]
            # 같은 동네의 이름이 같은 다른 지점을 고르는 오탐 방지: 등록 주소(도로명+건물번호)가
            # 상세 페이지 주소와 같을 때만 확정한다. 주소가 없거나 비교할 수 없으면 확정하지 않는다.
            verdict: Optional[bool] = None
            if address and _road_keys(address):
                try:
                    verdict = address_matches(address, await _fetch_place_page_text(pid))
                except Exception as e:
                    logger.warning(f"[place_resolver] 주소 확인 조회 실패 id={pid}: {type(e).__name__}: {e}")
                    return {**empty, "status": "error"}
            if verdict is True:
                result = {"status": "unique", "naver_place_id": pid, "naver_place_url": canonical_place_url(pid),
                          "matched_name": t, "candidates": [{"id": pid, "name": t}], "address_verified": True}
            elif verdict is False:
                result = {**empty, "status": "mismatch", "matched_name": t, "candidates": [{"id": pid, "name": t}]}
            else:
                result = {**empty, "status": "unverified", "matched_name": t, "candidates": [{"id": pid, "name": t}]}
            break
        if len(matched) > 1:
            result = {**empty, "status": "ambiguous",
                      "candidates": [{"id": pid, "name": t} for pid, t in matched[:5]]}
            break
        await asyncio.sleep(1.5)

    ttl = {"unique": _POSITIVE_TTL, "none": _NEGATIVE_TTL, "ambiguous": _AMBIGUOUS_TTL,
           "mismatch": _NEGATIVE_TTL, "unverified": _NEGATIVE_TTL}.get(result["status"])
    if ttl:
        _cache.set(cache_key, result, ttl)
    logger.info(f"[place_resolver] name='{name}' region='{region}' → {result['status']} id={result['naver_place_id']}")
    return result


async def ensure_naver_place_id(biz: dict) -> str:
    """사업장에 플레이스 ID가 없으면 URL에서 추출하고, 그래도 없으면 검색 화면에서 확정해 businesses에 저장한다.

    반환: 확정된 place_id 또는 ''(없음/모호/실패 — 이때는 아무것도 저장하지 않는다).
    """
    pid = (biz.get("naver_place_id") or "").strip()
    if pid:
        return pid
    biz_id = biz.get("id")
    if not biz_id:
        return ""

    from db.supabase_client import get_client, execute
    supabase = get_client()
    url = biz.get("naver_place_url") or ""

    pid = extract_place_id(url) or ""
    resolved = None
    if not pid:
        if _cache.get(f"place_none:{biz_id}"):
            return ""
        resolved = await resolve_naver_place(biz.get("name") or "", biz.get("region") or "", biz.get("address") or "")
        if resolved["status"] != "unique":
            # 일시적 실패(error·quota)는 기억하지 않는다 — 다음 분석에서 다시 시도. 찾지 못함/모호함만 반복 조회를 막는다
            if resolved["status"] in ("none", "ambiguous", "mismatch", "unverified"):
                _cache.set(f"place_none:{biz_id}", True, _NEGATIVE_TTL)
            return ""
        pid = resolved["naver_place_id"]

    update = {"naver_place_id": pid}
    if not is_naver_place_url(url):  # 비었거나 가게 홈페이지 등이 들어 있으면 네이버 주소로 교체
        update["naver_place_url"] = canonical_place_url(pid)
    try:
        await execute(supabase.table("businesses").update(update).eq("id", biz_id))
        logger.info(f"[place_resolver] biz={biz_id} naver_place_id={pid} 저장 (source={'url' if resolved is None else 'search'})")
    except Exception as e:
        logger.warning(f"[place_resolver] biz={biz_id} 저장 실패: {e}")
        return ""
    return pid
