"""
_build_competitor_comparison() 회귀 테스트 (2026-07-17)

2026-07-17 세션에서 경쟁사 실시간 구조비교(§2-B) 관련 죽은 분기를 제거하며
comp_blog_kw_map 채우는 루프의 "동일 이름이면 먼저 본 값 유지" 가드가 한 번
실수로 함께 빠졌던 걸 원본과 재대조해 발견·복원함. 순수 함수(외부 호출 없음)라
테스트 비용이 거의 없어 이 회귀가 재발하지 않도록 고정.
"""
from services.blog_analyzer import _build_competitor_comparison


def test_returns_none_when_no_competitor_data():
    result = _build_competitor_comparison(
        my_covered_keywords=["웨딩스냅"],
        competitor_comp_keywords=[],
    )
    assert result is None

    result = _build_competitor_comparison(
        my_covered_keywords=["웨딩스냅"],
        competitor_comp_keywords=None,
    )
    assert result is None


def test_keyword_gap_detection():
    """경쟁사에는 있고 내 블로그엔 없는 키워드만 gap으로 나와야 함"""
    result = _build_competitor_comparison(
        my_covered_keywords=["웨딩스냅"],
        competitor_comp_keywords=[
            {"name": "라포뮤직", "comp_keywords": ["웨딩스냅", "돌잔치 스냅"]},
        ],
    )
    assert result is not None
    assert "돌잔치 스냅" in result["competitor_keyword_gaps"]
    assert "웨딩스냅" not in result["competitor_keyword_gaps"]  # 내가 이미 커버


def test_covered_by_attribution():
    """각 gap 키워드가 어느 경쟁사한테서 왔는지 정확히 매핑돼야 함"""
    result = _build_competitor_comparison(
        my_covered_keywords=[],
        competitor_comp_keywords=[
            {"name": "A업체", "comp_keywords": ["돌잔치 스냅"]},
            {"name": "B업체", "comp_keywords": ["프로필 촬영"]},
        ],
    )
    detail_by_kw = {d["keyword"]: d["covered_by"] for d in result["competitor_keyword_detail"]}
    assert detail_by_kw["돌잔치 스냅"] == ["A업체"]
    assert detail_by_kw["프로필 촬영"] == ["B업체"]


def test_duplicate_competitor_name_keeps_first_seen():
    """동일 이름의 경쟁사 행이 2개면 먼저 본 키워드셋을 유지해야 함(덮어쓰기 금지) —
    2026-07-17 정리 중 유실됐다 복원된 가드에 대한 회귀 방지 테스트.
    """
    result = _build_competitor_comparison(
        my_covered_keywords=[],
        competitor_comp_keywords=[
            {"name": "같은이름", "comp_keywords": ["첫번째키워드"]},
            {"name": "같은이름", "comp_keywords": ["두번째키워드"]},
        ],
    )
    detail_by_kw = {d["keyword"]: d["covered_by"] for d in result["competitor_keyword_detail"]}
    # 두 키워드 모두 gap 목록엔 있어야 함(union 집계는 가드 영향 없음)
    assert "첫번째키워드" in detail_by_kw
    assert "두번째키워드" in detail_by_kw
    # 하지만 covered_by 귀속은 "먼저 본" 첫번째키워드 쪽 매핑만 comp_blog_kw_map에 남아있어야 함
    assert detail_by_kw["첫번째키워드"] == ["같은이름"]
    # 두번째 항목의 키워드는 comp_blog_kw_map에 반영 안 됐으므로 어떤 매칭도 없어야 함(부분일치 규칙상)
    assert detail_by_kw["두번째키워드"] == []


def test_gap_list_capped_at_ten():
    many_keywords = [f"키워드{i}" for i in range(15)]
    result = _build_competitor_comparison(
        my_covered_keywords=[],
        competitor_comp_keywords=[{"name": "경쟁사", "comp_keywords": many_keywords}],
    )
    assert len(result["competitor_keyword_gaps"]) == 10
