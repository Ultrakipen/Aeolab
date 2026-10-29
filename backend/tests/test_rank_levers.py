"""키워드 순위 측정: 프록시 범위 연결과 '모바일만' 레버 (2026-10-29)."""
import asyncio
import inspect

import services.naver_keyword_rank as nkr


def test_mobile_only_flag_parsing(monkeypatch):
    for v, expected in (("true", True), ("TRUE", True), (" true ", True), ("false", False), ("", False), ("1", False), ("yes", False)):
        monkeypatch.setenv("NAVER_RANK_MOBILE_ONLY", v)
        assert nkr.mobile_only_enabled() is expected, v
    monkeypatch.delenv("NAVER_RANK_MOBILE_ONLY", raising=False)
    assert nkr.mobile_only_enabled() is False            # 기본은 꺼짐 — 현재 동작 그대로


def test_rank_measurement_uses_search_proxy_scope():
    """키워드 순위 측정만 프록시 인자가 없던 구멍을 막는다 — 다른 검색 접속과 같은 'search' 범위를 따라야 한다."""
    src = inspect.getsource(nkr._run_with_browser)
    assert 'get_proxy_config("search")' in src
    assert "proxy=_proxy" in src
    assert "note_proxy_result(e)" in src


def test_no_proxy_pool_means_direct_connection(monkeypatch):
    monkeypatch.delenv("NAVER_PROXY_LIST", raising=False)
    from services import ai_scanner
    assert ai_scanner.get_proxy_config("search") is None


def _run(monkeypatch, mobile_only, calls):
    """브라우저 없이 _run_with_browser의 키워드 루프만 검증한다(PC/모바일 측정 함수를 가짜로 바꾼다)."""
    class _Ctx:
        async def new_page(self): return object()
    class _Browser:
        async def new_context(self, **_k): return _Ctx()
        async def close(self): pass
    class _Chromium:
        async def launch(self, **kw):
            calls["launch"] = kw
            return _Browser()
    class _PW:
        chromium = _Chromium()
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False

    async def fake_pc(*_a, **_k):
        calls["pc"] = calls.get("pc", 0) + 1
        return 3

    async def fake_mobile(*_a, **_k):
        calls["mobile"] = calls.get("mobile", 0) + 1
        return 2

    async def fake_place(*_a, **_k):
        return 1

    monkeypatch.setenv("NAVER_RANK_MOBILE_ONLY", "true" if mobile_only else "false")
    monkeypatch.setattr(nkr, "async_playwright", lambda: _PW())
    monkeypatch.setattr(nkr, "_measure_pc", fake_pc)
    monkeypatch.setattr(nkr, "_measure_mobile", fake_mobile)
    monkeypatch.setattr(nkr, "_measure_place_api", fake_place)
    monkeypatch.setattr(nkr, "check_naver_playwright_quota", lambda *_a, **_k: True)
    monkeypatch.setattr(nkr, "_card_cache_get", lambda *_a, **_k: None)
    monkeypatch.setattr(nkr, "_card_seen", lambda *_a, **_k: False)
    import services.naver_access_guard as g
    monkeypatch.setattr(g, "begin_search_access", lambda *_a, **_k: (True, ""))
    return asyncio.run(nkr._run_with_browser(["카페"], "테스트카페", "123", "성동구"))


def test_default_measures_pc_and_mobile(monkeypatch):
    calls: dict = {}
    r = _run(monkeypatch, False, calls)
    assert calls["pc"] == 1 and calls["mobile"] == 1
    assert r["카페"]["pc_rank"] == 3 and r["카페"]["mobile_rank"] == 2
    assert r["_context"]["device"] == "PC+mobile+place"


def test_mobile_only_skips_pc_and_marks_it_unmeasured(monkeypatch):
    calls: dict = {}
    r = _run(monkeypatch, True, calls)
    assert calls.get("pc", 0) == 0 and calls["mobile"] == 1
    assert r["카페"]["pc_rank"] is None and "error" not in r["카페"]       # 미측정이지 오류·미노출이 아니다
    assert r["카페"]["mobile_rank"] == 2 and r["카페"]["place_rank"] == 1
    assert r["_context"]["device"] == "mobile+place"


def test_proxy_is_passed_to_browser_launch(monkeypatch):
    calls: dict = {}
    fake = {"server": "http://proxy.example:8000", "username": "u", "password": "p"}
    monkeypatch.setattr(nkr, "get_proxy_config", lambda scope="": fake if scope == "search" else None)
    _run(monkeypatch, False, calls)
    assert calls["launch"]["proxy"] == fake
    calls2: dict = {}
    monkeypatch.setattr(nkr, "get_proxy_config", lambda scope="": None)
    _run(monkeypatch, False, calls2)
    assert calls2["launch"]["proxy"] is None
