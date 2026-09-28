"""비유도형 추천 프로브(sample_recommend) 회귀 테스트 — 2026-09-28.

유도형(가게명을 프롬프트에 넣음)은 소규모·가짜 가게도 환각으로 "추천됨"이라 답해 노출률이 부풀었다
(실사업장 유료 스캔 43/100·95/100). 이 프로브는 가게명을 프롬프트에 넣지 않고 추천 목록에서 대조한다.
네트워크 호출 없이 _recommend_once를 대체해 분배·집계·이름 매칭만 검증한다.
"""
import asyncio
import os

os.environ.setdefault("OPENAI_API_KEY", "test-key-not-used")

from services.ai_scanner.chatgpt_scanner import ChatGPTScanner, names_match  # noqa: E402


def _run(coro):
    return asyncio.run(coro)


def _scanner(monkeypatch, answers):
    """answers: query -> places 리스트. 호출된 질의를 calls에 기록."""
    sc = ChatGPTScanner()
    calls = []

    async def fake_once(query):
        calls.append(query)
        return {"places": list(answers.get(query, [])), "_measured": True}

    async def no_sleep(_):
        return None

    monkeypatch.setattr(sc, "_recommend_once", fake_once)
    monkeypatch.setattr(asyncio, "sleep", no_sleep)
    return sc, calls


def test_queries_distributed_evenly(monkeypatch):
    sc, calls = _scanner(monkeypatch, {})
    r = _run(sc.sample_recommend(["q1", "q2", "q3"], "내가게", n=10))
    assert len(calls) == 10
    assert {q: calls.count(q) for q in ("q1", "q2", "q3")} == {"q1": 4, "q2": 3, "q3": 3}
    assert r["queries_used"] == ["q1", "q2", "q3"]
    assert r["sample_size"] == 10 and r["exposure_freq"] == 0 and r["mentioned"] is False


def test_target_name_never_sent_in_query(monkeypatch):
    sc, calls = _scanner(monkeypatch, {"창원 한식 추천": ["A식당", "B식당"]})
    _run(sc.sample_recommend("창원 한식 추천", "하라식당 본점", n=5))
    assert calls and all("하라식당" not in q for q in calls)


def test_mention_counted_only_when_target_in_list(monkeypatch):
    sc, _ = _scanner(monkeypatch, {"q": ["A", "내가게", "B"]})
    r = _run(sc.sample_recommend("q", "내가게", n=5))
    assert r["exposure_freq"] == 5 and r["avg_rank"] == 2.0 and r["mentioned"] is True
    assert r["citations"] and r["citations"][0].startswith("AI 추천 목록 — ")
    assert all(p["name"] != "내가게" for p in r["top_places"])  # 내 가게는 경쟁 후보에서 제외


def test_no_query_is_not_measured_as_zero(monkeypatch):
    sc, calls = _scanner(monkeypatch, {})
    r = _run(sc.sample_recommend([], "내가게", n=10))
    assert calls == [] and r["sample_size"] == 0 and r["error"] == "no_query"


def test_failed_samples_excluded_from_denominator(monkeypatch):
    sc = ChatGPTScanner()
    seq = iter([{"places": ["내가게"], "_measured": True}, {"places": [], "_measured": False, "_error": "timeout"}])

    async def fake_once(query):
        return next(seq)

    async def no_sleep(_):
        return None

    monkeypatch.setattr(sc, "_recommend_once", fake_once)
    monkeypatch.setattr(asyncio, "sleep", no_sleep)
    r = _run(sc.sample_recommend("q", "내가게", n=2))
    assert r["sample_size"] == 1 and r["failed_count"] == 1 and r["exposure_freq"] == 1


def test_legacy_wrappers_use_recommend_probe(monkeypatch):
    sc, calls = _scanner(monkeypatch, {"q": []})
    assert _run(sc.sample_5("q", "내가게"))["probe"] == "recommend_v1"
    assert _run(sc.sample_50("q", "내가게"))["probe"] == "recommend_v1"
    assert len(calls) == 55


def test_names_match_rejects_substring_but_allows_branch_suffix():
    assert not names_match("카페모모", "카페모모카")
    assert names_match("스타벅스", "스타벅스창원상남동점") or names_match("스타벅스창원상남동점", "스타벅스")
