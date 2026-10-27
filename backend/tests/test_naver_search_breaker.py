"""검색 화면(브리핑·AI탭·순위) 차단 회로 테스트 (2026-10-27): 차단 화면은 미노출이 아니라 측정 불가, 쿨다운 중 네이버 요청 없음."""
import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import naver_access_guard as g  # noqa: E402
from services import naver_keyword_rank as kr  # noqa: E402


def test_closed_by_default_and_opens_on_block():
    assert g.begin_search_access("t", now=1000.0) == (True, None)
    assert g.report_search_block("t", now=1000.0) == 60
    assert g.begin_search_access("t", now=1000.0 + 59 * 60) == (False, g.SEARCH_COOLDOWN_ERROR)
    assert g.begin_search_access("t", now=1000.0 + 61 * 60) == (True, None)


def test_consecutive_blocks_escalate_and_ok_resets():
    g.report_search_block("t", now=1000.0)
    assert g.report_search_block("t", now=1000.0 + 61 * 60) == 180
    g.report_search_ok()
    assert g.search_snapshot()["strikes"] == 0
    assert g.report_search_block("t", now=9e9) == 60


def test_duplicate_report_while_open_does_not_escalate():
    g.report_search_block("t", now=1000.0)
    g.report_search_block("t", now=1010.0)
    assert g.search_snapshot()["strikes"] == 1


def test_search_state_survives_restart():
    g.report_search_block("t", now=1000.0)
    g._search_loaded = False
    g._search.update({"strikes": 0, "open_until": 0.0})
    assert g.begin_search_access("t", now=1001.0)[0] is False


def test_search_block_is_independent_of_place_circuit():
    g.report_search_block("t", now=1000.0)
    assert g.begin_place_access("t", now=1001.0) == (True, None)


class _Page:
    def __init__(self, url="https://search.naver.com/x", title="", body="", cards=None):
        self.url, self._title, self._body, self._cards = url, title, body, cards or []

    async def title(self):
        return self._title

    async def evaluate(self, js, *a):
        return self._cards if "a[href]" in js and "ids" in js else self._body

    async def wait_for_function(self, *a, **k):
        return None

    async def wait_for_timeout(self, *a, **k):
        return None

    async def reload(self, *a, **k):
        raise AssertionError("차단 화면은 새로고침하면 안 된다")


def test_captcha_page_raises_instead_of_reporting_not_exposed():
    page = _Page(url="https://nid.naver.com/captcha", body="")
    with pytest.raises(kr.NaverSearchBlocked):
        asyncio.run(kr._place_card_rank(page, kr._norm("가게"), "123"))


def test_block_text_page_raises():
    page = _Page(body="서비스 이용이 제한되었습니다. 과도한 접근 요청입니다. 잠시 후 다시 시도해주세요.")
    with pytest.raises(kr.NaverSearchBlocked):
        asyncio.run(kr._place_card_rank(page, kr._norm("가게"), "123"))


def test_normal_page_with_cards_is_not_blocked():
    page = _Page(cards=[{"id": "123", "text": "가게"}], body="정상")
    assert asyncio.run(kr._place_card_rank(page, kr._norm("가게"), "123")) == 1


def test_genuinely_empty_normal_page_is_not_blocked(monkeypatch):
    """카드가 없어도 차단 신호가 없으면 기존처럼 미노출(None) 처리."""
    async def noreload(*a, **k): return None
    page = _Page(body="검색 결과가 없습니다")
    page.reload = noreload
    assert asyncio.run(kr._place_card_rank(page, kr._norm("가게"), "123")) is None


class _Obj:
    def __getattr__(self, name):
        async def _f(*a, **k):
            return _Obj()
        return _f


class _PW:
    def __init__(self):
        self.chromium = self

    async def launch(self, **k):
        return _Obj()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False


def test_keyword_loop_records_error_and_skips_rest_during_cooldown(monkeypatch):
    kr.reset_card_cache_for_tests()
    calls = []

    async def blocked(page, q, n, p):
        calls.append(q)
        raise kr.NaverSearchBlocked()

    async def api(*a, **k): return 1

    monkeypatch.setattr(kr, "async_playwright", lambda: _PW())
    monkeypatch.setattr(kr, "_measure_pc", blocked)
    monkeypatch.setattr(kr, "_measure_place_api", api)
    monkeypatch.setattr(kr, "check_naver_playwright_quota", lambda *a, **k: True)
    out = asyncio.run(kr._run_with_browser(["키워드1", "키워드2", "키워드3"], "가게", "123", ""))
    assert calls == ["키워드1"]                                   # 첫 차단 이후 네이버 요청 없음
    assert out["키워드1"]["error"] == "naver_search_blocked"
    assert out["키워드2"]["error"] == out["키워드3"]["error"] == "naver_search_cooldown"
    assert all(out[k]["pc_rank"] is None for k in ("키워드1", "키워드2", "키워드3"))
    assert g.search_snapshot()["open"] is True


def test_blocked_rows_are_unmeasured_not_zero_score():
    from services.score_engine import calc_keyword_search_rank_score
    ranks = {"a": {"pc_rank": None, "mobile_rank": None, "place_rank": None, "error": "naver_search_blocked"}}
    assert calc_keyword_search_rank_score({"keyword_ranks": ranks}) == (0.0, False)


def test_briefing_scanner_returns_unmeasured_during_cooldown():
    from services.ai_scanner.naver_scanner import NaverAIBriefingScanner
    from services.score_engine import _is_naver_unmeasured
    g.report_search_block("t")
    r = asyncio.run(NaverAIBriefingScanner().check_mention("성수 카페", "가게"))
    assert r["error"] == "naver_search_cooldown" and r["mentioned"] is False and r["quota_skipped"] is True
    assert _is_naver_unmeasured({"naver": r}) is True


def test_ai_tab_skips_during_cooldown(monkeypatch):
    from services.ai_scanner import naver_ai_tab_scanner as t

    async def enabled(): return True

    monkeypatch.setattr(t, "_get_ai_tab_enabled", enabled)
    g.report_search_block("t")
    assert asyncio.run(t.scan("성수 카페", "가게")) is None
