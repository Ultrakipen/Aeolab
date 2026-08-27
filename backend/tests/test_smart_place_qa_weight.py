"""
스마트플레이스 완성도 — 소개글 Q&A 가점 회귀 테스트 (2026-08-27 신설).

배경: calc_smart_place_completeness()의 has_intro(소개글 "존재" 여부)는
Q&A 포함 여부를 구분하지 않아, Q&A 없는 소개글도 20점 만점을 받던 문제가 있었다.
20점을 15(존재)+5(Q&A 포함)로 분리했다 — plans.ts 판매 문구("Q&A 추가 후 AI가
바로 반영됐는지 확인")와 실제 채점 로직 간 불일치를 좁히기 위한 후속 조치.

이 테스트는 두 가지를 검증한다:
  A. _intro_contains_qa() 탐지 정확도 (참/거짓/오탐 방지 케이스)
  B. calc_smart_place_completeness() 총점 분할이 100점 상한을 유지하는지
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.score_engine import _intro_contains_qa, calc_smart_place_completeness  # noqa: E402


def test_intro_contains_qa_detects_q_a_marker_format():
    intro = (
        "저희 가게는 2020년에 오픈했습니다.\n\n"
        "Q. 주차 가능한가요?\nA. 매장 앞 2대 무료 주차 가능합니다.\n\n"
        "Q. 예약 없이 방문해도 되나요?\nA. 네, 가능합니다."
    )
    assert _intro_contains_qa(intro) is True


def test_intro_contains_qa_detects_header_only():
    intro = "저희 가게 소개입니다.\n\n[자주 묻는 질문]\n주차는 매장 앞에서 가능합니다."
    assert _intro_contains_qa(intro) is True


def test_intro_contains_qa_false_when_absent():
    intro = "저희 가게는 신선한 재료만 사용합니다. 편안한 분위기에서 식사하세요."
    assert _intro_contains_qa(intro) is False


def test_intro_contains_qa_avoids_false_positive_single_q():
    # "Q." 단발성 언급(예: 상호명 약자)은 Q&A 섹션으로 오판하지 않아야 함
    intro = "Q. 스토어 공식 소개글입니다. 다양한 상품을 만나보세요."
    assert _intro_contains_qa(intro) is False


def test_intro_contains_qa_false_on_empty():
    assert _intro_contains_qa("") is False
    assert _intro_contains_qa(None) is False


def test_smart_place_completeness_caps_at_100_with_qa():
    naver_data = {"is_smart_place": True, "my_rank": 1}
    biz = {
        "is_smart_place": True,
        "has_recent_post": True,
        "naver_intro_draft": "Q. 질문1\nA. 답변1\nQ. 질문2\nA. 답변2",
    }
    # 25(등록) + 30(순위 1위) + 25(소식) + 15(소개글) + 5(Q&A) = 100
    assert calc_smart_place_completeness(naver_data, biz) == 100


def test_smart_place_completeness_intro_without_qa_scores_5_less():
    naver_data = {"is_smart_place": True, "my_rank": 1}
    biz_with_qa = {
        "is_smart_place": True,
        "has_recent_post": True,
        "naver_intro_draft": "Q. 질문1\nA. 답변1\nQ. 질문2\nA. 답변2",
    }
    biz_without_qa = {
        "is_smart_place": True,
        "has_recent_post": True,
        "naver_intro_draft": "저희 가게는 정성을 다해 준비합니다.",
    }
    score_with_qa = calc_smart_place_completeness(naver_data, biz_with_qa)
    score_without_qa = calc_smart_place_completeness(naver_data, biz_without_qa)
    assert score_with_qa - score_without_qa == 5


def test_smart_place_completeness_no_intro_unaffected():
    naver_data = {"is_smart_place": False, "my_rank": None}
    biz = {"is_smart_place": False, "has_recent_post": False, "naver_intro_draft": ""}
    assert calc_smart_place_completeness(naver_data, biz) == 0
