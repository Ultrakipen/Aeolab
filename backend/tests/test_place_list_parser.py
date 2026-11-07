"""네이버 플레이스 목록 판정 함수(place_list_parser) — 2026-11-07 실제 화면 DOM 픽스처로 검증.

픽스처: tests/fixtures/naver_place_list_2026_11_07.html (비로그인 PC '창원 일본가정식 추천' 검색의 플레이스 목록 <ul>,
스크립트·이미지·속성은 제거하고 리뷰어 닉네임은 '***'로 지움). 지어낸 HTML이 아니라 실제 응답이다.
"""
import re
from pathlib import Path

import pytest

from services.ai_scanner import place_list_parser as plp

FIX = Path(__file__).resolve().parent / "fixtures" / "naver_place_list_2026_11_07.html"
EXPECTED = ["카쿠레가 창원어반브릭스점", "삼대초밥", "부자스시앤사케", "쇼쿠도", "코미치", "우동센세"]


@pytest.fixture(scope="module")
def html():
    return FIX.read_text(encoding="utf-8")


def test_extracts_all_six_places_in_order_from_real_dom(html):
    assert plp.extract_place_names(html) == EXPECTED


def test_old_scanner_selectors_do_not_match_this_dom(html):
    """오늘 화면 기준 기존 PLACE_SELECTORS가 죽어 있다는 근거를 고정한다(이 테스트가 깨지면 DOM이 바뀌었거나 셀렉터가 고쳐진 것)."""
    from services.ai_scanner.naver_scanner import PLACE_SELECTORS
    classes = set(" ".join(re.findall(r'class="([^"]*)"', html)).split())
    hrefs = re.findall(r'href="([^"]*)"', html)
    for sel in PLACE_SELECTORS:
        for tok in re.findall(r"\.([A-Za-z0-9_]+)", sel.split("[")[0]):
            assert tok not in classes, f"{sel}: 클래스 {tok}가 픽스처에 있다"
        m = re.search(r"class\*='([^']+)'", sel)
        if m:
            assert not any(m.group(1) in c for c in classes), sel
        m = re.search(r"href\*='([^']+)'", sel)
        if m:
            assert not any(m.group(1) in h for h in hrefs), sel


def test_match_rank_and_registered_name_variants(html):
    assert plp.judge_place_list(html, "삼대초밥")["rank"] == 2
    assert plp.judge_place_list(html, "쇼쿠도 본점")["rank"] == 4          # 등록명에만 '본점'
    assert plp.judge_place_list(html, "카쿠레가 창원어반브릭스점")["rank"] == 1


def test_conservative_matching_avoids_known_false_positives(html):
    assert plp.names_match("홍스튜디오", "더홍스튜디오") is False           # 부분 일치 오탐
    assert plp.names_match("카쿠레가", "카쿠레가 창원어반브릭스점") is False    # 지점이 다르면 같은 가게로 보지 않는다
    assert plp.names_match("하라식당 본점", "하라식당") is True
    assert plp.names_match("(주)리얼로펌", "리얼로펌") is True
    assert plp.names_match("", "삼대초밥") is False and plp.names_match("삼대초밥", "") is False
    assert plp.judge_place_list(html, "하라식당 본점") == {"list_found": True, "rank": None, "names": EXPECTED}


def test_unreadable_list_is_unmeasured_not_absent():
    for bad in ("", "<div>차단 안내</div>", "<ul><li>이름만</li></ul>", None):
        r = plp.judge_place_list(bad, "삼대초밥")
        assert r == {"list_found": False, "rank": None, "names": []}, bad


def test_tolerates_broken_markup(html):
    cut = html[: html.rfind("</li>")]        # 마지막 항목을 닫지 않은 잘린 HTML
    assert plp.extract_place_names(cut)[:5] == EXPECTED[:5]
    assert plp.extract_place_names("<li><a role='button' href='https://map.naver.com/p/search/x'><span>A가게")[:1] in (["A가게"], [])


def test_limit_applies(html):
    assert len(plp.judge_place_list(html, "없는가게", limit=3)["names"]) == 3
