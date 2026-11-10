"""네이버 접속 비용(페이지 수) — 쿼터 호출·용량 모델·PLAYBOOK 수치·문서가 같은 값을 말해야 한다 (2026-11-10).

수정 전: AI탭 질의를 쿼터와 모델 모두 1건으로 셌지만 실제로는 네이버 메인 + 검색 + AI탭 = 3페이지를 열었고, 내 가게 통계도
최대 3페이지인데 2로 셌다. 쿼터와 모델이 실제 접속량보다 적게 잡으면 차단 방어선(일일 상한·배치 몫·용량 알림)이 늦게 작동한다.
"""
import importlib.util
import os
import re

from services import naver_capacity
from services import scan_scheduling as ss

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _src(*parts):
    with open(os.path.join(ROOT, *parts), encoding="utf-8") as f:
        return f.read()


def _model():
    spec = importlib.util.spec_from_file_location("naver_load_model_t", os.path.join(ROOT, "scripts", "naver_load_model.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def test_shared_constants_have_the_real_page_counts():
    assert ss.AI_TAB_PAGES_PER_QUERY == 3      # 네이버 메인 + 검색 + AI탭
    assert ss.PLACE_STATS_PAGE_COST == 3       # 홈 + 모바일 폴백(조건부) + 리뷰 탭


def test_model_uses_the_same_constants_as_the_quota_callers():
    m = _model()
    assert m.AI_TAB_PAGES_PER_QUERY == ss.AI_TAB_PAGES_PER_QUERY
    assert m.PLACE_STATS_COST == ss.PLACE_STATS_PAGE_COST


def test_quota_callers_take_their_cost_from_the_shared_constants():
    assert "cost=AI_TAB_PAGES_PER_QUERY" in _src("backend", "services", "ai_scanner", "naver_ai_tab_scanner.py")
    stats = _src("backend", "services", "naver_place_stats.py")
    assert "cost=PLACE_STATS_PAGE_COST" in stats
    assert "reserve_place_pages(PLACE_STATS_PAGE_COST" in stats


def test_model_charges_ai_tab_as_queries_times_pages():
    m = _model()
    saved = m.AI_TAB_PER_FULL
    try:
        m.AI_TAB_PER_FULL = 4
        n = 20
        comps = {}
        # 사전 스캔 재사용이면 브리핑 접속은 0 — 풀스캔 1번의 스캔 비용은 AI탭 질의×페이지뿐이다
        m.daily_loads(n, spread=True, keywords=4, competitors=3, dedupe=0.0, prescan_reuse=True, comps=comps)
        fulls = sum(1 for biz, plan in m.mix_population(n) for wd in range(7) if ss.decide_scan_mode(plan, wd, biz, True) == "full")
        assert fulls > 0
        assert comps["스캔(브리핑·AI탭)"] == fulls * 4 * ss.AI_TAB_PAGES_PER_QUERY
    finally:
        m.AI_TAB_PER_FULL = saved


def _rows(m, n):
    return {r["name"].split(" ")[0]: r for r in m.lever_report(n)}


def _pct(r):
    return f"{r['batch_peak'] / r['batch_cap'] * 100:.0f}%"


def test_playbook_effect_figures_are_the_models_figures():
    m = _model()
    r100, r300 = _rows(m, 100), _rows(m, 300)
    cap = r100["A"]["batch_cap"]
    effects = " || ".join(s["effect"] for s in naver_capacity.PLAYBOOK)
    expected = [
        f"100곳 기준 정기 잡 하루 최대 {r100['A']['batch_peak']:.0f}→{r100['B']['batch_peak']:.0f} (몫 {cap:.0f} 대비 {_pct(r100['A'])}→{_pct(r100['B'])})",
        f"300곳 기준 정기 잡 몫 대비 {_pct(r300['E'])}→{_pct(r300['H'])}",
        f"300곳 기준 {_pct(r300['B'])}→{_pct(r300['C'])}",
        f"300곳 기준 {_pct(r300['C'])}→{_pct(r300['D'])}",
    ]
    for e in expected:
        assert e in effects, f"PLAYBOOK 수치가 모델과 다르다 — {e}"


def test_capacity_doc_table_matches_the_model():
    m = _model()
    r100, r300 = _rows(m, 100), _rows(m, 300)
    doc = _src("docs", "naver_capacity_300_playbook_2026_10_29.md")

    def cell(r):
        return f"{r['batch_peak']:,.0f} ({r['batch_peak'] / r['batch_cap'] * 100:.0f}%)"

    for key in "ABCDEFGHI":
        assert f"{cell(r300[key])} | {cell(r100[key])}" in doc, f"문서 표 {key}행이 모델과 다르다"
    assert "2026-11-10 정정" in doc


def test_default_capacity_limit_matches_the_models_optimised_limit():
    """운영 기준값(NAVER_CAPACITY_BUSINESSES 기본 50)이 모델의 '최적화 후 한계'와 맞는다 — 어긋나면 알림 시점이 틀린다."""
    m = _model()
    kw = dict(spread=True, keywords=4, competitors=3, dedupe=0.0, prescan_reuse=False, comp_cache=True, comp_spread=True)
    first_over = m.first_n_over(420, "batch", **kw)
    assert first_over is not None and first_over <= naver_capacity.DEFAULT_CAPACITY_BUSINESSES, (first_over,)
