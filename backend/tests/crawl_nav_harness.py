"""경쟁사 플레이스 크롤(_run_place_crawl) 탐색 순서 검증용 가짜 브라우저 (2026-10-28).

네이버에 접속하지 않는다. 가짜 페이지는 "지금 어느 경로에 있는지"를 기억하고, 홈 화면에만 있는 링크(메뉴 탭 링크·외부 웹사이트 링크)는
홈에 있을 때만 보이게 한다 — 실제 DOM과 같다. 이 성질이 있어야 "홈으로 돌아가지 않고도 같은 결과가 나오는지"를 검증할 수 있다.
"""
import asyncio

import services.competitor_place_crawler as cc

NAV = "홈\n소식\n메뉴\n리뷰\n사진\n정보\n"
LONG = "본문 줄입니다\n" * 120


def _home(extra="", nav=NAV):
    return "테스트식당\n저장\n공유\n길찾기\n전화\n" + nav + "방문자 리뷰 120\n블로그 리뷰 30\n" + extra


SCENARIOS = {
    # 메뉴 탭 링크가 홈 DOM에 있고, 소식·정보·사진·외부 링크 전부 정상
    "full": dict(
        texts={"home": _home("자주 묻는 질문\n"), "review/visitor": "리뷰128\n별점 4.5\n", "feed": LONG,
               "information": "소개\n" + "우리 가게는 오랜 전통의 맛집으로 정성껏 준비한 음식을 제공합니다 감사합니다\n", "photo": ""},
        rating=4.4, menu_link=True, ext_href="https://shop.example.com", photos=7),
    # 메뉴 탭 링크는 없지만 탐색줄에 '메뉴' → /menu 방문으로 판정
    "menu_visit": dict(
        texts={"home": _home(), "review/visitor": "리뷰128\n", "feed": "짧음", "menu": LONG,
               "information": "소개\n짧다\n", "photo": ""},
        rating=0, photos=0, imgs=9),
    # /menu 가 짧아 has_menu 가 False — 예전 코드는 같은 /menu 를 두 번 방문했다
    "menu_short": dict(
        texts={"home": _home(), "review/visitor": "별점 3.8\n리뷰5\n", "feed": LONG, "menu": "짧은 메뉴",
               "information": "", "photo": ""},
        rating=0, photos=2),
    # 소식·메뉴 탭이 없는 업종 + 홈 본문에 가격표
    "no_tabs": dict(
        texts={"home": _home("가격표 상품 3개\n", nav="홈\n리뷰\n사진\n정보\n"), "review/visitor": "리뷰9\n", "information": "", "photo": ""},
        rating=4.9, photos=3, ext_href="https://studio.example.com"),
    # 리뷰 탭 접속 실패
    "review_fail": dict(
        texts={"home": _home(), "feed": LONG, "menu": LONG, "information": "", "photo": ""},
        rating=4.0, fail_goto=("review/visitor",), photos=1),
    # 메뉴 탭 접속이 계속 실패
    "menu_fail": dict(
        texts={"home": _home(), "review/visitor": "리뷰7\n", "feed": "짧음", "information": "", "photo": ""},
        rating=4.0, fail_goto=("menu",), photos=1),
    # 홈의 메뉴 링크 확인 중 오류
    "menu_css_error": dict(
        texts={"home": _home(), "review/visitor": "리뷰7\n", "feed": "짧음", "menu": LONG, "information": "", "photo": ""},
        rating=4.0, menu_css_raises=True, photos=1),
}


class _Loc:
    def __init__(self, page, sel):
        self.page, self.sel = page, sel

    @property
    def first(self):
        return self

    async def is_visible(self, timeout=0):
        sc = self.page.sc
        if "/menu" in self.sel and "/product" in self.sel:
            if sc.get("menu_css_raises"):
                raise RuntimeError("selector error")
            return self.page.path == "home" and bool(sc.get("menu_link"))
        if self.sel.startswith("a[href^='http']"):
            return self.page.path == "home" and sc.get("ext_href") is not None
        return False

    async def get_attribute(self, name):
        return self.page.sc.get("ext_href")

    async def count(self):
        sc = self.page.sc
        if "pstatic" in self.sel:
            return sc.get("photos", 0) if self.page.path == "photo" else 0
        return sc.get("imgs", 0) if self.page.path == "photo" else 0


class _Page:
    def __init__(self, sc):
        self.sc, self.path, self.gotos = sc, None, []

    async def goto(self, url, **k):
        path = url.split("/place/")[1].split("/", 1)[1]
        self.gotos.append(path)
        if path in self.sc.get("fail_goto", ()):
            raise RuntimeError("goto failed")
        self.path = path

    async def wait_for_timeout(self, *a):
        return None

    async def inner_text(self, sel):
        return self.sc["texts"].get(self.path, "")

    async def evaluate(self, js):
        return self.sc.get("rating", 0)

    def locator(self, sel):
        return _Loc(self, sel)


class _Ctx:
    def __init__(self, holder, sc):
        self.holder, self.sc = holder, sc

    async def route(self, *a):
        return None

    async def new_page(self):
        self.holder["page"] = _Page(self.sc)
        return self.holder["page"]


class _Browser:
    def __init__(self, holder, sc):
        self.holder, self.sc = holder, sc

    async def new_context(self, **k):
        return _Ctx(self.holder, self.sc)

    async def close(self):
        return None


class _PW:
    def __init__(self, holder, sc):
        self.chromium = self
        self.holder, self.sc = holder, sc

    async def launch(self, **k):
        return _Browser(self.holder, self.sc)


class _CM:
    def __init__(self, holder, sc):
        self.holder, self.sc = holder, sc

    async def __aenter__(self):
        return _PW(self.holder, self.sc)

    async def __aexit__(self, *a):
        return False


def run_scenario(monkeypatch, name):
    """시나리오를 크롤에 통과시켜 (반환 dict, 방문 경로 순서)를 돌려준다."""
    sc = SCENARIOS[name]
    holder: dict = {}

    async def _noop(*a, **k):
        return None

    monkeypatch.setattr(cc, "async_playwright", lambda: _CM(holder, sc))
    monkeypatch.setattr(cc, "_apply_stealth", _noop)
    monkeypatch.setattr(cc, "_block_heavy_resources", _noop)
    monkeypatch.setattr(cc, "_attach_bw_counter", lambda ctx: [0])
    monkeypatch.setattr(cc, "_record_usage_mb", _noop)
    monkeypatch.setattr(cc, "_get_proxy_config", lambda scope=None: None)
    res = asyncio.run(cc._run_place_crawl("123"))
    return res, holder["page"].gotos
