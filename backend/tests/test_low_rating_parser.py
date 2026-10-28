"""별점 낮은 리뷰 파서 — 2026-10-28 실측(어니언 성수 플레이스 리뷰 탭) 구조 기반.

이전 파서는 같은 줄의 "5점"을 전제해 실제 화면(별점 / 숫자 / 점이 세 줄로 분리)에서 한 번도 일치하지 않았고,
테스트 픽스처("2점 매우 불만\\n…")가 실제에 없는 형식이라 결함이 가려졌다. 아래 픽스처는 실제 줄 구조를 그대로 본떴다(작성자는 가명).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.naver_place_stats import parse_low_rating_reviews  # noqa: E402


def _review(author, rating, info, *body):
    return "\n".join([author, "리뷰 258사진 1,710팔로워 11", "팔로우", "별점", str(rating), "점", info, *body, "더보기", ""])


HEAD = "이전 페이지\n가게\n저장\n방문자 리뷰\n블로그 리뷰\n이런 점이 좋았어요\n"
INFO = "점심에 방문예약 없이 이용대기 시간 바로 입장나들이친구"


def test_real_structure_extracts_only_low_ratings_with_body_excerpt():
    body = HEAD + _review("가명하나", 5, INFO, "정말 맛있고 분위기가 좋아서 또 방문하고 싶은 곳입니다 감사합니다") \
        + _review("가명둘", 1, INFO, "자리", "직원분이 불친절했고 주문한 커피가 한참 늦게 나와서 너무 실망스러웠습니다 다시는 안 갈 것 같아요") \
        + _review("가명셋", 2, INFO, "빵이 식어서 나왔고 가격에 비해 양이 적어 아쉬웠어요 개선 부탁드립니다")
    markers, low = parse_low_rating_reviews(body, "123", 2, 10)
    assert markers == 3
    assert [r["rating"] for r in low] == [1, 2]
    assert low[0]["excerpt"].startswith("직원분이 불친절했고")    # 방문 정보 줄이 아니라 본문(가장 긴 줄)
    assert "더보기" not in low[0]["excerpt"] and low[0]["excerpt"] != INFO


def test_visit_info_line_is_never_the_excerpt_even_when_body_is_short():
    """실측: 본문이 짧은 리뷰는 방문 정보 줄이 가장 길어 인용문이 방문 정보로 잡혔다."""
    body = HEAD + _review("가명둘", 1, INFO, "별로예요", "다시 안 감")
    _, low = parse_low_rating_reviews(body, "123", 2, 10)
    assert low[0]["excerpt"] == "별로예요" or low[0]["excerpt"] == "다시 안 감"
    assert low[0]["excerpt"] != INFO


def test_old_invented_format_is_not_matched():
    # 이전 테스트 픽스처 형식 — 실제 화면에는 없다. 이것이 일치하면 "실제에 없는 형식을 맞춰 둔" 것이라 안 된다.
    markers, low = parse_low_rating_reviews("2점 매우 불만\n서비스가 너무 느리고 음식이 차가웠습니다 다시는 가지 않을 것 같아요", "123", 2, 10)
    assert markers == 0 and low == []


def test_no_low_ratings_returns_markers_but_empty():
    body = HEAD + _review("가명하나", 5, INFO, "정말 맛있고 분위기가 좋아서 또 방문하고 싶은 곳입니다 감사합니다") \
        + _review("가명둘", 4, INFO, "커피가 맛있었어요 다만 주말에는 사람이 너무 많아 조금 시끄럽습니다")
    markers, low = parse_low_rating_reviews(body, "123", 2, 10)
    assert markers == 2 and low == []


def test_review_id_is_stable_and_distinguishes_different_reviews():
    """순번 기반 ID는 새 낮은 별점 리뷰도 이전 알림과 같은 ID로 걸러졌다 — 내용 기반이어야 한다."""
    a = HEAD + _review("가명둘", 1, INFO, "직원분이 불친절했고 주문한 커피가 한참 늦게 나와서 너무 실망스러웠습니다")
    b = HEAD + _review("가명넷", 1, INFO, "위생 상태가 좋지 않았고 테이블이 끈적거려서 불쾌한 경험이었습니다 개선해 주세요")
    _, la1 = parse_low_rating_reviews(a, "123", 2, 10)
    _, la2 = parse_low_rating_reviews(a, "123", 2, 10)
    _, lb = parse_low_rating_reviews(b, "123", 2, 10)
    assert la1[0]["review_id"] == la2[0]["review_id"]          # 같은 리뷰는 같은 ID(중복 발송 방지)
    assert la1[0]["review_id"] != lb[0]["review_id"]           # 다른 리뷰는 다른 ID(새 알림 가능)
    assert la1[0]["review_id"].startswith("123_")


def test_same_review_twice_in_body_deduped_and_max_reviews_respected():
    r = _review("가명둘", 1, INFO, "직원분이 불친절했고 주문한 커피가 한참 늦게 나와서 너무 실망스러웠습니다")
    _, low = parse_low_rating_reviews(HEAD + r + r, "123", 2, 10)
    assert len(low) == 1
    many = "".join(_review(f"가명{i}", 1, INFO, f"{i}번째 불만 리뷰입니다 서비스가 매우 실망스러웠고 다시 방문하지 않겠습니다") for i in range(6))
    _, low = parse_low_rating_reviews(HEAD + many, "123", 2, 3)
    assert len(low) == 3


def test_rating_digit_must_be_1_to_5_on_its_own_line():
    body = HEAD + "가명\n리뷰 1사진 0팔로워 0\n팔로우\n별점\n7\n점\n본문입니다 매우 길게 작성된 본문 내용입니다\n"
    assert parse_low_rating_reviews(body, "123", 5, 10) == (0, [])
    body2 = HEAD + "가명\n리뷰 1사진 0팔로워 0\n팔로우\n별점 1점\n본문입니다 매우 길게 작성된 본문 내용입니다\n"
    assert parse_low_rating_reviews(body2, "123", 5, 10) == (0, [])
