"""비회원 체험의 '확인 전'(소개글·소식)에 가입 안내가 붙고, 로그인 사용자에게는 붙지 않으며,
화면에 쓰이지 않는 죽은 안내 컴포넌트(MergedScanInfoBox, 11-05 삭제)가 되살아나지 않는지 소스 구조로 막는다."""
import pathlib

FE = pathlib.Path(__file__).resolve().parents[2] / "frontend"
STATUS = (FE / "components" / "trial" / "NaverStatusSection.tsx").read_text(encoding="utf-8")
RESULT = (FE / "app" / "(public)" / "trial" / "components" / "TrialResultStep.tsx").read_text(encoding="utf-8")
SCANNING = (FE / "app" / "(public)" / "trial" / "components" / "TrialScanningStep.tsx").read_text(encoding="utf-8")


def test_unknown_notes_carry_signup_note_only_when_hint_on():
    assert "signupHint = false" in STATUS  # 기본값은 꺼짐
    assert "const SIGNUP_NOTE = signupHint" in STATUS
    assert STATUS.count("+ SIGNUP_NOTE}") == 2  # 소개글·소식 두 곳
    assert "못 읽으면 '확인 전'" in STATUS  # 보장처럼 쓰지 않고 조건을 함께 쓴다


def test_place_section_receives_hint_only_for_non_logged_in():
    assert "signupHint={!isLoggedIn}" in RESULT


def test_scanning_step_does_not_claim_auto_check_of_place_data():
    assert "스마트플레이스 자동 점검" not in SCANNING


def test_dead_info_box_stays_removed():
    # 아무 곳에서도 쓰이지 않던 컴포넌트 — 다시 만들면 화면과 어긋난 안내가 생긴다
    assert "MergedScanInfoBox" not in RESULT
