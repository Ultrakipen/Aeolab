"""성장 리포트 헤드라인 문구·경쟁사 경고 규칙 (2026-11-02, 성장 리포트 실화면 대조에서 발견).

- "꾸준히 개선… 잘 하고 계십니다!"·"가장 큰 원인은 … 부족"은 근거(첫·마지막 점수 차이)보다 과한 단정이라 쓰지 않는다.
- 경쟁사 상승 경고는 이전 점수가 없던 경쟁사(새로 등록)와 측정 방식이 바뀐 경쟁사를 '올랐다'로 보지 않는다.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tests.test_history_unmeasured_flag import _scan, _run_growth, _OK  # noqa: E402

NEW = {"score": 60.0, "name": "라움", "ai_basis": "recommend_v1", "ai_source": "chatgpt", "ai_model": "gpt-6-luna"}
LEGACY = {"score": 40.0, "name": "라움"}                       # ai_basis 없음 = 옛 방식(이름을 직접 물은 측정)


def _with_comp(scan, comp):
    s = dict(scan)
    s["competitor_scores"] = comp
    return s


def test_growth_headline_has_no_unfounded_praise(monkeypatch):
    r = _run_growth(monkeypatch, [_scan(1, 50.0, _OK), _scan(10, 60.0, _OK)])
    assert r["headline_type"] == "growth"
    assert "꾸준히" not in r["headline"] and "잘 하고 계십니다" not in r["headline"] and "!" not in r["headline"]


def test_decline_headline_does_not_claim_a_cause(monkeypatch):
    r = _run_growth(monkeypatch, [_scan(1, 70.0, _OK), _scan(10, 50.0, _OK)])
    assert r["headline_type"] == "decline"
    assert "원인" not in r["headline"] and "부족" not in r["headline"] and "가장 많이 줄어든 항목" in r["headline"]


def test_new_competitor_is_not_counted_as_rising(monkeypatch):
    scans = [_with_comp(_scan(1, 50.0, _OK), {}), _with_comp(_scan(10, 50.0, _OK), {"c1": NEW})]
    r = _run_growth(monkeypatch, scans)
    assert r["headline_type"] == "stable"          # 이전엔 prev 점수 0으로 취급돼 'alert'


def test_measurement_basis_change_is_not_counted_as_rising(monkeypatch):
    scans = [_with_comp(_scan(1, 50.0, _OK), {"c1": LEGACY}), _with_comp(_scan(10, 50.0, _OK), {"c1": NEW})]
    r = _run_growth(monkeypatch, scans)
    assert r["headline_type"] == "stable"


def test_real_rise_with_same_basis_still_alerts_without_urgency_or_numbers(monkeypatch):
    lo = dict(NEW, score=40.0)
    scans = [_with_comp(_scan(1, 50.0, _OK), {"c1": lo}), _with_comp(_scan(10, 50.0, _OK), {"c1": NEW})]
    r = _run_growth(monkeypatch, scans)
    assert r["headline_type"] == "alert"
    assert "(추정치)" in r["headline"] and "지금 조치가 필요" not in r["headline"] and not any(ch.isdigit() for ch in r["headline"])
