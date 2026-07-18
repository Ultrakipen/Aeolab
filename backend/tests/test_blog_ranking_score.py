"""
_compute_blog_visibility_score() 테스트 (2026-07-18)

naeo.kr 경쟁 분석 후 신설한 전체 블로그 랭킹 기능의 점수 산식. 순수 함수(외부 호출
없음)라 테스트 비용이 거의 없음. citation_score(50%) + keyword_coverage(30%,
0~100 스케일) + freshness_score(20%, fresh=80/stale=50/outdated=20 — blog.py의
기존 freshness_score 매핑과 동일 값 재사용) 가중합.
"""
from routers.blog import _compute_blog_visibility_score


def test_full_score_when_all_signals_max():
    row = {"citation_score": 100, "keyword_coverage": 100, "freshness": "fresh"}
    score = _compute_blog_visibility_score(row)
    assert score == 100 * 0.5 + 100 * 0.3 + 80 * 0.2


def test_zero_signals_still_gives_freshness_floor():
    """모든 신호가 0이어도 freshness가 outdated면 20점의 20% = 4점은 남아야 함
    (freshness_score 매핑의 최저값이 0이 아니라 20이므로)"""
    row = {"citation_score": 0, "keyword_coverage": 0, "freshness": "outdated"}
    score = _compute_blog_visibility_score(row)
    assert score == 20 * 0.2


def test_missing_fields_default_gracefully():
    """None/누락 필드가 있어도 예외 없이 0 취급돼야 함"""
    row = {"citation_score": None, "keyword_coverage": None, "freshness": None}
    score = _compute_blog_visibility_score(row)
    assert score == 20 * 0.2  # freshness 매핑 기본값(_FRESHNESS_SCORE_MAP.get(None, 20))


def test_higher_citation_score_ranks_above_higher_coverage_when_weights_differ():
    """citation_score 가중치(50%)가 keyword_coverage(30%)보다 커야 함 —
    citation 우위 사업장이 coverage 우위 사업장보다 항상 앞서야 함(교차 안 되는 값 기준)"""
    citation_heavy = {"citation_score": 80, "keyword_coverage": 0, "freshness": "outdated"}
    coverage_heavy = {"citation_score": 0, "keyword_coverage": 80, "freshness": "outdated"}
    assert _compute_blog_visibility_score(citation_heavy) > _compute_blog_visibility_score(coverage_heavy)
