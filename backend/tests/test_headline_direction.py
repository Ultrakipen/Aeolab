"""성장 리포트 "처음 측정 대비 올랐다/내렸다" 판정 (2026-11-02).

근거(실측): 같은 사업장의 연속한 날 점수 변화는 중앙값 3.9점·80분위 8.0점·68%가 2점 이상(측정 정상 스캔 344건, 9곳) — 이전 기준 ±2점(백엔드)·
0이 아니기만 하면(프런트 카드)은 측정 오차를 변화로 말했다. 지금은 ① 등급 구간 변경(+변화 3점 이상, 경계 근처 흔들림 제외) 또는 ② 같은 구간이어도 10점 이상.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.stage_names import headline_direction as hd, HEADLINE_BIG_DELTA, HEADLINE_BAND_MIN_DELTA  # noqa: E402
from tests.test_history_unmeasured_flag import _scan, _run_growth, _OK  # noqa: E402


def test_thresholds_are_the_documented_ones():
    assert HEADLINE_BIG_DELTA == 10.0 and HEADLINE_BAND_MIN_DELTA == 3.0


@pytest.mark.parametrize("start,curr,delta,expected", [
    ("growth", "growth", 2.0, "flat"),            # 이전 기준(±2)이면 '올랐다' — 측정 오차 범위
    ("growth", "growth", -2.0, "flat"),
    ("growth", "growth", 9.9, "flat"),            # 같은 구간 안 9.9점은 아직 말하지 않는다
    ("growth", "growth", 10.0, "up"),             # 같은 구간 안이어도 큰 변화는 말한다(57→70이 '변화 없음'으로 가려지지 않게)
    ("growth", "growth", -10.0, "down"),
    ("stability", "growth", 4.0, "up"),           # 구간이 올랐고 변화가 3점 이상
    ("growth", "stability", -4.0, "down"),
    ("stability", "growth", 0.2, "flat"),         # 54.9→55.1 — 구간은 바뀌었지만 경계 근처 흔들림
    ("stability", "growth", 2.9, "flat"),
    ("stability", "growth", -4.0, "flat"),        # 단계(트랙1)는 올랐는데 통합 점수는 내려감 — 엇갈리면 말하지 않는다
    ("growth", "stability", 4.0, "flat"),
    ("survival", "dominance", 30.0, "up"),
    (None, None, 12.0, "up"),                     # 단계를 모르면 큰 변화만
    (None, "growth", 5.0, "flat"),
    ("growth", "growth", None, "flat"),
    ("growth", "weird", 5.0, "flat"),
])
def test_direction_rule(start, curr, delta, expected):
    assert hd(start, curr, delta) == expected


def test_growth_report_small_change_is_stable_not_growth(monkeypatch):
    r = _run_growth(monkeypatch, [_scan(1, 50.0, _OK), _scan(10, 53.0, _OK)])           # +3.0, 같은 구간 → 이전에는 growth
    assert r["headline_type"] == "stable" and "올랐" not in r["headline"] and "줄었" not in r["headline"]


def test_growth_report_small_drop_is_not_called_a_decline(monkeypatch):
    r = _run_growth(monkeypatch, [_scan(1, 53.0, _OK), _scan(10, 50.0, _OK)])           # -3.0, 같은 구간 → 이전에는 decline
    assert r["headline_type"] == "stable" and "줄었" not in r["headline"]


def test_growth_report_big_change_inside_the_same_stage_is_still_reported(monkeypatch):
    r = _run_growth(monkeypatch, [_scan(1, 58.0, _OK, "growth"), _scan(10, 72.0, _OK, "growth")])
    assert r["headline_type"] == "growth"


def test_growth_report_stage_up_with_real_change_is_reported(monkeypatch):
    r = _run_growth(monkeypatch, [_scan(1, 52.0, _OK, "stability"), _scan(10, 57.0, _OK, "growth")])
    assert r["headline_type"] == "growth"


def test_growth_report_boundary_wobble_is_not_reported(monkeypatch):
    r = _run_growth(monkeypatch, [_scan(1, 54.9, _OK, "stability"), _scan(10, 55.1, _OK, "growth")])
    assert r["headline_type"] == "stable"


def test_growth_report_stage_drop_with_real_change_is_reported(monkeypatch):
    r = _run_growth(monkeypatch, [_scan(1, 58.0, _OK, "growth"), _scan(10, 53.0, _OK, "stability")])
    assert r["headline_type"] == "decline"


def test_stage_is_taken_from_track1_when_the_stored_code_is_missing(monkeypatch):
    first, last = _scan(1, 52.0, _OK, "stability"), _scan(10, 58.0, _OK, "growth")
    first["growth_stage"] = last["growth_stage"] = None                                   # 저장된 코드가 없는 옛 행 — track1_score(52→58, 구간 55 경계 통과)로 계산
    assert _run_growth(monkeypatch, [first, last])["headline_type"] == "growth"
