"""구글 지도 노출 확인 회귀 테스트 — 2026-10-10. 네트워크 없이 _search를 대체해 검증한다."""
import asyncio
import os

os.environ.setdefault("OPENAI_API_KEY", "test-key-not-used")
os.environ["SERPER_API_KEY"] = "test-key"

import services.google_places_visibility as gp  # noqa: E402


def _run(coro):
    return asyncio.run(coro)


def _place(title, district="성동구", rating=4.8, count=100):
    return {"title": title, "address": f"서울특별시 {district} 어딘가로 1", "rating": rating, "ratingCount": count}


def _patch(monkeypatch, responses):
    calls = []
    queue = list(responses)

    async def fake(session, query):
        calls.append(query)
        return queue.pop(0)

    monkeypatch.setattr(gp, "_search", fake)
    return calls


def test_found_in_top10_single_call(monkeypatch):
    places = [_place(f"다른가게{i}") for i in range(4)] + [_place("준오헤어 왕십리역점", rating=4.9, count=459)]
    calls = _patch(monkeypatch, [places])
    r = _run(gp.get_google_places_visibility("준오헤어 왕십리역점", "미용실", "서울 성동구"))
    assert r["my_rank"] == 5 and r["is_on_google"] is True and r["registration_checked"] is True
    assert r["my_place"]["rating"] == 4.9 and r["my_place"]["rating_count"] == 459
    assert len(r["top"]) == 5 and calls == ["서울 성동구 미용실"]


def test_not_in_top10_found_by_name(monkeypatch):
    calls = _patch(monkeypatch, [[_place("다른가게")], [_place("어니언 성수", rating=4.5, count=3000)]])
    r = _run(gp.get_google_places_visibility("어니언 성수", "카페", "서울 성동구"))
    assert r["my_rank"] is None and r["is_on_google"] is True and r["my_place"]["rating_count"] == 3000
    assert calls[1] == "서울 성동구 어니언 성수"


def test_not_registered(monkeypatch):
    _patch(monkeypatch, [[_place("다른가게")], [_place("전혀다른가게")]])
    r = _run(gp.get_google_places_visibility("없는가게", "미용실", "서울 성동구"))
    assert r["is_on_google"] is False and r["registration_checked"] is True and r["my_place"] is None


def test_other_branch_and_other_district_do_not_match(monkeypatch):
    _patch(monkeypatch, [[_place("준오헤어 성수역점")], [_place("준오헤어 왕십리역점", district="마포구")]])
    r = _run(gp.get_google_places_visibility("준오헤어 왕십리역점", "미용실", "서울 성동구"))
    assert r["is_on_google"] is False


def test_search_failures_are_unknown(monkeypatch):
    _patch(monkeypatch, [None])
    r = _run(gp.get_google_places_visibility("가게", "미용실", "서울 성동구"))
    assert r["is_on_google"] is None and r["registration_checked"] is False
    _patch(monkeypatch, [[_place("다른가게")], None])
    r = _run(gp.get_google_places_visibility("가게", "미용실", "서울 성동구"))
    assert r["is_on_google"] is None and r["registration_checked"] is False and len(r["top"]) == 1


def test_missing_key_is_unknown(monkeypatch):
    monkeypatch.delenv("SERPER_API_KEY", raising=False)
    r = _run(gp.get_google_places_visibility("가게", "미용실", "서울 성동구"))
    assert r["is_on_google"] is None
