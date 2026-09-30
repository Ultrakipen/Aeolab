"""AEOlab 요금제 가격 단일 소스. webhook.py, admin.py에서 import해 사용."""

PLAN_PRICES: dict[int, str] = {
    # 월정액
    17900:  "basic",
    29900:  "pro",
    79500:  "biz",
    23900:  "startup",
    200000: "enterprise",
    # 첫 달 50% 할인 (신규 가입자 전용, webhook에서 first-time 검증)
    8950:   "basic",
    # 연간 (10개월치, 17% 할인)
    179000: "basic",
    299000: "pro",
    795000: "biz",
    239000: "startup",
}

YEARLY_AMOUNTS: set[int] = {179000, 299000, 795000, 239000}

# 연간 구독 갱신 청구액 — plan→연간금액 (retry_billing()이 billing_cycle 반영에 사용, enterprise는 연간가 없음)
YEARLY_PRICE_MAP: dict[str, int] = {
    "basic":   179000,
    "pro":     299000,
    "biz":     795000,
    "startup": 239000,
}

PLAN_PRICE_MAP: dict[str, int] = {
    "basic":      17900,
    "pro":        29900,
    "biz":        79500,
    "startup":    23900,
    "enterprise": 200000,
}

# 첫 달 50% 할인가 — 신규 가입자 1회에 한해 적용 (webhook에서 검증)
FIRST_MONTH_DISCOUNT_PRICES: dict[str, int] = {
    "basic": 8950,
}

# 첫 달 할인 대상 금액 → 정상가 매핑 (감사·로깅용)
DISCOUNT_TO_REGULAR: dict[int, int] = {
    8950: 17900,
}

# 대행 서비스 패키지 가격 단일 소스 (delivery.py에서 import)
DELIVERY_PRICES: dict[str, int] = {
    "smartplace_register": 69000,
    "ai_optimization":     89000,
    "comprehensive":       139000,
}
