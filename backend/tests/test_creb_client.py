"""크렙 결제 클라이언트 회귀 테스트 — 서명 규칙(문서 고정 벡터)과 '본문 status 기준 성공 판정'.

HTTP 200이어도 body.status가 false면 실패로 봐야 한다(토스 때의 'HTTP200=성공' 오판 재발 방지).
"""
import asyncio
import hashlib

import pytest

from services import creb_client


def test_signature_matches_doc_example():
    # docs.creb.co.kr/api-payment 의 서명 예시 문자열 (키 이름과 & 포함)
    raw = "sid=test_api&order_id=ORD20260904001&amount=10000&timestamp=1750127744700"
    sig = creb_client.make_signature(
        [("sid", "test_api"), ("order_id", "ORD20260904001"), ("amount", 10000), ("timestamp", "1750127744700")]
    )
    assert sig == hashlib.sha256(raw.encode()).hexdigest()
    assert len(sig) == 64 and sig == sig.lower()


def test_values_only_concat_would_differ():
    # 값만 이어 붙이면 실패한다는 문서 경고 — 키 이름 포함 문자열과 해시가 달라야 한다
    with_keys = creb_client.make_signature([("sid", "a"), ("tid", "b")])
    values_only = hashlib.sha256(b"ab").hexdigest()
    assert with_keys != values_only


class _FakeResp:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload
        self.text = str(payload)

    def json(self):
        return self._payload


class _FakeClient:
    resp: _FakeResp

    def __init__(self, *a, **k):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def post(self, url, json=None):
        return self.resp


def _run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


def test_http200_with_status_false_is_failure(monkeypatch):
    monkeypatch.setattr(creb_client.httpx, "AsyncClient", _FakeClient)
    _FakeClient.resp = _FakeResp(200, {"status": False, "code": "X1", "msg": "한도초과"})
    res = _run(creb_client.billpay(
        order_id="o1", billkey="k", amount=1000, goods_name="g", buyer_name="n", buyer_phone="01012345678"
    ))
    assert res.ok is False and res.code == "X1"


def test_success_requires_status_true(monkeypatch):
    monkeypatch.setattr(creb_client.httpx, "AsyncClient", _FakeClient)
    _FakeClient.resp = _FakeResp(200, {"status": True, "transactionNumber": "T1"})
    res = _run(creb_client.billpay(
        order_id="o1", billkey="k", amount=1000, goods_name="g", buyer_name="n", buyer_phone="01012345678"
    ))
    assert res.ok is True and res.data["transactionNumber"] == "T1"


def test_already_canceled_detected(monkeypatch):
    monkeypatch.setattr(creb_client.httpx, "AsyncClient", _FakeClient)
    _FakeClient.resp = _FakeResp(200, {"status": False, "error_code": "ALREADY_FULLY_CANCELED", "retriable": False})
    res = _run(creb_client.cancel_full("T1", 1000, "r"))
    assert res.ok is False and creb_client.is_already_canceled(res)
