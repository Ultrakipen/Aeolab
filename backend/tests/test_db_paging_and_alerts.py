"""서버 최대 행 수(1,000) 우회 — 페이징 도우미와 일일 호출량 경보 테스트 (2026-10-30).

실측: 서버는 `.limit(20000)`을 요청해도 1,000행만 돌려준다. 행을 읽어 세던 `ai_daily_usage_alert_job`은 임계값 3,000에 도달할 수 없었다.
"""
import asyncio
import inspect

import pytest

from services import db_paging as dp

PAGE = dp.PAGE


class _Res:
    def __init__(self, data=None, count=None):
        self.data, self.count = data, count


class _Q:
    """range()만 지원하는 가짜 쿼리 — 서버처럼 한 번에 PAGE행까지만 돌려준다."""

    def __init__(self, total, log):
        self.total, self.log, self.rng = total, log, None

    def range(self, a, b):
        self.rng = (a, b)
        return self


@pytest.fixture
def paged(monkeypatch):
    import db.supabase_client as sc
    log = []

    async def fake_execute(q):
        a, b = q.rng
        log.append((a, b))
        n = max(0, min(q.total, b + 1) - a)
        return _Res([{"i": a + k} for k in range(min(n, PAGE))])

    monkeypatch.setattr(sc, "execute", fake_execute)
    return log


def test_reads_every_row_across_pages(paged):
    rows, truncated = asyncio.run(dp.fetch_all_rows(lambda: _Q(2500, paged)))
    assert len(rows) == 2500 and truncated is False
    assert [r["i"] for r in rows] == list(range(2500))          # 겹치거나 빠지지 않는다
    assert paged == [(0, 999), (1000, 1999), (2000, 2999)]


def test_exact_multiple_of_page_terminates(paged):
    rows, truncated = asyncio.run(dp.fetch_all_rows(lambda: _Q(2000, paged)))
    assert len(rows) == 2000 and truncated is False             # 마지막 빈 페이지에서 끝난다


def test_empty_and_small_results(paged):
    assert asyncio.run(dp.fetch_all_rows(lambda: _Q(0, paged))) == ([], False)
    rows, _ = asyncio.run(dp.fetch_all_rows(lambda: _Q(7, paged)))
    assert len(rows) == 7


def test_max_rows_cap_is_reported_as_truncated(paged):
    rows, truncated = asyncio.run(dp.fetch_all_rows(lambda: _Q(10_000, paged), max_rows=2500))
    assert len(rows) == 2500 and truncated is True               # 잘렸음을 숨기지 않는다


# ── 일일 호출량 경보 ──
class _CQ:
    def __init__(self, kind, store):
        self.kind, self.store = kind, store
        self.provider = None

    def __getattr__(self, name):
        def chain(*a, **k):
            if name == "eq":
                self.provider = a[1]
            if name == "like":
                self.kind = "failed"
            return self
        return chain


class _SB:
    def __init__(self, counts):
        self.counts = counts      # {provider: (total, failed)}

    def table(self, name):
        return _CQ("total", self.counts)


def _run_alert(monkeypatch, counts, threshold_gemini=3000):
    from scheduler import jobs
    sent = []

    async def fake_db(q):
        total, failed = counts.get(q.provider, (0, 0))
        return _Res(count=(failed if q.kind == "failed" else total))

    async def fake_alert(subject, body):
        sent.append(subject)

    import db.supabase_client as sc
    import services.email_sender as es
    monkeypatch.setattr(jobs, "_db", fake_db)
    monkeypatch.setattr(sc, "get_client", lambda: _SB(counts))
    monkeypatch.setattr(es, "send_operator_alert", fake_alert)
    monkeypatch.setitem(jobs._AI_DAILY_WARN_THRESHOLDS, "gemini", threshold_gemini)
    asyncio.run(jobs.ai_daily_usage_alert_job())
    return sent


def test_daily_alert_fires_above_the_server_row_cap(monkeypatch):
    """예전 구현은 행을 최대 1,000개만 읽어 임계값 3,000에 도달할 수 없었다 — 서버 집계라면 11,500회가 그대로 잡힌다."""
    sent = _run_alert(monkeypatch, {"gemini": (11_500, 900)})
    assert any("gemini" in s for s in sent)


def test_daily_alert_silent_below_threshold(monkeypatch):
    assert _run_alert(monkeypatch, {"gemini": (2_999, 0), "chatgpt": (10, 0), "claude": (3, 0)}) == []


def test_daily_alert_reads_counts_not_rows():
    from scheduler import jobs
    src = inspect.getsource(jobs.ai_daily_usage_alert_job)
    assert 'count="exact"' in src and ".limit(20000)" not in src


def test_other_ai_usage_reads_use_paging():
    from routers import admin
    from services import ai_capacity
    a = inspect.getsource(admin.get_ai_cost)
    assert "fetch_all_rows" in a or "_fetch_all(" in a
    assert ".limit(10000)" not in a and ".limit(20000)" not in a
    assert "fetch_all_rows" in inspect.getsource(ai_capacity.gemini_usage_snapshot)
