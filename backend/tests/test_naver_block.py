"""네이버 플레이스 차단 화면 감지 회귀 테스트 (2026-10-27).

실제 차단 화면은 "플레이스"와 "서비스 이용이 제한되었습니다."가 줄바꿈으로 나뉘어, 기존 한 줄 문자열 비교
(`"플레이스 서비스 이용이 제한" in text`)에 매칭되지 않았다.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.feed_post_parser import analyze_feed_posts  # noqa: E402
from services.naver_block import is_naver_block_page  # noqa: E402

REAL_BLOCK_PAGE = (
    "플레이스\n서비스 이용이 제한되었습니다.\n과도한 접근 요청으로 서비스 이용이 제한되었습니다.\n"
    "잠시 후 다시 시도해주세요.\nIP: 115.68.231.57(27/Oct/2026:19:03:01 +0900)\n이전화면\n새로고침"
)


def test_real_block_page_with_line_breaks_is_detected():
    assert is_naver_block_page(REAL_BLOCK_PAGE) is True
    # 기존 방식이 놓치던 형태임을 명시: 한 줄 문자열 비교는 실패한다
    assert ("플레이스 서비스 이용이 제한" in REAL_BLOCK_PAGE) is False


def test_old_single_line_format_still_detected():
    assert is_naver_block_page("플레이스 서비스 이용이 제한되었습니다. 잠시 후 다시 시도해주세요.") is True


def test_normal_long_page_mentioning_phrase_is_not_a_block():
    # 소개글 같은 정상 본문에 문구가 들어 있어도(긴 본문, 차단 안내 없음) 차단으로 오인하지 않는다
    body = ("홍스튜디오 소개\n" + "촬영 안내 문장입니다. " * 200) + "\n일부 서비스 이용이 제한될 수 있습니다.\n"
    assert len(body) > 1500
    assert is_naver_block_page(body) is False


def test_empty_or_none_is_not_a_block():
    assert is_naver_block_page("") is False
    assert is_naver_block_page(None) is False


def test_block_page_is_read_as_unmeasured_by_feed_parser():
    # 차단 화면을 소식 탭 본문으로 읽어도 "없음"이 아니라 측정 불가
    a = analyze_feed_posts(REAL_BLOCK_PAGE, "https://m.place.naver.com/place/38561949/feed")
    assert a["state"] == "unmeasured"
