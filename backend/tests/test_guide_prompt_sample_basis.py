"""가이드 프롬프트가 측정 표본 수와 확인 못 한 측정을 사실대로 전한다 (2026-11-05).

요약 형식이 분모를 '/100회'로 고정해, 표본이 4~99회로 흔들리는 무료 등급 Gemini 결과(최근 스캔 기록 4/5/8/55/66/94/98/99)를 100회 기준 비율처럼 쓰게 할 수 있었다.
ChatGPT 항목은 확인 못 한 경우도 '없음'으로 전해 모델이 단정하게 만들었다. 실제 프롬프트 빌더를 호출해 확인한다.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.guide_generator import GuideGenerator  # noqa: E402


def _prompt(gemini_n, chatgpt):
    gen = GuideGenerator.__new__(GuideGenerator)
    biz = {"name": "테스트식당", "category": "restaurant", "region": "창원", "keywords": ["규동"], "address": "창원시"}
    scan = {"total_score": 50, "exposure_freq": 3, "gemini_result": {"sample_size": gemini_n, "exposure_freq": 3},
            "chatgpt_result": chatgpt, "naver_result": {}, "google_result": {}}
    return gen._build_prompt(biz, scan, [], None, None)


def test_summary_denominator_is_the_actual_sample_size_not_100():
    p = _prompt(4, {"exposure_freq": 0, "sample_size": 100})
    assert "회/100회" not in p
    assert "'AI 3회/4회 노출'" in p                      # 실제 표본 수가 분모
    assert "표본이 10회 미만이면" in p


def test_chatgpt_unconfirmed_is_not_stated_as_absent():
    p_zero = _prompt(100, {"exposure_freq": 0, "sample_size": 100})
    assert "ChatGPT 노출: 이번 측정에서는 확인되지 않음" in p_zero and "ChatGPT 노출: 없음" not in p_zero
    p_err = _prompt(100, {"error": "timeout"})
    assert "ChatGPT 노출: 측정하지 못함(확인 불가)" in p_err
    p_hit = _prompt(100, {"exposure_freq": 2, "sample_size": 100, "mentioned": True})
    assert "ChatGPT 노출: 있음" in p_hit
