"""결제-구독 불일치 감지 잡 (2026-11-10 수정).

픽스처는 **운영 DB에서 확인한 실제 행 모양**을 따른다: subscriptions.updated_at은 코드도 트리거도 갱신하지 않아 결제·해지 뒤에도
옛 값(09-29 결제 행의 updated_at=04-18)으로 남는다. 처음 만든 수정은 updated_at이 갱신된다고 가정한 가짜 행으로만 통과해
실제로는 효과가 없었다(같은 날 과거 알림 조회로 발견). 그래서 모든 정상 케이스의 updated_at을 일부러 오래된 값으로 둔다.
"""
import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

import scheduler.jobs as jobs

STALE = "2026-04-18T07:29:25+00:00"     # 실제 행에서 확인한, 결제 뒤에도 바뀌지 않는 값


def _iso(dt):
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")


class Q:
    def __init__(self, data):
        self.data = data

    def __getattr__(self, name):
        return lambda *a, **k: self


@pytest.fixture
def run(monkeypatch):
    sent = []

    def go(sub_rows, event_type="billing_issue"):
        sent.clear()
        now = datetime.now(timezone.utc)
        ev_at = now - timedelta(minutes=5)
        events = [{"user_id": "u1", "event_type": event_type, "amount": 17900, "created_at": _iso(ev_at)}]
        tables = {"payment_events": events, "subscriptions": sub_rows(ev_at), "system_alerts": []}

        async def fake_db(q):
            return SimpleNamespace(data=q.data)

        async def fake_alert(subject, body, **k):
            sent.append(subject)

        import db.supabase_client as dbc
        import services.email_sender as es
        monkeypatch.setattr(dbc, "get_client", lambda: SimpleNamespace(table=lambda n: Q(tables[n])))
        monkeypatch.setattr(jobs, "_db", fake_db)
        monkeypatch.setattr(es, "send_operator_alert", fake_alert)
        asyncio.run(jobs.payment_subscription_reconciliation_job())
        return list(sent)

    return go


def row(status, start, end, updated=STALE):
    return [{"status": status, "start_at": _iso(start) if start else None, "end_at": _iso(end) if end else None, "updated_at": updated}]


def test_refunded_cancelled_subscription_with_stale_updated_at_is_not_flagged(run):
    """11-10 실제 환불: 결제와 같은 시각에 start_at이 기록되고 해지로 end_at=오늘, updated_at은 옛 값."""
    assert run(lambda ev: row("cancelled", ev, ev)) == []


def test_resubscription_on_existing_row_is_not_flagged(run):
    """기존 행을 쓰는 재구독(upsert)은 updated_at이 안 바뀌어도 start_at이 결제 시각이면 반영된 것이다."""
    assert run(lambda ev: row("active", ev - timedelta(seconds=1), ev + timedelta(days=30))) == []


def test_payment_not_reflected_in_old_row_is_flagged(run):
    """결제는 성공했는데 구독 행이 결제 전 값 그대로(upsert 실패) — 진짜 불일치. 해지 상태여도 잡아야 한다."""
    assert len(run(lambda ev: row("cancelled", ev - timedelta(days=30), ev - timedelta(days=1)))) == 1
    assert len(run(lambda ev: row("active", ev - timedelta(days=3), ev + timedelta(days=5)))) == 1


def test_missing_subscription_row_is_flagged(run):
    assert len(run(lambda ev: [])) == 1


def test_expired_or_suspended_status_right_after_payment_is_flagged(run):
    assert len(run(lambda ev: row("expired", ev, ev + timedelta(days=30)))) == 1


def test_renewal_reflected_by_extended_end_at_is_not_flagged_and_unextended_is_flagged(run):
    """갱신은 start_at이 바뀌지 않는다 — end_at이 결제일보다 뒤로 연장됐는지로 본다(갱신 잡이 today+30으로 쓴다)."""
    assert run(lambda ev: row("active", ev - timedelta(days=30), ev + timedelta(days=30)), "renewal") == []
    assert len(run(lambda ev: row("active", ev - timedelta(days=30), ev - timedelta(days=0, hours=1)), "renewal")) == 1
