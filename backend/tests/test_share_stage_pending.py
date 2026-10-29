"""공개 공유 페이지: 네이버가 측정되지 못한 스캔이면 낮아진 점수로 단계를 붙이지 않는다 (2026-10-29)."""
import inspect

import pytest

from services.score_engine import naver_result_unmeasured


@pytest.mark.parametrize("r", [
    {"captcha_detected": True},
    {"error": "naver_search_cooldown"},
    {"error": "page_load_failed"},
    {"quota_skipped": True, "error": None},
    {"error": "naver_playwright_quota_exceeded", "quota_skipped": True},
])
def test_unmeasured_results(r):
    assert naver_result_unmeasured(r) is True


@pytest.mark.parametrize("r", [
    {"in_briefing": True, "mentioned": True},
    {"in_briefing": False, "mentioned": False, "captcha_detected": False, "error": None},   # 측정했더니 미노출 = 실측
    {},
    None,
    "bad",
])
def test_measured_or_absent_results_do_not_trigger_pending(r):
    # 값이 없는 행(순위 전용·구버전)을 보류로 잘못 잡지 않는다 — 프론트와 다른 점이며 의도적이다
    assert naver_result_unmeasured(r) is False


def test_helper_only_looks_at_scored_scan_rows():
    from routers import report
    src = inspect.getsource(report._latest_scored_scan_naver_unmeasured)
    assert '.not_.is_("track1_score", "null")' in src        # 순위 전용 행(naver_result 없음) 제외
    assert "naver_result_unmeasured" in src


def test_share_api_and_card_both_use_the_helper_and_pending_replaces_stage():
    from routers import report
    api = inspect.getsource(report.get_share_page_data)
    card = inspect.getsource(report.generate_share_card)
    assert "_latest_scored_scan_naver_unmeasured(supabase, biz_id)" in api and '"stage_pending": _stage_pending' in api
    assert "_latest_scored_scan_naver_unmeasured(supabase, biz_id)" in card
    assert "if _stage_pending:" in card and "일부 항목 확인 전" in card


def test_helper_returns_false_on_query_failure_and_for_rank_only_rows(monkeypatch):
    import asyncio
    from routers import report

    class _Res:
        def __init__(self, data): self.data = data

    async def boom(_q): raise RuntimeError("db down")
    monkeypatch.setattr(report, "execute", boom)

    class _T:
        def select(self, *_): return self
        def eq(self, *_): return self
        def order(self, *_a, **_k): return self
        def limit(self, *_): return self
        @property
        def not_(self): return self
        def is_(self, *_): return self
    class _DB:
        def table(self, _): return _T()
    assert asyncio.run(report._latest_scored_scan_naver_unmeasured(_DB(), "b")) is False   # 조회 실패 → 기존 표시 유지

    async def err_row(_q): return _Res([{"naver_result": {"error": "PLAYWRIGHT_QUEUE_TIMEOUT"}}])
    monkeypatch.setattr(report, "execute", err_row)
    assert asyncio.run(report._latest_scored_scan_naver_unmeasured(_DB(), "b")) is True

    async def ok_row(_q): return _Res([{"naver_result": {"in_briefing": False, "error": None}}])
    monkeypatch.setattr(report, "execute", ok_row)
    assert asyncio.run(report._latest_scored_scan_naver_unmeasured(_DB(), "b")) is False   # 측정했더니 미노출 = 실측


def test_share_page_hides_stage_and_bar_when_pending():
    import os
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    t = open(os.path.join(root, "frontend", "app", "(public)", "share", "[bizId]", "page.tsx"), encoding="utf-8").read()
    assert "data.stage_pending === true" in t
    assert "{!pending && (" in t
