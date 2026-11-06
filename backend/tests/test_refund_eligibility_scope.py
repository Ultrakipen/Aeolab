"""7일 청약철회 자동환불 자격 — '이용'은 구독 시작 이후의 이용만 센다 (2026-11-07).

이전에는 시각 필터가 없어 결제 전의 체험 결과 가져오기·무료 첫 측정 기록 때문에 7일 이내라도 환불이 막혔다.
쿼리에 걸린 필터(시작 시각, 측정 결과가 있는 스캔)를 직접 검증한다.
"""
import asyncio
from datetime import datetime, timedelta, timezone

from routers import settings


class _Q:
    def __init__(self, table, log):
        self.table_name, self.log, self.calls = table, log, []

    def __getattr__(self, name):
        def rec(*a, **k):
            self.calls.append((name, a, k))
            return self
        return rec


class _Sb:
    def __init__(self, log):
        self.log = log

    def table(self, name):
        q = _Q(name, self.log)
        self.log.append(q)
        return q


class _Res:
    def __init__(self, data=None, count=0):
        self.data, self.count = data, count


def _run(monkeypatch, *, start_days_ago=1, biz=("b1",), scans=0, guides=0, key="pay_1"):
    log = []

    async def fake_execute(q):
        if q.table_name == "businesses":
            return _Res(data=[{"id": b} for b in biz])
        if q.table_name == "scan_results":
            return _Res(count=scans)
        if q.table_name == "guides":
            return _Res(count=guides)
        raise AssertionError(q.table_name)

    monkeypatch.setattr(settings, "execute", fake_execute)
    start = datetime.now(timezone.utc) - timedelta(days=start_days_ago)
    ok = asyncio.run(settings._check_refund_eligibility("u1", _Sb(log), start.isoformat(), key))
    return ok, {q.table_name: q for q in log}, start


def _calls(q, name):
    return [c for c in q.calls if c[0] == name]


def test_no_usage_after_start_is_eligible(monkeypatch):
    ok, _, _ = _run(monkeypatch)
    assert ok is True


def test_scan_after_start_blocks_refund(monkeypatch):
    assert _run(monkeypatch, scans=1)[0] is False


def test_guide_after_start_blocks_refund(monkeypatch):
    assert _run(monkeypatch, guides=1)[0] is False


def test_scan_query_is_limited_to_after_subscription_start(monkeypatch):
    _, qs, start = _run(monkeypatch)
    gte = _calls(qs["scan_results"], "gte")
    assert gte and gte[0][1][0] == "scanned_at"
    since = gte[0][1][1]
    assert since.endswith("Z") and "+" not in since                      # URL 인코딩 문제가 없는 형식
    assert abs(datetime.strptime(since, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc) - start) < timedelta(seconds=2)


def test_scan_query_ignores_imported_trial_rows_without_any_measurement(monkeypatch):
    _, qs, _ = _run(monkeypatch)
    or_ = _calls(qs["scan_results"], "or_")
    assert or_, "측정 결과가 하나도 없는 가져온 체험 행을 제외하는 필터가 있어야 한다"
    cond = or_[0][1][0]
    assert all(k in cond for k in ("chatgpt_result.not.is.null", "gemini_result.not.is.null", "naver_result.not.is.null"))


def test_guide_query_is_limited_to_after_subscription_start(monkeypatch):
    _, qs, _ = _run(monkeypatch)
    gte = _calls(qs["guides"], "gte")
    assert gte and gte[0][1][0] == "generated_at"


def test_after_seven_days_or_missing_payment_key_is_not_eligible(monkeypatch):
    assert _run(monkeypatch, start_days_ago=8)[0] is False
    assert _run(monkeypatch, key=None)[0] is False


def test_no_business_is_eligible(monkeypatch):
    assert _run(monkeypatch, biz=())[0] is True


def test_usage_lookup_failure_does_not_raise_and_denies_refund(monkeypatch):
    """이 함수는 해지 경로에서 예외 처리 없이 호출된다 — 조회 실패가 해지 500이 되면 안 되고, 확인 못 하면 환불 불가로 둔다."""
    async def boom(q):
        if q.table_name == "businesses":
            return _Res(data=[{"id": "b1"}])
        raise RuntimeError("postgrest 400")

    monkeypatch.setattr(settings, "execute", boom)
    start = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    ok = asyncio.run(settings._check_refund_eligibility("u1", _Sb([]), start, "pay_1"))
    assert ok is False
