"""플레이스 목록 섀도 기록(2026-11-07 단계 2) — 추가 필드로만 쌓이고 측정 결과·점수·네이버 접속량을 바꾸지 않는다.

가짜 Playwright 페이지로 실제 `NaverAIBriefingScanner._check_single_page`를 끝까지 돌린다(네이버 접속·가드 파일 쓰기 없음).
"""
import asyncio
import inspect
from pathlib import Path

import pytest

import services.ai_scanner.naver_scanner as ns
from services.ai_scanner import place_list_parser as plp

HTML = (Path(__file__).resolve().parent / "fixtures" / "naver_place_list_2026_11_07.html").read_text(encoding="utf-8")
BODY = "창원 일본가정식 추천 검색 결과\n카쿠레가 창원어반브릭스점\n삼대초밥\n부자스시앤사케\n쇼쿠도\n코미치\n우동센세\n#하라식당창원본점 후기"


class FakePage:
    url = "https://search.naver.com/search.naver?query=x"

    def __init__(self, html=HTML, boom=False, not_str=False):
        self.html, self.boom, self.not_str = html, boom, not_str
        self.goto_calls = 0
        self.evaluate_calls = []

    async def goto(self, *a, **k):
        self.goto_calls += 1

    async def wait_for_timeout(self, ms):
        return None

    async def inner_text(self, sel):
        return BODY

    async def title(self):
        return "창원 일본가정식 추천 : 네이버 검색"

    async def query_selector(self, sel):
        return None

    async def query_selector_all(self, sel):
        return []

    async def evaluate(self, script, *a):
        self.evaluate_calls.append(script)
        if script == plp.PLACE_LIST_HTML_JS:
            if self.boom:
                raise RuntimeError("evaluate failed")
            return 123 if self.not_str else self.html
        if "heads" in script:
            return {"head": False}
        return None


@pytest.fixture(autouse=True)
def _no_side_effects(monkeypatch):
    import services.naver_access_guard as guard
    monkeypatch.setattr(ns, "note_naver_auth_result", lambda *a, **k: None)
    monkeypatch.setattr(ns, "note_proxy_result", lambda *a, **k: None)
    monkeypatch.setattr(guard, "report_search_ok", lambda: None)


def _scan(page, target):
    return asyncio.run(ns.NaverAIBriefingScanner()._check_single_page(page, "창원 일본가정식 추천", target))


def _core(r):
    return {k: v for k, v in r.items() if not k.startswith("place_list_")}


def test_shadow_fields_are_recorded_with_structure_based_rank():
    r = _scan(FakePage(), "삼대초밥")
    assert r["place_list_found"] is True and r["place_list_rank"] == 2
    assert r["place_list_names"][:3] == ["카쿠레가 창원어반브릭스점", "삼대초밥", "부자스시앤사케"]
    # 기존 경로는 그대로: 셀렉터 0개라 rank는 None, mentioned는 전체 텍스트 폴백
    assert r["rank"] is None and r["mentioned"] is True


def test_registered_name_with_branch_word_is_found_in_list_but_old_path_still_misses_it():
    r = _scan(FakePage(), "쇼쿠도 본점")
    assert r["place_list_rank"] == 4
    assert r["mentioned"] is False        # 기존 판정은 바뀌지 않는다(비교 대상)


def test_target_not_in_list_is_found_true_rank_none():
    r = _scan(FakePage(), "하라식당 본점")
    assert r["place_list_found"] is True and r["place_list_rank"] is None
    assert r["mentioned"] is False and r["in_briefing"] is False


def test_core_result_is_identical_with_or_without_shadow():
    with_shadow = _core(_scan(FakePage(), "하라식당 본점"))
    broken_shadow = _core(_scan(FakePage(boom=True), "하라식당 본점"))
    assert with_shadow == broken_shadow


@pytest.mark.parametrize("kw", [dict(boom=True), dict(not_str=True), dict(html=""), dict(html="<div>차단 안내</div>")])
def test_shadow_failure_never_breaks_the_scan_and_is_not_reported_as_absent(kw):
    r = _scan(FakePage(**kw), "삼대초밥")
    assert "error" not in r and r["mentioned"] is True
    assert r["place_list_rank"] is None and r["place_list_names"] == []
    assert r["place_list_found"] in (None, False)          # 못 읽음 — '목록 밖'(True+None)과 구분된다


def test_no_extra_network_request_only_dom_read():
    p = FakePage()
    _scan(p, "삼대초밥")
    assert p.goto_calls == 1
    assert p.evaluate_calls.count(plp.PLACE_LIST_HTML_JS) == 1


def test_shadow_does_not_feed_score():
    from services import score_engine
    base = {"platform": "naver", "mentioned": True, "in_briefing": False, "rank": None}
    shadowed = {**base, "place_list_found": True, "place_list_rank": 1, "place_list_names": ["a"]}
    assert score_engine.calc_naver_exposure({"naver_result": base}) == score_engine.calc_naver_exposure({"naver_result": shadowed})
    src = Path(score_engine.__file__).read_text(encoding="utf-8")
    assert "place_list_" not in src


def test_scanner_wiring_order_and_import():
    src = inspect.getsource(ns.NaverAIBriefingScanner._check_single_page)
    assert src.index("_name_in_text(target, page_text)") < src.index("shadow_place_list(page, target)")
    assert "**shadow" in src and "shadow: dict = {}" in src
    assert "from services.ai_scanner.place_list_parser import shadow_place_list" in inspect.getsource(ns)
