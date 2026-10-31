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


# ── 해지·만료 계정 차단 (2026-10-31, 사용자 결정) ────────────────────────────────────────────────
import pytest


@pytest.fixture(autouse=True)
def _gate_open_by_default(monkeypatch):
    async def _open(phone):
        return False
    monkeypatch.setattr(kn, "_subscription_ended", _open)


def _gate_module():
    import services.notify_gate as ng
    ng._cache.update(at=0.0, phones=None)
    return ng


def test_gate_blocks_only_lapsed_subscribers(monkeypatch):
    from datetime import datetime, timedelta, timezone
    import db.supabase_client as sc
    import services.db_paging as dp
    ng = _gate_module()
    past = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
    future = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    subs = [
        {"user_id": "expired", "status": "cancelled", "end_at": past},
        {"user_id": "cancelled_but_paid_through", "status": "cancelled", "end_at": future},
        {"user_id": "active", "status": "active", "end_at": future},
        {"user_id": "shared_lapsed", "status": "cancelled", "end_at": past},
    ]
    profiles = [
        {"user_id": "expired", "phone": "010-1111-1111"},
        {"user_id": "cancelled_but_paid_through", "phone": "01022222222"},
        {"user_id": "active", "phone": "010-3333-3333"},
        {"user_id": "never_subscribed", "phone": "01044444444"},
        {"user_id": "shared_lapsed", "phone": "01033333333"},      # 자격 있는 계정과 같은 번호 → 보낸다
    ]

    async def fake_all(build_query, max_rows=0):
        return subs, False

    async def fake_in(build_query, ids, chunk=150, max_rows=0):
        return [p for p in profiles if p["user_id"] in set(ids)], False

    monkeypatch.setattr(sc, "get_client", lambda: None)
    monkeypatch.setattr(dp, "fetch_all_rows", fake_all)
    monkeypatch.setattr(dp, "fetch_all_in_chunks", fake_in)
    monkeypatch.delenv("NOTIFY_SUBSCRIPTION_GATE", raising=False)
    monkeypatch.delenv("ADMIN_USER_IDS", raising=False)
    blocked = lambda p: asyncio.run(ng.is_blocked(p))
    assert blocked("010-1111-1111") is True          # 만료된 해지
    assert blocked("01022222222") is False           # 해지했지만 만료일 전
    assert blocked("01033333333") is False           # 활성 구독(같은 번호의 만료 계정이 있어도)
    assert blocked("01044444444") is False           # 구독 이력 없음(체험) — 이 규칙의 대상 아님
    assert blocked("+82 10-1111-1111") is True       # 표기 방식이 달라도 같은 번호


def test_gate_fails_closed_when_lookup_fails(monkeypatch):
    import services.db_paging as dp
    ng = _gate_module()

    async def boom(*a, **k):
        raise RuntimeError("db down")

    monkeypatch.setattr(dp, "fetch_all_rows", boom)
    import db.supabase_client as sc
    monkeypatch.setattr(sc, "get_client", lambda: None)
    assert asyncio.run(ng.is_blocked("01012345678")) is True


def test_notifier_does_not_call_nhn_for_ended_subscription_but_still_sends_status_notices(monkeypatch):
    calls = []

    class _Client:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, url, headers=None, json=None):
            calls.append(json["templateCode"])

            class _R:
                status_code = 200
                text = "{}"

                def json(self_inner):
                    return {"header": {"isSuccessful": True}}
            return _R()

    async def _blocked(phone):
        return True

    monkeypatch.setattr(kn.httpx, "AsyncClient", _Client)
    monkeypatch.setattr(kn, "_subscription_ended", _blocked)
    monkeypatch.setenv("KAKAO_APP_KEY", "x")
    n = kn.KakaoNotifier()
    monkeypatch.setattr(n, "_log_notification", lambda *a, **k: None)
    assert asyncio.run(n.send_action_items("01012345678", "가게", ["a"])) is False       # 템플릿 알림 차단
    assert asyncio.run(n._send_raw("01012345678", "x")) is False                         # 자유 문구 차단
    assert calls == []
    asyncio.run(n.send_subscription_cancelled("01012345678", refunded=False))             # 해지 완료 안내는 보낸다
    asyncio.run(n.send_payment_failed("01012345678"))
    assert len(calls) == 2


def test_value_length_limit_14_with_safe_fallbacks():
    """승인 템플릿 변수 값은 14자 초과 시 -1028로 발송이 통째로 실패한다(2026-10-31 시험 발송). 긴 문장은 대체 문구로, 그 밖은 잘라서 보낸다."""
    assert kn._short("가" * 14, "대체") == "가" * 14
    assert kn._short("가" * 15, "대체") == "대체"
    assert kn._short("", "대체") == "대체" and kn._short(None, "대체") == "대체"
    out = kn._template_params({"#{사업장명}": "아주아주아주아주긴사업장이름입니다", "#{확인일시}": "2026-10-31"})
    assert all(len(v) <= 14 for v in out.values()) and out["확인일시"] == "2026-10-31"
