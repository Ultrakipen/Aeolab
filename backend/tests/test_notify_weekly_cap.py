"""사용자(번호)당 정기 알림톡 주간 상한 (2026-11-02, 사용자 결정: 주 3건) — services/notify_weekly_cap.

- 최근 7일 전달 성공 3건이면 더 보내지 않는다. 마지막 한 칸은 높은 가치 알림(주간 성적표·월간 리포트·경쟁사 역전/변화·성장 단계)용으로 비운다.
- 결제·구독·대행 안내는 세지도 막지도 않는다. 건수를 읽지 못하면 정기 알림은 보내지 않는다. 실패는 세지 않는다. 번호 원문은 저장하지 않는다.
"""
import asyncio
import inspect
import os
import re
import sys
from datetime import datetime, timedelta, timezone

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import services.kakao_notify as kn  # noqa: E402
from services import notify_weekly_cap as cap  # noqa: E402

PHONE = "010-1234-5678"
NOW = datetime.now(timezone.utc)


# ── 가짜 DB ─────────────────────────────────────────────────────────────────────────
class _R:
    def __init__(self, data):
        self.data = data


class _Q:
    def __init__(self, name):
        self.name, self.op, self.payload, self.eqs, self.gtes = name, "select", None, {}, {}

    def select(self, *a, **k): return self
    def eq(self, c, v): self.eqs[c] = v; return self
    def gte(self, c, v): self.gtes[c] = v; return self
    def limit(self, *a, **k): return self
    def insert(self, payload):
        self.op, self.payload = "insert", payload
        return self


class Ledger:
    def __init__(self):
        self.rows = []
        self.fail_reads = False
        self.fail_writes = False

    def table(self, name): return _Q(name)

    async def run(self, q):
        if q.op == "insert":
            if self.fail_writes:
                raise RuntimeError("write failed")
            row = dict(q.payload)
            row.setdefault("sent_at", datetime.now(timezone.utc).isoformat())
            self.rows.append(row)
            return _R([row])
        if self.fail_reads:
            raise RuntimeError("read failed")
        out = self.rows
        for col, val in q.eqs.items():
            if col.startswith("content->>"):                      # PostgREST JSON 경로 필터(content->>phone_hash, content->>ttype …)
                key = col.split(">>", 1)[1]
                out = [r for r in out if (r.get("content") or {}).get(key) == val]
            else:
                out = [r for r in out if r.get(col) == val]
        for col, val in q.gtes.items():
            out = [r for r in out if str(r[col]) >= str(val)]
        return _R(out)

    def seed(self, n, phone=PHONE, ttype="scan_complete", days_ago=1):
        for _ in range(n):
            self.rows.append({"type": cap.LEDGER_TYPE, "content": {"phone_hash": cap.phone_hash(phone), "ttype": ttype},
                              "sent_at": (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()})


@pytest.fixture
def ledger(monkeypatch):
    monkeypatch.setenv("NOTIFY_WEEKLY_CAP", "3")                  # conftest의 기본 꺼짐을 이 파일에서만 켠다
    monkeypatch.delenv("NOTIFY_WEEKLY_RESERVE", raising=False)
    led = Ledger()
    monkeypatch.setattr(cap, "_db", lambda: (led, led.run))
    return led


def _allowed(ttype, phone=PHONE):
    return asyncio.run(cap.allowed(phone, ttype))


# ── 상한·우선순위 ────────────────────────────────────────────────────────────────────
def test_fresh_user_can_receive(ledger):
    assert _allowed("scan_complete") and _allowed("weekly_report")


def test_third_slot_is_kept_for_high_priority(ledger):
    ledger.seed(2)
    assert _allowed("scan_complete") is False and _allowed("ai_citation") is False and _allowed("action_items") is False   # 낮은 가치는 2건까지
    for t in ("weekly_report", "monthly_report", "competitor_overtake", "competitor", "growth_stage_up"):
        assert _allowed(t) is True, t                                                                                          # 마지막 칸은 높은 가치 알림용


def test_fourth_is_blocked_for_everyone(ledger):
    ledger.seed(3)
    for t in cap.PERIODIC_TYPES:
        assert _allowed(t) is False, t


def test_low_priority_still_allowed_below_two(ledger):
    ledger.seed(1)
    assert _allowed("score_change") is True


def test_cap_of_one_still_lets_a_low_priority_alert_through(ledger, monkeypatch):
    monkeypatch.setenv("NOTIFY_WEEKLY_CAP", "1")
    assert cap.limit_for("scan_complete") == 1 and cap.limit_for("weekly_report") == 1
    assert _allowed("scan_complete") is True
    ledger.seed(1)
    assert _allowed("scan_complete") is False


def test_custom_cap_and_reserve(ledger, monkeypatch):
    monkeypatch.setenv("NOTIFY_WEEKLY_CAP", "5")
    monkeypatch.setenv("NOTIFY_WEEKLY_RESERVE", "2")
    assert cap.limit_for("scan_complete") == 3 and cap.limit_for("weekly_report") == 5
    monkeypatch.setenv("NOTIFY_WEEKLY_CAP", "abc")
    assert cap.weekly_cap() == 3


def test_cap_zero_disables_the_feature(ledger, monkeypatch):
    ledger.seed(10)
    monkeypatch.setenv("NOTIFY_WEEKLY_CAP", "0")
    assert _allowed("scan_complete") is True
    assert asyncio.run(cap.record(PHONE, "scan_complete")) is False and len(ledger.rows) == 10


# ── 세는 범위 ────────────────────────────────────────────────────────────────────────
def test_only_last_seven_days_and_same_phone_count(ledger):
    ledger.seed(3, days_ago=8)                                    # 7일 밖
    ledger.seed(3, phone="010-9999-0000")                         # 다른 사람
    assert _allowed("scan_complete") is True
    ledger.seed(2, days_ago=6)                                    # 7일 안
    assert _allowed("scan_complete") is False


def test_same_number_in_any_format_is_one_user():
    assert cap.phone_hash("010-1234-5678") == cap.phone_hash("01012345678") == cap.phone_hash("+82 10-1234-5678")
    assert cap.phone_hash("01012345678") != cap.phone_hash("01012345679")


def test_ledger_row_never_stores_the_phone_number(ledger):
    assert asyncio.run(cap.record(PHONE, "ai_citation")) is True
    row = ledger.rows[0]
    assert row["type"] == cap.LEDGER_TYPE and row["channel"] == "internal" and row["status"] == "sent"
    assert "01012345678" not in repr(row) and "1234" not in repr(row)
    assert row["content"]["ttype"] == "ai_citation"


# ── 대상 밖·실패 처리 ─────────────────────────────────────────────────────────────────
def test_transactional_types_are_not_gated_or_counted(ledger):
    ledger.seed(10)
    for t in ("notice", "payment_failed", "subscription_cancelled", "delivery_completed", "unknown_future_type"):
        assert _allowed(t) is True, t
        assert asyncio.run(cap.record(PHONE, t)) is False
    assert len(ledger.rows) == 10


def test_unreadable_count_blocks_periodic_but_not_transactional(ledger):
    ledger.fail_reads = True
    assert _allowed("scan_complete") is False and _allowed("weekly_report") is False
    assert _allowed("payment_failed") is True


def test_record_failure_never_raises(ledger):
    ledger.fail_writes = True
    assert asyncio.run(cap.record(PHONE, "scan_complete")) is False


def test_periodic_types_match_real_templates():
    """상한 대상 이름이 실제 템플릿 key와 어긋나면(오타·이름 변경) 그 알림은 조용히 상한을 벗어난다."""
    assert cap.PERIODIC_TYPES <= set(kn.TEMPLATES)
    assert cap.HIGH_PRIORITY_TYPES <= cap.PERIODIC_TYPES
    assert "notice" not in cap.PERIODIC_TYPES


def test_delivery_templates_do_not_go_through_the_cap():
    assert "notify_weekly_cap" not in inspect.getsource(kn.KakaoNotifier._send_delivery_template)


# ── 실제 _send 통과 ──────────────────────────────────────────────────────────────────
class _Resp:
    def __init__(self, ok=True):
        self.status_code, self._ok, self.text = (200 if ok else 500), ok, "{}"

    def json(self):
        return {"header": {"isSuccessful": self._ok}}


def _wire_send(monkeypatch, ok=True):
    posts = []

    class _Client:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def post(self, url, headers=None, json=None):
            posts.append(json["templateCode"])
            return _Resp(ok)

    async def _open(phone):
        return False

    monkeypatch.setattr(kn.httpx, "AsyncClient", _Client)
    monkeypatch.setattr(kn, "_subscription_ended", _open)
    monkeypatch.setenv("KAKAO_APP_KEY", "x")
    n = kn.KakaoNotifier()
    monkeypatch.setattr(n, "_log_notification", lambda *a, **k: None)
    return n, posts


def test_send_stops_at_the_cap_and_keeps_the_last_slot(ledger, monkeypatch):
    n, posts = _wire_send(monkeypatch)
    send = lambda t: asyncio.run(n._send(PHONE, t, {"#{사업장명}": "가게"}))
    assert send("scan_complete") is not None and send("ai_citation") is not None          # 낮은 가치 2건
    assert send("score_change") is None                                                    # 세 번째 낮은 가치는 막힘(NHN 호출 없음)
    assert len(posts) == 2
    assert send("weekly_report") is not None                                               # 마지막 칸은 주간 성적표가 쓴다
    assert send("competitor_overtake") is None and len(posts) == 3                         # 상한 도달
    assert [r["content"]["ttype"] for r in ledger.rows] == ["scan_complete", "ai_citation", "weekly_report"]


def test_failed_delivery_is_not_counted(ledger, monkeypatch):
    n, posts = _wire_send(monkeypatch, ok=False)
    for _ in range(4):
        asyncio.run(n._send(PHONE, "weekly_report", {"#{사업장명}": "가게"}))
    assert len(posts) == 4 and ledger.rows == []                                           # 실패는 세지 않아 상한에 걸리지 않는다


def test_blocked_send_reports_not_delivered_to_callers(ledger, monkeypatch):
    ledger.seed(3)
    n, posts = _wire_send(monkeypatch)
    ok = asyncio.run(n.send_action_items(PHONE, "가게", ["a"]))
    assert ok is False and posts == []                                                     # 호출자가 '보냈다'고 기록하지 않는다(간격 기록 미시작)
