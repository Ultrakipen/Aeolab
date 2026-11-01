"""재방문 배너(/api/report/visit-delta) — 비교의 양 끝 스캔에 네이버 측정이 빠졌으면 "내려갔습니다/개선됐어요"를 단정하지 않는다 (2026-11-02).

배너는 3일 이상 만에 돌아온 사용자에게 가장 먼저 보이는 문구다. 측정 빠진 날의 점수는 항목이 제외·재정규화돼 척도가 다르므로
(같은 가게 시험 64.5 ↔ 54.6) 그 차이를 방문 사이의 변화로 말하면 가짜 하락/개선이 된다.
"""
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import BackgroundTasks

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import change_signal_guard as csg  # noqa: E402

_OK = {"mentioned": False, "in_briefing": False}
_BLOCKED = {"error": "naver_search_cooldown", "quota_skipped": True}
_SINCE = "2026-10-20T00:00:00+00:00"


# ── 순서대로 답하는 가짜 DB (helper의 조회 순서: 첫 스캔 → 마지막 스캔 → (필요 시) 기간 이전 스캔) ──────────
class _Chain:
    def __getattr__(self, name):
        if name == "not_":
            return self
        return lambda *a, **k: self


class _SB:
    def table(self, name):
        assert name == "scan_results"
        return _Chain()


class _R:
    def __init__(self, data):
        self.data = data


def _seq(monkeypatch, answers, fail_at=None):
    import db.supabase_client as dbc
    calls = {"n": 0}

    async def fake(q):
        i = calls["n"]
        calls["n"] += 1
        if fail_at is not None and i == fail_at:
            raise RuntimeError("db down")
        return _R(answers[i] if i < len(answers) else [])

    monkeypatch.setattr(dbc, "execute", fake)
    return calls


def _scan(naver, at):
    return {"naver_result": naver, "scanned_at": at}


def _run(monkeypatch, answers, **kw):
    calls = _seq(monkeypatch, answers, **kw)
    r = asyncio.run(csg.window_comparison_unmeasured(_SB(), "b1", _SINCE))
    return r, calls["n"]


def test_both_ends_measured_is_comparable(monkeypatch):
    r, n = _run(monkeypatch, [[_scan(_OK, "2026-10-21")], [_scan(_OK, "2026-10-30")]])
    assert r is False and n == 2


def test_first_end_blocked(monkeypatch):
    r, _ = _run(monkeypatch, [[_scan(_BLOCKED, "2026-10-21")], [_scan(_OK, "2026-10-30")]])
    assert r is True


def test_last_end_blocked(monkeypatch):
    """돌아와 보니 가장 최근 스캔이 차단일 — 낮아진 점수를 '내려갔습니다'로 말하면 안 된다."""
    r, _ = _run(monkeypatch, [[_scan(_OK, "2026-10-21")], [_scan(_BLOCKED, "2026-10-30")]])
    assert r is True


def test_a_blocked_scan_in_the_middle_does_not_matter(monkeypatch):
    # 비교하는 것은 양 끝뿐이다 — 중간 스캔이 실패였어도 양 끝이 측정 성공이면 비교 가능
    r, _ = _run(monkeypatch, [[_scan(_OK, "2026-10-21")], [_scan(_OK, "2026-10-30")]])
    assert r is False


def test_single_scan_in_window_also_checks_the_baseline_before_the_window(monkeypatch):
    same = _scan(_OK, "2026-10-25")
    r, n = _run(monkeypatch, [[same], [same], [_scan(_BLOCKED, "2026-10-10")]])
    assert r is True and n == 3                    # 기준이 되는 이전 스캔이 차단일 → 비교 불가
    r, n = _run(monkeypatch, [[same], [same], [_scan(_OK, "2026-10-10")]])
    assert r is False and n == 3


def test_single_scan_in_window_blocked_itself(monkeypatch):
    same = _scan(_BLOCKED, "2026-10-25")
    r, _ = _run(monkeypatch, [[same], [same], [_scan(_OK, "2026-10-10")]])
    assert r is True


def test_no_scored_scan_in_window_means_nothing_to_judge(monkeypatch):
    r, n = _run(monkeypatch, [[], []])
    assert r is False and n == 2


def test_lookup_failure_returns_none(monkeypatch):
    r, _ = _run(monkeypatch, [], fail_at=0)
    assert r is None
    r, _ = _run(monkeypatch, [[_scan(_OK, "2026-10-21")]], fail_at=1)
    assert r is None


# ── 엔드포인트 (실제 함수 호출, DB만 가짜) ─────────────────────────────────────────
def _call_endpoint(monkeypatch, helper_result):
    import routers.report as rr

    last_visit = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()
    history = [
        {"unified_score": 64.5, "total_score": 64.5, "score_date": "2026-10-25"},
        {"unified_score": 54.6, "total_score": 54.6, "score_date": "2026-11-01"},
    ]

    class Q:
        def __init__(self, name):
            self.name = name

        def __getattr__(self, n):
            if n == "not_":
                return self
            return lambda *a, **k: self

    class SB:
        def table(self, name):
            return Q(name)

    async def fake_exec(q):
        if q.name == "profiles":
            return _R([{"last_dashboard_visit": last_visit}])
        if q.name == "score_history":
            return _R(history)
        return _R([])

    async def fake_verify(*a, **k):
        return None

    async def fake_helper(supabase, biz_id, since_iso):
        return helper_result

    monkeypatch.setattr(rr, "get_client", lambda: SB())
    monkeypatch.setattr(rr, "execute", fake_exec)
    monkeypatch.setattr(rr, "_verify_biz_ownership", fake_verify)
    monkeypatch.setattr(csg, "window_comparison_unmeasured", fake_helper)
    return asyncio.run(rr.get_visit_delta("b1", BackgroundTasks(), {"id": "u1"}))


def test_endpoint_shows_banner_when_both_ends_were_measured(monkeypatch):
    r = _call_endpoint(monkeypatch, False)
    assert r["show"] is True and r["delta"] < 0          # 정상 측정 구간의 실제 하락은 그대로 알린다


def test_endpoint_hides_banner_when_an_end_was_unmeasured(monkeypatch):
    assert _call_endpoint(monkeypatch, True) == {"show": False}


def test_endpoint_hides_banner_when_it_cannot_check(monkeypatch):
    assert _call_endpoint(monkeypatch, None) == {"show": False}


def test_guard_runs_after_the_cheap_checks():
    """delta가 작아 어차피 안 보일 때는 추가 조회를 하지 않는다(배너를 안 보여도 되는 대부분의 호출 비용 0)."""
    import inspect
    import routers.report as rr
    src = inspect.getsource(rr.get_visit_delta)
    assert src.index("if abs(delta) < 0.5:") < src.index("window_comparison_unmeasured(")
    assert src.index("window_comparison_unmeasured(") < src.index('"show": True')
