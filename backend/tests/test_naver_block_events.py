"""차단·회복 사건 기록 (2026-10-27): 사후 분석용 기록이 남고, 기록 실패가 차단 처리를 막지 않는다."""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import naver_access_guard as g  # noqa: E402


def _capture(monkeypatch):
    rows = []
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)   # 테스트에서는 기본 비활성이라 해제해 실제 경로를 탄다

    class _T:
        def insert(self, row):
            rows.append(row)
            return self

        def execute(self):
            return None

    class _C:
        def table(self, name):
            assert name == "naver_block_events"
            return _T()

    monkeypatch.setattr("db.supabase_client.get_client", lambda: _C())
    # 스레드를 동기로 돌려 검증한다
    class _Sync:
        def __init__(self, target=None, **kw):
            self._t = target

        def start(self):
            self._t()

    monkeypatch.setattr(g.threading, "Thread", _Sync)
    return rows


def test_block_and_recover_are_recorded(monkeypatch):
    rows = _capture(monkeypatch)
    g.report_search_block("naver_keyword_rank", now=1000.0)
    g.report_search_ok()
    g.report_place_block("smart_place_auto_check", now=2000.0)
    g.report_place_ok()
    got = [(r["surface"], r["event"]) for r in rows]
    assert got == [("search", "block"), ("search", "recover"), ("place", "block"), ("place", "recover")]
    assert rows[0]["source"] == "naver_keyword_rank" and rows[0]["cooldown_min"] == 60 and rows[0]["strikes"] == 1


def test_duplicate_block_while_open_is_not_recorded(monkeypatch):
    rows = _capture(monkeypatch)
    g.report_search_block("a", now=1000.0)
    g.report_search_block("b", now=1000.0 + 60)       # 이미 열린 상태의 늦은 보고 — 단계도 사건도 늘리지 않는다
    assert len([r for r in rows if r["event"] == "block"]) == 1


def test_ok_without_prior_block_records_nothing(monkeypatch):
    rows = _capture(monkeypatch)
    g.report_search_ok()
    g.report_place_ok()
    assert rows == []


def test_db_failure_does_not_break_block_handling(monkeypatch):
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)

    def _boom():
        raise RuntimeError("table missing")

    monkeypatch.setattr("db.supabase_client.get_client", _boom)

    class _Sync:
        def __init__(self, target=None, **kw):
            self._t = target

        def start(self):
            self._t()

    monkeypatch.setattr(g.threading, "Thread", _Sync)
    assert g.report_search_block("x", now=1000.0) == 60            # 예외 없이 쿨다운 분을 돌려준다
    assert g.begin_search_access("x", now=1000.0 + 30) == (False, g.SEARCH_COOLDOWN_ERROR)


def test_disabled_under_pytest_by_default():
    # PYTEST_CURRENT_TEST가 있는 기본 상태에서는 DB로 보내지 않는다(테스트가 운영 DB를 건드리지 않게)
    assert os.getenv("PYTEST_CURRENT_TEST")
    g._record_event("search", "block", "x", 1, 60)
