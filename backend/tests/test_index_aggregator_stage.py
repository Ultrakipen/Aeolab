"""분기 지수 집계의 성장 단계 분포 (2026-11-01 스키마 검사에서 발견).

score_history에는 growth_stage 컬럼이 없어 select가 항상 42703으로 실패했다. 또 집계의 단계 키(stable·dominant)와 시스템 코드(stability·dominance)가 달라
컬럼이 있었더라도 두 단계가 항상 0으로 계산되는 구조였다. 이제 track1_score에서 stage_names 단일 소스로 단계를 계산한다.
"""
from services.index_aggregator import _compute_growth_dist, _with_derived_stage


def test_stage_is_derived_from_track1_score_with_the_dashboard_boundaries():
    rows = [{"track1_score": s} for s in (0, 29.9, 30, 54.9, 55, 74.9, 75, 100)]
    got = [r["growth_stage"] for r in _with_derived_stage(rows)]
    assert got == ["survival", "survival", "stable", "stable", "growth", "growth", "dominant", "dominant"]


def test_unmeasured_rows_are_not_counted_as_the_lowest_stage():
    rows = [{"track1_score": None}, {}, {"track1_score": 10}, {"track1_score": 80}]
    derived = _with_derived_stage(rows)
    assert [r["growth_stage"] for r in derived] == [None, None, "survival", "dominant"]
    dist = _compute_growth_dist(derived)
    assert dist == {"survival": 0.5, "stable": 0.0, "growth": 0.0, "dominant": 0.5}     # 분모는 측정된 2건


def test_all_four_stages_are_reachable_and_output_keys_are_unchanged():
    rows = [{"track1_score": s} for s in (10, 40, 60, 90)]
    dist = _compute_growth_dist(_with_derived_stage(rows))
    assert set(dist) == {"survival", "stable", "growth", "dominant"}
    assert all(v == 0.25 for v in dist.values())


def test_other_fields_are_preserved_and_input_not_mutated():
    rows = [{"business_id": "b", "unified_score": 50, "track1_score": 40}]
    out = _with_derived_stage(rows)
    assert out[0]["business_id"] == "b" and out[0]["unified_score"] == 50
    assert "growth_stage" not in rows[0]
