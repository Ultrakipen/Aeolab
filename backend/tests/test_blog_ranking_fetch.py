"""
_fetch_blog_ranking() 테스트 (2026-07-18)

2026-07-18 재점검에서 발견한 두 버그의 재발 방지:
1. is_active 필터 누락 — 비활성/탈퇴 사업장의 과거 blog_score_history가
   순위·총수 계산에 계속 섞이던 버그.
2. 최신 행 dedup — business_id별 여러 날짜 기록 중 최신(analyzed_date desc
   정렬 후 처음 만난 값)만 골라야 하는 로직.

execute()는 routers.blog 모듈 레벨에서 import되므로 그 지점을 patch. supabase
객체 자체는 MagicMock()으로 대체(어떤 체이닝도 예외 없이 통과, 실제 쿼리는
execute() mock의 반환값으로만 통제).
"""
from unittest.mock import AsyncMock, MagicMock, patch

from routers.blog import _fetch_blog_ranking


def _res(data):
    r = MagicMock()
    r.data = data
    return r


async def test_inactive_business_excluded_from_ranking():
    """2026-07-18 발견 버그 재발 방지: is_active=False인 사업장은 blog_score_history에
    기록이 있어도 순위·총수 계산에서 제외돼야 함"""
    active_rows = _res([{"id": "biz-active-1"}, {"id": "biz-active-2"}])
    history_rows = _res([
        {"business_id": "biz-active-1", "citation_score": 80, "keyword_coverage": 80, "freshness": "fresh", "analyzed_date": "2026-07-18"},
        {"business_id": "biz-inactive", "citation_score": 100, "keyword_coverage": 100, "freshness": "fresh", "analyzed_date": "2026-07-18"},
        {"business_id": "biz-active-2", "citation_score": 20, "keyword_coverage": 20, "freshness": "outdated", "analyzed_date": "2026-07-18"},
    ])
    with patch("routers.blog.execute", new=AsyncMock(side_effect=[active_rows, history_rows])):
        result = await _fetch_blog_ranking("biz-active-1", supabase=MagicMock())

    assert result["total"] == 2  # biz-inactive는 active_rows에 없으므로 제외
    assert result["rank"] == 1  # biz-active-1(citation 80)이 biz-active-2(citation 20)보다 위


async def test_latest_row_per_business_used_not_earliest():
    """business_id별 여러 날짜 기록 중 analyzed_date가 가장 최신인 행만 점수 계산에 써야 함"""
    active_rows = _res([{"id": "biz-a"}, {"id": "biz-b"}])
    # desc 정렬 결과를 그대로 흉내(최신이 먼저) — biz-a는 오래전엔 낮은 점수, 최신엔 높은 점수
    history_rows = _res([
        {"business_id": "biz-a", "citation_score": 90, "keyword_coverage": 90, "freshness": "fresh", "analyzed_date": "2026-07-18"},
        {"business_id": "biz-b", "citation_score": 50, "keyword_coverage": 50, "freshness": "stale", "analyzed_date": "2026-07-18"},
        {"business_id": "biz-a", "citation_score": 10, "keyword_coverage": 10, "freshness": "outdated", "analyzed_date": "2026-07-01"},
    ])
    with patch("routers.blog.execute", new=AsyncMock(side_effect=[active_rows, history_rows])):
        result = await _fetch_blog_ranking("biz-a", supabase=MagicMock())

    # biz-a가 최신(90점) 기준으로 1위여야 함 — 과거 낮은 점수(10점)로 잘못 계산되면 실패
    assert result["rank"] == 1


async def test_business_not_in_history_returns_empty_not_none():
    """조회 자체는 성공했는데 이 사업장 기록이 아직 없으면 {}(정상 빈값), None(조회실패) 아님"""
    active_rows = _res([{"id": "biz-a"}])
    history_rows = _res([
        {"business_id": "biz-a", "citation_score": 50, "keyword_coverage": 50, "freshness": "stale", "analyzed_date": "2026-07-18"},
    ])
    with patch("routers.blog.execute", new=AsyncMock(side_effect=[active_rows, history_rows])):
        result = await _fetch_blog_ranking("biz-not-yet-analyzed", supabase=MagicMock())

    assert result == {}


async def test_percentile_badge_gated_below_min_total():
    """전체 20곳 미만이면 show_tier=False — percentile 배지 텍스트를 프론트가 노출하면 안 됨"""
    active_rows = _res([{"id": f"biz-{i}"} for i in range(5)])
    history_rows = _res([
        {"business_id": f"biz-{i}", "citation_score": 100 - i, "keyword_coverage": 50, "freshness": "fresh", "analyzed_date": "2026-07-18"}
        for i in range(5)
    ])
    with patch("routers.blog.execute", new=AsyncMock(side_effect=[active_rows, history_rows])):
        result = await _fetch_blog_ranking("biz-0", supabase=MagicMock())

    assert result["total"] == 5
    assert result["show_tier"] is False
    assert "badges" in result
