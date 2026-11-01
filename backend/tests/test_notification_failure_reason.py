"""실패한 알림 행에 실패 사유를 남긴다 (2026-11-01).

배경: 10-31 알림 장애 때 notifications에 status=failed 행만 남고 사유가 없어(로그는 순환) 나중에 원인을 알 수 없었다.
세 발송 경로(_send, _send_delivery_template, _send_raw) 모두 content["error"]에 사유를 남기고, 전화번호는 남기지 않는다.
"""
import asyncio
import os

import httpx
import pytest

os.environ.setdefault("KAKAO_APP_KEY", "test-key")
os.environ.setdefault("KAKAO_SECRET_KEY", "test-secret")
os.environ.setdefault("KAKAO_SENDER_KEY", "test-sender")

from services import kakao_notify as kn  # noqa: E402

PHONE = "01012345678"
FAIL_JSON = {
    "header": {"isSuccessful": False, "resultCode": -1000, "resultMessage": "발송 실패"},
    "message": {"sendResults": [{"recipientSeq": 1, "resultCode": -1103, "resultMessage": "변수 길이 초과"}]},
}


class _Resp:
    def __init__(self, status=200, body=None):
        self.status_code = status
        self._body = body if body is not None else {"header": {"isSuccessful": True}}
        self.text = str(self._body)

    def json(self):
        return self._body


def _fake_client(resp=None, exc=None):
    class _C:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, *a, **k):
            if exc is not None:
                raise exc
            return resp

    return _C


@pytest.fixture
def notifier(monkeypatch):
    n = kn.KakaoNotifier()
    logged = []
    monkeypatch.setattr(n, "_log_notification", lambda uid, t, c, s: logged.append((t, c, s)))

    async def not_ended(_phone):
        return False

    monkeypatch.setattr(kn, "_subscription_ended", not_ended)
    monkeypatch.setattr(kn, "_FREE_TEXT_ENABLED", True)   # 자유 문구 경로는 기본 꺼짐 — 이 테스트에서만 켠다
    n.logged = logged
    return n


def _send_variants(n):
    """(호출 함수, 기대 type) — 세 경로 모두 같은 규칙을 지켜야 한다."""
    return [
        ("send", lambda: n._send(PHONE, "score_change", {"#{사업장명}": "테스트"}), "score_change"),
        ("delivery", lambda: n._send_delivery_template(PHONE, "AEOLAB_DELIVERY_01", {"#{사업장명}": "테스트"}, log_tag="delivery_x"), "delivery_x"),
        ("raw", lambda: n._send_raw(PHONE, "안내 문장", gated=False), "notice"),
    ]


@pytest.mark.parametrize("idx", [0, 1, 2])
def test_http_failure_records_reason_without_phone(monkeypatch, notifier, idx):
    monkeypatch.setattr(kn.httpx, "AsyncClient", _fake_client(resp=_Resp(200, FAIL_JSON)))
    name, call, ntype = _send_variants(notifier)[idx]
    asyncio.run(call())
    rows = [r for r in notifier.logged if r[0] == ntype]
    assert rows, name
    _, content, status = rows[-1]
    assert status == "failed"
    assert "-1103" in content["error"] and "변수 길이 초과" in content["error"]   # 사유가 남는다
    assert PHONE not in str(content) and PHONE[-8:] not in content["error"]        # 전화번호는 남기지 않는다


@pytest.mark.parametrize("idx", [0, 1, 2])
def test_exception_records_reason_and_masks_long_digits(monkeypatch, notifier, idx):
    monkeypatch.setattr(kn.httpx, "AsyncClient", _fake_client(exc=httpx.ConnectTimeout(f"timed out for {PHONE}")))
    name, call, ntype = _send_variants(notifier)[idx]
    try:
        asyncio.run(call())
    except Exception:
        pass   # _send는 예외를 다시 던진다(기존 동작)
    rows = [r for r in notifier.logged if r[0] == ntype]
    assert rows, name
    _, content, status = rows[-1]
    assert status == "failed"
    assert "ConnectTimeout" in content["error"] and PHONE not in content["error"]


@pytest.mark.parametrize("idx", [0, 1, 2])
def test_success_has_no_error_field(monkeypatch, notifier, idx):
    monkeypatch.setattr(kn.httpx, "AsyncClient", _fake_client(resp=_Resp(200)))
    name, call, ntype = _send_variants(notifier)[idx]
    asyncio.run(call())
    _, content, status = [r for r in notifier.logged if r[0] == ntype][-1]
    assert status == "sent" and "error" not in content


def test_failure_note_helper_limits_and_masks():
    note = kn._failure_note(exc=RuntimeError("x" * 500 + " 01012345678"))
    assert len(note) <= 240 and "01012345678" not in note
    assert kn._failure_note(resp=_Resp(200, FAIL_JSON)).startswith("header=-1000")
