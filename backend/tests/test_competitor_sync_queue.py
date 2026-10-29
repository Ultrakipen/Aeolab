"""경쟁사 최초 채우기 서버 큐 (2026-10-29): 탭을 닫아도 이어지고, 한도·네이버 사정에서는 기존 수동 새로고침과 같게 멈춘다."""
import asyncio
import inspect
import re
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from routers import competitor as comp_router
from services import competitor_sync_queue as cq


@pytest.fixture(autouse=True)
def _clean():
    cq._queues.clear()
    yield
    cq._queues.clear()


def _run(user, biz, ids, sync_fn, sleeps=None, observe=None):
    """큐를 돌려 끝까지 기다린 뒤 최종 상태를 돌려준다. sleep은 기다리지 않고 기록만 한다."""
    async def fake_sleep(sec):
        if sleeps is not None:
            sleeps.append(sec)
        if observe is not None:
            observe.append(cq.public_status(user, biz))

    async def main():
        started = cq.start(user, biz, ids, sync_fn, sleep=fake_sleep)
        await asyncio.gather(*list(cq._tasks))
        return started, cq.public_status(user, biz)

    return asyncio.run(main())


def _recorder(script=None):
    """script: {comp_id: [결과 또는 예외, ...]} 호출마다 하나씩 소비. 없으면 성공."""
    calls = []
    script = {k: list(v) for k, v in (script or {}).items()}

    async def fn(cid, user):
        calls.append((cid, user["id"]))
        steps = script.get(cid)
        if steps:
            step = steps.pop(0)
            if isinstance(step, Exception):
                raise step
            return step
        return {"refreshed": True}

    return fn, calls


def test_all_succeed_and_runs_as_the_requesting_user():
    fn, calls = _recorder()
    started, st = _run("u1", "b1", ["a", "b", "c"], fn)
    assert started["started"] is True
    assert st["state"] == "done" and st["total"] == 3 and st["done"] == 3 and st["failed"] == 0
    assert calls == [("a", "u1"), ("b", "u1"), ("c", "u1")]       # 한도·소유권이 그 사용자 기준으로 적용된다


def test_rate_limit_waits_retry_after_then_resumes_same_competitor():
    fn, calls = _recorder({"b": [HTTPException(429, "한도", headers={"Retry-After": "300"})]})
    sleeps, seen = [], []
    _, st = _run("u1", "b1", ["a", "b", "c"], fn, sleeps, seen)
    assert 300 in sleeps                                           # 서버가 알려 준 시간만큼 쉰다
    assert [c for c, _ in calls] == ["a", "b", "b", "c"]           # 같은 경쟁사부터 다시
    assert st["state"] == "done" and st["failed"] == 0
    waiting = [s for s in seen if s["state"] == "waiting"]
    assert waiting and waiting[0]["wait_sec"] > 0                  # 쉬는 동안 화면이 남은 시간을 볼 수 있다


def test_retry_after_is_capped_and_missing_header_uses_default():
    fn, _ = _recorder({"a": [HTTPException(429, "x", headers={"Retry-After": "99999"})],
                       "b": [HTTPException(429, "x")]})
    sleeps = []
    _run("u1", "b1", ["a", "b"], fn, sleeps)
    assert cq.MAX_WAIT_SEC in sleeps and cq.DEFAULT_WAIT_SEC in sleeps and 99999 not in sleeps


def test_rate_limit_beyond_max_waits_pauses_without_hammering():
    limited = HTTPException(429, "새로고침을 너무 자주 하셨어요", headers={"Retry-After": "60"})
    fn, calls = _recorder({"a": [limited] * 10})
    _, st = _run("u1", "b1", ["a", "b", "c"], fn)
    assert st["state"] == "paused" and "너무 자주" in st["message"]
    assert len(calls) == cq.MAX_WAITS + 1 and all(c == "a" for c, _ in calls)    # b·c에는 요청을 보내지 않는다
    assert st["remaining"] == 3


def test_naver_busy_503_pauses_and_keeps_remaining_untouched():
    fn, calls = _recorder({"b": [HTTPException(503, "지금 네이버 확인이 지연되고 있어요. 약 3시간 뒤 다시 시도해 주세요.")]})
    _, st = _run("u1", "b1", ["a", "b", "c"], fn)
    assert st["state"] == "paused" and "3시간" in st["message"]
    assert [c for c, _ in calls] == ["a", "b"]                     # 네이버가 막혔는데 c까지 부르지 않는다
    assert st["done"] == 1 and st["failed"] == 0                   # 막힘은 실패로 세지 않는다


def test_not_found_place_counts_failed_and_continues():
    fn, calls = _recorder({"a": [HTTPException(422, "플레이스를 찾을 수 없습니다")], "b": [RuntimeError("boom")]})
    _, st = _run("u1", "b1", ["a", "b", "c"], fn)
    assert st["state"] == "done" and st["failed"] == 2 and st["done"] == 3
    assert [c for c, _ in calls] == ["a", "b", "c"]


def test_deleted_competitor_is_dropped_not_counted_failed():
    fn, _ = _recorder({"b": [HTTPException(404, "없음")]})
    _, st = _run("u1", "b1", ["a", "b", "c"], fn)
    assert st["state"] == "done" and st["total"] == 2 and st["done"] == 2 and st["failed"] == 0


def test_second_start_for_same_user_does_not_run_twice_and_other_users_cannot_see_it():
    gate = {}

    async def slow(cid, user):
        await gate["ev"].wait()
        return {"refreshed": True}

    async def main():
        gate["ev"] = asyncio.Event()
        first = cq.start("u1", "b1", ["a"], slow, sleep=lambda s: asyncio.sleep(0))
        again = cq.start("u1", "b1", ["a", "b"], slow)
        other_biz = cq.start("u1", "b2", ["x"], slow)
        spy = cq.public_status("u2", "b1")
        gate["ev"].set()
        await asyncio.gather(*list(cq._tasks))
        return first, again, other_biz, spy

    first, again, other_biz, spy = asyncio.run(main())
    assert first["started"] is True
    assert again["started"] is False and again["reason"] == "already_running"
    assert other_biz["started"] is False and other_biz["reason"] == "user_busy"     # 같은 사용자의 한도를 다투지 않게
    assert spy == {"state": "idle"}                                                  # 남의 큐는 없는 것과 같다


def test_nothing_to_do_and_target_cap():
    fn, calls = _recorder()
    started, _ = _run("u1", "b1", [], fn)
    assert started["started"] is False and started["reason"] == "nothing"
    many = [f"c{i}" for i in range(cq.MAX_TARGETS + 7)] + ["c0"]
    _, st = _run("u2", "b2", many, fn)
    assert st["total"] == cq.MAX_TARGETS                                              # 중복 제거 + 상한


def test_unexpected_crash_never_leaves_queue_running_forever(monkeypatch):
    fn, _ = _recorder()

    async def boom(sec):
        raise RuntimeError("sleep failed")

    async def main():
        cq.start("u1", "b1", ["a", "b"], fn, sleep=boom)
        await asyncio.gather(*list(cq._tasks))
        return cq.public_status("u1", "b1")

    st = asyncio.run(main())
    assert st["state"] == "paused"


# ── 라우터 연결 ───────────────────────────────────────────────────────────
class _Res:
    def __init__(self, data): self.data = data


class _Q:
    def __init__(self, table, rows): self.table, self.rows = table, rows
    def select(self, *_): return self
    def eq(self, *_): return self
    def maybe_single(self): return self


class _DB:
    def __init__(self, rows): self.rows = rows
    def table(self, name): return _Q(name, self.rows)


def _start_route(monkeypatch, comps, owned=True):
    captured = {}

    def fake_start(user_id, biz_id, ids, sync_fn):
        captured.update(user_id=user_id, biz_id=biz_id, ids=ids, sync_fn=sync_fn)
        return {"started": True}

    async def fake_execute(q): return _Res(q.rows[q.table])

    monkeypatch.setattr(comp_router, "get_client", lambda: _DB({"businesses": {"id": "b1"} if owned else None, "competitors": comps}))
    monkeypatch.setattr(comp_router, "execute", fake_execute)
    monkeypatch.setattr(cq, "start", fake_start)
    out = asyncio.run(comp_router.start_sync_queue("b1", user={"id": "u9"}))
    return out, captured


def test_route_queues_only_unrated_and_not_just_synced(monkeypatch):
    old = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
    fresh = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    comps = [
        {"id": "never", "naver_avg_rating": None, "naver_place_last_synced_at": None},
        {"id": "zero", "naver_avg_rating": 0, "naver_place_last_synced_at": old},
        {"id": "rated", "naver_avg_rating": 4.3, "naver_place_last_synced_at": old},
        {"id": "just_now", "naver_avg_rating": None, "naver_place_last_synced_at": fresh},
    ]
    out, cap = _start_route(monkeypatch, comps)
    assert cap["ids"] == ["never", "zero"] and cap["user_id"] == "u9" and cap["biz_id"] == "b1"
    assert out == {"started": True}


def test_route_rejects_other_users_business(monkeypatch):
    with pytest.raises(HTTPException) as e:
        _start_route(monkeypatch, [], owned=False)
    assert e.value.status_code == 404


def test_queue_reuses_the_manual_sync_function_so_every_guard_still_applies():
    """큐가 별도 크롤 경로를 만들지 않고 수동 새로고침 본체를 그대로 부른다 — 한도·회로·속도·일일 상한이 같이 적용된다."""
    src = inspect.getsource(comp_router.start_sync_queue)
    assert re.search(r"q\.start\([^)]*_sync_one_competitor\s*\)", src)
    ep = inspect.getsource(comp_router.sync_competitor_place_endpoint)
    assert "return await _sync_one_competitor(competitor_id, user)" in ep
    body = inspect.getsource(comp_router._sync_one_competitor)
    assert "manual_sync_take_quota" in body and "sync_competitor_place" in body       # 한도 확인·크롤러 호출이 본체에 있다
    # 큐 모듈은 크롤러·네이버 접속 코드를 직접 부르지 않는다
    import ast
    imported = set()
    for node in ast.walk(ast.parse(inspect.getsource(cq))):
        if isinstance(node, ast.Import):
            imported |= {a.name for a in node.names}
        elif isinstance(node, ast.ImportFrom):
            imported.add(node.module or "")
    assert not any("crawler" in m or "playwright" in m or "naver" in m for m in imported), imported


def test_status_route_touches_no_database():
    """화면이 몇 초마다 읽는 상태 조회가 DB를 건드리지 않는다(Supabase 부하를 늘리지 않는다)."""
    src = inspect.getsource(comp_router.get_sync_queue)
    assert "execute(" not in src and "get_client" not in src
