"""결제-구독 불일치 감지 잡: 정상 환불·해지 오탐 방지와 진짜 불일치 유지 (2026-11-10).

11-10 실제 7일 환불 1분 뒤 이 잡이 error 알림을 보냈다 — 결제 뒤 사용자가 해지(cancelled)한 것은 불일치가 아니다.
"""
import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

import scheduler.jobs as jobs


def _iso(dt):
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")


class Q:
    def __init__(self, table, data):
        self.table, self.data = table, data

    def __getattr__(self, name):
        return lambda *a, **k: self


@pytest.fixture
def run(monkeypatch):
    sent = []

    def go(sub_rows, event_age_min=5):
        now = datetime.now(timezone.utc)
        ev_at = now - timedelta(minutes=event_age_min)
        events = [{"user_id": "u1", "event_type": "billing_issue", "amount": 17900, "created_at": _iso(ev_at)}]
        tables = {"payment_events": events, "subscriptions": sub_rows(ev_at), "system_alerts": []}

        async def fake_db(q):
            return SimpleNamespace(data=q.data)

        async def fake_alert(subject, body, **k):
            sent.append(subject)

        import db.supabase_client as dbc
        import services.email_sender as es
        monkeypatch.setattr(dbc, "get_client", lambda: SimpleNamespace(table=lambda n: Q(n, tables[n])))
        monkeypatch.setattr(jobs, "_db", fake_db)
        monkeypatch.setattr(es, "send_operator_alert", fake_alert)
        asyncio.run(jobs.payment_subscription_reconciliation_job())
        return sent

    return go


def test_refunded_then_cancelled_subscription_is_not_flagged(run):
    """결제 3분 뒤 해지(환불)돼 status=cancelled, updated_at이 결제 이후 → 불일치가 아니다."""
    sent = run(lambda ev: [{"status": "cancelled", "updated_at": _iso(ev + timedelta(minutes=3))}])
    assert sent == []


def test_cancelled_with_no_update_after_payment_is_still_flagged(run):
    """결제는 성공했는데 구독이 그 이전 상태(해지) 그대로면 반영 실패다 — 계속 잡아야 한다."""
    sent = run(lambda ev: [{"status": "cancelled", "updated_at": _iso(ev - timedelta(days=30))}])
    assert len(sent) == 1


def test_missing_subscription_and_stale_active_are_still_flagged(run):
    assert len(run(lambda ev: [])) == 1


def test_active_subscription_updated_after_payment_is_fine(run):
    assert run(lambda ev: [{"status": "active", "updated_at": _iso(ev + timedelta(seconds=2))}]) == []


def test_expired_status_after_payment_is_still_flagged(run):
    """cancelled만 예외다. expired 등 다른 비활성 상태는 결제 뒤에 그렇게 됐다면 여전히 점검 대상."""
    assert len(run(lambda ev: [{"status": "expired", "updated_at": _iso(ev + timedelta(minutes=1))}])) == 1
