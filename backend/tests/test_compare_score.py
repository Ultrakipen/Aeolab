"""내 가게 비교용 점수(같은 공식) 테스트 — 2026-10-30."""
import os

os.environ.setdefault("GEMINI_API_KEY", "test-key-not-used")
os.environ.setdefault("OPENAI_API_KEY", "test-key-not-used")

from services import compare_score as cs  # noqa: E402
from services.competitor_place_crawler import compute_competitor_score  # noqa: E402


def _scan(count=0, n=100, probe="recommend_v1", src="gemini", website=None):
    res = {"probe": probe, "sample_size": n, "exposure_freq": count}
    return {"gemini_result": res if src == "gemini" else None, "chatgpt_result": res if src == "chatgpt" else None,
            "website_check_result": website}


BIZ = {"review_count": 45, "avg_rating": 4.4, "has_intro": True, "has_recent_post": False, "blog_mention_count": 4,
       "naver_place_id": "123", "naver_intro_draft": ""}
SP = {"has_menu": True}


def test_same_formula_as_competitor_for_identical_inputs():
    """내 가게와 입력이 같은 경쟁사는 같은 점수를 받는다 — 비교가 같은 공식이라는 증명."""
    comp_row = {"detail_synced_at": "x", "naver_review_count": 45, "naver_avg_rating": 4.4, "has_intro": True,
                "has_menu": True, "has_recent_post": False, "blog_mention_count": 4, "website_seo_score": None}
    expected, _ = compute_competitor_score(comp_row, True, 3 / 100 * 10, "")
    got = cs.my_compare_score(BIZ, _scan(count=3), SP)
    assert got and got["score"] == round(expected, 1) and got["basis"] == "same_formula_v1"
    assert got["ai_count"] == 3 and got["ai_sample_size"] == 100 and got["ai_source"] == "gemini"


def test_zero_ai_mentions_is_a_measured_zero_not_a_failure():
    got = cs.my_compare_score(BIZ, _scan(count=0), SP)
    assert got is not None and got["ai_count"] == 0     # 표본이 있으면 0회는 실측 값


def test_no_usable_ai_sample_returns_none_not_zero():
    assert cs.my_compare_score(BIZ, _scan(count=5, probe="legacy"), SP) is None           # 과거 유도형 결과는 쓰지 않는다
    assert cs.my_compare_score(BIZ, _scan(count=0, n=0), SP) is None                      # 표본 0(측정 실패)
    assert cs.my_compare_score(BIZ, {"gemini_result": None, "chatgpt_result": None}, SP) is None


def test_falls_back_to_chatgpt_when_gemini_missing():
    got = cs.my_compare_score(BIZ, _scan(count=7, n=50, src="chatgpt"), SP)
    assert got and got["ai_source"] == "chatgpt" and got["ai_sample_size"] == 50


def test_unmeasured_reviews_return_none():
    unmeasured = {"review_count": None, "avg_rating": None, "receipt_review_count": 0, "has_intro": True}
    assert cs.my_compare_score(unmeasured, _scan(count=2), SP) is None
    no_place = {"review_count": 0, "avg_rating": 0, "receipt_review_count": 0, "naver_place_id": "", "has_intro": True}
    assert cs.my_compare_score(no_place, _scan(count=2), SP) is None                      # DB 기본값 0은 측정이 아니다


def test_never_read_smart_place_and_no_input_returns_none():
    biz = {**BIZ, "has_intro": False, "has_recent_post": False, "naver_intro_draft": ""}
    assert cs.my_compare_score(biz, _scan(count=2), {}) is None


def test_user_input_flags_count_without_crawl():
    biz = {**BIZ, "has_intro": True}
    assert cs.my_compare_score(biz, _scan(count=2), {}) is not None   # 사용자 입력만 있어도 비교 가능(menu는 False로)


def test_website_score_is_included_when_present():
    base = cs.my_compare_score(BIZ, _scan(count=2), SP)["score"]
    with_site = cs.my_compare_score(BIZ, _scan(count=2, website={"score": 90}), SP)["score"]
    assert with_site != base


def test_gap_analysis_injects_my_compare_without_breaking_on_error():
    import inspect
    from services import gap_analyzer
    src = inspect.getsource(gap_analyzer)
    assert '"my_compare": my_compare' in src and "my_compare 계산 실패(무시)" in src


def test_gap_analysis_injects_compare_before_the_estimated_branch():
    """경쟁사 점수가 없어 업종 평균 추정 분기로 반환되는 경우에도 my_compare가 실려야 한다(경쟁사 페이지가 쓰는 경로)."""
    import inspect
    from services import gap_analyzer
    src = inspect.getsource(gap_analyzer.analyze_gap_from_db)
    early = src.index("my_compare = my_compare_score(")
    estimated = src.index("is_competitor_estimated=True")
    assert early < estimated and "my_compare=my_compare" in src[:estimated + 200]
