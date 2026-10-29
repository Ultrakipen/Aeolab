"""경쟁사 목록·요약 카드에 '확인' 날짜와 새로고침 (2026-10-29).

날짜와 새로고침이 펼친 상세 카드(CompetitorPlaceCard)에만 있어, 갱신 주기가 긴데도 목록의 수치가 언제 값인지 알 수 없었다.
프론트 단위 테스트 환경이 없어 소스 구조로 고정한다.
"""
import os

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_SRC = open(os.path.join(_ROOT, "frontend", "app", "(dashboard)", "competitors", "CompetitorsClient.tsx"), encoding="utf-8").read()


def test_list_row_shows_date_and_refresh_for_synced_competitors():
    assert 'import { fmtMonthDay } from "@/lib/naverMeasure"' in _SRC
    assert "{fmtMonthDay(c.place_synced_at)} 확인" in _SRC
    assert "'새로고침'" in _SRC and "확인 중…" in _SRC


def test_refresh_is_not_duplicated_with_the_rating_sync_button():
    # 별점 동기화 버튼이 이미 보이는 행(별점 없음 + 상세 미동기화)에는 새로고침을 또 넣지 않는다
    assert "((typeof c.place_avg_rating === 'number' && c.place_avg_rating > 0) || c.detail_synced_at) && (" in _SRC


def test_summary_card_shows_date():
    assert "{fmtMonthDay(competitor.place_synced_at)} 확인" in _SRC


def test_success_state_is_cleared_and_error_is_user_readable():
    assert "지금은 갱신하지 못했어요" in _SRC
    body = _SRC.split("const handleSyncPlace = useCallback", 1)[1].split("const [searchQuery", 1)[0]
    assert body.count("delete next[competitorId]") >= 2          # 성공·실패 모두 상태를 지운다


def test_page_text_points_to_where_refresh_actually_is():
    assert "경쟁사 목록의 '새로고침'으로 직접 갱신 가능" in _SRC
    assert "경쟁사 카드의 새로고침 버튼으로" not in _SRC           # 이전 문구는 '이미지 카드 새로고침'과 혼동됐다


def test_429_and_recent_responses_are_handled_not_shown_as_failure():
    body = _SRC.split("const handleSyncPlace = useCallback", 1)[1].split("const [searchQuery", 1)[0]
    assert "res.status === 429" in body and "'limit'" in body
    assert "body.refreshed === false" in body and "'recent'" in body
    assert "방금 확인한 값이에요" in _SRC and "너무 자주 눌렀어요" in _SRC
    assert "'loading' | 'success' | 'error' | 'recent' | 'limit'" in _SRC


def test_batch_sync_stops_at_the_hourly_limit():
    loop = _SRC.split("const handleSyncAllRatings = useCallback", 1)[1].split("setSyncAllFailedCount(failedCount)", 1)[0]
    assert "res.status === 429" in loop and "break" in loop
