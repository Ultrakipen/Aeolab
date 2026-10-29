"""야간 처리 시간 보고의 집계 로직 — 야간 저장분만 세고 날짜 경계는 한국 시간으로 본다."""
import importlib.util
import os

_p = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "scripts", "nightly_duration_report.py")
_spec = importlib.util.spec_from_file_location("nightly_duration_report", _p)
nd = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(nd)


def test_only_night_saves_counted_and_span_is_minutes():
    rows = [
        {"scanned_at": "2026-10-28T17:10:00+00:00"},   # KST 10-29 02:10
        {"scanned_at": "2026-10-28T18:40:00+00:00"},   # KST 10-29 03:40
        {"scanned_at": "2026-10-29T03:00:00+00:00"},   # KST 12:00 낮 — 제외
        {"scanned_at": None},                           # 시각 없음 — 건너뜀
    ]
    out = nd.summarize(rows)
    assert len(out) == 1 and out[0]["count"] == 2 and out[0]["span_min"] == 90.0
    assert str(out[0]["date"]) == "2026-10-29"           # UTC 날짜(10-28)가 아니라 한국 날짜


def test_days_are_separated():
    rows = [{"scanned_at": "2026-10-27T18:00:00Z"}, {"scanned_at": "2026-10-28T18:30:00Z"}]
    out = nd.summarize(rows)
    assert [str(o["date"]) for o in out] == ["2026-10-28", "2026-10-29"]
