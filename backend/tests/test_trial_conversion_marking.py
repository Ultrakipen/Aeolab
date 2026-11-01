"""체험 결과를 사업장으로 가져올 때 가입 전환(converted_user_id)을 기록한다 (2026-11-02).

그 전에는 converted_user_id를 쓰는 코드가 없어 체험→가입 전환을 측정할 수 없었고, 계정 삭제 시 익명화
(settings.py: converted_user_id로 찾아 비우기)도 대상을 못 찾았다.
"""
import asyncio

import routers.business as biz_mod


class _Res:
    def __init__(self, data=None):
        self.data = data


class _Q:
    def __init__(self, kind, table, payload=None):
        self.kind, self.table, self.payload = kind, table, payload

    # 체인 메서드 — 모두 자기 자신
    def select(self, *_a, **_k): return self
    def eq(self, *_a, **_k): return self
    def is_(self, *_a, **_k): return self
    def maybe_single(self): return self
    def update(self, payload): return _Q("update", self.table, payload)
    def insert(self, payload): return _Q("insert", self.table, payload)
    def upsert(self, payload, **_k): return _Q("upsert", self.table, payload)


class _DB:
    def __init__(self):
        self.updates = []

    def table(self, name):
        return _Q("select", name)


TRIAL = {"id": "t1", "business_name": "가게", "category": "cafe", "region": "성동구", "total_score": 40,
         "track1_score": 40, "track2_score": 30, "unified_score": 38, "keyword_coverage": None, "score_breakdown": {}}


def _run(monkeypatch, user_id, trial=TRIAL):
    db = _DB()

    async def fake_execute(q):
        if q.kind == "select":
            return _Res(trial)
        if q.kind == "insert":
            return _Res([{"id": "s1"}])
        if q.kind == "update":
            db.updates.append((q.table, dict(q.payload)))
        return _Res([])

    import db.supabase_client as sc
    monkeypatch.setattr(sc, "get_client", lambda: db)
    monkeypatch.setattr(sc, "execute", fake_execute)
    asyncio.run(biz_mod._import_trial_scan("b1", "t1", user_id))
    return db.updates


def test_import_marks_converted_user(monkeypatch):
    ups = _run(monkeypatch, "user-1")
    assert ups == [("trial_scans", {"imported_business_id": "b1", "converted_user_id": "user-1"})]


def test_import_without_user_keeps_old_behaviour(monkeypatch):
    ups = _run(monkeypatch, None)
    assert ups == [("trial_scans", {"imported_business_id": "b1"})]


def test_already_imported_trial_is_not_marked_again(monkeypatch):
    """이미 가져온 체험(조회 결과 없음)은 아무것도 기록하지 않는다 — 다른 사용자가 전환을 가로채지 못한다."""
    assert _run(monkeypatch, "user-2", trial=None) == []


def test_create_business_passes_the_logged_in_user_id():
    import inspect
    src = inspect.getsource(biz_mod.create_business)
    assert '_import_trial_scan(biz["id"], req.trial_scan_id, user["id"])' in src
