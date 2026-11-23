"""알림톡 전체 발송 중단 스위치(KAKAO_SENDING_ENABLED, 기본 중단) — 어떤 경로도 카카오 API를 부르지 않는다."""
import asyncio

import services.kakao_notify as kn


class _Boom:
    def __init__(self, *a, **k):
        raise AssertionError("발송 중단인데 HTTP 클라이언트가 만들어졌다")


def _run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


def test_default_is_disabled(monkeypatch):
    monkeypatch.delenv("KAKAO_SENDING_ENABLED", raising=False)
    assert kn._sending_disabled() is True


def test_enabled_when_true(monkeypatch):
    monkeypatch.setenv("KAKAO_SENDING_ENABLED", "true")
    assert kn._sending_disabled() is False


def test_all_send_paths_make_no_http_call(monkeypatch):
    monkeypatch.delenv("KAKAO_SENDING_ENABLED", raising=False)
    monkeypatch.setenv("KAKAO_APP_KEY", "x")
    monkeypatch.setattr(kn.httpx, "AsyncClient", _Boom)
    monkeypatch.setattr(kn, "_FREE_TEXT_ENABLED", True)
    n = kn.KakaoNotifier()
    monkeypatch.setattr(n, "_log_notification", lambda *a, **k: None)
    assert _run(n._send("01012345678", "scan_complete", {"사업장명": "a"})) is None
    assert _run(n._send_raw("01012345678", "hi")) is False
    assert _run(n._send_delivery_template("01012345678", "AEOLAB_DELIVERY_01", {})) is None
