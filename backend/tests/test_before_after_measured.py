"""행동 전/후·대행 전/후 점수의 끝점은 네이버까지 정상 측정된 스캔이어야 한다 (2026-11-02).

측정 빠진 스캔의 점수는 항목이 제외·재정규화돼 다른 스캔과 척도가 다르다(같은 가게 시험 64.5 ↔ 54.6). 그 값을 '전' 점수로 저장하면
처방·대행의 효과가 거짓으로 보인다(화면은 전/후가 둘 다 있을 때만 증감을 표시하므로 None으로 두면 증감이 표시되지 않는다).
"""
import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import change_signal_guard as csg  # noqa: E402


# ── 순수 판정 ────────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("row,expected", [
    ({"unified_score": 64.5, "total_score": 64.5}, 64.5),
    ({"unified_score": None, "total_score": 60.0}, 60.0),                         # 과거 행: total_score가 같은 값의 별칭
    ({"unified_score": 0.0, "total_score": 12.0}, 0.0),                           # falsy 0점을 건너뛰지 않는다
    ({"unified_score": 54.6, "nr_error": "naver_search_cooldown"}, None),
    ({"unified_score": 54.6, "nr_captcha": "true"}, None),
    ({"unified_score": 54.6, "nr_quota": "true"}, None),
    ({"unified_score": 54.6, "nr_error": None, "nr_captcha": "false", "nr_quota": "false"}, 54.6),
    ({"unified_score": None, "total_score": None}, None),
    ({"unified_score": "abc"}, None),
    (None, None),
    ("garbage", None),
])
def test_score_of_row_if_measured(row, expected):
    assert csg.score_of_row_if_measured(row) == expected


# ── 가짜 DB ─────────────────────────────────────────────────────────────────────
class _R:
    def __init__(self, data=None):
        self.data = data


class _Q:
    def __init__(self, table):
        self.table_name = table
        self.calls = []

    def __getattr__(self, name):
        if name == "not_":
            self.calls.append(("not_", ()))
            return self
        return lambda *a, **k: (self.calls.append((name, a)) or self)

    def has(self, name, *args):
        return (name, args) in self.calls


class _SB:
    def __init__(self):
        self.queries = []

    def table(self, name):
        q = _Q(name)
        self.queries.append(q)
        return q


def _patch_execute(monkeypatch, rows=None, fail=False):
    import db.supabase_client as dbc

    async def fake(q):
        if fail:
            raise RuntimeError("db down")
        return _R(rows)

    monkeypatch.setattr(dbc, "execute", fake)


_MEASURED = {"unified_score": 64.5, "total_score": 64.5, "nr_error": None, "nr_captcha": None, "nr_quota": None}
_BLOCKED = {"unified_score": 54.6, "total_score": 54.6, "nr_error": "naver_search_cooldown", "nr_captcha": None, "nr_quota": "true"}


def test_latest_measured_score_measured(monkeypatch):
    _patch_execute(monkeypatch, [_MEASURED])
    assert asyncio.run(csg.latest_measured_score(_SB(), "b1")) == 64.5


def test_latest_measured_score_blocked_is_none_and_does_not_reach_back(monkeypatch):
    sb = _SB()
    # 응답에 오래된 정상 스캔이 함께 와도(limit이 느슨해지는 회귀를 가정) 가장 최근 1건만 본다 — 오래된 점수를 '지금'의 끝점으로 쓰지 않는다
    _patch_execute(monkeypatch, [_BLOCKED, _MEASURED])
    assert asyncio.run(csg.latest_measured_score(sb, "b1")) is None
    assert len(sb.queries) == 1                                  # 거슬러 올라가려고 추가 조회를 하지도 않는다


def test_latest_measured_score_empty_and_failure(monkeypatch):
    _patch_execute(monkeypatch, [])
    assert asyncio.run(csg.latest_measured_score(_SB(), "b1")) is None
    _patch_execute(monkeypatch, fail=True)
    assert asyncio.run(csg.latest_measured_score(_SB(), "b1")) is None


def test_latest_measured_score_query_shape(monkeypatch):
    sb = _SB()
    _patch_execute(monkeypatch, [_MEASURED])
    asyncio.run(csg.latest_measured_score(sb, "b1"))
    q = sb.queries[0]
    assert q.table_name == "scan_results"
    assert q.has("is_", "track1_score", "null") and q.has("limit", 1) and q.has("eq", "business_id", "b1")


# ── 대행 서비스 전/후 ─────────────────────────────────────────────────────────────
def test_delivery_latest_score_follows_the_same_rule(monkeypatch):
    import routers.delivery as rd
    monkeypatch.setattr(rd, "get_client", lambda: _SB())
    _patch_execute(monkeypatch, [_MEASURED])
    assert asyncio.run(rd._get_latest_business_score("b1")) == 64.5
    _patch_execute(monkeypatch, [_BLOCKED])
    assert asyncio.run(rd._get_latest_business_score("b1")) is None            # 후기의 score_delta가 거짓 증감으로 만들어지지 않는다
    assert asyncio.run(rd._get_latest_business_score(None)) is None


# ── 행동 로그(report.py) ─────────────────────────────────────────────────────────
def _post_action_log(monkeypatch, rows, fail=False):
    import middleware.plan_gate as pg
    import routers.report as rr

    inserted = []

    class Q2(_Q):
        def insert(self, payload):
            inserted.append(payload)
            return self

        def maybe_single(self):
            return self

    class SB2(_SB):
        def table(self, name):
            q = Q2(name)
            self.queries.append(q)
            return q

    import db.supabase_client as dbc

    async def fake(q):
        if q.table_name == "businesses":
            return _R({"id": "b1"})
        if q.table_name == "scan_results":
            if fail:
                raise RuntimeError("db down")
            return _R(rows)
        return _R([])                      # 중복 확인 없음, insert 응답

    async def plan(uid, sb):
        return "basic"

    monkeypatch.setattr(rr, "get_client", lambda: SB2())
    monkeypatch.setattr(rr, "execute", fake)
    monkeypatch.setattr(dbc, "execute", fake)
    monkeypatch.setattr(pg, "get_user_plan", plan)
    out = asyncio.run(rr.log_business_action("b1", "add_faq", "FAQ 등록", {"id": "u1"}))
    return out, inserted


def test_action_log_records_score_before_when_measured(monkeypatch):
    out, ins = _post_action_log(monkeypatch, [_MEASURED])
    assert out["ok"] is True and out["score_before"] == 64.5 and ins[0]["score_before"] == 64.5


def test_action_log_leaves_score_before_empty_when_latest_scan_was_unmeasured(monkeypatch):
    out, ins = _post_action_log(monkeypatch, [_BLOCKED])
    assert out["ok"] is True and out["score_before"] is None and ins[0]["score_before"] is None


def test_action_log_survives_a_lookup_failure(monkeypatch):
    out, ins = _post_action_log(monkeypatch, None, fail=True)
    assert out["ok"] is True and out["score_before"] is None


# ── 행동 완료 추적(actions.py) ───────────────────────────────────────────────────
def _complete_action(monkeypatch, scan_row):
    import routers.actions as ra

    inserted = []

    class Res:
        def __init__(self, data):
            self.data = data

    class Q2:
        def __init__(self, name):
            self.name = name

        def __getattr__(self, n):
            if n in ("select", "eq", "order", "limit", "maybe_single", "single"):
                return lambda *a, **k: self
            raise AttributeError(n)

        def insert(self, payload):
            inserted.append(payload)
            return self

        def execute(self):
            if self.name == "businesses":
                return Res({"id": "b1", "user_id": "u1", "name": "가게", "region": "서울", "category": "restaurant", "keywords": []})
            if self.name == "scan_results":
                return Res(scan_row)
            return Res([{"id": "a1"}])

    class SB:
        def table(self, name):
            return Q2(name)

    monkeypatch.setattr(ra, "get_client", lambda: SB())
    body = ra.ActionCompleteRequest(business_id="b1", action_type="faq_keyword", keyword="성수 맛집")
    asyncio.run(ra.complete_action(body, {"id": "u1"}))
    return inserted[0]


_GEMINI_HIT = {"mentioned": True, "exposure_freq": 0.2}


def test_complete_action_records_before_score_when_measured(monkeypatch):
    row = {"id": "s1", "gemini_result": _GEMINI_HIT, **_MEASURED}
    ins = _complete_action(monkeypatch, row)
    assert ins["before_score"] == 64.5 and ins["before_mentioned"] is True


def test_complete_action_unmeasured_scan_keeps_gemini_fact_but_not_the_score(monkeypatch):
    row = {"id": "s1", "gemini_result": _GEMINI_HIT, **_BLOCKED}
    ins = _complete_action(monkeypatch, row)
    assert ins["before_score"] is None                       # 척도가 다른 점수는 끝점으로 저장하지 않는다
    assert ins["before_mentioned"] is True                   # Gemini 노출 여부는 네이버와 무관한 사실이라 그대로


def test_complete_action_without_any_scan(monkeypatch):
    ins = _complete_action(monkeypatch, None)
    assert ins["before_score"] is None and ins["before_mentioned"] is None


# ── 구조 ───────────────────────────────────────────────────────────────────────
def test_the_three_before_score_sources_use_the_guarded_readers():
    import inspect
    import routers.actions as ra
    import routers.delivery as rd
    import routers.report as rr
    assert "score_of_row_if_measured(scan_row.data)" in inspect.getsource(ra.complete_action)
    assert "latest_measured_score(get_client(), business_id)" in inspect.getsource(rd._get_latest_business_score)
    assert "latest_measured_score(supabase, biz_id)" in inspect.getsource(rr.log_business_action)
    # 점수 이력 최신 행을 그대로 읽던 옛 방식이 행동 로그에 남아 있지 않다
    assert '.select("unified_score, total_score")' not in inspect.getsource(rr.log_business_action)
