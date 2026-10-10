"""카카오맵 가시성 회귀 테스트 — 2026-10-10.

라이브 실측: 준오헤어 왕십리역점이 지역의 첫 단어만 쓴 "서울 미용실" 상위 5곳에 없다는 이유로
is_on_kakao=False("카카오맵 미등록")로 기록되어 체험 결과 이메일에 그대로 나갔다.
네트워크 호출 없이 _search를 대체해 지역 처리·순위·등록 확인·오탐 방지·실패 처리를 검증한다.
"""
import asyncio
import os

os.environ.setdefault("OPENAI_API_KEY", "test-key-not-used")

import services.kakao_visibility as kv  # noqa: E402


def _run(coro):
    return asyncio.run(coro)


def _doc(name, district="성동구", road=None):
    return {
        "place_name": name,
        "road_address_name": road or f"서울 {district} 어딘가로 1",
        "address_name": f"서울 {district} 어딘가동 1",
        "category_name": "서비스,산업 > 미용 > 미용실",
        "phone": "02-000-0000",
        "place_url": "http://place.map.kakao.com/1",
    }


def _patch_search(monkeypatch, responses):
    """responses: 호출 순서대로 돌려줄 값(리스트 또는 None). 호출 기록 반환."""
    monkeypatch.setattr(kv, "_KAKAO_KEY", "test-key")
    calls = []
    queue = list(responses)

    async def fake_search(session, query, size):
        calls.append((query, size))
        return queue.pop(0)

    monkeypatch.setattr(kv, "_search", fake_search)
    return calls


# ── 지역 처리 ─────────────────────────────────────────────────────────
def test_region_query_prefix_keeps_district():
    assert kv._region_query_prefix("서울 성동구") == "서울 성동구"          # 이전: "서울"만 남았음
    assert kv._region_query_prefix("서울특별시 성동구") == "서울 성동구"
    assert kv._region_query_prefix("경상남도 창원시 의창구") == "창원시 의창구"
    assert kv._region_query_prefix("서울특별시 성동구 성수동") == "성동구 성수동"
    assert kv._region_query_prefix("서울") == "서울"
    assert kv._region_query_prefix("") == ""


def test_district_token():
    assert kv._district_token("서울 성동구") == "성동구"
    assert kv._district_token("서울 성동구 성수동") == "성동구"
    assert kv._district_token("창원시 의창구") == "의창구"
    assert kv._district_token("경기 양평군") == "양평군"
    assert kv._district_token("원주시") == "원주시"
    assert kv._district_token("서울") == ""


# ── 이름·주소 매칭 ────────────────────────────────────────────────────
def test_other_branch_of_same_brand_is_not_my_shop():
    # 같은 브랜드의 다른 지점(이름이 다름)은 내 가게가 아니다
    assert not kv._is_my_shop("준오헤어 왕십리역점", _doc("준오헤어 합정메세나폴리스점"), "성동구")


def test_same_name_in_other_district_is_not_my_shop():
    assert kv._is_my_shop("어니언 성수", _doc("어니언 성수"), "성동구")
    assert not kv._is_my_shop("어니언 성수", _doc("어니언 성수", district="마포구"), "성동구")


def test_branch_suffix_only_difference_matches():
    assert kv._is_my_shop("어니언 성수", _doc("어니언 성수점"), "성동구")


def test_similar_but_different_name_is_not_a_match():
    # "카페모모"가 전혀 다른 "카페모모카"에 걸리던 부분 문자열 매칭 오탐 방지
    assert not kv._is_my_shop("카페모모", _doc("카페모모카"), "성동구")


# ── 순위·등록 확인 흐름 ───────────────────────────────────────────────
def test_found_in_top15_rank_beyond_5_registered_without_second_call(monkeypatch):
    docs = [_doc(f"다른가게{i}") for i in range(6)] + [_doc("준오헤어 왕십리역점")] + [_doc(f"다른가게{i+10}") for i in range(8)]
    calls = _patch_search(monkeypatch, [docs])
    r = _run(kv.get_kakao_visibility("준오헤어 왕십리역점", "미용실", "서울 성동구"))
    assert r["my_rank"] == 7 and r["is_on_kakao"] is True and r["registration_checked"] is True
    assert len(r["kakao_competitors"]) == 5
    assert calls == [("서울 성동구 미용실", 15)]  # 이전: 지역은 "서울", size 5


def test_not_in_top15_but_registered_by_name_lookup(monkeypatch):
    docs = [_doc(f"다른가게{i}") for i in range(15)]
    calls = _patch_search(monkeypatch, [docs, [_doc("준오헤어 왕십리역점")]])
    r = _run(kv.get_kakao_visibility("준오헤어 왕십리역점", "미용실", "서울 성동구"))
    assert r["my_rank"] is None and r["is_on_kakao"] is True and r["registration_checked"] is True
    assert calls[1] == ("서울 성동구 준오헤어 왕십리역점", 5)


def test_not_registered_when_name_lookup_finds_nothing(monkeypatch):
    _patch_search(monkeypatch, [[_doc("다른가게")], [_doc("전혀다른가게")]])
    r = _run(kv.get_kakao_visibility("없는가게", "미용실", "서울 성동구"))
    assert r["my_rank"] is None and r["is_on_kakao"] is False and r["registration_checked"] is True


def test_search_failure_is_unknown_not_unregistered(monkeypatch):
    _patch_search(monkeypatch, [None])
    r = _run(kv.get_kakao_visibility("준오헤어 왕십리역점", "미용실", "서울 성동구"))
    assert r["is_on_kakao"] is None and r["registration_checked"] is False


def test_name_lookup_failure_is_unknown_not_unregistered(monkeypatch):
    _patch_search(monkeypatch, [[_doc("다른가게")], None])
    r = _run(kv.get_kakao_visibility("준오헤어 왕십리역점", "미용실", "서울 성동구"))
    assert r["is_on_kakao"] is None and r["registration_checked"] is False
    assert len(r["kakao_competitors"]) == 1  # 순위 조회 결과는 그대로 돌려준다


def test_missing_api_key_is_unknown(monkeypatch):
    monkeypatch.setattr(kv, "_KAKAO_KEY", "")
    r = _run(kv.get_kakao_visibility("가게", "미용실", "서울 성동구"))
    assert r["is_on_kakao"] is None and r["registration_checked"] is False
