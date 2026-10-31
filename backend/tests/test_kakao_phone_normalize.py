"""알림톡 수신번호 정규화 (2026-10-31) — 프로필의 하이픈 번호·빈 번호를 NHN에 그대로 보내던 것."""
import asyncio
import importlib
import sys
from unittest.mock import patch


def _real_kakao_notify():
    # 다른 테스트가 services.kakao_notify를 가짜 모듈로 등록해 두는 경우를 피한다(test_inactive_post_alert_cadence.py와 같은 방식)
    with patch.dict(sys.modules):
        m = sys.modules.get("services.kakao_notify")
        if m is not None and getattr(m, "__file__", None) is None:
            sys.modules.pop("services.kakao_notify")
        return importlib.import_module("services.kakao_notify")


kn = _real_kakao_notify()


def test_normalize_phone():
    n = kn._normalize_phone
    assert n("010-1234-5678") == "01012345678"
    assert n("01012345678") == "01012345678"
    assert n("+82 10-1234-5678") == "01012345678"
    assert n("011-234-5678") == "0112345678"
    assert n("") == "" and n(None) == ""
    assert n("02-123-4567") == ""           # 휴대전화가 아님
    assert n("010-12") == ""                 # 짧음


def test_send_skips_api_when_phone_missing(monkeypatch):
    calls = []

    class _NoHttp:
        def __init__(self, *a, **k):
            calls.append("client")

    monkeypatch.setattr(kn.httpx, "AsyncClient", _NoHttp)
    monkeypatch.setenv("KAKAO_APP_KEY", "x")
    notifier = kn.KakaoNotifier()
    monkeypatch.setattr(notifier, "_log_notification", lambda *a, **k: None)
    assert asyncio.run(notifier._send("", "action_items", {})) is None
    assert asyncio.run(notifier._send_raw("", "hi")) is False
    assert calls == []                       # 번호가 없으면 NHN을 부르지 않는다
