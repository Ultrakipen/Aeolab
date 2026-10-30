"""Gemini 호출 속도 제한(_throttle) 회귀 테스트 — 2026-10-30.

무료 등급은 분당 약 15회 제한이라 동시 10개를 몰아 보내면 429가 난다. 프로세스 전체 호출 시작 시각을 일정 간격으로 배정한다.
"""
import asyncio
import inspect
import os
import re

os.environ.setdefault("GEMINI_API_KEY", "test-key-not-used")

from services.ai_scanner import gemini_scanner  # noqa: E402


def _run(coro):
    return asyncio.run(coro)


def test_throttle_spaces_concurrent_calls(monkeypatch):
    monkeypatch.setattr(gemini_scanner, "GEMINI_MIN_INTERVAL", 4.5)
    monkeypatch.setattr(gemini_scanner, "_next_slot", 0.0)
    sleeps = []
    real_sleep = asyncio.sleep

    async def rec_sleep(d, *a, **k):
        sleeps.append(round(d, 1))
        await real_sleep(0)

    monkeypatch.setattr(gemini_scanner.asyncio, "sleep", rec_sleep)

    async def go():
        await asyncio.gather(*[gemini_scanner._throttle() for _ in range(4)])

    _run(go())
    # 첫 호출은 즉시, 이후 4.5초 간격으로 대기가 배정된다
    assert sorted(sleeps) == [4.5, 9.0, 13.5]


def test_throttle_disabled_by_default(monkeypatch):
    monkeypatch.setattr(gemini_scanner, "GEMINI_MIN_INTERVAL", 0.0)
    monkeypatch.setattr(gemini_scanner, "_next_slot", 0.0)

    async def go():
        await asyncio.gather(*[gemini_scanner._throttle() for _ in range(10)])

    _run(go())  # 대기 없이 즉시 끝나야 한다(기본값은 기존 동작 불변)


def test_every_generate_call_is_throttled():
    src = inspect.getsource(gemini_scanner)
    lines = src.split("\n")
    sites = [i for i, l in enumerate(lines) if "self.model.generate_content" in l and "def " not in l]
    assert len(sites) >= 6
    for i in sites:
        window = "\n".join(lines[max(0, i - 3):i + 1])
        assert "await _throttle()" in window, f"throttle 누락: {lines[i].strip()}"


def test_scan_by_keywords_query_has_no_business_name(monkeypatch):
    sc = gemini_scanner.GeminiScanner()
    seen = []

    async def fake(query, target, n=100):
        seen.append(query)
        return {"exposure_freq": 0, "exposure_rate": 0.0, "confidence": {}}

    monkeypatch.setattr(sc, "sample_100", lambda q, t: fake(q, t))
    _run(sc.scan_by_keywords({"region": "창원", "name": "하라식당"}, ["한식"]))
    assert seen and all("하라식당" not in q for q in seen)


def test_blog_topics_does_not_use_retired_model():
    import pathlib
    src = pathlib.Path(__file__).resolve().parents[1].joinpath("routers", "guide.py").read_text(encoding="utf-8")
    assert "models/gemini-2.0-flash" not in src
    assert re.search(r"models/\{GEMINI_MODEL\}", src)
