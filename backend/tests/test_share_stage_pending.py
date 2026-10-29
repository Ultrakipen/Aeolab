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


def test_share_endpoint_only_looks_at_scored_scan_rows_and_returns_flag():
    from routers import report
    src = inspect.getsource(report.get_share_page_data)
    assert '.not_.is_("track1_score", "null")' in src        # 순위 전용 행(naver_result 없음) 제외
    assert '"stage_pending": _stage_pending' in src
    assert "naver_result_unmeasured" in src


def test_share_page_hides_stage_and_bar_when_pending():
    import os
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    t = open(os.path.join(root, "frontend", "app", "(public)", "share", "[bizId]", "page.tsx"), encoding="utf-8").read()
    assert "data.stage_pending === true" in t
    assert "{!pending && (" in t
