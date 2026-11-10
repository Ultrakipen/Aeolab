"""재가입 반복 이용 방어 — 체험·탈퇴·정리 잡 연결 시험 (2026-11-10).

① 가입 후 1회 무료 체험: 이전 이용 기록이 있으면 403(BASIC_TRIAL_USED), 통과하면 이용 기록
② 탈퇴: 근거가 지워지기 전에 이용 기록 + 식별값 없는 노출 규모 집계
③ 만료 키 정리 잡: 꺼져 있으면 아무것도 하지 않고, 실패해도 예외를 내지 않는다
"""
import asyncio
import inspect
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from routers import scan, settings
from scheduler import jobs


def run(c):
    return asyncio.run(c)


class Q:
    def __init__(self, table, log):
        self.table, self.log, self.single, self.op = table, log, False, "select"

    def maybe_single(self):
        self.single = True
        return self

    def delete(self):
        self.op = "delete"
        return self

    def __getattr__(self, _n):
        return lambda *a, **k: self


# ── ① 무료 체험 ──
def _trial_env(monkeypatch, conflict):
    log = []

    async def fake_execute(q):
        if q.table == "subscriptions":
            return SimpleNamespace(data=None)
        if q.table == "profiles":
            return SimpleNamespace(data={"basic_trial_used": False} if q.single else None)
        if q.table == "businesses":
            return SimpleNamespace(data={"id": "b1", "name": "n", "category": "cafe", "region": "r", "keywords": []})
        return SimpleNamespace(data=None)

    async def fake_conflict(purpose, uid, email):
        log.append(("conflict", purpose, uid, email))
        return conflict

    async def fake_record(purpose, uid, email):
        log.append(("record", purpose, uid, email))
        return 3

    class Stop(Exception):
        pass

    monkeypatch.setattr(scan, "execute", fake_execute)
    monkeypatch.setattr(scan, "get_client", lambda: SimpleNamespace(table=lambda n: Q(n, log)))
    import services.discount_guard as dg
    import services.naver_usage_meter as meter
    import services.playwright_slot as slot
    monkeypatch.setattr(dg, "prior_use_conflict", fake_conflict)
    monkeypatch.setattr(dg, "record_use", fake_record)
    monkeypatch.setattr(slot, "mark_interactive", lambda *a, **k: None)

    def stop(*_a, **_k):
        raise Stop()

    monkeypatch.setattr(meter, "note_user_scan", stop)     # 기록 이후 흐름(실제 스캔)은 여기서 멈춘다
    return log, Stop


def _trial_call():
    return scan.run_basic_trial(scan.BasicTrialRequest(business_id="b1"), {"id": "u1", "email": "a@b.co"})


def test_trial_blocked_when_previous_use_recorded(monkeypatch):
    log, _ = _trial_env(monkeypatch, conflict="naver_place")
    with pytest.raises(HTTPException) as e:
        run(_trial_call())
    assert e.value.status_code == 403 and e.value.detail["code"] == "BASIC_TRIAL_USED"
    assert not any(x[0] == "record" for x in log)           # 막힌 요청은 기록하지 않는다
    assert "의심" not in e.value.detail["message"]          # 사용자를 탓하지 않는 어조


def test_trial_allowed_records_use_before_scan_starts(monkeypatch):
    log, Stop = _trial_env(monkeypatch, conflict=None)
    try:
        with pytest.raises(Stop):
            run(_trial_call())
    finally:
        scan._active_scans.discard("u1:b1")
    kinds = [x[0] for x in log]
    assert kinds.index("conflict") < kinds.index("record")
    assert ("record", "trial", "u1", "a@b.co") in log


# ── ② 탈퇴 ──
def _delete_env(monkeypatch, *, discount, trial, caplog=None):
    log = []

    async def fake_execute(q):
        if q.op == "delete":
            log.append(("delete", q.table))
            return SimpleNamespace(data=[])
        if q.table == "subscriptions":
            return SimpleNamespace(data={"status": "cancelled", "first_month_discount_until": "2026-12-01" if discount else None, "billing_key": None})
        if q.table == "profiles":
            return SimpleNamespace(data={"basic_trial_used": trial})
        if q.table == "businesses":
            return SimpleNamespace(data=[])
        return SimpleNamespace(data=[])

    async def fake_record(purpose, uid, email):
        log.append(("record_use", purpose, uid, email))
        return 3

    monkeypatch.setattr(settings, "execute", fake_execute)
    monkeypatch.setattr(settings, "get_client", lambda: SimpleNamespace(table=lambda n: Q(n, log)))
    monkeypatch.setattr(settings, "create_client", lambda *a, **k: SimpleNamespace(auth=SimpleNamespace(admin=SimpleNamespace(delete_user=lambda uid: None))))
    import services.discount_guard as dg
    monkeypatch.setattr(dg, "record_use", fake_record)
    return log


def _exposure_lines(caplog):
    return [r.getMessage() for r in caplog.records if "[withdraw_exposure]" in r.getMessage()]


def test_withdrawal_records_use_before_anything_is_deleted_and_counts_exposure_in_log(monkeypatch, caplog):
    import logging
    caplog.set_level(logging.INFO, logger="aeolab")
    log = _delete_env(monkeypatch, discount=True, trial=True)
    run(settings.delete_account({"id": "u1", "email": "a@b.co"}))
    first_delete = next(i for i, x in enumerate(log) if x[0] == "delete")
    before = log[:first_delete]
    assert ("record_use", "discount", "u1", "a@b.co") in before
    assert ("record_use", "trial", "u1", "a@b.co") in before
    lines = _exposure_lines(caplog)
    assert lines == ["[withdraw_exposure] discount=True trial=True"]
    assert "u1" not in lines[0] and "a@b.co" not in lines[0]       # 식별값을 남기지 않는다


def test_withdrawal_of_user_who_used_neither_records_nothing(monkeypatch, caplog):
    import logging
    caplog.set_level(logging.INFO, logger="aeolab")
    log = _delete_env(monkeypatch, discount=False, trial=False)
    run(settings.delete_account({"id": "u1", "email": "a@b.co"}))
    assert not any(x[0] == "record_use" for x in log) and _exposure_lines(caplog) == []


def test_withdrawal_only_discount(monkeypatch, caplog):
    import logging
    caplog.set_level(logging.INFO, logger="aeolab")
    log = _delete_env(monkeypatch, discount=True, trial=False)
    run(settings.delete_account({"id": "u1", "email": "a@b.co"}))
    assert [x for x in log if x[0] == "record_use"] == [("record_use", "discount", "u1", "a@b.co")]
    assert _exposure_lines(caplog) == ["[withdraw_exposure] discount=True trial=False"]


def test_withdrawal_continues_when_guard_recording_fails(monkeypatch):
    log = _delete_env(monkeypatch, discount=True, trial=False)
    import services.discount_guard as dg

    async def boom(*_a, **_k):
        raise RuntimeError("guard down")

    monkeypatch.setattr(dg, "record_use", boom)
    run(settings.delete_account({"id": "u1", "email": "a@b.co"}))       # 예외 없이 끝까지 진행
    assert ("delete", "subscriptions") in log and ("delete", "businesses") in log


def test_exposure_counter_does_not_depend_on_payment_events_check_constraint():
    """payment_events.event_type CHECK('billing_issue','renewal') 때문에 새 종류의 행이 거절될 수 있어 쓰지 않는다."""
    src = inspect.getsource(settings.delete_account)
    assert "withdraw_exposure" in src and "record_payment_event" not in src


# ── ③ 정리 잡 ──
def test_purge_job_does_nothing_when_disabled(monkeypatch):
    import services.discount_guard as dg
    monkeypatch.setattr(dg, "guard_enabled", lambda: False)
    called = []

    async def purge():
        called.append(1)
        return 5

    monkeypatch.setattr(dg, "purge_expired", purge)
    run(jobs.purge_expired_discount_keys())
    assert called == []


def test_purge_job_runs_when_enabled_and_swallows_errors(monkeypatch):
    import services.discount_guard as dg
    monkeypatch.setattr(dg, "guard_enabled", lambda: True)
    called = []

    async def purge():
        called.append(1)
        raise RuntimeError("db down")

    monkeypatch.setattr(dg, "purge_expired", purge)
    run(jobs.purge_expired_discount_keys())            # 예외 없이 끝난다
    assert called == [1]


def test_purge_job_is_registered_daily():
    src = inspect.getsource(jobs)
    assert 'purge_expired_discount_keys, "cron"' in src and 'id="discount_keys_purge"' in src
