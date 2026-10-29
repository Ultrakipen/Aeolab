"""별점·리뷰 수 출처 표시(2026-10-29): 입력 vs AEOlab이 확인한 값. 컬럼이 없어도 동작해야 한다."""
import asyncio

import pytest

from routers.business import review_stats_edited


# ── 사용자가 실제로 바꿨는지 ─────────────────────────────────────────────
def test_unchanged_resend_is_not_an_edit():
    cur = {"avg_rating": 4.5, "review_count": 120, "visitor_review_count": 100, "receipt_review_count": 20}
    # 설정 화면은 저장할 때마다 전체 값을 다시 보낸다 — 값이 같으면 입력이 아니다
    assert review_stats_edited(cur, {"avg_rating": 4.5, "review_count": 120, "visitor_review_count": 100, "receipt_review_count": 20}) is False
    assert review_stats_edited(cur, {"avg_rating": 4.5, "name": "x"}) is False


def test_changed_value_is_an_edit():
    cur = {"avg_rating": 4.5, "review_count": 120, "visitor_review_count": 100, "receipt_review_count": 20}
    assert review_stats_edited(cur, {"avg_rating": 4.6}) is True
    assert review_stats_edited(cur, {"review_count": 121}) is True
    assert review_stats_edited({"avg_rating": None, "review_count": 0}, {"avg_rating": 4.0}) is True


def test_cannot_compare_means_no_edit():
    assert review_stats_edited(None, {"avg_rating": 4.0}) is False
    assert review_stats_edited({}, {"name": "x"}) is False


# ── 측정 성공 시 'measured' 기록, 컬럼 없으면 폴백 ───────────────────────────
class _Q:
    def __init__(self, log, fail_on, existing=None, select_fails=False):
        self.log, self.fail_on = log, fail_on
        self.payload = None
        self.existing, self.select_fails = existing, select_fails
        self.is_select = False

    def select(self, *_):
        self.is_select = True
        return self

    def update(self, payload):
        self.payload = payload
        return self

    def eq(self, *_):
        return self

    def execute(self):
        if self.is_select:
            if self.select_fails:
                raise RuntimeError("select failed")
            return type("R", (), {"data": [dict(self.existing or {})]})()
        self.log.append(dict(self.payload))
        # Postgres처럼 없는 컬럼을 한 번에 하나씩만 알려 준다
        for c in (self.fail_on or ()):
            if c in self.payload:
                raise RuntimeError(f'column "{c}" of relation "businesses" does not exist')
        return None


class _DB:
    def __init__(self, fail_on=None, existing=None, select_fails=False):
        self.log, self.fail_on = [], fail_on
        self.existing, self.select_fails = existing, select_fails

    def table(self, _):
        return _Q(self.log, self.fail_on, self.existing, self.select_fails)


def _run(monkeypatch, db, stats=None):
    import db.supabase_client as sc
    import services.naver_place_stats as nps

    async def fake_fetch(self, _pid):
        return stats or {"review_count": 50, "visitor_review_count": 50, "receipt_review_count": 5, "avg_rating": 4.3}

    monkeypatch.setattr(nps.NaverPlaceStatsService, "fetch_stats", fake_fetch)
    monkeypatch.setattr(sc, "get_client", lambda: db)
    return asyncio.run(nps.sync_naver_place_stats("b1", "123"))


def test_measured_success_marks_source(monkeypatch):
    db = _DB()
    _run(monkeypatch, db)
    assert db.log[0]["review_stats_source"] == "measured"
    assert db.log[0]["review_stats_measured_at"]
    assert db.log[0]["avg_rating"] == 4.3


_NO_RATING = {"review_count": 50, "visitor_review_count": 50, "receipt_review_count": 5, "avg_rating": None}


def test_user_rating_is_not_relabeled_measured(monkeypatch):
    """크롤이 리뷰 수만 읽고 별점은 못 읽었을 때, DB의 사용자 입력 별점을 '확인한 값'으로 바꾸면 안 된다."""
    db = _DB(existing={"avg_rating": 4.5})
    _run(monkeypatch, db, _NO_RATING)
    assert db.log[0]["review_count"] == 50
    assert "review_stats_source" not in db.log[0] and "review_stats_measured_at" not in db.log[0]


def test_no_rating_anywhere_still_marks_measured(monkeypatch):
    db = _DB(existing={"avg_rating": None})
    _run(monkeypatch, db, _NO_RATING)
    assert db.log[0]["review_stats_source"] == "measured"


def test_unknown_existing_rating_keeps_source(monkeypatch):
    db = _DB(select_fails=True)
    _run(monkeypatch, db, _NO_RATING)
    assert "review_stats_source" not in db.log[0]


def test_missing_columns_fall_back_without_losing_stats(monkeypatch):
    db = _DB(fail_on=("review_stats_source", "review_stats_measured_at"))
    _run(monkeypatch, db)
    final = db.log[-1]
    assert len(db.log) == 3
    assert "review_stats_source" not in final and "review_stats_measured_at" not in final
    assert final["review_count"] == 50 and final["avg_rating"] == 4.3
    assert final["is_smart_place"] is True      # 없는 컬럼(출처 표시) 때문에 정상 컬럼까지 잃으면 안 된다


def test_business_get_does_not_put_new_columns_in_shared_optional_list():
    """선택 컬럼 목록에 넣으면 컬럼이 없는 동안 /me·/{id} 조회가 통째로 폴백돼 is_franchise·소개글 초안 등이 사라진다."""
    from routers.business import _BIZ_OPTIONAL_COLS
    assert "review_stats_source" not in _BIZ_OPTIONAL_COLS and "review_stats_measured_at" not in _BIZ_OPTIONAL_COLS


def test_failed_measurement_writes_nothing(monkeypatch):
    import db.supabase_client as sc
    import services.naver_place_stats as nps
    db = _DB()

    async def fake_fetch(self, _pid):
        return {"error": "naver_place_cooldown", "naver_place_id": "123"}

    monkeypatch.setattr(nps.NaverPlaceStatsService, "fetch_stats", fake_fetch)
    monkeypatch.setattr(sc, "get_client", lambda: db)
    out = asyncio.run(nps.sync_naver_place_stats("b1", "123"))
    assert out["error"] and db.log == []     # 차단·실패 시 사용자의 입력값과 출처 표시를 건드리지 않는다
