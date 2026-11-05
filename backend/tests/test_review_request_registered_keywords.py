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


# ── 제외 키워드(2026-11-05): 등록 키워드에 남아 있어도 쓰지 않는다 ─────────────────
def test_excluded_keyword_still_in_registered_list_is_not_used():
    biz = dict(BIZ, excluded_keywords=["상남동마사지"])  # 제외 API는 keywords에서 지우지 않는다
    msg = build_review_request_message(biz, "상남동마사지", ["아로마마사지"])
    assert "상남동마사지" not in msg
    assert "아로마마사지" in msg


def test_fallback_to_first_registered_skips_excluded():
    biz = dict(BIZ, excluded_keywords=["상남동마사지"])
    msg = build_review_request_message(biz, None, None)
    assert "상남동마사지" not in msg
    assert "아로마마사지" in msg


def test_all_registered_excluded_gives_generic_message():
    biz = dict(BIZ, excluded_keywords=list(BIZ["keywords"]))
    msg = build_review_request_message(biz, None, None)
    assert not any(k in msg for k in BIZ["keywords"])
    assert "테스트마사지" in msg


def test_generation_query_selects_excluded_keywords_for_the_tool():
    import pathlib
    src = (pathlib.Path(__file__).resolve().parents[1] / "routers" / "guide.py").read_text(encoding="utf-8")
    assert '.select("id, name, category, region, keywords, excluded_keywords, custom_keywords,' in src
