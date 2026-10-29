"""경쟁사 점수: 평점을 못 읽은 경쟁사가 평점 30점을 0으로 깎이지 않는다 (2026-10-29)."""
from services.competitor_place_crawler import compute_competitor_score


def _rq(**row):
    base = {"detail_synced_at": "2026-10-28T00:00:00Z", "naver_review_count": 20}
    _, bd = compute_competitor_score({**base, **row}, False, 0, "")
    return bd["review_quality"]


def test_rating_present_unchanged():
    assert _rq(naver_avg_rating=4.5) == 97.0          # 70 + 4.5/5*30
    assert _rq(naver_avg_rating=5.0, naver_review_count=10) == 65.0   # 35 + 30


def test_rating_missing_rescaled_not_zeroed():
    # 리뷰 20건: 평점 없다고 70점으로 깎이면 안 되고, 같은 70:30 척도로 환산한다
    assert _rq(naver_avg_rating=None) == 100.0
    assert _rq(naver_avg_rating=None, naver_review_count=10) == 50.0


def test_missing_rating_not_worse_than_poor_rating_competitor():
    # 평점 비공개 경쟁사가 평점 1.0(최악급) 경쟁사보다 낮게 나오면 오판
    assert _rq(naver_avg_rating=None) >= _rq(naver_avg_rating=1.0)


def test_zero_reviews_stays_zero():
    assert _rq(naver_avg_rating=None, naver_review_count=0) == 0.0
