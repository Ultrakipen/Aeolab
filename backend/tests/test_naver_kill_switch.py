"""네이버 접속 킬스위치 (2026-11-02, 작업 T-4 / 문서 W-2 / 결정 D-4).

켜면 모든 Playwright 네이버 접속이 네이버 요청 없이 기존 쿨다운 오류 코드로 끝나고, 끄면 곧바로 평소대로 돌아온다.
네이버에 접속하지 않는다(가짜 Playwright로 시도 횟수만 센다).
"""
import asyncio
import os
import sys
from datetime import date
from unittest.mock import patch

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import naver_access_guard as g  # noqa: E402


@pytest.fixture
def flag(tmp_path, monkeypatch):
    """킬스위치 파일 경로(conftest가 존재하지 않는 경로로 격리해 둔 것을 이 경로로 바꾼다). 파일을 만들면 켜짐, 지우면 꺼짐."""
    p = tmp_path / "kill_switch_flag"
    monkeypatch.setenv("NAVER_KILL_SWITCH_FILE", str(p))
    return p


# ── 켜고 끄기 ────────────────────────────────────────────────────────────────
def test_default_is_off(flag):
    assert g.kill_switch_on() is False


@pytest.mark.parametrize("val,expected", [
    ("1", True), ("true", True), ("TRUE", True), (" yes ", True), ("on", True),
    ("0", False), ("false", False), ("", False), ("no", False), ("maybe", False),
])
def test_env_values(flag, monkeypatch, val, expected):
    monkeypatch.setenv("NAVER_ACCESS_KILL_SWITCH", val)
    assert g.kill_switch_on() is expected


def test_file_flag_toggles_instantly_without_restart(flag):
    assert g.kill_switch_on() is False
    flag.write_text("")
    assert g.kill_switch_on() is True            # 파일을 만든 다음 호출부터 바로 켜진다
    flag.unlink()
    assert g.kill_switch_on() is False           # 지우면 바로 꺼진다


def test_either_source_is_enough(flag, monkeypatch):
    flag.write_text("")
    monkeypatch.setenv("NAVER_ACCESS_KILL_SWITCH", "false")
    assert g.kill_switch_on() is True            # 환경변수가 꺼짐이어도 파일이 있으면 켜짐


# ── 공통 진입점 ────────────────────────────────────────────────────────────────
def test_begin_access_refuses_with_existing_cooldown_codes_when_on(flag):
    flag.write_text("")
    assert g.begin_place_access("t") == (False, g.COOLDOWN_ERROR)
    assert g.begin_search_access("t") == (False, g.SEARCH_COOLDOWN_ERROR)


def test_begin_access_allows_again_right_after_switch_off(flag):
    flag.write_text("")
    assert g.begin_place_access("t")[0] is False
    flag.unlink()
    assert g.begin_place_access("t") == (True, None)
    assert g.begin_search_access("t") == (True, None)


def test_kill_switch_does_not_touch_breaker_state(flag):
    """킬스위치는 차단 회로의 상태(연속 차단 횟수·시험 접속 표시)를 바꾸지 않는다 — 해제하면 바로 평소대로."""
    flag.write_text("")
    for _ in range(5):
        g.begin_place_access("t")
        g.begin_search_access("t")
    assert g.snapshot()["strikes"] == 0 and g.snapshot()["probing_since"] == 0
    assert g.search_snapshot()["strikes"] == 0 and g.search_snapshot()["open"] is False


def test_kill_switch_does_not_consume_the_half_open_probe(flag):
    """쿨다운이 끝나 시험 접속 1회를 기다리는 중에 킬스위치를 켜도 그 시험 접속 기회를 소모하지 않는다."""
    g.report_place_block("t", now=1000.0)
    after_cooldown = 1000.0 + 4 * 3600
    flag.write_text("")
    assert g.begin_place_access("t", now=after_cooldown)[0] is False
    assert g.snapshot()["probing_since"] == 0
    flag.unlink()
    assert g.begin_place_access("t", now=after_cooldown)[0] is True      # 해제 후 첫 호출이 시험 접속


# ── 실제 접속 함수들: 요청도 상한 소모도 없다 ───────────────────────────────────────
@pytest.fixture
def quota(monkeypatch):
    import services.ai_scanner as sc
    monkeypatch.setattr(sc, "_NAVER_PLAYWRIGHT_DAILY_CAP", 10)
    monkeypatch.setattr(sc, "_naver_pw_quota_date", date.today().isoformat())
    monkeypatch.setattr(sc, "_naver_pw_quota_count", 0)
    monkeypatch.setattr(sc, "_naver_pw_quota_alert_sent_date", date.today().isoformat())
    sc._naver_pw_quota_by_source.clear()
    sc._naver_pw_quota_warn_sent.clear()
    return sc


class _Boom:
    def __init__(self):
        self.calls = 0

    def __call__(self, *a, **k):
        self.calls += 1
        raise AssertionError("킬스위치가 켜져 있는데 Playwright를 열려 했다")


def _trip_all_playwright(boom):
    """Playwright를 가져다 쓰는 모든 모듈의 진입을 함정으로 바꾼다. 가드가 깨지는 회귀가 생겨도 테스트가 진짜 네이버에 접속하지 않게 하는 안전망
    (킬스위치 가드를 일부러 뺀 변이 검증에서 이 테스트가 75초 동안 실제 Playwright를 띄웠다 — 서버 배포 때 같은 일이 생기면 안 된다).
    모듈 최상단 import(속성 교체)와 함수 안쪽 import(playwright.async_api 교체)를 모두 막는다."""
    import contextlib
    import importlib
    stack = contextlib.ExitStack()
    for mod in ("services.competitor_place_crawler", "services.naver_place_stats", "services.smart_place_auto_check",
                "services.ai_scanner.naver_scanner", "services.blog_search_analyzer", "services.screenshot"):
        stack.enter_context(patch.object(importlib.import_module(mod), "async_playwright", boom))
    stack.enter_context(patch("playwright.async_api.async_playwright", boom))
    return stack


def test_place_functions_do_not_open_playwright_or_use_quota(flag, quota):
    from services.competitor_place_crawler import fetch_competitor_faq_items, fetch_competitor_place_data
    from services.naver_place_stats import NaverPlaceStatsService, check_smart_place_completeness
    from services.smart_place_auto_check import auto_check_smart_place
    flag.write_text("")
    before = quota._naver_pw_quota_count
    boom = _Boom()
    with _trip_all_playwright(boom):
        r = [
            asyncio.run(check_smart_place_completeness("https://m.place.naver.com/place/123/home")),
            asyncio.run(NaverPlaceStatsService().fetch_stats("123")),
            asyncio.run(auto_check_smart_place("123")),
            asyncio.run(fetch_competitor_place_data("123")),
            asyncio.run(fetch_competitor_faq_items("123")),
        ]
    assert boom.calls == 0
    for x in r:
        assert x["error"] == g.COOLDOWN_ERROR
    assert quota._naver_pw_quota_count == before


def test_search_side_entry_points_do_not_open_playwright(flag):
    from services import blog_search_analyzer as bsa
    from services import naver_place_resolver as npr
    from services import screenshot as shot
    from services.ai_scanner.naver_scanner import NaverAIBriefingScanner as S
    flag.write_text("")
    boom = _Boom()
    with patch("services.ai_scanner.check_naver_playwright_quota", lambda *_a, **_k: True), _trip_all_playwright(boom):
        r1 = asyncio.run(bsa.analyze_blog_search("창원 카페 추천", "내가게", []))
        r2 = asyncio.run(npr.resolve_naver_place("홍스튜디오", "창원", ""))
        r3 = asyncio.run(shot.capture_ai_result("naver", "창원 카페", "biz1"))
        r4 = asyncio.run(S().check_mention("창원 카페", "내가게"))
    assert boom.calls == 0
    assert r1["error"] == g.SEARCH_COOLDOWN_ERROR
    assert r2["status"] == "error" and r2["naver_place_id"] is None
    assert r3 is None
    assert r4["error"] == g.SEARCH_COOLDOWN_ERROR and r4["mentioned"] is False      # '미노출'이 아니라 측정 못 함


def test_keyword_rank_rows_become_unmeasured_not_zero(flag, monkeypatch):
    from services import naver_keyword_rank as kr
    from services.score_engine import calc_keyword_search_rank_score
    from tests.test_naver_block_drill import _PW, _Tripwire
    flag.write_text("")
    _Tripwire.touched = []
    kr.reset_card_cache_for_tests()
    monkeypatch.setattr(kr, "async_playwright", lambda: _PW())
    monkeypatch.setattr(kr, "check_naver_playwright_quota", lambda *a, **k: True)
    out = asyncio.run(kr._run_with_browser(["키워드1", "키워드2"], "가게", "123", ""))
    assert _Tripwire.touched == []
    assert all(out[k]["error"] == g.SEARCH_COOLDOWN_ERROR for k in ("키워드1", "키워드2"))
    assert calc_keyword_search_rank_score({"keyword_ranks": out}) == (0.0, False)


# ── 쿠키 확인 잡(로그인 세션 사용)도 멈춘다 ──────────────────────────────────────────
def test_cookie_health_job_does_not_run_while_switch_is_on(flag, monkeypatch):
    import scheduler.jobs as jobs
    flag.write_text("")
    boom = _Boom()
    monkeypatch.setenv("NAVER_COOKIE_NID_AUT", "dummy")
    with patch("playwright.async_api.async_playwright", boom):
        asyncio.run(jobs.check_naver_cookie_health_job())
    assert boom.calls == 0


def test_cookie_health_job_checks_switch_before_anything_else():
    import inspect
    import scheduler.jobs as jobs
    src = inspect.getsource(jobs.check_naver_cookie_health_job)
    assert src.index("_kill_on()") < src.index('nid_aut = os.getenv("NAVER_COOKIE_NID_AUT", "")')
    assert src.index("_kill_on()") < src.index("chromium.launch")


# ── 사용자에게 보이는 안내 ───────────────────────────────────────────────────────
def test_user_status_says_paused_without_inventing_a_time(flag, monkeypatch):
    from services import naver_status as ns
    import services.ai_scanner as ai
    monkeypatch.setattr(ai, "naver_playwright_quota_usage", lambda: (0, 250))   # 일일 한도 상태와 무관하게 킬스위치만 본다
    flag.write_text("")
    s = ns.user_status(1000.0)
    assert s["state"] == "delayed" and s["reason"] == "paused"
    assert s["resume_in_sec"] is None and s["eta_label"] is None
    assert "멈춰" in s["message"] and "분 뒤" not in s["message"] and "시간 뒤" not in s["message"]
    assert "ChatGPT" in s["detail"]                          # 글로벌 AI 측정은 계속된다는 안내 유지
    flag.unlink()
    assert ns.user_status(1000.0)["state"] == "ok"           # 끄면 배너가 사라진다


def test_manual_sync_503_uses_paused_wording(flag):
    import inspect
    import routers.competitor as rc
    src = inspect.getsource(rc)
    assert 'if _st.get("reason") == "paused":' in src
    assert src.index('if _st.get("reason") == "paused":') < src.index('elif _st.get("state") == "delayed" and _st.get("eta_label"):')
    assert "몰려 있어요" in src                                # 기존 일반 문구는 else에 그대로 남아 있다


# ── 구조: 모든 Playwright 진입 함수가 두 진입점 중 하나를 거친다 → 킬스위치가 함수 단위로 적용된다 ──────────────
def test_kill_switch_is_inside_both_common_entry_points():
    import inspect
    assert "kill_switch_on()" in inspect.getsource(g.begin_place_access)
    assert "kill_switch_on()" in inspect.getsource(g.begin_search_access)
    # 킬스위치 검사가 상태 파일 로드·시험 접속 표시보다 앞이다(회로 상태를 건드리지 않는다)
    assert inspect.getsource(g.begin_place_access).index("kill_switch_on()") < inspect.getsource(g.begin_place_access).index("_load()")
    assert inspect.getsource(g.begin_search_access).index("kill_switch_on()") < inspect.getsource(g.begin_search_access).index("_search_load()")
