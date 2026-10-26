"""네이버 Playwright 일일 상한 사용량 가시화·사전 경고 테스트 (2026-10-26)."""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import services.ai_scanner as sc


def _reset(monkeypatch, cap):
    monkeypatch.setattr(sc, "_NAVER_PLAYWRIGHT_DAILY_CAP", cap)
    monkeypatch.setattr(sc, "_naver_pw_quota_date", "")
    monkeypatch.setattr(sc, "_naver_pw_quota_count", 0)
    monkeypatch.setattr(sc, "_naver_pw_quota_alert_sent_date", "")
    sc._naver_pw_quota_by_source.clear()
    sc._naver_pw_quota_warn_sent.clear()


def test_snapshot_counts_by_source(monkeypatch):
    _reset(monkeypatch, 100)
    for _ in range(3):
        assert sc.check_naver_playwright_quota("a.pc")
    assert sc.check_naver_playwright_quota("b.mobile")
    snap = sc.naver_playwright_quota_snapshot()
    assert snap["used"] == 4 and snap["cap"] == 100
    assert snap["by_source"] == {"a.pc": 3, "b.mobile": 1}
    # 스냅샷은 카운트를 올리지 않는다
    assert sc.naver_playwright_quota_snapshot()["used"] == 4


def test_warnings_at_70_and_90_percent_once_each(monkeypatch):
    _reset(monkeypatch, 10)
    sent = []

    async def fake_alert(subject, message):
        sent.append(subject)
        return True

    import services.email_sender as es
    monkeypatch.setattr(es, "send_operator_alert", fake_alert)

    async def run():
        for _ in range(10):
            sc.check_naver_playwright_quota("x")
        await asyncio.sleep(0)  # 예약된 알림 태스크 실행
        await asyncio.sleep(0)

    asyncio.run(run())
    assert sum("70%" in s for s in sent) == 1
    assert sum("90%" in s for s in sent) == 1


def test_warning_without_event_loop_does_not_raise(monkeypatch):
    """동기 호출(이벤트 루프 없음)에서도 예외 없이 로그만 남기고 카운트는 정상."""
    _reset(monkeypatch, 4)
    for _ in range(4):
        assert sc.check_naver_playwright_quota("sync") is True
    assert sc.check_naver_playwright_quota("sync") is False  # 상한 초과 동작은 그대로


def test_new_day_resets_by_source(monkeypatch):
    _reset(monkeypatch, 100)
    sc.check_naver_playwright_quota("old")
    monkeypatch.setattr(sc, "_naver_pw_quota_date", "1999-01-01")
    sc.check_naver_playwright_quota("new")
    assert sc.naver_playwright_quota_snapshot()["by_source"] == {"new": 1}
