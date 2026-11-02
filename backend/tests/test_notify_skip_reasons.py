"""건너뛴 알림의 기록에 사유를 남긴다 (2026-11-02).

notifications.status의 CHECK가 'skipped'를 거부해 건너뜀 기록이 전부 사라지던 것을 DB 제약 교체(SQL)로 고쳤다 — 이제 저장되는 기록이
'상한 때문인지 해지 차단인지 번호 없음인지' 구분되도록 content.reason을 넣는다(관측 불가 상태에서 상한·차단을 튜닝하지 않기 위해).
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import services.kakao_notify as kn  # noqa: E402
from services import notify_weekly_cap as cap  # noqa: E402
from tests.test_notify_weekly_cap import Ledger, PHONE  # noqa: E402


def _notifier(monkeypatch, *, ended=False):
    logged = []

    async def _ended(phone):
        return ended

    monkeypatch.setattr(kn, "_subscription_ended", _ended)
    monkeypatch.setenv("KAKAO_APP_KEY", "x")
    n = kn.KakaoNotifier()
    monkeypatch.setattr(n, "_log_notification", lambda uid, t, content, status: logged.append((t, content, status)))
    return n, logged


def test_no_phone_is_logged_with_reason(monkeypatch):
    n, logged = _notifier(monkeypatch)
    assert asyncio.run(n._send("", "action_items", {"#{사업장명}": "가게"})) is None
    assert logged[0][2] == "skipped" and logged[0][1]["reason"] == "no_phone"


def test_lapsed_subscription_is_logged_with_reason(monkeypatch):
    n, logged = _notifier(monkeypatch, ended=True)
    assert asyncio.run(n._send(PHONE, "action_items", {"#{사업장명}": "가게"})) is None
    assert logged[0][2] == "skipped" and logged[0][1]["reason"] == "subscription_ended"


def test_weekly_cap_block_is_logged_with_reason(monkeypatch):
    monkeypatch.setenv("NOTIFY_WEEKLY_CAP", "3")
    led = Ledger()
    led.seed(3)
    monkeypatch.setattr(cap, "_db", lambda: (led, led.run))
    n, logged = _notifier(monkeypatch)
    assert asyncio.run(n._send(PHONE, "scan_complete", {"#{사업장명}": "가게"})) is None
    assert logged == [("scan_complete", {"reason": "weekly_cap", "#{사업장명}": "가게"}, "skipped")]


def test_missing_app_key_is_logged_with_reason_and_masked_phone(monkeypatch):
    n, logged = _notifier(monkeypatch)
    monkeypatch.delenv("KAKAO_APP_KEY", raising=False)
    assert asyncio.run(n._send(PHONE, "action_items", {})) is None
    assert logged[0][1]["reason"] == "no_app_key" and "1234" not in repr(logged[0][1]) and "****" in logged[0][1]["phone"]


def test_skipped_status_is_one_of_the_values_the_sql_allows():
    """DB 제약(scripts/supabase_schema.sql 끝의 ALTER)이 허용하는 값과 코드가 쓰는 값이 같아야 한다."""
    sql = open(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "scripts", "supabase_schema.sql"), encoding="utf-8").read()
    assert "CHECK (status IN ('sent','failed','pending','skipped'))" in sql
