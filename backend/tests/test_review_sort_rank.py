"""지역검색 "후기 많은 순" 상위 5곳 안의 내 순위 (2026-10-28).

배경: 유사도순 상위 5곳에 없는 유명 가게가 후기 많은 순에는 있는 경우가 있다(실측: 어니언 성수 "성동구 베이커리" 2위, 홍대 육지
"마포구 음식점" 3위 — 단 하라식당은 두 검색어 모두 없음). 있을 때만 보여 주는 인기 신호이며 없다고 감점하지 않는다.
네이버 API는 가짜로 대체한다 — 네트워크에 접속하지 않는다.
"""
import asyncio
import os
import sys

os.environ.setdefault("OPENAI_API_KEY", "test-key-not-used")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import naver_visibility as nv  # noqa: E402


def _item(title):
    return {"title": f"<b>{title}</b>", "roadAddress": "서울 성동구 어딘가 1", "category": "음식점>카페", "telephone": "", "link": ""}


def _fake_get(sim_titles, comment_titles, comment_fails=False):
    async def fake(kind, params):
        if kind == "blog":
            return {"total": 0, "items": []}
        if kind == "local":
            if params.get("sort") == "comment":
                return {} if comment_fails else {"items": [_item(t) for t in comment_titles]}
            return {"items": [_item(t) for t in sim_titles]}
        return {}
    return fake


def _run(coro):
    return asyncio.run(coro)


def test_shop_in_review_sort_top5_gets_rank_even_when_not_in_similarity_top5(monkeypatch):
    monkeypatch.setattr(nv, "_get", _fake_get(["한입베이글 성수점", "도토리오븐"], ["베통 성수", "어니언 성수", "코끼리베이글 성수"]))
    r = _run(nv.get_naver_visibility("어니언 성수", "베이커리", "서울 성동구"))
    assert r["review_sort_rank"] == 2 and r["review_sort_checked"] is True
    assert r["my_rank"] is None                                   # 유사도순 결과와는 독립 — 기존 순위 판정을 바꾸지 않는다


def test_absent_from_review_sort_is_none_but_checked(monkeypatch):
    monkeypatch.setattr(nv, "_get", _fake_get(["가A"], ["나B", "다C"]))
    r = _run(nv.get_naver_visibility("하라식당 본점", "식당", "창원시 의창구"))
    assert r["review_sort_rank"] is None and r["review_sort_checked"] is True


def test_failed_lookup_is_unchecked_not_absent(monkeypatch):
    """조회 실패를 "상위 5곳에 없음"으로 오판하지 않는다."""
    monkeypatch.setattr(nv, "_get", _fake_get(["가A"], [], comment_fails=True))
    r = _run(nv.get_naver_visibility("어니언 성수", "카페", "서울 성동구"))
    assert r["review_sort_rank"] is None and r["review_sort_checked"] is False


def test_similar_name_with_prefix_is_not_my_shop(monkeypatch):
    """기존 이름 대조 규칙(접두어가 있으면 다른 가게) 그대로 — "더어니언 성수"는 "어니언 성수"가 아니다."""
    monkeypatch.setattr(nv, "_get", _fake_get([], ["더어니언 성수", "어니언 성수점"]))
    r = _run(nv.get_naver_visibility("어니언 성수", "카페", "서울 성동구"))
    assert r["review_sort_rank"] == 2                              # 접두어 있는 1위는 건너뛰고 지점 표기만 다른 2위가 내 가게


def test_multi_keyword_uses_best_rank_with_its_query(monkeypatch):
    calls = []

    async def fake(kind, params):
        if kind == "blog":
            return {"total": 0, "items": []}
        if kind == "local" and params.get("sort") == "comment":
            calls.append(params["query"])
            titles = ["가", "나", "다", "라", "어니언 성수"] if "카페" in params["query"] else ["가", "어니언 성수"]
            return {"items": [_item(t) for t in titles]}
        return {"items": []}

    real_sleep = asyncio.sleep          # nv.asyncio 는 전역 asyncio 와 같은 객체 — 원본을 먼저 잡아야 재귀하지 않는다

    async def no_sleep(s):
        await real_sleep(0)

    monkeypatch.setattr(nv, "_get", fake)
    monkeypatch.setattr(nv.asyncio, "sleep", no_sleep)
    r = _run(nv.get_naver_visibility_multi("어니언 성수", ["카페", "베이커리"], "서울 성동구"))
    assert len(calls) == 2
    assert r["review_sort_rank"] == 2 and "베이커리" in r["review_sort_query"]
    assert r["review_sort_checked"] is True
