"""사용자 증가 대비 네이버 접속 보강 테스트 (2026-10-27): 경쟁사 재사용 캐시, 사진 탭 설정, 관리자 상태 조회."""
import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import services.competitor_place_crawler as cc  # noqa: E402
from services.place_page_signals import photo_tab_enabled  # noqa: E402


@pytest.fixture(autouse=True)
def _clean_cache(monkeypatch):
    cc._PLACE_CACHE.clear()
    monkeypatch.delenv("COMPETITOR_PLACE_CACHE_TTL_SEC", raising=False)
    yield
    cc._PLACE_CACHE.clear()


def _stub_crawl(monkeypatch, results):
    calls = []

    async def fake(place_id):
        calls.append(place_id)
        return results.pop(0) if results else {"naver_place_id": place_id, "review_count": 1, "error": None}

    monkeypatch.setattr(cc, "_run_place_crawl", fake)

    async def no_pace(*a, **k):
        return None

    import services.naver_access_guard as g
    monkeypatch.setattr(g, "place_pace", no_pace)

    async def no_rate(*a, **k):      # 속도 기준은 test_naver_rate_limit.py에서 따로 검증
        return True, None, 0.0

    monkeypatch.setattr(g, "reserve_place_pages", no_rate)
    return calls


def test_same_place_is_crawled_once_across_businesses(monkeypatch):
    calls = _stub_crawl(monkeypatch, [{"naver_place_id": "111", "review_count": 50, "error": None}])
    a = asyncio.run(cc.fetch_competitor_place_data("111"))
    b = asyncio.run(cc.fetch_competitor_place_data("111"))     # 다른 사업장이 같은 경쟁사를 등록한 경우
    assert calls == ["111"]                                    # 네이버 접속은 1번
    assert a["review_count"] == b["review_count"] == 50


def test_different_places_are_crawled_separately(monkeypatch):
    calls = _stub_crawl(monkeypatch, [])
    asyncio.run(cc.fetch_competitor_place_data("111"))
    asyncio.run(cc.fetch_competitor_place_data("222"))
    assert calls == ["111", "222"]


def test_failed_crawl_is_not_cached_so_it_retries(monkeypatch):
    calls = _stub_crawl(monkeypatch, [{"naver_place_id": "111", "error": "ip_blocked"},
                                      {"naver_place_id": "111", "review_count": 9, "error": None}])
    first = asyncio.run(cc.fetch_competitor_place_data("111"))
    second = asyncio.run(cc.fetch_competitor_place_data("111"))
    assert first["error"] == "ip_blocked" and second["review_count"] == 9
    assert calls == ["111", "111"]                             # 실패 결과는 재사용하지 않는다


def test_cache_returns_independent_copies(monkeypatch):
    _stub_crawl(monkeypatch, [{"naver_place_id": "111", "review_count": 7, "error": None}])
    a = asyncio.run(cc.fetch_competitor_place_data("111"))
    a["review_count"] = 999                                    # 호출자가 값을 바꿔도
    b = asyncio.run(cc.fetch_competitor_place_data("111"))
    assert b["review_count"] == 7                              # 캐시는 그대로


def test_cache_can_be_disabled_with_zero_ttl(monkeypatch):
    monkeypatch.setenv("COMPETITOR_PLACE_CACHE_TTL_SEC", "0")
    calls = _stub_crawl(monkeypatch, [])
    asyncio.run(cc.fetch_competitor_place_data("111"))
    asyncio.run(cc.fetch_competitor_place_data("111"))
    assert calls == ["111", "111"]


def test_expired_entry_is_recrawled(monkeypatch):
    calls = _stub_crawl(monkeypatch, [])
    asyncio.run(cc.fetch_competitor_place_data("111"))
    t, data = cc._PLACE_CACHE["111"]
    cc._PLACE_CACHE["111"] = (t - 260000, data)               # 기본 TTL 72시간(259200초) 경과
    asyncio.run(cc.fetch_competitor_place_data("111"))
    assert calls == ["111", "111"]


def test_cache_is_bounded(monkeypatch):
    _stub_crawl(monkeypatch, [])
    monkeypatch.setattr(cc, "_PLACE_CACHE_MAX", 3)
    for pid in ("1", "2", "3", "4", "5"):
        asyncio.run(cc.fetch_competitor_place_data(pid))
    assert len(cc._PLACE_CACHE) <= 3


def test_default_ttl_covers_tuesday_sync_to_thursday_enrich():
    assert cc._place_cache_ttl() >= 48 * 3600     # 화 03:30 크롤 → 목 03:00 보강까지(약 47.5시간) 재사용


def test_cache_hit_does_not_consume_quota_or_touch_circuit(monkeypatch):
    import services.ai_scanner as sc
    _stub_crawl(monkeypatch, [])
    asyncio.run(cc.fetch_competitor_place_data("111"))
    used = sc.naver_playwright_quota_snapshot()["used"]
    asyncio.run(cc.fetch_competitor_place_data("111"))
    assert sc.naver_playwright_quota_snapshot()["used"] == used   # 재사용은 상한을 쓰지 않는다


def test_photo_tab_is_off_by_default_and_can_be_enabled(monkeypatch):
    monkeypatch.delenv("PLACE_PHOTO_TAB_ENABLED", raising=False)
    assert photo_tab_enabled() is False
    monkeypatch.setenv("PLACE_PHOTO_TAB_ENABLED", "true")
    assert photo_tab_enabled() is True


def test_admin_naver_access_endpoint_reports_state_without_secrets():
    from routers.admin import get_naver_access
    out = asyncio.run(get_naver_access(_=None))
    assert set(out) == {"quota", "place_breaker", "rate", "history", "settings"}
    assert {"used", "cap", "batch_used", "batch_cap", "by_source", "used_pct"} <= set(out["quota"])
    assert {"open", "remaining_sec", "strikes"} <= set(out["place_breaker"])
    assert set(out["settings"]) == {"slot_spread_enabled", "photo_tab_enabled"}
    assert "cookie" not in str(out).lower() and "token" not in str(out).lower()
