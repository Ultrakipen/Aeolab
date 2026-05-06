"""AEOlab 요금제 가격 단일 소스. webhook.py, admin.py에서 import해 사용."""

PLAN_PRICES: dict[int, str] = {
    # 월정액
    9900:  "basic",
    18900: "pro",
    49900: "biz",
    12900: "startup",
    # 첫 달 50% 할인 (신규 가입자 전용, webhook에서 first-time 검증)
    4950:  "basic",
    # 연간 (10개월치, 17% 할인)
    99000:  "basic",
    189000: "pro",
    499000: "biz",
    129000: "startup",
}

YEARLY_AMOUNTS: set[int] = {99000, 189000, 499000, 129000}

PLAN_PRICE_MAP: dict[str, int] = {
    "basic":   9900,
    "pro":     18900,
    "biz":     49900,
    "startup": 12900,
}

# 첫 달 50% 할인가 — 신규 가입자 1회에 한해 적용 (webhook에서 검증)
FIRST_MONTH_DISCOUNT_PRICES: dict[str, int] = {
    "basic": 4950,
}

# 첫 달 할인 대상 금액 → 정상가 매핑 (감사·로깅용)
DISCOUNT_TO_REGULAR: dict[int, int] = {
    4950: 9900,
}
