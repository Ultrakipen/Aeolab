"""변화 기록 문구·마지막 측정일 표시 규칙 (2026-11-02) — 프론트 소스 대조.

서버 테스트가 frontend 폴더를 읽으므로 프론트를 먼저 배포한 뒤 이 테스트를 배포한다.
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FE = os.path.join(ROOT, "frontend")


def _read(*parts):
    with open(os.path.join(FE, *parts), encoding="utf-8") as f:
        return f.read()


def test_helper_hides_numbered_competitor_gap_and_same_stage_arrow_and_unverified_cause():
    s = _read("lib", "actionLabel.ts")
    assert "점\\s*앞서\\s*있습니다" in s and "경쟁사 강화 또는 정보 갱신 필요" in s and "단계 안에서" in s
    assert 'actionType !== "competitor_ahead"' in s


def test_growth_page_uses_helpers_everywhere_it_prints_a_log_label():
    s = _read("app", "(dashboard)", "growth", "GrowthClient.tsx")
    assert "{log.action_label}" not in s                       # 원문 라벨을 직접 찍는 곳이 남아 있으면 안 된다
    assert s.count("displayActionLabel(log.action_label)") == 2
    assert s.count("showsScoreDeltaBadge(log.action_type)") >= 4


def test_weekly_change_requires_a_fresh_measurement_and_stale_dates_are_shown():
    s = _read("app", "(dashboard)", "growth", "GrowthClient.tsx")
    # "이번 주 ↑/↓"는 두 갈래(PC·모바일 구성) 모두 7일 이내 측정일 때만
    # (임계값은 2026-11-02에 ±2점→CHANGE_DISPLAY_MIN(10점)로 바뀌었다 — 측정 오차 범위. 이 시험의 목적은 '7일 이내일 때만'이라는 보호 장치다)
    assert len(re.findall(r'Math\.abs\(latestWeeklyChange\) >= CHANGE_DISPLAY_MIN && freshness\.level === "fresh"', s)) == 2
    assert s.count("최신 아님") >= 2
    h = _read("lib", "actionLabel.ts")
    assert "days <= 7" in h and "days <= 13" in h


def test_trendline_uses_same_label_rules():
    s = _read("components", "dashboard", "TrendLine.tsx")
    assert "displayActionLabel(log.action_label)" in s and "showsScoreDeltaBadge(log.action_type)" in s
