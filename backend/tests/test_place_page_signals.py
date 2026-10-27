"""메뉴·사진 판정 회귀 테스트 (2026-10-27, docs/improvement_item_catalog_v1.0.md D2·D3).

메뉴 입력은 2026-10-27 로컬 브라우저로 확인한 실제 플레이스 홈 화면의 줄 구성이다.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.place_page_signals import (  # noqa: E402
    detect_menu_evidence,
    detect_menu_tab_content,
    parse_count,
    parse_photo_total,
)

# 어니언 성수(카페): 메뉴 탭 줄 + "메뉴16" 섹션 줄
ONION_HOME = "이전 페이지\n어니언 성수\n저장\n마이플레이스\n홈\n메뉴\n리뷰\n사진\n지도\n주변\n정보\n정보\n메뉴16\n앙버터\n소금빵\n"
# 홍스튜디오(사진관): 메뉴 탭 없음, 가격표 줄만 있음. 본문 문장에는 "메뉴"가 들어 있을 수 있다
HONG_HOME = "예약\n홈\n소식\n예약\n리뷰\n사진\n지도\n주변\n정보\n가격표\n가격표 이미지로 보기\n스냅 메뉴 구성이 다양해서 좋았어요\n"
# 작곡교습소(음악): 메뉴·가격 근거 없음
MUSIC_HOME = "예약\n홈\n소식\n예약\n리뷰\n사진\n지도\n주변\n정보\n예약7\n"


def test_menu_tab_and_section_lines_are_evidence():
    assert detect_menu_evidence(ONION_HOME) is True


def test_price_table_lines_are_evidence_without_menu_tab():
    assert detect_menu_evidence(HONG_HOME) is True


def test_no_evidence_for_shop_without_menu_or_price_lines():
    assert detect_menu_evidence(MUSIC_HOME) is False


def test_word_menu_inside_sentence_is_not_evidence():
    # 기존 판정의 오탐 원인: 리뷰 문장 속 "메뉴"만으로 통과하던 것
    only_prose = "예약\n홈\n리뷰\n사진\n정보\n메뉴가 다양하고 맛있어요\n메뉴 추천드려요\n"
    assert detect_menu_evidence(only_prose) is False


def test_old_substring_rule_was_wrong_for_music_and_prose_cases():
    import re
    old = lambda body: bool(re.search(r"메뉴|서비스\s*가격|레슨\s*요금|수업\s*요금|강의\s*요금|프로그램\s*안내|가격표|메뉴·서비스", body))  # noqa: E731
    assert old("예약\n홈\n리뷰\n사진\n정보\n메뉴가 다양하고 맛있어요\n") is True  # 기존: 문장 속 단어만으로 통과(오탐)
    assert detect_menu_evidence("예약\n홈\n리뷰\n사진\n정보\n메뉴가 다양하고 맛있어요\n") is False


def test_menu_tab_content_states():
    assert detect_menu_tab_content("등록된 메뉴가 없습니다.\n") is False
    assert detect_menu_tab_content("소금빵\n5,500원\n앙버터\n6,000원\n") is True
    assert detect_menu_tab_content("로딩중\n") is None  # 읽지 못함 — 없음으로 단정하지 않는다
    assert detect_menu_tab_content("") is None
    assert detect_menu_tab_content(None) is None


@pytest.mark.parametrize("text,expected", [
    ("전체 1,234", 1234),
    ("전체 56", 56),
    ("전체 7", 7),            # 한 자리 수도 읽는다
    ("전체 ,", None),          # 쉼표만 — 기존 정규식은 매칭 후 int('') 오류
    ("전체 ,,,", None),
    ("사진 ,", None),
    ("전체 0", None),          # 0은 "없음"이 아니라 미수집일 수 있다
    ("", None),
    (None, None),
])
def test_parse_photo_total_never_crashes(text, expected):
    assert parse_photo_total(text) == expected


def test_photo_prefers_total_then_falls_back_to_word_count():
    assert parse_photo_total("사진 12\n전체 340\n") == 340
    assert parse_photo_total("사진 12\n") == 12


def test_old_regex_crashed_on_comma_only_match():
    import re
    m = re.search(r"전체\s*([\d,]+)", "전체 ,")
    assert m is not None
    with pytest.raises(ValueError):
        int(m.group(1).replace(",", ""))
    assert parse_count(m) is None  # 새 헬퍼는 오류 없이 None
