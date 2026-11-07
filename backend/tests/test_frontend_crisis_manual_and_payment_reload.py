"""F1·F2 (2026-11-07 로그인 후 페이지 점검) 회귀 방지 — 프런트 소스 구조 검사.

F1: 위기관리 패널이 열리자마자 기본 1점으로 자동 생성하고, 별점 버튼을 누를 때마다 또 생성해 Basic(월 20회)이 의도와 무관하게
    차감됐다. 지금은 '만들기'를 눌렀을 때만 생성하고 별점은 효과(useEffect) 의존성에 없다.
F2: 결제 완료 화면을 새로고침하면 서버가 이미 결제된 주문이라 409를 주는데 실패 화면으로 보였다. 지금은 409일 때만 주문 상태를
    조회해 결제 이후 상태(paid·in_progress·completed)면 '이미 결제됨'으로 안내하고, 그 외(환불·취소 등)는 그대로 오류다.
서버 테스트가 frontend 폴더를 읽는다 — 프런트를 먼저 배포한 뒤 백엔드(테스트)를 배포한다.
"""
import re
from pathlib import Path

FE = Path(__file__).resolve().parents[2] / "frontend" / "app" / "(dashboard)"
REVIEW = (FE / "review-inbox" / "page.tsx").read_text(encoding="utf-8")
PAY = (FE / "delivery" / "payment-confirm" / "page.tsx").read_text(encoding="utf-8")


def _panel():
    i = REVIEW.index("function CrisisGuidePanel(")
    return REVIEW[i:i + 9000]


def _effect_block(src):
    i = src.index("useEffect(() => {\n    if (!run) return")
    j = src.index("}, [run, reviewText, businessId, token])", i)
    return src[i:j + 60]


def test_crisis_panel_does_not_generate_until_user_asks():
    eff = _effect_block(_panel())
    assert "if (!run) return" in eff
    assert eff.index("if (!run) return") < eff.index("fetch(")          # 호출보다 앞에서 막는다
    assert "rating: run.rating" in eff                                  # 누른 시점의 별점으로 호출


def test_rating_buttons_do_not_trigger_generation():
    panel = _panel()
    # 별점 버튼은 상태만 바꾼다
    assert "onClick={() => setRating(r)}" in panel
    # 효과 의존성에 rating이 없다 — 있으면 별점 클릭마다 재호출
    deps = re.findall(r"\}, \[([^\]]*)\]\)", _effect_block(panel))
    assert deps and all("rating" not in d for d in deps), deps
    assert "[run, reviewText, businessId, token]" in panel


def test_generation_button_and_usage_notice_exist():
    panel = _panel()
    assert "가이드 만들기" in panel and "다시 만들기" in panel
    assert "이용 횟수가 1회 사용됩니다" in panel
    assert "run.rating !== rating" in panel                              # 별점이 바뀌면 다시 만들기 안내
    assert "min-h-[44px]" in panel                                       # 모바일 터치 영역


def test_payment_confirm_409_is_checked_against_real_order_status():
    assert "res.status === 409" in PAY
    i = PAY.index("res.status === 409")
    block = PAY[i:i + 1100]
    assert "/api/delivery/orders/${orderId}" in block                    # 주문 상태를 서버에서 다시 읽는다
    assert '["paid", "in_progress", "completed"]' in block
    assert "setAlreadyPaid(true)" in block and 'setStatus("success")' in block


def test_payment_confirm_other_errors_still_fail():
    i = PAY.index("res.status === 409")
    after = PAY[i:i + 1500]
    # 409가 아니거나 결제 이후 상태가 아니면 기존처럼 오류로 떨어진다
    assert 'throw new Error(' in after
    assert "결제 확인에 실패했습니다." in after
    # 처음 성공(2xx) 경로는 그대로
    assert PAY.count('setStatus("success")') == 2
    assert "이미 결제가 확인된 의뢰입니다" in PAY and "중복 결제되지 않았습니다" in PAY
