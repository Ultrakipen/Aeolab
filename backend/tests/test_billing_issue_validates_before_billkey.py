"""빌링키 발급 전에 계정·금액·첫 달 할인 자격을 검증한다 (2026-11-10).

수정 전에는 issue_billkey 호출 뒤에 검증해, 거부(할인 자격 없음·잘못된 금액·없는 계정)되면
크렙에 빌링키가 남고 1회용 authKey가 소진됐다.
"""
import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from config.prices import DISCOUNT_TO_REGULAR
from models.schemas import BillingIssueRequest
from routers import webhook

DISCOUNT_AMOUNT = next(iter(DISCOUNT_TO_REGULAR))   # 8950
REGULAR_AMOUNT = DISCOUNT_TO_REGULAR[DISCOUNT_AMOUNT]


class _Chain:
    def __getattr__(self, _n):
        return lambda *a, **k: self


def _setup(monkeypatch, *, profile_exists=True, first_time=True):
    calls = {"issue": 0, "pay": 0}

    async def fake_execute(_q):
        return SimpleNamespace(data=[{"user_id": "u1"}] if profile_exists else [])

    async def fake_issue(auth_key):
        calls["issue"] += 1
        return SimpleNamespace(ok=False, code="X", msg="stop here", data={})   # 도달 여부만 확인하고 멈춘다

    async def fake_first(_uid, _email=None):
        return first_time

    async def no_block(_uid):
        return None

    async def not_subscribed(_uid, _amt):
        return False

    monkeypatch.setattr(webhook, "execute", fake_execute)
    monkeypatch.setattr(webhook, "get_client", lambda: SimpleNamespace(table=lambda _n: _Chain()))
    monkeypatch.setattr(webhook.creb_client, "issue_billkey", fake_issue)
    monkeypatch.setattr(webhook, "_is_first_time_subscriber", fake_first)
    monkeypatch.setattr(webhook, "_already_subscribed_same_plan", not_subscribed)
    monkeypatch.setattr(webhook, "_check_billing_issue_rate_limit", lambda ip: None)
    import services.capacity_gate as cg
    monkeypatch.setattr(cg, "new_subscriber_blocked", no_block)
    return calls


def _call(amount, plan="Basic"):
    body = BillingIssueRequest(authKey="ak", plan=plan, amount=amount)
    req = SimpleNamespace(client=SimpleNamespace(host="1.2.3.4"))
    return asyncio.run(webhook.issue_billing(body, req, {"id": "u1", "email": "a@b.c"}))


def test_invalid_amount_rejected_without_issuing_billkey(monkeypatch):
    calls = _setup(monkeypatch)
    with pytest.raises(HTTPException) as e:
        _call(12345)
    assert e.value.status_code == 400 and calls["issue"] == 0


def test_discount_for_existing_subscriber_rejected_without_issuing_billkey(monkeypatch):
    calls = _setup(monkeypatch, first_time=False)
    with pytest.raises(HTTPException) as e:
        _call(DISCOUNT_AMOUNT)
    assert e.value.status_code == 400 and calls["issue"] == 0


def test_missing_profile_rejected_without_issuing_billkey(monkeypatch):
    calls = _setup(monkeypatch, profile_exists=False)
    with pytest.raises(HTTPException) as e:
        _call(REGULAR_AMOUNT)
    assert e.value.status_code == 400 and calls["issue"] == 0


def test_valid_new_subscriber_discount_still_reaches_billkey_issue(monkeypatch):
    calls = _setup(monkeypatch, first_time=True)
    with pytest.raises(HTTPException) as e:
        _call(DISCOUNT_AMOUNT)           # fake_issue가 실패를 돌려줘 여기서 멈춘다 — 도달했다는 뜻
    assert calls["issue"] == 1
    assert "빌링키 발급에 실패" in str(e.value.detail)


def test_regular_price_reaches_billkey_issue(monkeypatch):
    calls = _setup(monkeypatch)
    with pytest.raises(HTTPException):
        _call(REGULAR_AMOUNT)
    assert calls["issue"] == 1
