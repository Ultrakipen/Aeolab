"""7일 환불 안내가 실제 환불 규칙과 같은 말을 하는지 (2026-11-10).

실제 규칙(routers/settings.py `_check_refund_eligibility`): 구독 시작 시각(= 첫 결제 성공 시각) 기준 7일 이내이면서, 구독 이후 결과가 저장된 측정이나
가이드 생성 기록이 없을 때 자동 전액 환불. **정기 자동 측정도 측정에 포함**돼 사용자가 아무것도 하지 않아도 첫 자동 측정이 돌면 자격이 사라진다.
수정 전: 공개 문구 12곳이 "미사용 시 100% 환불"·"7일 내 환불 가능"이라고만 써서 이 조건이 보이지 않았고, 가격 페이지는 기산점을 "결제일",
약관은 "구독 시작일"이라고 달리 불렀다(실제로는 같은 시각). 환불 규칙 자체는 바꾸지 않았다 — 안내만 규칙에 맞췄다.
서버 테스트가 frontend 폴더를 읽으므로 프론트를 먼저 배포한 뒤 이 테스트를 배포한다.
"""
import inspect
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _fe(*parts):
    with open(os.path.join(ROOT, "frontend", *parts), encoding="utf-8") as f:
        return f.read()


SHORT_CLAIM_FILES = [
    ("app", "(public)", "demo", "page.tsx"),
    ("app", "(public)", "plans-preview", "page.tsx"),
    ("app", "(public)", "quick", "page.tsx"),
    ("app", "(public)", "pricing", "PlanRecommender.tsx"),
    ("app", "(dashboard)", "preview", "PreviewClient.tsx"),
    ("components", "dashboard", "ProUpgradePreview.tsx"),
    ("components", "dashboard", "UpgradeNudgeCard.tsx"),
    ("components", "trial", "SubscriptionValueCompare.tsx"),
    ("components", "dashboard", "ConversionGuideSection.tsx"),
    ("app", "(public)", "trial", "components", "TrialResultStep.tsx"),
]


def test_no_unconditional_looking_refund_claim_remains():
    for parts in SHORT_CLAIM_FILES + [("app", "page.tsx"), ("app", "(public)", "pricing", "page.tsx")]:
        src = _fe(*parts)
        assert "미사용 시 100% 환불" not in src, parts       # '미사용'이 무엇인지 보이지 않는 표현
        assert "7일 내 환불 가능" not in src, parts           # 조건 없는 환불 가능으로 읽힌다
        assert "점검·가이드 생성 전" not in src, parts        # 자동 측정이 포함된다는 점이 빠진 옛 표현


def test_every_short_claim_names_the_first_measurement_condition():
    for parts in SHORT_CLAIM_FILES:
        src = _fe(*parts)
        assert "7일 이내 첫 측정 전이면" in src, parts


def test_landing_states_that_automatic_measurement_counts():
    src = _fe("app", "page.tsx")
    assert src.count("7일 이내 첫 측정(자동 측정 포함)·가이드 생성 전이면 100% 환불") == 2
    assert "7일 내 환불 (첫 측정 전)" in src


def test_pricing_faq_defines_the_start_and_use_exactly_like_the_code_and_settings_modal():
    src = _fe("app", "(public)", "pricing", "page.tsx")
    assert src.count("결제일(구독 시작일)로부터 7일 이내") == 2          # 가격 페이지(결제일)와 약관(구독 시작일)의 호칭 차이를 하나로
    assert src.count("구독 후 첫 측정이 실행되면") == 2                    # 두 FAQ 모두 같은 정의
    assert "자동으로 실행되는 정기 측정" in src and "정기 자동 측정" in src   # 자동 측정도 이용으로 본다는 말이 두 FAQ에 각각 있다
    assert "자동 환불 대상이 아니며" in src
    settings_ui = _fe("app", "(dashboard)", "settings", "SettingsClient.tsx")
    assert "정기 자동 측정도 스캔에 포함됩니다" in settings_ui          # 해지 모달이 이미 같은 정의를 쓴다


def test_copy_matches_the_code_it_describes():
    from routers import settings, webhook
    elig = inspect.getsource(settings._check_refund_eligibility)
    assert "timedelta(days=7)" in elig                                  # 7일
    assert 'gte("scanned_at", since)' in elig and 'gte("generated_at", since)' in elig   # 구독 이후의 측정·가이드 생성만 이용으로 센다
    assert "chatgpt_result.not.is.null" in elig                         # 결과가 저장된 측정(자동 측정 포함, 사용자가 누른 것으로 한정하지 않음)
    issue = inspect.getsource(webhook.issue_billing)
    assert '"start_at": charge_start_at' in issue                        # 구독 시작 = 결제 성공 시각 → '결제일'과 '구독 시작일'은 같다


def test_terms_keep_their_legal_wording_unchanged():
    terms = _fe("app", "(public)", "terms", "page.tsx")
    assert "구독 시작일로부터 7일 이내에 청약철회를 신청할 수 있습니다" in terms
    assert "청약철회가 제한될 수 있습니다" in terms                      # 약관(법적 문서)은 이번에 바꾸지 않았다
