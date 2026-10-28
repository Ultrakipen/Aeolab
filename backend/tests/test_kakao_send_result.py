"""알림톡 발송 결과 반환 (2026-10-28).

`_send_raw`가 결과를 돌려주지 않아 별점 알림 잡이 실패한 발송을 '발송됨'으로 기록하고 영영 재시도하지 않았다.
성공만 True, HTTP 오류·응답 본문의 isSuccessful=false·예외·키 미설정은 모두 False여야 한다. 네트워크에는 접속하지 않는다.
"""
import asyncio
import os
import sys

os.environ.setdefault("OPENAI_API_KEY", "test-key-not-used")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import importlib  # noqa: E402
from unittest.mock import patch  # noqa: E402


def _real_kakao_notify():
    """다른 테스트(test_competitor_spike_falsy_zero)가 모듈 로드 시 services.kakao_notify를 가짜 모듈로 등록해 둔다 —
    진짜 모듈이 필요하면 가져오는 동안만 가짜를 치우고 import 한다(전체 실행에서만 실패하던 테스트 오염)."""
    with patch.dict(sys.modules):
        m = sys.modules.get("services.kakao_notify")
        if m is not None and getattr(m, "__file__", None) is None:
            sys.modules.pop("services.kakao_notify")
        return importlib.import_module("services.kakao_notify")


kn = _real_kakao_notify()


class _Resp:
    def __init__(self, status=200, body=None):
        self.status_code = status
        self._body = body if body is not None else {"header": {"isSuccessful": True}}
        self.text = str(self._body)

    def json(self):
        return self._body


def _notifier(monkeypatch, resp=None, exc=None, app_key="k"):
    if app_key:
        monkeypatch.setenv("KAKAO_APP_KEY", app_key)
    else:
        monkeypatch.delenv("KAKAO_APP_KEY", raising=False)
    logs = []

    class _Client:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def post(self, *a, **k):
            if exc:
                raise exc
            return resp

    monkeypatch.setattr(kn.httpx, "AsyncClient", _Client)
    n = kn.KakaoNotifier()
    monkeypatch.setattr(n, "_log_notification", lambda *a, **k: logs.append(a))   # DB에 쓰지 않는다
    return n, logs


def _run(coro):
    return asyncio.run(coro)


def test_success_returns_true(monkeypatch):
    n, logs = _notifier(monkeypatch, _Resp())
    assert _run(n._send_raw("01012345678", "본문", "AEOLAB_ALERT_01")) is True
    assert logs[-1][-1] == "sent"


def test_http_error_returns_false(monkeypatch):
    n, logs = _notifier(monkeypatch, _Resp(status=400, body={"message": "template mismatch"}))
    assert _run(n._send_raw("01012345678", "본문", "AEOLAB_ALERT_01")) is False
    assert logs[-1][-1] == "failed"


def test_body_level_failure_returns_false(monkeypatch):
    """HTTP 200이어도 응답 본문 header.isSuccessful=false면 실패다(템플릿 불일치가 이렇게 오는 경우가 있다)."""
    n, _ = _notifier(monkeypatch, _Resp(status=200, body={"header": {"isSuccessful": False, "resultMessage": "x"}}))
    assert _run(n._send_raw("01012345678", "본문", "AEOLAB_ALERT_01")) is False


def test_exception_returns_false(monkeypatch):
    n, logs = _notifier(monkeypatch, exc=RuntimeError("timeout"))
    assert _run(n._send_raw("01012345678", "본문", "AEOLAB_ALERT_01")) is False
    assert logs[-1][-1] == "failed"


def test_missing_key_returns_false_and_is_skipped(monkeypatch):
    n, logs = _notifier(monkeypatch, _Resp(), app_key="")
    assert _run(n._send_raw("01012345678", "본문", "AEOLAB_ALERT_01")) is False
    assert logs[-1][-1] == "skipped"


def test_low_rating_alert_propagates_result(monkeypatch):
    n, _ = _notifier(monkeypatch, _Resp(status=500, body={}))
    assert _run(n.send_low_rating_alert("01012345678", "가게", 1, "불만", "https://x")) is False
    n2, _ = _notifier(monkeypatch, _Resp())
    assert _run(n2.send_low_rating_alert("01012345678", "가게", 1, "불만", "https://x")) is True
    n3, _ = _notifier(monkeypatch, _Resp(), app_key="")
    assert _run(n3.send_low_rating_alert("01012345678", "가게", 1, "불만", "https://x")) is False
