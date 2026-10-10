"""가게 이름 일치(names_match) 회귀 테스트 — 2026-10-10.

공용 함수라 ChatGPT 노출 횟수(chatgpt_scanner), 네이버 대조(scan.py), 카카오·구글 지도 확인이 모두 이 규칙을 쓴다.
"점"만 붙은 지점 표기("어니언성수" ↔ "어니언성수점")가 불일치로 처리돼 노출 횟수가 과소 집계될 수 있었다.
"""
import os

os.environ.setdefault("OPENAI_API_KEY", "test-key-not-used")

from services.ai_scanner.chatgpt_scanner import names_match  # noqa: E402


def test_bare_branch_suffix_matches_both_directions():
    assert names_match("어니언성수", "어니언성수점")
    assert names_match("어니언성수점", "어니언성수")
    assert names_match("카페모모", "카페모모점")


def test_existing_branch_suffixes_still_match():
    assert names_match("준오헤어왕십리", "준오헤어왕십리역점")
    assert names_match("스타벅스", "스타벅스본점")
    assert names_match("스타벅스", "스타벅스2호점")
    assert names_match("스타벅스", "스타벅스창원상남동점")
    assert names_match("같은이름", "같은이름")


def test_different_shops_still_do_not_match():
    # 부분 문자열 오탐 방지(2026-09-28 실측): 전혀 다른 가게
    assert not names_match("카페모모", "카페모모카")
    assert not names_match("어니언", "어니언성수카페")
    # 같은 브랜드의 다른 지점은 서로 다른 가게
    assert not names_match("준오헤어왕십리역점", "준오헤어성수역점")


def test_too_short_or_empty_never_matches():
    assert not names_match("", "가게점")
    assert not names_match("가", "가점")
    assert not names_match("점", "점점")


def test_known_limit_single_char_plus_branch_is_treated_as_branch():
    # 알려진 한계(문서화): 한 글자+점은 지점 표기로 간주되므로 "카페모모카점"을 "카페모모"와 구별하지 못한다.
    assert names_match("카페모모", "카페모모카점")
