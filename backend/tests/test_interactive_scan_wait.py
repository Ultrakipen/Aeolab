"""사용자가 기다리는 수동 측정의 대기 시간 보호 테스트 — 2026-10-30.

배경: 호출 간격 제한(GEMINI_MIN_INTERVAL=4.5초) 아래에서 Gemini 100표본을 그대로 돌리면 7.5분이 걸리는데, 클라이언트(ScanProgress.tsx)는
90초가 지나면 오류로 처리한다. 수동 측정은 Gemini 표본을 시간 예산에 맞추고 다른 채널과 동시에 돌린다. 정기 스캔은 그대로 100표본.
"""
import asyncio
import inspect
import os
import time
from types import SimpleNamespace

os.environ.setdefault("GEMINI_API_KEY", "test-key-not-used")
os.environ.setdefault("OPENAI_API_KEY", "test-key-not-used")

import pytest  # noqa: E402

from services.ai_scanner import gemini_scanner as gm  # noqa: E402
from services.ai_scanner import multi_scanner as ms  # noqa: E402

_REAL_SLEEP = asyncio.sleep


def _run(coro):
    return asyncio.run(coro)


# ── interactive_sample_count ──
def test_sample_count_is_full_when_no_pacing(monkeypatch):
    monkeypatch.setattr(gm, "GEMINI_MIN_INTERVAL", 0.0)
    assert gm.interactive_sample_count(100) == 100 and gm.interactive_sample_count(50) == 50


def test_sample_count_fits_time_budget_when_paced(monkeypatch):
    monkeypatch.setattr(gm, "GEMINI_MIN_INTERVAL", 4.5)
    monkeypatch.setattr(gm, "GEMINI_INTERACTIVE_BUDGET_SEC", 45.0)
    assert gm.interactive_sample_count(100) == 10            # 45초 ÷ 4.5초
    monkeypatch.setattr(gm, "GEMINI_MIN_INTERVAL", 0.5)
    assert gm.interactive_sample_count(100) == 90
    assert gm.interactive_sample_count(50) == 50              # default를 넘기지 않는다


def test_sample_count_never_below_floor(monkeypatch):
    monkeypatch.setattr(gm, "GEMINI_MIN_INTERVAL", 30.0)
    monkeypatch.setattr(gm, "GEMINI_INTERACTIVE_BUDGET_SEC", 45.0)
    assert gm.interactive_sample_count(100) == gm.GEMINI_INTERACTIVE_MIN_SAMPLES


# ── deadline_sec ──
def test_deadline_stops_launching_new_batches_and_returns_partial(monkeypatch):
    sc = gm.GeminiScanner()
    calls = []

    async def fake_once(q):
        calls.append(q)
        await _REAL_SLEEP(0.12)
        return {"places": ["A"], "_measured": True}

    monkeypatch.setattr(sc, "_recommend_once", fake_once)
    monkeypatch.setattr(gm, "GEMINI_BATCH_SIZE", 5)
    monkeypatch.setattr(gm, "GEMINI_BATCH_SLEEP", 0.0)
    r = _run(sc.sample_recommend("q", "x", n=40, deadline_sec=0.2))
    assert 5 <= len(calls) < 40 and r["sample_size"] == len(calls)   # 첫 배치는 항상, 예산이 지나면 멈춘다
    assert r["failed_count"] == 40 - len(calls)                       # 모자란 표본은 숨기지 않고 드러난다


def test_no_deadline_runs_everything(monkeypatch):
    sc = gm.GeminiScanner()

    async def fake_once(q):
        return {"places": [], "_measured": True}

    monkeypatch.setattr(sc, "_recommend_once", fake_once)
    monkeypatch.setattr(gm, "GEMINI_BATCH_SLEEP", 0.0)
    assert _run(sc.sample_recommend("q", "x", n=25))["sample_size"] == 25


# ── scan_with_progress: Gemini는 나머지와 동시에 ──
def _scanner(monkeypatch, gemini_delay=0.6, other_delay=0.2, gemini_boom=False):
    sc = ms.MultiAIScanner(mode="full")
    state = {"gemini_cancelled": False, "gemini_n": None}

    async def gem(queries, target, n=50, deadline_sec=None):
        state["gemini_n"] = n
        try:
            await _REAL_SLEEP(gemini_delay)
        except asyncio.CancelledError:
            state["gemini_cancelled"] = True
            raise
        if gemini_boom:
            raise RuntimeError("gemini down")
        return {"platform": "gemini", "sample_size": n, "probe": "recommend_v1"}

    async def other(*a, **k):
        await _REAL_SLEEP(other_delay)
        return {"ok": True}

    monkeypatch.setattr(sc.gemini, "sample_recommend", gem)
    monkeypatch.setattr(sc.chatgpt, "sample_100", other)
    monkeypatch.setattr(sc.naver, "check_mention_multi", other)
    monkeypatch.setattr(sc.google, "check_mention", other)

    async def fast_sleep(d, *a, **k):   # 채널 사이의 2초 간격만 줄인다
        await _REAL_SLEEP(min(d, 0.01))

    monkeypatch.setattr(ms.asyncio, "sleep", fast_sleep)
    monkeypatch.setattr(gm, "GEMINI_MIN_INTERVAL", 4.5)
    monkeypatch.setattr(gm, "GEMINI_INTERACTIVE_BUDGET_SEC", 45.0)
    return sc, state


REQ = SimpleNamespace(region="창원", category="restaurant", keywords=["한식"], business_name="내가게", business_type="location_based")


async def _collect(sc):
    events = []
    async for ev in sc.scan_with_progress(REQ):
        events.append(ev)
    return events


def test_manual_scan_runs_gemini_concurrently_not_in_sequence(monkeypatch):
    sc, state = _scanner(monkeypatch)
    t = time.monotonic()
    events = _run(_collect(sc))
    elapsed = time.monotonic() - t
    assert elapsed < 0.9   # 직렬이면 0.6 + 0.2×3 = 1.2초 이상 — Gemini·ChatGPT 모두 Playwright 채널과 동시에
    steps = [(e["step"], e["status"]) for e in events]
    assert steps[0] == ("gemini", "running") and steps[-1] == ("complete", "done")
    assert ("gemini", "done") in steps and steps.index(("gemini", "done")) > steps.index(("google", "done"))
    assert ("chatgpt", "done") in steps and steps.index(("chatgpt", "running")) < steps.index(("naver", "running"))
    assert state["gemini_n"] == 10   # 4.5초 간격이면 45초 예산에 맞춘 표본 수


def test_progress_never_goes_backwards_after_the_first_event(monkeypatch):
    sc, _ = _scanner(monkeypatch)
    events = _run(_collect(sc))
    prog = [e["progress"] for e in events if e["status"] == "done" or e["step"] == "complete"]
    assert prog == sorted(prog) and prog[-1] == 100


def test_gemini_failure_is_reported_and_scan_still_completes(monkeypatch):
    sc, _ = _scanner(monkeypatch, gemini_boom=True)
    events = _run(_collect(sc))
    gem = [e for e in events if e["step"] == "gemini" and e["status"] == "error"]
    assert gem and events[-1]["step"] == "complete"


def test_gemini_task_is_cancelled_when_client_disconnects(monkeypatch):
    sc, state = _scanner(monkeypatch, gemini_delay=5.0)

    async def go():
        agen = sc.scan_with_progress(REQ)
        await agen.__anext__()          # gemini running
        await agen.__anext__()          # chatgpt running
        await _REAL_SLEEP(0.05)         # Gemini 태스크가 실제로 돌기 시작한 뒤(실제 상황)에 끊는다
        await agen.aclose()             # 클라이언트가 먼저 끊음
        await _REAL_SLEEP(0.05)
        # asyncio.run이 종료 때 남은 태스크를 취소하기 전에, 끊은 직후에 이미 취소돼 있어야 한다
        assert state["gemini_cancelled"] is True

    _run(go())


# ── 호출 구조 ──
def test_trial_background_scan_uses_interactive_gemini_count_but_nightly_does_not():
    import pathlib
    root = pathlib.Path(__file__).resolve().parents[1]
    scan_src = (root / "routers/scan.py").read_text(encoding="utf-8")
    assert "gemini_sample_size=interactive_sample_count(50)" in scan_src
    jobs_src = (root / "scheduler/jobs.py").read_text(encoding="utf-8")
    assert "interactive_sample_count" not in jobs_src   # 정기 스캔은 100표본 그대로
    assert "gemini_sample_size or sample_size" in inspect.getsource(ms.MultiAIScanner.scan_all)


# ── 실제 사용 경로: /api/scan/stream → scan_quick_with_progress ──
def _quick(monkeypatch, gemini_delay=0.6, other_delay=0.2, gemini_boom=False):
    sc = ms.MultiAIScanner(mode="quick")
    state = {"gemini_cancelled": False}

    async def g10(query, target):
        try:
            await _REAL_SLEEP(gemini_delay)
        except asyncio.CancelledError:
            state["gemini_cancelled"] = True
            raise
        if gemini_boom:
            raise RuntimeError("gemini down")
        return {"platform": "gemini", "sample_size": 10, "probe": "recommend_v1"}

    async def other(*a, **k):
        await _REAL_SLEEP(other_delay)
        return {"ok": True}

    monkeypatch.setattr(sc.gemini, "sample_10", g10)
    monkeypatch.setattr(sc.chatgpt, "sample_5", other)
    monkeypatch.setattr(sc.naver, "check_mention_multi", other)
    monkeypatch.setattr(sc.google, "check_mention", other)

    async def fast_sleep(d, *a, **k):
        await _REAL_SLEEP(min(d, 0.01))

    monkeypatch.setattr(ms.asyncio, "sleep", fast_sleep)
    return sc, state


async def _collect_quick(sc):
    return [ev async for ev in sc.scan_quick_with_progress(REQ)]


def test_quick_scan_used_by_dashboard_runs_api_channels_concurrently(monkeypatch):
    sc, _ = _quick(monkeypatch)
    t = time.monotonic()
    events = _run(_collect_quick(sc))
    assert time.monotonic() - t < 0.9   # 직렬이면 0.6 + 0.2×3 = 1.2초 이상
    steps = [(e["step"], e["status"]) for e in events]
    assert steps[0] == ("gemini", "running") and steps[-1] == ("complete", "done")
    assert {("gemini", "done"), ("chatgpt", "done"), ("naver", "done"), ("google", "done")} <= set(steps)
    prog = [e["progress"] for e in events if e["status"] == "done" or e["step"] == "complete"]
    assert prog == sorted(prog) and prog[-1] == 100


def test_quick_scan_gemini_failure_is_reported_and_scan_completes(monkeypatch):
    sc, _ = _quick(monkeypatch, gemini_boom=True)
    events = _run(_collect_quick(sc))
    assert any(e["step"] == "gemini" and e["status"] == "error" for e in events) and events[-1]["step"] == "complete"


def test_quick_scan_cancels_background_calls_on_disconnect(monkeypatch):
    sc, state = _quick(monkeypatch, gemini_delay=5.0)

    async def go():
        agen = sc.scan_quick_with_progress(REQ)
        await agen.__anext__()
        await agen.__anext__()
        await _REAL_SLEEP(0.05)
        await agen.aclose()
        await _REAL_SLEEP(0.05)
        assert state["gemini_cancelled"] is True

    _run(go())


def test_stream_route_uses_the_quick_generator_not_the_dead_one():
    import pathlib
    src = (pathlib.Path(__file__).resolve().parents[1] / "routers" / "scan.py").read_text(encoding="utf-8")
    assert "scanner.scan_quick_with_progress(req)" in src


# ── 완료 시간 상한: 다른 사용자 호출 뒤에 줄을 서도 90초 안전망에 걸리지 않는다 ──
def test_quick_scan_gives_up_on_a_slow_api_channel_and_still_completes(monkeypatch):
    sc, state = _quick(monkeypatch, gemini_delay=3.0)
    monkeypatch.setattr(ms, "QUICK_SCAN_API_DEADLINE_SEC", 0.4)
    t = time.monotonic()
    events = _run(_collect_quick(sc))
    assert time.monotonic() - t < 1.5                       # 3초짜리 Gemini를 끝까지 기다리지 않는다
    gem = [e for e in events if e["step"] == "gemini" and e["status"] == "error"]
    assert gem and gem[0]["error"] == "timeout"             # 실패로 드러난다(0으로 위장하지 않는다)
    assert events[-1]["step"] == "complete"
    assert any(e["step"] == "chatgpt" and e["status"] == "done" for e in events)   # 다른 채널 결과는 그대로
    assert state["gemini_cancelled"] is True                # 시간 초과한 호출은 멈춘다


def test_slow_channel_error_event_carries_no_result():
    """라우트는 done+result만 저장하므로 시간 초과 채널은 저장되지 않고 점수에서 제외된다(기존 실패 처리와 같은 경로)."""
    import pathlib
    src = (pathlib.Path(__file__).resolve().parents[1] / "routers" / "scan.py").read_text(encoding="utf-8")
    assert 'progress.get("status") == "done" and "result" in progress' in src
