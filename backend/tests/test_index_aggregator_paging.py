"""분기 지수 집계가 서버 최대 행 수(1,000)에서 조용히 잘리지 않는지, in_() 목록을 나눠 보내는지 검증 (2026-10-30)."""
import asyncio
import inspect

import pytest

from services import index_aggregator as ia


class _Res:
    def __init__(self, data):
        self.data = data


class _Q:
    def __init__(self, ids, rows_per_id, log):
        self.ids, self.rpi, self.log, self.rng = ids, rows_per_id, log, None

    def range(self, a, b):
        self.rng = (a, b)
        return self


@pytest.fixture
def fake(monkeypatch):
    import db.supabase_client as sc
    log = []

    async def fake_execute(q):
        a, b = q.rng
        log.append((len(q.ids), a))
        total = len(q.ids) * q.rpi
        return _Res([{"business_id": q.ids[(a + k) // q.rpi], "k": a + k} for k in range(max(0, min(total, b + 1) - a))])

    monkeypatch.setattr(sc, "execute", fake_execute)
    return log


def test_reads_all_rows_and_splits_in_list(fake):
    ids = [f"b{i}" for i in range(250)]            # 250곳 × 30행 = 7,500행, 100개씩 3조각
    rows = asyncio.run(ia._fetch_chunked(lambda part: _Q(part, 30, fake), ids))
    assert len(rows) == 7500
    assert max(n for n, _ in fake) == ia._IN_CHUNK  # 한 요청의 in_ 목록은 100개 이하


def test_aggregator_uses_paged_helper_for_history_and_scan_rows():
    src = inspect.getsource(ia)
    assert src.count("_fetch_chunked(") >= 3        # 정의 1 + 사용 2 (score_history, scan_results)
