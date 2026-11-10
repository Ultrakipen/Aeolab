"""감시 장치 두 잡의 동작 시험 (2026-11-10): alert_pipeline_heartbeat_job, ai_provider_health_check_job.

이 잡들은 다른 문제를 알려 주는 장치라 오작동하면 같이 침묵한다. 서버에서 확인한 실제 모양을 따른다:
 - heartbeat는 11-03~11-10 매일 09:35 KST(00:35 UTC)에 'ping 성공'을 남겼다.
 - 실패 기록은 purpose='scan_recommend:FAILED:ResourceExhausted' 형식이고, 프로바이더 이름이 든 운영 알림 제목은 'gemini AI 스캔 전면 실패 감지'뿐이다.
"""
import asyncio
import logging
from types import SimpleNamespace

import pytest

import scheduler.jobs as jobs


# ───────────── heartbeat ─────────────
class _FakeResp:
    def __init__(self, status):
        self.status = status

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False


def _fake_session(status=200, boom=False, calls=None):
    class S:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        def get(self, url, **k):
            if calls is not None:
                calls.append(url)
            if boom:
                raise RuntimeError("network down")
            return _FakeResp(status)
    return S


def test_heartbeat_is_silent_noop_without_url(monkeypatch):
    import aiohttp
    calls = []
    monkeypatch.setattr(jobs, "_HC_ALERT_PIPELINE_PING_URL", None)
    monkeypatch.setattr(aiohttp, "ClientSession", _fake_session(calls=calls))
    asyncio.run(jobs.alert_pipeline_heartbeat_job())
    assert calls == []                                            # 미설정이면 네트워크를 건드리지 않는다


def test_heartbeat_pings_the_configured_url_and_logs_success(monkeypatch, caplog):
    import aiohttp
    calls = []
    monkeypatch.setattr(jobs, "_HC_ALERT_PIPELINE_PING_URL", "https://hc.example/ping/x")
    monkeypatch.setattr(aiohttp, "ClientSession", _fake_session(200, calls=calls))
    with caplog.at_level(logging.INFO):
        asyncio.run(jobs.alert_pipeline_heartbeat_job())
    assert calls == ["https://hc.example/ping/x"] and "ping 성공" in caplog.text


def test_heartbeat_non_200_warns_and_exceptions_do_not_escape(monkeypatch, caplog):
    import aiohttp
    monkeypatch.setattr(jobs, "_HC_ALERT_PIPELINE_PING_URL", "https://hc.example/ping/x")
    monkeypatch.setattr(aiohttp, "ClientSession", _fake_session(500))
    with caplog.at_level(logging.WARNING):
        asyncio.run(jobs.alert_pipeline_heartbeat_job())
    assert "응답 이상: 500" in caplog.text
    monkeypatch.setattr(aiohttp, "ClientSession", _fake_session(boom=True))
    asyncio.run(jobs.alert_pipeline_heartbeat_job())              # 예외가 스케줄러를 죽이지 않는다


# ───────────── AI 프로바이더 헬스체크 ─────────────
class Q:
    def __init__(self, table):
        self.table, self.ops = table, []

    def __getattr__(self, name):
        def rec(*a, **k):
            self.ops.append((name, a))
            return self
        return rec


@pytest.fixture
def health(monkeypatch):
    sent = []

    def go(usage, recent_alert=False, fail_query=False):
        """usage: {provider: (total, failed)}"""
        sent.clear()

        async def fake_db(q):
            if q.table == "system_alerts":
                return SimpleNamespace(data=[{"id": 1}] if recent_alert else [], count=None)
            if fail_query:
                raise RuntimeError("ai_usage_log missing")
            provider = next(a[1] for n, a in [(o[0], o[1]) for o in q.ops] if n == "eq" and a[0] == "provider")
            failed_q = any(n == "like" for n, _ in q.ops)
            total, failed = usage.get(provider, (0, 0))
            return SimpleNamespace(count=failed if failed_q else total, data=[])

        async def fake_alert(subject, body, **k):
            sent.append(subject)

        import db.supabase_client as dbc
        import services.email_sender as es
        monkeypatch.setattr(dbc, "get_client", lambda: SimpleNamespace(table=lambda n: Q(n)))
        monkeypatch.setattr(jobs, "_db", fake_db)
        monkeypatch.setattr(es, "send_operator_alert", fake_alert)
        asyncio.run(jobs.ai_provider_health_check_job())
        return list(sent)
    return go


def test_total_failure_of_one_provider_alerts_only_that_provider(health):
    assert health({"gemini": (5, 5), "chatgpt": (10, 0)}) == ["gemini AI 스캔 전면 실패 감지"]


def test_partial_failures_do_not_alert(health):
    """무료 등급에서 흔한 '일부 실패'(예: 100건 중 3건)는 전면 장애가 아니다."""
    assert health({"gemini": (100, 3), "chatgpt": (20, 19)}) == []


def test_fewer_than_three_calls_is_not_enough_evidence(health):
    assert health({"gemini": (2, 2)}) == [] and health({"gemini": (3, 3)}) != []


def test_recent_alert_suppresses_resend_and_no_traffic_is_normal(health):
    assert health({"gemini": (5, 5)}, recent_alert=True) == []
    assert health({}) == []


def test_missing_usage_table_does_not_raise_or_alert(health):
    assert health({"gemini": (5, 5)}, fail_query=True) == []
