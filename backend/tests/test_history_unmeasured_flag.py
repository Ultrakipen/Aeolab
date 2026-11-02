"""이력·성장 리포트의 '처음 대비 개선/하락' 비교가 네이버 측정이 빠진 스캔을 끝점으로 쓰지 않는다 (2026-11-02).

측정이 빠진 스캔의 점수는 항목이 제외·재정규화돼 다른 스캔과 척도가 다르다(같은 가게 시험 64.5 ↔ 54.6).
이전에는 이력/성장 리포트가 첫·마지막 스캔을 그대로 비교해 마지막 스캔이 차단일이면 "노출이 줄었습니다. 가장 큰 원인은 …"을 단정했고,
첫 스캔이 차단일이면 그 어긋남이 영구히 남았다. 화면(GrowthClient)도 같은 규칙을 따른다 — 이력 응답의 행마다 naver_unmeasured를 준다.
"""
import asyncio
import itertools
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.score_engine import naver_result_unmeasured, naver_unmeasured_from_json_fields  # noqa: E402

_OK = {"mentioned": False, "in_briefing": False}
_BLOCKED = {"error": "naver_search_cooldown", "quota_skipped": True}


# ── JSON 연산자 판정 = naver_result_unmeasured ────────────────────────────────────
def _as_json_text(nr):
    """PostgREST `naver_result->>error` 등이 돌려주는 값 모양(문자열 또는 None)을 흉내."""
    def g(k):
        if not isinstance(nr, dict) or k not in nr or nr[k] is None:
            return None
        v = nr[k]
        return ("true" if v else "false") if isinstance(v, bool) else str(v)
    return g("error"), g("captcha_detected"), g("quota_skipped")


_CASES = [
    None, {}, _OK, _BLOCKED,
    {"captcha_detected": True}, {"captcha_detected": False},
    {"error": "page_load_failed"}, {"error": ""}, {"error": None},
    {"quota_skipped": True}, {"quota_skipped": False},
    {"mentioned": True, "rank": 2},
    {"captcha_detected": False, "error": None, "quota_skipped": False, "mentioned": False},
    {"captcha_detected": True, "error": "x", "quota_skipped": True},
]


@pytest.mark.parametrize("nr", _CASES)
def test_json_field_rule_matches_the_dict_rule(nr):
    assert naver_unmeasured_from_json_fields(*_as_json_text(nr)) is naver_result_unmeasured(nr)


def test_json_field_rule_exhaustive_over_flag_combinations():
    for cap, err, quota in itertools.product([None, True, False], [None, "", "page_load_failed"], [None, True, False]):
        nr = {k: v for k, v in (("captcha_detected", cap), ("error", err), ("quota_skipped", quota)) if v is not None}
        assert naver_unmeasured_from_json_fields(*_as_json_text(nr)) is naver_result_unmeasured(nr), nr


# ── 가짜 DB ─────────────────────────────────────────────────────────────────────
class _R:
    def __init__(self, data=None):
        self.data = data


class _Q:
    def __init__(self, table):
        self.table_name = table
        self.selected = None

    def __getattr__(self, name):
        if name == "not_":
            return self
        return lambda *a, **k: self

    def select(self, cols, *a, **k):
        self.selected = cols
        return self

    def maybe_single(self):
        self.single = True
        return self


class _SB:
    def __init__(self):
        self.queries = []

    def table(self, name):
        q = _Q(name)
        self.queries.append(q)
        return q


# ── /history ────────────────────────────────────────────────────────────────────
def _run_history(monkeypatch, scan_rows):
    import middleware.plan_gate as pg
    import routers.report as rr
    import services.db_paging as dbp

    sb = _SB()

    async def fake_fetch(build, max_rows=None):
        q = build()
        if q.table_name == "scan_results":
            return [dict(r) for r in scan_rows], False
        return [], False

    async def fake_verify(*a, **k):
        return None

    async def fake_plan(uid, supabase):
        return "pro"

    monkeypatch.setattr(rr, "get_client", lambda: sb)
    monkeypatch.setattr(rr, "_verify_biz_ownership", fake_verify)
    monkeypatch.setattr(pg, "get_user_plan", fake_plan)
    monkeypatch.setattr(dbp, "fetch_all_rows", fake_fetch)
    out = asyncio.run(rr.get_history("b1", {"id": "u1"}))
    return out, sb


def test_history_rows_carry_a_flag_and_no_helper_columns(monkeypatch):
    rows = [
        {"scanned_at": "2026-11-01T17:00:00+00:00", "unified_score": 54.6, "nr_error": "naver_search_cooldown", "nr_captcha": None, "nr_quota": "true"},
        {"scanned_at": "2026-10-29T17:00:00+00:00", "unified_score": 64.5, "nr_error": None, "nr_captcha": None, "nr_quota": None},
        {"scanned_at": "2026-10-26T17:00:00+00:00", "unified_score": 63.0, "nr_error": None, "nr_captcha": "true", "nr_quota": None},
    ]
    out, _ = _run_history(monkeypatch, rows)
    assert [r["naver_unmeasured"] for r in out] == [True, False, True]
    assert all(not k.startswith("nr_") for r in out for k in r)          # 내부용 열은 응답에 새지 않는다


def test_history_select_reads_only_the_needed_json_fields_not_the_whole_blob(monkeypatch):
    seen = {}
    import routers.report as rr
    import services.db_paging as dbp
    import middleware.plan_gate as pg

    async def fake_fetch(build, max_rows=None):
        q = build()
        seen.setdefault(q.table_name, q.selected)
        return [], False

    async def ok(*a, **k):
        return None

    async def plan(*a, **k):
        return "pro"

    monkeypatch.setattr(rr, "get_client", lambda: _SB())
    monkeypatch.setattr(rr, "_verify_biz_ownership", ok)
    monkeypatch.setattr(pg, "get_user_plan", plan)
    monkeypatch.setattr(dbp, "fetch_all_rows", fake_fetch)
    asyncio.run(rr.get_history("b1", {"id": "u1"}))
    sel = seen["scan_results"]
    assert "nr_error:naver_result->>error" in sel and "nr_captcha:naver_result->>captcha_detected" in sel and "nr_quota:naver_result->>quota_skipped" in sel
    assert ", naver_result," not in sel and not sel.endswith("naver_result")        # 큰 JSON 전체는 읽지 않는다


# ── 성장 리포트 ──────────────────────────────────────────────────────────────────
def _scan(day, score, naver, stage="growth"):
    return {
        "id": f"s{day}", "scanned_at": f"2026-10-{day:02d}T17:00:00+00:00", "unified_score": score, "track1_score": score, "track2_score": score,
        "score_breakdown": {"review_quality": score, "user_group": "ACTIVE"}, "growth_stage": stage,
        "top_missing_keywords": [], "naver_weight": 0.8, "global_weight": 0.2, "naver_result": naver, "competitor_scores": {},
    }


_biz_counter = itertools.count(1)


def _run_growth(monkeypatch, scans):
    import middleware.plan_gate as pg
    import routers.report as rr

    biz_id = f"growth-biz-{next(_biz_counter)}"          # 모듈 캐시(30분)가 테스트 사이에 섞이지 않게 사업장마다 다른 키

    class SB(_SB):
        pass

    async def fake_exec(q):
        if q.table_name == "businesses":
            return _R({"id": biz_id, "name": "가게", "category": "restaurant", "region": "서울", "user_id": "u1"})
        if q.table_name == "scan_results":
            return _R([dict(s) for s in scans])
        return _R([])

    async def fake_plan(uid, supabase):
        return "pro"

    monkeypatch.setattr(rr, "get_client", lambda: SB())
    monkeypatch.setattr(rr, "execute", fake_exec)
    monkeypatch.setattr(pg, "get_user_plan", fake_plan)
    return asyncio.run(rr.get_growth_report(biz_id, {"id": "u1", "email": ""}))


def test_growth_latest_scan_blocked_uses_the_last_measured_scan(monkeypatch):
    """마지막 스캔이 차단일(점수 40) — 이전에는 60→40으로 '노출이 줄었습니다. 가장 큰 원인은…'을 단정했다."""
    r = _run_growth(monkeypatch, [_scan(1, 50.0, _OK), _scan(10, 60.0, _OK), _scan(11, 40.0, _BLOCKED)])
    assert r["summary"]["start_score"] == 50.0 and r["summary"]["current_score"] == 60.0       # 정상 측정된 스캔 기준
    assert r["summary"]["total_delta"] == 10.0
    assert r["headline_type"] == "growth" and "줄었" not in r["headline"]
    assert [t["naver_unmeasured"] for t in r["timeline"]] == [False, False, True]


def test_growth_first_scan_blocked_does_not_poison_the_baseline_forever(monkeypatch):
    r = _run_growth(monkeypatch, [_scan(1, 40.0, _BLOCKED), _scan(5, 60.0, _OK), _scan(10, 62.0, _OK)])
    assert r["summary"]["start_score"] == 60.0              # 첫 '정상 측정' 스캔이 기준 — 차단일 점수(40)가 기준으로 남지 않는다
    # 2점 변화는 측정 오차 범위라 방향을 말하지 않는다(2026-11-02 기준 변경). 차단일 점수(40)가 기준으로 남았다면 변화가 22점으로 계산돼 "올랐다"가 나온다.
    assert r["summary"]["total_delta"] == 2.0 and r["headline_type"] == "stable"


def test_growth_a_real_decline_between_measured_scans_is_still_reported(monkeypatch):
    r = _run_growth(monkeypatch, [_scan(1, 70.0, _OK), _scan(10, 50.0, _OK)])
    assert r["headline_type"] == "decline" and r["summary"]["total_delta"] == -20.0


def test_growth_all_scans_blocked_makes_no_trend_claim(monkeypatch):
    r = _run_growth(monkeypatch, [_scan(1, 40.0, _BLOCKED), _scan(10, 30.0, _BLOCKED)])
    assert r["headline_type"] == "insufficient_data"
    assert all(d["delta"] == 0 for d in r["growth_drivers"])                      # 항목별 증감 방향도 단정하지 않는다


def test_growth_one_measured_scan_is_not_enough_for_a_trend(monkeypatch):
    r = _run_growth(monkeypatch, [_scan(1, 60.0, _OK), _scan(11, 40.0, _BLOCKED)])
    assert r["headline_type"] == "insufficient_data" and r["summary"]["total_delta"] == 0.0


def test_growth_without_any_scans_is_unchanged(monkeypatch):
    r = _run_growth(monkeypatch, [])
    assert r["timeline"] == [] and r["summary"]["scan_count"] == 0
