"""경쟁사 정기 크롤은 서비스 기간이 끝난 계정을 건너뛴다 (2026-10-29).

실측: 이날 경쟁사 크롤 48페이지(하루 네이버 사용량의 81%)가 전부 만료된 해지 계정(5곳)과 관리자 계정(3곳)의 것이었다.
"""
import asyncio
from datetime import datetime, timedelta, timezone

import pytest

from services import scan_scheduling as ss

NOW = datetime.now(timezone.utc)
FUTURE = (NOW + timedelta(days=10)).isoformat()
PAST = (NOW - timedelta(days=2)).isoformat()


def test_entitlement_matches_get_user_plan_rules():
    subs = [
        {"user_id": "active", "status": "active", "end_at": None},
        {"user_id": "grace", "status": "grace_period", "end_at": PAST},
        {"user_id": "cancel_future", "status": "cancelled", "end_at": FUTURE},
        {"user_id": "cancel_past", "status": "cancelled", "end_at": PAST},
        {"user_id": "cancel_none", "status": "cancelled", "end_at": None},       # 만료일을 모르면 보수적으로 제외(get_user_plan과 같음)
        {"user_id": "expired", "status": "expired", "end_at": FUTURE},
        {"user_id": "", "status": "active"},
    ]
    got = ss.entitled_user_ids(subs, admin_ids=["admin"])
    assert got == {"active", "grace", "cancel_future", "admin"}


def test_no_subscription_rows_means_nobody_but_admins():
    assert ss.entitled_user_ids([], admin_ids=[]) == set()
    assert ss.entitled_user_ids(None, admin_ids=["a"]) == {"a"}


# ── 잡 동작 ───────────────────────────────────────────────────────────────
class _Res:
    def __init__(self, data): self.data = data


class _Q:
    def __init__(self, rows): self.rows = rows
    def select(self, *_): return self
    def eq(self, *_): return self
    def in_(self, *_): return self
    def is_(self, *_): return self
    @property
    def not_(self): return self


class _DB:
    def __init__(self, tables): self.tables = tables
    def table(self, name): return _Q(self.tables[name])


def _run_job(monkeypatch, *, comps, subs, businesses, admin_ids="", fail_filter=False):
    import scheduler.jobs as jobs
    import db.supabase_client as dbc
    import services.competitor_place_crawler as cpc

    synced = []

    async def fake_sync_all(biz_id, supabase):
        synced.append(biz_id)
        return []

    async def fake_db(q):
        if fail_filter and q.rows is subs:
            raise RuntimeError("subscriptions 조회 실패")
        return _Res(q.rows)

    monkeypatch.setattr(dbc, "get_client", lambda: _DB({"competitors": comps, "subscriptions": subs, "businesses": businesses}))
    monkeypatch.setattr(jobs, "_db", fake_db)
    monkeypatch.setattr(cpc, "sync_all_competitor_places", fake_sync_all)
    monkeypatch.setenv("ADMIN_USER_IDS", admin_ids)
    monkeypatch.setenv("NAVER_COMPETITOR_STALE_FIRST", "false")     # 대상 선정만 보면 되므로 요일·예산 로직은 끈다
    monkeypatch.setenv("NAVER_SCAN_SLOT_SPREAD", "false")
    monkeypatch.setattr(ss, "competitor_job_due", lambda *a, **k: True)     # 요일 판정은 이 테스트의 관심사가 아니다(고정 요일 경로는 화요일만 처리)
    asyncio.run(jobs.competitor_place_sync_job())
    return synced


COMPS = [
    {"business_id": "b_paid", "naver_place_id": "1", "naver_place_last_synced_at": None},
    {"business_id": "b_lapsed", "naver_place_id": "2", "naver_place_last_synced_at": None},
    {"business_id": "b_cancel_future", "naver_place_id": "3", "naver_place_last_synced_at": None},
    {"business_id": "b_admin", "naver_place_id": "4", "naver_place_last_synced_at": None},
    {"business_id": "b_nosub", "naver_place_id": "5", "naver_place_last_synced_at": None},
]
BIZ = [{"id": "b_paid", "user_id": "u_paid"}, {"id": "b_lapsed", "user_id": "u_lapsed"},
       {"id": "b_cancel_future", "user_id": "u_cf"}, {"id": "b_admin", "user_id": "u_admin"}, {"id": "b_nosub", "user_id": "u_none"}]
SUBS = [{"user_id": "u_paid", "status": "active", "end_at": None},
        {"user_id": "u_lapsed", "status": "cancelled", "end_at": PAST},
        {"user_id": "u_cf", "status": "cancelled", "end_at": FUTURE}]


def test_job_skips_lapsed_and_unsubscribed_but_keeps_paid_and_admin(monkeypatch):
    synced = _run_job(monkeypatch, comps=COMPS, subs=SUBS, businesses=BIZ, admin_ids="u_admin")
    assert sorted(synced) == ["b_admin", "b_cancel_future", "b_paid"]
    assert "b_lapsed" not in synced and "b_nosub" not in synced


def test_filter_failure_falls_back_to_syncing_everyone(monkeypatch):
    """필터를 못 만들어도 정기 갱신이 통째로 멈추지는 않는다."""
    synced = _run_job(monkeypatch, comps=COMPS, subs=SUBS, businesses=BIZ, fail_filter=True)
    assert sorted(synced) == sorted({c["business_id"] for c in COMPS})
