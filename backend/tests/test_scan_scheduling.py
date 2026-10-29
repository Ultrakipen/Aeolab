"""정기 스캔 분산 테스트 (2026-10-27) — 설계 문서 §4 검증: 슬롯 분포 균등성, 요일별 부하, 순서 회전."""
import os
import sys
import uuid
from collections import Counter
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.scan_scheduling import (  # noqa: E402
    legacy_full_scan_days,
    predict_weekday_load,
    rotate_for_fairness,
    scan_slot,
    scheduled_full_scan_days,
    slot_spread_enabled,
)


def test_slot_is_deterministic_and_in_range():
    biz = str(uuid.UUID(int=12345))
    assert scan_slot(biz) == scan_slot(biz)
    assert 0 <= scan_slot(biz) <= 6


def test_slot_distribution_is_roughly_uniform_over_uuids():
    n = 7000
    c = Counter(scan_slot(str(uuid.uuid4())) for _ in range(n))
    assert set(c) == set(range(7))
    expected = n / 7
    assert all(abs(v - expected) < expected * 0.15 for v in c.values())   # ±15% 이내


def test_scan_counts_per_week_match_plan_promises():
    for _ in range(200):
        biz = str(uuid.uuid4())
        assert len(scheduled_full_scan_days("startup", biz)) == 1
        assert len(scheduled_full_scan_days("basic", biz)) == 2
        assert len(scheduled_full_scan_days("pro", biz)) == 3
        assert len(scheduled_full_scan_days("biz", biz)) == 7


def test_basic_pairs_are_spaced_not_consecutive_days():
    for _ in range(200):
        a, b = sorted(scheduled_full_scan_days("basic", str(uuid.uuid4())))
        assert b - a >= 3           # 월·목 / 화·금 / 수·토 — 이틀 이상 간격


def test_legacy_policy_matches_current_jobs_py():
    assert legacy_full_scan_days("startup") == {0}
    assert legacy_full_scan_days("basic") == {0, 3}
    assert legacy_full_scan_days("pro") == {0, 2, 4}
    assert legacy_full_scan_days("biz") == set(range(7))


def test_spread_reduces_peak_day_load_for_100_businesses():
    mix = (["basic"] * 70) + (["startup"] * 10) + (["pro"] * 15) + (["biz"] * 5)   # 설계 문서 §2 가정
    # 고정 ID(재현 가능) — 무작위 UUID는 표본 100곳에서 요일 편차가 실행마다 달라 기준이 흔들린다
    bizs = [{"id": str(uuid.UUID(int=(i + 1) * 104729)), "plan": p} for i, p in enumerate(mix)]
    legacy = predict_weekday_load(bizs, spread=False)
    spread = predict_weekday_load(bizs, spread=True)
    assert legacy[0] == 100                                # 현재: 월요일에 전 플랜이 몰린다
    assert max(spread) < max(legacy) * 0.6                 # 피크가 40% 이상 줄어든다
    assert sum(spread) == sum(legacy)                      # 총 스캔 횟수(주 N회 약속)는 같다
    assert max(spread) - min(spread) < max(legacy) - min(legacy)   # 요일 간 편차도 작아진다


def test_rotation_is_deterministic_within_a_day_and_changes_across_days():
    items = [str(uuid.UUID(int=i)) for i in range(50)]
    d1 = date(2026, 10, 27)
    a = rotate_for_fairness(items, key=lambda x: x, today=d1)
    b = rotate_for_fairness(items, key=lambda x: x, today=d1)
    c = rotate_for_fairness(items, key=lambda x: x, today=date(2026, 10, 28))
    assert a == b and sorted(a) == sorted(items) and a != c


def test_rotation_prevents_the_same_businesses_from_always_being_last():
    items = [str(uuid.UUID(int=i)) for i in range(40)]
    last_five = Counter()
    for day in range(1, 29):
        order = rotate_for_fairness(items, key=lambda x: x, today=date(2026, 11, day))
        last_five.update(order[-5:])
    assert len(last_five) > 20          # 28일 동안 뒤쪽 5곳이 거의 같은 사업장으로 고정되지 않는다


def test_slot_spread_flag_defaults_off(monkeypatch):
    monkeypatch.delenv("NAVER_SCAN_SLOT_SPREAD", raising=False)
    assert slot_spread_enabled() is False
    monkeypatch.setenv("NAVER_SCAN_SLOT_SPREAD", "true")
    assert slot_spread_enabled() is True


# ── daily_scan_all 요일 판정: 기존 인라인 규칙과 전수 비교 (2026-10-27) ──────────────────
def _legacy_decision(plan: str, weekday: int) -> str:
    """리팩터링 전 jobs.py daily_scan_all 의 규칙을 그대로 옮긴 것."""
    is_monday = weekday == 0
    is_thursday = weekday == 3
    is_pro_scan_day = weekday in (0, 2, 4)
    if plan == "startup" and not is_monday:
        return "skip"
    elif plan == "basic" and not (is_monday or is_thursday):
        return "skip"
    elif plan == "pro" and not is_pro_scan_day:
        return "basic"
    return "full"


def test_decide_scan_mode_without_spread_is_identical_to_legacy_rules_for_every_plan_and_weekday():
    from services.scan_scheduling import decide_scan_mode
    for plan in ("startup", "basic", "pro", "biz", "enterprise", "unknown"):
        for wd in range(7):
            assert decide_scan_mode(plan, wd, "any-id", spread=False) == _legacy_decision(plan, wd), (plan, wd)


def test_decide_scan_mode_with_spread_keeps_weekly_counts():
    from services.scan_scheduling import decide_scan_mode
    for _ in range(100):
        biz = str(uuid.uuid4())
        week = {p: [decide_scan_mode(p, wd, biz, spread=True) for wd in range(7)] for p in ("startup", "basic", "pro", "biz")}
        assert week["startup"].count("full") == 1 and week["startup"].count("skip") == 6
        assert week["basic"].count("full") == 2 and week["basic"].count("skip") == 5
        assert week["pro"].count("full") == 3 and week["pro"].count("basic") == 4   # 풀스캔 3회 + 경량 4회
        assert week["biz"].count("full") == 7


def test_slot_spread_enabled_runs_the_same_total_scans_as_legacy_for_a_mixed_population():
    from services.scan_scheduling import decide_scan_mode
    mix = (["basic"] * 70) + (["startup"] * 10) + (["pro"] * 15) + (["biz"] * 5)
    bizs = [(str(uuid.UUID(int=(i + 1) * 104729)), p) for i, p in enumerate(mix)]
    def total(spread):
        return sum(1 for biz, p in bizs for wd in range(7) if decide_scan_mode(p, wd, biz, spread) == "full")
    assert total(False) == total(True)


# ── 경쟁사 정기 잡 요일 분산 (2026-10-27) ──────────────────────────────────
def test_competitor_job_due_legacy_is_tuesday_sync_thursday_enrich():
    from services.scan_scheduling import competitor_job_due
    for wd in range(7):
        assert competitor_job_due("sync", wd, "any-biz", False) == (wd == 1)
        assert competitor_job_due("enrich", wd, "any-biz", False) == (wd == 3)


def test_competitor_job_due_spread_runs_each_business_once_per_week_per_job():
    import uuid
    from services.scan_scheduling import competitor_job_due, scan_slot
    for i in range(1, 40):
        biz = str(uuid.UUID(int=i * 104729))
        assert sum(competitor_job_due("sync", wd, biz, True) for wd in range(7)) == 1
        assert sum(competitor_job_due("enrich", wd, biz, True) for wd in range(7)) == 1
        sync_wd = next(wd for wd in range(7) if competitor_job_due("sync", wd, biz, True))
        assert sync_wd == scan_slot(biz)
        assert competitor_job_due("enrich", (sync_wd + 2) % 7, biz, True)   # 72h 캐시 안


def test_spread_patterns_load_each_weekday_evenly():
    """슬롯 분산 패턴이 하루에 몰리지 않는다(이전: Basic 월·목 42%·일 0%, Pro 수·금 71%)."""
    ids = [str(uuid.UUID(int=(i + 1) * 104729)) for i in range(700)]
    for plan, per_biz in (("startup", 1), ("basic", 2), ("pro", 3)):
        per_day = [sum(1 for i in ids if wd in scheduled_full_scan_days(plan, i)) for wd in range(7)]
        share = per_biz / 7
        assert max(per_day) <= 700 * share * 1.25, (plan, per_day)
        assert min(per_day) >= 700 * share * 0.75, (plan, per_day)       # 쉬는 요일이 없다
        assert sum(per_day) == 700 * per_biz                              # 가게당 주 N회는 그대로


def test_pro_full_scan_gaps_are_2_2_3_days():
    for i in (str(uuid.UUID(int=(k + 1) * 104729)) for k in range(100)):
        d = sorted(scheduled_full_scan_days("pro", i))
        assert sorted(((d[(k + 1) % 3] - d[k]) % 7) for k in range(3)) == [2, 2, 3]
