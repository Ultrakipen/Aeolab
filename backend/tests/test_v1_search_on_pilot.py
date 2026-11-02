"""V-1 파일럿 스크립트(scripts/v1_search_on_pilot.py)의 순수 함수 검증 (2026-11-02).

- 응답 파서는 **실제 OpenAI Responses API 응답**(tests/fixtures/openai_responses_web_search_real.json, 2026-11-02 스모크 실측)으로 검증한다
  — 지어낸 형식이 결함을 가리지 않게(지침 10).
- 노출·순위 판정은 수기 ChatGPT 결과에서 본 실제 목록 형식(번호·글머리·굵게·링크)으로 검증한다.
- 파일럿이 측정 편향을 만들지 않게 하는 불변식: 질문에 가게 이름이 들어가지 않는다 / 비검색 암에는 도구가 없다 / 비용 상한이 실제 사용량 기반이다.
"""
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts"))

import v1_search_on_pilot as p  # noqa: E402

_FIX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "openai_responses_web_search_real.json")


def _fixture(arm):
    data = json.load(open(_FIX, encoding="utf-8"))
    return next(x for x in data if x["arm"] == arm)


# ── 실제 응답 파싱 ───────────────────────────────────────────────────────────────
def test_real_search_response_is_parsed():
    r = p.parse_response(_fixture("search")["response"])
    assert "카쿠레가" in r["answer"] and len(r["answer"]) > 200
    assert r["search_calls"] == 5                                    # tool_usage.web_search.num_requests = web_search_call 항목 수
    assert (r["tokens_in"], r["tokens_out"]) == (45354, 695)
    assert [c["url"].split("/")[2] for c in r["citations"]] == ["press.changwon.ac.kr", "www.diningcode.com", "www.tabling.co.kr"]
    assert r["search_queries"][0] == "창원 일본가정식 맛집" and len(r["search_queries"]) >= 3
    assert p.citation_domains(r["citations"]) == ["press.changwon.ac.kr", "diningcode.com", "tabling.co.kr"]      # www. 제거


def test_real_nosearch_response_has_no_search_and_cheap_cost():
    r = p.parse_response(_fixture("nosearch")["response"])
    assert r["search_calls"] == 0 and r["citations"] == [] and "토끼정" in r["answer"]
    assert p.cost_usd(r["tokens_in"], r["tokens_out"], r["search_calls"]) < 0.001


def test_real_search_cost_matches_the_observed_charge():
    r = p.parse_response(_fixture("search")["response"])
    assert p.cost_usd(r["tokens_in"], r["tokens_out"], r["search_calls"]) == pytest.approx(0.0549, abs=0.0005)     # 스모크에서 기록된 $0.05488


def test_parse_tolerates_odd_responses():
    assert p.parse_response({})["answer"] == ""
    assert p.parse_response({"output": [{"type": "message", "content": [{"type": "refusal"}]}]})["answer"] == ""
    r = p.parse_response({"output": [{"type": "web_search_call"}], "usage": {}})
    assert r["search_calls"] == 1 and r["tokens_in"] == 0                # tool_usage가 없으면 항목 수로 센다


# ── 노출·순위 판정 ───────────────────────────────────────────────────────────────
def test_real_answers_do_not_mention_hara():
    keys = next(s for s in p.SHOPS if s["id"] == "hara")["keys"]
    assert p.find_shop(p.parse_response(_fixture("search")["response"])["answer"], keys)["mentioned"] is False
    assert p.find_shop(p.parse_response(_fixture("nosearch")["response"])["answer"], keys)["mentioned"] is False


def test_rank_from_a_bulleted_bold_list():
    a = "- **카쿠레가** — 덮밥\n- **하라식당** — 상남동 2층 ([diningcode.com](https://x))\n- **모루식당** — 카레"
    assert p.find_shop(a, ["하라식당"]) == {"mentioned": True, "rank": 2, "n_items": 3}


def test_rank_from_a_numbered_list_with_heading_markers():
    a = "창원 추천 5곳\n1. 쇼쿠도\n2) 테이쇼쿠차차\n### 3. **하라 식당** 본점\n4. 청춘밥상"
    r = p.find_shop(a, ["하라식당"])
    assert r["mentioned"] is True and r["rank"] == 3                     # 공백이 달라도(하라 식당) 같은 가게로 본다


def test_mentioned_only_in_prose_has_no_rank():
    a = "쇼쿠도, 테이쇼쿠차차, **하라식당**을 우선 추천해요."
    assert p.find_shop(a, ["하라식당"]) == {"mentioned": True, "rank": None, "n_items": 0}


def test_absent_shop():
    assert p.find_shop("- 쇼쿠도\n- 코엔지", ["하라식당"]) == {"mentioned": False, "rank": None, "n_items": 2}
    assert p.find_shop("", ["하라식당"]) == {"mentioned": False, "rank": None, "n_items": 0}


def test_similar_names_do_not_false_match():
    assert p.find_shop("- 하라 스시", ["하라식당"])["mentioned"] is False
    # 너무 짧은 키('대호')를 쓰면 다른 가게 이름과 오탐이 난다 — 직접 넘긴 키가 아니라 실제 SHOPS 설정으로 검증한다
    daeho = next(s for s in p.SHOPS if s["id"] == "daeho")["keys"]
    assert p.find_shop("- 대호식당 (동태탕)\n- 대호갈비", daeho)["mentioned"] is False
    assert p.find_shop("- 대호 흑돼지 상남점", daeho)["mentioned"] is True


def test_every_shop_key_is_specific_enough():
    """키가 너무 짧으면(공백 제거 후 3자 미만) 다른 가게 이름에 우연히 들어가 노출로 오판한다."""
    for s in p.SHOPS:
        assert all(len(p.norm(k)) >= 3 for k in s["keys"]), s["id"]


def test_citation_domains_strip_www_and_lowercase():
    cites = [{"url": "https://WWW.DiningCode.com/x"}, {"url": "https://www.tabling.co.kr/y"}, {"url": "ftp://bad"}, {"url": ""}]
    assert p.citation_domains(cites) == ["diningcode.com", "tabling.co.kr"]


def test_link_text_not_url_is_matched():
    assert p.norm("[하라식당](https://example.com/하라식당)") == p.norm("하라식당")


# ── 불변식: 측정 편향 방지 ───────────────────────────────────────────────────────
def test_questions_never_contain_the_shop_name():
    for s in p.SHOPS:
        for q in (s["q1"], s["q4"]):
            assert not any(p.norm(k) in p.norm(q) for k in s["keys"]), (s["id"], q)


def test_questions_match_the_protocol_and_scan_wording():
    onion = next(s for s in p.SHOPS if s["id"] == "onion")
    assert onion["q1"] == "서울 성동구 성수동 성수 카페 추천"
    assert onion["q4"] == "서울 성동구 성수동에서 성수 카페 잘하는 곳 추천해줘"
    assert len(p.SHOPS) == 5 and {s["id"] for s in p.SHOPS} == {"onion", "hara", "daeho", "healing", "hong"}


def test_search_arm_has_the_tool_and_location_and_nosearch_has_none():
    shop = next(s for s in p.SHOPS if s["id"] == "hara")
    on = p.build_request("gpt-6-luna", shop["q1"], True, shop)
    off = p.build_request("gpt-6-luna", shop["q1"], False, shop)
    assert on["tools"][0]["type"] == "web_search" and on["tools"][0]["user_location"]["country"] == "KR"
    assert on["tools"][0]["user_location"]["city"] == "Changwon"
    assert "tools" not in off
    assert on["input"] == off["input"] and on["reasoning"] == off["reasoning"] == {"effort": "none"}      # 두 암의 차이는 검색 도구뿐


def test_plan_counts_and_upper_bound():
    jobs = p.plan_jobs([], ["q1", "q4"], 3, ["search", "nosearch"])
    assert len(jobs) == 60 and sum(1 for j in jobs if j["arm"] == "search") == 30
    assert 1.5 < p.estimate_upper_bound(jobs) < 3.0                         # 기본 계획의 사전 상한이 실행 상한($3) 안에 든다
    assert p.plan_jobs(["hara"], ["q1"], 2, ["search"]) == [
        {"shop": "hara", "q": "q1", "arm": "search", "rep": 1, "question": "창원 일본가정식 추천"},
        {"shop": "hara", "q": "q1", "arm": "search", "rep": 2, "question": "창원 일본가정식 추천"},
    ]


def test_upper_bound_is_not_below_the_observed_cost():
    one = p.plan_jobs(["hara"], ["q1"], 1, ["search"])
    assert p.estimate_upper_bound(one) >= 0.0549
