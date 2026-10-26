"""플레이스 ID 확정·리뷰 수 파싱의 오판/오탐 회귀 테스트 (2026-10-26).

실제 사고:
- 플레이스 화면의 "리뷰 1만"(축약)을 1건으로 읽어 1만 건이 넘는 가게가 리뷰 1건으로 저장될 수 있었다.
- 같은 이름·지역의 다른 지점이 캐시된 ID를 받을 수 있었다(주소 확인 부재).
- 가게 홈페이지(지역검색 API의 link)가 네이버 플레이스 URL로 취급됐다.
"""
import pytest

from services.naver_place_resolver import (
    address_matches, canonical_place_url, extract_place_id, is_naver_place_url,
)
from services.naver_place_stats import _exact_count

HOME_PATTERNS = [
    r"방문자\s*리뷰\s*(\d[\d,]*)", r"방문자리뷰\s*(\d[\d,]*)", r"리뷰\s*(\d[\d,]+)\s*개", r"(\d[\d,]+)\s*개\s*리뷰",
    r"방문자\s+(\d[\d,]+)", r"리뷰(\d[\d,]+)", r"리뷰[ \t]+(\d[\d,]*)",
]


class TestExactCount:
    @pytest.mark.parametrize("text", [
        "어니언 성수\n카페,디저트리뷰 1만\n영업 중",   # 실제 화면 문구
        "한식 리뷰 1.2만",
        "리뷰 3만",
    ])
    def test_abbreviated_counts_are_not_read_as_small_numbers(self, text):
        assert _exact_count(HOME_PATTERNS, text) is None

    def test_review_tab_exact_count_wins_over_abbreviation(self):
        body = "리뷰 1만\n리뷰2,283\n리뷰 258사진 1,710"
        assert _exact_count([r"리뷰(\d[\d,]+)"], body) == 2283

    def test_visitor_review_phrase(self):
        assert _exact_count(HOME_PATTERNS, "방문자 리뷰 4,100 블로그 리뷰 12") == 4100

    def test_nothing_found_is_none_not_zero(self):
        assert _exact_count(HOME_PATTERNS, "주소 서울 성동구") is None

    def test_receipt_review(self):
        pat = [r"영수증\s*리뷰\s*(\d[\d,]*)"]
        assert _exact_count(pat, "영수증 리뷰 1,234") == 1234
        assert _exact_count(pat, "영수증 리뷰 1만") is None


class TestAddressMatches:
    PAGE = "주소\n서울 성동구 아차산로9길 8 1, 2층지도내비게이션거리뷰\n2성수역"

    def test_same_building(self):
        assert address_matches("서울특별시 성동구 아차산로9길 8 1, 2층", self.PAGE) is True

    def test_same_road_different_number_is_other_branch(self):
        assert address_matches("서울특별시 성동구 아차산로9길 12", self.PAGE) is False

    def test_different_road(self):
        assert address_matches("서울특별시 성동구 성수일로 99 101호", self.PAGE) is False

    @pytest.mark.parametrize("addr", ["", "서울특별시 성동구 성수동2가 277-135"])
    def test_unverifiable_is_none(self, addr):
        assert address_matches(addr, self.PAGE) is None

    def test_page_without_road_address_is_none(self):
        assert address_matches("서울특별시 성동구 아차산로9길 8", "주소 정보 없음") is None


class TestNaverPlaceUrl:
    @pytest.mark.parametrize("url", [
        "https://map.naver.com/p/entry/place/38561949?lng=127.05",
        "https://m.place.naver.com/restaurant/38561949/home",
        "https://naver.me/abc123",
    ])
    def test_naver_urls_accepted(self, url):
        assert is_naver_place_url(url) is True

    @pytest.mark.parametrize("url", ["https://onionkr.com", "http://butternonion.com", "", None, "not a url"])
    def test_non_naver_urls_rejected(self, url):
        assert is_naver_place_url(url) is False

    def test_extract_id(self):
        assert extract_place_id("https://map.naver.com/p/entry/place/38561949?lng=1") == "38561949"
        assert extract_place_id("https://m.place.naver.com/restaurant/38561949/home") == "38561949"

    def test_extract_id_ignores_non_naver_host(self):
        assert extract_place_id("https://onionkr.com/place/123456789") is None

    def test_canonical_url_roundtrip(self):
        assert extract_place_id(canonical_place_url("38561949")) == "38561949"
