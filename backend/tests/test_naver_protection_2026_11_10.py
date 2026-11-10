"""네이버 접속 보호 보강 — 함수 단위 점검에서 확인한 결함의 동작 시험 (2026-11-10).

① AI탭 스캔: 쿼터를 실제 페이지 수(3)로 세고, 일반 검색 화면이 차단·CAPTCHA면 회로에 보고하고 멈춘다
② 내 가게 통계: 최대 페이지(3)로 세고 예약하며, 모바일·리뷰 탭에서 차단이 나오면 회로를 열고 남은 접속을 멈춘다(거짓 0은 만들지 않는다)
③ 화면 캡처 4곳: 쿨다운이면 쿼터를 깎지 않고, 쿼터는 실제 페이지 수만큼, 대기 상한을 넘으면 '측정 못 함'(timeout)
④ 순위 측정: 전역 Playwright 세마포어를 거친다(호출자가 세마포어를 잡은 채 부르지 않음), 대기 초과는 timeout 행
⑤ 쿠키 점검 잡: 접속 실패·차단을 '만료'로 판정해 운영자에게 알리지 않는다, 쿨다운·쿼터·세마포어를 거친다

모든 시험은 가짜 브라우저·가짜 DB로 돈다 — 실제 네이버·Supabase에 접속하지 않는다.
"""
import ast
import asyncio
import inspect
import os
import types

import pytest

from services import naver_access_guard as g

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


@pytest.fixture(autouse=True)
def _guards():
    g.reset_for_tests()
    g.reset_search_for_tests()
    g.reset_rate_for_tests()
    yield


def _quota_used():
    from services.ai_scanner import naver_playwright_quota_snapshot
    return naver_playwright_quota_snapshot().get("used", 0)


def _open_search_breaker():
    g.report_search_block("test")
    assert g.search_snapshot()["open"] is True


# ═══════════════════════ ① AI탭 ═══════════════════════
def test_ai_tab_scan_counts_three_pages_per_query(monkeypatch):
    from services.ai_scanner import naver_ai_tab_scanner as t

    async def enabled():
        return True

    async def fake_run(q, b):
        return {"mentioned": False, "excerpt": "", "tab_available": True, "selector_matched": "x"}

    monkeypatch.setattr(t, "_get_ai_tab_enabled", enabled)
    monkeypatch.setattr(t, "_run_scan", fake_run)
    used0 = _quota_used()
    assert asyncio.run(t.scan("성수 카페", "가게")) is not None
    assert _quota_used() - used0 == 3


class _P:
    def __init__(self, url, title, text, boom=False):
        self.url, self._title, self._text, self._boom = url, title, text, boom

    async def title(self):
        if self._boom:
            raise RuntimeError("closed")
        return self._title

    async def inner_text(self, sel):
        return self._text


@pytest.mark.parametrize("url,title,text,expected", [
    ("https://search.naver.com/captcha", "보안 문자", "", True),
    ("https://search.naver.com/search.naver?query=x", "검색 : 네이버", "자동화된 요청이 감지되었습니다", True),
    ("https://search.naver.com/search.naver?query=x", "강남 맛집 : 네이버 검색", "정상 결과 " * 100, False),
    # 로그인 리다이렉트는 쿠키 만료이지 차단이 아니다 — 회로를 열면 안 된다
    ("https://nid.naver.com/nidlogin.login?x=1", "네이버 : 로그인", "", False),
])
def test_ai_tab_search_page_block_detection(url, title, text, expected):
    from services.ai_scanner import naver_ai_tab_scanner as t
    assert asyncio.run(t._search_page_blocked(_P(url, title, text))) is expected


def test_ai_tab_search_page_block_detection_never_raises():
    from services.ai_scanner import naver_ai_tab_scanner as t
    assert asyncio.run(t._search_page_blocked(_P("https://search.naver.com/x", "", "", boom=True))) is False


def test_ai_tab_checks_the_search_screen_before_clicking_into_the_tab_and_never_recovers_the_breaker():
    from services.ai_scanner import naver_ai_tab_scanner as t
    src = inspect.getsource(t._run_scan)
    assert src.index("_search_page_blocked(page)") < src.index("a[href*='tab.ait']")
    assert 'report_search_block("naver_ai_tab_scanner")' in src
    assert "report_search_ok()" not in src          # 차단 표식이 없다고 '정상 내용'은 아니다 — 회복은 엄격한 경로에서만


# ═══════════════════════ ② 내 가게 통계 ═══════════════════════
class _Loc:
    first = None

    def __init__(self):
        self.first = self

    async def is_visible(self, timeout=0):
        return False


class _SPage:
    def __init__(self, st):
        self.st, self.cur, self.frames = st, "", []

    async def goto(self, url, **k):
        self.st["urls"].append(url)
        self.cur = url

    async def wait_for_timeout(self, *_):
        return None

    async def inner_text(self, sel):
        if "m.place.naver.com" in self.cur:
            return self.st["mobile"]
        if "pcmap.place.naver.com" in self.cur:
            return self.st["pcmap"]
        return self.st["home"]

    async def content(self):
        return "<html></html>"

    def locator(self, sel):
        return _Loc()


class _SCtx:
    def __init__(self, st):
        self.st = st

    async def route(self, *a, **k):
        return None

    async def new_page(self):
        return _SPage(self.st)


class _SBrowser:
    def __init__(self, st):
        self.st = st

    async def new_context(self, **k):
        return _SCtx(self.st)

    async def close(self):
        return None


class _SChromium:
    def __init__(self, st):
        self.st = st

    async def launch(self, **k):
        return _SBrowser(self.st)


class _SPW:
    def __init__(self, st):
        self.chromium = _SChromium(st)


class _SCM:
    def __init__(self, st):
        self.st = st

    async def __aenter__(self):
        return _SPW(self.st)

    async def __aexit__(self, *a):
        return False


def _stats_env(monkeypatch, home="", mobile="", pcmap=""):
    from services import naver_place_stats as nps
    import services.ai_scanner as scanners
    import services.ai_scanner.bandwidth_tracker as bw
    st = {"urls": [], "home": home, "mobile": mobile, "pcmap": pcmap}

    async def noop(*a, **k):
        return None

    monkeypatch.setattr(nps, "async_playwright", lambda: _SCM(st))
    monkeypatch.setattr(scanners, "apply_stealth", noop)
    monkeypatch.setattr(scanners, "get_proxy_config", lambda *a, **k: None)
    monkeypatch.setattr(scanners, "get_random_ua", lambda *a, **k: "ua")
    monkeypatch.setattr(scanners, "block_heavy_resources", noop)
    monkeypatch.setattr(scanners, "attach_bandwidth_counter", lambda ctx: [0])
    monkeypatch.setattr(bw, "record_usage_mb", noop)
    return nps, st


BLOCK_TEXT = "서비스 이용이 제한되었습니다. 과도한 접근이 감지되어 잠시 후 다시 시도해 주세요."
NORMAL_NO_COUNT = "정상 플레이스 본문 가게 소개 영업시간 메뉴"


def test_place_stats_counts_and_reserves_the_maximum_three_pages(monkeypatch):
    from services import naver_place_stats as nps
    import services.ai_scanner as scanners
    seen = {}

    def fake_quota(source, cost=1):
        seen["quota"] = (source, cost)
        return True

    async def fake_reserve(cost, source="", **k):
        seen["reserve"] = cost
        return True, None, 0.0

    async def noop_pace(*a, **k):
        return None

    async def fake_run(self, pid):
        return {"naver_place_id": pid}

    monkeypatch.setattr(scanners, "check_naver_playwright_quota", fake_quota)
    monkeypatch.setattr(g, "reserve_place_pages", fake_reserve)
    monkeypatch.setattr(g, "place_pace", noop_pace)
    monkeypatch.setattr(nps.NaverPlaceStatsService, "_run", fake_run)
    asyncio.run(nps.NaverPlaceStatsService().fetch_stats("123"))
    assert seen["quota"] == ("naver_place_stats.fetch_stats", 3) and seen["reserve"] == 3


def test_place_stats_block_on_the_mobile_page_opens_the_breaker_and_skips_the_review_tab(monkeypatch):
    nps, st = _stats_env(monkeypatch, home=NORMAL_NO_COUNT, mobile=BLOCK_TEXT, pcmap="리뷰42")
    out = asyncio.run(nps.NaverPlaceStatsService()._run("123"))
    assert g.snapshot()["open"] is True                           # 차단이 회로에 보고됨
    assert not any("pcmap.place.naver.com" in u for u in st["urls"])   # 리뷰 탭에는 접속하지 않음
    assert out["visitor_review_count"] is None                    # 거짓 0·거짓 42 없음 — 못 읽은 것은 None


def test_place_stats_block_on_the_review_tab_opens_the_breaker_and_keeps_the_value_already_read(monkeypatch):
    nps, st = _stats_env(monkeypatch, home="방문자 리뷰 16 가게", mobile="", pcmap=BLOCK_TEXT)
    out = asyncio.run(nps.NaverPlaceStatsService()._run("123"))
    assert g.snapshot()["open"] is True
    assert out["visitor_review_count"] == 16                      # 이미 읽은 값은 그대로(차단 화면으로 덮어쓰지 않는다)


def test_place_stats_normal_pages_still_read_the_review_tab_without_reporting_a_block(monkeypatch):
    nps, st = _stats_env(monkeypatch, home=NORMAL_NO_COUNT, mobile=NORMAL_NO_COUNT, pcmap="리뷰42 방문자")
    out = asyncio.run(nps.NaverPlaceStatsService()._run("123"))
    assert g.snapshot()["open"] is False
    assert out["visitor_review_count"] == 42
    assert any("pcmap.place.naver.com" in u for u in st["urls"]) and any("m.place.naver.com" in u for u in st["urls"])


# ═══════════════════════ ③ 화면 캡처 ═══════════════════════
def test_screenshot_family_does_not_spend_quota_during_a_cooldown(monkeypatch):
    from services import ai_search_screenshot as ass, blog_search_analyzer as bsa, screenshot as shot
    _open_search_breaker()
    used0 = _quota_used()
    res = asyncio.run(ass.capture_naver_results("창원 맛집 추천", "가게", "biz1"))
    assert all(r["measured"] is False and r["error"] == "naver_search_cooldown" for r in res)
    assert asyncio.run(shot.capture_ai_result("naver", "창원 맛집", "biz1", "after_7d")) is None
    assert asyncio.run(shot.capture_naver_blog_screenshot("웨딩", "biz1", "창원시")) is None
    blog = asyncio.run(bsa.analyze_blog_search("창원 카페 추천", "가게", []))
    assert blog["error"] == "naver_search_cooldown"
    assert _quota_used() == used0            # 접속하지 않았으니 일일 상한을 깎지 않는다(수정 전에는 4건이 깎였다)


def test_blog_and_cafe_capture_counts_both_pages(monkeypatch):
    from services import ai_search_screenshot as ass
    import services.ai_scanner as scanners
    seen = []

    def fake_quota(source, cost=1):
        seen.append(cost)
        return False

    monkeypatch.setattr(scanners, "check_naver_playwright_quota", fake_quota)
    res = asyncio.run(ass.capture_naver_results("창원 맛집 추천", "가게", "biz1"))
    assert seen == [2]
    assert all(r["measured"] is False and r["error"] == "quota_exceeded" for r in res)


def _hold_slot_then(coro_factory, modules):
    """전역 세마포어를 잡아 둔 채, 사용자가 기다리는 요청(대기 상한 0.05초)이 timeout으로 끝나는지 본다."""
    import services.ai_scanner.multi_scanner as ms
    from services.playwright_slot import mark_interactive

    async def main():
        sem = asyncio.Semaphore(1)
        await sem.acquire()                       # 다른 작업이 브라우저를 쓰는 중
        for mod in modules:
            mod._get_playwright_sem = lambda sem=sem: sem
        old = ms.PLAYWRIGHT_QUEUE_TIMEOUT_SEC
        ms.PLAYWRIGHT_QUEUE_TIMEOUT_SEC = 0.05
        try:
            mark_interactive()
            out = await coro_factory()
        finally:
            ms.PLAYWRIGHT_QUEUE_TIMEOUT_SEC = old
        assert sem.locked()                       # 남의 슬롯을 건드리지 않았다
        sem.release()
        return out

    return asyncio.run(main())


def test_screenshot_family_returns_unmeasured_timeout_when_the_slot_wait_is_exceeded(monkeypatch):
    from services import ai_search_screenshot as ass, blog_search_analyzer as bsa, screenshot as shot
    import db.supabase_client as dbc
    monkeypatch.setattr(dbc, "get_client", lambda: object())      # 세마포어 대기 앞의 DB 클라이언트 생성은 시험 환경에 설정이 없다

    res = _hold_slot_then(lambda: ass.capture_naver_results("창원 맛집 추천", "가게", "biz1"), [ass])
    assert all(r["measured"] is False and r["error"] == "timeout" and r["is_mentioned"] is False for r in res)

    assert _hold_slot_then(lambda: shot.capture_ai_result("naver", "창원 맛집", "biz1", "after_7d"), [shot]) is None
    assert _hold_slot_then(lambda: shot.capture_naver_blog_screenshot("웨딩", "biz1", "창원시"), [shot]) is None

    blog = _hold_slot_then(lambda: bsa.analyze_blog_search("창원 카페 추천", "가게", []), [bsa])
    assert blog["error"] == "timeout" and blog["my_rank"] is None and blog["posts"] == []


def test_no_unbounded_semaphore_acquisition_remains_in_the_screenshot_family():
    sites = {"services/screenshot.py": 2, "services/ai_search_screenshot.py": 1, "services/blog_search_analyzer.py": 1, "services/naver_keyword_rank.py": 1}
    for rel, n in sites.items():
        src = open(os.path.join(ROOT, rel), encoding="utf-8").read()
        assert src.count("async with playwright_slot_optional(_get_playwright_sem()) as _got_slot:") == n, rel
        assert "async with _get_playwright_sem():" not in src, rel
        assert src.count("if not _got_slot:") == n, rel            # 모든 자리가 대기 초과를 '측정 못 함'으로 돌려준다(0점·미노출 아님)


def test_screenshot_family_never_marks_the_breaker_recovered():
    for rel in ("services/screenshot.py", "services/ai_search_screenshot.py"):
        src = open(os.path.join(ROOT, rel), encoding="utf-8").read()
        assert "report_search_ok()" not in src, rel                # 차단 표식이 없다고 정상 내용은 아니다(빈 화면 등)


# ═══════════════════════ ④ 순위 측정 ═══════════════════════
def test_rank_measurement_goes_through_the_global_slot_and_releases_it(monkeypatch):
    from services import naver_keyword_rank as kr

    async def main():
        sem = asyncio.Semaphore(1)
        monkeypatch.setattr(kr, "_get_playwright_sem", lambda: sem)
        seen = {}

        async def fake_run(keywords, biz, pid, region):
            seen["locked_during"] = sem.locked()
            return {"키워드": {"pc_rank": 1, "mobile_rank": 2, "place_rank": 3}}

        monkeypatch.setattr(kr, "_run_with_browser", fake_run)
        out = await kr.measure_keywords(["키워드"], "가게", "123", "")
        return out, seen, sem.locked()

    out, seen, locked_after = asyncio.run(main())
    assert seen["locked_during"] is True and locked_after is False
    assert out["키워드"]["pc_rank"] == 1


def test_rank_measurement_wait_timeout_is_unmeasured_not_outside_the_first_screen(monkeypatch):
    from services import naver_keyword_rank as kr
    called = []

    async def fake_run(*a, **k):
        called.append(1)
        return {}

    monkeypatch.setattr(kr, "_run_with_browser", fake_run)

    async def work():
        return await kr.measure_keywords(["가", "나"], "가게", "123", "")

    out = _hold_slot_then(work, [kr])
    assert called == []                                           # 브라우저를 열지 않았다
    for kw in ("가", "나"):
        assert out[kw]["error"] == "timeout"
        assert out[kw]["pc_rank"] is None and out[kw]["mobile_rank"] is None and out[kw]["place_rank"] is None
    assert "playwright_queue_timeout" in out["_context"]["errors"]
    from services.score_engine import calc_keyword_search_rank_score
    assert calc_keyword_search_rank_score({"keyword_ranks": {k: v for k, v in out.items() if k != "_context"}}) == (0.0, False)   # 점수는 '측정 안 됨'


def _function_sources(rel):
    src = open(os.path.join(ROOT, rel), encoding="utf-8").read()
    return {n.name: (ast.get_source_segment(src, n) or "") for n in ast.walk(ast.parse(src))
            if isinstance(n, (ast.AsyncFunctionDef, ast.FunctionDef))}


def test_callers_of_measure_keywords_never_hold_the_global_semaphore_so_the_slot_cannot_deadlock():
    holders = ("PLAYWRIGHT_SEMAPHORE", "_get_playwright_sem", "playwright_slot")
    jobs = _function_sources("scheduler/jobs.py")
    for name in ("_run_keyword_rank_for_plans", "rank_canary_job", "keyword_rank_basic_weekly_job", "keyword_rank_pro_daily_job"):
        assert not any(h in jobs[name] for h in holders), name
    scan = _function_sources("routers/scan.py")
    endpoints = [n for n, seg in scan.items() if "import measure_keywords as _measure" in seg]
    assert endpoints, "순위 측정 엔드포인트를 찾지 못했다"
    for name in endpoints:
        assert not any(h in scan[name] for h in ("PLAYWRIGHT_SEMAPHORE", "_get_playwright_sem", "async with playwright_slot")), name
        assert scan[name].index("mark_interactive()") < scan[name].index("_measure("), name   # 사용자가 기다리는 요청은 대기에 상한


def test_only_measure_keywords_opens_the_rank_browser():
    """브라우저를 여는 _run_with_browser는 measure_keywords만 부른다 — 다른 호출자가 생기면 전역 세마포어를 건너뛴다."""
    for rel in ("scheduler/jobs.py", "routers/scan.py", "routers/admin.py", "routers/report.py", "services/score_engine.py"):
        src = open(os.path.join(ROOT, rel), encoding="utf-8").read()
        assert "_run_with_browser(" not in src, rel


# ═══════════════════════ ⑤ 쿠키 점검 잡 ═══════════════════════
class _CPage:
    def __init__(self, st):
        self.st, self.url = st, "https://www.naver.com/"

    async def goto(self, url, **k):
        self.st["gotos"] += 1
        if self.st["goto_error"]:
            raise TimeoutError("net::ERR_TIMED_OUT")
        if self.st["redirect_login"]:
            self.url = "https://nid.naver.com/nidlogin.login"

    async def wait_for_timeout(self, *_):
        return None

    async def content(self):
        return self.st["html"]

    async def inner_text(self, sel):
        return self.st["text"]

    async def title(self):
        return self.st["title"]


class _CCtx:
    def __init__(self, st):
        self.st = st

    async def add_cookies(self, *a):
        return None

    async def new_page(self):
        return _CPage(self.st)


class _CBrowser:
    def __init__(self, st):
        self.st = st

    async def new_context(self, **k):
        return _CCtx(self.st)

    async def close(self):
        return None


class _CChromium:
    def __init__(self, st):
        self.st = st

    async def launch(self, **k):
        self.st["launches"] += 1
        return _CBrowser(self.st)


class _CPW:
    def __init__(self, st):
        self.chromium = _CChromium(st)


class _CCM:
    def __init__(self, st):
        self.st = st

    async def __aenter__(self):
        return _CPW(self.st)

    async def __aexit__(self, *a):
        return False


@pytest.fixture
def cookie_env(monkeypatch):
    import playwright.async_api as pwapi
    import services.email_sender as es
    st = {"gotos": 0, "launches": 0, "goto_error": False, "redirect_login": False, "title": "NAVER",
          "html": "<html>로그아웃</html>", "text": "네이버 홈 정상 화면 " * 20, "alerts": []}

    async def alert(subject, body=""):
        st["alerts"].append(subject)

    monkeypatch.setattr(pwapi, "async_playwright", lambda: _CCM(st))
    monkeypatch.setattr(es, "send_operator_alert", alert)
    monkeypatch.setenv("NAVER_COOKIE_NID_AUT", "cookie-value")
    for k in ("NAVER_COOKIE_NID_AUT_ISSUED", "NAVER_COOKIE_NID_SES", "NAVER_COOKIE_NID_SES_ISSUED", "NAVER_AUTO_RELOGIN_ENABLED"):
        monkeypatch.delenv(k, raising=False)
    return st


def _run_cookie_job():
    from scheduler import jobs
    from services.ai_scanner.multi_scanner import PLAYWRIGHT_SEMAPHORE
    before = PLAYWRIGHT_SEMAPHORE._value
    asyncio.run(jobs.check_naver_cookie_health_job())
    assert PLAYWRIGHT_SEMAPHORE._value == before        # 슬롯은 항상 반납된다


def test_cookie_job_valid_cookie_sends_no_alert(cookie_env):
    _run_cookie_job()
    assert cookie_env["launches"] == 1 and cookie_env["alerts"] == []


def test_cookie_job_really_expired_cookie_still_alerts_the_operator(cookie_env):
    cookie_env["html"] = "<html>로그인</html>"            # 정상 화면인데 '로그아웃' 링크가 없다 = 로그인되어 있지 않다
    _run_cookie_job()
    assert cookie_env["alerts"] == ["NID_AUT 만료 — 수동 교체 필요"]


def test_cookie_job_expired_by_login_redirect_is_still_detected(cookie_env):
    cookie_env["redirect_login"] = True
    cookie_env["html"] = "<html>로그인</html>"
    _run_cookie_job()
    assert cookie_env["alerts"] == ["NID_AUT 만료 — 수동 교체 필요"]
    assert g.search_snapshot()["open"] is False            # 로그인 리다이렉트는 쿠키 만료이지 차단이 아니다


def test_cookie_job_connection_failure_is_not_reported_as_expired(cookie_env):
    cookie_env["goto_error"] = True
    _run_cookie_job()
    assert cookie_env["alerts"] == []                      # 수정 전에는 '만료 — 수동 교체 필요'가 나갔다(error ≠ false)


def test_cookie_job_block_screen_is_not_reported_as_expired_and_opens_the_breaker(cookie_env):
    cookie_env["text"] = "자동화된 요청이 감지되었습니다"
    cookie_env["html"] = "<html>자동화된 요청이 감지되었습니다</html>"
    _run_cookie_job()
    assert not any("만료" in a for a in cookie_env["alerts"])      # 차단 화면을 쿠키 만료로 알리지 않는다
    assert g.search_snapshot()["open"] is True                   # 대신 차단 회로가 열리고(그 알림은 가드가 보낸다) 접속이 멈춘다


def test_cookie_job_skips_during_cooldown_and_when_quota_is_exhausted(cookie_env, monkeypatch):
    _open_search_breaker()
    _run_cookie_job()
    assert cookie_env["launches"] == 0 and cookie_env["alerts"] == []
    g.reset_search_for_tests()
    import services.ai_scanner as scanners
    monkeypatch.setattr(scanners, "check_naver_playwright_quota", lambda *a, **k: False)
    _run_cookie_job()
    assert cookie_env["launches"] == 0 and cookie_env["alerts"] == []


def test_cookie_job_is_a_batch_job_and_keeps_its_documented_exemption():
    from scheduler import jobs
    assert hasattr(jobs.check_naver_cookie_health_job, "__wrapped__")       # @naver_batch_job — 배치 몫으로 센다
    src = inspect.getsource(jobs.check_naver_cookie_health_job)
    assert "begin_search_access" in src and "playwright_slot_optional" in src and "_cookie_quota" in src
