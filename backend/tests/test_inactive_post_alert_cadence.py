"""inactive_post_alert_job — '14일에 1회' 주기가 실제로 지켜지는지 (2026-10-31).

이전에는 멱등키(post_remind_{id}_{cutoff_date})로만 중복을 막았는데 cutoff_date가 '오늘-14일'이라 매일 바뀌어,
해지·만료 계정 사업장 2곳이 9/30~10/31 32일 연속, 관리자 사업장 2곳이 9일 연속 매일 알림톡을 받았다(실측 82건).
"""
import asyncio
import sys
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import db.supabase_client as sc
import scheduler.jobs as jobs
import importlib
from unittest.mock import patch


def _real_kakao_notify():
    """다른 테스트(test_competitor_spike_falsy_zero)가 모듈 로드 시 services.kakao_notify를 가짜 모듈로 등록해 둔다 — 진짜 모듈이 필요하면
    가져오는 동안만 가짜를 치우고 import 한다(test_kakao_send_result.py와 같은 방식, 전체 실행에서만 실패하던 순서 의존을 피함)."""
    with patch.dict(sys.modules):
        m = sys.modules.get("services.kakao_notify")
        if m is not None and getattr(m, "__file__", None) is None:
            sys.modules.pop("services.kakao_notify")
        return importlib.import_module("services.kakao_notify")


kn = _real_kakao_notify()

NOW = datetime.now(timezone.utc)


class _Query:
    def __init__(self, tables, name):
        self.tables, self.name = tables, name
        self.filters, self.single, self.insert_row, self.lim = [], False, None, None

    def select(self, *_, **__):
        return self

    def or_(self, *_):
        return self

    def eq(self, col, val):
        self.filters.append(lambda r: r.get(col) == val)
        return self

    def gte(self, col, val):
        self.filters.append(lambda r: r.get(col) is not None and r.get(col) >= val)
        return self

    def limit(self, n):
        self.lim = n
        return self

    def maybe_single(self):
        self.single = True
        return self

    def insert(self, row):
        self.insert_row = row
        return self

    def run(self):
        if self.insert_row is not None:
            self.tables.setdefault(self.name, []).append({**self.insert_row, "sent_at": NOW.isoformat()})
            return SimpleNamespace(data=[self.insert_row])
        rows = [r for r in self.tables.get(self.name, []) if all(f(r) for f in self.filters)]
        if self.single:
            return SimpleNamespace(data=rows[0] if rows else None)
        return SimpleNamespace(data=rows[: self.lim] if self.lim else rows)


class _DB:
    def __init__(self, tables):
        self.tables = tables

    def table(self, name):
        return _Query(self.tables, name)


def _run(monkeypatch, notifications):
    old = (NOW - timedelta(days=40)).isoformat()
    tables = {
        "businesses": [
            {"id": "recent", "user_id": "u1", "name": "최근에 보낸 곳", "last_post_at": old, "created_at": old, "is_active": True},
            {"id": "stale", "user_id": "u2", "name": "20일 전에 보낸 곳", "last_post_at": old, "created_at": old, "is_active": True},
            {"id": "never", "user_id": "u3", "name": "보낸 적 없는 곳", "last_post_at": old, "created_at": old, "is_active": True},
        ],
        "profiles": [{"user_id": u, "phone": "01000000000", "kakao_scan_notify": True} for u in ("u1", "u2", "u3")],
        "notifications": notifications,
    }
    sent = []

    class _Notifier:
        async def send_post_remind(self, phone, name, days=14):
            sent.append(name)
            return True

    async def fake_db(q):
        return q.run()

    monkeypatch.setattr(sc, "get_client", lambda: _DB(tables))
    monkeypatch.setitem(sys.modules, "services.kakao_notify", kn)
    monkeypatch.setattr(kn, "KakaoNotifier", _Notifier)
    monkeypatch.setattr(jobs, "_db", fake_db)
    monkeypatch.setattr(jobs, "_KAKAO_CONFIGURED", True)
    asyncio.run(jobs.inactive_post_alert_job())
    return sent, tables


def test_only_businesses_not_reminded_in_the_last_14_days_are_sent(monkeypatch):
    notifications = [
        # 어제 보냄 — 멱등키는 오늘 계산되는 키와 다르다(옛 구현은 이 경우에도 다시 보냈다)
        {"business_id": "recent", "type": "post_remind", "idempotency_key": "post_remind_recent_2000-01-01", "sent_at": (NOW - timedelta(days=1)).isoformat()},
        # 20일 전에 보냄 — 14일이 지났으니 다시 보내도 된다
        {"business_id": "stale", "type": "post_remind", "idempotency_key": "post_remind_stale_2000-01-01", "sent_at": (NOW - timedelta(days=20)).isoformat()},
    ]
    sent, tables = _run(monkeypatch, notifications)
    assert "최근에 보낸 곳" not in sent
    assert sorted(sent) == ["20일 전에 보낸 곳", "보낸 적 없는 곳"]


def test_running_the_job_twice_in_a_row_does_not_resend(monkeypatch):
    sent, tables = _run(monkeypatch, [])
    assert len(sent) == 3
    # 같은 데이터로 한 번 더 — 방금 기록이 쌓였으므로 아무도 다시 받지 않는다(날짜가 하루 바뀌어도 14일 안이면 동일)
    sent2 = []

    class _Notifier2:
        async def send_post_remind(self, phone, name, days=14):
            sent2.append(name)
            return True

    async def fake_db(q):
        return q.run()

    monkeypatch.setattr(sc, "get_client", lambda: _DB(tables))
    monkeypatch.setitem(sys.modules, "services.kakao_notify", kn)
    monkeypatch.setattr(kn, "KakaoNotifier", _Notifier2)
    monkeypatch.setattr(jobs, "_db", fake_db)
    asyncio.run(jobs.inactive_post_alert_job())
    assert sent2 == []


def test_failed_delivery_is_not_recorded_as_sent(monkeypatch):
    """발송이 실패(False)하면 post_remind로 기록하지 않는다 — 기록하면 실패한 알림이 '보냄'으로 남고 14일간 재시도도 막힌다 (2026-10-31)."""
    old = (NOW - timedelta(days=40)).isoformat()
    tables = {
        "businesses": [{"id": "b1", "user_id": "u1", "name": "실패하는 곳", "last_post_at": old, "created_at": old, "is_active": True}],
        "profiles": [{"user_id": "u1", "phone": "01000000000", "kakao_scan_notify": True}],
        "notifications": [],
    }

    class _FailingNotifier:
        async def send_post_remind(self, phone, name, days=14):
            return False

    async def fake_db(q):
        return q.run()

    monkeypatch.setattr(sc, "get_client", lambda: _DB(tables))
    monkeypatch.setitem(sys.modules, "services.kakao_notify", kn)
    monkeypatch.setattr(kn, "KakaoNotifier", _FailingNotifier)
    monkeypatch.setattr(jobs, "_db", fake_db)
    monkeypatch.setattr(jobs, "_KAKAO_CONFIGURED", True)
    asyncio.run(jobs.inactive_post_alert_job())
    assert [n for n in tables["notifications"] if n.get("type") == "post_remind"] == []


def test_kakao_response_ok_treats_http_200_with_unsuccessful_header_as_failure():
    _kakao_response_ok, _kakao_failure_summary = kn._kakao_response_ok, kn._kakao_failure_summary

    class _R:
        def __init__(self, status, body):
            self.status_code, self._body, self.text = status, body, str(body)

        def json(self):
            return self._body

    fail = _R(200, {"header": {"resultCode": -1031, "resultMessage": "All of receivers are failed to send.", "isSuccessful": False},
                    "message": {"sendResults": [{"recipientSeq": 1, "resultCode": 1002, "resultMessage": "invalid recipient"}]}})
    ok = _R(200, {"header": {"resultCode": 0, "isSuccessful": True}})
    assert _kakao_response_ok(fail) is False
    assert _kakao_response_ok(ok) is True
    assert _kakao_response_ok(_R(500, {})) is False
    assert _kakao_response_ok(None) is False
    summary = _kakao_failure_summary(fail)
    assert "-1031" in summary and "1002" in summary and "01000000000" not in summary     # 사유는 남기되 전화번호는 넣지 않는다
