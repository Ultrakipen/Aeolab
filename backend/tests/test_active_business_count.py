"""active_business_count — 용량 기준이 실제 스캔 대상과 같은 자격 기준을 쓰고, 서버 1,000행 상한에도 정확한지 (2026-10-31)."""
import asyncio
from datetime import datetime, timedelta, timezone

import pytest

import db.supabase_client as sc
from services import naver_capacity as nc

FUTURE = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()
PAST = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()


class _Res:
    def __init__(self, data):
        self.data = data


class _Query:
    """서버처럼 한 번에 1,000행까지만 돌려주는 가짜 쿼리."""

    def __init__(self, rows):
        self.rows, self.filters, self.orders, self.rng = rows, [], [], None

    def select(self, *_, **__):
        return self

    def eq(self, col, val):
        self.filters.append(lambda r: r.get(col) == val)
        return self

    def in_(self, col, vals):
        vals = set(vals)
        self.filters.append(lambda r: r.get(col) in vals)
        return self

    def order(self, col, desc=False):
        self.orders.append((col, desc))
        return self

    def range(self, a, b):
        self.rng = (a, b)
        return self

    def run(self):
        out = [r for r in self.rows if all(f(r) for f in self.filters)]
        for col, desc in reversed(self.orders):
            out.sort(key=lambda r: r.get(col), reverse=desc)
        a, b = self.rng if self.rng else (0, 999)
        return out[a:min(b + 1, a + 1000)]


class _DB:
    def __init__(self, tables):
        self.tables = tables

    def table(self, name):
        return _Query(self.tables[name])


@pytest.fixture(autouse=True)
def _patch(monkeypatch):
    async def fake_execute(q):
        return _Res(q.run())

    monkeypatch.setattr(sc, "execute", fake_execute)
    monkeypatch.setenv("ADMIN_USER_IDS", "u_admin")


def _count(subs, biz):
    return asyncio.run(nc.active_business_count(_DB({"subscriptions": subs, "businesses": biz})))


def test_counts_everyone_the_nightly_scan_serves_but_not_expired_or_admin():
    subs = [
        {"id": "1", "user_id": "u_active", "status": "active", "end_at": None},
        {"id": "2", "user_id": "u_grace", "status": "grace_period", "end_at": None},
        {"id": "3", "user_id": "u_cancel_future", "status": "cancelled", "end_at": FUTURE},
        {"id": "4", "user_id": "u_cancel_expired", "status": "cancelled", "end_at": PAST},
        {"id": "5", "user_id": "u_admin", "status": "active", "end_at": None},
    ]
    biz = [{"id": f"b{i}", "user_id": u, "is_active": True} for i, u in enumerate(
        ["u_active", "u_grace", "u_cancel_future", "u_cancel_expired", "u_admin", "u_nosub"])]
    biz.append({"id": "off", "user_id": "u_active", "is_active": False})
    assert _count(subs, biz) == 3        # 이전 구현은 1 (active만) — 유예·해지 후 만료 전 사용자가 빠졌다


def test_more_than_the_server_row_cap_is_counted():
    subs = [{"id": f"s{i}", "user_id": f"u{i}", "status": "active", "end_at": None} for i in range(1300)]
    biz = [{"id": f"b{i}", "user_id": f"u{i}", "is_active": True} for i in range(1300)]
    assert _count(subs, biz) == 1300     # 구독 1,000행에서 잘리면 1,000 이하로 나왔다


def test_no_entitled_subscribers_is_zero():
    assert _count([{"id": "1", "user_id": "u", "status": "cancelled", "end_at": PAST}], [{"id": "b", "user_id": "u", "is_active": True}]) == 0
