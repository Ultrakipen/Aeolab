"""체험 측정 가능률 요약(scripts/trial_measurement_health.py)의 집계 규칙 (2026-11-04)."""
import importlib.util
import os

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location(
    "trial_measurement_health", os.path.join(os.path.dirname(HERE), "scripts", "trial_measurement_health.py")
)
th = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(th)


def _row(**kw):
    base = {"ip_hash": "a", "place_data": None, "smart_place_check": None, "naver_competitors": [{"rank": 1}],
            "naver_rank": None, "naver_result": {}, "ai_mentioned": False}
    base.update(kw)
    return base


def test_place_id_vs_url_only_are_counted_apart():
    s = th.summarize([
        _row(place_data={"naver_place_id": "123", "naver_place_url": "u"}),
        _row(place_data={"naver_place_url": "https://map.naver.com/v5/search/x"}),
        _row(place_data={"naver_place_url": "u2"}),
        _row(),
    ])
    assert (s["place_data"], s["place_id"], s["place_url_only"]) == (3, 1, 2)


def test_smart_place_error_none_and_ok_are_separate_and_unmeasured_values_are_not_counted_as_read():
    s = th.summarize([
        _row(smart_place_check={"error": "home_load_failed"}),
        _row(smart_place_check=None),
        _row(smart_place_check={"has_intro": True, "has_recent_post": False, "intro_measured": True, "recent_post_measured": True}),
        # 차단으로 못 읽은 값은 has_*가 False여도 '읽음'이 아니다
        _row(smart_place_check={"has_intro": False, "has_recent_post": False, "intro_measured": False, "recent_post_measured": False}),
    ])
    assert (s["smart_place_ok"], s["smart_place_error"], s["smart_place_none"]) == (2, 1, 1)
    assert (s["intro_read"], s["post_read"]) == (1, 1)


def test_rank_found_counts_only_real_ranks_not_zero_or_none():
    s = th.summarize([_row(naver_rank=None), _row(naver_rank=0), _row(naver_rank=3), _row(naver_competitors=None, naver_rank=2)])
    assert s["naver_rows"] == 3 and s["rank_found"] == 1


def test_no_verdict_from_a_small_sample():
    s = th.summarize([_row() for _ in range(5)])
    assert "비율로 판단하지 않는다" in th.verdicts(s)[0]


def test_structural_warnings_fire_on_the_observed_pattern():
    """2026-11-04 실측과 같은 모양(33건: ID 1, 점검 성공 0, 순위 발견 0) — 경고 3종이 나와야 한다."""
    rows = [_row(place_data={"naver_place_url": "u"}) for _ in range(20)] + [_row() for _ in range(12)] + [
        _row(place_data={"naver_place_id": "1", "naver_place_url": "u"}, smart_place_check={"error": "home_load_failed"})
    ]
    v = th.verdicts(th.summarize(rows))
    joined = " ".join(v)
    assert "20% 미만" in joined and "place ID" in joined and "10% 미만" in joined and v != ["이상 없음"]


def test_healthy_pattern_has_no_warning():
    ok = {"has_intro": True, "has_recent_post": True, "intro_measured": True, "recent_post_measured": True}
    rows = [_row(place_data={"naver_place_id": "1"}, smart_place_check=ok, naver_rank=2) for _ in range(25)]
    assert th.verdicts(th.summarize(rows)) == ["이상 없음"]


def test_summary_output_has_no_personal_fields():
    s = th.summarize([_row(place_data={"naver_place_id": "1", "title": "개인 가게 이름"})])
    assert not any("title" in k or "name" in k or "email" in k or "ip_hash" in k for k in s)
