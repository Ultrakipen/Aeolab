"""반경 300m 업종 분포: 집계·중복 제거·일부만 센 경우 표시·캐시·예산·IP 한도·좌표 검증·가게 정보 비노출."""
import asyncio

import pytest
from fastapi import HTTPException

from services import area_nearby as an


def _item(bid, l, m, s, name="가게이름A", addr="서울 어딘가 1"):
    return {"bizesId": bid, "bizesNm": name, "rdnmAdr": addr, "indsLclsNm": l, "indsMclsNm": m, "indsSclsNm": s}


def _page(items, total, ym="202609"):
    return {"header": {"stdrYm": ym}, "body": {"totalCount": total, "items": items}}


@pytest.fixture(autouse=True)
def _reset():
    an._cache.clear(); an._place_cache.clear(); an._hits.clear(); an._ip_misses.clear(); an._ip_miss_day['day'] = ''
    an._budget.update({"day": "", "used": 0})
    an._sem = None
    yield
    an._cache.clear(); an._place_cache.clear(); an._hits.clear()


def test_aggregate_counts_by_subcategory_and_dedups():
    p = [_page([_item("1", "음식", "한식 ", "백반"), _item("2", "음식", "한식", "백반"), _item("3", "음식", "비알코올", "카페")], 4),
         _page([_item("3", "음식", "비알코올", "카페"), _item("4", "소매", "종합 소매", "편의점")], 4)]
    a = an.aggregate(p, 4)
    by = {g["scls"]: g["count"] for g in a["groups"]}
    assert by == {"백반": 2, "카페": 1, "편의점": 1}  # 중복 id "3"은 한 번만
    assert a["counted"] == 4 and a["complete"] is True
    assert a["groups"][0]["mcls"] == "한식"  # 이름 공백 정리


def test_aggregate_marks_incomplete_when_fewer_than_total():
    a = an.aggregate([_page([_item("1", "a", "b", "c")], 5)], 5)
    assert a["counted"] == 1 and a["complete"] is False


def test_no_store_identity_in_result(monkeypatch):
    async def fake(cx, cy, page):
        return _page([_item("1", "음식", "한식", "백반", name="비밀식당", addr="비밀로 7")], 1)
    monkeypatch.setattr(an, "_fetch_page", fake)
    r = asyncio.run(an.nearby(127.0, 37.5))
    blob = str(r)
    assert "비밀식당" not in blob and "비밀로" not in blob and "bizesId" not in blob
    assert r["total"] == 1 and r["complete"] is True and r["radius_m"] == 300


def test_pages_requested_by_total_and_capped(monkeypatch):
    seen = []

    async def fake(cx, cy, page):
        seen.append(page)
        return _page([_item(f"{page}-{i}", "a", "b", "c") for i in range(3)], 2500)
    monkeypatch.setattr(an, "_fetch_page", fake)
    r = asyncio.run(an.nearby(127.0, 37.5))
    assert seen == [1, 2, 3]  # 2,500곳 → 3페이지
    assert r["complete"] is False  # 실제로는 9곳만 받음 → 적게 집계됨 표시
    seen.clear()

    async def huge(cx, cy, page):
        seen.append(page)
        return _page([], 999999)
    monkeypatch.setattr(an, "_fetch_page", huge)
    asyncio.run(an.nearby(127.1, 37.6))
    assert max(seen) == an.MAX_PAGES


def test_failed_first_page_is_unavailable_not_zero(monkeypatch):
    async def fake(cx, cy, page):
        return None
    monkeypatch.setattr(an, "_fetch_page", fake)
    r = asyncio.run(an.nearby(127.0, 37.5))
    assert r["available"] is False and "total" not in r


def test_cache_hit_skips_external_and_partial_not_cached(monkeypatch):
    calls = []

    async def ok(cx, cy, page):
        calls.append(page)
        return _page([_item("1", "a", "b", "c")], 1)
    monkeypatch.setattr(an, "_fetch_page", ok)
    asyncio.run(an.nearby(127.0, 37.5)); asyncio.run(an.nearby(127.0, 37.5))
    assert calls == [1]  # 두 번째는 캐시

    calls.clear()

    async def partial(cx, cy, page):
        calls.append(page)
        return _page([_item("1", "a", "b", "c")], 3)
    monkeypatch.setattr(an, "_fetch_page", partial)
    asyncio.run(an.nearby(128.0, 36.5)); asyncio.run(an.nearby(128.0, 36.5))
    assert calls == [1, 1]  # 일부만 센 결과는 캐시하지 않아 다시 시도


def test_daily_budget_blocks_external_calls(monkeypatch):
    monkeypatch.setenv("AREA_NEARBY_DAILY_CALLS", "2")
    an._spend(); an._spend()
    with pytest.raises(an.DailyLimit):
        an._spend()


def test_rate_limit_per_ip_per_minute():
    for i in range(an.RATE_PER_MIN):
        an.check_rate("1.1.1.1", now=100.0 + i * 0.1)
    with pytest.raises(an.RateLimited):
        an.check_rate("1.1.1.1", now=101.5)
    an.check_rate("2.2.2.2", now=101.5)  # 다른 IP는 영향 없음
    an.check_rate("1.1.1.1", now=161.0)  # 1분 지나면 다시 가능


def test_coordinate_validation_and_router(monkeypatch):
    assert an.valid_coords(127.0, 37.5) and not an.valid_coords(0, 0) and not an.valid_coords(37.5, 127.0)
    from routers import area as r

    class Req:
        headers = {"X-Real-IP": "9.9.9.9"}
        client = None
    with pytest.raises(HTTPException) as e:
        asyncio.run(r.area_nearby_counts(Req(), lon=0.0, lat=0.0))
    assert e.value.status_code == 422

    async def boom(lon, lat, ip=None):
        raise an.DailyLimit()
    monkeypatch.setattr(an, "nearby", boom)
    out = asyncio.run(r.area_nearby_counts(Req(), lon=127.0, lat=37.5))
    assert out["available"] is False and out["reason"] == "daily_limit"


def test_search_places_short_query_makes_no_call():
    assert asyncio.run(an.search_places("가")) == []


def test_ip_daily_miss_cap_counts_only_cache_misses(monkeypatch):
    monkeypatch.setenv("AREA_NEARBY_IP_DAILY_MISSES", "2")

    async def ok(cx, cy, page):
        return _page([_item("1", "a", "b", "c")], 1)
    monkeypatch.setattr(an, "_fetch_page", ok)
    asyncio.run(an.nearby(127.0, 37.5, ip="7.7.7.7"))   # 미스 1
    asyncio.run(an.nearby(127.0, 37.5, ip="7.7.7.7"))   # 캐시 적중 — 세지 않음
    asyncio.run(an.nearby(127.1, 37.5, ip="7.7.7.7"))   # 미스 2
    with pytest.raises(an.IpDailyLimit):
        asyncio.run(an.nearby(127.2, 37.5, ip="7.7.7.7"))  # 미스 3 → 거부
    asyncio.run(an.nearby(127.2, 37.5, ip="8.8.8.8"))   # 다른 IP는 영향 없음
    asyncio.run(an.nearby(127.0, 37.5, ip="7.7.7.7"))   # 캐시에 있는 좌표는 한도 뒤에도 가능


def test_deadline_returns_unavailable_not_hang(monkeypatch):
    monkeypatch.setattr(an, "DEADLINE_SEC", 0.05)

    async def slow(cx, cy, page):
        await asyncio.sleep(1)
        return _page([], 0)
    monkeypatch.setattr(an, "_fetch_page", slow)
    r = asyncio.run(an.nearby(127.0, 37.5))
    assert r["available"] is False and r["reason"] == "fetch_failed"
