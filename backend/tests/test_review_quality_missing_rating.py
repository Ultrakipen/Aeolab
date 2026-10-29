"""리뷰 품질: 별점을 읽지 못한 가게가 별점 몫 50점을 0점으로 깎이지 않는다 (2026-10-29).

실제 사례: 대호흑돼지(리뷰 80건, 별점 미수집)가 20점 → 별점이 있었다면 약 65점.
"""
from services.score_engine import calc_review_quality as q


def test_rated_shops_unchanged():
    assert q({"review_count": 80, "avg_rating": 4.5}) == 65.0       # 20 + 45
    assert q({"review_count": 18, "avg_rating": 5.0}) == 54.5       # 4.5 + 50
    assert q({"review_count": 4678, "avg_rating": 4.86}) == 100.0   # 상한


def test_missing_rating_rescaled_to_full_scale():
    assert q({"review_count": 80, "avg_rating": 0}) == 40.0         # 이전 20.0
    assert q({"review_count": 45, "avg_rating": None}) == 22.5      # 이전 11.25
    assert q({"review_count": 100}) == 50.0
    assert q({"review_count": 400, "avg_rating": 0}) == 100.0       # 상한


def test_missing_rating_never_beats_a_comparable_rated_shop_with_good_rating():
    # 별점 미수집은 '중간 추정'일 뿐 좋은 별점을 가진 같은 리뷰 수의 가게보다 높아지면 안 된다
    for rc in (20, 80, 150):
        assert q({"review_count": rc, "avg_rating": 0}) <= q({"review_count": rc, "avg_rating": 4.5})


def test_receipt_bonus_kept_and_zero_stays_zero():
    assert q({"review_count": 80, "avg_rating": 0, "receipt_review_count": 5}) == 45.0   # 40 + 5
    assert q({"review_count": 0, "avg_rating": 0}) == 0.0
    assert q({}) == 0.0
