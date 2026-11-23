"""크렙 답변(2026-11-24) 반영: 타임아웃·처리 중이면 '실패'가 아니라 '모름'으로 다뤄 이중 청구를 막는다."""
import asyncio

from services import creb_client
from services.creb_client import CrebResult


def _run(coro):
    return asyncio.run(coro)


def _patch_order(monkeypatch, data, ok=True):
    calls = []

    async def fake_get_order(order_id):
        calls.append(order_id)
        return CrebResult(ok=ok, data=data)

    monkeypatch.setattr(creb_client, "get_order", fake_get_order)
    return calls


def test_success_and_duplicate_are_approved(monkeypatch):
    calls = _patch_order(monkeypatch, {})
    res = CrebResult(ok=True, data={"duplicate": True, "transactionNumber": "t1"})
    assert _run(creb_client.settle_uncertain_billpay("o", res))[0] == "approved"
    assert calls == []


def test_card_decline_is_failed_without_lookup(monkeypatch):
    calls = _patch_order(monkeypatch, {})
    res = CrebResult(ok=False, code="1234", msg="한도초과")
    assert _run(creb_client.settle_uncertain_billpay("o", res))[0] == "failed"
    assert calls == []


def test_timeout_but_actually_approved(monkeypatch):
    _patch_order(monkeypatch, {"order_status": "APPROVED", "transactionNumber": "t9"})
    state, res = _run(creb_client.settle_uncertain_billpay("o", CrebResult(ok=False, code="NETWORK")))
    assert state == "approved" and res.ok and res.data["transactionNumber"] == "t9"


def test_timeout_not_found_or_failed_allows_retry(monkeypatch):
    for st in ("NOT_FOUND", "FAILED"):
        _patch_order(monkeypatch, {"order_status": st})
        assert _run(creb_client.settle_uncertain_billpay("o", CrebResult(ok=False, code="NETWORK")))[0] == "failed"


def test_timeout_and_lookup_unreadable_is_pending(monkeypatch):
    _patch_order(monkeypatch, {}, ok=False)
    assert _run(creb_client.settle_uncertain_billpay("o", CrebResult(ok=False, code="NETWORK")))[0] == "pending"


def test_in_progress_and_needs_review_are_pending(monkeypatch):
    _patch_order(monkeypatch, {"order_status": "NOT_FOUND"})
    inprog = CrebResult(ok=False, data={"error_code": "ORDER_IN_PROGRESS"})
    review = CrebResult(ok=False, data={"error_code": "ORDER_NEEDS_REVIEW"})
    assert _run(creb_client.settle_uncertain_billpay("o", inprog))[0] == "pending"
    assert _run(creb_client.settle_uncertain_billpay("o", review))[0] == "pending"


def test_order_get_signature_fields(monkeypatch):
    sent = {}

    async def fake_post(path, body):
        sent["path"], sent["body"] = path, body
        return CrebResult(ok=True, data={})

    monkeypatch.setattr(creb_client, "_post", fake_post)
    monkeypatch.setenv("CREB_SID", "s")
    monkeypatch.setenv("CREB_SECRET_KEY", "k")
    _run(creb_client.get_order("ORD1"))
    b = sent["body"]
    assert sent["path"] == "/v1/pay/order/get"
    assert b["signature"] == creb_client.make_signature(
        [("sid", "s"), ("order_id", "ORD1"), ("timestamp", b["timestamp"])]
    )
