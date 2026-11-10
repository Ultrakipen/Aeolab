"""갱신 이중청구 가드 창이 잡 주기(매일 1회)보다 길어야 한다 (2026-11-10).

청구 성공 직후 구독 DB 갱신이 실패하면 다음 날 같은 구독이 다시 결제 대상으로 뽑힌다. 그때 어제의 성공 이벤트가
가드 창 안에 있어야 재청구를 막는다. 잡이 01:00에 도는데 창이 20시간이면 어제 01:00대 청구는 창 밖이다.
"""
import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from scheduler import jobs
from utils import payment_event_log as pel


def _fake_execute_with_event_age(hours: float, amount: int = 17900):
    created = datetime.now(timezone.utc) - timedelta(hours=hours)

    async def _exec(_q):
        return SimpleNamespace(data=[{"amount": amount, "detail": "tid1", "created_at": created.isoformat()}])
    return _exec


class _Q:
    def __getattr__(self, _n):
        return lambda *a, **k: self


def _guard(monkeypatch, hours_ago, window_min):
    monkeypatch.setattr(pel, "execute", _fake_execute_with_event_age(hours_ago))
    monkeypatch.setattr(pel, "get_client", lambda: SimpleNamespace(table=lambda _n: _Q()))
    return asyncio.run(pel.find_recent_success_event("u1", "renewal", 17900, window_minutes=window_min))


def test_yesterdays_charge_at_next_cron_run_is_caught(monkeypatch):
    # 어제 01:00:30 청구 → 오늘 01:00:00 실행 = 약 23시간 59분 전(실행·지연으로 24~25시간까지 늘어날 수 있음)
    for hours in (23.9, 24.0, 25.0):
        assert _guard(monkeypatch, hours, jobs.RENEWAL_DEDUP_WINDOW_MIN), f"{hours}h 전 성공 이벤트를 놓쳤다"


def test_old_20_hour_window_would_miss_it(monkeypatch):
    # 수정 전 값(20시간)이면 같은 상황을 놓친다 — 이 시험이 수정 전 결함을 재현함을 보인다
    assert _guard(monkeypatch, 24.0, 20 * 60) is None


def test_window_does_not_block_a_normal_next_cycle(monkeypatch):
    # 정상 갱신 간격(30일)은 창 밖이어야 한다
    assert _guard(monkeypatch, 24 * 29, jobs.RENEWAL_DEDUP_WINDOW_MIN) is None


def test_window_is_longer_than_cron_cadence():
    assert jobs.RENEWAL_DEDUP_WINDOW_MIN > 24 * 60
