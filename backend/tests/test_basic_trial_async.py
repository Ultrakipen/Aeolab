"""가입 후 1회 무료 측정의 백그라운드 실행·상태·중단 복구 테스트 — 2026-10-30.

요청 안에서 끝까지 기다리면 nginx 120초 한도(504)에 걸리고 탭을 닫으면 끊길 수 있다 → 즉시 응답 + 백그라운드 실행 + 상태 조회.
"""
import asyncio
import os
import time
from datetime import datetime, timedelta, timezone

os.environ.setdefault("GEMINI_API_KEY", "test-key-not-used")
os.environ.setdefault("OPENAI_API_KEY", "test-key-not-used")

import pytest  # noqa: E402

from routers import scan  # noqa: E402

_REAL_SLEEP = asyncio.sleep


class _Res:
    def __init__(self, data=None):
        self.data = data


class _Q:
    """supabase 체인 쿼리 가짜 — 테이블 이름별로 data를 주고 update/upsert를 기록한다."""

    def __init__(self, db, name):
        self.db, self.name = db, name
        self.op = "select"

    def __getattr__(self, attr):
        def chain(*a, **k):
            if attr in ("update", "upsert", "insert"):
                self.op = attr
                self.db.setdefault("writes", []).append((self.name, attr, a[0] if a else None))
            return self
        return chain


class _DB:
    def __init__(self, tables):
        self.tables, self.state = tables, {}

    def table(self, name):
        return _Q(self.state, name) if False else _Q(self.state, name)


class _FakeSB:
    def __init__(self, tables):
        self.tables = tables
        self.writes = []

    def table(self, name):
        q = _Q(self.__dict__, name)
        q.tables = self.tables
        return q


def _install(monkeypatch, tables, run_full_scan=None):
    sb = _FakeSB(tables)

    async def fake_execute(q):
        if q.op in ("update", "upsert", "insert"):
            return _Res(None)
        v = sb.tables.get(q.name)
        return _Res(v)

    monkeypatch.setattr(scan, "get_client", lambda: sb)
    monkeypatch.setattr(scan, "execute", fake_execute)
    if run_full_scan is not None:
        monkeypatch.setattr(scan, "_run_full_scan", run_full_scan)
    scan._basic_trial_runs.clear()
    scan._active_scans.clear()
    return sb


def _writes(sb, table, op=None):
    w = sb.__dict__.get("writes", [])
    return [x for x in w if x[0] == table and (op is None or x[1] == op)]


BIZ = {"id": "b1", "name": "내가게", "category": "restaurant", "region": "창원", "keywords": ["한식"]}
USER = {"id": "u1", "email": "a@b.c"}


def _req():
    return scan.BasicTrialRequest(business_id="b1")


def test_request_returns_immediately_and_scan_runs_in_background(monkeypatch):
    done = {}

    async def slow_scan(scan_id, req_scan):
        await _REAL_SLEEP(0.4)
        done["ok"] = True

    sb = _install(monkeypatch, {"subscriptions": None, "profiles": {"basic_trial_used": False}, "businesses": BIZ}, slow_scan)

    async def go():
        t = time.monotonic()
        out = await scan.run_basic_trial(_req(), USER)
        assert time.monotonic() - t < 0.2                      # 측정이 끝나기를 기다리지 않는다
        assert out["status"] == "running" and out["scan_id"]
        assert scan._basic_trial_runs["u1"]["status"] == "running"
        assert "u1:b1" in scan._active_scans                   # 중복 실행 차단은 유지
        await _REAL_SLEEP(0.6)
        assert done.get("ok") and scan._basic_trial_runs["u1"]["status"] == "done"
        assert "u1:b1" not in scan._active_scans               # 끝나면 해제

    asyncio.run(go())
    assert not [w for w in _writes(sb, "profiles", "update")]    # 성공 시 체험 기록을 되돌리지 않는다


def test_failure_rolls_back_trial_and_reports_error(monkeypatch):
    async def boom(scan_id, req_scan):
        raise RuntimeError("scan exploded")

    sb = _install(monkeypatch, {"subscriptions": None, "profiles": {"basic_trial_used": False}, "businesses": BIZ}, boom)

    async def go():
        await scan.run_basic_trial(_req(), USER)
        await _REAL_SLEEP(0.1)
        run = scan._basic_trial_runs["u1"]
        assert run["status"] == "error" and "차감되지 않았" in run["error"]
        assert "u1:b1" not in scan._active_scans

    asyncio.run(go())
    rollback = _writes(sb, "profiles", "update")
    assert rollback and rollback[-1][2]["basic_trial_used"] is False   # 다시 시도할 수 있게 되돌린다


def test_second_start_while_running_is_rejected(monkeypatch):
    async def slow_scan(scan_id, req_scan):
        await _REAL_SLEEP(0.3)

    _install(monkeypatch, {"subscriptions": None, "profiles": {"basic_trial_used": False}, "businesses": BIZ}, slow_scan)

    async def go():
        await scan.run_basic_trial(_req(), USER)
        with pytest.raises(scan.HTTPException) as ei:
            await scan.run_basic_trial(_req(), USER)
        assert ei.value.status_code == 409
        await _REAL_SLEEP(0.4)

    asyncio.run(go())


# ── 상태 조회 ──
def _status(monkeypatch, tables, runs=None):
    sb = _install(monkeypatch, tables)
    scan._basic_trial_runs.update(runs or {})
    out = asyncio.run(scan.get_basic_trial_status(USER))
    return out, sb


def test_status_reports_running_run(monkeypatch):
    out, _ = _status(monkeypatch, {"profiles": {"basic_trial_used": True, "basic_trial_used_at": datetime.now(timezone.utc).isoformat(),
                                                "basic_trial_business_id": "b1"}, "subscriptions": None},
                     {"u1": {"status": "running", "scan_id": "s1", "started_at": time.time() - 30}})
    assert out["run"]["status"] == "running" and out["run"]["elapsed_sec"] >= 30 and out["interrupted"] is False
    assert out["used"] is True


def test_status_detects_interruption_and_restores_the_trial(monkeypatch):
    started = (datetime.now(timezone.utc) - timedelta(minutes=3)).isoformat()
    out, sb = _status(monkeypatch, {"profiles": {"basic_trial_used": True, "basic_trial_used_at": started, "basic_trial_business_id": "b1"},
                                    "subscriptions": None, "scan_results": None})   # 서버 재시작으로 실행 정보도 결과도 없다
    assert out["interrupted"] is True and out["used"] is False and out["can_use"] is True
    assert _writes(sb, "profiles", "update")[-1][2]["basic_trial_used"] is False


def test_status_does_not_restore_when_a_scan_result_exists(monkeypatch):
    started = (datetime.now(timezone.utc) - timedelta(minutes=3)).isoformat()
    out, sb = _status(monkeypatch, {"profiles": {"basic_trial_used": True, "basic_trial_used_at": started, "basic_trial_business_id": "b1"},
                                    "subscriptions": None, "scan_results": [{"id": "s1"}]})
    assert out["interrupted"] is False and out["used"] is True    # 결과가 있으면 정상 완료 — 되돌리지 않는다
    assert not _writes(sb, "profiles", "update")


def test_status_does_not_restore_an_old_trial(monkeypatch):
    started = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
    out, sb = _status(monkeypatch, {"profiles": {"basic_trial_used": True, "basic_trial_used_at": started, "basic_trial_business_id": "b1"},
                                    "subscriptions": None, "scan_results": None})
    assert out["interrupted"] is False and out["used"] is True    # 오래 전에 쓴 체험은 건드리지 않는다
    assert not _writes(sb, "profiles", "update")


def test_status_does_not_restore_for_subscribers(monkeypatch):
    started = (datetime.now(timezone.utc) - timedelta(minutes=3)).isoformat()
    out, sb = _status(monkeypatch, {"profiles": {"basic_trial_used": True, "basic_trial_used_at": started, "basic_trial_business_id": "b1"},
                                    "subscriptions": {"status": "active"}, "scan_results": None})
    assert out["interrupted"] is False and not _writes(sb, "profiles", "update")


def test_finished_runs_expire_but_running_ones_never(monkeypatch):
    now = time.time()
    out, _ = _status(monkeypatch, {"profiles": {"basic_trial_used": True, "basic_trial_used_at": None}, "subscriptions": None},
                     {"u1": {"status": "done", "scan_id": "s1", "started_at": now - 900, "finished_at": now - 700}})
    assert out["run"] is None                                    # 끝난 지 오래된 정보는 정리
    out2, _ = _status(monkeypatch, {"profiles": {"basic_trial_used": True, "basic_trial_used_at": None}, "subscriptions": None},
                      {"u1": {"status": "running", "scan_id": "s1", "started_at": now - 5000}})
    assert out2["run"]["status"] == "running"                    # 진행 중인 것은 정리하지 않는다
