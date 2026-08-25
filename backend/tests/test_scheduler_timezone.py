"""
스케줄러 타임존 회귀 테스트 — 2026-08-23에 AsyncIOScheduler(timezone="Asia/Seoul")임에도
cron hour/minute에 'KST - 9' UTC 변환을 적용해 10개 잡이 의도와 다른 시각에 실행되던
버그를 발견·수정한 후 재발 방지를 위해 추가 (jobs.py 타임존버그 전수 수정 이력 참조).

예: disk_usage_check_job 의도=09:30 KST → hour=0 으로 잘못 등록 → 00:30 KST 에 실행.
     ai_daily_usage_alert_job 의도=00:05 KST → hour=15 로 잘못 등록 → 15:05 KST 에 실행.

scheduler 자체가 timezone="Asia/Seoul" 로 구성돼 있으므로
add_job(hour=9, minute=30) 은 그대로 09:30 KST 를 의미한다.
UTC 변환(hour=9-9=0)을 적용하면 역으로 틀린 값이 된다.
"""
import pytest
from unittest.mock import patch

from apscheduler.triggers.cron import CronTrigger

# backend/ 루트에서 실행 (cd backend && python -m pytest)
from scheduler import jobs


def _cron_field_str(job, field_name: str) -> str | None:
    """CronTrigger 필드 중 field_name 의 문자열 표현 반환. Interval 트리거 등은 None."""
    trigger = job.trigger
    if not isinstance(trigger, CronTrigger):
        return None
    for f in trigger.fields:
        if f.name == field_name:
            return str(f)
    return None


@pytest.fixture(scope="module", autouse=True)
def _register_jobs():
    """
    start_scheduler() 로 잡을 등록하되 scheduler.start() 는 mock → 백그라운드 스레드 미생성.
    잡 메타데이터(트리거) 만 검증하기 위해서이며, 실제 이벤트 루프 없이도 동작한다.
    """
    with patch.object(jobs.scheduler, "start"):
        jobs.start_scheduler()
    yield
    try:
        jobs.scheduler.remove_all_jobs()
    except Exception:
        pass


# ── 1. 가장 중요: scheduler 자체 타임존 ─────────────────────────────────────────────

def test_scheduler_timezone_is_asia_seoul():
    """scheduler.timezone 이 Asia/Seoul 이 아니면 모든 cron 이 일제히 흔들린다 — 기반 조건."""
    assert str(jobs.scheduler.timezone) == "Asia/Seoul", (
        "scheduler.timezone 이 변경됐습니다. "
        "AsyncIOScheduler(timezone='Asia/Seoul') 로 초기화돼 있어야 합니다."
    )


# ── 2. 개별 잡 hour/minute 검증 ────────────────────────────────────────────────────
#
#  각 잡의 '의도한 KST 시각' 은 주석 문서에서 확인.
#  scheduler.timezone 이 Asia/Seoul 이므로 add_job 의 hour/minute 가 곧 KST 값이다.
#  과거 버그는 'UTC 로 변환해야 한다'는 오해에서 비롯됐으므로,
#  의도한 KST 값 그대로 등록됐는지를 검증한다.

@pytest.mark.parametrize("job_id, exp_hour, exp_minute, note", [
    # (job_id, expected_hour_str, expected_minute_str, 재발 방지 이유 설명)
    (
        "daily_scan",
        "2", "0",
        "새벽 2시 KST 자동 스캔 — 수동 UTC 변환이 없어야 올바른 값",
    ),
    (
        "disk_usage_check",
        "9", "30",
        "09:30 KST 디스크 점검 — 과거 hour=0(UTC 00:30 착각)으로 잘못 등록됐던 잡",
    ),
    (
        "ai_daily_usage_alert",
        "0", "5",
        "00:05 KST 일일 사용량 경보 — 과거 hour=15(KST+9 역변환 착각)로 15:05에 실행됐던 잡",
    ),
    (
        "conversion_followup",
        "10", "0",
        "10:00 KST 미결제 전환 알림 — 과거 hour=1(UTC 01:00 착각)로 01:00 KST에 실행됐던 잡",
    ),
    (
        "delivery_auto_cancel",
        "10", "30",
        "10:30 KST 대행 미결제 자동취소 — 과거 01:30 KST 에 실행됐던 잡",
    ),
    (
        "naver_cookie_health_check",
        "9", "30",
        "09:30 KST 네이버 쿠키 건강검사 (월요일) — 과거 00:30 KST 에 실행됐던 잡",
    ),
    (
        "data_wiring_readiness_check_job",
        "9", "20",
        "09:20 KST 데이터 배선 확장 조건 체크 — 과거 00:20 KST 에 실행됐던 잡",
    ),
])
def test_cron_job_kst_hour_minute(job_id, exp_hour, exp_minute, note):
    """각 cron 잡이 의도한 KST hour/minute 로 등록됐는지 확인한다."""
    job = next((j for j in jobs.scheduler.get_jobs() if j.id == job_id), None)
    assert job is not None, f"잡 '{job_id}' 가 등록돼 있지 않습니다."
    assert isinstance(job.trigger, CronTrigger), (
        f"'{job_id}' 트리거가 CronTrigger 가 아닙니다: {type(job.trigger)}"
    )

    actual_hour = _cron_field_str(job, "hour")
    actual_minute = _cron_field_str(job, "minute")

    assert actual_hour == exp_hour, (
        f"[{job_id}] hour: 의도={exp_hour!r}, 실제={actual_hour!r} — {note}"
    )
    assert actual_minute == exp_minute, (
        f"[{job_id}] minute: 의도={exp_minute!r}, 실제={actual_minute!r} — {note}"
    )
