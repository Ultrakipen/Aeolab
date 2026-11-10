"""재가입 반복 이용 방어 — 결제 경로 연결 시험 (2026-11-10).

① _is_first_time_subscriber: 같은 사업장(네이버·카카오·사업자번호)을 가진 다른 계정의 구독, 탈퇴 계정 해시 일치
② discount-eligibility API: 본인 판정만, 조회 실패는 None
③ issue_billing: 첫 달 할인 결제가 성공하면 이용 기록(정상가 결제는 기록 안 함), 기록 실패가 결제를 막지 않음
"""
import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from config.prices import DISCOUNT_TO_REGULAR
from models.schemas import BillingIssueRequest
from routers import webhook

DISCOUNT_AMOUNT = next(iter(DISCOUNT_TO_REGULAR))
REGULAR_AMOUNT = DISCOUNT_TO_REGULAR[DISCOUNT_AMOUNT]


class FakeDB:
    def __init__(self, subscriptions=None, businesses=None, profiles=None):
        self.t = {"subscriptions": subscriptions or [], "businesses": businesses or [], "profiles": profiles or [{"user_id": "me"}]}
        self.upserts = []


class Q:
    def __init__(self, db, table):
        self.db, self.table, self.f, self.op, self.payload = db, table, [], "select", None

    def select(self, *_a, **_k):
        return self

    def limit(self, *_a):
        return self

    def eq(self, k, v):
        self.f.append(("eq", k, v))
        return self

    def neq(self, k, v):
        self.f.append(("neq", k, v))
        return self

    def upsert(self, payload, on_conflict=None):
        self.op, self.payload = "upsert", payload
        return self


def _rows(db, q):
    out = []
    for r in db.t[q.table]:
        ok = True
        for op, k, v in q.f:
            if op == "eq" and r.get(k) != v:
                ok = False
            if op == "neq" and r.get(k) == v:
                ok = False
        if ok:
            out.append(dict(r))
    return out


def _wire(monkeypatch, db, guard_conflict=None):
    async def fake_execute(q):
        if q.op == "upsert":
            db.upserts.append(q.payload)
            return SimpleNamespace(data=[q.payload])
        return SimpleNamespace(data=_rows(db, q))

    monkeypatch.setattr(webhook, "execute", fake_execute)
    monkeypatch.setattr(webhook, "get_client", lambda: SimpleNamespace(table=lambda n: Q(db, n)))
    calls = {"conflict": [], "record": []}

    async def fake_conflict(purpose, uid, email):
        calls["conflict"].append((purpose, uid, email))
        return guard_conflict

    async def fake_record(purpose, uid, email):
        calls["record"].append((purpose, uid, email))
        return 3

    import services.discount_guard as dg
    monkeypatch.setattr(dg, "prior_use_conflict", fake_conflict)
    monkeypatch.setattr(dg, "record_use", fake_record)
    return calls


def run(c):
    return asyncio.run(c)


def biz(**kw):
    base = {"user_id": "me", "is_active": True, "naver_place_id": None, "kakao_place_id": None, "business_registration_no": None}
    base.update(kw)
    return base


# ── ① 자격 판정 ──
def test_own_subscription_history_blocks(monkeypatch):
    _wire(monkeypatch, FakeDB(subscriptions=[{"id": 1, "user_id": "me"}]))
    assert run(webhook._is_first_time_subscriber("me", "a@b.co")) is False


def test_same_naver_place_other_account_subscribed_blocks(monkeypatch):
    db = FakeDB(businesses=[biz(naver_place_id="111"), biz(user_id="other", naver_place_id="111")],
                subscriptions=[{"id": 1, "user_id": "other"}])
    _wire(monkeypatch, db)
    assert run(webhook._is_first_time_subscriber("me", "a@b.co")) is False


def test_same_kakao_place_other_account_subscribed_blocks_even_without_naver_id(monkeypatch):
    """수정 전에는 네이버 플레이스 ID가 없으면 곧바로 신규로 봤다 — 카카오 ID로는 못 잡았다."""
    db = FakeDB(businesses=[biz(kakao_place_id="222"), biz(user_id="other", kakao_place_id="222")],
                subscriptions=[{"id": 1, "user_id": "other"}])
    _wire(monkeypatch, db)
    assert run(webhook._is_first_time_subscriber("me", "a@b.co")) is False


def test_same_business_registration_no_blocks(monkeypatch):
    db = FakeDB(businesses=[biz(business_registration_no="1234567890"), biz(user_id="other", business_registration_no="1234567890")],
                subscriptions=[{"id": 1, "user_id": "other"}])
    _wire(monkeypatch, db)
    assert run(webhook._is_first_time_subscriber("me", "a@b.co")) is False


def test_second_business_of_same_account_is_also_checked(monkeypatch):
    db = FakeDB(businesses=[biz(naver_place_id="111"), biz(naver_place_id="999"), biz(user_id="other", naver_place_id="999")],
                subscriptions=[{"id": 1, "user_id": "other"}])
    _wire(monkeypatch, db)
    assert run(webhook._is_first_time_subscriber("me", "a@b.co")) is False


def test_same_place_but_other_account_never_subscribed_is_allowed(monkeypatch):
    db = FakeDB(businesses=[biz(naver_place_id="111"), biz(user_id="other", naver_place_id="111")], subscriptions=[])
    _wire(monkeypatch, db)
    assert run(webhook._is_first_time_subscriber("me", "a@b.co")) is True


def test_no_business_identifiers_still_consults_deleted_account_guard(monkeypatch):
    calls = _wire(monkeypatch, FakeDB(businesses=[biz()]))
    assert run(webhook._is_first_time_subscriber("me", "a@b.co")) is True
    assert calls["conflict"] == [("discount", "me", "a@b.co")]


def test_deleted_account_hash_match_blocks(monkeypatch):
    _wire(monkeypatch, FakeDB(businesses=[biz(naver_place_id="111")]), guard_conflict="naver_place")
    assert run(webhook._is_first_time_subscriber("me", "a@b.co")) is False


# ── ② 자격 조회 API ──
def test_eligibility_endpoint_reports_boolean(monkeypatch):
    _wire(monkeypatch, FakeDB(businesses=[biz()]))
    assert run(webhook.discount_eligibility({"id": "me", "email": "a@b.co"})) == {"eligible": True}
    _wire(monkeypatch, FakeDB(businesses=[biz()]), guard_conflict="email")
    assert run(webhook.discount_eligibility({"id": "me", "email": "a@b.co"})) == {"eligible": False}


def test_eligibility_endpoint_returns_none_on_failure(monkeypatch):
    async def boom(*_a, **_k):
        raise RuntimeError("db down")
    monkeypatch.setattr(webhook, "_is_first_time_subscriber", boom)
    assert run(webhook.discount_eligibility({"id": "me", "email": "a@b.co"})) == {"eligible": None}


# ── ③ 결제 성공 시 이용 기록 ──
def _pay_env(monkeypatch, db, calls):
    async def fake_issue(auth_key):
        return SimpleNamespace(ok=True, code="", msg="", data={"billKey": "bk", "cardCompany": "X", "cardNumber": "1234-****"})

    async def fake_pay(**k):
        return SimpleNamespace(ok=True, code="", msg="", data={"transactionNumber": "tid1"})

    async def not_blocked(_uid):
        return None

    async def not_subscribed(_uid, _amt):
        return False

    async def no_recent(*_a, **_k):
        return None

    async def noop_event(*_a, **_k):
        return None

    async def buyer(_uid, _email=None):
        return {"name": "n", "phone": "010", "email": "e@e.co"}

    monkeypatch.setattr(webhook.creb_client, "issue_billkey", fake_issue)
    monkeypatch.setattr(webhook.creb_client, "billpay", fake_pay)
    monkeypatch.setattr(webhook, "_already_subscribed_same_plan", not_subscribed)
    monkeypatch.setattr(webhook, "_check_billing_issue_rate_limit", lambda ip: None)
    import services.capacity_gate as cg
    import services.creb_billing as cb
    import utils.payment_event_log as pel
    monkeypatch.setattr(cg, "new_subscriber_blocked", not_blocked)
    monkeypatch.setattr(cb, "get_buyer_info", buyer)
    monkeypatch.setattr(pel, "find_recent_success_event", no_recent)
    monkeypatch.setattr(pel, "record_payment_event", noop_event)


def _call(amount):
    body = BillingIssueRequest(authKey="ak", plan="Basic", amount=amount)
    req = SimpleNamespace(client=SimpleNamespace(host="1.2.3.4"))
    return run(webhook.issue_billing(body, req, {"id": "me", "email": "a@b.co"}))


def test_discounted_payment_success_records_use_before_saving_subscription(monkeypatch):
    db = FakeDB(businesses=[biz(naver_place_id="111")])
    calls = _wire(monkeypatch, db)
    _pay_env(monkeypatch, db, calls)
    out = _call(DISCOUNT_AMOUNT)
    assert out["status"] == "success" and out["discount_applied"] is True
    assert calls["record"] == [("discount", "me", "a@b.co")]
    assert len(db.upserts) == 1     # 구독도 저장됨


def test_regular_price_payment_does_not_record_use(monkeypatch):
    db = FakeDB(businesses=[biz(naver_place_id="111")])
    calls = _wire(monkeypatch, db)
    _pay_env(monkeypatch, db, calls)
    out = _call(REGULAR_AMOUNT)
    assert out["discount_applied"] is False
    assert calls["record"] == []


def test_blocked_by_guard_returns_400_and_never_touches_card(monkeypatch):
    db = FakeDB(businesses=[biz(naver_place_id="111")])
    calls = _wire(monkeypatch, db, guard_conflict="naver_place")
    _pay_env(monkeypatch, db, calls)
    issued = {"n": 0}

    async def counting_issue(auth_key):
        issued["n"] += 1
        return SimpleNamespace(ok=True, code="", msg="", data={"billKey": "bk"})

    monkeypatch.setattr(webhook.creb_client, "issue_billkey", counting_issue)
    with pytest.raises(HTTPException) as e:
        _call(DISCOUNT_AMOUNT)
    assert e.value.status_code == 400 and issued["n"] == 0
    assert db.upserts == [] and calls["record"] == []


def test_regular_price_is_never_blocked_by_discount_guard(monkeypatch):
    db = FakeDB(businesses=[biz(naver_place_id="111")])
    calls = _wire(monkeypatch, db, guard_conflict="naver_place")   # 할인 이력이 있어도
    _pay_env(monkeypatch, db, calls)
    assert _call(REGULAR_AMOUNT)["status"] == "success"           # 정상가 결제는 가능
