"""_calc_rank_in_category — 서버 1,000행 상한과 '덜 자주 스캔하는 사업장 누락' 회귀 테스트 (2026-10-31).

이전 구현은 `.limit(사업장 수 × 3)`으로 score_history를 날짜 내림차순으로 읽었다.
  ① 서버는 `.limit()`과 무관하게 1,000행까지만 돌려줘 사업장이 334곳을 넘으면 조용히 잘렸고,
  ② 매일 스캔하는 사업장이 앞쪽 행을 채우면 주 2회 스캔하는 사업장은 모집단에서 통째로 빠졌다.
"""
import asyncio
from datetime import date, timedelta

import pytest

import db.supabase_client as sc
from routers.scan import _calc_rank_in_category


class _Res:
    def __init__(self, data):
        self.data = data


class _Query:
    """eq / in_ / gte / order / range / select 만 지원하는 가짜 쿼리. 서버처럼 한 번에 1,000행까지만 돌려준다."""

    def __init__(self, rows):
        self.rows = rows
        self.filters = []
        self.orders = []
        self.rng = None

    def select(self, *_):
        return self

    def eq(self, col, val):
        self.filters.append(lambda r: r.get(col) == val)
        return self

    def in_(self, col, vals):
        vals = set(vals)
        self.filters.append(lambda r: r.get(col) in vals)
        return self

    def gte(self, col, val):
        self.filters.append(lambda r: r.get(col) >= val)
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
def _patch_execute(monkeypatch):
    async def fake_execute(q):
        return _Res(q.run())

    monkeypatch.setattr(sc, "execute", fake_execute)
    import routers.scan as scan_mod
    monkeypatch.setattr(scan_mod, "execute", fake_execute, raising=False)


def _scores(biz_id, score, days_ago, n_rows=1):
    today = date.today()
    return [
        {"id": f"{biz_id}-{d}", "business_id": biz_id, "total_score": score, "score_date": (today - timedelta(days=days_ago + d)).isoformat()}
        for d in range(n_rows)
    ]


def _run(biz, scores, my_id, my_score):
    return asyncio.run(_calc_rank_in_category(_DB({"businesses": biz, "score_history": scores}), "restaurant", my_id, my_score))


def test_less_frequently_scanned_business_is_still_counted():
    # 매일 스캔하는 사업장 100곳이 최근 5일 행을 채워도, 4일 전에 한 번 스캔한 사업장 하나가 모집단에서 빠지면 안 된다
    biz = [{"id": f"d{i}", "category": "restaurant", "is_active": True} for i in range(100)] + [{"id": "weekly", "category": "restaurant", "is_active": True}]
    scores = []
    for i in range(100):
        scores += _scores(f"d{i}", 10.0, 0, n_rows=5)
    scores += _scores("weekly", 90.0, 4)                 # 가장 높은 점수지만 마지막 스캔이 4일 전
    rank, total = _run(biz, scores, "d0", 10.0)
    assert total == 101                                   # 이전 구현은 100 (weekly 누락)
    assert rank == 2                                      # weekly(90점)가 위에 있다


def test_more_than_the_server_row_cap_is_read():
    # 사업장 1,200곳 — 이전 구현(.limit(len*3)=3600)은 서버 상한 1,000행에서 잘려 순위·모집단이 틀렸다
    biz = [{"id": f"b{i}", "category": "restaurant", "is_active": True} for i in range(1200)]
    scores = []
    for i in range(1200):
        scores += _scores(f"b{i}", float(i % 100), 0)
    rank, total = _run(biz, scores, "b0", 0.0)
    assert total == 1200
    assert rank == 1 + sum(1 for i in range(1, 1200) if (i % 100) > 0)


def test_stale_scores_outside_the_window_are_excluded_and_inactive_ignored():
    biz = [
        {"id": "me", "category": "restaurant", "is_active": True},
        {"id": "fresh", "category": "restaurant", "is_active": True},
        {"id": "stale", "category": "restaurant", "is_active": True},
        {"id": "off", "category": "restaurant", "is_active": False},
    ]
    scores = _scores("fresh", 80.0, 1) + _scores("stale", 95.0, 60) + _scores("off", 99.0, 0)
    rank, total = _run(biz, scores, "me", 50.0)
    assert (rank, total) == (2, 2)                        # me + fresh. 60일 전 점수·비활성 사업장은 제외


def test_no_peers_returns_first_of_one():
    assert _run([], [], "me", 50.0) == (1, 1)
