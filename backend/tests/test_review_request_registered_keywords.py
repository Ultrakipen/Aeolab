"""리뷰 요청 문구(손님에게 보내는 글)는 사장님이 등록한 키워드만 쓴다.

2026-11-05 실가이드 점검: category=beauty인 마사지샵(등록 키워드 상남동마사지·아로마마사지)의 리뷰 요청 문구에
업종 키워드 풀의 부족 키워드 '염색 전문 또는 탈모 케어'가 들어갔다 — 하지 않는 서비스를 손님에게 부탁하는 문구.
"""
from services.action_tools import build_review_request_message

BIZ = {
    "name": "테스트마사지",
    "naver_place_id": "123",
    "keywords": ["상남동마사지", "아로마마사지", "상남동핫플레이스"],
    "custom_keywords": [],
}


def test_unregistered_gap_keyword_is_not_asked_of_customers():
    msg = build_review_request_message(BIZ, "염색 전문", ["탈모 케어", "두피 관리"])
    assert "염색" not in msg and "탈모" not in msg and "두피" not in msg
    # 등록 키워드로 대신한다
    assert "상남동마사지" in msg


def test_registered_keyword_is_kept_even_with_spacing_difference():
    msg = build_review_request_message(BIZ, "아로마 마사지", [])
    assert "아로마 마사지" in msg


def test_registered_missing_keyword_is_kept_unregistered_dropped():
    msg = build_review_request_message(BIZ, "아로마마사지", ["염색 전문", "상남동마사지"])
    assert "아로마마사지" in msg and "상남동마사지" in msg
    assert "염색" not in msg


def test_custom_keywords_count_as_registered():
    biz = dict(BIZ, keywords=["상남동마사지"], custom_keywords=["타이마사지"])
    msg = build_review_request_message(biz, "타이마사지", [])
    assert "타이마사지" in msg


def test_no_registered_keywords_gives_generic_message_without_gap_keyword():
    biz = {"name": "테스트마사지", "naver_place_id": "123", "keywords": [], "custom_keywords": []}
    msg = build_review_request_message(biz, "염색 전문", ["탈모 케어"])
    assert "염색" not in msg and "탈모" not in msg
    assert "테스트마사지" in msg
