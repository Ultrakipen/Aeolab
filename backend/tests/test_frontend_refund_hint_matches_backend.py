"""해지 모달의 환불 안내(frontend settings/page.tsx)가 백엔드 환불 판정(routers/settings.py _check_refund_eligibility)과 같은 기준을 쓴다 (2026-11-08).

11-07에 백엔드만 '구독 시작 이후 + 결과가 저장된 스캔만 이용'으로 고쳐져 있어, 가입 후 무료 첫 측정(결제 전 기록)이나 체험 가져오기 행이 있는
사용자는 실제로는 환불되는데 화면에 환불 안내가 뜨지 않았다. 두 곳이 다시 어긋나지 않게 필터 문자열을 직접 비교한다.
서버 테스트가 frontend 폴더를 읽는다 — 프런트를 먼저 배포한 뒤 백엔드(테스트)를 배포한다.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PAGE = (ROOT / "frontend" / "app" / "(dashboard)" / "settings" / "page.tsx").read_text(encoding="utf-8")
CLIENT = (ROOT / "frontend" / "app" / "(dashboard)" / "settings" / "SettingsClient.tsx").read_text(encoding="utf-8")
BACK = (ROOT / "backend" / "routers" / "settings.py").read_text(encoding="utf-8")

OR_FILTER = "chatgpt_result.not.is.null,gemini_result.not.is.null,naver_result.not.is.null"


def test_scan_result_filter_string_is_identical_in_backend_and_frontend():
    assert OR_FILTER in BACK and OR_FILTER in PAGE
    # 백엔드가 이 문자열을 바꾸면 프런트도 같이 바꿔야 한다(어느 한쪽만 바뀌면 이 테스트가 깨진다)
    b = re.findall(r'\.or_\("([^"]+)"\)', BACK)
    f = re.findall(r'\.or\("([^"]+)"\)', PAGE)
    assert b and f and b[0] == f[0] == OR_FILTER


def test_frontend_counts_only_usage_after_subscription_start():
    i = PAGE.index("const refundSince")
    block = PAGE[i:i + 1700]
    assert 'sub?.start_at' in block and r'.replace(/\.\d{3}Z$/, "Z")' in block      # 백엔드와 같은 '…Z' 형식(초 단위)
    assert '.gte("scanned_at", refundSince)' in block and '.gte("generated_at", refundSince)' in block
    assert f'.or("{OR_FILTER}")' in block
    # 이전 구현(시각·결과 필터 없는 전체 카운트)으로 되돌아가지 않는다
    assert 'select("id", { count: "exact", head: true }).in("business_id", bizIdsForRefundCheck),\n' not in block


def test_not_eligible_within_seven_days_explains_why_in_cancel_modal():
    assert "const refundWindowOpenButNotEligible = !isAdminUser && withinSevenDays && !refundEligible" in PAGE
    assert "refundWindowOpenButNotEligible={refundWindowOpenButNotEligible}" in PAGE
    assert "refundWindowOpenButNotEligible?: boolean" in CLIENT and "refundWindowOpenButNotEligible = false" in CLIENT
    i = CLIENT.index("{refundWindowOpenButNotEligible && (")
    msg = CLIENT[i:i + 700]
    assert "정기 자동 측정도 스캔에 포함됩니다" in msg and "고객센터" in msg and "자동 환불 대상이 아닙니다" in msg
    # 환불 대상 배너와 동시에 뜨지 않는다(둘은 배타적: eligible이면 NotEligible=false)
    assert "refundEligible && (" in CLIENT
