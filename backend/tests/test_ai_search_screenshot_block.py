"""네이버 블로그·카페 검색 화면 캡처 — 접속 실패·차단을 '미노출'로 저장하지 않는다 (2026-11-10).

최우선 지침 8번: error ≠ false. 확인하지 못한 결과는 measured=False 로 구분하고
차단 화면은 증거 스크린샷으로 올리지 않으며, 차단 회로에 보고한다.
"""
import asyncio
import sys
import types

import pytest

from services import ai_search_screenshot as mod

BLOCK_BODY = "비정상적인 접근이 감지되었습니다. 자동화된 요청으로 판단되어 잠시 제한합니다."
NORMAL_BODY = "창원 맛집 추천 블로그 결과 가나다 식당 후기 모음"


class FakePage:
    def __init__(self, mode):
        self.mode = mode           # "ok" | "block" | "goto_error"
        self.url = "https://search.naver.com/search.naver?where=blog"
        self.screenshots = 0

    async def goto(self, *a, **k):
        if self.mode == "goto_error":
            raise TimeoutError("goto timeout")
        if self.mode == "block":
            self.url = "https://search.naver.com/captcha"

    async def wait_for_timeout(self, *_):
        return None

    async def title(self):
        return "네이버 보안 문자" if self.mode == "block" else "네이버 검색"

    async def evaluate(self, script, *a):
        if script is mod._EXTRACT_BLOG_TEXT_JS:
            return "" if self.mode == "block" else "가나다 식당 후기"
        if "innerText" in str(script):
            return BLOCK_BODY if self.mode == "block" else NORMAL_BODY
        if script is mod._FIND_BLOG_START_JS:
            return 100
        return None

    async def screenshot(self, **k):
        self.screenshots += 1
        return b"png"

    async def close(self):
        return None


def _install(monkeypatch, mode, calls):
    pages = []

    class FakeBrowser:
        async def new_page(self, **k):
            p = FakePage(mode)
            pages.append(p)
            return p

        async def close(self):
            return None

    class FakeChromium:
        async def launch(self, **k):
            return FakeBrowser()

    class FakePW:
        chromium = FakeChromium()

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

    fake_mod = types.ModuleType("playwright.async_api")
    fake_mod.async_playwright = lambda: FakePW()
    monkeypatch.setitem(sys.modules, "playwright", types.ModuleType("playwright"))
    monkeypatch.setitem(sys.modules, "playwright.async_api", fake_mod)

    import services.ai_scanner as ai_scanner
    monkeypatch.setattr(ai_scanner, "check_naver_playwright_quota", lambda *_a, **_k: True, raising=False)
    import services.naver_access_guard as guard
    monkeypatch.setattr(guard, "begin_search_access", lambda *_a, **_k: (True, None))
    monkeypatch.setattr(guard, "report_search_block", lambda src, *a, **k: calls.append(("block", src)) or 1)
    monkeypatch.setattr(guard, "report_search_ok", lambda *a, **k: None, raising=False)
    import db.supabase_client as dbc
    monkeypatch.setattr(dbc, "get_client", lambda: object())

    uploads = []

    async def fake_upload(sb, path, data):
        uploads.append(path)
        return "https://cdn/x.png"

    monkeypatch.setattr(mod, "_upload_screenshot", fake_upload)
    return pages, uploads


def _run():
    return asyncio.run(mod.capture_naver_results("창원 맛집 추천", "가나다 식당", "biz1"))


def test_normal_page_is_measured(monkeypatch):
    calls = []
    _, uploads = _install(monkeypatch, "ok", calls)
    res = _run()
    assert [r["platform"] for r in res] == ["naver_blog", "naver_cafe"]
    assert all(r.get("measured") is True for r in res)
    assert all(r["is_mentioned"] for r in res)
    assert len(uploads) == 2 and not calls


def test_block_page_is_not_recorded_as_not_mentioned(monkeypatch):
    calls = []
    _, uploads = _install(monkeypatch, "block", calls)
    res = _run()
    assert all(r.get("measured") is False for r in res)
    assert all(r.get("error") for r in res)
    assert all(r["url"] is None for r in res)      # 차단 화면을 증거로 올리지 않는다
    assert uploads == []
    assert calls, "차단 회로에 보고해야 한다"


def test_goto_failure_is_not_recorded_as_not_mentioned(monkeypatch):
    calls = []
    _install(monkeypatch, "goto_error", calls)
    res = _run()
    assert all(r.get("measured") is False for r in res)
    assert all(r.get("error") for r in res)


def test_degraded_results_are_unmeasured(monkeypatch):
    import services.ai_scanner as ai_scanner
    monkeypatch.setattr(ai_scanner, "check_naver_playwright_quota", lambda *_a, **_k: False, raising=False)
    res = _run()
    assert all(r.get("measured") is False for r in res)


def test_block_on_first_tab_stops_second_tab_requests(monkeypatch):
    calls = []
    pages, _ = _install(monkeypatch, "block", calls)
    _run()
    assert len(pages) == 1, "차단 감지 뒤에는 두 번째 탭을 열지 않는다"
