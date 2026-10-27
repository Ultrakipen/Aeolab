"""네이버 지역검색 순위를 못 구한 경우(None)를 "미노출 0점"으로 세지 않는지 검증 (2026-10-27).

배경: 지역검색 API는 20곳을 요청해도 5곳만 돌려줘서, 경쟁이 센 상권(성수 카페 등)의 인기 가게는
순위가 None이 된다. 이 None은 "순위를 알 수 없음"이지 "미노출"이 아니다.
- 스마트플레이스 완성도: 순위 30점을 0으로 세지 않고 나머지 70점 만점으로 환산
- 지도 점수: 순위 절반을 0으로 세지 않고 카카오맵 점수만 사용
- calc_smart_place_completeness() 자체는 불변 (report.py 사진 완료 추정이 "순위 없으면 최대 70점"에 의존)
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.score_engine import (  # noqa: E402
    _smart_place_base_rank_aware,
    calc_local_map_score,
    calc_smart_place_completeness,
)

_FULL_BIZ = {
    "is_smart_place": True,
    "has_recent_post": True,
    "naver_intro_draft": "Q. 질문1\nA. 답변1\nQ. 질문2\nA. 답변2",
}


def test_sp_rank_known_is_unchanged():
    nd = {"is_smart_place": True, "my_rank": 1}
    score, known = _smart_place_base_rank_aware(nd, _FULL_BIZ)
    assert known is True
    assert score == calc_smart_place_completeness(nd, _FULL_BIZ) == 100


def test_sp_rank_unknown_rescales_to_70_max():
    nd = {"is_smart_place": True, "my_rank": None}
    # 원 함수는 순위 0점이라 70점이 최대 — 이 값에 기대는 호출처가 있어 그대로여야 한다
    assert calc_smart_place_completeness(nd, _FULL_BIZ) == 70
    score, known = _smart_place_base_rank_aware(nd, _FULL_BIZ)
    assert known is False
    assert score == 100.0


def test_sp_rank_unknown_does_not_hide_missing_items():
    # 소식이 없다는 것(측정으로 확인된 부족)은 순위를 몰라도 그대로 감점돼야 한다
    nd = {"is_smart_place": True, "my_rank": None}
    biz = {**_FULL_BIZ, "has_recent_post": False}
    score, known = _smart_place_base_rank_aware(nd, biz)
    assert known is False
    assert score == round(45 / 70 * 100, 6) or abs(score - 45 / 70 * 100) < 1e-6


def test_sp_unregistered_stays_zero():
    nd = {"is_smart_place": False, "my_rank": None}
    biz = {"is_smart_place": False, "has_recent_post": False, "naver_intro_draft": ""}
    score, known = _smart_place_base_rank_aware(nd, biz)
    assert score == 0
    assert known is False


def test_sp_rank_unknown_never_exceeds_100():
    nd = {"is_smart_place": True, "my_rank": None}
    score, _ = _smart_place_base_rank_aware(nd, _FULL_BIZ)
    assert score <= 100.0


def test_local_map_rank_unknown_uses_kakao_only():
    scan = {"kakao": {"is_on_kakao": True}}
    rank_none = calc_local_map_score(scan, {}, {"my_rank": None})
    rank_missing = calc_local_map_score(scan, {}, {})
    # 순위를 모르면 순위 절반이 0으로 깎이지 않는다 (카카오 점수 그대로)
    from services.score_engine import calc_kakao_completeness
    assert rank_none == rank_missing == calc_kakao_completeness(scan, {})


def test_local_map_rank_known_still_blends():
    scan = {"kakao": {"is_on_kakao": True}}
    from services.score_engine import calc_kakao_completeness
    k = calc_kakao_completeness(scan, {})
    assert calc_local_map_score(scan, {}, {"my_rank": 1}) == 100.0 * 0.5 + k * 0.5
    assert calc_local_map_score(scan, {}, {"my_rank": 4}) == 60.0 * 0.5 + k * 0.5
