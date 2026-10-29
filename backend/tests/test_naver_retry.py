"""네이버 측정 실패 후 하루 뒤 1회 재시도 (2026-10-29)."""
import asyncio
import inspect
from datetime import date, datetime, timedelta, timezone

import pytest

import scheduler.jobs as jobs
from services import scan_scheduling as ss

NOW = datetime(2026, 10, 30, 2, 0, tzinfo=timezone.utc)
TODAY = date(2026, 10, 30)
FAILED = {"captcha_detected": True, "error": "x"}
OK = {"mentioned": True, "in_briefing": False}


def _scan(hours_ago, naver):
    return {"scanned_at": (NOW - timedelta(hours=hours_ago)).isoformat(), "naver_result": naver}


# ── 실패 판정 ────────────────────────────────────────────────────────────
@pytest.mark.parametrize("nr,expected", [
    ({"captcha_detected": True}, True), ({"error": "naver_search_cooldown"}, True), ({"quota_skipped": True}, True),
    ({"mentioned": False, "in_briefing": False}, False),       # 미노출은 실패가 아니다
    ({}, False), (None, False), ("x", False),                  # 비어 있는 행(순위 전용 등)은 실패로 오인하지 않는다
])
def test_naver_scan_failed(nr, expected):
    assert ss.naver_scan_failed(nr) is expected


# ── 재시도 판정 ──────────────────────────────────────────────────────────
def test_retries_once_the_day_after_a_failed_scan():
    assert ss.naver_retry_due([_scan(24, FAILED)], NOW, TODAY, access_blocked=False) is True


def test_no_retry_when_the_last_scan_measured_naver():
    assert ss.naver_retry_due([_scan(24, OK), _scan(96, FAILED)], NOW, TODAY, False) is False


def test_no_retry_while_access_is_blocked():
    """쿨다운 중에 다시 스캔해 봐야 네이버 항목은 같은 실패이고 AI 호출 비용만 쓴다."""
    assert ss.naver_retry_due([_scan(24, FAILED)], NOW, TODAY, access_blocked=True) is False


def test_retry_happens_at_most_once_per_failure_episode():
    """재시도도 실패했다면(연속 2회 실패) 더 두드리지 않고 정기 일정을 기다린다."""
    assert ss.naver_retry_due([_scan(24, FAILED), _scan(48, FAILED)], NOW, TODAY, False) is False
    assert ss.naver_retry_due([_scan(24, FAILED), _scan(48, OK)], NOW, TODAY, False) is True


def test_old_failures_are_left_to_the_regular_schedule():
    assert ss.naver_retry_due([_scan(40, FAILED)], NOW, TODAY, False) is False      # 36시간 초과
    assert ss.naver_retry_due([_scan(35, FAILED)], NOW, TODAY, False) is True


def test_no_retry_for_a_scan_made_today():
    """오늘 이미 스캔한 사업장을 같은 날 또 스캔하지 않는다(같은 날 재스캔 오귀속 방지)."""
    same_day = {"scanned_at": NOW.replace(hour=1).isoformat(), "naver_result": FAILED}
    assert ss.naver_retry_due([same_day], NOW, TODAY, False) is False


def test_no_history_or_unparseable_time_never_retries():
    assert ss.naver_retry_due([], NOW, TODAY, False) is False
    assert ss.naver_retry_due([{"scanned_at": "garbage", "naver_result": FAILED}], NOW, TODAY, False) is False
    assert ss.naver_retry_due([{"scanned_at": None, "naver_result": FAILED}], NOW, TODAY, False) is False


# ── 작업 쪽 판정(DB·가드를 가짜로) ────────────────────────────────────────
class _Res:
    def __init__(self, data): self.data = data


def _patch(monkeypatch, rows, blocked=False, db_fails=False):
    import services.naver_access_guard as g
    monkeypatch.setattr(g, "snapshot", lambda *a, **k: {"remaining_sec": 600 if blocked else 0})
    monkeypatch.setattr(g, "search_snapshot", lambda *a, **k: {"remaining_sec": 0})

    class _Q:
        def select(self, *_a, **_k): return self
        def eq(self, *_a, **_k): return self
        def order(self, *_a, **_k): return self
        def limit(self, *_a, **_k): return self

    class _SB:
        def table(self, _n): return _Q()

    async def fake_db(_q):
        if db_fails:
            raise RuntimeError("db down")
        return _Res(rows)

    monkeypatch.setattr(jobs, "_db", fake_db)
    return _SB()


def _recent(hours_ago, naver):
    return {"scanned_at": (datetime.now(timezone.utc) - timedelta(hours=hours_ago)).isoformat(), "naver_result": naver}


def test_job_helper_retries_a_recent_failure(monkeypatch):
    sb = _patch(monkeypatch, [_recent(26, FAILED)])
    assert asyncio.run(jobs._naver_retry_due_for(sb, "b1", datetime.now(timezone.utc).date())) is True


def test_job_helper_skips_when_guard_is_in_cooldown(monkeypatch):
    sb = _patch(monkeypatch, [_recent(26, FAILED)], blocked=True)
    assert asyncio.run(jobs._naver_retry_due_for(sb, "b1", datetime.now(timezone.utc).date())) is False


def test_job_helper_does_not_retry_when_it_cannot_check(monkeypatch):
    sb = _patch(monkeypatch, [], db_fails=True)
    assert asyncio.run(jobs._naver_retry_due_for(sb, "b1", datetime.now(timezone.utc).date())) is False


# ── 연결 구조 ────────────────────────────────────────────────────────────
def test_retry_only_converts_skip_days_and_is_wired_into_the_daily_scan():
    src = inspect.getsource(jobs.daily_scan_all)
    assert '_scan_mode == "skip" and await _naver_retry_due_for(' in src
    assert "_is_naver_retry = True" in src and "_is_naver_retry = False" in src
    assert "if _scan_notify_ok and not _is_naver_retry:" in src          # 재시도 스캔은 '스캔 완료' 알림을 다시 보내지 않는다


def test_daily_scan_all_keeps_its_naver_batch_decorator():
    """새 헬퍼를 끼워 넣다 데코레이터가 헬퍼로 옮겨 가면 야간 스캔이 배치 몫 보호를 잃는다(2026-10-29 실제로 한 번 일어난 실수)."""
    full = inspect.getsource(jobs)
    assert "@_naver_batch_job\nasync def daily_scan_all():" in full
    assert "@_naver_batch_job\nasync def _naver_retry_due_for" not in full
