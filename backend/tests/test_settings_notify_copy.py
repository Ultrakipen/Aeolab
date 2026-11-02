"""알림 설정 화면 안내 문구가 실제 동작과 맞는지 (2026-11-02).

이전 문구는 "측정 완료 알림: AI 측정이 완료되면 결과를 알림톡으로 받습니다"(실제로는 이 스위치가 점수 변화·AI 인용·이달 할 일·리포트도 제어하고
스캔 완료는 주 1회로 제한됨)와 "경쟁사 순위변동 알림: 경쟁사가 내 점수를 추월하면 즉시"(실제로는 등급 구간이 달라졌을 때만, 추정치)였다 — 지침 9번.
서버 테스트가 frontend 폴더를 읽으므로 프론트를 먼저 배포한 뒤 이 테스트를 배포한다.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import notify_weekly_cap as cap  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = open(os.path.join(ROOT, "frontend", "app", "(dashboard)", "settings", "SettingsClient.tsx"), encoding="utf-8").read()


def test_overpromising_phrases_are_gone():
    for phrase in ("추월하면 즉시", "경쟁사 순위변동 알림", "AI 측정이 완료되면 결과를 알림톡으로 받습니다"):
        assert phrase not in SRC, phrase


def test_screen_states_the_weekly_limit_the_backend_enforces(monkeypatch):
    monkeypatch.delenv("NOTIFY_WEEKLY_CAP", raising=False)
    monkeypatch.delenv("NOTIFY_SCAN_COMPLETE_WEEKLY", raising=False)
    assert cap.weekly_cap() == 3 and cap.per_type_weekly("scan_complete") == 1      # 화면 문구의 숫자(최대 3건·주 1회)의 근거
    assert "7일에 최대 3건" in SRC and "측정 완료 알림은 주 1회까지만" in SRC


def test_screen_says_competitor_scores_are_estimates_and_billing_is_separate():
    assert "경쟁사 점수는 추정치입니다" in SRC
    assert "결제·구독 안내는 이 설정과 관계없이" in SRC
