"""이미 같은 플랜을 이용 중인 활성 구독자의 중복 결제 차단 (2026-11-06 상업 출시 전 점검 P1).

issue_billing은 활성 구독을 확인하지 않아 재결제 시 같은 금액이 또 청구되고 end_at이 덮어써졌다.
막는 범위는 '같은 플랜·같은 주기·status=active·만료 전'뿐이며, 업그레이드(다른 플랜)·유예·해지 후 재구독은 허용한다.
"""
import asyncio
import inspect
from datetime import date, timedelta

from config.prices import PLAN_PRICES, YEARLY_AMOUNTS

BASIC_MONTHLY = next(a for a, p in PLAN_PRICES.items() if p == "basic" and a not in YEARLY_AMOUNTS)
PRO_MONTHLY = next(a for a, p in PLAN_PRICES.items() if p == "pro" and a not in YEARLY_AMOUNTS)
BASIC_YEARLY = next(a for a, p in PLAN_PRICES.items() if p == "basic" and a in YEARLY_AMOUNTS)

FUTURE = (date.today() + timedelta(days=15)).isoformat()
PAST = (date.today() - timedelta(days=3)).isoformat()


class _Chain:
    def __getattr__(self, _name):
        return lambda *a, **k: self


class _Client:
    def table(self, _name):
        return _Chain()


class _Res:
    def __init__(self, data):
        self.data = data


def _guard(monkeypatch, rows, amount):
    from routers import webhook

    async def fake_execute(_q):
        if isinstance(rows, Exception):
            raise rows
        return _Res(rows)

    monkeypatch.setattr(webhook, "execute", fake_execute)
    monkeypatch.setattr(webhook, "get_client", lambda: _Client())
    return asyncio.run(webhook._already_subscribed_same_plan("u1", amount))


def _row(**kw):
    base = {"plan": "basic", "status": "active", "billing_cycle": "monthly", "end_at": FUTURE}
    base.update(kw)
    return [base]


def test_same_plan_active_is_blocked(monkeypatch):
    assert _guard(monkeypatch, _row(), BASIC_MONTHLY) is True


def test_upgrade_to_other_plan_is_allowed(monkeypatch):
    assert _guard(monkeypatch, _row(), PRO_MONTHLY) is False


def test_other_billing_cycle_is_allowed(monkeypatch):
    assert _guard(monkeypatch, _row(), BASIC_YEARLY) is False


def test_grace_period_can_pay_again_to_recover(monkeypatch):
    assert _guard(monkeypatch, _row(status="grace_period"), BASIC_MONTHLY) is False


def test_cancelled_can_resubscribe(monkeypatch):
    assert _guard(monkeypatch, _row(status="cancelled"), BASIC_MONTHLY) is False


def test_expired_active_row_is_not_blocked(monkeypatch):
    assert _guard(monkeypatch, _row(end_at=PAST), BASIC_MONTHLY) is False


def test_no_subscription_is_allowed(monkeypatch):
    assert _guard(monkeypatch, [], BASIC_MONTHLY) is False


def test_unknown_amount_is_left_to_later_validation(monkeypatch):
    assert _guard(monkeypatch, _row(), 123) is False


def test_lookup_failure_does_not_block_payment(monkeypatch):
    assert _guard(monkeypatch, RuntimeError("db down"), BASIC_MONTHLY) is False


def test_guard_runs_before_billkey_issue_and_charge():
    from routers import webhook
    src = inspect.getsource(webhook.issue_billing)
    assert "_already_subscribed_same_plan(" in src
    assert src.index("_already_subscribed_same_plan(") < src.index("issue_billkey(")
    assert src.index("_already_subscribed_same_plan(") < src.index("billpay(")
