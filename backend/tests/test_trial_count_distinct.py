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


# ── 개발·운영 테스트 IP 제외 (2026-11-01) ─────────────────────────────────────────────────────────
# 랜딩 '지금까지 N개 가게 분석 완료'가 개발자 테스트로 부풀려져 있었다: 실데이터에서 서로 다른 가게 93곳 중 약 61곳이
# 다량 사용 IP(73회·65회 등) 출신이었고, 가장 많은 IP는 개발자 본인으로 확인됐다.
from routers.scan import exclude_heavy_ip_rows  # noqa: E402


def _ip(name, ip, region="창원"):
    return {"business_name": name, "region": region, "ip_hash": ip}


def test_heavy_ip_rows_are_excluded_from_the_public_count():
    rows = [_ip(f"가게{i}", "dev") for i in range(10)] + [_ip("손님가게A", "u1"), _ip("손님가게B", "u2")]
    kept = exclude_heavy_ip_rows(rows, max_runs=3)
    assert count_distinct_trial_places(rows) == 12          # 제외 전: 개발 테스트가 섞여 부풀려진 값
    assert count_distinct_trial_places(kept) == 2           # 제외 후: 가끔 쓴 방문자만


def test_a_visitor_within_the_public_limit_is_kept():
    rows = [_ip("가게A", "u1"), _ip("가게B", "u1"), _ip("가게C", "u1")]   # 하루 3회 한도 안
    assert count_distinct_trial_places(exclude_heavy_ip_rows(rows, max_runs=3)) == 3


def test_rows_without_ip_hash_are_kept_not_guessed():
    rows = [{"business_name": "가게A", "region": "창원", "ip_hash": None}, {"business_name": "가게B", "region": "창원"}]
    assert count_distinct_trial_places(exclude_heavy_ip_rows(rows, max_runs=3)) == 2


def test_default_limit_comes_from_env(monkeypatch):
    monkeypatch.setenv("TRIAL_COUNT_MAX_RUNS_PER_IP", "1")
    rows = [_ip("가게A", "u1"), _ip("가게B", "u1")]
    assert exclude_heavy_ip_rows(rows) == []
    monkeypatch.setenv("TRIAL_COUNT_MAX_RUNS_PER_IP", "abc")      # 잘못된 값은 기본 3
    assert len(exclude_heavy_ip_rows(rows)) == 2
