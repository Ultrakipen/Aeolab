"""신규 구독 수용 한도 스위치 테스트 — 2026-10-30.

용량이 찼을 때만(기본 꺼짐) 신규 구독을 결제 전에 대기자 안내로 돌린다. 기존 구독자는 막지 않고, 집계 실패 시 막지 않는다.
"""
import asyncio
import inspect

import pytest

from services import capacity_gate as cg


def _run(coro):
    return asyncio.run(coro)


@pytest.fixture(autouse=True)
def _clean(monkeypatch):
    cg.reset_cache()
    monkeypatch.delenv("NEW_SUBSCRIBER_CAPACITY_GATE", raising=False)
    monkeypatch.delenv("CAPACITY_GATE_PCT", raising=False)
    yield
    cg.reset_cache()


def _snap(monkeypatch, pct=None, boom=False):
    import services.naver_capacity as nc

    async def fake(supabase=None):
        if boom:
            raise RuntimeError("db down")
        return {"used_pct": pct}

    monkeypatch.setattr(nc, "capacity_snapshot", fake)


def _subscriber(monkeypatch, is_sub):
    async def fake(user_id, supabase=None):
        return is_sub

    monkeypatch.setattr(cg, "_is_existing_subscriber", fake)


def test_default_is_off_and_accepts_everyone(monkeypatch):
    _snap(monkeypatch, pct=250)                                  # 한도를 한참 넘어도
    assert _run(cg.accepting_new_subscribers()) is True          # 스위치가 꺼져 있으면 받는다
    assert _run(cg.new_subscriber_blocked("u1")) is None


def test_on_and_full_blocks_new_subscriber_before_payment(monkeypatch):
    monkeypatch.setenv("NEW_SUBSCRIBER_CAPACITY_GATE", "true")
    _snap(monkeypatch, pct=100)
    _subscriber(monkeypatch, False)
    blocked = _run(cg.new_subscriber_blocked("u1"))
    assert blocked["code"] == "CAPACITY_WAITLIST" and "결제는 진행되지 않았습니다" in blocked["message"]


def test_existing_subscriber_is_never_blocked(monkeypatch):
    monkeypatch.setenv("NEW_SUBSCRIBER_CAPACITY_GATE", "true")
    _snap(monkeypatch, pct=180)
    _subscriber(monkeypatch, True)
    assert _run(cg.new_subscriber_blocked("u1")) is None          # 갱신·플랜 변경은 통과


def test_below_threshold_accepts(monkeypatch):
    monkeypatch.setenv("NEW_SUBSCRIBER_CAPACITY_GATE", "true")
    _snap(monkeypatch, pct=99.9)
    _subscriber(monkeypatch, False)
    assert _run(cg.new_subscriber_blocked("u1")) is None


def test_threshold_is_configurable(monkeypatch):
    monkeypatch.setenv("NEW_SUBSCRIBER_CAPACITY_GATE", "true")
    monkeypatch.setenv("CAPACITY_GATE_PCT", "90")
    _snap(monkeypatch, pct=92)
    _subscriber(monkeypatch, False)
    assert _run(cg.new_subscriber_blocked("u1")) is not None


def test_snapshot_failure_fails_open(monkeypatch):
    monkeypatch.setenv("NEW_SUBSCRIBER_CAPACITY_GATE", "true")
    _snap(monkeypatch, boom=True)
    _subscriber(monkeypatch, False)
    assert _run(cg.accepting_new_subscribers()) is True          # 집계 오류로 결제를 막지 않는다
    assert _run(cg.new_subscriber_blocked("u1")) is None


def test_subscriber_lookup_failure_fails_open(monkeypatch):
    monkeypatch.setenv("NEW_SUBSCRIBER_CAPACITY_GATE", "true")
    _snap(monkeypatch, pct=100)

    async def boom(user_id, supabase=None):
        raise RuntimeError("db down")

    monkeypatch.setattr(cg, "_is_existing_subscriber", boom)
    assert _run(cg.new_subscriber_blocked("u1")) is None


def test_decision_is_cached_to_protect_the_database(monkeypatch):
    monkeypatch.setenv("NEW_SUBSCRIBER_CAPACITY_GATE", "true")
    calls = []
    import services.naver_capacity as nc

    async def fake(supabase=None):
        calls.append(1)
        return {"used_pct": 100}

    monkeypatch.setattr(nc, "capacity_snapshot", fake)
    for _ in range(5):
        _run(cg.accepting_new_subscribers())
    assert len(calls) == 1


# ── 연결 구조 ──
def test_billing_issue_checks_gate_before_issuing_the_billing_key():
    from routers import webhook
    src = inspect.getsource(webhook.issue_billing)
    assert "new_subscriber_blocked(" in src
    assert src.index("new_subscriber_blocked(") < src.index("issue_billkey(")   # 빌링키 발급·결제 이전


def test_public_status_exposes_no_internal_numbers(monkeypatch):
    from routers import service_status
    monkeypatch.setenv("NEW_SUBSCRIBER_CAPACITY_GATE", "true")
    _snap(monkeypatch, pct=100)
    from fastapi import Response
    out = _run(service_status.capacity_status(Response()))
    assert set(out) == {"accepting", "message"} and out["accepting"] is False
    flat = str(out)
    assert "100" not in flat and "used_pct" not in flat and "limit" not in flat


def test_public_status_defaults_to_accepting():
    from routers import service_status
    from fastapi import Response
    out = _run(service_status.capacity_status(Response()))
    assert out == {"accepting": True, "message": ""}


def test_me_endpoint_reports_per_user_and_hides_numbers(monkeypatch):
    from routers import service_status
    monkeypatch.setenv("NEW_SUBSCRIBER_CAPACITY_GATE", "true")
    _snap(monkeypatch, pct=100)
    _subscriber(monkeypatch, False)
    out = _run(service_status.capacity_status_me({"id": "u1", "email": "a@b.c"}))
    assert out["blocked"] is True and "결제는 진행되지 않았습니다" in out["message"] and set(out) == {"blocked", "message"}
    _subscriber(monkeypatch, True)
    out2 = _run(service_status.capacity_status_me({"id": "u1", "email": "a@b.c"}))
    assert out2 == {"blocked": False, "message": ""}      # 기존 구독자는 막히지 않는다


def test_waitlist_registers_the_logged_in_users_email(monkeypatch):
    from routers import service_status
    import db.supabase_client as sc
    saved = {}

    class _T:
        def upsert(self, row):
            saved["row"] = row
            return self

    class _SB:
        def table(self, name):
            saved["table"] = name
            return _T()

    async def fake_execute(q):
        return None

    monkeypatch.setattr(sc, "get_client", lambda: _SB())
    monkeypatch.setattr(sc, "execute", fake_execute)
    out = _run(service_status.join_capacity_waitlist({"id": "u1", "email": " Owner@Shop.KR "}))
    assert out == {"ok": True} and saved["table"] == "waitlist"
    assert saved["row"]["email"] == "owner@shop.kr" and saved["row"]["category"] == "capacity_waitlist"
    assert _run(service_status.join_capacity_waitlist({"id": "u2", "email": ""}))["ok"] is False   # 이메일 없으면 등록하지 않음
