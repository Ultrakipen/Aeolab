"""랜딩 '지금까지 N개 가게 분석 완료'는 체험 행 수가 아니라 서로 다른 가게 수 (2026-10-28).

배경: 행 수 그대로 보여 주면 개발자 테스트(한 가게 69회 반복 등)까지 세어 실제 가게 수(254행 중 약 64곳)의 몇 배로 부풀려 보였다.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta, timezone  # noqa: E402

from routers.scan import count_distinct_trial_places, trial_rows_since  # noqa: E402


def _r(name, region="창원"):
    return {"business_name": name, "region": region}


def test_same_shop_repeated_counts_once():
    assert count_distinct_trial_places([_r("대호흑돼지")] * 69) == 1


def test_whitespace_and_case_variants_are_the_same_shop():
    assert count_distinct_trial_places([_r("홍 스튜디오"), _r("홍스튜디오"), _r(" 홍스튜디오 ")]) == 1


def test_same_name_in_different_regions_are_different_shops():
    assert count_distinct_trial_places([_r("하라식당", "창원"), _r("하라식당", "김해")]) == 2


def test_test_names_and_blank_names_are_excluded():
    rows = [_r("테스트카페"), _r("test12"), _r("QA_테스트_가게"), _r(""), {"business_name": None, "region": "x"}, _r("진짜가게")]
    assert count_distinct_trial_places(rows) == 1


def test_empty_and_none_are_zero():
    assert count_distinct_trial_places([]) == 0
    assert count_distinct_trial_places(None) == 0


def test_raw_row_count_would_have_overstated():
    rows = [_r("A")] * 50 + [_r("B")] * 30 + [_r("테스트카페")] * 22
    assert len(rows) == 102 and count_distinct_trial_places(rows) == 2


def test_today_filter_uses_kst_midnight_not_utc_string_compare():
    kst = timezone(timedelta(hours=9))
    start = datetime(2026, 10, 28, 0, 0, tzinfo=kst)                    # 한국 10-28 0시 = UTC 10-27 15:00
    rows = [
        {"business_name": "A", "scanned_at": "2026-10-27T15:30:00+00:00"},   # 한국 10-28 00:30 -> 오늘
        {"business_name": "B", "scanned_at": "2026-10-27T14:59:00+00:00"},   # 한국 10-27 23:59 -> 어제
        {"business_name": "C", "scanned_at": "2026-10-28T01:00:00.123456+00:00"},
        {"business_name": "D", "scanned_at": None},
        {"business_name": "E", "scanned_at": "garbage"},
    ]
    assert [r["business_name"] for r in trial_rows_since(rows, start)] == ["A", "C"]
