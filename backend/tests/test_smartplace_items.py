"""사용자 스마트플레이스 점검 항목 구성 회귀 테스트 (2026-10-27, D2·D3).

핵심: 측정하지 못한 항목(사진 None, 메뉴 근거 없음, 차단 등)이 "미통과/0장 등록됨"으로 나가지 않는다.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.smartplace_items import build_check_items  # noqa: E402


def _sp(path):
    return f"https://smartplace.naver.com/bizes/123/{path}"


def _by_label(res):
    return {i["label"]: i for i in res["items"]}


def test_unmeasured_photo_is_not_a_failure_and_has_no_fake_count():
    raw = {"has_recent_post": True, "recent_post_measured": True, "has_intro": True, "intro_measured": True,
           "intro_char_count": 500, "photo_count": None, "has_menu": True, "menu_measured": True, "has_hours": True}
    res = build_check_items(raw, _sp, "123")
    photo = _by_label(res)["사진 5장 이상"]
    assert photo["measured"] is False
    assert photo["passed"] is None            # 미통과(False)가 아니다
    assert photo["detail"] is None            # "0장 등록됨" 같은 사실이 아닌 값이 없다
    assert res["max_score"] == 25 + 20 + 15 + 5   # 사진(10) 제외
    assert res["total_score"] == res["max_score"]


def test_measured_photo_counts_and_shows_real_number():
    raw = {"photo_count": 3, "has_recent_post": True, "has_intro": True, "has_menu": True, "has_hours": True}
    photo = _by_label(build_check_items(raw, _sp, "123"))["사진 5장 이상"]
    assert photo["measured"] is True and photo["passed"] is False and photo["detail"] == "3장 등록됨"
    raw["photo_count"] = 12
    assert _by_label(build_check_items(raw, _sp, "123"))["사진 5장 이상"]["passed"] is True


def test_menu_without_evidence_is_unmeasured_not_missing():
    raw = {"has_menu": False, "menu_measured": False, "photo_count": 9}
    menu = _by_label(build_check_items(raw, _sp, "123"))["메뉴·서비스 등록"]
    assert menu["measured"] is False and menu["passed"] is None


def test_blocked_info_tab_makes_intro_and_hours_unmeasured():
    raw = {"has_intro": False, "intro_measured": False, "has_hours": False}
    res = _by_label(build_check_items(raw, _sp, "123"))
    assert res["소개글 작성"]["passed"] is None
    assert res["영업시간 등록"]["passed"] is None


def test_unmeasured_recent_post_is_not_a_failure():
    raw = {"has_recent_post": False, "recent_post_measured": False}
    item = _by_label(build_check_items(raw, _sp, "123"))["최근 소식 업데이트"]
    assert item["measured"] is False and item["passed"] is None


def test_no_feed_tab_gets_plain_detail_when_measured_absent():
    raw = {"has_recent_post": False, "recent_post_measured": True, "recent_post_state": "no_tab"}
    item = _by_label(build_check_items(raw, _sp, "123"))["최근 소식 업데이트"]
    assert item["passed"] is False and item["detail"] == "소식 탭이 확인되지 않았습니다"


def test_old_saved_result_without_measured_keys_is_treated_as_measured():
    # 이 변경 이전에 저장된 결과에는 *_measured 키가 없다 — 이전과 같은 동작(측정된 것으로 취급)
    raw = {"has_recent_post": True, "has_intro": True, "intro_char_count": 300, "has_menu": True, "has_hours": True,
           "photo_count": 8}
    res = build_check_items(raw, _sp, "123")
    assert all(i["measured"] for i in res["items"])
    assert res["total_score"] == res["max_score"] == 75


def test_no_place_id_hides_photo_and_menu_links_only():
    res = _by_label(build_check_items({"photo_count": 1}, _sp, None))
    assert res["사진 5장 이상"]["action_url"] is None
    assert res["메뉴·서비스 등록"]["action_url"] is None
    assert res["소개글 작성"]["action_url"] is not None
