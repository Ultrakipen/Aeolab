"""플레이스 접속 진입점의 회로 차단기·속도 기준·차단 화면 처리 (2026-10-28 함수 단위 감사).

배경: 어젯밤 "접속 지점 보호 현황표"를 파일 단위로 세서, 같은 파일의 다른 함수가 보호돼 있다는 이유로
두 함수의 구멍이 가려졌다 — 점수 낮은 리뷰 조회(get_recent_low_rating_reviews)는 쿨다운 중에도 접속했고
(쿨다운 만료 7초 전 접속 기록), 주소 확인용 가게 상세 조회(_fetch_place_page_text)는 회로를 거치지 않았다.
"""
import ast
import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import naver_access_guard as g  # noqa: E402

BLOCK_BODY = (
    "플레이스\n서비스 이용이 제한되었습니다.\n과도한 접근 요청으로 서비스 이용이 제한되었습니다.\n"
    "잠시 후 다시 시도해주세요.\nIP: 1.2.3.4"
)
OK_BODY = "2점 매우 불만\n서비스가 너무 느리고 음식이 차가웠습니다 다시는 가지 않을 것 같아요\n" + ("정상 본문 " * 400)


# ── 가짜 브라우저 ─────────────────────────────────────────────────────────────
class _Loc:
    def __init__(self, visible=False, clicks=None):
        self.visible = visible
        self.clicks = clicks if clicks is not None else []

    @property
    def first(self):
        return self

    async def is_visible(self, timeout=0):
        return self.visible

    async def click(self):
        self.clicks.append(1)
        return None


class _Page:
    sort_visible = True      # 리뷰 탭의 "최신순" 버튼이 보이는가 (테스트가 바꿔 끼운다)
    sort_clicks: list = []

    def __init__(self, body):
        self.body = body
        self.frames = []

    def get_by_text(self, text, exact=False):
        return _Loc(_Page.sort_visible, _Page.sort_clicks) if text == "최신순" else _Loc()

    async def goto(self, *a, **k):
        return None

    async def wait_for_timeout(self, *a):
        return None

    def locator(self, sel):
        return _Loc()

    async def inner_text(self, sel):
        return self.body


class _Ctx:
    def __init__(self, body):
        self.body = body

    async def route(self, *a):
        return None

    def on(self, *a, **k):
        return None

    async def new_page(self):
        return _Page(self.body)


class _Browser:
    def __init__(self, body):
        self.body = body

    async def new_context(self, **k):
        return _Ctx(self.body)

    async def close(self):
        return None


class _PW:
    def __init__(self, body, launches):
        self.chromium = self
        self.body = body
        self.launches = launches

    async def launch(self, **k):
        self.launches.append(1)
        return _Browser(self.body)


class _CM:
    def __init__(self, body, launches):
        self.body = body
        self.launches = launches

    async def __aenter__(self):
        return _PW(self.body, self.launches)

    async def __aexit__(self, *a):
        return False


@pytest.fixture
def fake_env(monkeypatch):
    """Playwright·보조 함수를 가짜로 — 네이버에 접속하지 않는다."""
    import services.ai_scanner as ai
    import services.ai_scanner.bandwidth_tracker as bt

    async def _noop(*a, **k):
        return None

    monkeypatch.setattr(ai, "apply_stealth", _noop)
    monkeypatch.setattr(ai, "block_heavy_resources", _noop)
    monkeypatch.setattr(ai, "get_random_ua", lambda: "UA")
    monkeypatch.setattr(bt, "record_usage_mb", _noop)
    monkeypatch.setattr(g, "place_pace", _noop)          # 무작위 대기 제거(테스트 속도)
    _Page.sort_visible, _Page.sort_clicks = True, []     # 테스트 간 정렬 버튼 상태 초기화
    return {"launches": []}


def _install_playwright(monkeypatch, body, launches):
    import playwright.async_api as pwapi
    import services.naver_place_stats as ps

    monkeypatch.setattr(pwapi, "async_playwright", lambda: _CM(body, launches))
    monkeypatch.setattr(ps, "async_playwright", lambda: _CM(body, launches))


# ── get_recent_low_rating_reviews ──────────────────────────────────────────────
def test_low_rating_skips_without_any_request_during_cooldown(fake_env, monkeypatch):
    import services.naver_place_stats as ps
    from services.ai_scanner import naver_playwright_quota_snapshot

    _install_playwright(monkeypatch, OK_BODY, fake_env["launches"])
    g.report_place_block("t")                                    # 플레이스 회로 열기
    before = naver_playwright_quota_snapshot().get("used", 0)
    assert asyncio.run(ps.get_recent_low_rating_reviews("123")) == []
    assert fake_env["launches"] == []                            # 브라우저를 열지 않았다
    assert naver_playwright_quota_snapshot().get("used", 0) == before   # 쿼터도 쓰지 않았다


def test_low_rating_block_screen_opens_breaker_and_returns_empty(fake_env, monkeypatch):
    import services.naver_place_stats as ps

    _install_playwright(monkeypatch, BLOCK_BODY, fake_env["launches"])
    assert g.snapshot()["open"] is False
    assert asyncio.run(ps.get_recent_low_rating_reviews("123")) == []
    assert fake_env["launches"] == [1]
    assert g.snapshot()["open"] is True                          # 차단 화면이 회로를 열었다


# 실제 화면 구조(별점 / 숫자 / 점이 세 줄) — 2026-10-28 실측. 예전 픽스처(OK_BODY의 "2점 …")는 실제에 없는 형식이었다.
REAL_LOW_BODY = (
    "방문자 리뷰\n블로그 리뷰\n가명\n리뷰 3사진 0팔로워 0\n팔로우\n별점\n2\n점\n"
    "점심에 방문예약 없이 이용대기 시간 바로 입장나들이친구\n"
    "서비스가 너무 느리고 음식이 차가웠습니다 다시는 가지 않을 것 같아요\n더보기\n"
)


def test_low_rating_normal_page_returns_reviews_and_keeps_breaker_closed(fake_env, monkeypatch):
    import services.naver_place_stats as ps

    _install_playwright(monkeypatch, REAL_LOW_BODY, fake_env["launches"])
    out = asyncio.run(ps.check_low_rating_reviews_for("123"))
    assert out["checked"] is True and out["reason"] is None and out["markers"] == 1
    assert out["reviews"] and out["reviews"][0]["rating"] == 2
    assert out["reviews"][0]["excerpt"].startswith("서비스가 너무 느리고")
    assert g.snapshot()["open"] is False


def test_low_rating_clicks_latest_sort(fake_env, monkeypatch):
    """기본 정렬은 추천순이라(실측) 최신순을 눌러야 '최근에 달린' 리뷰를 본다."""
    import services.naver_place_stats as ps

    _Page.sort_visible, _Page.sort_clicks = True, []
    _install_playwright(monkeypatch, REAL_LOW_BODY, fake_env["launches"])
    out = asyncio.run(ps.check_low_rating_reviews_for("123"))
    assert _Page.sort_clicks == [1] and out["checked"] is True


def test_low_rating_without_latest_sort_is_not_trusted(fake_env, monkeypatch):
    """리뷰는 읽었지만 최신순을 못 눌렀다면 추천순 목록이다 — '새 낮은 별점 없음'으로 판단하면 안 되므로 확인 못 함으로 돌려준다."""
    import services.naver_place_stats as ps

    _Page.sort_visible, _Page.sort_clicks = False, []
    _install_playwright(monkeypatch, REAL_LOW_BODY, fake_env["launches"])
    out = asyncio.run(ps.check_low_rating_reviews_for("123"))
    assert out["checked"] is False and out["reason"] == "sort" and out["reviews"] == []
    # 리뷰가 아예 없는 가게(별점 표식 0건)는 정렬 버튼이 없어도 정상 — 확인은 된 것이다
    _install_playwright(monkeypatch, "방문자 리뷰\n아직 리뷰가 없어요\n", fake_env["launches"])
    empty = asyncio.run(ps.check_low_rating_reviews_for("124"))
    assert empty["checked"] is True and empty["markers"] == 0
    _Page.sort_visible = True


def test_low_rating_reports_why_it_was_not_checked(fake_env, monkeypatch):
    """"낮은 별점이 없다"와 "확인하지 못했다"를 구분한다 — 이전에는 둘 다 [] 라 잡이 건너뛴 사업장을 알 수 없었다."""
    import services.naver_place_stats as ps

    _install_playwright(monkeypatch, BLOCK_BODY, fake_env["launches"])
    blocked = asyncio.run(ps.check_low_rating_reviews_for("123"))
    assert blocked["checked"] is False and blocked["reason"] == "blocked"
    after = asyncio.run(ps.check_low_rating_reviews_for("123"))        # 회로가 열린 뒤
    assert after["checked"] is False and after["reason"] == "cooldown"
    assert fake_env["launches"] == [1]                                  # 두 번째는 브라우저를 열지 않았다
    assert asyncio.run(ps.check_low_rating_reviews_for(""))["reason"] == "no_place_id"


def test_low_rating_costs_two_pages_in_quota(fake_env, monkeypatch):
    import services.naver_place_stats as ps
    from services.ai_scanner import naver_playwright_quota_snapshot

    _install_playwright(monkeypatch, OK_BODY, fake_env["launches"])
    before = naver_playwright_quota_snapshot().get("used", 0)
    asyncio.run(ps.get_recent_low_rating_reviews("123"))
    assert naver_playwright_quota_snapshot()["used"] - before == 2


# ── naver_place_resolver._fetch_place_page_text ────────────────────────────────
def test_resolver_place_page_refused_during_cooldown(fake_env, monkeypatch):
    import services.naver_place_resolver as rv

    _install_playwright(monkeypatch, OK_BODY, fake_env["launches"])
    g.report_place_block("t")
    with pytest.raises(RuntimeError, match="naver_place_cooldown"):
        asyncio.run(rv._fetch_place_page_text("123"))
    assert fake_env["launches"] == []


def test_resolver_block_screen_is_an_error_not_an_address_mismatch(fake_env, monkeypatch):
    import services.naver_place_resolver as rv

    _install_playwright(monkeypatch, BLOCK_BODY, fake_env["launches"])
    with pytest.raises(RuntimeError, match="naver_place_blocked"):
        asyncio.run(rv._fetch_place_page_text("123"))
    assert g.snapshot()["open"] is True


def test_resolver_normal_page_returns_text(fake_env, monkeypatch):
    import services.naver_place_resolver as rv

    _install_playwright(monkeypatch, OK_BODY, fake_env["launches"])
    assert "정상 본문" in asyncio.run(rv._fetch_place_page_text("123"))
    assert g.snapshot()["open"] is False


def test_resolver_maps_blocked_place_page_to_error_status(fake_env, monkeypatch):
    """resolve_naver_place 전체 흐름: 가게 카드는 1곳 일치, 상세 조회가 차단 화면 -> status=error(확정하지 않음)."""
    import services.naver_place_resolver as rv

    async def _cards(query):
        return [{"id": "999", "text": "홍스튜디오"}]

    monkeypatch.setattr(rv, "_collect_cards", _cards)
    _install_playwright(monkeypatch, BLOCK_BODY, fake_env["launches"])
    rv._cache.clear() if hasattr(rv._cache, "clear") else None
    r = asyncio.run(rv.resolve_naver_place("홍스튜디오", "창원", "경상남도 창원시 성산구 원이대로 495"))
    assert r["status"] == "error" and r["naver_place_id"] is None


# ── 함수 단위 구조 감사 (회귀 방지) ────────────────────────────────────────────
_PLACE_MODULES = (
    "services/naver_place_stats.py",
    "services/smart_place_auto_check.py",
    "services/competitor_place_crawler.py",
    "services/naver_place_resolver.py",
)


def test_every_playwright_entry_point_checks_a_breaker():
    """세마포어를 잡고 네이버 페이지를 여는 진입 함수는 반드시 회로 차단기(플레이스 또는 검색)를 확인해야 한다.
    파일 단위가 아니라 함수 단위로 본다 — 같은 파일의 다른 함수가 보호돼 있어도 이 함수가 빠져 있을 수 있다."""
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    missing = []
    for rel in _PLACE_MODULES:
        src = open(os.path.join(root, rel), encoding="utf-8").read()
        for fn in [n for n in ast.walk(ast.parse(src)) if isinstance(n, (ast.AsyncFunctionDef, ast.FunctionDef))]:
            if fn.name == "_get_playwright_sem":
                continue
            seg = ast.get_source_segment(src, fn) or ""
            takes_sem = "_get_playwright_sem()" in seg or "PLAYWRIGHT_SEMAPHORE.acquire" in seg
            if takes_sem and "begin_place_access" not in seg and "begin_search_access" not in seg:
                missing.append(f"{rel}:{fn.lineno} {fn.name}")
    assert not missing, missing
