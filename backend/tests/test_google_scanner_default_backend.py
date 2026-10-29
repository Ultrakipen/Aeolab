"""구글 스캐너 기본값 안전성 회귀 테스트 (2026-10-30).

환경변수 GOOGLE_SCANNER_BACKEND가 빠진 배포에서 서버가 google.com에 Playwright로 직접 접속하면
CAPTCHA/IP 차단을 맞는다. 미설정이면 접속하지 않고 error로 "측정 불가"를 돌려줘야 하며,
점수 계산(_is_google_unmeasured)이 이를 0점이 아니라 제외로 처리해야 한다.
"""
import asyncio
import importlib
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _reload_scanner(monkeypatch, value):
    if value is None:
        monkeypatch.delenv("GOOGLE_SCANNER_BACKEND", raising=False)
    else:
        monkeypatch.setenv("GOOGLE_SCANNER_BACKEND", value)
    from services.ai_scanner import google_scanner
    return importlib.reload(google_scanner)


def _forbid_browser(monkeypatch, mod):
    def _boom(*a, **k):
        raise AssertionError("미설정인데 Playwright로 구글에 직접 접속하려 했다")
    monkeypatch.setattr(mod, "async_playwright", _boom)


@pytest.mark.parametrize("value", [None, "", "  ", "unknown"])
def test_unset_backend_does_not_open_browser(monkeypatch, value):
    mod = _reload_scanner(monkeypatch, value)
    _forbid_browser(monkeypatch, mod)
    r = asyncio.run(mod.GoogleAIOverviewScanner().check_mention("창원 카페 추천", "테스트"))
    assert r["error"] == "backend_not_configured"
    assert r["mentioned"] is False and r["captcha_detected"] is False


def test_unset_result_is_treated_as_unmeasured_not_zero(monkeypatch):
    mod = _reload_scanner(monkeypatch, None)
    _forbid_browser(monkeypatch, mod)
    r = asyncio.run(mod.GoogleAIOverviewScanner().check_mention("q", "t"))
    from services.score_engine import _is_google_unmeasured
    assert _is_google_unmeasured({"google": r}) is True


def test_explicit_playwright_still_selected(monkeypatch):
    """명시적으로 playwright를 지정하면 기존 동작(브라우저 경로)을 유지한다."""
    mod = _reload_scanner(monkeypatch, "playwright")
    called = {}

    def _fake(*a, **k):
        called["yes"] = True
        raise RuntimeError("stop")
    monkeypatch.setattr(mod, "async_playwright", _fake)
    with pytest.raises(RuntimeError):
        asyncio.run(mod.GoogleAIOverviewScanner().check_mention("q", "t"))
    assert called.get("yes") is True
