"""가입→결제 연결 화면 수정 (2026-11-02 실화면 점검 — 격리 비로그인 브라우저로 확인한 결함).

- 결제 모달: 모바일 하단 고정 CTA(z-50)보다 위(z-[60])에 있어야 하고, 작은 화면(375x667)에서 버튼에 닿도록 스크롤돼야 한다.
- 비로그인 모달에는 검증하지 않는 "(필수)" 전화번호 입력란을 보이지 않는다. 전화번호 안내는 실제 동작(결제 안내 + 설정에서 켠 알림, 7일 3건)과 같아야 한다.
- 가입 화면: PayButton이 보내는 표시 이름(`?plan=Basic`·`창업패키지`)도 플랜 키로 정규화한다. 완료 화면은 "인증 후 결제가 진행된다"고 약속하지 않는다.
서버 테스트가 frontend 폴더를 읽으므로 프론트를 먼저 배포한 뒤 이 테스트를 배포한다.
"""
import os
import re

from services import notify_weekly_cap as cap

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _read(*parts):
    with open(os.path.join(ROOT, "frontend", *parts), encoding="utf-8") as f:
        return f.read()


PAY = _read("app", "(public)", "pricing", "PayButton.tsx")
SIGNUP = _read("app", "(auth)", "signup", "page.tsx")
FLOAT = _read("components", "common", "MobileFloatingCTA.tsx")


def _z(src, marker):
    m = re.search(marker + r'[^"]*z-\[?(\d+)\]?', src)
    return int(m.group(1)) if m else None


def test_pay_modal_stacks_above_the_mobile_floating_cta():
    floating = int(re.search(r"fixed bottom-0[^\"]*z-(\d+)", FLOAT).group(1))
    modal = int(re.search(r'className="fixed inset-0 z-\[(\d+)\]', PAY).group(1))
    assert modal > floating, (modal, floating)                       # 같으면 DOM 순서상 뒤에 오는 고정 CTA가 모달 위에 그려진다


def test_pay_modal_scrolls_on_short_screens():
    assert "overflow-y-auto" in PAY and "min-h-full" in PAY and 'aria-modal="true"' in PAY
    assert 'className="fixed inset-0 z-50 flex items-center' not in PAY      # 옛 구조(높이 제한·스크롤 없음)


def test_phone_field_is_only_shown_to_logged_in_users():
    i = PAY.index('id="pay-confirm-phone"')
    before = PAY[max(0, i - 700):i]
    assert "{isLoggedIn ? (" in before                               # 입력란은 로그인 분기 안에 있다
    assert "가입을 마친 뒤 결제 단계에서 알림 받을 전화번호를 입력합니다" in PAY


def test_phone_helper_text_matches_real_behavior(monkeypatch):
    monkeypatch.delenv("NOTIFY_WEEKLY_CAP", raising=False)
    assert cap.weekly_cap() == 3
    assert "결제·구독 안내를 받는 번호입니다" in PAY and "설정에서 켠 경우에만" in PAY and "7일에 최대 3건" in PAY
    assert "AI 노출 점수 변동·경쟁사 알림을 카카오톡으로 받습니다" not in PAY      # 옛 문구


def test_signup_normalizes_plan_display_names_to_keys():
    assert '"창업패키지": "startup"' in SIGNUP and 'basic: "basic"' in SIGNUP
    assert "PLAN_ALIASES[planParamRaw.trim().toLowerCase()]" in SIGNUP
    # PayButton이 실제로 보내는 값(요금제 표시 이름)이 정규화 표를 거쳐 가입 화면의 플랜 키가 된다 — 소스의 표를 읽어 실제로 변환해 본다
    block = SIGNUP[SIGNUP.index("const PLAN_ALIASES"):]
    block = block[:block.index("};")]
    aliases = {(a or b): c for a, b, c in re.findall(r'(?:"([^"]+)"|(\w+)):\s*"(\w+)"', block)}
    labels = set(re.findall(r"^\s{2}(\w+): `", SIGNUP, re.M))                  # PLAN_LABELS의 키
    plans = open(os.path.join(ROOT, "frontend", "lib", "plans.ts"), encoding="utf-8").read()
    shown = [n for n in re.findall(r'name: "([^"]+)"', plans) if n != "무료 체험"]
    assert set(shown) >= {"Basic", "Pro", "Biz", "창업패키지"}, shown
    for display in shown:
        key = aliases.get(display.strip().lower())
        assert key in labels, f"{display!r} → {key!r} (PLAN_LABELS 키: {labels})"


def test_signup_done_screen_does_not_promise_automatic_payment():
    for old in ("인증 완료 후 <strong>", "결제가 진행됩니다", "결제까지 2단계 남았습니다"):
        assert old not in SIGNUP, old
    assert "인증 → 사업장 등록 → 요금제 선택·결제" in SIGNUP
    assert "요금제 화면에서 <strong>{PLAN_LABELS[planParam]}</strong> 결제를 이어서 진행하실 수 있습니다" in SIGNUP
