"""
routers.blog._get_cached_citation_benchmark() 테스트 (2026-07-17)

2026-07-17 세션에서 이 캐시의 범위를 잘못 넓혀(citation_benchmark 아닌 다른
라이브 데이터까지 캐싱) 스캔 직후에도 옛 인용수가 보이는 회귀를 자체 재검토로
잡은 적이 있음 — 그 회귀가 재발하지 않도록, 그리고 캐시 자체의 hit/miss/None
처리가 의도대로 동작하는지 고정.

_fetch_citation_benchmark()(실제 DB 팬아웃 쿼리) 자체는 mock으로 대체 — 이 테스트는
캐시 래퍼 로직만 검증한다.
"""
from unittest.mock import AsyncMock, patch

from routers.blog import _get_cached_citation_benchmark
from utils import cache as _cache


async def test_cache_miss_calls_fetch_and_stores():
    biz_id, category = "biz-cache-miss", "cat-cache-miss"
    _cache.delete(_cache._make_key("citation_benchmark", biz_id, category))

    with patch(
        "routers.blog._fetch_citation_benchmark",
        new=AsyncMock(return_value={"naver": "업종 평균 상회"}),
    ) as mock_fetch:
        result = await _get_cached_citation_benchmark(biz_id, category, {}, supabase=None)

    assert result == {"naver": "업종 평균 상회"}
    mock_fetch.assert_awaited_once()


async def test_cache_hit_skips_second_fetch():
    biz_id, category = "biz-cache-hit", "cat-cache-hit"
    _cache.delete(_cache._make_key("citation_benchmark", biz_id, category))

    with patch(
        "routers.blog._fetch_citation_benchmark",
        new=AsyncMock(return_value={"naver": "업종 평균 이하"}),
    ) as mock_fetch:
        first = await _get_cached_citation_benchmark(biz_id, category, {}, supabase=None)
        second = await _get_cached_citation_benchmark(biz_id, category, {}, supabase=None)

    assert first == second == {"naver": "업종 평균 이하"}
    mock_fetch.assert_awaited_once()  # 두 번째 호출은 캐시에서 나와야 함(실제 fetch 호출 1회만)


async def test_none_result_not_cached():
    """조회 자체 실패(None)는 캐시에 넣지 않아야 함 — 다음 호출이 다시 시도할 수 있게"""
    biz_id, category = "biz-cache-none", "cat-cache-none"
    _cache.delete(_cache._make_key("citation_benchmark", biz_id, category))

    with patch(
        "routers.blog._fetch_citation_benchmark",
        new=AsyncMock(return_value=None),
    ) as mock_fetch:
        first = await _get_cached_citation_benchmark(biz_id, category, {}, supabase=None)
        second = await _get_cached_citation_benchmark(biz_id, category, {}, supabase=None)

    assert first is None
    assert second is None
    assert mock_fetch.await_count == 2  # 캐싱 안 됐으므로 매번 재시도


async def test_empty_dict_result_is_cached():
    """{}(표본부족 등 정상 빈 값)는 캐시돼야 함 — None과 다른 취급"""
    biz_id, category = "biz-cache-empty", "cat-cache-empty"
    _cache.delete(_cache._make_key("citation_benchmark", biz_id, category))

    with patch(
        "routers.blog._fetch_citation_benchmark",
        new=AsyncMock(return_value={}),
    ) as mock_fetch:
        await _get_cached_citation_benchmark(biz_id, category, {}, supabase=None)
        await _get_cached_citation_benchmark(biz_id, category, {}, supabase=None)

    mock_fetch.assert_awaited_once()  # {}도 캐시돼서 두 번째는 재호출 안 함


async def test_different_category_uses_separate_cache_entry():
    """business_id는 같아도 category가 다르면 별도 캐시 키를 써야 함"""
    biz_id = "biz-cache-multi-cat"
    _cache.delete(_cache._make_key("citation_benchmark", biz_id, "cat-a"))
    _cache.delete(_cache._make_key("citation_benchmark", biz_id, "cat-b"))

    with patch(
        "routers.blog._fetch_citation_benchmark",
        new=AsyncMock(side_effect=[{"naver": "A결과"}, {"naver": "B결과"}]),
    ) as mock_fetch:
        result_a = await _get_cached_citation_benchmark(biz_id, "cat-a", {}, supabase=None)
        result_b = await _get_cached_citation_benchmark(biz_id, "cat-b", {}, supabase=None)

    assert result_a == {"naver": "A결과"}
    assert result_b == {"naver": "B결과"}
    assert mock_fetch.await_count == 2
