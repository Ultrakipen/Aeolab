"""경쟁사 변화 알림(COMP_01) 규칙 (2026-11-01) — 점수 숫자 노출·0 발송·작은 흔들림 알림·급등/신규 경쟁사 알림 제거."""
import asyncio
import re

import scheduler.jobs as jobs
from services.competitor_alert import pick_competitor_change, MIN_DELTA


def _c(score, name="경쟁사A", ai_basis=True):
    d = {"score": score, "name": name}
    if ai_basis:
        d["ai_basis"] = True
    return d


# ── 규칙 ──────────────────────────────────────────────────────────

def test_stage_change_with_enough_delta_is_picked_as_text_only():
    got = pick_competitor_change({"c1": _c(62)}, {"c1": _c(48)})     # 안정(<55) → 성장(<75), +14
    assert got == ("경쟁사A", "AI 노출 상승")
    got = pick_competitor_change({"c1": _c(48)}, {"c1": _c(62)})
    assert got == ("경쟁사A", "AI 노출 하락")
    assert not any(ch.isdigit() for ch in got[1]), "점수 숫자를 사용자에게 보내면 안 된다"


def test_small_swings_and_same_stage_moves_are_ignored():
    assert pick_competitor_change({"c1": _c(52)}, {"c1": _c(46)}) is None      # 6점: 흔들림 수준
    assert pick_competitor_change({"c1": _c(70)}, {"c1": _c(57)}) is None      # 13점이지만 같은 성장 구간
    # 등급 경계(55)를 2점 차이로 넘나드는 흔들림 — 구간은 바뀌지만 실제 변화로 보기엔 너무 작다
    assert pick_competitor_change({"c1": _c(56)}, {"c1": _c(54)}) is None
    assert pick_competitor_change({"c1": _c(54)}, {"c1": _c(56)}) is None
    assert MIN_DELTA >= 10


def test_missing_scores_are_not_turned_into_zero():
    assert pick_competitor_change({"c1": _c(None)}, {"c1": _c(60)}) is None    # 이전 코드는 None→0으로 '하락' 알림
    assert pick_competitor_change({"c1": _c(60)}, {"c1": _c(None)}) is None
    assert pick_competitor_change({"c1": {"name": "x"}}, {"c1": _c(60)}) is None
    assert pick_competitor_change({"c1": _c(60)}, {}) is None                  # 새로 생긴 경쟁사는 비교 대상이 없다
    assert pick_competitor_change(None, None) is None


def test_measurement_basis_change_is_ignored():
    assert pick_competitor_change({"c1": _c(62, ai_basis=True)}, {"c1": _c(30, ai_basis=False)}) is None


def test_largest_change_wins_and_zero_is_a_real_score():
    got = pick_competitor_change(
        {"a": _c(62, "작은변화"), "b": _c(80, "큰변화")},
        {"a": _c(48, "작은변화"), "b": _c(40, "큰변화")},
    )
    assert got == ("큰변화", "AI 노출 상승")
    assert pick_competitor_change({"a": _c(35)}, {"a": _c(0)}) == ("경쟁사A", "AI 노출 상승")   # 0점은 측정된 값


# ── 발송 경로: 주 1회 상한, 전달 성공일 때만 기록 ───────────────────

def _run(monkeypatch, *, recent_rows, delivered):
    inserts, sends = [], []

    class R:
        def __init__(self, data):
            self.data = data
            self.count = len(data)

    class Q:
        def __init__(self, name, rows):
            self.name, self._rows, self.op, self.payload = name, rows, "select", None
        def select(self, *a, **k): return self
        def eq(self, *a, **k): return self
        def order(self, *a, **k): return self
        def limit(self, *a, **k): return self
        def gte(self, *a, **k): return self
        def in_(self, *a, **k): return self
        def insert(self, payload):
            self.op, self.payload = "insert", payload
            return self
        @property
        def not_(self): return self
        def is_(self, *a, **k): return self

    scans = [
        {"competitor_scores": {"c1": _c(62)}, "total_score": 50},
        {"competitor_scores": {"c1": _c(48)}, "total_score": 50},
    ]

    class C:
        def table(self, name):
            if name == "scan_results":
                return Q(name, scans)
            if name == "notifications":
                return Q(name, recent_rows)
            return Q(name, [])

    async def fake_db(q):
        if q.op == "insert":
            inserts.append((q.name, q.payload))
            return R([q.payload])
        return R(q._rows)

    class N:
        async def send_competitor_change(self, phone, biz, comp, text):
            sends.append((comp, text))
            return delivered
        async def send_score_change(self, *a, **k): return None
        async def send_ai_citation(self, *a, **k): return None
        async def send_action_items(self, *a, **k): return None

    monkeypatch.setattr(jobs, "_db", fake_db)
    user = {
        "businesses": [{"id": "b1", "name": "내가게"}],
        "profiles": {"phone": "01012345678", "kakao_scan_notify": True, "kakao_competitor_notify": True},
        "user_id": "u1",
    }
    asyncio.run(jobs._send_kakao_notifications(C(), N(), user))
    return sends, [i for i in inserts if i[0] == "notifications"]


def test_sends_once_and_records_only_when_delivered(monkeypatch):
    sends, ins = _run(monkeypatch, recent_rows=[], delivered=True)
    assert sends == [("경쟁사A", "AI 노출 상승")]
    assert len(ins) == 1 and ins[0][1]["type"] == "competitor_alert" and ins[0][1]["business_id"] == "b1"


def test_failed_delivery_is_not_recorded_as_sent(monkeypatch):
    sends, ins = _run(monkeypatch, recent_rows=[], delivered=False)
    assert len(sends) == 1
    assert ins == [], "전달되지 않았는데 '보냄'으로 기록하면 7일 상한에 걸려 재시도가 막힌다"


def test_weekly_cap_blocks_a_second_alert(monkeypatch):
    sends, ins = _run(monkeypatch, recent_rows=[{"id": "x"}], delivered=True)
    assert sends == [] and ins == []


# ── 제거·꺼짐 확인 ────────────────────────────────────────────────

SRC = open("scheduler/jobs.py", encoding="utf-8").read()


def test_no_more_numeric_or_zero_rank_change_calls():
    assert "send_competitor_change(" in SRC
    for m in re.finditer(r"send_competitor_change\(([^)]*)\)", SRC):
        assert "int(delta)" not in m.group(1)
        assert not re.search(r",\s*0\s*$", m.group(1).strip()), "순위변화 0 발송이 남아 있다"
    assert SRC.count("send_competitor_change(") == 1, "경쟁사 변화 카카오 발송은 한 곳에서만 해야 한다"


def test_spike_and_new_competitor_alerts_are_off_by_default():
    assert re.search(r'if os\.getenv\("COMPETITOR_SPIKE_ALERT_ENABLED", "false"\)\.lower\(\) == "true":\s*\n\s*try:\s*\n\s*await _detect_competitor_score_spike\(\)', SRC)
    assert re.search(r'if os\.getenv\("NEW_COMPETITOR_ALERT_ENABLED", "false"\)\.lower\(\) == "true":\s*\n\s*scheduler\.add_job\(\s*\n\s*detect_new_competitors', SRC)
    assert len(re.findall(r"await _detect_competitor_score_spike\(\)", SRC)) == 1
    assert len(re.findall(r"detect_new_competitors,\s*\"cron\"", SRC)) == 1
