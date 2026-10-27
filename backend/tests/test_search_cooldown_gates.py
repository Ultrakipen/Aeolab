"""검색 화면 차단 쿨다운 게이트 (2026-10-27): 쿨다운 중에는 네이버 화면을 여는 보조 경로도 접속하지 않는다.

배경: 브리핑·AI탭·순위만 회로 차단기를 거쳤고, 가게 카드 확정·블로그 검색 분석·스크린샷 3종은
일일 상한만 있어 검색 화면이 막힌 상태에서도 계속 접속을 시도했다.
"""
import asyncio
import os
import sys
from unittest.mock import patch

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import naver_access_guard as g  # noqa: E402


class _Boom:
    """Playwright를 열려는 시도를 센다. 호출처가 예외를 삼켜도 calls로 잡히도록 한다."""

    def __init__(self):
        self.calls = 0

    def __call__(self, *a, **k):
        self.calls += 1
        raise AssertionError("쿨다운 중인데 Playwright를 열려 했다")


@pytest.fixture
def cooled():
    g.reset_search_for_tests()
    g.report_search_block("test")      # 검색 화면 회로 열기(1시간)
    yield
    g.reset_search_for_tests()


def _quota_ok():
    return patch("services.ai_scanner.check_naver_playwright_quota", lambda *_a, **_k: True)


def test_blog_search_analyzer_skips_when_cooled(cooled):
    from services import blog_search_analyzer as m
    boom = _Boom()
    with _quota_ok(), patch.object(m, "async_playwright", boom):
        r = asyncio.run(m.analyze_blog_search("창원 카페 추천", "내가게", []))
    assert boom.calls == 0
    assert r["error"] == "naver_search_cooldown"
    assert r["captcha_detected"] is False       # 차단 당한 게 아니라 접속을 건너뛴 것
    assert r["total_found"] == 0 and r["my_rank"] is None


def test_place_resolver_raises_when_cooled_and_maps_to_error(cooled):
    from services import naver_place_resolver as m
    boom = _Boom()
    with _quota_ok(), patch("playwright.async_api.async_playwright", boom):
        with pytest.raises(RuntimeError, match="naver_search_cooldown"):
            asyncio.run(m._collect_cards("창원 홍스튜디오"))
        r = asyncio.run(m.resolve_naver_place("홍스튜디오", "창원", ""))
    assert boom.calls == 0
    assert r["status"] == "error"               # 확정하지 못함 — 임의로 저장하지 않는다
    assert r["naver_place_id"] is None


def test_screenshot_capture_returns_none_when_cooled(cooled):
    from services import screenshot as m
    boom = _Boom()
    with _quota_ok(), patch.object(m, "async_playwright", boom):
        assert asyncio.run(m.capture_ai_result("naver", "창원 카페", "biz1")) is None
        assert asyncio.run(m.capture_naver_blog_screenshot("카페", "biz1", "창원")) is None
    assert boom.calls == 0


def test_ai_search_screenshot_degrades_when_cooled(cooled):
    from services import ai_search_screenshot as m
    boom = _Boom()
    # get_client가 먼저 실패해 Playwright까지 가지 못하면 게이트 유무를 가릴 수 없다 — DB 클라이언트는 더미로 둔다
    with _quota_ok(), patch("db.supabase_client.get_client", lambda: object()),             patch("playwright.async_api.async_playwright", boom):
        r = asyncio.run(m.capture_naver_results("biz1", "창원 카페", "내가게"))
    assert boom.calls == 0
    assert isinstance(r, list)
    assert all(not x.get("mentioned") for x in r)


def test_gates_do_not_block_when_not_cooled():
    g.reset_search_for_tests()
    assert g.begin_search_access("x")[0] is True
