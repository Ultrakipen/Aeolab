"""소식 탭 최근 게시물 판정 회귀 테스트 (2026-10-27, docs/improvement_item_catalog_v1.0.md D1).

실제 홍스튜디오(place 1752528839) 소식 탭 구조를 옮긴 입력으로 두 방향 오탐을 막는다:
  1) 글 본문의 "소식이 없어" 문장 때문에 글이 있는 가게가 "소식 없음"이 되던 것
  2) 글 본문의 "1시간 전부터"/"6개월 전부터" 표현이 게시 시각으로 읽혀 "최근 소식 있음"이 되던 것
"""
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.feed_post_parser import analyze_feed_posts, to_has_recent_post  # noqa: E402
from services.naver_place_stats import _detect_recent_post_stats  # noqa: E402
from services.smart_place_auto_check import _detect_recent_post  # noqa: E402

NOW = datetime(2026, 10, 27, 12, 0, tzinfo=timezone.utc)
FEED_URL = "https://m.place.naver.com/place/1752528839/feed"

_HEADER = "홍스튜디오\n마이플레이스\n영업 중\n22:00에 영업 종료\n예약\n홈\n소식\n리뷰\n사진\n정보\n전체\n소식\n블로그\n공지\n동영상\n"


def _post(stamp_line: str, long_date: str, body: str) -> str:
    # 실제 구조: 본문, 더보기, (공감), 게시 시각 단독 줄, 한글 날짜 줄, 작성자
    return f"{body}\n더보기\n좋아요\n{stamp_line}\n{long_date}\n스냅전문 홍스튜디오\n"


def test_recent_posts_with_no_news_phrase_inside_post_body_is_recent():
    # 본문에 "소식이 없어"가 들어 있어도 게시 시각 단독 줄이 있으면 최근 소식 있음 (기존 오탐)
    body = _HEADER
    body += _post("2026.10.20.", "2026년 10월 20일", "서울에는 아직 장미 소식이 없어 창원까지 내려오신 고객님")
    body += _post("2026.09.22.", "2026년 9월 22일", "학생들의 표정을 담았습니다")
    a = analyze_feed_posts(body, FEED_URL, NOW)
    assert a["state"] == "recent"
    assert a["latest_date"] == "2026-10-20"
    assert to_has_recent_post(a) is True


def test_relative_time_inside_prose_is_not_a_post_timestamp():
    # "행사 1시간 전부터", "6개월 전부터"는 문장 속 표현 — 게시 시각이 아니다. 오래된 글만 있으면 최근 아님 (반대 방향 오탐)
    body = _HEADER
    body += _post("2025.03.02.", "2025년 3월 2일", "행사 1시간 전부터 시작하는 돌스냅. 신부님은 6개월 전부터 사진을 보시고")
    a = analyze_feed_posts(body, FEED_URL, NOW)
    assert a["state"] == "old"
    assert to_has_recent_post(a) is False


def test_prose_only_without_any_timestamp_is_unmeasured_not_recent_or_none():
    body = _HEADER + "행사 1시간 전부터 시작합니다. 소식이 없어 걱정했는데\n"
    a = analyze_feed_posts(body, FEED_URL, NOW)
    assert a["state"] == "unmeasured"
    assert to_has_recent_post(a) is None  # 어느 쪽으로도 단정하지 않는다


def test_standalone_no_post_message_is_none():
    body = _HEADER + "등록된 소식이 없습니다.\n"
    a = analyze_feed_posts(body, FEED_URL, NOW)
    assert a["state"] == "none"
    assert to_has_recent_post(a) is False


def test_redirected_to_home_means_no_feed_tab():
    # 어니언·하라식당처럼 소식 탭이 없으면 /feed가 /home으로 이동한다 — 홈의 리뷰 날짜를 게시 시각으로 읽으면 안 됨
    home = "어니언 성수\n2026.10.25.\n3일 전\n리뷰\n"
    a = analyze_feed_posts(home, "https://m.place.naver.com/restaurant/38561949/home", NOW)
    assert a["state"] == "no_tab"
    assert to_has_recent_post(a) is False


def test_all_posts_older_than_90_days_is_old_with_date():
    body = _HEADER + _post("2026.06.17.", "2026년 6월 17일", "여름 스냅")
    a = analyze_feed_posts(body, FEED_URL, NOW)
    assert a["state"] == "old"
    assert a["latest_date"] == "2026-06-17"
    assert to_has_recent_post(a) is False


def test_standalone_relative_timestamps():
    for stamp in ("방금", "5분 전", "3시간 전", "3일 전"):
        a = analyze_feed_posts(_HEADER + _post(stamp, "", "신메뉴 출시"), FEED_URL, NOW)
        assert a["state"] == "recent", stamp
    a = analyze_feed_posts(_HEADER + _post("4개월 전", "", "공지"), FEED_URL, NOW)
    assert a["state"] == "old"


def test_future_date_is_ignored():
    a = analyze_feed_posts(_HEADER + _post("2027.01.01.", "2027년 1월 1일", "예고"), FEED_URL, NOW)
    assert a["state"] == "unmeasured"


def test_empty_body_is_unmeasured():
    assert analyze_feed_posts("", FEED_URL, NOW)["state"] == "unmeasured"
    assert analyze_feed_posts(None, FEED_URL, NOW)["state"] == "unmeasured"


def test_compat_wrappers_use_the_same_rules():
    body = _HEADER + _post("2026.10.20.", "2026년 10월 20일", "아직 장미 소식이 없어")
    assert _detect_recent_post_stats(body, FEED_URL) == (True, "2026-10-20")
    assert _detect_recent_post_stats("행사 1시간 전부터", FEED_URL) == (None, None)
    assert _detect_recent_post("행사 1시간 전부터 시작") is False  # 측정 불가는 False로 접는다(하위 호환)
