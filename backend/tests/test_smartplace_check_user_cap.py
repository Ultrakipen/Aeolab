"""POST /report/smartplace-check 사용자별 시간당 한도 (2026-11-06 점검).

호출 1회가 네이버 플레이스 페이지 4~5개를 쓰므로, 한 사용자의 반복 클릭이 하루 접속 예산을 혼자 쓰지 못하게 한다.
"""
import inspect

import pytest
from fastapi import HTTPException

from routers import report
from utils import cache as _cache


@pytest.fixture(autouse=True)
def _clean(monkeypatch):
    monkeypatch.delenv("SMARTPLACE_CHECK_HOURLY_CAP", raising=False)
    for u in ("u-cap", "u-other", "u-off"):
        try:
            _cache.set(f"smartplace_check:{u}", 0, 1)
        except Exception:
            pass
    yield


def test_blocks_after_cap_and_is_per_user():
    for _ in range(6):
        report._check_smartplace_user_cap("u-cap")
    with pytest.raises(HTTPException) as e:
        report._check_smartplace_user_cap("u-cap")
    assert e.value.status_code == 429
    report._check_smartplace_user_cap("u-other")        # 다른 사용자는 영향 없음


def test_cap_is_configurable_and_zero_disables(monkeypatch):
    monkeypatch.setenv("SMARTPLACE_CHECK_HOURLY_CAP", "0")
    for _ in range(20):
        report._check_smartplace_user_cap("u-off")
    monkeypatch.setenv("SMARTPLACE_CHECK_HOURLY_CAP", "abc")   # 잘못된 값은 기본 6
    for _ in range(6):
        report._check_smartplace_user_cap("u-cap")
    with pytest.raises(HTTPException):
        report._check_smartplace_user_cap("u-cap")


def test_cap_check_runs_before_playwright_work():
    src = inspect.getsource(report.post_smartplace_check)
    assert "_check_smartplace_user_cap(" in src
    assert src.index("_check_smartplace_user_cap(") < src.index("check_smart_place_completeness(")
    assert src.index("_check_smartplace_user_cap(") > src.index("PLAN_REQUIRED")   # 플랜 거절은 한도를 쓰지 않는다
