"""'다음 자동 측정' 시각은 플랜·슬롯 요일 규칙(decide_scan_mode)을 따라야 한다 (2026-11-10).

수정 전: report.get_score_delta 가 플랜과 무관하게 항상 '다음 02:00'을 돌려줘, 주 2회인 Basic에게도 "자동 측정 내일"이라고 안내했다.
"""
import hashlib
import inspect
from datetime import datetime, timedelta, timezone

import pytest

from services import scan_scheduling as ss

KST = timezone(timedelta(hours=9))


def at(y, m, d, h, mi=0):
    return datetime(y, m, d, h, mi, tzinfo=KST)


TUE_10 = at(2026, 11, 10, 10)      # 2026-11-10 = 화요일
MON_01 = at(2026, 11, 9, 1)        # 월요일 새벽 1시(오늘 02:00 스캔 전)


def test_free_plan_has_no_auto_scan():
    assert ss.next_auto_scan_kst("free", "b1", TUE_10, spread=False) is None
    assert ss.next_auto_scan_kst("", "b1", TUE_10, spread=False) is None


def test_before_2am_today_counts_after_2am_does_not():
    r = ss.next_auto_scan_kst("basic", "b1", MON_01, spread=False)
    assert r == at(2026, 11, 9, 2)                       # 월요일 02:00 아직 안 지남
    r2 = ss.next_auto_scan_kst("basic", "b1", at(2026, 11, 9, 3), spread=False)
    assert r2 == at(2026, 11, 12, 2)                     # 월 02:00 지났으니 다음은 목요일


def test_legacy_days_per_plan():
    assert ss.next_auto_scan_kst("startup", "b1", TUE_10, spread=False) == at(2026, 11, 16, 2)   # 다음 월요일
    assert ss.next_auto_scan_kst("basic", "b1", TUE_10, spread=False) == at(2026, 11, 12, 2)     # 목요일 (내일 아님)
    assert ss.next_auto_scan_kst("pro", "b1", TUE_10, spread=False) == at(2026, 11, 11, 2)       # 경량 스캔 포함 매일
    assert ss.next_auto_scan_kst("biz", "b1", TUE_10, spread=False) == at(2026, 11, 11, 2)


def test_returns_aware_kst_at_2am():
    r = ss.next_auto_scan_kst("basic", "b1", TUE_10, spread=False)
    assert r.utcoffset() == timedelta(hours=9) and (r.hour, r.minute, r.second) == (2, 0, 0)


@pytest.mark.parametrize("plan", ["startup", "basic", "pro", "biz"])
@pytest.mark.parametrize("spread", [False, True])
def test_matches_decide_scan_mode_for_many_businesses(plan, spread):
    """임의 사업장·임의 시각에서, 돌려준 날은 실제로 스캔하는 날이고 그 사이 날들은 모두 건너뛰는 날이다."""
    for i in range(40):
        biz = hashlib.md5(f"biz{i}".encode()).hexdigest()
        for now in (at(2026, 11, 9 + (i % 7), 1), at(2026, 11, 9 + (i % 7), 13)):
            r = ss.next_auto_scan_kst(plan, biz, now, spread=spread)
            assert r is not None
            assert ss.decide_scan_mode(plan, r.weekday(), biz, spread) != "skip"
            d = (now if now.hour < 2 else now + timedelta(days=1)).replace(hour=2, minute=0, second=0, microsecond=0)
            while d.date() < r.date():
                assert ss.decide_scan_mode(plan, d.weekday(), biz, spread) == "skip"
                d += timedelta(days=1)


def test_slot_spread_uses_business_slot_weekday():
    biz = "11111111-2222-3333-4444-555555555555"
    slot = ss.scan_slot(biz)
    r = ss.next_auto_scan_kst("startup", biz, TUE_10, spread=True)
    assert r.weekday() == slot            # 월요일 고정이 아니라 사업장 슬롯 요일


def test_score_delta_endpoint_uses_the_scheduler_not_a_fixed_2am():
    from routers import report
    src = inspect.getsource(report.get_score_delta)
    assert "next_auto_scan_kst(" in src
    assert "replace(hour=2" not in src, "플랜과 무관한 고정 '다음 02:00' 계산이 남아 있다"
