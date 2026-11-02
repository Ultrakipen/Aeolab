"""정기 알림톡 발송 간격 (2026-11-02, services/notify_cadence).

운영자 계정에서 매일 3~4건이 온다는 문제 — "이달 할 일"·AI 인용·점수 변화가 daily_kakao_notify(매일 09:10)마다 갔다.
- 전달 성공이 확인된 때만 기록하고, 기록이 있는 동안(28/14/7일)은 보내지 않는다. 실패는 기록하지 않아 다음 실행에 재시도된다.
- 기록을 읽지 못하면 보내지 않는다.
"""
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scheduler import jobs  # noqa: E402
from services import notify_cadence as cad  # noqa: E402


# ── 가짜 DB (사업장·유형·시각 필터를 실제로 적용한다) ──────────────────────────────────
class _R:
    def __init__(self, data):
        self.data = data


class _Q:
    def __init__(self, db, name):
        self.db, self.name, self.op, self.payload = db, name, "select", None
        self.eqs, self.gtes = {}, {}

    def select(self, *a, **k): return self
    def eq(self, c, v): self.eqs[c] = v; return self
    def gte(self, c, v): self.gtes[c] = v; return self
    def in_(self, *a, **k): return self
    def order(self, *a, **k): return self
    def limit(self, *a, **k): return self
    def is_(self, *a, **k): return self
    @property
    def not_(self): return self
    def insert(self, payload):
        self.op, self.payload = "insert", payload
        return self


class FakeDB:
    def __init__(self, tables):
        self.tables = tables
        self.fail_reads = False
        self.fail_writes = False

    def table(self, name): return _Q(self, name)

    async def run(self, q):
        if q.op == "insert":
            if self.fail_writes:
                raise RuntimeError("insert failed")
            row = dict(q.payload)
            row.setdefault("sent_at", datetime.now(timezone.utc).isoformat())
            self.tables.setdefault(q.name, []).append(row)
            return _R([row])
        if self.fail_reads and q.name == "notifications":
            raise RuntimeError("read failed")
        rows = self.tables.get(q.name, [])
        for c, v in q.eqs.items():
            rows = [r for r in rows if r.get(c) == v] if any(c in r for r in rows) else rows
        for c, v in q.gtes.items():
            rows = [r for r in rows if c not in r or str(r[c]) >= str(v)]
        return _R(rows)


def _tables(extra=None):
    now = datetime.now(timezone.utc).isoformat()
    t = {
        "score_history": [{"total_score": 60.0, "score_date": "2026-11-02", "rank_in_category": 2},
                          {"total_score": 50.0, "score_date": "2026-11-01", "rank_in_category": 3}],      # 변화 10점
        "ai_citations": [{"platform": "ChatGPT", "query": "창원 작곡", "excerpt": "x", "mentioned": True, "created_at": now}],
        "guides": [{"items_json": [{"title": "소개글 보강"}]}],
        "scan_results": [],
        "notifications": [],
    }
    t.update(extra or {})
    return t


class Notifier:
    def __init__(self, ok=True):
        self.ok, self.calls = ok, []

    async def send_score_change(self, *a, **k): self.calls.append("score_change"); return self.ok
    async def send_ai_citation(self, *a, **k): self.calls.append("ai_citation"); return self.ok
    async def send_action_items(self, *a, **k): self.calls.append("action_items"); return self.ok
    async def send_competitor_change(self, *a, **k): self.calls.append("competitor"); return self.ok


def _run(monkeypatch, db, notifier):
    import services.change_signal_guard as g

    async def flags(supabase, biz_id):
        return [False, False]                                  # 두 스캔 모두 네이버 정상 측정 → 점수 변화 알림 대상

    async def fake_db(q):
        return await db.run(q)

    monkeypatch.setattr(g, "recent_naver_unmeasured_flags", flags)
    monkeypatch.setattr(jobs, "_db", fake_db)
    user = {"businesses": [{"id": "b1", "name": "내가게"}], "user_id": "u1",
            "profiles": {"phone": "01012345678", "kakao_scan_notify": True, "kakao_competitor_notify": True}}
    asyncio.run(jobs._send_kakao_notifications(db, notifier, user))
    return notifier.calls


def test_first_run_sends_then_second_run_is_blocked(monkeypatch):
    db = FakeDB(_tables())
    assert sorted(_run(monkeypatch, db, Notifier())) == ["action_items", "ai_citation", "score_change"]
    recorded = sorted(r["type"] for r in db.tables["notifications"])
    assert recorded == ["cadence_action_items", "cadence_ai_citation", "cadence_score_change"]
    assert all(r["business_id"] == "b1" for r in db.tables["notifications"])
    assert _run(monkeypatch, db, Notifier()) == []             # 다음 날 같은 조건이어도 보내지 않는다 (이전엔 매일 갔다)


def test_failed_delivery_is_not_recorded_so_it_is_retried(monkeypatch):
    db = FakeDB(_tables())
    assert len(_run(monkeypatch, db, Notifier(ok=False))) == 3
    assert db.tables["notifications"] == []
    assert len(_run(monkeypatch, db, Notifier(ok=True))) == 3


def test_each_kind_reopens_after_its_own_interval(monkeypatch):
    now = datetime.now(timezone.utc)
    old = lambda kind, days: {"business_id": "b1", "type": f"cadence_{kind}", "sent_at": (now - timedelta(days=days)).isoformat()}
    db = FakeDB(_tables({"notifications": [old("action_items", 29), old("ai_citation", 10), old("score_change", 8)]}))
    # 28일 지난 할 일·7일 지난 점수 변화는 다시 가능, 14일 안의 AI 인용은 아직 막힘
    assert sorted(_run(monkeypatch, db, Notifier())) == ["action_items", "score_change"]


def test_unreadable_records_block_sending(monkeypatch):
    db = FakeDB(_tables())
    db.fail_reads = True
    assert _run(monkeypatch, db, Notifier()) == []             # 확인 못 하면 보내지 않는다


def test_other_business_records_do_not_block(monkeypatch):
    db = FakeDB(_tables({"notifications": [{"business_id": "other", "type": "cadence_action_items",
                                            "sent_at": datetime.now(timezone.utc).isoformat()}]}))
    assert "action_items" in _run(monkeypatch, db, Notifier())


# ── 헬퍼 단위 ────────────────────────────────────────────────────────────────────────
def test_env_override_and_invalid_value(monkeypatch):
    assert cad.min_days("action_items") == 28 and cad.min_days("ai_citation") == 14 and cad.min_days("score_change") == 7
    monkeypatch.setenv("NOTIFY_MIN_DAYS_AI_CITATION", "3")
    assert cad.min_days("ai_citation") == 3
    monkeypatch.setenv("NOTIFY_MIN_DAYS_AI_CITATION", "abc")
    assert cad.min_days("ai_citation") == 14
    monkeypatch.setenv("NOTIFY_MIN_DAYS_AI_CITATION", "-5")
    assert cad.min_days("ai_citation") == 14


def test_zero_days_disables_the_limit(monkeypatch):
    monkeypatch.setenv("NOTIFY_MIN_DAYS_SCORE_CHANGE", "0")
    db = FakeDB(_tables({"notifications": [{"business_id": "b1", "type": "cadence_score_change", "sent_at": datetime.now(timezone.utc).isoformat()}]}))
    assert "score_change" in _run(monkeypatch, db, Notifier())


def test_mark_sent_failure_never_raises():
    db = FakeDB({})
    db.fail_writes = True

    async def fake_db(q):
        return await db.run(q)

    assert asyncio.run(cad.mark_sent(fake_db, db, "b1", "action_items")) is False


# ── 주간 성적표와의 연동(소스 대조) ───────────────────────────────────────────────────
def test_weekly_report_starts_the_score_change_interval():
    import inspect
    src = inspect.getsource(jobs.weekly_score_report_job)
    assert "_weekly_ok = await notifier.send_weekly_score_report(" in src
    assert 'mark_sent(_exec, supabase, biz_id, "score_change")' in src
