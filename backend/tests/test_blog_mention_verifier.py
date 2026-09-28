"""블로그 언급 수 검증 집계 회귀 테스트 (2026-09-28) — 네트워크 없이 판정 로직만 검증.

실측 근거: 네이버 블로그 API total은 따옴표를 무시해 "안민 중동" 2,336건이 실제로는 1건, 흔한 이름("본가")은
이름이 나온 글 33건 중 6건이 다른 지역이었다. 지역 판정은 광역시=구 단위, 일반 시=시 단위(+같은 시 다른 구 제외).
"""
import asyncio

from services.blog_mention_verifier import (
    RegionKey, fetch_verified_blog, name_variants, region_ok, verify_items,
)


def _n(t):  # region_ok는 정규화된 텍스트를 받는다
    import re
    return re.sub(r"[\s\-_·.,()\[\]\"']+", "", t).lower()


def test_region_key_parsing():
    k = RegionKey("경상남도 창원시 성산구 상남동")
    assert (k.city, k.gu_key, k.dong, k.metro) == ("창원", "성산", "상남", False)
    k = RegionKey("서울 강남구")
    assert (k.city, k.gu_key, k.metro) == ("서울", "강남", True)
    k = RegionKey("김해시")
    assert (k.city, k.gu_key) == ("김해", "")
    assert RegionKey("전국").empty and RegionKey("").empty
    assert RegionKey("경상남도").empty  # 광역 도 단위는 표지로 쓰지 않음(너무 넓음)


def test_general_city_requires_city_token():
    k = RegionKey("창원시 의창구")
    assert region_ok(_n("창원 봉곡동 맛집 후기"), k)
    assert not region_ok(_n("서울 맛집 후기"), k)          # 다른 지역 글
    assert not region_ok(_n("의창 어딘가 후기"), k)          # 시 이름 없이 구 이름만 — 다른 시의 같은 구일 수 있음


def test_same_city_other_gu_excluded():
    k = RegionKey("창원시 성산구 상남동")
    assert region_ok(_n("창원 성산구 상남동 맛집"), k)
    assert not region_ok(_n("창원 마산합포구 상남동 맛집"), k)  # 같은 시 다른 구의 같은 동네 이름
    assert not region_ok(_n("창원 진해 맛집"), k)
    assert region_ok(_n("창원 상남동 맛집"), k)               # 다른 구 표지가 없으면 통과


def test_metro_requires_gu_or_dong():
    k = RegionKey("서울 강남구 신사동")
    assert region_ok(_n("서울 강남구 신사동 맛집"), k)
    assert not region_ok(_n("서울 은평구 신사동 맛집"), k)      # 같은 동 이름, 다른 구 → 제외 (강남구 신사동 vs 은평구 신사동)
    assert region_ok(_n("서울 신사동 맛집 추천"), k)            # 구 이름 없이 동 이름만: 다른 구 표지가 없으면 인정
    assert not region_ok(_n("부산 신사동 맛집"), k)             # 시 이름이 다르면 제외
    k2 = RegionKey("서울 강남구")
    assert region_ok(_n("서울 강남 맛집"), k2)
    assert not region_ok(_n("서울 은평구 맛집"), k2)          # 광역시는 시 이름만으론 통과 못 함
    assert not region_ok(_n("서울 맛집 추천"), k2)


def test_no_region_means_no_constraint():
    assert region_ok(_n("아무 글"), RegionKey("전국"))
    assert region_ok(_n("아무 글"), RegionKey(""))


def test_name_variants_strip_branch_suffix():
    v = name_variants("하라식당 본점")
    assert "하라식당본점" in v and "하라식당" in v
    assert name_variants("달빛에구운고등어 창원명곡점") >= {"달빛에구운고등어"}
    assert name_variants("가") == set()  # 너무 짧으면 검증 불가


def _items(*rows):
    return [{"title": t, "description": d} for t, d in rows]


def test_verify_items_counts_only_name_and_region():
    items = _items(
        ("창원 의창구 하라식당 후기", "맛있어요"),
        ("무인민원발급기 위치 정리", "창원시 의창구 성산구 목록"),          # 이름 없음(총건수 과대집계의 원인)
        ("서울 하라식당 다녀옴", "서울 마포"),                                # 이름은 있으나 다른 지역
        ("하라식당 본점 방문기", "창원에서 먹은 점심"),
    )
    r = verify_items(items, "하라식당 본점", "창원시 의창구")
    assert r["count"] == 2 and r["name_hits"] == 3 and r["region_excluded"] == 1 and r["sampled"] == 4


def test_verify_items_keyword_filter():
    items = _items(("창원 하라식당 한식", ""), ("창원 하라식당 후기", ""))
    r = verify_items(items, "하라식당", "창원시", must_contain=["한식"])
    assert r["count"] == 1


def test_fetch_verified_blog_uses_region_query_and_flags_failure():
    seen = {}

    async def fake_get(kind, params):
        seen.update(params)
        return {"total": 2336, "items": _items(*[("창원 안민 중동 고깃집", "")] * 95, *[("무관한 글", "")] * 5)}

    r = asyncio.run(fetch_verified_blog("안민 중동", "창원시 의창구", fake_get))
    assert seen["query"].startswith("창원 의창구 ") and seen["display"] == 100 and seen["sort"] == "sim"
    assert r["count"] == 95 and r["api_total"] == 2336 and r["capped"] is True

    async def fail_get(kind, params):
        return {}

    assert asyncio.run(fetch_verified_blog("안민 중동", "창원시", fail_get)) is None  # 실패는 0이 아니라 None
