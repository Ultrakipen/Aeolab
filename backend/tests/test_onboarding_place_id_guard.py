"""온보딩 등록 화면이 이름이 다른 가게의 네이버 플레이스 ID를 붙이지 않게 막는다 (2026-11-01).

예전 코드는 이름이 맞는 결과가 없으면 `items.find(it => it.naver_place_id)`로 ID가 있는 아무 결과나 골랐다.
카카오에만 있는 가게를 고르면 다른 가게의 리뷰·순위가 내 가게 것으로 측정될 수 있다. 정적 검사(프론트 파일을 읽는다).
"""
import pathlib
import re

PAGE = pathlib.Path(__file__).resolve().parent.parent.parent / "frontend" / "app" / "(dashboard)" / "onboarding" / "page.tsx"


def _src():
    return PAGE.read_text(encoding="utf-8")


def test_no_unconditional_first_result_fallback():
    s = _src()
    assert not re.search(r"\|\|\s*items\.find\(\(?\s*it\s*\)?\s*=>\s*it\.naver_place_id\s*\)", s), "이름 대조 없이 ID가 있는 첫 결과를 고르는 폴백이 다시 들어왔다"


def test_id_is_taken_only_after_a_name_comparison():
    s = _src()
    i = s.index("const match = items.find(")
    block = s[i:i + 400]
    assert "compact(it.name" in block and "theirs" in block and "startsWith" in block


def test_unmatched_results_fall_through_to_server_resolver():
    s = _src()
    assert "await resolveFromSearchCard();" in s and s.count("resolveFromSearchCard()") >= 2
