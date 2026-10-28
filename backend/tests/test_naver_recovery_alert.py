"""차단 뒤 회복 확인 시 운영자 알림 (2026-10-28).

배경: 10-28 12:00 플레이스 접속이 처음으로 회복됐는데 로그·DB 기록뿐이라 운영자는 로그를 직접 읽어서야 알았다.
차단 때는 메일이 가는데 회복 때는 가지 않아 "차단된 채 방치된 것 같은 불안"과 "풀린 줄 모르고 수동 대응"이 모두 생긴다.
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import naver_access_guard as g  # noqa: E402


def _mails(monkeypatch):
    sent = []

    async def fake(subject, message):
        sent.append((subject, message))
        return True

    import services.email_sender as es
    monkeypatch.setattr(es, "send_operator_alert", fake)
    return sent


def _recovery(sent):
    return [s for s in sent if "회복" in s[0]]


def test_place_recovery_sends_one_operator_mail_after_a_block(monkeypatch):
    sent = _mails(monkeypatch)

    async def flow():
        g.report_place_block("naver_place_stats.check", now=1000.0)
        g.report_place_ok()
        await asyncio.sleep(0)       # 이벤트 루프에 얹은 메일 태스크가 돌게 한다
        await asyncio.sleep(0)

    asyncio.run(flow())
    assert len(_recovery(sent)) == 1
    subject, body = _recovery(sent)[0]
    assert "플레이스" in subject and "직전 연속 차단 1회" in body and "48시간" in body
    assert any("접속 제한 감지" in s[0] for s in sent)         # 차단 메일은 기존대로


def test_search_recovery_sends_one_operator_mail_after_a_block(monkeypatch):
    sent = _mails(monkeypatch)

    async def flow():
        g.report_search_block("naver_keyword_rank", now=1000.0)
        g.report_search_ok()
        await asyncio.sleep(0)
        await asyncio.sleep(0)

    asyncio.run(flow())
    assert len(_recovery(sent)) == 1 and "검색 화면" in _recovery(sent)[0][0]


def test_ok_without_a_prior_block_sends_nothing(monkeypatch):
    sent = _mails(monkeypatch)

    async def flow():
        g.report_place_ok()
        g.report_search_ok()
        await asyncio.sleep(0)
        await asyncio.sleep(0)

    asyncio.run(flow())
    assert sent == []                                            # 평소 정상 화면마다 메일이 가면 안 된다


def test_repeated_ok_after_recovery_does_not_resend(monkeypatch):
    sent = _mails(monkeypatch)

    async def flow():
        g.report_place_block("x", now=1000.0)
        g.report_place_ok()
        g.report_place_ok()
        g.report_place_ok()
        await asyncio.sleep(0)
        await asyncio.sleep(0)

    asyncio.run(flow())
    assert len(_recovery(sent)) == 1


def test_recovery_outside_event_loop_does_not_crash(monkeypatch):
    sent = _mails(monkeypatch)
    g.report_place_block("x", now=1000.0)
    g.report_place_ok()                                          # 이벤트 루프 밖(동기 호출) — 알림만 생략하고 예외 없이 끝난다
    assert sent == []
    assert g.snapshot()["strikes"] == 0
