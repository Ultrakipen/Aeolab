"""갭 카드(PNG 생성·Storage 업로드)는 전달 가능한 때만 만든다 (2026-11-02 점검).

`send_gap_card_url`은 자유 문구 경로(_send_raw)라 승인 템플릿이 없는 동안(KAKAO_ALLOW_FREE_TEXT 꺼짐) 항상 건너뛴다. 그런데 매일 알림 함수 5단계는
받는 사람이 없어도·전달이 불가능해도 실행마다 PNG를 만들어 올렸다 → 사용자 수만큼 하루 한 장씩 Storage에 쌓이고(무료 1GB) 이벤트 루프를 막는다.
"""
import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import services.gap_card as gap_card  # noqa: E402
import services.kakao_notify as kn  # noqa: E402
from scheduler import jobs  # noqa: E402
from tests.test_notify_cadence import FakeDB, _tables, Notifier  # noqa: E402


class GapNotifier(Notifier):
    async def send_gap_card_url(self, *a, **k):
        self.calls.append("gap_card")


def _run(monkeypatch, *, free_text, phone="01012345678", notify_on=True):
    import services.change_signal_guard as g

    async def flags(supabase, biz_id):
        return [False, False]

    generated = []

    async def recorder(**kw):
        generated.append(kw["business_id"])
        return "https://example.invalid/card.png"

    async def fake_db_call(q):
        return await db.run(q)

    db = FakeDB(_tables({
        "scan_results": [{"total_score": 50.0, "competitor_scores": {}, "score_breakdown": {"review_quality": 40.0}}],
        "competitors": [],
        "score_history": [],           # 점수 변화·인용·할 일 단계는 이 시험의 관심사가 아니다
        "ai_citations": [],
        "guides": [],
    }))
    monkeypatch.setattr(g, "recent_naver_unmeasured_flags", flags)
    monkeypatch.setattr(jobs, "_db", fake_db_call)
    monkeypatch.setattr(gap_card, "generate_and_upload_gap_card", recorder)
    monkeypatch.setattr(kn, "_FREE_TEXT_ENABLED", free_text)
    notifier = GapNotifier()
    user = {"businesses": [{"id": "b1", "name": "내가게", "region": "창원", "category": "restaurant"}], "user_id": "u1",
            "profiles": {"phone": phone, "kakao_scan_notify": notify_on, "kakao_competitor_notify": True}}
    asyncio.run(jobs._send_kakao_notifications(db, notifier, user))
    return generated, notifier.calls


def test_card_is_not_built_while_free_text_sending_is_off(monkeypatch):
    generated, calls = _run(monkeypatch, free_text=False)
    assert generated == [] and "gap_card" not in calls          # 전달 못 할 알림을 위해 PNG를 만들지 않는다


def test_card_is_built_and_sent_when_deliverable(monkeypatch):
    generated, calls = _run(monkeypatch, free_text=True)
    assert generated == ["b1"] and calls.count("gap_card") == 1


def test_card_is_not_built_without_a_recipient_or_when_notifications_are_off(monkeypatch):
    assert _run(monkeypatch, free_text=True, phone="")[0] == []
    assert _run(monkeypatch, free_text=True, notify_on=False)[0] == []


def test_free_text_flag_default_is_off():
    """기본값이 꺼짐이어야 위 첫 시험이 운영 기본 동작을 대표한다."""
    src = open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "services", "kakao_notify.py"), encoding="utf-8").read()
    assert '_FREE_TEXT_ENABLED = os.getenv("KAKAO_ALLOW_FREE_TEXT", "")' in src
