"""
backend/services/area_nearby.py

내 가게 중심 반경 300m 업종 분포 — 소상공인시장진흥공단 상가(상권)정보 `storeListInRadius`(data.go.kr).

설계(2026-11-20, 사용자 요구: "구/시 단위가 아니라 가게 중심 반경 300m, 업종은 더 구체적으로"):
- 업종 코드로 거르지 않고 반경 안의 모든 업소를 페이지(1,000건)로 받아 **소분류 이름별로 직접 센다**.
  실호출(2026-11-20): 성수 1,640 · 강남역 3,358 · 창원 상남 772곳, 소분류 120~140종 — 코드 11개 묶음(음식점·미용 등)보다 구체적이고
  호출도 1~4번이라 오히려 적다. 응답 1회 0.25초.
- 방문자 요청마다 외부 API를 부르므로(스냅샷 방식 불가 — 좌표가 임의) 부하 보호 4종: 같은 좌표 24시간 캐시 · 동시 2건 ·
  IP당 분당 12회 · 하루 총 호출 상한(수집 스크립트와 같은 data.go.kr 키 한도를 공유하므로).
- 개별 가게 이름·주소·상가 ID는 응답에 넣지 않는다(집계 수만). 좌표·검색어는 저장·로그하지 않는다.
- 이 API는 폐업 정보가 없다 — 반경 300m 폐업 현황은 제공하지 않고 화면에 그렇게 적는다(구/시 단위 누적 폐업은 지역 페이지).
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from collections import Counter, OrderedDict, deque
from datetime import datetime, timedelta, timezone

import aiohttp

_logger = logging.getLogger("aeolab.area_nearby")

_SBIZ_URL = "https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius"
_KAKAO_ADDRESS_URL = "https://dapi.kakao.com/v2/local/search/address.json"
_KAKAO_KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"

RADIUS_M = 300
PAGE_ROWS = 1000
MAX_PAGES = 6  # 최대 6,000곳. 실측 최대(강남역 3,358)의 약 2배 — 넘으면 일부만 센 것으로 표시한다
CACHE_TTL_SEC = 24 * 3600  # 상가정보 기준월이 한 달 단위로 바뀌므로 하루 캐시면 충분
CACHE_MAX = 400
PLACE_CACHE_TTL_SEC = 3600
RATE_PER_MIN = 12
KST = timezone(timedelta(hours=9))

# 한국 영역(좌표 검증) — 범위 밖 값으로 외부 API를 부르지 않는다
LON_RANGE = (124.0, 132.0)
LAT_RANGE = (33.0, 39.0)

_cache: "OrderedDict[tuple[float, float], tuple[float, dict]]" = OrderedDict()
_place_cache: "OrderedDict[str, tuple[float, list]]" = OrderedDict()
_sem: asyncio.Semaphore | None = None
_hits: dict[str, deque] = {}
_budget = {"day": "", "used": 0}


class RateLimited(Exception):
    pass


class DailyLimit(Exception):
    pass


def _semaphore() -> asyncio.Semaphore:
    global _sem
    if _sem is None:
        _sem = asyncio.Semaphore(2)
    return _sem


def daily_limit() -> int:
    try:
        return max(0, int(os.getenv("AREA_NEARBY_DAILY_CALLS", "1500")))
    except ValueError:
        return 1500


def _spend(n: int = 1) -> None:
    """data.go.kr 호출 1회를 예산에서 차감한다. 한도를 넘으면 호출하지 않고 DailyLimit."""
    today = datetime.now(KST).strftime("%Y-%m-%d")
    if _budget["day"] != today:
        _budget["day"], _budget["used"] = today, 0
    if _budget["used"] + n > daily_limit():
        raise DailyLimit()
    _budget["used"] += n


def check_rate(ip: str, now: float | None = None) -> None:
    """IP당 분당 RATE_PER_MIN회. 초과 시 RateLimited. (프로세스 1개 기준 메모리 카운터)"""
    t = time.monotonic() if now is None else now
    dq = _hits.setdefault(ip or "unknown", deque())
    while dq and t - dq[0] > 60:
        dq.popleft()
    if len(dq) >= RATE_PER_MIN:
        raise RateLimited()
    dq.append(t)
    if len(_hits) > 5000:  # 메모리 방어 — 오래된 키 정리
        for k in [k for k, v in _hits.items() if not v or t - v[-1] > 60]:
            _hits.pop(k, None)


def valid_coords(lon: float, lat: float) -> bool:
    return LON_RANGE[0] <= lon <= LON_RANGE[1] and LAT_RANGE[0] <= lat <= LAT_RANGE[1]


def _lru_put(store: OrderedDict, key, value, limit: int) -> None:
    store[key] = value
    store.move_to_end(key)
    while len(store) > limit:
        store.popitem(last=False)


async def _fetch_page(cx: float, cy: float, page: int) -> dict | None:
    """storeListInRadius 한 페이지 — 실패 시 None(호출부가 '일부만 집계'로 표시)."""
    key = os.getenv("SBIZ_API_KEY")
    if not key:
        return None
    params = {"serviceKey": key, "cx": cx, "cy": cy, "radius": RADIUS_M, "type": "json",
              "numOfRows": PAGE_ROWS, "pageNo": page}
    for attempt in (1, 2):
        try:
            _spend()
            async with aiohttp.ClientSession() as s:
                async with s.get(_SBIZ_URL, params=params, timeout=aiohttp.ClientTimeout(total=15)) as r:
                    if r.status == 200:
                        data = await r.json()
                        if data.get("body") is not None:
                            return data
                        _logger.warning("area_nearby_no_body page=%s", page)
                        return None
        except DailyLimit:
            raise
        except (aiohttp.ClientError, asyncio.TimeoutError, ValueError) as e:
            _logger.warning("area_nearby_fetch_error page=%s try=%s: %s", page, attempt, type(e).__name__)
        await asyncio.sleep(1.0)
    return None


def aggregate(pages: list[dict], expected_total: int) -> dict:
    """페이지 응답 → 소분류별 개수. 상가 ID로 중복 제거, 이름·주소는 버린다."""
    seen: set[str] = set()
    counts: Counter = Counter()
    stdr_ym = None
    for d in pages:
        stdr_ym = stdr_ym or d.get("header", {}).get("stdrYm")
        for it in d.get("body", {}).get("items") or []:
            bid = it.get("bizesId")
            if bid:
                if bid in seen:
                    continue
                seen.add(bid)
            lcls = (it.get("indsLclsNm") or "").strip() or "기타"
            mcls = (it.get("indsMclsNm") or "").strip() or "기타"
            scls = (it.get("indsSclsNm") or "").strip() or "기타"
            counts[(lcls, mcls, scls)] += 1
    counted = sum(counts.values())
    groups = [{"lcls": k[0], "mcls": k[1], "scls": k[2], "count": v}
              for k, v in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))]
    return {"counted": counted, "stdr_ym": stdr_ym, "groups": groups,
            # 받은 수가 API가 알려 준 전체 수보다 적으면(페이지 실패·상한) 적게 집계된 것
            "complete": expected_total > 0 and counted >= expected_total}


async def nearby(lon: float, lat: float) -> dict:
    """좌표 중심 반경 300m 업종 분포. 외부 호출 실패는 available False(0곳처럼 보이지 않게)."""
    cx, cy = round(lon, 5), round(lat, 5)
    hit = _cache.get((cx, cy))
    if hit and time.time() - hit[0] < CACHE_TTL_SEC:
        _cache.move_to_end((cx, cy))
        return hit[1]

    async with _semaphore():
        hit = _cache.get((cx, cy))  # 대기하는 동안 같은 좌표가 채워졌을 수 있다
        if hit and time.time() - hit[0] < CACHE_TTL_SEC:
            return hit[1]
        first = await _fetch_page(cx, cy, 1)
        if first is None:
            return {"available": False, "reason": "fetch_failed", "radius_m": RADIUS_M}
        total = int(first.get("body", {}).get("totalCount") or 0)
        pages = [first]
        need = min(MAX_PAGES, -(-total // PAGE_ROWS))
        for p in range(2, need + 1):
            d = await _fetch_page(cx, cy, p)
            if d is not None:
                pages.append(d)
        agg = aggregate(pages, total)
        result = {
            "available": True,
            "radius_m": RADIUS_M,
            "center": {"lon": cx, "lat": cy},
            "total": total,
            "counted": agg["counted"],
            "complete": agg["complete"],
            "stdr_ym": agg["stdr_ym"],
            "groups": agg["groups"],
        }
        # 일부만 센 결과는 캐시하지 않는다(다음 방문자가 다시 시도) — 단 0곳도 사실이면 캐시
        if agg["complete"] or total == 0:
            _lru_put(_cache, (cx, cy), (time.time(), result), CACHE_MAX)
        return result


async def search_places(query: str) -> list[dict] | None:
    """가게 이름·주소 → 후보 최대 5곳(이름·주소·좌표). 카카오 주소검색 → 키워드검색 순. 실패는 None."""
    q = " ".join((query or "").split())
    if len(q) < 2 or len(q) > 60:
        return []
    hit = _place_cache.get(q)
    if hit and time.time() - hit[0] < PLACE_CACHE_TTL_SEC:
        return hit[1]
    key = os.getenv("KAKAO_REST_API_KEY")
    if not key:
        return None
    headers = {"Authorization": f"KakaoAK {key}"}
    out: list[dict] = []
    try:
        async with aiohttp.ClientSession(headers=headers) as s:
            async with s.get(_KAKAO_ADDRESS_URL, params={"query": q, "size": 5},
                             timeout=aiohttp.ClientTimeout(total=6)) as r:
                if r.status == 200:
                    for d in (await r.json()).get("documents", []):
                        out.append({"label": d.get("address_name", ""), "address": d.get("address_name", ""),
                                    "lon": float(d["x"]), "lat": float(d["y"])})
            if not out:
                async with s.get(_KAKAO_KEYWORD_URL, params={"query": q, "size": 5},
                                 timeout=aiohttp.ClientTimeout(total=6)) as r:
                    if r.status == 200:
                        for d in (await r.json()).get("documents", []):
                            out.append({"label": d.get("place_name", ""),
                                        "address": d.get("road_address_name") or d.get("address_name", ""),
                                        "lon": float(d["x"]), "lat": float(d["y"])})
    except (aiohttp.ClientError, asyncio.TimeoutError, ValueError, KeyError) as e:
        _logger.warning("area_nearby_geocode_error: %s", type(e).__name__)
        return None
    out = [p for p in out if valid_coords(p["lon"], p["lat"])][:5]
    _lru_put(_place_cache, q, (time.time(), out), CACHE_MAX)
    return out
