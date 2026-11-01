"""Gemini 시간 초과 재시도 — 정기 스캔은 1회 재시도, 수동 측정(deadline_sec 지정)은 재시도 없음 (2026-11-01).

근거: 11-01 02:00 KST 야간 스캔 첫 10분에 같은 분 안에서 성공 64·시간 초과 34·한도 초과 11이 섞였다(ai_usage_log).
"""
import asyncio
import os

os.environ.setdefault("GEMINI_API_KEY", "test-key-not-used")
os.environ.setdefault("OPENAI_API_KEY", "test-key-not-used")

import pytest  # noqa: E402

from services.ai_scanner import gemini_scanner as gs  # noqa: E402
from services.ai_scanner import probe_cache  # noqa: E402


class _Resp:
    text = '{"places": ["내가게", "다른가게"]}'


def _scanner(monkeypatch, timeouts_before_ok):
    probe_cache.reset()
    sc = gs.GeminiScanner()
    state = {"calls": 0, "failures_logged": 0}

    async def no_throttle(*a, **k):
        return None

    async def no_sleep(*a, **k):
        return None

    async def fake_wait_for(coro, timeout):
        state["calls"] += 1
        res = await coro
        if state["calls"] <= timeouts_before_ok:
            raise asyncio.TimeoutError()
        return res

    monkeypatch.setattr(gs, "_throttle", no_throttle)
    monkeypatch.setattr(gs.asyncio, "sleep", no_sleep)
    monkeypatch.setattr(gs.asyncio, "wait_for", fake_wait_for)
    monkeypatch.setattr(sc, "model", type("M", (), {"generate_content": staticmethod(lambda p: _Resp())})())
    monkeypatch.setattr(sc, "_log_usage", lambda *a, **k: None)
    monkeypatch.setattr(sc, "_log_failure", lambda *a, **k: state.__setitem__("failures_logged", state["failures_logged"] + 1))
    return sc, state


def test_scheduled_scan_retries_a_timeout_once(monkeypatch):
    sc, state = _scanner(monkeypatch, timeouts_before_ok=1)
    r = asyncio.run(sc.sample_recommend("q", "내가게", n=1))
    assert state["calls"] == 2
    assert r["sample_size"] == 1 and r["failed_count"] == 0
    assert state["failures_logged"] == 0   # 재시도로 회복되면 실패로 기록하지 않는다


def test_scheduled_scan_gives_up_after_one_retry(monkeypatch):
    sc, state = _scanner(monkeypatch, timeouts_before_ok=99)
    r = asyncio.run(sc.sample_recommend("q", "내가게", n=1))
    assert state["calls"] == 2
    assert r["sample_size"] == 0 and r["failed_count"] == 1   # 실패는 분모에서 빠진다(미노출로 세지 않는다)
    assert state["failures_logged"] == 1


def test_interactive_measurement_does_not_retry(monkeypatch):
    """수동 측정은 90초 안전망 안에서 끝나야 하므로 시간 초과를 재시도하지 않는다."""
    sc, state = _scanner(monkeypatch, timeouts_before_ok=1)
    r = asyncio.run(sc.sample_recommend("q", "내가게", n=1, deadline_sec=45))
    assert state["calls"] == 1
    assert r["sample_size"] == 0 and r["failed_count"] == 1

