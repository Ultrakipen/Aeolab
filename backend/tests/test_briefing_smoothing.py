"""네이버 AI 브리핑 점수 평활화 테스트 — 2026-10-30.

브리핑 노출은 날마다 깜빡여서(0→60→100→0) Track1과 성장 단계가 흔들렸다. 이번 스캔과 직전 측정 성공 스캔(최대 2건, 14일 이내)을 평균한다.
"""
import asyncio
import inspect
import os
from datetime import datetime, timedelta, timezone

os.environ.setdefault("GEMINI_API_KEY", "test-key-not-used")
os.environ.setdefault("OPENAI_API_KEY", "test-key-not-used")

from services import briefing_smoothing as bs  # noqa: E402
from services import score_engine as se  # noqa: E402


def _scan(mentioned=False, in_briefing=False, **extra):
    return {"naver": {"mentioned": mentioned, "in_briefing": in_briefing, **extra}}


def _prior(mentioned=False, in_briefing=False, **extra):
    return {"naver_result": {"mentioned": mentioned, "in_briefing": in_briefing, **extra}, "naver_ai_tab_visible": None}


def test_no_prior_scans_keeps_previous_behavior_exactly():
    s = _scan(mentioned=True, in_briefing=True)
    assert se._smoothed_ai_brief(s) == (se.calc_naver_exposure(s), 1)


def test_average_of_current_and_prior_measured_scans():
    s = {**_scan(mentioned=True, in_briefing=True), "_prior_naver": [_prior(), _prior(mentioned=True)]}   # 100, 0, 60
    val, n = se._smoothed_ai_brief(s)
    assert n == 3 and round(val, 2) == round((100 + 0 + 60) / 3, 2)


def test_failed_prior_scan_is_not_a_sample():
    s = {**_scan(mentioned=True), "_prior_naver": [_prior(captcha_detected=True), _prior(error="timeout"), _prior()]}
    val, n = se._smoothed_ai_brief(s)
    assert n == 2 and val == 30.0   # 60과 0만 평균 — 실패 스캔을 0으로 넣지 않는다


def test_ad_only_prior_counts_as_zero_like_current_rule():
    s = {**_scan(mentioned=True), "_prior_naver": [_prior(mentioned=True, ad_only=True)]}
    val, n = se._smoothed_ai_brief(s)
    assert n == 2 and val == 30.0


def test_smoothing_reduces_day_to_day_swing_on_real_flicker_series():
    """힐링하우스 10-22~10-29 실측 브리핑 점수 계열(0,0,0,0,60,100,0,60)의 일별 변화폭이 줄어든다."""
    raw = [0, 0, 0, 0, 60, 100, 0, 60]
    out = []
    for i, v in enumerate(raw):
        vals = [v] + raw[max(0, i - 2):i][::-1]
        out.append(bs.smooth(v, vals[1:])[0])
    swing_raw = sum(abs(b - a) for a, b in zip(raw, raw[1:]))
    swing_new = sum(abs(b - a) for a, b in zip(out, out[1:]))
    assert swing_new < swing_raw * 0.6


def test_v3_1_and_v3_2_use_smoothed_score_and_report_sample_count():
    src = inspect.getsource(se)
    assert src.count("ai_brief, _brief_n = _smoothed_ai_brief(scan_result)") == 2
    assert src.count('"smoothed_over": _brief_n') == 2


def test_scoring_call_sites_attach_prior_scans():
    import pathlib
    root = pathlib.Path(__file__).resolve().parents[1]
    for rel, needle in (("scheduler/jobs.py", "_sched_combined_result"), ("routers/scan.py", "combined_result")):
        src = (root / rel).read_text(encoding="utf-8")
        assert "attach_prior_naver(" in src and needle in src
    assert (root / "routers/scan.py").read_text(encoding="utf-8").count("attach_prior_naver(") >= 3


# ── attach_prior_naver (DB 읽기 가짜) ──
class _Res:
    def __init__(self, data):
        self.data = data


class _Q:
    def __init__(self, rows):
        self.rows = rows

    def __getattr__(self, name):
        if name == "not_":   # supabase의 `.not_`은 호출이 아니라 속성이다
            return self
        def chain(*a, **k):
            return self
        return chain


class _SB:
    def __init__(self, rows):
        self.rows = rows

    def table(self, name):
        return _Q(self.rows)


def _run_attach(monkeypatch, rows):
    import db.supabase_client as sc

    async def fake_execute(q):
        return _Res(q.rows)

    monkeypatch.setattr(sc, "get_client", lambda: _SB(rows))
    monkeypatch.setattr(sc, "execute", fake_execute)
    scan = {}
    asyncio.run(bs.attach_prior_naver(scan, "b1"))
    return scan


def _row(days_ago, **naver):
    when = (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()
    return {"scanned_at": when, "naver_result": {"mentioned": False, **naver}, "naver_ai_tab_visible": None}


def test_attach_takes_two_most_recent_measured_within_window(monkeypatch):
    rows = [_row(1, error="timeout", tag="fail-error"), _row(2, tag="d2"), _row(4, captcha_detected=True, tag="fail-captcha"),
            _row(5, tag="d5"), _row(9, tag="d9"), _row(20, tag="d20")]
    scan = _run_attach(monkeypatch, rows)
    tags = [p["naver_result"]["tag"] for p in scan["_prior_naver"]]
    assert tags == ["d2", "d5"]   # 실패 스캔(오류·캡차)은 건너뛰고 측정 성공 최신 2건만


def test_attach_ignores_scans_older_than_window(monkeypatch):
    scan = _run_attach(monkeypatch, [_row(20), _row(30)])
    assert "_prior_naver" not in scan


def test_attach_failure_does_not_break_scoring(monkeypatch):
    import db.supabase_client as sc

    async def boom(q):
        raise RuntimeError("db down")

    monkeypatch.setattr(sc, "get_client", lambda: _SB([]))
    monkeypatch.setattr(sc, "execute", boom)
    scan = {}
    asyncio.run(bs.attach_prior_naver(scan, "b1"))
    assert scan == {}


def test_attach_noop_without_business_id():
    scan = {}
    asyncio.run(bs.attach_prior_naver(scan, None))
    assert scan == {}
