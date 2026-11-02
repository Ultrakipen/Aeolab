"""성장 화면 요약 카드의 "↑ 개선됨 / ↓ 하락"은 백엔드 헤드라인과 같은 판정만 따른다 (2026-11-02).

이전에는 카드가 첫·마지막 점수 차이가 0이 아니기만 하면(0.1점도) 방향을 띄워, 바로 위 헤드라인("큰 변화 없이 유지 중")과 모순될 수 있었다.
서버 테스트가 frontend 폴더를 읽으므로 프론트를 먼저 배포한 뒤 이 테스트를 배포한다.
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = open(os.path.join(ROOT, "frontend", "app", "(dashboard)", "growth", "GrowthClient.tsx"), encoding="utf-8").read()


def test_card_arrow_follows_the_backend_headline_type_not_a_recomputed_delta():
    assert 'headlineType === "growth" || headlineType === "decline"' in SRC
    assert 'headlineType === "growth" ? "↑ 첫 측정 대비 개선됨" : "↓ 첫 측정 대비 하락"' in SRC


def test_card_no_longer_recomputes_direction_from_a_raw_score_difference():
    assert "totalDelta" not in SRC.replace("totalDeltaElapsedDays", "")                 # 옛 `totalDelta !== 0 && …` 로직이 남아 있지 않다
    assert not re.search(r"unified_score\s*-\s*first\.unified_score", SRC)


def test_weekly_change_display_threshold_equals_the_backend_big_change_constant():
    from services.stage_names import HEADLINE_BIG_DELTA
    lib = open(os.path.join(ROOT, "frontend", "lib", "changeDirection.ts"), encoding="utf-8").read()
    m = re.search(r"export const CHANGE_DISPLAY_MIN = (\d+(?:\.\d+)?);", lib)
    assert m and float(m.group(1)) == HEADLINE_BIG_DELTA                                  # 한쪽만 바꾸면 화면 안에서 기준이 갈린다
    assert "const CHANGE_DISPLAY_MIN" not in SRC and 'CHANGE_DISPLAY_MIN' in re.search(r'import \{[^}]*\} from "@/lib/changeDirection"', SRC).group(0)   # 화면은 공용 상수를 가져다 쓴다


def test_no_arrow_is_shown_for_a_two_point_change_anywhere_on_the_growth_screen():
    # 카드 2곳과 이력 표가 모두 상수를 쓴다 — 예전 `> 2`/`< -2`(측정 오차 범위)로 되돌아오면 실패
    assert not re.search(r"(?:weeklyChange|latestWeeklyChange)\)?\s*(?:>|<)=?\s*-?2\b", SRC)
    assert SRC.count("CHANGE_DISPLAY_MIN") >= 7                                          # 정의 1 + 카드 2×1 + 표 4


def test_card_still_requires_enough_elapsed_days_and_a_measured_pair():
    assert re.search(r"sufficientTrendData\s*&&\s*\(headlineType", SRC)


# ── 추이 그래프의 네이버 미확인일 (2026-11-02) ───────────────────────────────────────────────────────────────

def test_chart_breaks_unified_and_naver_lines_on_unmeasured_days_but_keeps_global():
    assert "score: unmeasured ? null : Math.round(entry.unified_score * 10) / 10" in SRC
    assert "naverScore: unmeasured ? null : Math.round(entry.track1_score * 10) / 10" in SRC
    assert "globalScore: Math.round((entry.track2_score ?? 0) * 10) / 10" in SRC          # 글로벌 AI 점수는 네이버와 무관하게 측정된다 — 가리지 않는다
    assert "connectNulls" not in SRC                                                      # 끊긴 자리를 선으로 이어 가짜 하락·상승을 만들지 않는다


def test_chart_marks_unmeasured_days_and_explains_them():
    assert "d.unmeasured ? (" in SRC and 'stroke="#d1d5db" strokeDasharray="2 3"' in SRC
    assert "회색 점선은 네이버를 확인하지 못한 날입니다" in SRC
    assert "이 날은 네이버를 확인하지 못해 통합·네이버 점수를 표시하지 않았습니다" in SRC


def test_tooltip_skips_null_values_so_a_missing_score_is_not_read_as_the_lowest_label():
    # Math.round(null)은 0 → getScoreTextLabel(0)="주의 필요"로 잘못 읽힌다
    assert 'payload.filter((p) => typeof p.value === "number")' in SRC
    assert "getScoreTextLabel(Math.round(p.value as number))" in SRC


def test_single_unmeasured_point_does_not_render_a_fake_label():
    assert 'chartData[0].score !== null ? getScoreTextLabel(chartData[0].score) : "네이버 확인 전"' in SRC
