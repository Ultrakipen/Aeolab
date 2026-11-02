"""알림 현황 요약 스크립트(scripts/notify_report.py)의 집계 규칙 (2026-11-02)."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts"))

import notify_report as nr  # noqa: E402


def _r(t, st="sent", **content):
    return {"type": t, "status": st, "content": content}


ROWS = [
    _r("weekly_report"), _r("weekly_report", "failed"), _r("action_items"),
    _r("scan_complete", "skipped", reason="weekly_cap"), _r("scan_complete", "skipped", reason="weekly_cap"),
    _r("action_items", "skipped", reason="subscription_ended"), _r("score_change", "skipped"),            # 사유 없는 옛 건너뜀 기록
    _r("periodic_sent", phone_hash="H_SECRET_ONE", ttype="weekly_report"), _r("periodic_sent", phone_hash="H_SECRET_ONE", ttype="scan_complete"),
    _r("periodic_sent", phone_hash="H_SECRET_TWO", ttype="scan_complete"),
    _r("cadence_action_items"), _r("cadence_score_change"), _r("cadence_score_change"),
    {"type": "ai_citation", "status": "sent", "content": None},                                           # content가 null이어도 깨지지 않는다
]


def test_internal_records_are_not_counted_as_deliveries():
    s = nr.summarize(ROWS)
    assert s["by_status"] == {"sent": 3, "failed": 1, "skipped": 4}          # periodic_sent·cadence_*는 제외
    assert not any(t.startswith(("periodic_sent", "cadence_")) for (t, _st) in s["by_type_status"])


def test_skipped_are_split_by_reason_and_old_rows_without_reason_are_visible():
    s = nr.summarize(ROWS)
    assert s["skip_reason"][("scan_complete", "weekly_cap")] == 2
    assert s["skip_reason"][("action_items", "subscription_ended")] == 1
    assert s["skip_reason"][("score_change", "(사유 없음)")] == 1


def test_ledger_and_cadence_counts():
    s = nr.summarize(ROWS)
    assert s["ledger_by_ttype"] == {"weekly_report": 1, "scan_complete": 2} and s["ledger_numbers"] == 2
    assert s["cadence_by_kind"] == {"action_items": 1, "score_change": 2}


def test_render_never_prints_phone_hash_or_names_and_handles_empty():
    out = nr.render(nr.summarize(ROWS), 7)
    assert "H_SECRET" not in out                                      # 번호 해시 값 자체는 출력하지 않는다(고유 번호 수만)
    assert "phone_hash" not in out and "010" not in out
    assert "최근 7일" in out and "weekly_cap" in out and "고유 번호 2개" in out
    empty = nr.render(nr.summarize([]), 3)
    assert "기록 없음" in empty and "없음" in empty
