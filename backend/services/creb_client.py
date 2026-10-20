"""크렙(Krep) 결제 API 클라이언트 — https://docs.creb.co.kr/ (api-payment, web-payment)

토스페이먼츠에서 전환(2026-10-20). 모든 요청 body에 sid + secret_key + timestamp + signature를 싣는다.
signature = SHA-256(hex 소문자) of "key=value&key=value..." (키 이름과 & 포함, 엔드포인트별 필드 고정).
카드번호 직접 입력(키인)은 사용하지 않는다 — 빌링키는 크렙 SDK 카드등록창(auth_key) 방식만 사용하므로
우리 서버는 카드번호를 받지 않고 AES 암호화도 필요 없다.

성공 판정: HTTP 상태가 아니라 응답 body의 `status`가 True여야 한다(실패도 200으로 올 수 있음).
"""

import hashlib
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any

import httpx

logger = logging.getLogger("aeolab")

CREB_API_BASE = os.getenv("CREB_API_BASE", "https://payapi.creb.co.kr")


@dataclass
class CrebResult:
    ok: bool
    data: dict[str, Any] = field(default_factory=dict)
    code: str = ""
    msg: str = ""

    @property
    def error_code(self) -> str:
        """취소 API의 error_code(ALREADY_FULLY_CANCELED 등) 우선, 없으면 code."""
        return str(self.data.get("error_code") or self.code or "")


def _sid() -> str:
    return os.getenv("CREB_SID", "")


def _secret() -> str:
    return os.getenv("CREB_SECRET_KEY", "")


def is_configured() -> bool:
    return bool(_sid() and _secret())


def make_signature(pairs: list[tuple[str, Any]]) -> str:
    """문서 규칙: 'sid=..&order_id=..&...' 순서 고정 문자열의 SHA-256 소문자 hex(64자)."""
    raw = "&".join(f"{k}={v}" for k, v in pairs)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _now_ms() -> str:
    return str(int(time.time() * 1000))


async def _post(path: str, body: dict[str, Any]) -> CrebResult:
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(f"{CREB_API_BASE}{path}", json=body)
    except Exception as e:
        logger.error(f"[creb] {path} 요청 오류: {e}")
        return CrebResult(ok=False, code="NETWORK", msg=str(e))
    try:
        data = r.json()
    except Exception:
        logger.error(f"[creb] {path} 비-JSON 응답 status={r.status_code} body={r.text[:300]}")
        return CrebResult(ok=False, code=f"HTTP_{r.status_code}", msg=r.text[:300])
    if not isinstance(data, dict):
        return CrebResult(ok=False, code=f"HTTP_{r.status_code}", msg=str(data)[:300])
    ok = data.get("status") is True and r.status_code == 200
    return CrebResult(ok=ok, data=data, code=str(data.get("code") or ""), msg=str(data.get("msg") or ""))


def _base(extra: dict[str, Any] | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {"sid": _sid(), "secret_key": _secret(), "timestamp": _now_ms()}
    if extra:
        body.update(extra)
    return body


async def issue_billkey(auth_key: str) -> CrebResult:
    """SDK 카드등록창에서 받은 1회용 auth_key → 빌링키. 응답: billKey, cardCompany, cardNumber(마스킹) 등."""
    body = _base({"auth_key": auth_key})
    body["signature"] = make_signature(
        [("sid", body["sid"]), ("auth_key", auth_key), ("timestamp", body["timestamp"])]
    )
    return await _post("/v1/billing/billkey/authkey", body)


async def billpay(
    *, order_id: str, billkey: str, amount: int, goods_name: str,
    buyer_name: str, buyer_phone: str, buyer_email: str | None = None,
) -> CrebResult:
    """빌링키 승인(정기결제). 응답: transactionNumber(취소용 tid), approvalNumber, receiptUrl 등."""
    body = _base({
        "order_id": order_id, "billkey": billkey, "amount": amount,
        "buyer_name": buyer_name, "buyer_phone": buyer_phone,
        "card_quota": "00", "goods_name": goods_name,
    })
    if buyer_email:
        body["buyer_email"] = buyer_email
    body["signature"] = make_signature([
        ("sid", body["sid"]), ("order_id", order_id), ("billkey", billkey),
        ("amount", amount), ("timestamp", body["timestamp"]),
    ])
    return await _post("/v1/billing/billpay", body)


async def delete_billkey(billkey: str) -> CrebResult:
    body = _base({"billkey": billkey})
    body["signature"] = make_signature(
        [("sid", body["sid"]), ("billkey", billkey), ("timestamp", body["timestamp"])]
    )
    return await _post("/v1/billing/billkey/delete", body)


async def cancel_full(tid: str, amount: int, reason: str = "") -> CrebResult:
    """전액 취소. tid = 승인 응답의 transactionNumber. 부분취소 이력이 있는 거래는 거부됨."""
    body = _base({"tid": tid, "amount": amount})
    if reason:
        body["cancel_reason"] = reason[:255]  # 서명 제외 필드
    body["signature"] = make_signature([
        ("sid", body["sid"]), ("tid", tid), ("amount", amount), ("timestamp", body["timestamp"]),
    ])
    return await _post("/v1/cancel/cancel", body)


async def confirm_web_payment(payment_id: str, order_id: str, amount: int) -> CrebResult:
    """웹결제창 successUrl로 받은 paymentId를 서버에서 승인. 미호출 시 결제가 성립하지 않는다.
    같은 paymentId 재호출은 중복 승인 없이 기존 거래를 반환(멱등)."""
    body = {"secretKey": _secret(), "paymentId": payment_id, "orderId": order_id, "amount": amount}
    return await _post("/v1/pay/confirm", body)


def is_already_canceled(res: CrebResult) -> bool:
    return res.error_code == "ALREADY_FULLY_CANCELED"
