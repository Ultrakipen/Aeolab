"""별점 낮은 리뷰 알림 일정 — 매주 월·목 오전 10시 (2026-10-28).

6시간마다(하루 4회)였던 것을 주 2회로 줄였다. 사용자에게 빈번한 알림은 신뢰를 깎고, 이 잡은 20곳 기준 주간 네이버 접속의
47%(최대 소비처)였다. 이 테스트는 등록된 트리거를 직접 검증해 일정이 다시 늘어나지 않게 한다.
"""
from unittest.mock import patch

import pytest
from apscheduler.triggers.cron import CronTrigger

from scheduler import jobs


@pytest.fixture(scope="module", autouse=True)
def _register_jobs():
    with patch.object(jobs.scheduler, "start"):
        jobs.start_scheduler()
    yield
    try:
        jobs.scheduler.remove_all_jobs()
    except Exception:
        pass


def _field(job, name):
    assert isinstance(job.trigger, CronTrigger), "cron 트리거여야 한다"
    return next(str(f) for f in job.trigger.fields if f.name == name)


def test_low_rating_check_runs_monday_and_thursday_at_10_kst():
    job = jobs.scheduler.get_job("low_rating_check")
    assert job is not None
    assert str(jobs.scheduler.timezone) == "Asia/Seoul"
    assert _field(job, "day_of_week") == "mon,thu"
    assert _field(job, "hour") == "10"
    assert _field(job, "minute") == "0"


def test_low_rating_check_fires_exactly_twice_a_week_not_every_few_hours():
    """다음 14일 동안의 실행 시각을 계산해 월·목 10:00 외에는 없고 주 2회임을 확인한다."""
    from datetime import datetime, timedelta

    import pytz

    job = jobs.scheduler.get_job("low_rating_check")
    tz = pytz.timezone("Asia/Seoul")
    now = tz.localize(datetime(2026, 10, 28, 15, 30))        # 수요일 오후
    fires = []
    t = None
    cursor = now
    for _ in range(8):
        t = job.trigger.get_next_fire_time(t, cursor)
        fires.append(t)
        cursor = t + timedelta(seconds=1)
    assert all(f.hour == 10 and f.minute == 0 for f in fires)
    assert {f.weekday() for f in fires} == {0, 3}            # 월(0)·목(3)만
    assert fires[0] == tz.localize(datetime(2026, 10, 29, 10, 0))   # 다음 실행은 목요일 10:00
    gaps = {(b - a).days for a, b in zip(fires, fires[1:])}
    assert gaps == {3, 4}                                     # 월→목 3일, 목→월 4일뿐 — 하루 여러 번이 아니다
