"""재가입 방어(해시 보관)의 방침·약관·탈퇴 화면 문안과 코드 기본값의 일치 (2026-11-10).

시행일은 **2026-11-10(공지 당일)** 이다. 처음에는 방침 9조("시행 최소 7일 전 공지")에 맞춰 11-17 시행으로 공지했으나, 시행일 현재 계정이 모두 개발·시험
계정이라 사전 고지 기간이 보호할 이용자가 없다는 사용자 확인(2026-11-10)에 따라 당겼다. 이 시험은
- 방침·약관·탈퇴 화면·공지가 같은 날짜·같은 보관 기간(12개월)을 말하고,
- 옛 날짜(11월 17일)가 사용자 문구에 남아 있지 않으며,
- 코드의 보관 기간 기본값(365일)이 문안의 12개월과 맞는지 확인한다.
서버 테스트가 frontend 폴더를 읽으므로 프론트를 먼저 배포한 뒤 이 테스트를 배포한다.
"""
import os

from services import discount_guard as dg

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _read(*parts):
    with open(os.path.join(ROOT, "frontend", *parts), encoding="utf-8") as f:
        return f.read()


PRIVACY = _read("app", "(public)", "privacy", "page.tsx")
TERMS = _read("app", "(public)", "terms", "page.tsx")
ACCOUNT = _read("app", "(dashboard)", "settings", "AccountClient.tsx")

EFFECTIVE = "2026년 11월 10일"


def test_privacy_policy_discloses_items_purpose_period_and_non_reversibility():
    assert "부정 이용 방지용 비식별 값" in PRIVACY
    assert "원문으로 복원할 수 없는 값(해시)" in PRIVACY
    assert "원문은 보관하지 않으며" in PRIVACY
    assert "이용일로부터 12개월 보관(회원 탈퇴 후에도 보관)" in PRIVACY
    assert "기간이 지나면 지체 없이 파기" in PRIVACY
    assert "중복 이용 방지" in PRIVACY


def test_privacy_policy_no_longer_says_everything_is_deleted_on_withdrawal_without_the_exception():
    assert "법령상 보존 의무가 있는 결제 정보와 아래 부정 이용 방지용 비식별 값은 제외" in PRIVACY


def test_all_places_state_the_same_effective_date_and_period():
    assert f"제2항·제3항의 부정 이용 방지용 비식별 값(해시) 보관은 {EFFECTIVE}부터 시행됩니다" in PRIVACY
    assert f"제5조 제1항의 첫 달 할인·무료 체험 1회 제공 안내는 {EFFECTIVE}부터 시행합니다" in TERMS
    assert f"정상가로 이용하실 수 있습니다({EFFECTIVE}부터 적용)" in TERMS
    assert f"({EFFECTIVE}부터)" in ACCOUNT
    assert "12개월간 보관된 뒤 자동으로 파기" in ACCOUNT


def test_no_stale_seven_day_date_remains_in_user_facing_text():
    """11-17(공지+7일) 문구가 사용자 화면에 남으면 문안과 실제 동작이 어긋난다."""
    for name, src in (("privacy", PRIVACY), ("terms", TERMS), ("account", ACCOUNT)):
        assert "11월 17일" not in src, name
        assert "7일이 지난 2026년 11월 17일" not in src, name


def test_terms_state_once_per_business_or_email_and_regular_price_remains_available():
    assert "사업장(또는 이메일·연락처)당 1회만 제공" in TERMS
    assert "정상가로 이용하실 수 있습니다" in TERMS


def test_code_retention_default_matches_the_twelve_months_in_the_policy():
    assert dg._DEFAULT_RETENTION_DAYS == 365 and "12개월" in PRIVACY


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
    assert EFFECTIVE in n.TITLE and EFFECTIVE in n.CONTENT
    assert "11월 17일" not in n.TITLE and "11월 17일" not in n.CONTENT
    assert "12개월" in n.CONTENT and "사업장(또는 이메일·연락처)당 1회" in n.CONTENT
    assert "원문으로 복원할 수 없는 값(해시)" in n.CONTENT and "원문은 보관하지 않으며" in n.CONTENT
    assert "탈퇴 후에도" in n.CONTENT and n.CTA_URL == "/privacy"
    src = open(os.path.join(ROOT, "backend", "scripts", "register_discount_policy_notice.py"), encoding="utf-8").read()
    assert 'action="store_true"' in src
    assert src.index("if not args.apply") < src.index('.insert({')
    assert src.index("if not args.apply") < src.index('.update({"title"')           # 갱신도 드라이런이면 쓰기 전에 끝난다
    assert src.index("exists = sb.table") < src.index('.insert({')      # 같은 제목이 있으면 새로 등록하지 않는다(멱등)


def test_notice_script_updates_the_notice_registered_before_the_date_was_moved():
    n = _notice()
    assert any("11월 17일" in t for t in n.LEGACY_TITLES) and all(t != n.TITLE for t in n.LEGACY_TITLES)
    src = open(os.path.join(ROOT, "backend", "scripts", "register_discount_policy_notice.py"), encoding="utf-8").read()
    assert "LEGACY_TITLES" in src.split("def main")[1]                               # 실제로 옛 제목을 찾아 갱신한다
    assert 'if exists[0].get("content") == CONTENT' in src                           # 이미 같은 본문이면 아무것도 하지 않는다
