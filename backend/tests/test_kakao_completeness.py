"""카카오맵 완성도 점수 회귀 테스트 — 2026-10-10.

get_kakao_visibility()는 "is_on_kakao"를 돌려주는데 점수 계산은 "mentioned"만 읽어서,
카카오맵에 등록된 가게도 스캔 결과 경로에서는 0점이 되던 문제.
"""
import os

os.environ.setdefault("OPENAI_API_KEY", "test-key-not-used")

from services.score_engine import calc_kakao_completeness  # noqa: E402


def _vis(is_on, rank=None):
    return {"search_query": "서울 성동구 미용실", "my_rank": rank, "is_on_kakao": is_on, "kakao_competitors": [], "registration_checked": is_on is not None}


def test_registered_on_kakao_gets_registration_points():
    assert calc_kakao_completeness({"kakao_result": _vis(True, 11)}, {}) == 25.0
    assert calc_kakao_completeness({"kakao": _vis(True)}, {}) == 25.0  # 체험 경로는 "kakao" 키


def test_not_registered_is_zero():
    assert calc_kakao_completeness({"kakao_result": _vis(False)}, {}) == 0.0


def test_unknown_does_not_count_as_registered():
    assert calc_kakao_completeness({"kakao_result": _vis(None)}, {}) == 0.0


def test_unknown_falls_back_to_place_id_evidence():
    # 조회 실패(알 수 없음)면 0으로 확정하지 않고 kakao_place_id가 있으면 등록 근거로 쓴다
    assert calc_kakao_completeness({"kakao_result": _vis(None)}, {"kakao_place_id": "123"}) == 25.0


def test_user_checklist_score_still_has_priority():
    assert calc_kakao_completeness({"kakao_result": _vis(True)}, {"kakao_score": 70}) == 70.0


def test_legacy_shape_still_supported():
    assert calc_kakao_completeness({"kakao_result": {"mentioned": True, "has_hours": True}}, {}) == 40.0
    assert calc_kakao_completeness({}, {"kakao_place_id": "1"}) == 25.0
    assert calc_kakao_completeness({}, {}) == 0.0
