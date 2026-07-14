"""AEOlab 요금제 가격 단일 소스. webhook.py, admin.py에서 import해 사용."""

PLAN_PRICES: dict[int, str] = {
    # 월정액
    11900:  "basic",
    23900:  "pro",
    49900:  "biz",
    12900:  "startup",
    200000: "enterprise",
    # 첫 달 50% 할인 (신규 가입자 전용, webhook에서 first-time 검증)
    5950:   "basic",
    # 연간 (10개월치, 17% 할인)
    119000: "basic",
    239000: "pro",
    499000: "biz",
    129000: "startup",
}

YEARLY_AMOUNTS: set[int] = {119000, 239000, 499000, 129000}

# 연간 구독 갱신 청구액 — plan→연간금액 (retry_billing()이 billing_cycle 반영에 사용, enterprise는 연간가 없음)
YEARLY_PRICE_MAP: dict[str, int] = {
    "basic":   119000,
    "pro":     239000,
    "biz":     499000,
    "startup": 129000,
}

PLAN_PRICE_MAP: dict[str, int] = {
    "basic":      11900,
    "pro":        23900,
    "biz":        49900,
    "startup":    12900,
    "enterprise": 200000,
}

# 첫 달 50% 할인가 — 신규 가입자 1회에 한해 적용 (webhook에서 검증)
FIRST_MONTH_DISCOUNT_PRICES: dict[str, int] = {
    "basic": 5950,
}

# 첫 달 할인 대상 금액 → 정상가 매핑 (감사·로깅용)
DISCOUNT_TO_REGULAR: dict[int, int] = {
    5950: 11900,
}

# 대행 서비스 패키지 가격 단일 소스 (delivery.py에서 import)
DELIVERY_PRICES: dict[str, int] = {
    "smartplace_register": 49000,
    "ai_optimization":     79000,
    "comprehensive":       119000,
}
