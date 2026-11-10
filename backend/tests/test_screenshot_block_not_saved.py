"""네이버 차단 화면을 시각 증거(After·블로그 인기글)로 저장하지 않는다 (2026-11-10).

수정 전: services/screenshot.py 의 네이버 분기에는 차단 판정이 없어 CAPTCHA 화면을 찍어 올렸고,
블로그 증거 캡처는 그 전에 기존 정상 증거 행을 먼저 지웠다.
"""
import asyncio
import contextlib
import io
import sys
import types

import pytest

from services import screenshot as shot

BLOCK_BODY = "비정상적인 접근이 감지되었습니다. 자동화된 요청으로 판단됩니다."


def _png():
    from PIL import Image
    b = io.BytesIO()
    Image.new("RGB", (1280, 900), "white").save(b, format="PNG")
    return b.getvalue()


class FakePage:
    def __init__(self, blocked):
        self.blocked = blocked
        self.url = "https://search.naver.com/search.naver"

    async def goto(self, *a, **k):
        if self.blocked:
            self.url = "https://search.naver.com/captcha"

    async def wait_for_timeout(self, *_):
        return None

    async def title(self):
        return "보안 문자" if self.blocked else "네이버 검색"

    async def evaluate(self, script, *a):
        if "innerText" in str(script):
            return BLOCK_BODY if self.blocked else "정상 검색 결과 본문"
        return 3

    async def screenshot(self, **k):
        return _png()


def _install(monkeypatch, blocked):
    page = FakePage(blocked)

    class Ctx:
        async def new_page(self):
            return page

    class Browser:
        async def new_context(self, **k):
            return Ctx()

        async def close(self):
            return None

    class Chromium:
        async def launch(self, **k):
            return Browser()

    class PW:
        chromium = Chromium()

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

    monkeypatch.setattr(shot, "async_playwright", lambda: PW())

    @contextlib.asynccontextmanager
    async def sem():
        yield

    monkeypatch.setattr(shot, "_get_playwright_sem", lambda: sem())
    import services.ai_scanner as ai_scanner
    monkeypatch.setattr(ai_scanner, "check_naver_playwright_quota", lambda *_a, **_k: True, raising=False)
    import services.naver_access_guard as guard
    reports = []
    monkeypatch.setattr(guard, "begin_search_access", lambda *_a, **_k: (True, None))
    monkeypatch.setattr(guard, "report_search_block", lambda src, *a, **k: reports.append(src) or 1)

    uploads, writes = [], []

    class Bucket:
        def upload(self, path, data, file_options=None):
            uploads.append(path)

        def get_public_url(self, path):
            return "https://cdn/" + path

    class Storage:
        def from_(self, _b):
            return Bucket()

    import db.supabase_client as dbc
    monkeypatch.setattr(dbc, "get_storage", lambda: Storage())
    monkeypatch.setattr(dbc, "get_client", lambda: types.SimpleNamespace(table=lambda n: _T(n, writes)))

    async def fake_execute(q):
        return types.SimpleNamespace(data=[])

    monkeypatch.setattr(dbc, "execute", fake_execute)
    return uploads, writes, reports


class _T:
    def __init__(self, name, writes):
        self.name, self.writes = name, writes

    def delete(self):
        self.writes.append(("delete", self.name))
        return self

    def insert(self, row):
        self.writes.append(("insert", self.name))
        return self

    def __getattr__(self, _n):
        return lambda *a, **k: self


@pytest.mark.parametrize("platform", ["naver", "naver_ai", "naver_ai_tab"])
def test_capture_ai_result_does_not_upload_block_screen(monkeypatch, platform):
    uploads, _, reports = _install(monkeypatch, blocked=True)
    out = asyncio.run(shot.capture_ai_result(platform, "창원 맛집", "biz1", "after_7d"))
    assert out is None
    assert uploads == []
    assert reports, "차단 회로에 보고해야 한다"


def test_capture_ai_result_normal_page_still_uploads(monkeypatch):
    uploads, _, reports = _install(monkeypatch, blocked=False)
    out = asyncio.run(shot.capture_ai_result("naver_ai", "창원 맛집", "biz1", "after_7d"))
    assert out and uploads and not reports


def test_blog_capture_block_keeps_existing_evidence(monkeypatch):
    uploads, writes, reports = _install(monkeypatch, blocked=True)
    out = asyncio.run(shot.capture_naver_blog_screenshot("웨딩", "biz1", "창원시"))
    assert out is None
    assert uploads == []
    assert writes == [], "차단이면 기존 증거를 지우거나 새 행을 넣지 않는다"
    assert reports


def test_blog_capture_normal_page_replaces_evidence(monkeypatch):
    uploads, writes, _ = _install(monkeypatch, blocked=False)
    out = asyncio.run(shot.capture_naver_blog_screenshot("웨딩", "biz1", "창원시"))
    assert out and uploads
    assert ("delete", "before_after") in writes and ("insert", "before_after") in writes
