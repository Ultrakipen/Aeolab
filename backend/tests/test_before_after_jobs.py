"""정기 잡이 저장하는 '행동 후'·'대행 후' 점수도 네이버 측정이 빠진 스캔의 것이면 비워 둔다 (2026-11-02).

대상 잡: _fill_action_score_after(7일 뒤 점수 채우기), check_action_rescans(행동 후 재스캔), delivery_30day_rescan_job(대행 30일 재스캔).
측정 빠진 스캔의 점수는 척도가 달라(같은 가게 시험 64.5 ↔ 54.6) '전' 점수와의 증감이 거짓이 된다 — 화면은 전/후가 둘 다 있을 때만 증감을 표시한다.
"""
import asyncio
import os
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import change_signal_guard as csg  # noqa: E402
from tests.test_before_after_measured import _Q, _R, _SB  # noqa: E402


class _JobQ(_Q):
    """update/insert 페이로드를 기록하는 쿼리."""

    def __init__(self, table, log):
        super().__init__(table)
        self._log = log
        self.is_update = False
        self.is_insert = False

    def update(self, payload):
        self._log.append((self.table_name, "update", payload))
        self.is_update = True
        return self

    def insert(self, payload):
        self._log.append((self.table_name, "insert", payload))
        self.is_insert = True
        return self

    def maybe_single(self):
        return self


class _JobSB(_SB):
    def __init__(self, log):
        super().__init__()
        self.log = log

    def table(self, name):
        q = _JobQ(name, self.log)
        self.queries.append(q)
        return q


def _patch_measured(monkeypatch, per_business):
    async def fake(supabase, business_id):
        return per_business.get(business_id)

    monkeypatch.setattr(csg, "latest_measured_score", fake)


# ═══ _fill_action_score_after ═══════════════════════════════════════════════════
def _run_fill(monkeypatch, logs, per_business):
    import db.supabase_client as dbc
    import scheduler.jobs as jobs

    log = []
    sb = _JobSB(log)

    async def fake_exec(q):
        if q.table_name == "business_action_log" and q.is_update:
            return _R([])
        if q.table_name == "business_action_log":
            return _R(logs)
        return _R([])

    monkeypatch.setattr(dbc, "get_client", lambda: sb)
    monkeypatch.setattr(dbc, "execute", fake_exec)
    _patch_measured(monkeypatch, per_business)
    asyncio.run(jobs._fill_action_score_after())
    return log, sb


def test_fill_after_score_writes_only_measured_scores(monkeypatch):
    logs = [{"id": "l1", "business_id": "b-ok", "action_date": "2026-10-26"},
            {"id": "l2", "business_id": "b-blocked", "action_date": "2026-10-26"}]
    log, _ = _run_fill(monkeypatch, logs, {"b-ok": 61.5, "b-blocked": None})
    assert [p for t, op, p in log if op == "update"] == [{"score_after": 61.5}]      # 측정 빠진 사업장은 비워 둔다(거짓 증감 방지)


def test_fill_after_score_zero_is_a_real_score(monkeypatch):
    log, _ = _run_fill(monkeypatch, [{"id": "l1", "business_id": "b0", "action_date": "2026-10-26"}], {"b0": 0.0})
    assert [p for t, op, p in log if op == "update"] == [{"score_after": 0.0}]       # falsy 0점을 건너뛰지 않는다


def test_fill_after_score_retries_for_a_week_after_the_seventh_day(monkeypatch):
    _, sb = _run_fill(monkeypatch, [], {})
    today = date.today()
    q = [x for x in sb.queries if x.table_name == "business_action_log"][0]
    assert q.has("gte", "action_date", (today - timedelta(days=14)).isoformat())
    assert q.has("lte", "action_date", (today - timedelta(days=7)).isoformat())
    assert q.has("is_", "score_after", "null")                                       # 이미 채운 행은 다시 건드리지 않는다


# ═══ check_action_rescans ═══════════════════════════════════════════════════════
def _run_rescan(monkeypatch, measured_score):
    import db.supabase_client as dbc
    import scheduler.jobs as jobs
    import services.ai_scanner.gemini_scanner as gs

    log = []

    class FakeGemini:
        async def sample_recommend(self, q, name, n=10):
            return {"sample_size": 10, "exposure_freq": 0.3}

    async def fake_db(q):
        t = q.table_name
        if t == "action_completions" and q.is_update:
            return _R([])
        if t == "action_completions":
            return _R([{"id": "a1", "business_id": "b1", "keyword": "성수 맛집", "action_type": "faq_keyword",
                        "before_score": 61.0, "before_mentioned": False}])
        if t == "businesses":
            return _R({"name": "가게", "region": "서울", "category": "restaurant"})
        return _R([])

    async def no_sleep(*a, **k):
        return None

    monkeypatch.setattr(dbc, "get_client", lambda: _JobSB(log))
    monkeypatch.setattr(jobs, "_db", fake_db)
    monkeypatch.setattr(gs, "GeminiScanner", FakeGemini)
    monkeypatch.setattr(asyncio, "sleep", no_sleep)
    _patch_measured(monkeypatch, {"b1": measured_score})
    asyncio.run(jobs.check_action_rescans())
    return [p for t, op, p in log if t == "action_completions" and op == "update"]


def test_rescan_stores_after_score_when_measured(monkeypatch):
    (upd,) = _run_rescan(monkeypatch, 66.0)
    assert upd["after_score"] == 66.0 and upd["after_mentioned"] is True and upd["rescan_done"] is True


def test_rescan_unmeasured_latest_scan_keeps_the_gemini_result_but_not_the_score(monkeypatch):
    (upd,) = _run_rescan(monkeypatch, None)
    assert upd["after_score"] is None                                   # 척도가 다른 점수는 '후' 끝점으로 저장하지 않는다
    assert upd["after_mentioned"] is True and upd["rescan_done"] is True and "노출" in upd["result_summary"]


# ═══ delivery_30day_rescan_job ══════════════════════════════════════════════════
def _run_delivery_rescan(monkeypatch, naver_result, existing_score_after=None):
    import db.supabase_client as dbc
    import scheduler.jobs as jobs
    import services.naver_visibility as nv

    log = []

    async def fake_db(q):
        t = q.table_name
        if t == "delivery_orders" and q.is_update:
            return _R([])
        if t == "delivery_orders":
            return _R([{"id": "o1", "business_id": "b1", "work_completed_at": "2026-09-01T00:00:00+00:00",
                        "score_after": existing_score_after}])
        if t == "businesses":
            return _R({"id": "b1", "name": "가게", "category": "restaurant", "region": "서울", "keywords": ["성수 맛집"], "user_id": "u1",
                       "is_smart_place": True, "has_recent_post": True, "has_intro": True, "review_count": 300, "avg_rating": 4.5})
        if t == "scan_results" and q.is_insert:
            return _R([{"id": "new-scan"}])
        if t == "scan_results":
            return _R({"gemini_result": {"mentioned": True, "exposure_freq": 0.2, "sample_size": 50},
                       "chatgpt_result": {"mentioned": False, "exposure_freq": 0.0, "sample_size": 50},
                       "naver_result": naver_result, "google_result": {}, "naver_channel_score": 50, "global_channel_score": 50,
                       "query_used": "서울 성수 맛집"})
        return _R(None)

    async def fake_vis(*a, **k):
        return {}

    monkeypatch.setattr(dbc, "get_client", lambda: _JobSB(log))
    monkeypatch.setattr(jobs, "_db", fake_db)
    monkeypatch.setattr(nv, "get_naver_visibility_multi", fake_vis)
    asyncio.run(jobs.delivery_30day_rescan_job())
    return [p for t, op, p in log if t == "delivery_orders" and op == "update"]


def test_delivery_rescan_records_score_after_when_the_reused_scan_was_measured(monkeypatch):
    (upd,) = _run_delivery_rescan(monkeypatch, {"mentioned": False, "in_briefing": False})
    assert upd["followup_scan_id"] == "new-scan" and isinstance(upd["score_after"], float)


def test_delivery_rescan_does_not_record_score_after_from_an_unmeasured_scan(monkeypatch):
    """재계산에 쓴 기존 스캔의 네이버 측정이 빠졌다면 그 점수는 '대행 후' 끝점이 아니다(공개 후기 score_delta가 거짓이 된다)."""
    (upd,) = _run_delivery_rescan(monkeypatch, {"error": "naver_search_cooldown", "quota_skipped": True})
    assert upd == {"followup_scan_id": "new-scan"}                      # 재스캔 완료 기록은 남기되 score_after는 비워 둔다


def test_delivery_rescan_never_overwrites_an_existing_score_after(monkeypatch):
    (upd,) = _run_delivery_rescan(monkeypatch, {"mentioned": False}, existing_score_after=70.0)
    assert "score_after" not in upd
