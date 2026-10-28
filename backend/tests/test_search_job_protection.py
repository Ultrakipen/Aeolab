"""검색 화면 접속 잡 2개의 회로 차단기·세마포어·차단 화면 처리 (2026-10-28 함수 단위 감사).

배경: ai_tab_trigger_check_job(월·목 09:00)은 회로·쿼터·세마포어가 모두 없었고,
briefing_category_expansion_monitor_job(매월 1일)은 쿼터만 있고 회로·세마포어가 없었다.
차단 화면에서 일부만 측정한 결과로 AI탭 설정(system_status)이나 업종 확대 알림을 내면 안 된다.
"""
import ast
import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import naver_access_guard as g  # noqa: E402
from services.naver_block import is_naver_search_block  # noqa: E402


# ── 공용 감지 함수 ─────────────────────────────────────────────────────────────
def test_search_block_by_url_title_and_text():
    assert is_naver_search_block("https://nid.naver.com/nidlogin.login", "", "")
    assert is_naver_search_block("https://search.naver.com/captcha", "", "")
    assert is_naver_search_block("https://search.naver.com/x", "자동화 방지", "")
    assert is_naver_search_block("https://search.naver.com/x", "", "비정상적인 접근이 감지되었습니다")


def test_search_block_normal_page_and_deep_text_are_not_blocks():
    assert not is_naver_search_block("https://search.naver.com/search.naver?query=x", "강남역 맛집 : 네이버 검색", "정상 결과 " * 100)
    # 본문 앞 500자 밖의 우연한 문구는 보지 않는다(스캐너와 같은 규칙)
    assert not is_naver_search_block("https://search.naver.com/x", "x", ("정상 " * 300) + "보안 문자")
    assert not is_naver_search_block(None, None, None)


# ── 가짜 브라우저 ─────────────────────────────────────────────────────────────
class _SPage:
    def __init__(self, state):
        self.state = state
        self.url = "https://search.naver.com/search.naver?query=x"

    async def goto(self, *a, **k):
        self.state["gotos"] += 1
        if self.state["block"]:
            self.url = "https://nid.naver.com/nidlogin.login"

    async def wait_for_timeout(self, *a):
        return None

    async def inner_text(self, sel):
        return "자동화된 요청이 감지되었습니다" if self.state["block"] else ("정상 검색 결과 " * 60)

    async def title(self):
        return "보안 확인" if self.state["block"] else "검색 : 네이버"

    async def query_selector(self, sel):
        return None

    async def close(self):
        return None


class _SCtx:
    def __init__(self, state):
        self.state = state

    async def new_page(self):
        return _SPage(self.state)

    async def add_cookies(self, *a):
        return None


class _SBrowser:
    def __init__(self, state):
        self.state = state

    async def new_context(self, **k):
        return _SCtx(self.state)

    async def close(self):
        return None


class _SPW:
    def __init__(self, state):
        self.chromium = self
        self.state = state

    async def launch(self, **k):
        self.state["launches"] += 1
        return _SBrowser(self.state)


class _SCM:
    def __init__(self, state):
        self.state = state

    async def __aenter__(self):
        return _SPW(self.state)

    async def __aexit__(self, *a):
        return False


@pytest.fixture
def env(monkeypatch):
    import playwright.async_api as pwapi

    state = {"gotos": 0, "launches": 0, "block": False}
    monkeypatch.setattr(pwapi, "async_playwright", lambda: _SCM(state))

    async def _fast(*a, **k):
        return None

    monkeypatch.setattr(asyncio, "sleep", _fast)
    return state


def _sem_value():
    from services.ai_scanner.multi_scanner import PLAYWRIGHT_SEMAPHORE
    return PLAYWRIGHT_SEMAPHORE._value


def _open_search_breaker():
    g.report_search_block("test")
    assert g.search_snapshot()["open"] is True


# ── ai_tab_trigger_check_job ──────────────────────────────────────────────────
def test_ai_tab_job_skips_during_cooldown(env):
    from scheduler import jobs
    _open_search_breaker()
    asyncio.run(jobs.ai_tab_trigger_check_job())
    assert env["launches"] == 0 and env["gotos"] == 0


def test_ai_tab_job_block_screen_stops_after_first_query_and_opens_breaker(env):
    from scheduler import jobs
    env["block"] = True
    before = _sem_value()
    asyncio.run(jobs.ai_tab_trigger_check_job())
    assert env["gotos"] == 1                                   # 나머지 3개 쿼리는 접속하지 않았다
    assert g.search_snapshot()["open"] is True
    assert _sem_value() == before                              # 차단·조기 종료에도 세마포어 반환


def test_ai_tab_job_normal_runs_all_queries_and_releases_semaphore(env):
    from scheduler import jobs
    before = _sem_value()
    asyncio.run(jobs.ai_tab_trigger_check_job())
    assert env["gotos"] == 4
    assert g.search_snapshot()["open"] is False
    assert _sem_value() == before


def test_ai_tab_job_consumes_quota_by_query_count(env):
    from scheduler import jobs
    from services.ai_scanner import naver_playwright_quota_snapshot
    used0 = naver_playwright_quota_snapshot().get("used", 0)
    asyncio.run(jobs.ai_tab_trigger_check_job())
    assert naver_playwright_quota_snapshot()["used"] - used0 == 4


# ── briefing_category_expansion_monitor_job ───────────────────────────────────
def test_monitor_job_skips_during_cooldown(env):
    from scheduler import jobs
    _open_search_breaker()
    asyncio.run(jobs.briefing_category_expansion_monitor_job())
    assert env["launches"] == 0 and env["gotos"] == 0


def test_monitor_job_block_screen_stops_everything_and_opens_breaker(env):
    from scheduler import jobs
    env["block"] = True
    before = _sem_value()
    asyncio.run(jobs.briefing_category_expansion_monitor_job())
    assert env["gotos"] == 1                                   # 8개 쿼리 중 첫 쿼리에서 중단
    assert g.search_snapshot()["open"] is True
    assert _sem_value() == before


def test_monitor_job_normal_runs_all_eight_queries(env):
    from scheduler import jobs
    before = _sem_value()
    asyncio.run(jobs.briefing_category_expansion_monitor_job())
    assert env["gotos"] == 8
    assert g.search_snapshot()["open"] is False
    assert _sem_value() == before


# ── 구조 감사: 잡이 네이버 검색·플레이스 화면을 직접 열면 회로를 확인해야 한다 ─────────────────
_ALLOWED_WITHOUT_BREAKER = {
    # 주 1회 naver.com 로그인 상태 확인 1페이지 — 검색·플레이스 화면이 아니고 쿠키 만료 감지가 목적
    "check_naver_cookie_health_job",
}


def test_scheduler_jobs_that_open_search_or_place_pages_check_a_breaker():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    src = open(os.path.join(root, "scheduler", "jobs.py"), encoding="utf-8").read()
    missing = []
    for fn in [n for n in ast.walk(ast.parse(src)) if isinstance(n, (ast.AsyncFunctionDef, ast.FunctionDef))]:
        seg = ast.get_source_segment(src, fn) or ""
        opens = "chromium.launch" in seg and any(u in seg for u in ("search.naver.com", "map.naver.com", "place.naver.com"))
        if opens and fn.name not in _ALLOWED_WITHOUT_BREAKER:
            if "begin_search_access" not in seg and "begin_place_access" not in seg:
                missing.append(f"scheduler/jobs.py:{fn.lineno} {fn.name}")
    assert not missing, missing
