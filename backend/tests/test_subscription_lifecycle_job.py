"""subscription_lifecycle_job 동작 시험 (2026-11-02) — 정기 갱신·유예·정지·이중청구 가드·운영자 알림.

이 잡은 매일 01:00에 돈을 청구하는데 지금까지 동작 시험이 없었다(과거 07-07 갱신 영구 미감지 P0, 07-11 이중청구 위험이 모두 이 잡).
크렙·DB·카카오·알림은 모두 가짜로 바꾼다 — 실제 결제·DB·메시지는 건드리지 않는다. 가짜 DB는 PostgREST처럼 날짜를 비교한다
(시각 포함 end_at '2026-11-02T00:00:00+00:00'은 날짜 '2026-11-02'와 같은 시각으로 본다).
"""
import asyncio
from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest

TODAY = date(2026, 11, 2)
D = lambda n: str(TODAY + timedelta(days=n))  # noqa: E731


def _dt(v):
    s = str(v)
    d = datetime.fromisoformat(s.replace("Z", "+00:00")) if len(s) > 10 else datetime.fromisoformat(s + "T00:00:00+00:00")
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def _cmp(a, b, op):
    try:
        x, y = _dt(a), _dt(b)
    except (ValueError, TypeError):
        x, y = str(a), str(b)
    return {"eq": x == y, "lte": x <= y}[op]


class FakeDB:
    def __init__(self, **tables):
        self.rows = {k: [dict(r) for r in v] for k, v in tables.items()}
        self.updates = []

    def table(self, name):
        return _Table(self, name)


class _Table:
    def __init__(self, db, name):
        self.db, self.name, self.filters, self.op, self.payload = db, name, [], "select", None

    def select(self, *a, **k):
        return self

    def update(self, payload):
        self.op, self.payload = "update", payload
        return self

    def eq(self, k, v):
        self.filters.append(("eq", k, v))
        return self

    def lte(self, k, v):
        self.filters.append(("lte", k, v))
        return self

    def in_(self, k, vals):
        self.filters.append(("in", k, list(vals)))
        return self

    def order(self, *a, **k):
        return self

    def limit(self, *a, **k):
        return self

    def range(self, *a, **k):
        return self

    def _match(self, r):
        for op, k, v in self.filters:
            cur = r.get(k)
            if op == "in":
                if cur not in v:
                    return False
            elif cur is None or not _cmp(cur, v, op):
                if not (op == "eq" and not isinstance(cur, str) and cur == v):
                    return False
        return True

    def execute(self):
        hit = [r for r in self.db.rows.get(self.name, []) if self._match(r)]
        if self.op == "update":
            for r in hit:
                r.update(self.payload)
                self.db.updates.append((self.name, r.get("id"), dict(self.payload)))
        return type("R", (), {"data": [dict(r) for r in hit]})()


class FakeKakao:
    calls: list = []

    def __init__(self):
        pass

    def __getattr__(self, name):
        async def rec(*a, **k):
            FakeKakao.calls.append((name, a))
        return rec


def sub(i, uid, status="active", end_at=None, plan="basic", cycle="monthly", grace_until=None, disc=None, key="bk"):
    return {"id": i, "user_id": uid, "plan": plan, "status": status, "billing_cycle": cycle, "end_at": end_at,
            "grace_until": grace_until, "first_month_discount_until": disc, "billing_key": key}


@pytest.fixture
def env(monkeypatch):
    """잡을 가짜 환경에서 돌리는 도구. run(rows, charge=...)로 실행하고 (db, 청구 호출 목록, 운영자 알림 목록)을 돌려준다."""
    import db.supabase_client as dbc
    import services.creb_billing as cb
    import services.email_sender as es
    import services.kakao_notify as kn
    import utils.payment_event_log as pel
    from scheduler import jobs

    def run(subs, charge=True, recent_success=None, phones=None):
        db = FakeDB(subscriptions=subs, profiles=[{"user_id": s["user_id"], "phone": (phones or {}).get(s["user_id"], "01012345678")} for s in subs])
        charged, op_alerts = [], []
        FakeKakao.calls = []

        async def fake_retry(s):
            charged.append(s["id"])
            if isinstance(charge, Exception):
                raise charge
            ok = charge(s) if callable(charge) else charge
            return ok

        async def fake_recent(*a, **k):
            return recent_success

        async def fake_op(subject, message):
            op_alerts.append((subject, message))
            return True

        monkeypatch.setattr(dbc, "get_client", lambda: db)
        monkeypatch.setattr(cb, "retry_billing", fake_retry)
        monkeypatch.setattr(kn, "KakaoNotifier", FakeKakao)
        monkeypatch.setattr(pel, "find_recent_success_event", fake_recent)
        monkeypatch.setattr(es, "send_operator_alert", fake_op)
        monkeypatch.setattr(jobs, "date", type("D", (date,), {"today": staticmethod(lambda: TODAY)}))
        slack = AsyncMock()
        monkeypatch.setattr(jobs, "send_slack_alert", slack)
        asyncio.run(jobs.subscription_lifecycle_job())
        return db, charged, op_alerts, slack

    return run


def row_of(db, i):
    return next(r for r in db.rows["subscriptions"] if r["id"] == i)


def test_renewal_success_extends_30_days_and_stays_active(env):
    db, charged, ops, _ = env([sub(1, "u1", end_at=D(0))])
    r = row_of(db, 1)
    assert charged == [1] and r["status"] == "active" and r["end_at"] == D(30)
    assert not [c for c in FakeKakao.calls if c[0] in ("send_payment_failed", "send_suspended")] and ops == []


def test_yearly_renewal_extends_365_days(env):
    db, _, _, _ = env([sub(1, "u1", end_at=D(0), cycle="yearly")])
    assert row_of(db, 1)["end_at"] == D(365)


def test_missed_days_are_still_picked_up_and_renew_from_today(env):
    db, charged, _, _ = env([sub(1, "u1", end_at=D(-2))])                         # 배치가 이틀 못 돈 경우(07-07 P0의 재발 방지)
    assert charged == [1] and row_of(db, 1)["end_at"] == D(30)


def test_only_due_active_rows_are_charged(env):
    rows = [sub(1, "a", end_at=D(1)), sub(2, "b", status="cancelled", end_at=D(-1)), sub(3, "c", status="suspended", end_at=D(-1)),
            sub(4, "d", status="expired", end_at=D(-1)), sub(5, "e", end_at=None), sub(6, "f", end_at=D(0))]
    db, charged, _, _ = env(rows)
    assert charged == [6]                                                           # 내일 만료·해지·정지·만료·만료일 없음은 청구하지 않는다
    assert row_of(db, 2)["status"] == "cancelled" and row_of(db, 5)["end_at"] is None


def test_timestamp_end_at_due_today_is_charged(env):
    _, charged, _, _ = env([sub(1, "u1", end_at=D(0) + "T00:00:00+00:00")])        # DB가 돌려주는 실제 저장 형식
    assert charged == [1]


def test_failed_renewal_enters_3_day_grace_and_tells_the_customer(env):
    db, charged, _, _ = env([sub(1, "u1", end_at=D(0))], charge=False)
    r = row_of(db, 1)
    assert r["status"] == "grace_period" and r["grace_until"] == D(3) and r["end_at"] == D(0)
    assert ("send_payment_failed", ("01012345678",)) in FakeKakao.calls
    assert charged == [1]                                                           # 방금 유예에 들어간 건 같은 실행에서 다시 청구하지 않는다


def test_grace_row_recovers_when_retry_succeeds(env):
    db, charged, _, _ = env([sub(1, "u1", status="grace_period", end_at=D(-1), grace_until=D(2))])
    r = row_of(db, 1)
    assert charged == [1] and r["status"] == "active" and r["end_at"] == D(30) and r["grace_until"] is None
    assert any(c[0] == "send_payment_recovered" for c in FakeKakao.calls)


def test_grace_row_keeps_waiting_until_grace_ends_then_suspends(env):
    db, _, _, _ = env([sub(1, "u1", status="grace_period", end_at=D(-2), grace_until=D(1))], charge=False)
    assert row_of(db, 1)["status"] == "grace_period" and not any(c[0] == "send_suspended" for c in FakeKakao.calls)
    db, _, _, _ = env([sub(1, "u1", status="grace_period", end_at=D(-4), grace_until=D(0))], charge=False)
    assert row_of(db, 1)["status"] == "suspended" and any(c[0] == "send_suspended" for c in FakeKakao.calls)


def test_double_charge_guard_reuses_recent_success_instead_of_charging(env):
    db, charged, _, _ = env([sub(1, "u1", end_at=D(0))], recent_success={"amount": 17900})
    assert charged == [] and row_of(db, 1)["end_at"] == D(30)                       # 어제 이미 청구 성공 → 재청구 없이 저장만


def test_one_failing_subscription_does_not_stop_the_others(env):
    def charge(s):
        if s["id"] == 1:
            raise RuntimeError("크렙 오류")
        return True
    db, charged, _, _ = env([sub(1, "a", end_at=D(0)), sub(2, "b", end_at=D(0))], charge=charge)
    assert charged == [1, 2] and row_of(db, 2)["end_at"] == D(30)


PHONES = {"a": "01011110000", "b": "01022220000", "c": "01033330000"}   # 사용자마다 다른 번호 — 누구에게 갔는지까지 단정하기 위해


def test_expiry_warning_is_sent_exactly_7_days_before_and_only_to_that_user(env):
    env([sub(1, "a", end_at=D(7)), sub(2, "b", end_at=D(6)), sub(3, "c", end_at=D(8))], phones=PHONES)
    warns = [c for c in FakeKakao.calls if c[0] == "send_expire_warning"]
    assert warns == [("send_expire_warning", ("01011110000", "basic", 7))]          # 6일·8일 남은 사람에게는 가지 않는다


def test_first_month_discount_notice_goes_out_3_days_before_the_discount_date_to_that_user_only(env):
    env([sub(1, "a", end_at=D(20), disc=D(3)), sub(2, "b", end_at=D(20), disc=D(4)), sub(3, "c", end_at=D(20), disc=D(2))], phones=PHONES)
    notices = [c for c in FakeKakao.calls if c[0] == "send_price_increase_notice"]
    assert len(notices) == 1 and notices[0][1][0] == "01011110000"


def test_three_day_extension_moves_the_charge_date_by_three_days(env, monkeypatch):
    """11-02 결정(3일 연장)의 핵심 가정: end_at에 3일을 더하면 청구도 3일 밀린다. 연장 도구가 만든 값을 이 잡에 그대로 넣어 확인한다."""
    import importlib.util, os
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts", "subscription_extend_days.py")
    spec = importlib.util.spec_from_file_location("sed", path)
    ext = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(ext)
    rows = [sub(1, "u1", end_at=D(0), disc=D(5))]
    changes, _ = ext.plan_changes([{**rows[0]}], today=TODAY)
    extended = {**rows[0], **changes[0]["new"]}
    db, charged, _, _ = env([extended])
    assert charged == [] and row_of(db, 1)["end_at"] == D(3)                        # 오늘은 청구하지 않는다
    extended["end_at"] = D(3)
    import scheduler.jobs as jobs
    later = TODAY + timedelta(days=3)
    monkeypatch.setattr(jobs, "date", type("D", (date,), {"today": staticmethod(lambda: later)}))
    import db.supabase_client as dbc
    db2 = FakeDB(subscriptions=[extended], profiles=[{"user_id": "u1", "phone": "01012345678"}])
    monkeypatch.setattr(dbc, "get_client", lambda: db2)
    asyncio.run(jobs.subscription_lifecycle_job())
    assert row_of(db2, 1)["end_at"] == str(later + timedelta(days=30))              # 3일 뒤 그날 청구되고 다음 만료가 그날+30일


def test_job_level_failure_alerts_the_operator(env, monkeypatch):
    import db.supabase_client as dbc

    def boom():
        raise RuntimeError("DB down")
    monkeypatch.setattr(dbc, "get_client", boom)
    from scheduler import jobs
    slack = AsyncMock()
    monkeypatch.setattr(jobs, "send_slack_alert", slack)
    asyncio.run(jobs.subscription_lifecycle_job())
    assert slack.await_count == 1 and "subscription_lifecycle_job" in slack.await_args.args[0]


# ── 운영자 알림(개별 갱신 실패·유예 진입·정지) ───────────────────────────────────────────────────────────────

def test_operator_is_alerted_when_a_renewal_fails_and_enters_grace(env):
    _, _, ops, _ = env([sub(1, "abcdef123456", end_at=D(0), plan="pro")], charge=False)
    assert len(ops) == 1
    subject, body = ops[0]
    assert "유예" in subject and "abcdef12" in body and "pro" in body and "29900" in body
    assert "abcdef123456" not in body and "01012345678" not in body              # 사용자 id는 앞 8자만, 전화번호는 담지 않는다


def test_operator_alert_notes_when_customer_has_no_phone_to_receive_the_notice(env):
    _, _, ops, _ = env([sub(1, "u1xxxxxxxx", end_at=D(0))], charge=False, phones={"u1xxxxxxxx": ""})
    assert len(ops) == 1 and "전화번호 없음" in ops[0][1]


def test_operator_is_alerted_when_a_subscription_is_suspended(env):
    _, _, ops, _ = env([sub(1, "u1xxxxxxxx", status="grace_period", end_at=D(-4), grace_until=D(0))], charge=False)
    assert len(ops) == 1 and "정지" in ops[0][0]


def test_no_operator_alert_on_success_or_while_grace_is_still_waiting(env):
    _, _, ops, _ = env([sub(1, "a", end_at=D(0)), sub(2, "b", status="grace_period", end_at=D(-2), grace_until=D(1))], charge=lambda s: s["id"] == 1)
    assert ops == []                                                                # 성공·유예 대기(다음 날 재시도)는 사람이 개입할 일이 아니다


def test_alert_failure_never_breaks_renewal_processing(env, monkeypatch):
    import services.email_sender as es
    from scheduler import jobs

    async def broken(subject, message):
        raise RuntimeError("메일 서버 오류")
    db = FakeDB(subscriptions=[sub(1, "u1", end_at=D(0)), sub(2, "u2", end_at=D(0))], profiles=[{"user_id": "u1", "phone": "010"}, {"user_id": "u2", "phone": "010"}])
    import db.supabase_client as dbc
    import services.creb_billing as cb
    import services.kakao_notify as kn
    import utils.payment_event_log as pel

    async def fail(s):
        return False

    async def none(*a, **k):
        return None
    monkeypatch.setattr(dbc, "get_client", lambda: db)
    monkeypatch.setattr(cb, "retry_billing", fail)
    monkeypatch.setattr(kn, "KakaoNotifier", FakeKakao)
    monkeypatch.setattr(pel, "find_recent_success_event", none)
    monkeypatch.setattr(es, "send_operator_alert", broken)
    monkeypatch.setattr(jobs, "date", type("D", (date,), {"today": staticmethod(lambda: TODAY)}))
    monkeypatch.setattr(jobs, "send_slack_alert", AsyncMock())
    FakeKakao.calls = []
    asyncio.run(jobs.subscription_lifecycle_job())
    assert all(row_of(db, i)["status"] == "grace_period" for i in (1, 2))           # 알림이 터져도 둘 다 유예 처리
    assert len([c for c in FakeKakao.calls if c[0] == "send_payment_failed"]) == 2   # 고객 알림도 둘 다 나감
