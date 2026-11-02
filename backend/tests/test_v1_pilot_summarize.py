"""V-1 파일럿 집계·판정(scripts/v1_pilot_summarize.py) 검증 (2026-11-02). 프로토콜 §5 기준을 그대로 고정한다."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts"))

import v1_pilot_summarize as s  # noqa: E402


def _row(shop, arm, mentioned, q="q1", rank=None, searches=0, error=None, domains=None):
    return {"shop": shop, "shop_name": shop, "memory_baseline": "0/50", "arm": arm, "q": q, "mentioned": mentioned, "rank": rank,
            "search_calls": searches, "error": error, "domains": domains or []}


def test_zero_in_memory_but_present_with_search_is_under_reflection():
    assert s.verdict("hara", 1, 6).startswith("과소 반영")
    assert s.verdict("hara", 0, 6).startswith("일치")


def test_present_in_memory_but_absent_with_search_is_over_reflection():
    assert s.verdict("onion", 0, 6).startswith("과대 반영")
    assert s.verdict("onion", 2, 6).startswith("일치")


def test_no_valid_samples_is_not_judged():
    assert s.verdict("hara", 0, 0).startswith("판정 불가")


def test_errors_are_excluded_from_the_rates():
    rows = [_row("hara", "search", True), _row("hara", "search", False, error="HTTP 429"), _row("hara", "search", False)]
    assert s.rate(rows) == (1, 2)


def test_summary_per_shop_and_arm():
    data = {"rows": [
        _row("hara", "search", True, rank=3, searches=5, domains=["diningcode.com", "tabling.co.kr"]),
        _row("hara", "search", False, q="q4", searches=4, domains=["diningcode.com"]),
        _row("hara", "search", False, q="q4", searches=0),
        _row("hara", "nosearch", False), _row("hara", "nosearch", False),
    ]}
    v = s.summarize(data)["hara"]
    assert v["search"] == (1, 3) and v["nosearch"] == (0, 2) and v["search_used"] == (2, 3)
    assert v["ranks"] == [3] and v["top_domains"][0] == ("diningcode.com", 2)
    assert v["by_query"] == {"q1": (1, 1), "q4": (0, 2)}
    assert v["verdict"].startswith("과소 반영")


def test_render_contains_every_shop_and_the_manual_reference():
    data = {"model": "gpt-6-luna", "calls": 2, "spent_usd": 0.1, "rows": [_row("hara", "search", True, rank=1), _row("onion", "search", False)]}
    out = s.render(data)
    assert "| hara |" in out and "| onion |" in out and "2/3" in out            # 수기 화면 참고값(하라식당 2/3)
    assert "과소 반영" in out and "과대 반영" in out


def test_render_handles_empty_input():
    assert "호출 None회" in s.render({}) or "호출" in s.render({})
