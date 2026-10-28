"""플레이스 접속 진입점의 회로 차단기·속도 기준·차단 화면 처리 (2026-10-28 함수 단위 감사).

배경: 어젯밤 "접속 지점 보호 현황표"를 파일 단위로 세서, 같은 파일의 다른 함수가 보호돼 있다는 이유로
두 함수의 구멍이 가려졌다 — 점수 낮은 리뷰 조회(get_recent_low_rating_reviews)는 쿨다운 중에도 접속했고
(쿨다운 만료 7초 전 접속 기록), 주소 확인용 가게 상세 조회(_fetch_place_page_text)는 회로를 거치지 않았다.
"""
import ast
import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import naver_access_guard as g  # noqa: E402

BLOCK_BODY = (
    "플레이스\n서비스 이용이 제한되었습니다.\n과도한 접근 요청으로 서비스 이용이 제한되었습니다.\n"
    "잠시 후 다시 시도해주세요.\nIP: 1.2.3.4"
)
OK_BODY = "2점 매우 불만\n서비스가 너무 느리고 음식이 차가웠습니다 다시는 가지 않을 것 같아요\n" + ("정상 본문 " * 400)


# ── 가짜 브라우저 ─────────────────────────────────────────────────────────────
class _Loc:
    def __init__(self, visible=False, clicks=None):
        self.visible = visible
        self.clicks = clicks if clicks is not None else []

    @property
    def first(self):
        return self

    async def is_visible(self, timeout=0):
        return self.visible

    async def click(self):
        self.clicks.append(1)
        return None


class _Page:
    def __init__(self, body):
        self.body = body
        self.frames = []

    async def goto(self, *a, **k):
        return None

    async def wait_for_timeout(self, *a):
        return None

    def locator(self, sel):
        return _Loc()

    async def inner_text(self, sel):
        return self.body


class _Ctx:
    def __init__(self, body):
        self.body = body

    async def route(self, *a):
        return None

    def on(self, *a, **k):
        return None

    async def new_page(self):
        return _Page(self.body)


class _Browser:
    def __init__(self, body):
        self.body = body

    async def new_context(self, **k):
        return _Ctx(self.body)

    async def close(self):
        return None


class _PW:
    def __init__(self, body, launches):
        self.chromium = self
        self.body = body
        self.launches = launches

    async def launch(self, **k):
        self.launches.append(1)
        return _Browser(self.body)


class _CM:
    def __init__(self, body, launches):
        self.body = body
        self.launches = launches

    async def __aenter__(self):
        return _PW(self.body, self.launches)

    async def __aexit__(self, *a):
        return False


@pytest.fixture
def fake_env(monkeypatch):
    """Playwright·보조 함수를 가짜로 — 네이버에 접속하지 않는다."""
    import services.ai_scanner as ai
    import services.ai_scanner.bandwidth_tracker as bt

    async def _noop(*a, **k):
        return None

    monkeypatch.setattr(ai, "apply_stealth", _noop)
    monkeypatch.setattr(ai, "block_heavy_resources", _noop)
    monkeypatch.setattr(ai, "get_random_ua", lambda: "UA")
    monkeypatch.setattr(bt, "record_usage_mb", _noop)
    monkeypatch.setattr(g, "place_pace", _noop)          # 무작위 대기 제거(테스트 속도)
    return {"launches": []}


def _install_playwright(monkeypatch, body, launches):
    import playwright.async_api as pwapi
    import services.naver_place_stats as ps

    monkeypatch.setattr(pwapi, "async_playwright", lambda: _CM(body, launches))
    monkeypatch.setattr(ps, "async_playwright", lambda: _CM(body, launches))


# ── naver_place_resolver._fetch_place_page_text ────────────────────────────────
def test_resolver_place_page_refused_during_cooldown(fake_env, monkeypatch):
    import services.naver_place_resolver as rv

    _install_playwright(monkeypatch, OK_BODY, fake_env["launches"])
    g.report_place_block("t")
    with pytest.raises(RuntimeError, match="naver_place_cooldown"):
        asyncio.run(rv._fetch_place_page_text("123"))
    assert fake_env["launches"] == []


def test_resolver_block_screen_is_an_error_not_an_address_mismatch(fake_env, monkeypatch):
    import services.naver_place_resolver as rv

    _install_playwright(monkeypatch, BLOCK_BODY, fake_env["launches"])
    with pytest.raises(RuntimeError, match="naver_place_blocked"):
        asyncio.run(rv._fetch_place_page_text("123"))
    assert g.snapshot()["open"] is True


def test_resolver_normal_page_returns_text(fake_env, monkeypatch):
    import services.naver_place_resolver as rv

    _install_playwright(monkeypatch, OK_BODY, fake_env["launches"])
    assert "정상 본문" in asyncio.run(rv._fetch_place_page_text("123"))
    assert g.snapshot()["open"] is False


def test_resolver_maps_blocked_place_page_to_error_status(fake_env, monkeypatch):
    """resolve_naver_place 전체 흐름: 가게 카드는 1곳 일치, 상세 조회가 차단 화면 -> status=error(확정하지 않음)."""
    import services.naver_place_resolver as rv

    async def _cards(query):
        return [{"id": "999", "text": "홍스튜디오"}]

    monkeypatch.setattr(rv, "_collect_cards", _cards)
    _install_playwright(monkeypatch, BLOCK_BODY, fake_env["launches"])
    rv._cache.clear() if hasattr(rv._cache, "clear") else None
    r = asyncio.run(rv.resolve_naver_place("홍스튜디오", "창원", "경상남도 창원시 성산구 원이대로 495"))
    assert r["status"] == "error" and r["naver_place_id"] is None


# ── 함수 단위 구조 감사 (회귀 방지) ────────────────────────────────────────────
_PLACE_MODULES = (
    "services/naver_place_stats.py",
    "services/smart_place_auto_check.py",
    "services/competitor_place_crawler.py",
    "services/naver_place_resolver.py",
)


def test_every_playwright_entry_point_checks_a_breaker():
    """세마포어를 잡고 네이버 페이지를 여는 진입 함수는 반드시 회로 차단기(플레이스 또는 검색)를 확인해야 한다.
    파일 단위가 아니라 함수 단위로 본다 — 같은 파일의 다른 함수가 보호돼 있어도 이 함수가 빠져 있을 수 있다."""
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    missing = []
    for rel in _PLACE_MODULES:
        src = open(os.path.join(root, rel), encoding="utf-8").read()
        for fn in [n for n in ast.walk(ast.parse(src)) if isinstance(n, (ast.AsyncFunctionDef, ast.FunctionDef))]:
            if fn.name == "_get_playwright_sem":
                continue
            seg = ast.get_source_segment(src, fn) or ""
            takes_sem = "_get_playwright_sem()" in seg or "PLAYWRIGHT_SEMAPHORE.acquire" in seg
            if takes_sem and "begin_place_access" not in seg and "begin_search_access" not in seg:
                missing.append(f"{rel}:{fn.lineno} {fn.name}")
    assert not missing, missing
