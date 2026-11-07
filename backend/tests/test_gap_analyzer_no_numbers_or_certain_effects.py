"""gap_analyzer의 사용자 노출 문구 — 점수 숫자·근거 없는 평균 수치·확정형 효과를 쓰지 않는다 (2026-11-07).

문구가 GapAnalysisCard·DailyMissionCard(`gap_reason`)·가이드 성장 단계 박스(`focus_message`)·주간 성적표(`top_action`)로 나간다.
- 규칙(CLAUDE.md): AI Visibility 점수 숫자는 사용자에게 직접 표시하지 않는다 / 경쟁사 점수는 간이 추정치라 숫자 대신 큰 차이만 '(추정)'.
- 11-01: 근거 없는 평균 수치(예: '한국 소상공인 평균 노출률 1~3%')·개선 보장 표현 금지.
- 완화형("…에 도움이 될 수 있습니다", 프로젝트 지침이 정한 "가능성이 높아집니다")은 허용한다.
"""
import re

import pytest

from models.gap import ScanContext
from services import gap_analyzer as ga
from services.stage_names import HEADLINE_BIG_DELTA

CERTAIN = ("늘어납니다", "개선됩니다", "직접 영향을 줍니다", "시작됩니다", "안정됩니다", "서서히 올라갑니다",
           "가장 빠른 방법", "가장 효과적", "동일한 효과", "지금 당장 개선할 방법이 없")
NUMBER_POINT = re.compile(r"\d+(\.\d+)?\s*점")          # '12점', '3.5점 차이' 등 점수 숫자


def _all_reasons():
    for ctx, table in ga._GAP_REASONS.items():
        for dim, fn in table.items():
            for gap in (0, 0.4, 12.3, 40.0):
                yield ctx, dim, gap, fn(gap)


@pytest.mark.parametrize("ctx,dim,gap,text", list(_all_reasons()))
def test_gap_reason_has_no_score_numbers_average_figures_or_certain_effects(ctx, dim, gap, text):
    assert "점 차이" not in text and not NUMBER_POINT.search(text), f"{ctx.name}/{dim}: 점수 숫자 노출\n{text}"
    assert "1~3%" not in text and "평균 노출률" not in text, f"{dim}: 근거 없는 평균 수치\n{text}"
    hit = [w for w in CERTAIN if w in text]
    assert not hit, f"{ctx.name}/{dim}: 확정형 효과 {hit}\n{text}"


def test_keyword_gap_message_is_hedged():
    class _KG:
        competitor_only_keywords = ["단체석", "주차", "룸"]

    t = ga._build_gap_reason("keyword_gap_score", 10.0, ScanContext.LOCATION_BASED, keyword_gap=_KG())
    assert "단체석" in t and "늘어납니다" not in t and "도움이 될 수 있습니다" in t


def _stage(score, comp):
    return ga._build_growth_stage(total_score=score, competitor_scores=[{"score": c} for c in comp])


def test_growth_stage_focus_message_never_prints_scores():
    for me, comps in [(60, [40, 44]), (30, [60, 70]), (50, [50, 49.5]), (50.0, [80.0])]:
        msg = _stage(me, comps).focus_message
        assert not NUMBER_POINT.search(msg) and "점 차이" not in msg and "평균" not in msg.replace("지역 경쟁사 평균보다", ""), msg


def test_growth_stage_says_direction_only_for_big_differences_and_marks_estimate():
    ahead = _stage(70, [50, 52]).focus_message       # 약 +19
    behind = _stage(30, [60, 62]).focus_message      # 약 -31
    near = _stage(50, [50 + HEADLINE_BIG_DELTA - 3]).focus_message   # 10 미만 차이 → 방향 없음
    assert "앞서 있는 것으로 추정됩니다" in ahead
    assert "낮은 것으로 추정됩니다" in behind
    assert "앞서" not in near and "낮은 것으로" not in near and "경쟁사 평균" not in near
    # 조금 앞서거나(0 < 차이 < 임계값) 같은 경우도 방향을 말하지 않는다 — 간이 추정치의 작은 차이는 오차
    for me, comp in [(55, 50), (52, 50), (50, 50), (59.9, 50)]:
        m = _stage(me, [comp]).focus_message
        assert "앞서" not in m and "낮은 것으로" not in m and "경쟁사 평균" not in m, (me, comp, m)
    # 경계: 정확히 HEADLINE_BIG_DELTA 차이는 방향을 말한다
    assert "앞서 있는" in _stage(50 + HEADLINE_BIG_DELTA, [50]).focus_message
    assert "낮은 것으로" in _stage(50 - HEADLINE_BIG_DELTA, [50]).focus_message


def test_unregistered_smart_place_message_does_not_promise_exposure():
    msg = ga._build_growth_stage(total_score=10, biz_data={"is_smart_place": False}).focus_message
    assert "시작됩니다" not in msg and "첫 번째 조건" in msg


def test_growth_stage_base_messages_do_not_assert_competitor_position_without_data():
    # 단계 기본 문구는 경쟁사 비교 데이터 없이도 붙으므로 경쟁사 우위·열세를 말하면 안 된다(경쟁사 비교는 데이터가 있을 때 '(추정)'으로만 덧붙인다)
    for cfg in ga._GROWTH_STAGES:
        m = cfg["focus_message"]
        assert "경쟁사보다 앞서" not in m and "경쟁사보다 뒤" not in m and "격차를 벌리" not in m, (cfg["stage"], m)
    # 경쟁사 데이터가 없을 때 55~75점 단계의 최종 문구
    assert "경쟁사" not in ga._build_growth_stage(total_score=60).focus_message
    # 경쟁사가 앞선다고 추정될 때도 서로 모순되는 문장이 붙지 않는다
    behind = ga._build_growth_stage(total_score=60, competitor_scores=[{"score": 85}, {"score": 90}]).focus_message
    assert "낮은 것으로 추정됩니다" in behind and "앞서" not in behind


def test_remaining_user_facing_claims_are_hedged():
    """같은 점검에서 찾은 확정형 문구 2곳(예약 버튼 전환율·발행 간격 신뢰도) — 근거 없는 구체 지표/단정 금지."""
    from pathlib import Path
    root = Path(__file__).resolve().parents[1] / "services"
    be = (root / "briefing_engine.py").read_text(encoding="utf-8")
    ba = (root / "blog_analyzer.py").read_text(encoding="utf-8")
    assert "방문 전환율이 높아집니다" not in be and "방문 예약으로 이어지는 데 도움이 될 수 있습니다" in be
    assert "AI 검색 신뢰도가 높아집니다" not in ba and "AI 검색 신뢰도에 도움이 될 수 있습니다" in ba


def test_other_user_facing_claims_found_in_second_sweep_are_hedged_and_accurate():
    """직전 점검이 services 일부만 읽어 놓친 곳(routers·scheduler·score_engine·email_sender)의 확정형·사실 불일치 문구 (2026-11-08)."""
    from pathlib import Path
    root = Path(__file__).resolve().parents[1]
    rp = (root / "routers" / "report.py").read_text(encoding="utf-8")
    jb = (root / "scheduler" / "jobs.py").read_text(encoding="utf-8")
    se = (root / "services" / "score_engine.py").read_text(encoding="utf-8")
    em = (root / "services" / "email_sender.py").read_text(encoding="utf-8")
    # FAQ 항목은 2026-05-01 Q&A 탭 폐기 이후 점수 가중치 0 — '가장 큰 감점 요인'이라고 말하면 사실과 다르다
    assert "has_faq: 2026-05-01 스마트플레이스 Q&A 탭 폐기 이후 가중치 0" in se
    assert "FAQ 미등록이 가장 큰 감점 요인" not in rp and "가능성이 크게 높아집니다" not in rp
    assert "AI 브리핑에 가장 자주 노출되는 콘텐츠" not in rp               # 근거 없는 최상급
    assert "소개글 안 Q&A 섹션을 더 채우면 AI 브리핑에 나올 가능성이 높아질 수 있습니다." in rp
    assert "AI 브리핑 노출이 늘어납니다" not in jb and "AI 브리핑 노출에 도움이 될 수 있습니다" in jb
    assert "AI 이미지 필터 노출이 늘어납니다" not in se and "AI 이미지 필터 노출에 도움이 될 수 있습니다" in se
    assert "노출이 더 늘어납니다" not in em and "더 많이 확보하면 노출에 도움이 될 수 있습니다" in em
