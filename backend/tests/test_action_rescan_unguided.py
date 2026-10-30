"""액션 재스캔이 가게 이름을 질문에 넣는 유도형(single_check)이 아니라 비유도 sample_recommend를 쓰는지 (2026-10-30)."""
import asyncio
import inspect

from scheduler import jobs


def test_action_rescan_uses_unguided_sampling():
    src = inspect.getsource(jobs.check_action_rescans)
    assert "single_check" not in src.replace("유도형 single_check", "")
    assert "sample_recommend" in src


class _Res:
    def __init__(self, data=None):
        self.data = data


class _Q:
    def __init__(self, table, store):
        self.t, self.store, self.op = table, store, "select"

    def __getattr__(self, name):
        def chain(*a, **k):
            if name == "update":
                self.op = "update"
                self.store["updates"].append(a[0])
            return self
        return chain


class _SB:
    def __init__(self, store):
        self.store = store

    def table(self, name):
        return _Q(name, self.store)


def _run(monkeypatch, gemini_result):
    import db.supabase_client as sc
    import services.ai_scanner.gemini_scanner as gs
    store = {"updates": []}
    action = {"id": "a1", "business_id": "b1", "keyword": "삼겹살", "action_type": "x", "before_score": 40, "before_mentioned": False}

    async def fake_db(q):
        if q.op == "update":
            return _Res([])
        if q.t == "action_completions":
            return _Res([action])
        if q.t == "businesses":
            return _Res({"name": "테스트식당", "region": "성수동", "category": "restaurant"})
        return _Res({"unified_score": 50, "track1_score": 45})

    calls = []

    class FakeGemini:
        async def sample_recommend(self, queries, target, n=50, deadline_sec=None):
            calls.append((queries, target, n))
            return gemini_result

    monkeypatch.setattr(jobs, "_db", fake_db)
    monkeypatch.setattr(sc, "get_client", lambda: _SB(store))
    monkeypatch.setattr(gs, "GeminiScanner", FakeGemini)

    async def nosleep(_):
        return None
    monkeypatch.setattr(asyncio, "sleep", nosleep)
    asyncio.run(jobs.check_action_rescans())
    return store, calls


def test_measured_result_is_saved_and_query_has_no_business_name(monkeypatch):
    store, calls = _run(monkeypatch, {"sample_size": 10, "exposure_freq": 2})
    assert calls and "테스트식당" not in calls[0][0] and calls[0][0] == "성수동 삼겹살 추천"
    assert store["updates"] and store["updates"][0]["after_mentioned"] is True and store["updates"][0]["rescan_done"] is True


def test_measurement_failure_is_retried_not_saved_as_not_exposed(monkeypatch):
    store, _ = _run(monkeypatch, {"sample_size": 0, "exposure_freq": 0, "error": "gemini_busy"})
    assert store["updates"] == []     # rescan_done을 세팅하지 않아 다음 배치에서 재시도
