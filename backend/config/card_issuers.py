"""카드사 코드 → 한글 표시명 매핑 (레거시).
크렙 전환(2026-10-20) 이후 subscriptions.card_issuer_code에는 크렙 cardCompany 한글명이 그대로 저장되며,
이 매핑에 없는 값은 card_issuer_name()이 입력값을 그대로 반환한다.
"""

CARD_ISSUER_NAMES: dict[str, str] = {
    # 국내
    "3K": "기업BC", "46": "광주", "71": "롯데", "30": "산업",
    "31": "BC", "51": "삼성", "38": "새마을", "41": "신한",
    "62": "신협", "36": "씨티", "33": "우리", "W1": "우리",
    "37": "우체국", "39": "저축", "35": "전북", "42": "제주",
    "15": "카카오뱅크", "3A": "케이뱅크", "24": "토스뱅크", "21": "하나",
    "61": "현대", "11": "국민", "91": "농협", "34": "수협",
    # 해외
    "6D": "다이너스", "4M": "마스터", "3C": "유니온페이",
    "7A": "AMEX", "4J": "JCB", "4V": "비자",
}


def card_issuer_name(issuer_code: str | None) -> str | None:
    if not issuer_code:
        return None
    return CARD_ISSUER_NAMES.get(issuer_code, issuer_code)
