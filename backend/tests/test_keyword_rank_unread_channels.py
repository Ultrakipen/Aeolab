"""검색 화면을 읽지 못한 키워드를 "첫 화면 밖(미노출 0점)"으로 저장하지 않는지 검증 (2026-11-01, 작업 T-7 후속).

배경: 이동 실패(타임아웃)·카드 수집 예외·일일 상한 건너뜀은 순위 None으로 돌아오는데, 예전에는 error 표시가 없어
`calc_keyword_search_rank_score`가 "측정된 0점"으로 평균에 넣었다(error ≠ false, CLAUDE.md 지침 8·9).
주의: 화면을 읽었는데 카드가 0개인 경우는 일부러 실패로 보지 않는다(플레이스 카드가 원래 없는 업종 검색어).
"""
import asyncio
import os
import sys
from contextvars import copy_context

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import naver_keyword_rank as kr  # noqa: E402
from services.score_engine import calc_keyword_search_rank_score  # noqa: E402
from tests.test_naver_search_breaker import _PW  # noqa: E402


def _setup(monkeypatch, pc, mobile, place, quota=True, mobile_only=False):
    kr.reset_card_cache_for_tests()
    monkeypatch.setattr(kr, "async_playwright", lambda: _PW())
    monkeypatch.setattr(kr, "_measure_pc", pc)
    monkeypatch.setattr(kr, "_measure_mobile", mobile)
    monkeypatch.setattr(kr, "_measure_place_api", place)
    monkeypatch.setattr(kr, "check_naver_playwright_quota", lambda *a, **k: quota)
    monkeypatch.setattr(kr, "mobile_only_enabled", lambda: mobile_only)


async def _none(*a, **k):
    return None            # 화면을 읽었고 내 가게가 없었다 (표시 없음 = 정상 미노출)


async def _unread_pc(*a, **k):
    kr._mark_unread("pc", "nav_failed")
    return None


async def _unread_mobile(*a, **k):
    kr._mark_unread("mobile", "nav_failed")
    return None


def _run(keywords=("키워드1",)):
    return asyncio.run(kr._run_with_browser(list(keywords), "가게", "123", ""))


def test_both_screens_unread_is_error_not_zero(monkeypatch):
    _setup(monkeypatch, _unread_pc, _unread_mobile, _none)
    row = _run()["키워드1"]
    assert row["error"] == "naver_list_unread"
    assert row["read_issues"] == {"pc": "nav_failed", "mobile": "nav_failed"}
    # 점수·평균 쪽이 이 행을 미측정으로 건너뛴다
    assert calc_keyword_search_rank_score({"keyword_ranks": {"키워드1": row}}) == (0.0, False)


def test_quota_skip_on_both_screens_is_error(monkeypatch):
    _setup(monkeypatch, _none, _none, _none, quota=False)
    row = _run()["키워드1"]
    assert row["error"] == "naver_list_unread"
    assert row["read_issues"] == {"pc": "quota_skipped", "mobile": "quota_skipped"}


def test_screen_read_but_not_found_stays_not_exposed(monkeypatch):
    """화면을 읽고 내 가게가 없으면 기존대로 '첫 화면 밖'(error 없음) — 과잉 실패 처리 금지."""
    _setup(monkeypatch, _none, _none, _none)
    row = _run()["키워드1"]
    assert "error" not in row and row["pc_rank"] is None and row["mobile_rank"] is None
    assert calc_keyword_search_rank_score({"keyword_ranks": {"키워드1": row}}) == (0.0, True)


def test_one_screen_unread_other_read_is_not_error(monkeypatch):
    """PC는 못 읽었어도 모바일 화면을 읽고 못 찾았다면 그 읽은 결과가 근거다."""
    _setup(monkeypatch, _unread_pc, _none, _none)
    assert "error" not in _run()["키워드1"]


def test_rank_found_elsewhere_is_not_error(monkeypatch):
    async def place(*a, **k):
        return 3
    _setup(monkeypatch, _unread_pc, _unread_mobile, place)
    row = _run()["키워드1"]
    assert "error" not in row and row["place_rank"] == 3


def test_mobile_only_mode_judges_by_mobile_channel(monkeypatch):
    # PC는 설계상 읽지 않는다 — PC 표시가 없어도 모바일을 못 읽었으면 실패
    _setup(monkeypatch, _none, _unread_mobile, _none, mobile_only=True)
    assert _run()["키워드1"]["error"] == "naver_list_unread"
    # 모바일을 읽었으면 PC를 안 읽었다는 이유만으로 실패가 되지 않는다
    _setup(monkeypatch, _none, _none, _none, mobile_only=True)
    assert "error" not in _run()["키워드1"]


def test_marks_do_not_leak_between_keywords(monkeypatch):
    seq = iter([True, False])

    async def pc(*a, **k):
        if next(seq):
            kr._mark_unread("pc", "nav_failed")
        return None

    async def mob(*a, **k):
        kr._mark_unread("mobile", "nav_failed")
        return None

    _setup(monkeypatch, pc, mob, _none)
    out = _run(("키워드1", "키워드2"))
    assert out["키워드1"]["error"] == "naver_list_unread"
    assert "error" not in out["키워드2"]      # 앞 키워드의 PC 실패 표시가 남아 있으면 안 된다


def test_real_nav_failure_marks_channel():
    class Page:
        async def goto(self, *a, **k):
            raise RuntimeError("net::ERR_FAILED")

    fails: dict = {}

    def go():
        kr._READ_FAILS.set(fails)
        return asyncio.run(kr._measure_pc(Page(), "q", "가게", "123"))

    assert copy_context().run(go) is None
    assert fails == {"pc": "nav_failed"}


def test_real_card_read_failure_marks_channel():
    class Page:
        async def wait_for_function(self, *a, **k): return None
        async def wait_for_timeout(self, *a, **k): return None
        async def evaluate(self, *a, **k): raise RuntimeError("context destroyed")

    fails: dict = {}

    def go():
        kr._READ_FAILS.set(fails)
        return asyncio.run(kr._place_card_rank(Page(), "가게", "123", None, channel="mobile"))

    assert copy_context().run(go) is None
    assert fails == {"mobile": "card_read_failed"}
