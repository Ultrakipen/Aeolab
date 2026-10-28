"""경쟁사 플레이스 크롤의 불필요한 페이지 이동 제거 (2026-10-28).

예전 _run_place_crawl 은 탭을 하나 열 때마다 홈으로 돌아와(최대 5회) 같은 홈을 다시 읽었고, 메뉴 탭을 같은 조건에서 두 번 방문했다.
네이버 접속의 가장 큰 소비처(경쟁사 크롤)라서 정보를 잃지 않는 범위에서 줄였다.

기준값(fixtures/crawl_nav_golden_old_code.json)은 **수정 전 코드**를 같은 가짜 브라우저(crawl_nav_harness.py)에 통과시켜 찍은 반환값이다.
수정 후 코드가 같은 반환값을 내면서 홈 재방문·메뉴 중복 방문이 없는지 확인한다. 네이버에는 접속하지 않는다.
"""
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import crawl_nav_harness as h  # noqa: E402

GOLDEN = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "crawl_nav_golden_old_code.json"),
                        encoding="utf-8"))


@pytest.mark.parametrize("name", sorted(h.SCENARIOS))
def test_result_is_identical_to_old_navigation(monkeypatch, name):
    res, _ = h.run_scenario(monkeypatch, name)
    assert res == GOLDEN[name]["result"]


@pytest.mark.parametrize("name", sorted(h.SCENARIOS))
def test_home_is_loaded_once(monkeypatch, name):
    _, gotos = h.run_scenario(monkeypatch, name)
    assert gotos.count("home") == 1, gotos
    assert gotos[0] == "home"


@pytest.mark.parametrize("name", sorted(h.SCENARIOS))
def test_no_tab_is_visited_twice(monkeypatch, name):
    _, gotos = h.run_scenario(monkeypatch, name)
    assert len(gotos) == len(set(gotos)), gotos


@pytest.mark.parametrize("name", sorted(h.SCENARIOS))
def test_page_loads_never_exceed_quota_cost(monkeypatch, name):
    """quota/속도 기준에 넘기는 cost(COMPETITOR_PAGE_COST)는 실제 이동 횟수의 상한이어야 한다."""
    from services.scan_scheduling import COMPETITOR_PAGE_COST
    _, gotos = h.run_scenario(monkeypatch, name)
    assert len(gotos) <= COMPETITOR_PAGE_COST, gotos


def test_total_page_loads_are_substantially_fewer(monkeypatch):
    new = sum(len(h.run_scenario(monkeypatch, n)[1]) for n in h.SCENARIOS)
    old = sum(GOLDEN[n]["old_goto_count"] for n in h.SCENARIOS)
    assert new <= old * 0.65, (new, old)


def test_cost_constants_match_between_crawler_and_scheduler():
    """fetch_competitor_place_data 가 쿼터·속도 기준에 넘기는 값과 스케줄러의 예산 계산 값이 같아야 한다."""
    import re
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    src = open(os.path.join(root, "services", "competitor_place_crawler.py"), encoding="utf-8").read()
    from services.scan_scheduling import COMPETITOR_PAGE_COST
    costs = re.findall(r"cost=(\d+)\)", src.split("async def _run_place_crawl")[0])
    pages = re.findall(r"reserve_place_pages\((\d+),", src.split("async def _run_place_crawl")[0])
    assert costs == [str(COMPETITOR_PAGE_COST)] and pages == [str(COMPETITOR_PAGE_COST)], (costs, pages)
