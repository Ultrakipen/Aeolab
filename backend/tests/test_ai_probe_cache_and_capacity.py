"""질의 결과 공유 캐시(probe_cache)와 Gemini 호출량 점검(ai_capacity) 테스트 — 2026-10-30."""
import asyncio
import inspect
import os

os.environ.setdefault("GEMINI_API_KEY", "test-key-not-used")
os.environ.setdefault("OPENAI_API_KEY", "test-key-not-used")

import pytest  # noqa: E402

from services import ai_capacity  # noqa: E402
from services.ai_scanner import probe_cache  # noqa: E402
from services.ai_scanner.chatgpt_scanner import ChatGPTScanner  # noqa: E402
from services.ai_scanner.gemini_scanner import GeminiScanner  # noqa: E402


def _run(coro):
    return asyncio.run(coro)


@pytest.fixture(autouse=True)
def _clean(monkeypatch):
    probe_cache.reset()
    monkeypatch.delenv("AI_PROBE_CACHE_TTL_SEC", raising=False)

    async def no_sleep(*a, **k):
        return None

    monkeypatch.setattr(asyncio, "sleep", no_sleep)
    yield
    probe_cache.reset()


def _scanner(cls, monkeypatch, places_by_query):
    sc = cls()
    calls = []

    async def fake_once(query):
        calls.append(query)
        return {"places": list(places_by_query.get(query, [])), "_measured": True}

    monkeypatch.setattr(sc, "_recommend_once", fake_once)
    return sc, calls


@pytest.mark.parametrize("cls", [ChatGPTScanner, GeminiScanner])
def test_cache_off_by_default_calls_every_time(monkeypatch, cls):
    sc, calls = _scanner(cls, monkeypatch, {"q": ["A", "내가게"]})
    _run(sc.sample_recommend("q", "내가게", n=6))
    _run(sc.sample_recommend("q", "다른가게", n=6))
    assert len(calls) == 12


@pytest.mark.parametrize("cls", [ChatGPTScanner, GeminiScanner])
def test_cache_on_shares_samples_across_businesses(monkeypatch, cls):
    monkeypatch.setenv("AI_PROBE_CACHE_TTL_SEC", "3600")
    sc, calls = _scanner(cls, monkeypatch, {"q": ["A", "내가게", "B"]})
    r1 = _run(sc.sample_recommend("q", "내가게", n=6))
    r2 = _run(sc.sample_recommend("q", "A", n=6))     # 같은 질의, 다른 가게
    assert len(calls) == 6                              # 두 번째는 호출 없음
    assert r1["exposure_freq"] == 6 and r1["avg_rank"] == 2.0
    assert r2["exposure_freq"] == 6 and r2["avg_rank"] == 1.0   # 가게별로 따로 대조된다
    assert r2["sample_size"] == 6
    snap = probe_cache.snapshot()
    assert snap["hit_samples"] == 6 and snap["miss_samples"] == 6 and snap["hit_rate"] == 0.5


def test_cache_fetches_only_missing_samples(monkeypatch):
    monkeypatch.setenv("AI_PROBE_CACHE_TTL_SEC", "3600")
    sc, calls = _scanner(GeminiScanner, monkeypatch, {"q": ["A"]})
    _run(sc.sample_recommend("q", "x", n=4))
    _run(sc.sample_recommend("q", "x", n=10))
    assert len(calls) == 10   # 4 + 부족분 6


def test_failed_samples_are_not_cached(monkeypatch):
    monkeypatch.setenv("AI_PROBE_CACHE_TTL_SEC", "3600")
    sc = GeminiScanner()
    n_calls = []

    async def fake_once(query):
        n_calls.append(1)
        return {"places": [], "_measured": False, "_error": "429"}

    monkeypatch.setattr(sc, "_recommend_once", fake_once)
    r = _run(sc.sample_recommend("q", "x", n=3))
    _run(sc.sample_recommend("q", "x", n=3))
    assert r["sample_size"] == 0 and len(n_calls) == 6   # 실패는 재사용하지 않고 다시 시도한다


def test_cache_key_includes_model(monkeypatch):
    monkeypatch.setenv("AI_PROBE_CACHE_TTL_SEC", "3600")
    from services.ai_scanner import gemini_scanner
    sc, calls = _scanner(GeminiScanner, monkeypatch, {"q": ["A"]})
    _run(sc.sample_recommend("q", "x", n=3))
    monkeypatch.setattr(gemini_scanner, "GEMINI_MODEL", "other-model")
    _run(sc.sample_recommend("q", "x", n=3))
    assert len(calls) == 6   # 모델이 바뀌면 캐시를 쓰지 않는다


def test_cache_expires(monkeypatch):
    monkeypatch.setenv("AI_PROBE_CACHE_TTL_SEC", "3600")
    sc, calls = _scanner(ChatGPTScanner, monkeypatch, {"q": ["A"]})
    _run(sc.sample_recommend("q", "x", n=3))
    t = probe_cache.time.monotonic()
    monkeypatch.setattr(probe_cache.time, "monotonic", lambda: t + 7200)
    _run(sc.sample_recommend("q", "x", n=3))
    assert len(calls) == 6


def test_cache_does_not_leak_between_mutations_of_results(monkeypatch):
    monkeypatch.setenv("AI_PROBE_CACHE_TTL_SEC", "3600")
    sc, _ = _scanner(GeminiScanner, monkeypatch, {"q": ["A", "B"]})
    _run(sc.sample_recommend("q", "x", n=2))
    got, _todo = probe_cache.plan("gemini:" + __import__("services.ai_scanner.gemini_scanner", fromlist=["x"]).GEMINI_MODEL, ["q"], 2)
    got[0]["places"].append("오염")
    got2, _ = probe_cache.plan("gemini:" + __import__("services.ai_scanner.gemini_scanner", fromlist=["x"]).GEMINI_MODEL, ["q"], 2)
    assert "오염" not in got2[0]["places"]


def test_both_scanners_use_cache_in_recommend_only():
    for cls in (ChatGPTScanner, GeminiScanner):
        rec = inspect.getsource(cls.sample_recommend)
        assert "probe_cache.plan(" in rec and "probe_cache.store(" in rec
        assert "probe_cache" not in inspect.getsource(cls.sample_n)   # 유도형 sample_n에는 적용하지 않는다


# ── ai_capacity ──
def test_usage_level_thresholds():
    assert ai_capacity.usage_level(349, 500) is None
    assert ai_capacity.usage_level(350, 500) == "70%"
    assert ai_capacity.usage_level(450, 500) == "90%"
    assert ai_capacity.usage_level(500, 500) == "100%"


def test_split_counts_separates_failures():
    rows = [{"purpose": "scan_recommend"}, {"purpose": "scan_recommend:FAILED:TimeoutError"}, {"purpose": "scan_check"}]
    assert ai_capacity.split_counts(rows) == (2, 1)


def test_next_steps_grow_with_usage():
    assert [s["from_pct"] for s in ai_capacity.next_steps(75)] == [70]
    assert [s["from_pct"] for s in ai_capacity.next_steps(100)] == [70, 90, 100]
    assert ai_capacity.next_steps(50) == []


def test_limit_env_override_and_bad_value(monkeypatch):
    monkeypatch.setenv("GEMINI_DAILY_LIMIT", "1500")
    assert ai_capacity.gemini_daily_limit() == 1500
    monkeypatch.setenv("GEMINI_DAILY_LIMIT", "abc")
    assert ai_capacity.gemini_daily_limit() == 500


def test_job_registered_and_uses_snapshot():
    from scheduler import jobs
    src = inspect.getsource(jobs)
    assert "ai_capacity_check_job, \"cron\", hour=9, minute=50" in src
    assert "gemini_usage_snapshot" in inspect.getsource(jobs.ai_capacity_check_job)
