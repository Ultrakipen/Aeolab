"""7일 청약철회 자동환불 자격 — '이용'은 구독 시작 이후의 이용만 센다 (2026-11-07).

이전에는 시각 필터가 없어 결제 전의 체험 결과 가져오기·무료 첫 측정 기록 때문에 7일 이내라도 환불이 막혔다.
쿼리에 걸린 필터(시작 시각, 측정 결과가 있는 스캔)를 직접 검증한다.
"""
import asyncio
from datetime import datetime, timedelta, timezone

from routers import settings


class _Q:
    def __init__(self, table, log):
        self.table_name, self.log, self.calls = table, log, []

    def __getattr__(self, name):
        def rec(*a, **k):
            self.calls.append((name, a, k))
            return self
        return rec


class _Sb:
    def __init__(self, log):
        self.log = log

    def table(self, name):
        q = _Q(name, self.log)
        self.log.append(q)
        return q


class _Res:
    def __init__(self, data=None, count=0):
        self.data, self.count = data, count


def _run(monkeypatch, *, start_days_ago=1, biz=("b1",), scans=0, guides=0, key="pay_1"):
    log = []

    async def fake_execute(q):
        if q.table_name == "businesses":
            return _Res(data=[{"id": b} for b in biz])
        if q.table_name == "scan_results":
            return _Res(count=scans)
        if q.table_name == "guides":
            return _Res(count=guides)
        raise AssertionError(q.table_name)

    monkeypatch.setattr(settings, "execute", fake_execute)
    start = datetime.now(timezone.utc) - timedelta(days=start_days_ago)
    ok = asyncio.run(settings._check_refund_eligibility("u1", _Sb(log), start.isoformat(), key))
    return ok, {q.table_name: q for q in log}, start


def _calls(q, name):
    return [c for c in q.calls if c[0] == name]


def test_no_usage_after_start_is_eligible(monkeypatch):
    ok, _, _ = _run(monkeypatch)
    assert ok is True


def test_scan_after_start_blocks_refund(monkeypatch):
    assert _run(monkeypatch, scans=1)[0] is False


def test_guide_after_start_blocks_refund(monkeypatch):
    assert _run(monkeypatch, guides=1)[0] is False


def test_scan_query_is_limited_to_after_subscription_start(monkeypatch):
    _, qs, start = _run(monkeypatch)
    gte = _calls(qs["scan_results"], "gte")
    assert gte and gte[0][1][0] == "scanned_at"
    since = gte[0][1][1]
    assert since.endswith("Z") and "+" not in since                      # URL 인코딩 문제가 없는 형식
    assert abs(datetime.strptime(since, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc) - start) < timedelta(seconds=2)


def test_scan_query_ignores_imported_trial_rows_without_any_measurement(monkeypatch):
    _, qs, _ = _run(monkeypatch)
    or_ = _calls(qs["scan_results"], "or_")
    assert or_, "측정 결과가 하나도 없는 가져온 체험 행을 제외하는 필터가 있어야 한다"
    cond = or_[0][1][0]
    assert all(k in cond for k in ("chatgpt_result.not.is.null", "gemini_result.not.is.null", "naver_result.not.is.null"))


def test_guide_query_is_limited_to_after_subscription_start(monkeypatch):
    _, qs, _ = _run(monkeypatch)
    gte = _calls(qs["guides"], "gte")
    assert gte and gte[0][1][0] == "generated_at"


def test_after_seven_days_or_missing_payment_key_is_not_eligible(monkeypatch):
    assert _run(monkeypatch, start_days_ago=8)[0] is False
    assert _run(monkeypatch, key=None)[0] is False


def test_no_business_is_eligible(monkeypatch):
    assert _run(monkeypatch, biz=())[0] is True


def test_usage_lookup_failure_does_not_raise_and_denies_refund(monkeypatch):
    """이 함수는 해지 경로에서 예외 처리 없이 호출된다 — 조회 실패가 해지 500이 되면 안 되고, 확인 못 하면 환불 불가로 둔다."""
    async def boom(q):
        if q.table_name == "businesses":
            return _Res(data=[{"id": "b1"}])
        raise RuntimeError("postgrest 400")

    monkeypatch.setattr(settings, "execute", boom)
    start = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    ok = asyncio.run(settings._check_refund_eligibility("u1", _Sb([]), start, "pay_1"))
    assert ok is False


# ── 2026-11-08: 조회 실패로 환불이 보류될 때 운영자 알림(해지 경로 전용) + 사업장 조회도 보호 안으로 ──

def _fail_run(monkeypatch, *, fail_table, alert_flag, alert_raises=False):
    alerts = []

    async def boom(q):
        if q.table_name == fail_table:
            raise RuntimeError("postgrest 400")
        if q.table_name == "businesses":
            return _Res(data=[{"id": "b1"}])
        return _Res(count=0)

    async def fake_alert(subject, message):
        alerts.append((subject, message))
        if alert_raises:
            raise RuntimeError("resend down")
        return True

    monkeypatch.setattr(settings, "execute", boom)
    monkeypatch.setattr(settings, "send_operator_alert", fake_alert)
    start = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    ok = asyncio.run(settings._check_refund_eligibility("u1", _Sb([]), start, "pay_1", alert_on_lookup_failure=alert_flag))
    return ok, alerts, start


def test_lookup_failure_alerts_operator_only_when_asked(monkeypatch):
    for table in ("scan_results", "guides"):
        ok, alerts, start = _fail_run(monkeypatch, fail_table=table, alert_flag=True)
        assert ok is False and len(alerts) == 1, table
        subject, message = alerts[0]
        assert "수동 확인" in subject and "u1" in message and start in message           # 누가·언제 구독했는지가 알림에 있다
        ok2, alerts2, _ = _fail_run(monkeypatch, fail_table=table, alert_flag=False)       # /me(대시보드) 경로는 알림 폭주 방지
        assert ok2 is False and alerts2 == [], table


def test_business_lookup_failure_is_now_protected_and_alerts(monkeypatch):
    """사업장 조회가 try 밖이어서 DB 오류가 나면 해지(또는 /me)가 500이 되던 것."""
    ok, alerts, _ = _fail_run(monkeypatch, fail_table="businesses", alert_flag=True)
    assert ok is False and len(alerts) == 1
    ok2, alerts2, _ = _fail_run(monkeypatch, fail_table="businesses", alert_flag=False)
    assert ok2 is False and alerts2 == []


def test_alert_failure_never_breaks_cancellation(monkeypatch):
    ok, alerts, _ = _fail_run(monkeypatch, fail_table="guides", alert_flag=True, alert_raises=True)
    assert ok is False and len(alerts) == 1                                              # 알림이 실패해도 예외 없이 환불 보류로 끝난다


def test_no_alert_for_normal_denial_or_eligibility(monkeypatch):
    alerts = []

    async def fake_alert(subject, message):
        alerts.append(subject)

    monkeypatch.setattr(settings, "send_operator_alert", fake_alert)
    for kw in (dict(scans=1), dict(guides=1), dict(), dict(start_days_ago=8), dict(key=None), dict(biz=())):
        _run(monkeypatch, **kw)
    assert alerts == []                                                                  # 정상 판정에는 알림이 없다


def test_cancel_path_enables_alert_and_me_path_does_not_and_success_is_recorded():
    import inspect
    src = inspect.getsource(settings)
    assert "sub.get(\"first_payment_key\"), alert_on_lookup_failure=True" in src         # 해지 경로
    import re
    calls = re.findall(r"await _check_refund_eligibility\((.*?)\n\s*\)", src, flags=re.S)    # 실제 호출(정의·설명 제외)
    assert len(calls) == 2 and sum("alert_on_lookup_failure=True" in c for c in calls) == 1   # /me 경로는 기본값(False)
    assert "await _check_refund_eligibility(\n            user_id, supabase, sub.get(\"start_at\"), sub.get(\"first_payment_key\")\n        )" in src
    assert "7일 청약철회 자동환불 완료" in src and 'level="info", source="refund"' in src      # 성공은 이메일 없이 기록만
