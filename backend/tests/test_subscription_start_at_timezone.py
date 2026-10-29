"""구독 start_at 시간대 (2026-10-29) — 시간대 없는 KST 시각을 저장해 DB에서 9시간 뒤로 기록되던 결함의 회귀 방지."""
import os
import re
import sys
from datetime import date, datetime, timedelta, timezone

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.kst import kst_date_from_iso, utc_now_iso  # noqa: E402

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def test_utc_now_iso_is_timezone_aware_and_current():
    dt = datetime.fromisoformat(utc_now_iso())
    assert dt.tzinfo is not None and dt.utcoffset() == timedelta(0)
    assert abs((datetime.now(timezone.utc) - dt).total_seconds()) < 5


@pytest.mark.parametrize("raw,expected", [
    ("2026-10-27T04:14:03+00:00", date(2026, 10, 27)),       # KST 13:14
    ("2026-10-26T16:00:00+00:00", date(2026, 10, 27)),       # KST 01:00 — UTC 날짜는 하루 전이다(이 경우를 놓치면 알림이 하루 어긋난다)
    ("2026-10-26T14:59:59+00:00", date(2026, 10, 26)),       # KST 23:59
    ("2026-10-26T15:00:00Z", date(2026, 10, 27)),            # Z 표기
    ("2026-10-27T04:14:03", date(2026, 10, 27)),             # 시간대 없으면 UTC로 본다
])
def test_kst_date_from_iso(raw, expected):
    assert kst_date_from_iso(raw) == expected


def test_billing_issue_stores_aware_timestamps_only():
    src = open(os.path.join(_ROOT, "routers", "webhook.py"), encoding="utf-8").read()
    body = src.split("charge_start_at", 1)[1]
    assert not re.search(r"charge_start_at\s*=\s*datetime\.now\(\)\.isoformat\(\)", src)   # 시간대 없는 값 재유입 금지
    assert src.count("charge_start_at = utc_now_iso()") == 2


def test_milestone_job_compares_korean_dates():
    src = open(os.path.join(_ROOT, "scheduler", "jobs.py"), encoding="utf-8").read()
    assert "start = kst_date_from_iso(start_raw)" in src
    assert "date.fromisoformat(str(start_raw)[:10])" not in src
