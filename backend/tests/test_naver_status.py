"""사용자에게 보이는 네이버 확인 상태 (2026-10-29)."""
import json

import pytest

from services import naver_access_guard as g
from services import naver_status as ns


@pytest.fixture(autouse=True)
def _clean(tmp_path, monkeypatch):
    monkeypatch.setenv("NAVER_PLACE_BREAKER_FILE", str(tmp_path / "place.json"))
    monkeypatch.setenv("NAVER_SEARCH_BREAKER_FILE", str(tmp_path / "search.json"))
    monkeypatch.setenv("NAVER_RATE_WINDOW_FILE", str(tmp_path / "rate.json"))
    g.reset_for_tests()
    g.reset_search_for_tests()
    g.reset_rate_for_tests()
    yield
    g.reset_for_tests()
    g.reset_search_for_tests()


def _ok_quota(monkeypatch, used=0, cap=250):
    import services.ai_scanner as ai
    monkeypatch.setattr(ai, "naver_playwright_quota_usage", lambda: (used, cap))


def test_normal_state_shows_nothing(monkeypatch):
    _ok_quota(monkeypatch)
    s = ns.user_status(1000.0)
    assert s["state"] == "ok" and s["message"] == "" and s["eta_label"] is None


def test_search_cooldown_is_reported_with_a_rounded_eta(monkeypatch):
    _ok_quota(monkeypatch)
    g.report_search_block("test", now=1000.0)               # 첫 차단: 60분
    s = ns.user_status(1000.0 + 600)                        # 10분 경과 → 50분 남음
    assert s["state"] == "delayed" and s["reason"] == "cooldown"
    assert s["eta_label"] == "약 50분 뒤" and "지연" in s["message"] and "50분" in s["message"]


def test_place_cooldown_uses_hours(monkeypatch):
    _ok_quota(monkeypatch)
    g.report_place_block("test", now=1000.0)                # 첫 차단: 180분
    s = ns.user_status(1000.0 + 60)
    assert s["state"] == "delayed" and s["eta_label"] == "약 3시간 뒤"


def test_the_longer_cooldown_wins(monkeypatch):
    _ok_quota(monkeypatch)
    g.report_search_block("t", now=1000.0)                  # 60분
    g.report_place_block("t", now=1000.0)                   # 180분
    assert ns.user_status(1000.0)["eta_label"] == "약 3시간 뒤"


def test_after_cooldown_without_confirmation_is_recovering_not_delayed(monkeypatch):
    _ok_quota(monkeypatch)
    g.report_search_block("t", now=1000.0)
    s = ns.user_status(1000.0 + 3 * 3600)                   # 쿨다운(60분)은 끝났지만 아직 정상 확인 전
    assert s["state"] == "recovering" and s["resume_in_sec"] is None


def test_daily_cap_says_tomorrow_without_exposing_numbers(monkeypatch):
    _ok_quota(monkeypatch, used=250, cap=250)
    s = ns.user_status(1000.0)
    assert s["state"] == "delayed" and s["reason"] == "daily_limit" and s["eta_label"] == "내일"
    blob = json.dumps(s, ensure_ascii=False)
    assert "250" not in blob and "상한" not in blob and "한도" not in blob     # 운영 수치·용어는 노출하지 않는다


def test_public_payload_never_leaks_internal_state(monkeypatch):
    _ok_quota(monkeypatch)
    g.report_place_block("naver_place_stats.fetch_stats", now=1000.0)
    blob = json.dumps(ns.user_status(1000.0), ensure_ascii=False)
    for forbidden in ("strikes", "open_until", "naver_place_stats", "source", "probing", "cooldown_sec"):
        assert forbidden not in blob


@pytest.mark.parametrize("sec,expected", [
    (0, "곧"), (1, "약 10분 뒤"), (601, "약 20분 뒤"), (3600, "약 60분 뒤"),
    (3700, "약 1시간 뒤"), (5400, "약 2시간 뒤"), (3 * 3600, "약 3시간 뒤"), (24 * 3600, "약 24시간 뒤"),
])
def test_eta_label_rounding(sec, expected):
    assert ns.eta_label(sec) == expected


def test_endpoint_returns_ok_shape_even_if_state_read_fails(monkeypatch):
    import asyncio
    from fastapi import Response
    from routers import service_status as r
    monkeypatch.setattr(ns, "user_status", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom")))
    out = asyncio.run(r.naver_status(Response()))
    assert out["state"] == "ok" and out["message"] == ""


def test_router_is_registered_under_api_status():
    src = open("main.py", encoding="utf-8").read()
    assert 'include_router(service_status_router.router, prefix="/api/status"' in src
