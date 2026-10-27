"""키워드 순위 카드 목록 공유 캐시 테스트 (2026-10-27): 같은 검색어는 페이지를 한 번만 연다."""
import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import naver_keyword_rank as kr  # noqa: E402

CARDS = [{"id": "111", "text": "가게A"}, {"id": "222", "text": "어니언 성수"}, {"id": "333", "text": "가게C"}]


@pytest.fixture(autouse=True)
def _clean(monkeypatch):
    kr.reset_card_cache_for_tests()
    monkeypatch.delenv("KEYWORD_RANK_CARD_CACHE_TTL_SEC", raising=False)
    yield
    kr.reset_card_cache_for_tests()


class _Obj:
    def __getattr__(self, name):
        async def _f(*a, **k):
            return _Obj()
        return _f


class _PW:
    chromium = None

    def __init__(self):
        self.chromium = self

    async def launch(self, **k):
        return _Obj()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False


def _stub(monkeypatch, cards=CARDS):
    pages = []

    async def fake_page(page, query, biz_norm, pid):
        pages.append(query)
        kr._card_cache_put("pc", query, cards)
        return kr.rank_from_cards(cards, biz_norm, pid)

    async def fake_mobile(page, query, biz_norm, pid):
        pages.append("m:" + query)
        kr._card_cache_put("mobile", query, cards)
        return kr.rank_from_cards(cards, biz_norm, pid)

    async def fake_api(*a, **k):
        return 1

    monkeypatch.setattr(kr, "async_playwright", lambda: _PW())
    monkeypatch.setattr(kr, "_measure_pc", fake_page)
    monkeypatch.setattr(kr, "_measure_mobile", fake_mobile)
    monkeypatch.setattr(kr, "_measure_place_api", fake_api)
    monkeypatch.setattr(kr, "check_naver_playwright_quota", lambda *a, **k: True)
    return pages


def test_rank_from_cards_by_id_and_name():
    assert kr.rank_from_cards(CARDS, kr._norm("x"), "222") == 2
    assert kr.rank_from_cards(CARDS, kr._norm("어니언 성수"), None) == 2
    assert kr.rank_from_cards(CARDS, kr._norm("없는가게"), "999") is None


def test_second_business_with_same_query_opens_no_page(monkeypatch):
    pages = _stub(monkeypatch)
    a = asyncio.run(kr._run_with_browser(["성수 카페"], "어니언 성수", "222", ""))
    b = asyncio.run(kr._run_with_browser(["성수 카페"], "가게C", "333", ""))
    assert pages == ["성수 카페", "m:성수 카페"]                  # 첫 사업장만 PC·모바일을 연다
    assert a["성수 카페"]["pc_rank"] == 2 and b["성수 카페"]["pc_rank"] == 3   # 순위는 각자의 위치로 계산
    assert b["성수 카페"]["mobile_rank"] == 3


def test_cache_hit_does_not_consume_quota(monkeypatch):
    _stub(monkeypatch)
    used = []
    monkeypatch.setattr(kr, "check_naver_playwright_quota", lambda *a, **k: used.append(a) or True)
    asyncio.run(kr._run_with_browser(["성수 카페"], "어니언 성수", "222", ""))
    n = len(used)
    asyncio.run(kr._run_with_browser(["성수 카페"], "가게C", "333", ""))
    assert len(used) == n


def test_empty_card_list_is_never_cached(monkeypatch):
    kr._card_cache_put("pc", "성수 카페", [])
    assert kr._card_cache_get("pc", "성수 카페") is None


def test_pc_and_mobile_lists_are_separate():
    kr._card_cache_put("pc", "성수 카페", CARDS)
    assert kr._card_cache_get("mobile", "성수 카페") is None


def test_cache_can_be_disabled(monkeypatch):
    monkeypatch.setenv("KEYWORD_RANK_CARD_CACHE_TTL_SEC", "0")
    kr._card_cache_put("pc", "성수 카페", CARDS)
    assert kr._card_cache_get("pc", "성수 카페") is None


def test_expired_entry_is_reopened():
    kr._card_cache_put("pc", "성수 카페", CARDS)
    t, c = kr._CARD_CACHE[("pc", kr._norm("성수 카페"))]
    kr._CARD_CACHE[("pc", kr._norm("성수 카페"))] = (t - 22000, c)    # 기본 6시간(21600초) 경과
    assert kr._card_cache_get("pc", "성수 카페") is None


def test_hit_rate_snapshot():
    kr._card_cache_put("pc", "q", CARDS)
    kr._card_cache_get("pc", "q")       # hit
    kr._card_cache_get("pc", "other")   # miss
    s = kr.card_cache_snapshot()
    assert s["hit"] == 1 and s["miss"] == 1 and s["hit_rate_pct"] == 50.0
