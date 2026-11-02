"""방침·약관 변경(AI 처리 업체·국외 전송, 약관 제7조 제5항)의 시행일 문구 (2026-11-02, 사용자 결정: 11월 8일 → 오늘).

신규 가입자는 오늘(11-02)부터 적용하고, 오늘 이전 가입자에게는 개인정보처리방침 9조의 "시행 최소 7일 전 공지" 약속에 따라 공지(11-01)로부터
7일이 지난 11-08부터 적용한다. 두 페이지가 같은 날짜를 말해야 하고, 옛 문구("11월 8일부터 시행")가 남아 있으면 안 된다.
서버 테스트가 frontend 폴더를 읽으므로 프론트를 먼저 배포한 뒤 이 테스트를 배포한다.
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _read(*parts):
    with open(os.path.join(ROOT, "frontend", *parts), encoding="utf-8") as f:
        return f.read()


TERMS = _read("app", "(public)", "terms", "page.tsx")
PRIVACY = _read("app", "(public)", "privacy", "page.tsx")


def test_both_pages_say_new_members_are_covered_from_today():
    assert "2026년 11월 2일부터 시행합니다" in TERMS
    assert "2026년 11월 2일부터 시행됩니다" in PRIVACY


def test_both_pages_keep_the_seven_day_notice_for_existing_members():
    for src in (TERMS, PRIVACY):
        assert "2026년 11월 2일 이전에 가입한 이용자" in src and "2026년 11월 8일부터 적용" in src
        assert "7일이 지난" in src


def test_old_effective_date_wording_is_gone():
    assert "11월 8일부터 시행" not in TERMS and "11월 8일부터 시행" not in PRIVACY


def test_privacy_policy_still_promises_seven_days_notice():
    """이 약속이 있는 한 기존 이용자에게는 11-08을 지켜야 한다 — 약속 문구를 바꾸면 위 날짜 규칙도 다시 판단할 것."""
    assert "시행 최소 7일 전 서비스 공지사항을 통해 고지합니다" in PRIVACY
