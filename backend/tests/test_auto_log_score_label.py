"""_auto_log_score_change 의 변화 기록 문구 (2026-11-02, 성장 리포트 실화면 대조에서 발견).

- 등급 이름이 같으면 "시작 전 → 시작 전" 같은 모순된 표현을 쓰지 않는다.
- 하락 사유("경쟁사 강화 또는 정보 갱신 필요")는 측정으로 확인된 적 없는 단정이라 쓰지 않는다.
"""
import asyncio
import os
import sys
from types import SimpleNamespace
from unittest.mock import MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scheduler import jobs  # noqa: E402
from services.share_card import _score_stage_label  # noqa: E402


def _run(new, old, monkeypatch):
    sb = MagicMock()

    async def fake_db(q, *a, **k):
        return SimpleNamespace(data=[])          # 오늘 이미 기록된 행 없음

    monkeypatch.setattr(jobs, "_db", fake_db)
    asyncio.run(jobs._auto_log_score_change(sb, "biz-1", new, old))
    calls = sb.table.return_value.insert.call_args_list
    return calls[0].args[0] if calls else None


def test_same_stage_has_no_contradictory_arrow(monkeypatch):
    assert _score_stage_label(10.0) == _score_stage_label(20.0)           # 전제: 같은 등급 안의 5점 이상 움직임
    for new, old in ((20.0, 10.0), (10.0, 20.0)):
        label = _run(new, old, monkeypatch)["action_label"]
        stage = _score_stage_label(new)
        assert f"{stage} → {stage}" not in label
        assert f"{stage} 단계 안에서" in label


def test_stage_change_still_shows_both_stages(monkeypatch):
    lo, hi = 10.0, 90.0
    assert _score_stage_label(lo) != _score_stage_label(hi)
    label = _run(hi, lo, monkeypatch)["action_label"]
    assert f"{_score_stage_label(lo)} → {_score_stage_label(hi)}" in label


def test_drop_label_has_no_unverified_cause(monkeypatch):
    row = _run(10.0, 20.0, monkeypatch)
    assert row["action_type"] == "score_down" and "경쟁사 강화" not in row["action_label"] and "정보 갱신" not in row["action_label"]


def test_small_change_is_not_logged(monkeypatch):
    assert _run(12.0, 10.0, monkeypatch) is None
