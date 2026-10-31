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


def test_template_params_strip_wrapper():
    assert kn._template_params({"#{사업장명}": "a", "변화": "b"}) == {"사업장명": "a", "변화": "b"}


def test_score_change_payload_uses_plain_keys_and_scan_date(monkeypatch):
    """2026-10-31 시험 발송 실측: '#{변수}' 키는 -3004, 이름만 쓰고 스캔일시를 채우면 성공 (AEOLAB_SCORE_01)."""
    sent = {}

    class _Resp:
        status_code = 200
        text = "{}"

        def json(self):
            return {"header": {"isSuccessful": True}}

    class _Client:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, url, headers=None, json=None):
            sent["json"] = json
            return _Resp()

    monkeypatch.setattr(kn.httpx, "AsyncClient", _Client)
    monkeypatch.setenv("KAKAO_APP_KEY", "x")
    n = kn.KakaoNotifier()
    monkeypatch.setattr(n, "_log_notification", lambda *a, **k: None)
    asyncio.run(n.send_score_change("010-1234-5678", "가게", 50, 70, 5, 3))
    rec = sent["json"]["recipientList"][0]
    assert rec["recipientNo"] == "01012345678"
    assert set(rec["templateParameter"]) == {"사업장명", "이전점수", "현재점수", "변화", "이전순위", "현재순위", "스캔일시"}


def _capture_action_value(monkeypatch, call):
    sent = {}

    class _Resp:
        status_code = 200
        text = "{}"

        def json(self):
            return {"header": {"isSuccessful": True}}

    class _Client:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, url, headers=None, json=None):
            sent["json"] = json
            return _Resp()

    monkeypatch.setattr(kn.httpx, "AsyncClient", _Client)
    monkeypatch.setenv("KAKAO_APP_KEY", "x")
    n = kn.KakaoNotifier()
    monkeypatch.setattr(n, "_log_notification", lambda *a, **k: None)
    asyncio.run(call(n))
    return sent["json"]["recipientList"][0]["templateParameter"]["할일목록"]


def test_action_list_value_stays_within_14_chars(monkeypatch):
    """AEOLAB_ACTION_01 #{할일목록}은 14자 초과 시 -1028로 실패(2026-10-31 시험 발송: 14자 성공·15자 실패)."""
    long_items = ["스마트플레이스 소식을 이번 주 안에 작성하세요", "대표 사진을 5장 이상 등록하세요", "소개글에 지역명을 넣으세요"]
    v = _capture_action_value(monkeypatch, lambda n: n.send_action_items("01012345678", "가게", long_items))
    assert len(v) <= 14 and "3건" in v
    v2 = _capture_action_value(monkeypatch, lambda n: n.send_post_remind("01012345678", "가게", 14))
    assert len(v2) <= 14 and "미작성" in v2
    v3 = _capture_action_value(monkeypatch, lambda n: n.send_action_items("01012345678", "가게", ["사진 등록"]))
    assert v3 == "• 사진 등록"          # 짧으면 그대로
