"""네이버 확인 지연 배너 문구의 사실성 (2026-11-02, docs/naver_outage_customer_communication 검토 반영).

- Gemini 측정이 공개 화면에서 '준비 중'(featureFlags GEMINI_MEASUREMENT_LIVE=false)인 동안 배너가 "Gemini 측정은 그대로 진행"이라고 말하면 안 된다.
- 재개 시점은 약속이 아니라 '예상'으로 말한다(재시도가 다시 막힐 수 있다).
서버 테스트가 frontend 폴더를 읽으므로 프론트가 먼저 배포돼 있어야 한다.
"""
import os

import pytest

from services import naver_access_guard as g
from services import naver_status as ns

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture(autouse=True)
def _clean(tmp_path, monkeypatch):
    monkeypatch.setenv("NAVER_PLACE_BREAKER_FILE", str(tmp_path / "place.json"))
    monkeypatch.setenv("NAVER_SEARCH_BREAKER_FILE", str(tmp_path / "search.json"))
    monkeypatch.setenv("NAVER_RATE_WINDOW_FILE", str(tmp_path / "rate.json"))
    g.reset_for_tests()
    g.reset_search_for_tests()
    g.reset_rate_for_tests()
    yield
    g.reset_for_tests()
    g.reset_search_for_tests()


def _quota(monkeypatch, used=0, cap=250):
    import services.ai_scanner as ai
    monkeypatch.setattr(ai, "naver_playwright_quota_usage", lambda: (used, cap))


def _all_states(monkeypatch):
    """지연 3종(쿨다운·일일 한도·재개 중)과 수동 중단의 실제 payload."""
    out = {}
    _quota(monkeypatch, used=250, cap=250)                 # 일일 한도는 차단 기록이 없는 상태에서 먼저 만든다(차단 기록은 파일에 남아 쿨다운이 우선한다)
    out["daily_limit"] = ns.user_status(1000.0)
    _quota(monkeypatch)
    g.report_search_block("t", now=1000.0)
    out["cooldown"] = ns.user_status(1000.0 + 600)
    out["recovering"] = ns.user_status(1000.0 + 3 * 3600)
    monkeypatch.setattr(g, "kill_switch_on", lambda: True)
    out["paused"] = ns.user_status(1000.0)
    return out


def _gemini_is_live() -> bool:
    src = open(os.path.join(ROOT, "frontend", "lib", "featureFlags.ts"), encoding="utf-8").read()
    return "GEMINI_MEASUREMENT_LIVE = true" in src


def test_banner_does_not_claim_gemini_measurement_while_it_is_not_live(monkeypatch):
    states = _all_states(monkeypatch)
    assert set(states) == {"cooldown", "recovering", "daily_limit", "paused"} and all(s["state"] != "ok" for s in states.values())
    if _gemini_is_live():
        pytest.skip("Gemini 측정이 공개로 켜졌다 — 이 제약은 더 이상 필요 없다")
    for name, s in states.items():
        assert "Gemini" not in s["message"] + s["detail"], name


def test_keep_note_names_only_measurements_that_keep_running():
    assert "ChatGPT" in ns.KEEP_NOTE and "구글" in ns.KEEP_NOTE
    assert "마지막으로 확인한 값" in ns.KEEP_NOTE and "'확인 전'" in ns.KEEP_NOTE


def test_resume_times_are_expectations_not_promises(monkeypatch):
    states = _all_states(monkeypatch)
    assert "예상" in states["cooldown"]["message"] and "약" in states["cooldown"]["message"]
    assert "예정" in states["daily_limit"]["message"]
    assert "다시 확인돼요." not in states["cooldown"]["message"]            # 단정형 옛 문구
    # 수동 중단은 시각을 말하지 않는다(기존 규칙 유지)
    assert states["paused"]["eta_label"] is None and not any(ch.isdigit() for ch in states["paused"]["message"])
