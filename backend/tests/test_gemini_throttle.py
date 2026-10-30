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


# ── 대기열 상한(GeminiBusy) — 과부하 방지 ──
def test_throttle_gives_up_when_queue_too_long(monkeypatch):
    monkeypatch.setattr(gemini_scanner, "GEMINI_MIN_INTERVAL", 4.5)
    monkeypatch.setattr(gemini_scanner, "GEMINI_MAX_WAIT_SEC", 10.0)
    monkeypatch.setattr(gemini_scanner, "_next_slot", 0.0)

    async def no_sleep(*a, **k):
        return None

    monkeypatch.setattr(gemini_scanner.asyncio, "sleep", no_sleep)

    async def go():
        return await asyncio.gather(*[gemini_scanner._throttle() for _ in range(5)], return_exceptions=True)

    res = _run(go())
    busy = [r for r in res if isinstance(r, gemini_scanner.GeminiBusy)]
    assert len(busy) == 2 and len(res) - len(busy) == 3   # 대기 0·4.5·9초는 통과, 13.5초부터 포기


def test_busy_does_not_advance_slot(monkeypatch):
    monkeypatch.setattr(gemini_scanner, "GEMINI_MIN_INTERVAL", 4.5)
    monkeypatch.setattr(gemini_scanner, "GEMINI_MAX_WAIT_SEC", 5.0)
    t = gemini_scanner.time.monotonic()
    monkeypatch.setattr(gemini_scanner, "_next_slot", t + 60)   # 이미 1분치 쌓임
    before = gemini_scanner._next_slot

    async def go():
        try:
            await gemini_scanner._throttle()
        except gemini_scanner.GeminiBusy:
            return True
        return False

    assert _run(go()) is True
    assert gemini_scanner._next_slot == before   # 포기한 호출은 슬롯을 예약하지 않는다


def test_busy_call_is_unmeasured_and_not_logged(monkeypatch):
    sc = gemini_scanner.GeminiScanner()
    logged = []
    monkeypatch.setattr(gemini_scanner, "log_ai_usage", lambda *a, **k: logged.append(a))

    async def busy(*a, **k):
        raise gemini_scanner.GeminiBusy("full")

    monkeypatch.setattr(gemini_scanner, "_throttle", busy)
    r = _run(sc._recommend_once("q"))
    assert r["_measured"] is False and logged == []   # 분모 제외 + 한도 집계에 안 센다


def test_quick_scan_sample_10_is_unguided(monkeypatch):
    sc = gemini_scanner.GeminiScanner()
    calls = []

    async def fake_once(query):
        calls.append(query)
        return {"places": ["A"], "_measured": True}

    async def no_sleep(*a, **k):
        return None

    monkeypatch.setattr(sc, "_recommend_once", fake_once)
    monkeypatch.setattr(gemini_scanner.asyncio, "sleep", no_sleep)
    r = _run(sc.sample_10("창원 한식 추천", "하라식당"))
    assert r["probe"] == "recommend_v1" and len(calls) == 10 and all("하라식당" not in q for q in calls)


def test_blog_topics_call_is_throttled_with_short_wait_and_logged():
    import pathlib
    src = pathlib.Path(__file__).resolve().parents[1].joinpath("routers", "guide.py").read_text(encoding="utf-8")
    assert "_throttle(max_wait=10)" in src and '"blog_topics"' in src
