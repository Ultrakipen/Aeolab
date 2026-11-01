"""네이버 표시명 대조(_name_matches) 회귀 테스트 — 2026-11-01.

실제 가게가 네이버에 있는데 '없음'으로 판정되는 허위 미노출을 막는다.
실사례: 등록명 '법무법인 리얼로펌 본사' ↔ 네이버 '법무법인 리얼 로펌 개인회생파산 창원분사무소'(공식 지역검색 API 응답)가 달라
is_smart_place=False로 나왔다. 반대 방향(다른 가게를 내 가게로 세는 것)도 같은 테스트에서 함께 막는다.
"""
import pytest

from services.naver_visibility import _name_matches as nm


@pytest.mark.parametrize("registered,naver", [
    ("법무법인 리얼로펌 본사", "법무법인 리얼 로펌 개인회생파산 창원분사무소"),   # 실제 API 응답
    ("법무법인 리얼로펌 본사", "법무법인 리얼 로펌 개인회생파산 부산본점"),         # 실제 API 응답
    ("하라식당 본점", "하라식당"),
    ("(주)대호흑돼지", "대호흑돼지"),
    ("㈜대호흑돼지", "대호흑돼지 상남점"),
    ("주식회사 어니언 성수", "어니언 성수"),
    ("어니언 성수", "어니언 성수점"),            # 기존 동작 유지
    ("홍스튜디오", "홍스튜디오 창원점"),          # 기존 동작 유지
    ("카페 모모", "카페모모"),                    # 공백 차이
])
def test_same_shop_is_recognized(registered, naver):
    assert nm(registered, naver) is True


@pytest.mark.parametrize("registered,naver", [
    ("홍스튜디오", "더홍스튜디오"),                    # 접두어가 붙은 다른 가게
    ("하라식당 본점", "하라식당 마산점"),               # 본점 표기를 뗐다고 다른 위치 지점을 내 가게로 세면 안 된다
    ("스타벅스 강남역점", "스타벅스 역삼점"),            # 위치 지점명은 떼지 않는다
    ("스타벅스 강남역점", "스타벅스"),                  # 위치 지점이 붙은 등록명은 일반 표기가 아니다
    ("본점", "식당"),                                  # 핵심 이름이 비면 대조하지 않는다
    ("A본점", "AB마트"),                              # 핵심 이름이 너무 짧으면(3글자 미만) 대조하지 않는다
])
def test_different_shop_is_not_matched(registered, naver):
    assert nm(registered, naver) is False


def test_empty_inputs():
    assert nm("", "x") is False and nm("x", "") is False and nm("", "") is False


def test_search_names_include_core_name_without_generic_markers():
    from services.naver_visibility import _search_names
    assert _search_names("법무법인 리얼로펌 본사") == ["법무법인 리얼로펌 본사", "법무법인 리얼로펌"]
    assert _search_names("(주)대호흑돼지") == ["(주)대호흑돼지", "대호흑돼지"]
    assert _search_names("하라식당 본점") == ["하라식당 본점", "하라식당"]
    assert _search_names("홍스튜디오") == ["홍스튜디오"]          # 뗄 표기가 없으면 그대로 하나
    assert _search_names("본점") == ["본점"]                      # 핵심 이름이 3글자 미만이면 추가 검색하지 않는다
    assert _search_names("스타벅스 강남역점") == ["스타벅스 강남역점"]   # 위치 지점명은 떼지 않는다
    assert _search_names("") == []


def test_registration_check_retries_with_core_name_when_marker_name_returns_nothing(monkeypatch):
    """실사례: '법무법인 리얼로펌 본사'로 검색하면 네이버가 [] 를 돌려줘 등록 여부가 False였다 — 핵심 이름 재검색으로 찾아야 한다."""
    import asyncio
    from services import naver_visibility as nv

    async def fake_get(kind, params):
        q = params.get("query", "")
        if kind == "local":
            if "리얼로펌" not in q or "본사" in q:   # 업종 키워드 검색과 '본사'가 든 이름 검색은 결과가 없다(실측)
                return {"items": []}
            return {"items": [{"title": "법무법인 리얼 로펌 개인회생파산 창원분사무소", "address": "경상남도 창원시 성산구", "roadAddress": "", "link": "", "category": "법무", "telephone": ""}]}
        return {"items": [], "total": 0}

    monkeypatch.setattr(nv, "_get", fake_get)
    res = asyncio.run(nv.get_naver_visibility("법무법인 리얼로펌 본사", "개인회생", "경상남도 창원시 성산구"))
    assert res["is_smart_place"] is True
