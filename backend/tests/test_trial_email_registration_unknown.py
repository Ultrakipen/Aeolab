"""체험 결과 이메일: 스마트플레이스 등록 여부를 읽지 못했을 때(is_smart_place=None) 긍정·부정을 단정하지 않는다 (2026-11-01).

None → "스마트플레이스 미등록"(부정 단정)도, "기본 설정이 갖춰져 있습니다"(긍정 단정)도 나오면 안 된다.
주의: 메일 본문에 들어가는 것은 '핵심 발견 1가지' 블록(_f_title)이다. 같은 함수의 improvements_section/evidence_section은
템플릿에 쓰이지 않는 죽은 코드라 여기서 검증하지 않는다.
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import services.email_sender as es  # noqa: E402


def _render(monkeypatch, **summary):
    sent = {}

    async def fake_send(to, subject, html, *a, **k):
        sent["html"] = html
        return True

    monkeypatch.setattr(es, "RESEND_API_KEY", "x")
    monkeypatch.setattr(es, "send_email", fake_send)
    base = {"business_name": "테스트식당", "region": "서울 성동구", "category": "restaurant", "score": 50,
            "ai_mentioned": True, "has_intro": True, "has_recent_post": True}
    asyncio.run(es.send_trial_claim_link("a@b.c", "https://aeolab.co.kr/x", {**base, **summary}))
    return sent["html"]


def test_unknown_registration_is_neither_unregistered_nor_ok(monkeypatch):
    html = _render(monkeypatch, is_smart_place=None)
    assert "등록 여부는 이번에 확인하지 못했습니다" in html
    assert "스마트플레이스 미등록" not in html
    assert "기본 설정이 갖춰져 있습니다" not in html


def test_confirmed_unregistered_still_reported(monkeypatch):
    html = _render(monkeypatch, is_smart_place=False)
    assert "스마트플레이스 미등록" in html
    assert "확인하지 못했습니다" not in html


def test_confirmed_registered_keeps_positive_finding(monkeypatch):
    html = _render(monkeypatch, is_smart_place=True)
    assert "기본 설정이 갖춰져 있습니다" in html
    assert "확인하지 못했습니다" not in html


def test_unknown_registration_does_not_hide_real_negative_findings(monkeypatch):
    # 소개글이 없다는 것은 따로 확인된 사실이라 등록 여부를 몰라도 그대로 알린다
    html = _render(monkeypatch, is_smart_place=None, has_intro=False)
    assert "소개글 없음" in html
