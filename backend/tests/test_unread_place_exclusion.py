"""'읽은 적 없는' 플레이스·지도 항목의 점수 제외와 coverage 기반 알림 억제 테스트 (2026-10-30, K 점검).

배경: 스마트플레이스 완성도·지도 점수는 네이버를 한 번도 읽지 못한 등록 사업장에서도 '측정된 낮은 값'으로 계산돼
인기 가게까지 모두 '시작 전'으로 나왔다. 리뷰(_is_review_unmeasured)와 같은 방식으로 제외 후 재정규화한다.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import score_engine as se  # noqa: E402
from services import stage_names as sn  # noqa: E402


def _biz(**kw):
    base = {"naver_place_id": "", "category": "cafe", "is_franchise": False}
    base.update(kw)
    return base


# ── 스마트플레이스 ───────────────────────────────────────────────────────────────
def test_unread_registered_business_is_unmeasured():
    assert se._is_smart_place_unmeasured({}, _biz()) is True


def test_place_id_or_any_input_keeps_it_measured():
    assert se._is_smart_place_unmeasured({}, _biz(naver_place_id="12345")) is False
    for k in ("is_smart_place", "has_recent_post", "has_intro", "has_faq"):
        assert se._is_smart_place_unmeasured({}, _biz(**{k: True})) is False, k
    assert se._is_smart_place_unmeasured({}, _biz(naver_intro_draft="소개글")) is False
    assert se._is_smart_place_unmeasured({}, _biz(checklist_overrides={"__recent_post_sufficient": True})) is False


def test_crawled_rank_or_registration_keeps_it_measured():
    assert se._is_smart_place_unmeasured({"my_rank": 3}, _biz()) is False
    assert se._is_smart_place_unmeasured({"is_smart_place": True}, _biz()) is False


def test_trial_and_legacy_dicts_are_unchanged():
    # 'naver_place_id' 키가 없는 dict(체험·레거시)는 기존 동작을 유지한다
    assert se._is_smart_place_unmeasured({}, {"category": "cafe"}) is False
    assert se._is_local_map_unmeasured({}, {"category": "cafe"}, {}) is False


# ── 지도 ─────────────────────────────────────────────────────────────────────
def test_local_map_unmeasured_only_when_nothing_was_checked():
    assert se._is_local_map_unmeasured({}, _biz(), {}) is True
    assert se._is_local_map_unmeasured({"kakao_result": {"is_on_kakao": None}}, _biz(), {}) is True


def test_kakao_not_registered_is_a_measured_zero():
    assert se._is_local_map_unmeasured({"kakao_result": {"is_on_kakao": False}}, _biz(), {}) is False
    assert se._is_local_map_unmeasured({"kakao": {"mentioned": False}}, _biz(), {}) is False


def test_local_map_measured_by_rank_ids_or_checklist():
    assert se._is_local_map_unmeasured({}, _biz(), {"my_rank": 2}) is False
    assert se._is_local_map_unmeasured({}, _biz(kakao_place_id="9"), {}) is False
    assert se._is_local_map_unmeasured({}, _biz(kakao_registered=True), {}) is False
    assert se._is_local_map_unmeasured({}, _biz(kakao_score=40), {}) is False


# ── Track1 통합 ──────────────────────────────────────────────────────────────
def test_track1_excludes_unread_items_and_reports_coverage():
    scan = {"naver": {"in_briefing": False, "mentioned": False}}
    score, d = se.calc_track1_score_v3_1(scan, _biz(), {}, None, "cafe")
    assert "smart_place_completeness" in d["excluded"] and "local_map_score" in d["excluded"]
    w = d["weights"]
    assert d["coverage"] == round(sum(v for k, v in w.items() if k not in d["excluded"]), 2)
    assert d["coverage"] < 1.0


def test_unread_items_do_not_drag_the_score_down():
    """읽은 적 없는 항목을 0점 근처로 세던 때보다 낮아지면 안 된다(남은 항목 점수의 가중 평균)."""
    scan = {"naver": {"in_briefing": True, "mentioned": True}}
    score, d = se.calc_track1_score_v3_1(scan, _biz(), {}, None, "cafe")
    remaining = {k: v["score"] for k, v in d["items"].items() if k not in d["excluded"]}
    w = d["weights"]
    expect = sum(remaining[k] * w[k] for k in remaining) / sum(w[k] for k in remaining)
    assert abs(score - round(expect, 2)) < 0.05


def test_registered_with_place_id_is_unchanged():
    scan = {"naver": {"in_briefing": False}}
    _, d = se.calc_track1_score_v3_1(scan, _biz(naver_place_id="777"), {}, None, "cafe")
    assert "smart_place_completeness" not in d["excluded"]


def test_v3_2_applies_the_same_exclusion():
    scan = {"naver": {"in_briefing": False}}
    _, d = se.calc_track1_score_v3_2(scan, _biz(), {}, None, "cafe")
    assert "smart_place_completeness" in d["excluded"] and "coverage" in d


# ── 알림 억제 ────────────────────────────────────────────────────────────────
def test_low_coverage_blocks_stage_alert_but_unknown_or_full_allows():
    assert sn.coverage_allows_stage_alert(0.25) is False
    assert sn.coverage_allows_stage_alert(0.39) is False
    assert sn.coverage_allows_stage_alert(0.4) is True
    assert sn.coverage_allows_stage_alert(1.0) is True
    assert sn.coverage_allows_stage_alert(None) is True       # 구버전 기록·키 없음은 기존 동작
    assert sn.coverage_allows_stage_alert("x") is True
    assert sn.coverage_allows_stage_alert(True) is True


def test_jobs_wires_coverage_into_the_alert_gate():
    src = open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scheduler", "jobs.py"), encoding="utf-8").read()
    gate = src.split("coverage_allows_stage_alert(_cov)")[1][:200]
    assert "_hysteresis_blocked = True" in gate
