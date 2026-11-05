"""가이드의 'AI 인용' 카드: 제목·'비대상 업종' 문구는 백엔드 eligibility가 inactive일 때만, 인용 행에는 한국 시간 측정일.

2026-11-05 실가이드 점검: '확대 예상(likely)' 업종(beauty)인데 같은 화면 안내와 모순되게 '플레이스형 비대상 업종'이 붙었고,
하루 전 측정의 네이버 인용이 날짜 없이 최신처럼 보였다. 최근 3회 측정을 합치는 백엔드 동작과 실제 인용 행은 그대로 둔다.
"""
import pathlib
import re

SRC = (pathlib.Path(__file__).resolve().parents[2] / "frontend" / "components" / "guide" / "AICitationHighlight.tsx").read_text(encoding="utf-8")


def test_title_and_non_target_label_follow_backend_eligibility():
    assert "data.eligibility === 'inactive'" in SRC
    assert re.search(r"const title = strictInactive\s*\?", SRC)
    assert "{strictInactive && (" in SRC
    # 화면 prop(likely 포함)으로 문구를 켜지 않는다
    assert not re.search(r"\{isInactive && \(\s*<span[^>]*>플레이스형", SRC)
    assert not re.search(r"const title = isInactive", SRC)


def test_citation_rows_show_kst_measured_date():
    assert "created_at?: string | null" in SRC
    assert "timeZone: 'Asia/Seoul'" in SRC
    assert "{measuredOn(c.created_at) && (" in SRC  # 표시 조건
    assert "· {measuredOn(c.created_at)}" in SRC  # 실제 출력


def test_mentioned_rows_are_not_dropped_by_the_card():
    # 하루 전 실제 인용을 숨기면 긍정 신호를 지우게 된다 — 언급 행은 필터 대상이 아니다
    assert "c.platform !== 'naver' || c.mentioned" in SRC
