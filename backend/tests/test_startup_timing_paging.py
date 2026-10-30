"""창업 타이밍 지수 — 서버 1,000행 상한에서도 추세가 정확해야 한다 (2026-10-31).

이전 구현은 최근 30일 점수를 날짜 내림차순으로 읽고(상한 1,000행) 이전 구간은 정렬 없이 읽어, 사업장 30곳 x 30일만 돼도
서버가 오래된 쪽을 임의로 잘라 추세(score_trend)가 틀어졌다.
"""
import asyncio
from datetime import datetime, timedelta, timezone

import db.supabase_client as sc
from routers import startup


class _Res:
    def __init__(self, data):
        self.data = data


class _Query:
    """eq / in_ / gte / lt / order / range 만 지원하는 가짜 쿼리. 서버처럼 한 번에 1,000행까지만 돌려준다."""

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

    def gte(self, col, val):
        self.filters.append(lambda r: r.get(col) >= val)
        return self

    def lt(self, col, val):
        self.filters.append(lambda r: r.get(col) < val)
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


def test_trend_is_exact_even_when_score_rows_exceed_the_server_row_cap(monkeypatch):
    region = "테스트동-타이밍"
    today = datetime.now(timezone.utc).date()      # 코드가 쓰는 기준(UTC)과 같게 — 로컬 날짜를 쓰면 새벽 시간대에 하루 어긋난다
    biz = [{"id": f"b{i}", "region": region, "category": "cafe", "is_active": True} for i in range(40)]
    hist = []
    for i in range(40):
        for d in range(1, 30):                     # 최근 구간(29일 전~어제): 앞쪽 절반은 높고 오래된 절반은 낮다
            hist.append({"id": f"r{i}-{d}", "business_id": f"b{i}", "total_score": 60.0 if d <= 15 else 40.0,
                         "score_date": (today - timedelta(days=d)).isoformat()})
        for d in range(31, 60):                    # 이전 구간
            hist.append({"id": f"o{i}-{d}", "business_id": f"b{i}", "total_score": 45.0,
                         "score_date": (today - timedelta(days=d)).isoformat()})
    assert sum(1 for h in hist if h["score_date"] >= (today - timedelta(days=30)).isoformat()) > 1000   # 서버 상한을 넘는 입력

    async def fake_execute(q):
        return _Res(q.run())

    monkeypatch.setattr(sc, "execute", fake_execute)
    monkeypatch.setattr(sc, "get_client", lambda: _DB({"businesses": biz, "score_history": hist}))
    result = asyncio.run(startup.get_timing_index("cafe", region))

    full_recent_avg = (15 * 60.0 + 14 * 40.0) / 29        # 모든 행을 읽었을 때의 최근 평균
    assert result["score_trend"] == round(full_recent_avg - 45.0, 1)    # 상한에서 잘렸다면 오래된 낮은 점수가 빠져 더 높게 나온다
