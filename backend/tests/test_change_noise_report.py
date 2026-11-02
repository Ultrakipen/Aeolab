"""임계값 재보정 점검 도구의 순수 함수 (2026-11-02) — 사건 구간 제외·간격 쌍·조건 판정이 맞는지."""
import importlib.util
import os
from datetime import date

_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts", "change_noise_report.py")
_spec = importlib.util.spec_from_file_location("change_noise_report", _PATH)
mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mod)


def test_incident_and_method_change_windows_are_excluded():
    assert mod.is_excluded(date(2026, 9, 2)) and mod.is_excluded(date(2026, 10, 26)) and mod.is_excluded(date(2026, 9, 30))   # 순위 측정 장애기(양 끝 포함)
    assert not mod.is_excluded(date(2026, 9, 1)) and not mod.is_excluded(date(2026, 8, 31))        # 장애기 직전은 포함하지 않는다
    assert mod.is_excluded(date(2026, 10, 27))                                                      # 장애기 끝(10-26) 다음 날이지만 채점 변경일(10-29)의 ±2일 안이라 제외
    assert mod.is_excluded(date(2026, 10, 29)) and mod.is_excluded(date(2026, 10, 31)) and mod.is_excluded(date(2026, 11, 1)) and mod.is_excluded(date(2026, 11, 3))   # 변경일 ±2일
    assert not mod.is_excluded(date(2026, 11, 4))


def test_lag_pairs_use_only_days_that_exist_and_skip_excluded_ends_when_stable_only():
    by_day = {"2026-08-01": 50.0, "2026-08-02": 53.0, "2026-08-08": 40.0, "2026-08-09": 61.0, "2026-09-05": 10.0, "2026-09-12": 90.0}
    assert sorted(mod.lag_deltas(by_day, 1, stable_only=False)) == [3.0, 21.0]                  # 8/1→8/2, 8/8→8/9 (8/9 이전 8/8이 있다)
    seven = sorted(mod.lag_deltas(by_day, 7, stable_only=False))
    assert seven == [8.0, 10.0, 80.0]                                                           # 8/1→8/8(10), 8/2→8/9(8), 9/5→9/12(80)
    stable_seven = sorted(mod.lag_deltas(by_day, 7, stable_only=True))
    assert stable_seven == [8.0, 10.0]                                                          # 9/5·9/12는 장애기 — 안정 구간에서는 빠진다


def test_summary_and_percentiles():
    s = mod.summarize([1.0, 2.0, 3.0, 4.0, 10.0])
    assert s["n"] == 5 and s["median"] == 3.0 and s["ge2"] == 80 and s["ge3"] == 60 and s["ge10"] == 20
    assert mod.summarize([]) == {"n": 0}
    assert mod.percentile([1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0], 0.9) == 10.0


def test_recalibration_requires_enough_non_developer_businesses_and_stable_pairs():
    ok, why = mod.recalibration_status(non_dev_businesses=0, stable_pairs=5)
    assert not ok and len(why) == 2                                                             # 지금 상태(개발자 계정뿐) — 미충족과 사유 둘 다 말한다
    assert mod.recalibration_status(19, 500)[0] is False
    assert mod.recalibration_status(20, 199)[0] is False
    assert mod.recalibration_status(20, 200) == (True, [])


def test_accounts_created_before_the_soft_launch_are_all_developers():
    # 사용자 확인(11-02): 그때까지의 계정은 전부 개발자 계정 — 관리자 id 목록만 보면 개발자 계정을 실제 고객으로 세는 오판이 난다
    assert mod.is_developer_account("u1", "2026-04-18T00:00:00+00:00", set()) is True
    assert mod.is_developer_account("u2", "2026-11-02T23:59:59+00:00", set()) is True       # 컷오프(11-03) 하루 전
    assert mod.is_developer_account("u3", "2026-11-03T00:00:00+00:00", set()) is False      # 소프트 런치 이후 가입 = 실제 고객
    assert mod.is_developer_account("admin", "2027-01-01T00:00:00+00:00", {"admin"}) is True   # 명시한 id는 가입일과 무관하게 개발자
    assert mod.is_developer_account("u4", "", set()) is True and mod.is_developer_account("u5", None, set()) is True   # 생성일을 모르면 실제 고객 수를 부풀리지 않는다


def test_thresholds_of_the_tool_match_the_documented_trigger():
    assert mod.MIN_NON_DEV_BUSINESSES == 20 and mod.MIN_STABLE_PAIRS == 200
