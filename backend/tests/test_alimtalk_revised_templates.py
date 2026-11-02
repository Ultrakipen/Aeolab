"""개정 알림톡 템플릿 AEOLAB_SCORE_02·AEOLAB_SCAN_02 전환 (2026-11-02, 승인 본문 = 사용자 콘솔 캡처 스캔_02.png·스코어_02.png).

- 코드가 채우는 변수는 승인 본문의 변수와 **정확히** 같아야 한다(어긋나면 -3004로 전부 실패).
- 환경변수가 비어 있으면 기존 템플릿(SCORE_01·SCAN_01) 그대로, 알려진 개정 코드가 아니면 무시한다.
- SCORE_02는 등급이 바뀐 경우에만 보낸다(본문: "등급 변동 안내 … 변경 내역이 확인될 경우 발송"). 순위는 집계 3곳 미만이면 '집계 전'.
- SCAN_02는 '가장 많이 언급됨' 줄이 없어 언급 플랫폼 조건 없이 보내고, 스캔마다 가지 않게 번호당 주 1건(notify_weekly_cap).
"""
import asyncio
import os
import re
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import services.kakao_notify as kn  # noqa: E402
from services import notify_weekly_cap as cap  # noqa: E402
from tests.test_notify_weekly_cap import Ledger, PHONE  # noqa: E402

# 콘솔 승인 본문 전문(2026-11-02 캡처)
SCORE_02_BODY = ("[AEOlab]\n#{사업장명} AI 노출 등급 변동 안내\n\n해당 메시지는 고객님께서 신청하신 검색 노출 등급 변동 안내 알림으로, 변경 내역이 확인될 경우 발송됩니다.\n\n"
                 "확인 일시: #{스캔일시}\n이전 등급: #{이전등급}\n현재 등급: #{현재등급}\n변화: #{변화}\n업종 내 순위: #{순위}")
SCAN_02_BODY = ("[AEOlab]\n#{사업장명} AI 스캔 완료\n\n해당 메시지는 고객님께서 설정에서 켜신 스캔 완료 알림으로, AI 검색 노출 스캔이 완료될 경우 발송됩니다.\n\n"
                "스캔 일시: #{스캔일시}\nAI 검색 준비도: #{현재단계}\n지난 스캔 대비: #{변화}\n\n자세한 결과와 개선 가이드는 대시보드에서 확인하세요.\nhttps://aeolab.co.kr/dashboard")


def _vars(body):
    return set(re.findall(r"#\{([^}]+)\}", body))


class _Resp:
    status_code, text = 200, "{}"

    def json(self):
        return {"header": {"isSuccessful": True}}


def _wire(monkeypatch, *, score02=False, scan02=False):
    sent = []

    class _Client:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def post(self, url, headers=None, json=None):
            sent.append(json)
            return _Resp()

    async def _open(phone):
        return False

    monkeypatch.setattr(kn.httpx, "AsyncClient", _Client)
    monkeypatch.setattr(kn, "_subscription_ended", _open)
    monkeypatch.setenv("KAKAO_APP_KEY", "x")
    for name, on, code in (("KAKAO_TEMPLATE_SCORE_CHANGE", score02, "AEOLAB_SCORE_02"), ("KAKAO_TEMPLATE_SCAN_COMPLETE", scan02, "AEOLAB_SCAN_02")):
        if on:
            monkeypatch.setenv(name, code)
        else:
            monkeypatch.delenv(name, raising=False)
    n = kn.KakaoNotifier()
    monkeypatch.setattr(n, "_log_notification", lambda *a, **k: None)
    return n, sent


def _params(sent_item):
    return sent_item["recipientList"][0]["templateParameter"]


# ── SCORE_02 ─────────────────────────────────────────────────────────────────────────
def test_score02_variables_match_the_approved_body_exactly(monkeypatch):
    n, sent = _wire(monkeypatch, score02=True)
    assert asyncio.run(n.send_score_change(PHONE, "가게", 48, 62, 5, 3, curr_total=12)) is True
    assert sent[0]["templateCode"] == "AEOLAB_SCORE_02"
    assert set(_params(sent[0])) == _vars(SCORE_02_BODY)             # 이름만(껍데기 없이), 승인 본문 변수와 같은 집합
    assert all(len(v) <= 14 for v in _params(sent[0]).values())


def test_score02_values_for_a_grade_change(monkeypatch):
    n, sent = _wire(monkeypatch, score02=True)
    asyncio.run(n.send_score_change(PHONE, "가게", 48, 62, 5, 3, curr_total=12))      # 보강 단계 → 개선 중
    p = _params(sent[0])
    assert (p["이전등급"], p["현재등급"], p["변화"], p["순위"]) == ("보강 단계", "개선 중", "등급 상승", "3위")
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", p["스캔일시"])


def test_score02_is_not_sent_when_the_grade_did_not_change(monkeypatch):
    n, sent = _wire(monkeypatch, score02=True)
    assert asyncio.run(n.send_score_change(PHONE, "가게", 60, 66, 2, 2, curr_total=12)) is False     # 둘 다 개선 중(55~75)
    assert sent == []                                                                              # 호출자가 '보냈다'고 기록하지 않는다


@pytest.mark.parametrize("curr_r,total,expected", [(3, 12, "3위"), (3, 3, "3위"), (2, 2, "집계 전"), (0, 12, "집계 전"), (None, 12, "집계 전"), (3, None, "집계 전")])
def test_score02_rank_is_told_only_when_it_is_meaningful(monkeypatch, curr_r, total, expected):
    n, sent = _wire(monkeypatch, score02=True)
    asyncio.run(n.send_score_change(PHONE, "가게", 48, 62, 5, curr_r, curr_total=total))
    assert _params(sent[0])["순위"] == expected


def test_score02_downgrade_text(monkeypatch):
    n, sent = _wire(monkeypatch, score02=True)
    asyncio.run(n.send_score_change(PHONE, "가게", 62, 48, 3, 5, curr_total=12))
    assert _params(sent[0])["변화"] == "등급 하락"


# ── SCAN_02 ──────────────────────────────────────────────────────────────────────────
def test_scan02_variables_match_the_approved_body_exactly(monkeypatch):
    n, sent = _wire(monkeypatch, scan02=True)
    assert asyncio.run(n.send_scan_complete(PHONE, "가게", 62, "보강 단계", 10.0, "", "")) is True
    assert sent[0]["templateCode"] == "AEOLAB_SCAN_02"
    assert set(_params(sent[0])) == _vars(SCAN_02_BODY)
    assert all(len(v) <= 14 for v in _params(sent[0]).values())


@pytest.mark.parametrize("score,prev,expected", [
    (62, "보강 단계", "보강 단계 → 개선 중"), (62, "개선 중", "단계 유지"), (30, "", "비교 전"), (80, "개선 중", "개선 중 → 양호"), (20, "보강 단계", "보강 단계 → 시작 전"),
])
def test_scan02_change_text(monkeypatch, score, prev, expected):
    n, sent = _wire(monkeypatch, scan02=True)
    asyncio.run(n.send_scan_complete(PHONE, "가게", score, prev, 0.0, "", ""))
    assert _params(sent[0])["변화"] == expected and _params(sent[0])["현재단계"] == kn._grade(score)


def test_scan02_no_longer_requires_a_mentioning_platform(monkeypatch):
    n, sent = _wire(monkeypatch, scan02=True)
    asyncio.run(n.send_scan_complete(PHONE, "가게", 30, "", 0.0, "", ""))        # 개정 본문엔 '가장 많이 언급됨' 줄이 없다
    assert len(sent) == 1


# ── 전환 스위치 ──────────────────────────────────────────────────────────────────────
def test_default_keeps_the_old_templates_and_their_variables(monkeypatch):
    n, sent = _wire(monkeypatch)
    asyncio.run(n.send_score_change(PHONE, "가게", 48, 62, 5, 3))
    asyncio.run(n.send_scan_complete(PHONE, "가게", 62, "보강 단계", 10.0, "ChatGPT", "x"))
    assert [s["templateCode"] for s in sent] == ["AEOLAB_SCORE_01", "AEOLAB_SCAN_01"]
    assert {"이전점수", "현재점수", "이전순위", "현재순위"} <= set(_params(sent[0]))


def test_unknown_override_value_is_ignored(monkeypatch):
    n, sent = _wire(monkeypatch)
    monkeypatch.setenv("KAKAO_TEMPLATE_SCORE_CHANGE", "AEOLAB_SCORE_99")
    monkeypatch.setenv("KAKAO_TEMPLATE_SCAN_COMPLETE", "AEOLAB_SCORE_02")        # 다른 종류의 코드도 거부
    assert kn.resolve_template_code("score_change") == "AEOLAB_SCORE_01"
    assert kn.resolve_template_code("scan_complete") == "AEOLAB_SCAN_01"
    asyncio.run(n.send_score_change(PHONE, "가게", 48, 62, 5, 3))
    assert sent[0]["templateCode"] == "AEOLAB_SCORE_01" and "이전점수" in _params(sent[0])


def test_other_notification_types_are_not_affected_by_the_switch(monkeypatch):
    _wire(monkeypatch, score02=True, scan02=True)
    for t, code in kn.TEMPLATES.items():
        if t not in ("score_change", "scan_complete") and code:
            assert kn.resolve_template_code(t) == code


# ── 스캔 완료 주 1건(번호당) ─────────────────────────────────────────────────────────
@pytest.fixture
def ledger(monkeypatch):
    monkeypatch.setenv("NOTIFY_WEEKLY_CAP", "3")
    monkeypatch.delenv("NOTIFY_WEEKLY_RESERVE", raising=False)
    monkeypatch.delenv("NOTIFY_SCAN_COMPLETE_WEEKLY", raising=False)
    led = Ledger()
    monkeypatch.setattr(cap, "_db", lambda: (led, led.run))
    return led


def test_scan_complete_is_limited_to_one_per_week_per_number(ledger, monkeypatch):
    n, sent = _wire(monkeypatch, scan02=True)
    asyncio.run(n.send_scan_complete(PHONE, "가게", 62, "개선 중", 0.0, "", ""))
    asyncio.run(n.send_scan_complete(PHONE, "가게", 62, "개선 중", 0.0, "", ""))        # 같은 주 두 번째 스캔 → 막힘
    assert len(sent) == 1
    asyncio.run(n.send_score_change(PHONE, "가게", 48, 62, 5, 3, curr_total=12))       # 다른 종류는 영향 없음
    assert len(sent) == 2
    assert asyncio.run(cap.allowed("010-9999-0000", "scan_complete")) is True          # 다른 번호는 별개


def test_scan_complete_weekly_limit_is_adjustable(ledger, monkeypatch):
    monkeypatch.setenv("NOTIFY_SCAN_COMPLETE_WEEKLY", "2")
    n, sent = _wire(monkeypatch, scan02=True)
    for _ in range(3):
        asyncio.run(n.send_scan_complete(PHONE, "가게", 62, "개선 중", 0.0, "", ""))
    assert len(sent) == 2
    monkeypatch.setenv("NOTIFY_SCAN_COMPLETE_WEEKLY", "0")                              # 0 = 종류별 제한 없음 — 그래도 전체 상한의 낮은 가치 칸(2건)은 이미 찼다
    asyncio.run(n.send_scan_complete(PHONE, "가게", 62, "개선 중", 0.0, "", ""))
    assert len(sent) == 2
    asyncio.run(n.send_weekly_score_report(PHONE, "가게", 62, 48, "x"))                 # 마지막 칸은 높은 가치(주간 성적표)가 쓴다
    assert len(sent) == 3


# ── 호출부·폴백 대조(소스) ───────────────────────────────────────────────────────────
def test_nightly_alert_passes_the_category_total_and_reads_it():
    from scheduler import jobs
    import inspect
    src = inspect.getsource(jobs._send_kakao_notifications)
    assert 'select("total_score, score_date, rank_in_category, total_in_category")' in src
    assert 'curr_total=curr_h.get("total_in_category")' in src


def test_email_fallback_knows_the_revised_template():
    assert kn.EMAIL_TEMPLATES["AEOLAB_SCORE_02"] is kn.EMAIL_TEMPLATES["AEOLAB_SCORE_01"]
    import inspect
    src = inspect.getsource(kn._email_fallback)
    assert '#{이전등급}' in src and '#{현재등급}' in src
