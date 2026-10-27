"""플레이스 접속 보호(회로 차단기·페이지 수 가중 상한) 테스트 (2026-10-27).

핵심 검증: 차단 중에는 5개 접속 함수가 네이버 요청(Playwright 실행) 없이 즉시 오류를 돌려주고 상한도 소모하지 않는다.
"""
import asyncio
import os
import sys
from datetime import date

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services import naver_access_guard as guard  # noqa: E402


@pytest.fixture(autouse=True)
def _isolated_state(tmp_path, monkeypatch):
    monkeypatch.setenv("NAVER_PLACE_BREAKER_FILE", str(tmp_path / "breaker.json"))
    guard.reset_for_tests()
    yield
    guard.reset_for_tests()


def test_closed_by_default():
    assert guard.begin_place_access("t", now=1000.0) == (True, None)


def test_block_opens_circuit_for_three_hours():
    minutes = guard.report_place_block("t", now=1000.0)
    assert minutes == 180
    assert guard.begin_place_access("t", now=1000.0 + 179 * 60) == (False, guard.COOLDOWN_ERROR)


def test_after_cooldown_only_one_probe_is_allowed_then_recovery_closes():
    guard.report_place_block("t", now=1000.0)
    after = 1000.0 + 181 * 60
    assert guard.begin_place_access("a", now=after) == (True, None)           # 시험 접속 1회
    assert guard.begin_place_access("b", now=after + 1) == (False, guard.COOLDOWN_ERROR)  # 동시에 하나만
    guard.report_place_ok()
    assert guard.begin_place_access("c", now=after + 2) == (True, None)
    assert guard.snapshot(now=after + 2)["strikes"] == 0


def test_blocked_again_after_probe_doubles_the_cooldown_up_to_a_day():
    t = 1000.0
    expected = [180, 360, 720, 1440, 1440]
    for want in expected:
        got = guard.report_place_block("t", now=t)
        assert got == want
        t += (want + 1) * 60                       # 쿨다운 직후 시험 접속이 또 차단되는 상황
        ok, _ = guard.begin_place_access("probe", now=t)
        assert ok is True


def test_duplicate_report_while_open_does_not_escalate():
    guard.report_place_block("a", now=1000.0)
    again = guard.report_place_block("b", now=1010.0)  # 진행 중이던 다른 호출의 늦은 보고
    assert again <= 180
    assert guard.snapshot(now=1010.0)["strikes"] == 1


def test_stale_probe_is_released_after_five_minutes():
    guard.report_place_block("t", now=1000.0)
    after = 1000.0 + 181 * 60
    assert guard.begin_place_access("a", now=after)[0] is True
    assert guard.begin_place_access("b", now=after + 10)[0] is False
    assert guard.begin_place_access("c", now=after + 301)[0] is True   # 시험 접속이 끝나지 않았어도 5분 뒤 재허용


def test_state_survives_restart(tmp_path):
    guard.report_place_block("t", now=2000.0)
    guard.reset_for_tests()                     # 프로세스 재시작을 흉내: 메모리 초기화, 파일은 남음
    assert guard.begin_place_access("t", now=2000.0 + 60) == (False, guard.COOLDOWN_ERROR)


def test_corrupt_state_file_does_not_block_access(tmp_path, monkeypatch):
    p = tmp_path / "bad.json"
    p.write_text("{not json", encoding="utf-8")
    monkeypatch.setenv("NAVER_PLACE_BREAKER_FILE", str(p))
    guard.reset_for_tests()
    assert guard.begin_place_access("t", now=1.0) == (True, None)


def test_place_pace_sleeps_within_bounds(monkeypatch):
    slept = []

    async def fake_sleep(sec):
        slept.append(sec)

    monkeypatch.setattr(guard.asyncio, "sleep", fake_sleep)
    for _ in range(20):
        asyncio.run(guard.place_pace(0.8, 2.5))
    assert all(0.8 <= s <= 2.5 for s in slept)
    assert len(set(round(s, 3) for s in slept)) > 1   # 일정한 간격이 아니다


# ── 상한: 페이지 수 가중치 ──────────────────────────────────────────────
@pytest.fixture
def quota(monkeypatch):
    import services.ai_scanner as sc
    monkeypatch.setattr(sc, "_NAVER_PLAYWRIGHT_DAILY_CAP", 10)
    monkeypatch.setattr(sc, "_naver_pw_quota_date", date.today().isoformat())
    monkeypatch.setattr(sc, "_naver_pw_quota_count", 0)
    monkeypatch.setattr(sc, "_naver_pw_quota_alert_sent_date", date.today().isoformat())  # 알림 경로 생략
    sc._naver_pw_quota_by_source.clear()
    sc._naver_pw_quota_warn_sent.clear()
    return sc


def test_quota_cost_counts_pages_not_calls(quota):
    assert quota.check_naver_playwright_quota("place", cost=5) is True
    assert quota._naver_pw_quota_count == 5
    assert quota._naver_pw_quota_by_source["place"] == 5
    assert quota.check_naver_playwright_quota("place", cost=5) is True     # 정확히 상한까지는 허용
    assert quota.check_naver_playwright_quota("place", cost=1) is False    # 초과
    assert quota._naver_pw_quota_count == 10                               # 거부된 호출은 세지 않는다


def test_quota_denies_when_cost_would_exceed_remaining(quota):
    assert quota.check_naver_playwright_quota("a", cost=8) is True
    assert quota.check_naver_playwright_quota("b", cost=5) is False        # 2 남았는데 5 필요
    assert quota._naver_pw_quota_count == 8
    assert quota.check_naver_playwright_quota("c", cost=2) is True


def test_quota_default_cost_keeps_old_behavior(quota):
    for _ in range(10):
        assert quota.check_naver_playwright_quota("x") is True
    assert quota.check_naver_playwright_quota("x") is False


# ── 차단 중 접속 함수: 네이버 요청도 상한 소모도 없다 ───────────────────
def _open_circuit():
    guard.report_place_block("test", now=__import__("time").time())


def test_all_place_functions_skip_without_requests_or_quota_when_blocked(quota):
    from services.competitor_place_crawler import fetch_competitor_faq_items, fetch_competitor_place_data
    from services.naver_place_stats import NaverPlaceStatsService, check_smart_place_completeness
    from services.smart_place_auto_check import auto_check_smart_place

    _open_circuit()
    before = quota._naver_pw_quota_count

    r1 = asyncio.run(check_smart_place_completeness("https://m.place.naver.com/place/123/home"))
    r2 = asyncio.run(NaverPlaceStatsService().fetch_stats("123"))
    r3 = asyncio.run(auto_check_smart_place("123"))
    r4 = asyncio.run(fetch_competitor_place_data("123"))
    r5 = asyncio.run(fetch_competitor_faq_items("123"))

    for r in (r1, r2, r3, r4, r5):
        assert r["error"] == guard.COOLDOWN_ERROR
    assert quota._naver_pw_quota_count == before   # 상한을 소모하지 않았다
