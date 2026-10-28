"""별점 낮은 리뷰 잡 — 배치 몫·오래된 순서 회전·막힘 처리 (2026-10-28).

이전 잡은 사업장을 항상 같은 순서로 돌고, 막힌 것을 "낮은 별점 없음"과 구분하지 못해 사업장이 늘면 뒤쪽이 영영 확인되지 않았다.
네이버·DB·카카오는 모두 가짜로 대체한다 — 네트워크에 접속하지 않는다.
"""
import asyncio
import json
import os
import sys

import pytest

os.environ.setdefault("OPENAI_API_KEY", "test-key-not-used")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class _R:
    def __init__(self, data, count=None):
        self.data = data
        self.count = count


class _Q:
    def __init__(self, rows=None, count=0):
        self._rows, self._count = rows or [], count

    def select(self, *a, **k): return self
    def eq(self, *a, **k): return self
    def in_(self, *a, **k): return self
    def contains(self, *a, **k): return self
    def insert(self, payload): self._insert = payload; return self
    @property
    def not_(self): return self
    def is_(self, *a, **k): return self


@pytest.fixture
def env(monkeypatch, tmp_path):
    import scheduler.jobs as jobs
    import db.supabase_client as dbc
    import services.naver_place_stats as ps

    monkeypatch.setenv("NAVER_LOW_RATING_STATE_FILE", str(tmp_path / "state.json"))
    ctx = {
        "biz": [], "phones": {}, "calls": [], "sent": [], "inserted": [], "slack": [], "batch_flags": [],
        "script": {}, "default": {"checked": True, "reviews": [], "markers": 3, "reason": None},
        "dup_count": 0, "state_file": tmp_path / "state.json", "send_ok": True, "attempts": [],
    }

    class C:
        def table(self, name):
            if name == "subscriptions":
                return _Q([{"user_id": u} for u in sorted({b["user_id"] for b in ctx["biz"]})])
            if name == "businesses":
                return _Q(ctx["biz"])
            if name == "profiles":
                return _Q([{"user_id": u, "phone": p} for u, p in ctx["phones"].items()])
            return _Q([], ctx["dup_count"])

    async def fake_db(q):
        if hasattr(q, "_insert"):
            ctx["inserted"].append(q._insert)
        return _R(q._rows, q._count)

    class N:
        async def send_low_rating_alert(self, **k):
            ctx["attempts"].append(k)
            if ctx["send_ok"]:
                ctx["sent"].append(k)
            return ctx["send_ok"]

    async def fake_check(naver_place_id, min_rating=2, max_reviews=10):
        from services.ai_scanner import is_naver_batch
        ctx["batch_flags"].append(is_naver_batch())
        ctx["calls"].append(naver_place_id)
        return ctx["script"].get(naver_place_id, ctx["default"])

    async def fake_slack(*a, **k):
        ctx["slack"].append(a)

    monkeypatch.setattr(jobs, "_db", fake_db)
    monkeypatch.setattr(jobs, "send_slack_alert", fake_slack)
    monkeypatch.setattr(dbc, "get_client", lambda: C())
    # 잡은 함수 안에서 `from services.kakao_notify import KakaoNotifier`를 하므로 sys.modules 항목을 직접 교체한다. 속성 패치는
    # 다른 테스트가 가짜 모듈을 등록하거나 진짜 모듈을 격리 import 해 두면 잡이 읽는 객체와 달라질 수 있다(전체 실행에서만 실패).
    import types
    fake_kn = types.ModuleType("services.kakao_notify")
    fake_kn.KakaoNotifier = N
    monkeypatch.setitem(sys.modules, "services.kakao_notify", fake_kn)
    monkeypatch.setattr(ps, "check_low_rating_reviews_for", fake_check)
    ctx["jobs"] = jobs
    return ctx


def _biz(n):
    return [{"id": f"b{i}", "name": f"가게{i}", "user_id": f"u{i}", "naver_place_id": f"p{i}"} for i in range(1, n + 1)]


def _run(env):
    asyncio.run(env["jobs"].check_low_rating_reviews())


def test_runs_inside_batch_share_and_skips_businesses_without_phone(env):
    env["biz"] = _biz(3)
    env["phones"] = {"u1": "010", "u3": "010"}            # u2는 전화번호 없음 — 알림을 보낼 수 없으니 네이버 접속도 하지 않는다
    _run(env)
    assert sorted(env["calls"]) == ["p1", "p3"]
    assert env["batch_flags"] and all(env["batch_flags"])   # 정기 잡 = 배치 몫까지만 (@_naver_batch_job)


def test_blocked_run_stops_and_next_run_resumes_from_unchecked(env, monkeypatch):
    env["biz"] = _biz(4)
    env["phones"] = {f"u{i}": "010" for i in range(1, 5)}
    env["state_file"].write_text(json.dumps({"last": {"b1": 100.0, "b2": 200.0}, "seen": {}}))   # b3·b4는 한 번도 확인 못 함
    # 첫 호출은 성공, 두 번째부터 쿨다운
    seq = iter([{"checked": True, "reviews": [], "markers": 2, "reason": None}] + [{"checked": False, "reviews": [], "markers": 0, "reason": "cooldown"}] * 10)
    import services.naver_place_stats as psmod

    async def scripted(naver_place_id, min_rating=2, max_reviews=10):
        env["calls"].append(naver_place_id)
        return next(seq)

    monkeypatch.setattr(psmod, "check_low_rating_reviews_for", scripted)
    _run(env)
    first_run = list(env["calls"])
    assert len(first_run) == 2                              # 두 번째에서 막혀 더 시도하지 않았다
    assert set(first_run) <= {"p3", "p4"}                   # 한 번도 확인 못 한 사업장이 먼저였다
    state = json.loads(env["state_file"].read_text())["last"]
    done = first_run[0].replace("p", "b")
    stuck = first_run[1].replace("p", "b")
    assert done in state and stuck not in state             # 막힌 사업장은 '확인함'으로 기록되지 않는다
    assert state["b1"] == 100.0 and state["b2"] == 200.0

    # 다음 실행: 이번에 못 한 사업장이 맨 앞에서 이어진다
    env["calls"].clear()
    monkeypatch.setattr(psmod, "check_low_rating_reviews_for", lambda *a, **k: _ok_coro(env, a, k))
    _run(env)
    assert env["calls"][0] == first_run[1]
    assert sorted(env["calls"]) == ["p1", "p2", "p3", "p4"]


async def _ok_coro(env, a, k):
    env["calls"].append(a[0] if a else k["naver_place_id"])
    return {"checked": True, "reviews": [], "markers": 2, "reason": None}


def test_one_business_timeout_does_not_stop_the_rest(env):
    env["biz"] = _biz(3)
    env["phones"] = {f"u{i}": "010" for i in range(1, 4)}
    env["script"] = {"p2": {"checked": False, "reviews": [], "markers": 0, "reason": "timeout"}}
    _run(env)
    assert sorted(env["calls"]) == ["p1", "p2", "p3"]       # 시간 초과는 그 사업장만의 문제 — 계속한다
    assert "b2" not in json.loads(env["state_file"].read_text())["last"]   # 확인하지 못했으므로 다음에 다시 앞에 선다


def test_all_zero_markers_raises_structure_change_alert(env):
    env["biz"] = _biz(3)
    env["phones"] = {f"u{i}": "010" for i in range(1, 4)}
    env["default"] = {"checked": True, "reviews": [], "markers": 0, "reason": None}
    _run(env)
    assert len(env["slack"]) == 1 and "별점 표식 0건" in env["slack"][0][0]


def test_some_markers_does_not_alert(env):
    env["biz"] = _biz(3)
    env["phones"] = {f"u{i}": "010" for i in range(1, 4)}
    env["script"] = {"p1": {"checked": True, "reviews": [], "markers": 0, "reason": None}}   # 리뷰 없는 가게 한 곳은 정상
    _run(env)
    assert env["slack"] == []


def test_first_check_records_baseline_without_alert_then_only_new_reviews_alert(env):
    """처음 확인하는 사업장의 낮은 별점 리뷰는 '이미 있던 것'이다 — 알림 문구가 "등록됐습니다"라서 알리면 거짓이 된다."""
    env["biz"] = _biz(1)
    env["phones"] = {"u1": "010"}
    old = {"rating": 1, "excerpt": "예전 불만 리뷰", "review_id": "p1_old"}
    env["default"] = {"checked": True, "reviews": [old], "markers": 5, "reason": None}
    _run(env)
    assert env["sent"] == []                                              # 첫 확인: 기준선만
    assert json.loads(env["state_file"].read_text())["seen"]["b1"] == ["p1_old"]
    _run(env)
    assert env["sent"] == []                                              # 같은 리뷰는 계속 알리지 않는다
    new = {"rating": 2, "excerpt": "새로 달린 불만 리뷰", "review_id": "p1_new"}
    env["default"] = {"checked": True, "reviews": [new, old], "markers": 5, "reason": None}
    _run(env)
    assert len(env["sent"]) == 1 and env["sent"][0]["review_excerpt"] == "새로 달린 불만 리뷰"   # 새 리뷰만


def test_failed_send_is_not_recorded_as_sent_and_is_retried_next_run(env):
    """이전에는 발송 결과를 확인하지 않고 항상 '발송됨'으로 기록해, 실패한 알림이 중복 방지에 걸려 영영 재시도되지 않았다."""
    env["biz"] = _biz(1)
    env["phones"] = {"u1": "010"}
    env["state_file"].write_text(json.dumps({"last": {"b1": 1.0}, "seen": {}}))   # 기준선 있음
    new = {"rating": 1, "excerpt": "새로 달린 불만 리뷰", "review_id": "p1_new"}
    env["default"] = {"checked": True, "reviews": [new], "markers": 5, "reason": None}

    env["send_ok"] = False                                    # 카카오 발송 실패(템플릿 불일치·키 미설정 등)
    _run(env)
    assert len(env["attempts"]) == 1 and env["sent"] == []
    assert env["inserted"] == []                              # '발송됨' 이력을 남기지 않는다
    assert "p1_new" not in json.loads(env["state_file"].read_text())["seen"].get("b1", [])   # 이미 본 것으로도 남기지 않는다
    assert len(env["slack"]) == 1 and "알림 발송 실패" in env["slack"][0][0]

    env["send_ok"] = True                                     # 다음 실행에서 복구되면 같은 리뷰를 다시 알린다
    env["slack"].clear()
    _run(env)
    assert len(env["sent"]) == 1 and env["sent"][0]["review_excerpt"] == "새로 달린 불만 리뷰"
    assert env["inserted"] and env["slack"] == []
    _run(env)
    assert len(env["sent"]) == 1                              # 성공 뒤에는 다시 보내지 않는다


def test_sort_failure_everywhere_alerts(env):
    env["biz"] = _biz(2)
    env["phones"] = {f"u{i}": "010" for i in range(1, 3)}
    env["default"] = {"checked": False, "reviews": [], "markers": 5, "reason": "sort"}
    _run(env)
    assert len(env["slack"]) == 1 and "최신순 정렬 실패" in env["slack"][0][0]
    assert env["sent"] == []


def test_low_rating_review_sends_alert_once_and_dedupes(env):
    env["biz"] = _biz(1)
    env["phones"] = {"u1": "010"}
    env["state_file"].write_text(json.dumps({"last": {"b1": 1.0}, "seen": {}}))   # 이미 한 번 확인한 사업장(기준선 있음)
    rev = {"rating": 1, "excerpt": "불친절했어요", "review_id": "p1_abc"}
    env["default"] = {"checked": True, "reviews": [rev], "markers": 4, "reason": None}
    _run(env)
    assert len(env["sent"]) == 1 and env["sent"][0]["rating"] == 1
    assert env["inserted"] and env["inserted"][0]["content"]["review_id"] == "p1_abc"
    # 같은 review_id가 이미 발송 이력에 있으면 다시 보내지 않는다
    env["sent"].clear()
    env["inserted"].clear()
    env["dup_count"] = 1
    _run(env)
    assert env["sent"] == [] and env["inserted"] == []
