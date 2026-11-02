"""알림 보조 기록 정리 잡 (2026-11-02, scheduler.jobs.purge_old_notification_records).

삭제 범위가 정확해야 한다: 건너뜀(skipped)·주간 상한 원장(periodic_sent)·발송 간격 기록(cadence_*)만, 각각 지정한 기간이 지난 것만.
발송 이력(sent·failed)과 다른 종류, 시각 조건 없는 삭제는 없어야 한다.
"""
import asyncio
import os
import sys
from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scheduler import jobs  # noqa: E402


class _Q:
    def __init__(self, log):
        self.log, self.calls = log, []

    def delete(self): self.calls.append(("delete",)); return self
    def eq(self, c, v): self.calls.append(("eq", c, v)); return self
    def like(self, c, v): self.calls.append(("like", c, v)); return self
    def lt(self, c, v): self.calls.append(("lt", c, v)); return self


class _DB:
    def __init__(self, fail_on=None):
        self.queries, self.fail_on = [], fail_on

    def table(self, name):
        q = _Q(self.queries)
        q.table_name = name
        self.queries.append(q)
        return q


def _run(monkeypatch, fail_on=None):
    db = _DB()
    state = {"n": 0}

    async def fake_execute(q):
        state["n"] += 1
        if fail_on is not None and state["n"] == fail_on:
            raise RuntimeError("boom")
        return SimpleNamespace(data=[{"id": 1}, {"id": 2}])

    import db.supabase_client as sc
    monkeypatch.setattr(sc, "get_client", lambda: db)
    monkeypatch.setattr(sc, "execute", fake_execute)
    asyncio.run(jobs.purge_old_notification_records())
    return db.queries


def _kinds(q):
    return {c[0] for c in q.calls}


def test_three_scoped_deletes_each_with_a_time_limit(monkeypatch):
    qs = _run(monkeypatch)
    assert len(qs) == 3 and all(q.table_name == "notifications" for q in qs)
    for q in qs:
        assert ("delete",) in q.calls and "lt" in _kinds(q), "시각 조건 없는 삭제가 있다"
        assert _kinds(q) & {"eq", "like"}, "종류 조건 없는 삭제가 있다"
    assert ("eq", "status", "skipped") in qs[0].calls
    assert ("eq", "type", "periodic_sent") in qs[1].calls
    assert ("like", "type", "cadence_%") in qs[2].calls


def test_never_deletes_sent_or_failed_history(monkeypatch):
    qs = _run(monkeypatch)
    flat = [c for q in qs for c in q.calls]
    assert ("eq", "status", "sent") not in flat and ("eq", "status", "failed") not in flat
    assert not any(c[0] == "eq" and c[1] == "type" and c[2] in ("weekly_report", "monthly_report", "score_change", "competitor", "competitor_alert") for c in flat)


def test_cutoffs_use_the_documented_retention(monkeypatch):
    now = datetime.utcnow()
    qs = _run(monkeypatch)
    def age(q):
        c = next(c for c in q.calls if c[0] == "lt")
        return c[1], round((now - datetime.fromisoformat(c[2])).total_seconds() / 86400)
    assert age(qs[0]) == ("created_at", 30) and age(qs[1]) == ("sent_at", 14) and age(qs[2]) == ("sent_at", 60)


def test_longer_cadence_interval_extends_cadence_retention(monkeypatch):
    monkeypatch.setenv("NOTIFY_MIN_DAYS_ACTION_ITEMS", "45")          # 가장 긴 간격 45일 → 기록은 90일 보관(간격 도중에 지워지면 안 된다)
    now = datetime.utcnow()
    qs = _run(monkeypatch)
    c = next(c for c in qs[2].calls if c[0] == "lt")
    assert round((now - datetime.fromisoformat(c[2])).total_seconds() / 86400) == 90


def test_one_failure_does_not_stop_the_others(monkeypatch):
    qs = _run(monkeypatch, fail_on=1)
    assert len(qs) == 3                                               # 첫 삭제가 실패해도 나머지 둘은 시도한다


def test_job_is_registered_daily_and_db_only():
    import inspect
    src = inspect.getsource(jobs.start_scheduler)
    assert 'id="notification_records_purge"' in src and "purge_old_notification_records" in src
    body = inspect.getsource(jobs.purge_old_notification_records)
    assert "playwright" not in body.lower() and "naver" not in body.lower()      # 네이버 접속 없음(지침 8)
