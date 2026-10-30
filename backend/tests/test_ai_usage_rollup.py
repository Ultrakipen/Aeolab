"""ai_usage_log 일별 롤업·보관 테스트 — 2026-10-30.

규칙: 롤업 테이블이 없으면 아무것도 지우지 않는다 / 롤업 호출 수 == 원본 건수일 때만 삭제 / 날짜 경계는 KST / 한 번에 처리하는 날짜 수 상한.
"""
import asyncio
import inspect
from datetime import date, datetime, timedelta, timezone

import pytest

from services import ai_usage_rollup as ur

KST = ur.KST


def _run(coro):
    return asyncio.run(coro)


def _row(day: date, hour=12, provider="gemini", model="m", purpose="scan_recommend", t_in=100, t_out=50, cost=1.0):
    when = datetime(day.year, day.month, day.day, hour, 0, tzinfo=KST).astimezone(timezone.utc)
    return {"created_at": when.isoformat(), "provider": provider, "model": model, "purpose": purpose,
            "tokens_in": t_in, "tokens_out": t_out, "estimated_cost_krw": cost}


# ── 순수 함수 ──
def test_kst_day_boundary():
    # UTC 2026-10-29 15:30은 KST 10-30 00:30 — 날짜가 바뀐다
    assert ur.kst_day_of("2026-10-29T15:30:00+00:00") == date(2026, 10, 30)
    assert ur.kst_day_of("2026-10-29T14:59:59Z") == date(2026, 10, 29)
    s, e = ur.day_bounds_utc(date(2026, 10, 30))
    assert s == "2026-10-29T15:00:00+00:00" and e == "2026-10-30T15:00:00+00:00"


def test_base_purpose_splits_failed_suffix():
    assert ur.base_purpose("scan_check") == ("scan_check", False)
    assert ur.base_purpose("scan_check:FAILED:TimeoutError") == ("scan_check", True)
    assert ur.base_purpose("") == ("unknown", False)


def test_aggregate_groups_and_counts_failures_separately():
    d = date(2026, 10, 30)
    rows = [_row(d), _row(d), _row(d, purpose="scan_recommend:FAILED:Timeout", t_in=0, t_out=0, cost=0),
            _row(d, provider="chatgpt", model="g", purpose="scan_check"), _row(d + timedelta(days=1))]
    g = ur.aggregate(rows)
    k = (d, "gemini", "m", "scan_recommend")
    assert g[k]["calls_ok"] == 2 and g[k]["calls_failed"] == 1 and g[k]["tokens_in"] == 200 and g[k]["cost_krw"] == 2.0
    assert (d, "chatgpt", "g", "scan_check") in g and (d + timedelta(days=1), "gemini", "m", "scan_recommend") in g


def test_aggregate_ignores_unparseable_rows():
    assert ur.aggregate([{"created_at": "not a date"}, {}]) == {}


def test_retention_default_and_disable(monkeypatch):
    monkeypatch.delenv("AI_USAGE_LOG_RETENTION_DAYS", raising=False)
    assert ur.retention_days() == 35
    monkeypatch.setenv("AI_USAGE_LOG_RETENTION_DAYS", "0")
    assert ur.retention_days() == 0
    monkeypatch.setenv("AI_USAGE_LOG_RETENTION_DAYS", "abc")
    assert ur.retention_days() == 35


# ── 가짜 DB ──
class _Res:
    def __init__(self, data=None, count=None):
        self.data, self.count = data, count


class _FakeDB:
    """ai_usage_log(원본)와 ai_usage_daily(롤업)를 메모리로 흉내 낸다."""

    def __init__(self, raw_rows, daily_exists=True):
        self.raw = list(raw_rows)
        self.daily = {}            # (day, provider, model, purpose) -> row
        self.daily_exists = daily_exists
        self.deleted_windows = []
        self.upserts = 0

    def table(self, name):
        return _Q(self, name)


class _Q:
    def __init__(self, db, name):
        self.db, self.name = db, name
        self.op = "select"
        self.f = {}
        self.cols = ""
        self.want_count = False
        self.rng = None
        self.payload = None

    def select(self, cols="*", count=None):
        self.cols, self.want_count = cols, bool(count)
        return self

    def delete(self):
        self.op = "delete"
        return self

    def upsert(self, payload, on_conflict=None):
        self.op, self.payload = "upsert", payload
        return self

    def gte(self, col, val):
        self.f[col + ">="] = val
        return self

    def lt(self, col, val):
        self.f[col + "<"] = val
        return self

    def eq(self, col, val):
        self.f[col + "="] = val
        return self

    def order(self, *a, **k):
        return self

    def limit(self, n):
        self.limit_n = n
        return self

    def range(self, a, b):
        self.rng = (a, b)
        return self


async def _fake_execute(q):
    db = q.db
    if q.name == "ai_usage_daily":
        if not db.daily_exists:
            raise RuntimeError('relation "ai_usage_daily" does not exist (42P01)')
        if q.op == "upsert":
            db.upserts += 1
            for r in q.payload:
                db.daily[(r["day"], r["provider"], r["model"], r["purpose"])] = r
            return _Res()
        day = q.f.get("day=")
        return _Res([r for r in db.daily.values() if day is None or r["day"] == day])
    # ai_usage_log
    lo, hi = q.f.get("created_at>="), q.f.get("created_at<")
    sel = [r for r in db.raw if (lo is None or r["created_at"] >= lo) and (hi is None or r["created_at"] < hi)]
    if q.op == "delete":
        db.deleted_windows.append((lo, hi))
        db.raw = [r for r in db.raw if r not in sel]
        return _Res()
    if q.want_count:
        return _Res(count=len(sel))
    if q.rng:
        return _Res(sel[q.rng[0]:q.rng[1] + 1])
    return _Res(sorted(sel, key=lambda r: r["created_at"])[: getattr(q, "limit_n", 10 ** 9)])


@pytest.fixture(autouse=True)
def _patch(monkeypatch):
    import db.supabase_client as sc
    monkeypatch.setattr(sc, "execute", _fake_execute)
    monkeypatch.setattr(ur, "PAGE", 3)     # 페이징 경로를 작은 데이터로 검증


TODAY = date(2026, 10, 30)


def test_rollup_day_pages_through_all_rows_and_is_idempotent():
    d = TODAY - timedelta(days=1)
    db = _FakeDB([_row(d, hour=h % 24) for h in range(8)])    # PAGE=3 → 3페이지
    assert _run(ur.rollup_day(db, d)) == 8
    first = dict(db.daily)
    _run(ur.rollup_day(db, d))                                  # 다시 돌려도 같은 값(덮어쓰기)
    assert db.daily == first and sum(r["calls_ok"] for r in db.daily.values()) == 8


def test_no_table_means_nothing_is_deleted():
    old = TODAY - timedelta(days=60)
    db = _FakeDB([_row(old), _row(TODAY - timedelta(days=1))], daily_exists=False)
    out = _run(ur.run_rollup_and_purge(db, today=TODAY, retention=35))
    assert out["unavailable"] is True and out["purged_days"] == 0
    assert len(db.raw) == 2 and db.deleted_windows == []        # 롤업 테이블이 없으면 원본을 지키지 않을 이유가 없다 — 지우지 않는다


def test_old_days_are_rolled_up_then_deleted_and_recent_days_are_kept():
    old, recent = TODAY - timedelta(days=60), TODAY - timedelta(days=3)
    db = _FakeDB([_row(old), _row(old, hour=3), _row(recent), _row(TODAY - timedelta(days=1))])
    out = _run(ur.run_rollup_and_purge(db, today=TODAY, retention=35))
    assert out["purged_days"] == 1 and out["unavailable"] is False
    assert all(ur.kst_day_of(r["created_at"]) != old for r in db.raw) and len(db.raw) == 2   # 오래된 날만 삭제
    # 삭제 전에 롤업이 저장돼 있다
    assert sum(r["calls_ok"] for k, r in db.daily.items() if r["day"] == old.isoformat()) == 2
    assert len(db.deleted_windows) == 24                          # 한 시간 창씩 지운다


def test_mismatch_between_rollup_and_raw_blocks_deletion(monkeypatch):
    old = TODAY - timedelta(days=60)
    db = _FakeDB([_row(old), _row(old, hour=5)])

    async def broken_rollup(supabase, day):
        return 0                                                  # 롤업이 아무것도 저장하지 못하는 상황

    monkeypatch.setattr(ur, "rollup_day", broken_rollup)
    out = _run(ur.run_rollup_and_purge(db, today=TODAY, retention=35))
    assert out["purged_days"] == 0 and out["skipped_mismatch"] == 1 and len(db.raw) == 2


def test_retention_zero_rolls_up_but_never_deletes():
    old = TODAY - timedelta(days=60)
    db = _FakeDB([_row(old), _row(TODAY - timedelta(days=1))])
    out = _run(ur.run_rollup_and_purge(db, today=TODAY, retention=0))
    assert out["purged_days"] == 0 and len(db.raw) == 2 and out["rolled_days"] >= 1


def test_purge_is_capped_per_run():
    days = [TODAY - timedelta(days=60 + i) for i in range(10)]
    db = _FakeDB([_row(d) for d in days])
    out = _run(ur.run_rollup_and_purge(db, today=TODAY, retention=35))
    assert out["purged_days"] == ur.MAX_PURGE_DAYS_PER_RUN and len(db.raw) == 10 - ur.MAX_PURGE_DAYS_PER_RUN


def test_empty_table_is_a_noop():
    out = _run(ur.run_rollup_and_purge(_FakeDB([]), today=TODAY, retention=35))
    assert out == {"rolled_days": 0, "purged_days": 0, "skipped_mismatch": 0, "unavailable": False}


# ── 읽기: 비용 집계는 이중 집계하지 않는다 ──
def test_combine_uses_rollup_for_rolled_days_and_raw_for_the_rest():
    d1, d2 = date(2026, 10, 28), date(2026, 10, 29)
    rollup = [{"day": "2026-10-28", "provider": "gemini", "model": "m", "purpose": "scan_recommend", "calls_ok": 100, "calls_failed": 5,
               "tokens_in": 10_000, "tokens_out": 5_000, "cost_krw": 12.5}]
    raw = [_row(d1), _row(d1), _row(d2), _row(d2, purpose="scan_recommend:FAILED:Timeout", cost=0, t_in=0, t_out=0)]   # d1은 이미 롤업됨
    out = ur.combine_cost_sources(rollup, raw, {d1})
    g = out[0]
    assert g["calls"] == 100 + 5 + 2 and g["failed_calls"] == 5 + 1 and round(g["cost_krw"], 1) == 13.5   # d1의 원본 2건은 세지 않는다


def test_combine_handles_empty_inputs():
    assert ur.combine_cost_sources([], [], set()) == []


# ── 연결 구조 ──
def test_job_registered_and_admin_cost_uses_rollup():
    from scheduler import jobs
    from routers import admin
    src = inspect.getsource(jobs)
    assert 'ai_usage_rollup_job, "cron", hour=5, minute=20' in src
    admin_src = inspect.getsource(admin.get_ai_cost)
    assert "ai_usage_daily" in admin_src and "combine_cost_sources" in admin_src and "truncated" in admin_src


def test_schema_documents_the_table_with_rls():
    import pathlib
    sql = (pathlib.Path(__file__).resolve().parents[2] / "scripts" / "supabase_schema.sql").read_text(encoding="utf-8")
    assert "CREATE TABLE IF NOT EXISTS ai_usage_daily" in sql and "ALTER TABLE ai_usage_daily ENABLE ROW LEVEL SECURITY" in sql
