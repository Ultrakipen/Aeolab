"""사업장 등록 시 사용자가 넣은 별점·리뷰 수(체험 입력 이어받기)는 '입력한 값'으로 기록한다 (2026-10-29).

출처가 비면 화면이 입력값인지 측정값인지 구분하지 못한다. 컬럼이 없는 환경에서도 등록은 실패하면 안 된다.
"""
import asyncio

import routers.business as biz_mod
from models.schemas import BusinessCreate


class _Res:
    def __init__(self, data=None, count=0):
        self.data, self.count = data, count


class _Insert:
    def __init__(self, payload):
        self.payload = payload


class _Table:
    def __init__(self, db):
        self.db = db

    def select(self, *_a, **_k):
        return self

    def eq(self, *_a, **_k):
        return self

    def insert(self, payload):
        return _Insert(payload)


class _DB:
    def __init__(self, missing_column=False):
        self.inserts = []
        self.missing_column = missing_column

    def table(self, _name):
        return _Table(self)


def _setup(monkeypatch, db):
    async def fake_execute(q):
        if isinstance(q, _Insert):
            db.inserts.append(dict(q.payload))
            if db.missing_column and "review_stats_source" in q.payload:
                raise RuntimeError('column "review_stats_source" of relation "businesses" does not exist')
            return _Res([{"id": "b1", **q.payload}])
        return _Res([], count=0)        # 기존 사업장 수 조회

    async def noop(*_a, **_k):
        return None

    async def fake_plan(*_a, **_k):
        return "pro"

    async def fake_coords(_addr):
        return None, None

    import middleware.plan_gate as pg
    import services.kakao_geocoding as geo
    monkeypatch.setattr(biz_mod, "execute", fake_execute)
    monkeypatch.setattr(biz_mod, "get_client", lambda: db)
    monkeypatch.setattr(pg, "get_user_plan", fake_plan)
    monkeypatch.setattr(geo, "get_coordinates", fake_coords)
    for name in ("_import_trial_scan", "_capture_before_screenshot", "_sync_naver_stats", "_trigger_blog_analysis_bg"):
        monkeypatch.setattr(biz_mod, name, noop)


def _create(**kw):
    req = BusinessCreate(name="테스트 카페", category="cafe", region="성동구", **kw)
    return asyncio.run(biz_mod.create_business(req, user={"id": "u1"}))


def test_user_entered_stats_are_marked_user(monkeypatch):
    db = _DB()
    _setup(monkeypatch, db)
    _create(review_count=120, avg_rating=4.4)
    assert db.inserts[0]["review_stats_source"] == "user"


def test_rating_only_is_marked_user(monkeypatch):
    db = _DB()
    _setup(monkeypatch, db)
    _create(avg_rating=4.0)
    assert db.inserts[0]["review_stats_source"] == "user"


def test_no_input_has_no_source(monkeypatch):
    """입력이 없으면 출처를 남기지 않는다 — 0/0 기본값을 '입력한 값'으로 표시하면 안 된다."""
    db = _DB()
    _setup(monkeypatch, db)
    _create()
    assert "review_stats_source" not in db.inserts[0]


def test_missing_column_does_not_break_registration(monkeypatch):
    db = _DB(missing_column=True)
    _setup(monkeypatch, db)
    out = _create(review_count=10)
    assert len(db.inserts) == 2 and "review_stats_source" not in db.inserts[1]
    assert db.inserts[1]["review_count"] == 10          # 입력값은 잃지 않는다
    assert out is not None
