"""재가입 방어(해시 보관)의 방침·약관·탈퇴 화면 문안과 코드 기본값의 일치 (2026-11-10).

해시 보관은 방침이 먼저여서 코드는 꺼진 채 배포했다(services/discount_guard). 이 문안이 11월 17일부터 시행을 약속하므로
- 세 곳이 같은 날짜·같은 보관 기간을 말하고,
- 공지(11-10)로부터 7일(방침 9조 약속)이 지난 날짜이며,
- 코드의 보관 기간 기본값(365일)이 문안의 12개월과 맞고, 플래그는 기본 꺼짐이어야 한다.
서버 테스트가 frontend 폴더를 읽으므로 프론트를 먼저 배포한 뒤 이 테스트를 배포한다.
"""
import os
from datetime import date, timedelta

from services import discount_guard as dg

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _read(*parts):
    with open(os.path.join(ROOT, "frontend", *parts), encoding="utf-8") as f:
        return f.read()


PRIVACY = _read("app", "(public)", "privacy", "page.tsx")
TERMS = _read("app", "(public)", "terms", "page.tsx")
ACCOUNT = _read("app", "(dashboard)", "settings", "AccountClient.tsx")

NOTICE_DATE = date(2026, 11, 10)
EFFECTIVE = date(2026, 11, 17)


def test_effective_date_is_seven_days_after_the_notice():
    assert EFFECTIVE - NOTICE_DATE == timedelta(days=7)      # 방침 9조 "시행 최소 7일 전 공지" 약속


def test_privacy_policy_discloses_items_purpose_period_and_non_reversibility():
    assert "부정 이용 방지용 비식별 값" in PRIVACY
    assert "원문으로 복원할 수 없는 값(해시)" in PRIVACY
    assert "원문은 보관하지 않으며" in PRIVACY
    assert "이용일로부터 12개월 보관(회원 탈퇴 후에도 보관)" in PRIVACY
    assert "기간이 지나면 지체 없이 파기" in PRIVACY
    assert "중복 이용 방지" in PRIVACY


def test_privacy_policy_no_longer_says_everything_is_deleted_on_withdrawal_without_the_exception():
    assert "법령상 보존 의무가 있는 결제 정보와 아래 부정 이용 방지용 비식별 값은 제외" in PRIVACY


def test_all_three_places_state_the_same_effective_date_and_period():
    assert "2026년 11월 17일부터 모든 이용자에게 적용" in PRIVACY
    assert "2026년 11월 17일부터 모든 이용자에게 적용" in TERMS
    assert "2026년 11월 17일부터" in ACCOUNT
    assert "12개월간 보관된 뒤 자동으로 파기" in ACCOUNT


def test_privacy_cites_the_same_notice_date():
    assert "변경 공지(2026년 11월 10일)로부터 7일이 지난 2026년 11월 17일" in PRIVACY
    assert "변경 공지(2026년 11월 10일)로부터 7일이 지난 2026년 11월 17일" in TERMS


def test_terms_state_once_per_business_or_email_and_regular_price_remains_available():
    assert "사업장(또는 이메일)당 1회만 제공" in TERMS
    assert "정상가로 이용하실 수 있습니다" in TERMS


def test_code_retention_default_matches_the_twelve_months_in_the_policy():
    assert dg._DEFAULT_RETENTION_DAYS == 365 and "12개월" in PRIVACY


def test_guard_stays_off_by_default_until_the_effective_date_is_reached_and_someone_turns_it_on(monkeypatch):
    monkeypatch.delenv("DISCOUNT_KEY_GUARD_ENABLED", raising=False)
    monkeypatch.setenv("DISCOUNT_KEY_PEPPER", "x")
    assert dg.guard_enabled() is False


def test_earlier_policy_dates_are_untouched():
    """11-02 시행 문구는 test_policy_effective_date.py가 지킨다 — 새 문구가 그것을 지우지 않았는지만 확인."""
    for src in (TERMS, PRIVACY):
        assert "2026년 11월 2일 이전에 가입한 이용자" in src and "2026년 11월 8일부터 적용" in src


def _notice():
    import importlib.util
    path = os.path.join(ROOT, "backend", "scripts", "register_discount_policy_notice.py")
    spec = importlib.util.spec_from_file_location("register_discount_policy_notice", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_notice_text_matches_policy_and_is_dry_run_by_default():
    n = _notice()
    assert "2026년 11월 17일" in n.TITLE and "2026년 11월 17일" in n.CONTENT
    assert "12개월" in n.CONTENT and "사업장(또는 이메일)당 1회" in n.CONTENT
    assert "원문으로 복원할 수 없는 값(해시)" in n.CONTENT and "원문은 보관하지 않으며" in n.CONTENT
    assert "탈퇴 후에도" in n.CONTENT and n.CTA_URL == "/privacy"
    src = open(os.path.join(ROOT, "backend", "scripts", "register_discount_policy_notice.py"), encoding="utf-8").read()
    assert 'action="store_true"' in src and src.index("if not args.apply") < src.index('.insert({')
    assert src.index("exists = sb.table") < src.index('.insert({')      # 같은 제목이 있으면 등록하지 않는다(멱등)
