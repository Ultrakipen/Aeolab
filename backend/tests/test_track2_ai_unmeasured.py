"""Gemini·ChatGPT 측정이 모두 실패했을 때 Track2 점수가 0점이 아니라 "확인 전"(항목 제외 후 재정규화)이어야 한다 (2026-10-31).

한쪽만 실패하면 다른 쪽으로 평가하는 기존 동작(calc_multi_ai_exposure)은 그대로다. 둘 다 실패(무료 한도 소진 + 크레딧 부족 등)하면
이전에는 0점이 가중치 30%로 평균에 들어가 측정 못 한 가게가 점수 하락처럼 보였다.
"""
from services.score_engine import (
    GLOBAL_TRACK_WEIGHTS,
    _is_multi_ai_unmeasured,
    calc_google_presence,
    calc_online_mentions,
    calc_schema_seo,
    calc_track2_score,
)

BIZ = {"google_place_id": "g1"}
NAVER = {"blog_checked": True, "blog_mentions": 40}
WEB = {"has_json_ld": True, "has_open_graph": True}
GOOGLE_OK = {"mentioned": True}


def _scan(gemini, chatgpt):
    return {"gemini": gemini, "chatgpt": chatgpt, "website_check": WEB, "google": GOOGLE_OK}


def test_both_failed_excludes_the_ai_item_and_renormalizes():
    scan = _scan({"error": "quota"}, {"error": "insufficient_quota"})
    assert _is_multi_ai_unmeasured(scan) is True
    w = GLOBAL_TRACK_WEIGHTS
    schema, mentions, google = calc_schema_seo(scan, BIZ), calc_online_mentions(NAVER), calc_google_presence(scan)
    expected = (schema * w["schema_seo"] + mentions * w["online_mentions"] + google * w["google_presence"]) / (
        w["schema_seo"] + w["online_mentions"] + w["google_presence"])
    assert calc_track2_score(scan, BIZ, NAVER) == round(expected, 1)
    zero_counted = (schema * w["schema_seo"] + mentions * w["online_mentions"] + google * w["google_presence"]) / sum(w.values())
    assert calc_track2_score(scan, BIZ, NAVER) > round(zero_counted, 1)      # 0점으로 세던 이전 값보다 높다(저평가가 사라짐)


def test_one_side_failed_keeps_the_ai_item_with_the_other_side():
    chat_ok = {"exposure_freq": 25, "sample_size": 50}
    scan = _scan({"error": "quota"}, chat_ok)
    assert _is_multi_ai_unmeasured(scan) is False
    w = GLOBAL_TRACK_WEIGHTS
    # 항목이 포함되므로 분모는 전체 가중치 합
    schema, mentions, google = calc_schema_seo(scan, BIZ), calc_online_mentions(NAVER), calc_google_presence(scan)
    expected = (50.0 * w["multi_ai_exposure"] + schema * w["schema_seo"] + mentions * w["online_mentions"] + google * w["google_presence"]) / sum(w.values())
    assert calc_track2_score(scan, BIZ, NAVER) == round(expected, 1)


def test_quick_scan_with_only_one_ai_run_is_not_treated_as_unmeasured_when_it_succeeded():
    assert _is_multi_ai_unmeasured({"gemini": {}, "chatgpt": {"exposure_freq": 3, "sample_size": 5}}) is False
    assert _is_multi_ai_unmeasured({"gemini": {}, "chatgpt": {"error": "x"}}) is True      # 돌린 하나가 실패하면 확인 전
    assert _is_multi_ai_unmeasured({}) is False                                              # 구형 데이터(AI 정보 없음)는 기존 동작 유지
