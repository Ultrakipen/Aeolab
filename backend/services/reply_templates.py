"""후기 답글 템플릿 라이브러리.

업종 × 감정(positive/neutral/negative) × 패턴별 정적 데이터.
{business_name} 플레이스홀더 치환 후 반환.
"""

SENTIMENTS = ["positive", "neutral", "negative"]

POSITIVE_PATTERNS = [
    "food_praise",
    "service_praise",
    "revisit_intent",
    "photo_praise",
    "overall_praise",
]
NEUTRAL_PATTERNS = ["general_thanks", "improvement_noted", "info_provided"]
NEGATIVE_PATTERNS = [
    "price_complaint",
    "taste_complaint",
    "service_complaint",
    "wait_complaint",
    "other_complaint",
]


def _build_positive(
    food_keyword: str,
    service_keyword: str,
    revisit_keyword: str,
    biz_placeholder: str = "{business_name}",
) -> dict[str, str]:
    """업종 키워드로 positive 패턴 5종 생성 헬퍼."""
    return {
        "food_praise": f"{food_keyword} 만족하셨다니 정말 기쁩니다! {biz_placeholder}에서 더 좋은 경험으로 다시 찾아주세요.",
        "service_praise": f"따뜻한 {service_keyword}에 만족하셨다니 감사합니다. {biz_placeholder} 모든 직원이 힘이 납니다!",
        "revisit_intent": f"재방문 의사를 남겨주셔서 감사합니다. {biz_placeholder}에서 항상 반갑게 맞이하겠습니다.",
        "photo_praise": f"멋진 사진 감사합니다! {biz_placeholder}의 {revisit_keyword}이(가) 더욱 빛나 보입니다.",
        "overall_praise": f"소중한 리뷰 감사합니다! {biz_placeholder}에서 항상 최선을 다하겠습니다.",
    }


def _build_neutral(biz_placeholder: str = "{business_name}") -> dict[str, str]:
    """neutral 패턴 3종 생성 헬퍼 (업종 공통)."""
    return {
        "general_thanks": f"방문해 주셔서 감사합니다. {biz_placeholder}에서 더 나은 서비스로 보답하겠습니다.",
        "improvement_noted": f"소중한 의견 감사드립니다. {biz_placeholder}에서 개선을 위해 노력하겠습니다.",
        "info_provided": f"문의해 주셔서 감사합니다. 더 궁금한 사항은 언제든 연락 주세요.",
    }


def _build_negative(
    quality_keyword: str,
    service_keyword: str,
    biz_placeholder: str = "{business_name}",
) -> dict[str, str]:
    """업종 키워드로 negative 패턴 5종 생성 헬퍼."""
    return {
        "price_complaint": f"가격에 대한 솔직한 의견 감사합니다. {biz_placeholder}에서 가격 대비 더 나은 가치를 드릴 수 있도록 노력하겠습니다.",
        "taste_complaint": f"기대에 미치지 못한 {quality_keyword} 경험에 진심으로 사과드립니다. {biz_placeholder}에서 더 나은 품질로 보답하겠습니다.",
        "service_complaint": f"불편한 {service_keyword} 경험에 진심으로 사과드립니다. {biz_placeholder}에서 서비스 개선을 위해 최선을 다하겠습니다.",
        "wait_complaint": f"오래 기다리시게 해서 죄송합니다. {biz_placeholder}에서 대기 시간 단축을 위해 노력하겠습니다.",
        "other_complaint": f"불편을 드려 죄송합니다. {biz_placeholder}에서 더 나은 경험을 드릴 수 있도록 개선하겠습니다.",
    }


REPLY_TEMPLATES: dict[str, dict[str, dict[str, str]]] = {
    "restaurant": {
        "positive": _build_positive("음식", "서비스", "음식"),
        "neutral": _build_neutral(),
        "negative": _build_negative("음식 맛", "응대"),
    },
    "cafe": {
        "positive": {
            "food_praise": "커피·음료가 맛있으셨다니 정말 기쁩니다! {business_name}에서 더 맛있는 음료로 다시 찾아주세요.",
            "service_praise": "따뜻한 서비스에 만족하셨다니 감사합니다. {business_name} 모든 바리스타가 힘이 납니다!",
            "revisit_intent": "재방문 의사를 남겨주셔서 감사합니다. {business_name}에서 항상 반갑게 맞이하겠습니다.",
            "photo_praise": "멋진 사진 감사합니다! {business_name}의 음료가 더욱 빛나 보입니다.",
            "overall_praise": "소중한 리뷰 감사합니다! {business_name}에서 항상 최선을 다하겠습니다.",
        },
        "neutral": _build_neutral(),
        "negative": _build_negative("음료 품질", "응대"),
    },
    "bakery": {
        "positive": {
            "food_praise": "빵이 맛있으셨다니 정말 기쁩니다! {business_name}에서 더 맛있는 제품으로 다시 찾아주세요.",
            "service_praise": "친절한 응대에 만족하셨다니 감사합니다. {business_name} 모든 직원이 힘이 납니다!",
            "revisit_intent": "재방문 의사를 남겨주셔서 감사합니다. {business_name}에서 항상 반갑게 맞이하겠습니다.",
            "photo_praise": "멋진 사진 감사합니다! {business_name}의 제품이 더욱 맛있어 보입니다.",
            "overall_praise": "소중한 리뷰 감사합니다! {business_name}에서 항상 신선한 제품을 만들기 위해 최선을 다하겠습니다.",
        },
        "neutral": _build_neutral(),
        "negative": _build_negative("빵 품질", "응대"),
    },
    "bar": {
        "positive": {
            "food_praise": "음료와 안주가 만족스러우셨다니 정말 기쁩니다! {business_name}에서 더 즐거운 시간을 만들어 드리겠습니다.",
            "service_praise": "즐거운 서비스에 만족하셨다니 감사합니다. {business_name} 모든 직원이 힘이 납니다!",
            "revisit_intent": "재방문 의사를 남겨주셔서 감사합니다. {business_name}에서 항상 반갑게 맞이하겠습니다.",
            "photo_praise": "멋진 사진 감사합니다! {business_name}의 분위기가 더욱 빛나 보입니다.",
            "overall_praise": "소중한 리뷰 감사합니다! {business_name}에서 항상 최고의 경험을 제공하기 위해 노력하겠습니다.",
        },
        "neutral": _build_neutral(),
        "negative": _build_negative("음료·안주 품질", "응대"),
    },
    "beauty": {
        "positive": {
            "food_praise": "헤어 스타일이 마음에 드셨다니 정말 기쁩니다! {business_name}에서 더 멋진 스타일로 다시 찾아주세요.",
            "service_praise": "전문적인 시술에 만족하셨다니 감사합니다. {business_name} 모든 디자이너가 힘이 납니다!",
            "revisit_intent": "재방문 의사를 남겨주셔서 감사합니다. {business_name}에서 항상 반갑게 맞이하겠습니다.",
            "photo_praise": "멋진 스타일 사진 감사합니다! {business_name}의 기술이 더욱 빛나 보입니다.",
            "overall_praise": "소중한 리뷰 감사합니다! {business_name}에서 항상 최선을 다하겠습니다.",
        },
        "neutral": _build_neutral(),
        "negative": _build_negative("시술 품질", "응대"),
    },
    "nail": {
        "positive": {
            "food_praise": "네일 디자인이 마음에 드셨다니 정말 기쁩니다! {business_name}에서 더 예쁜 디자인으로 다시 찾아주세요.",
            "service_praise": "꼼꼼한 시술에 만족하셨다니 감사합니다. {business_name} 모든 네일리스트가 힘이 납니다!",
            "revisit_intent": "재방문 의사를 남겨주셔서 감사합니다. {business_name}에서 항상 반갑게 맞이하겠습니다.",
            "photo_praise": "예쁜 네일 사진 감사합니다! {business_name}의 디자인이 더욱 빛나 보입니다.",
            "overall_praise": "소중한 리뷰 감사합니다! {business_name}에서 항상 최선을 다하겠습니다.",
        },
        "neutral": _build_neutral(),
        "negative": _build_negative("시술 품질", "응대"),
    },
    "medical": {
        "positive": {
            "food_praise": "진료에 만족하셨다니 정말 기쁩니다! {business_name}에서 언제든 편하게 방문해 주세요.",
            "service_praise": "친절한 진료와 설명에 만족하셨다니 감사합니다. {business_name} 모든 의료진이 힘이 납니다!",
            "revisit_intent": "다시 방문해 주셔서 감사합니다. {business_name}에서 항상 건강을 위해 최선을 다하겠습니다.",
            "photo_praise": "감사한 후기 남겨주셔서 감사합니다. {business_name}의 서비스가 더욱 빛나 보입니다.",
            "overall_praise": "소중한 리뷰 감사합니다! {business_name}에서 환자분의 건강을 위해 항상 최선을 다하겠습니다.",
        },
        "neutral": _build_neutral(),
        "negative": _build_negative("진료 서비스", "응대"),
    },
    "pharmacy": {
        "positive": {
            "food_praise": "약사 상담이 도움이 되셨다니 정말 기쁩니다! {business_name}에서 항상 건강 관리를 도와드리겠습니다.",
            "service_praise": "친절한 상담에 만족하셨다니 감사합니다. {business_name} 모든 약사가 힘이 납니다!",
            "revisit_intent": "재방문 의사를 남겨주셔서 감사합니다. {business_name}에서 항상 반갑게 맞이하겠습니다.",
            "photo_praise": "감사한 후기 남겨주셔서 감사합니다. {business_name}의 서비스가 더욱 빛나 보입니다.",
            "overall_praise": "소중한 리뷰 감사합니다! {business_name}에서 고객님의 건강을 위해 최선을 다하겠습니다.",
        },
        "neutral": _build_neutral(),
        "negative": _build_negative("상담 서비스", "응대"),
    },
    "fitness": {
        "positive": {
            "food_praise": "트레이닝 효과에 만족하셨다니 정말 기쁩니다! {business_name}에서 목표 달성까지 함께 하겠습니다.",
            "service_praise": "전문적인 트레이닝에 만족하셨다니 감사합니다. {business_name} 모든 트레이너가 힘이 납니다!",
            "revisit_intent": "재방문 의사를 남겨주셔서 감사합니다. {business_name}에서 항상 반갑게 맞이하겠습니다.",
            "photo_praise": "멋진 운동 사진 감사합니다! {business_name}의 시설이 더욱 빛나 보입니다.",
            "overall_praise": "소중한 리뷰 감사합니다! {business_name}에서 항상 최선을 다하겠습니다.",
        },
        "neutral": _build_neutral(),
        "negative": _build_negative("트레이닝 품질", "응대"),
    },
    "yoga": {
        "positive": {
            "food_praise": "수업이 만족스러우셨다니 정말 기쁩니다! {business_name}에서 더 깊은 수련으로 함께 하겠습니다.",
            "service_praise": "전문적인 수업 지도에 만족하셨다니 감사합니다. {business_name} 모든 강사가 힘이 납니다!",
            "revisit_intent": "재방문 의사를 남겨주셔서 감사합니다. {business_name}에서 항상 반갑게 맞이하겠습니다.",
            "photo_praise": "아름다운 수련 사진 감사합니다! {business_name}의 공간이 더욱 빛나 보입니다.",
            "overall_praise": "소중한 리뷰 감사합니다! {business_name}에서 항상 최선을 다하겠습니다.",
        },
        "neutral": _build_neutral(),
        "negative": _build_negative("수업 품질", "응대"),
    },
    "pet": {
        "positive": {
            "food_praise": "반려동물이 만족스럽게 이용했다니 정말 기쁩니다! {business_name}에서 소중한 가족을 정성껏 돌보겠습니다.",
            "service_praise": "세심한 케어에 만족하셨다니 감사합니다. {business_name} 모든 직원이 힘이 납니다!",
            "revisit_intent": "재방문 의사를 남겨주셔서 감사합니다. {business_name}에서 항상 반갑게 맞이하겠습니다.",
            "photo_praise": "사랑스러운 사진 감사합니다! {business_name}의 서비스가 더욱 빛나 보입니다.",
            "overall_praise": "소중한 리뷰 감사합니다! {business_name}에서 소중한 반려동물을 위해 항상 최선을 다하겠습니다.",
        },
        "neutral": _build_neutral(),
        "negative": _build_negative("서비스 품질", "응대"),
    },
    "education": {
        "positive": {
            "food_praise": "수업이 도움이 되셨다니 정말 기쁩니다! {business_name}에서 더 큰 성장을 함께 하겠습니다.",
            "service_praise": "전문적인 교육에 만족하셨다니 감사합니다. {business_name} 모든 강사가 힘이 납니다!",
            "revisit_intent": "지속적인 수강에 감사드립니다. {business_name}에서 목표 달성까지 함께 하겠습니다.",
            "photo_praise": "수업 사진 남겨주셔서 감사합니다! {business_name}의 교육 환경이 더욱 빛나 보입니다.",
            "overall_praise": "소중한 리뷰 감사합니다! {business_name}에서 항상 최고의 교육을 제공하기 위해 노력하겠습니다.",
        },
        "neutral": _build_neutral(),
        "negative": _build_negative("수업 품질", "응대"),
    },
    "tutoring": {
        "positive": {
            "food_praise": "과외가 성적 향상에 도움이 되셨다니 정말 기쁩니다! {business_name}에서 목표 달성까지 함께 하겠습니다.",
            "service_praise": "열정적인 지도에 만족하셨다니 감사합니다. {business_name} 선생님이 힘이 납니다!",
            "revisit_intent": "지속적인 수업 의사를 남겨주셔서 감사합니다. {business_name}에서 항상 최선을 다하겠습니다.",
            "photo_praise": "감사한 후기 남겨주셔서 감사합니다! {business_name}의 지도가 더욱 빛나 보입니다.",
            "overall_praise": "소중한 리뷰 감사합니다! {business_name}에서 항상 최선을 다하겠습니다.",
        },
        "neutral": _build_neutral(),
        "negative": _build_negative("지도 품질", "소통"),
    },
    "legal": {
        "positive": {
            "food_praise": "법률 상담이 도움이 되셨다니 정말 기쁩니다! {business_name}에서 언제든 도움을 드리겠습니다.",
            "service_praise": "전문적인 법률 서비스에 만족하셨다니 감사합니다. {business_name} 모든 변호사가 힘이 납니다!",
            "revisit_intent": "다시 의뢰해 주셔서 감사합니다. {business_name}에서 항상 최선의 법률 서비스를 제공하겠습니다.",
            "photo_praise": "감사한 후기 남겨주셔서 감사합니다! {business_name}의 전문성이 더욱 빛나 보입니다.",
            "overall_praise": "소중한 리뷰 감사합니다! {business_name}에서 항상 최선을 다하겠습니다.",
        },
        "neutral": _build_neutral(),
        "negative": _build_negative("서비스 품질", "소통"),
    },
    "realestate": {
        "positive": {
            "food_praise": "원하시는 매물을 찾으셨다니 정말 기쁩니다! {business_name}에서 언제든 도움을 드리겠습니다.",
            "service_praise": "전문적인 중개 서비스에 만족하셨다니 감사합니다. {business_name} 모든 직원이 힘이 납니다!",
            "revisit_intent": "재이용 의사를 남겨주셔서 감사합니다. {business_name}에서 항상 반갑게 맞이하겠습니다.",
            "photo_praise": "감사한 후기 남겨주셔서 감사합니다! {business_name}의 전문성이 더욱 빛나 보입니다.",
            "overall_praise": "소중한 리뷰 감사합니다! {business_name}에서 항상 최선을 다하겠습니다.",
        },
        "neutral": _build_neutral(),
        "negative": _build_negative("중개 서비스", "소통"),
    },
    "interior": {
        "positive": {
            "food_praise": "인테리어 결과에 만족하셨다니 정말 기쁩니다! {business_name}에서 더 아름다운 공간을 만들어 드리겠습니다.",
            "service_praise": "꼼꼼한 시공에 만족하셨다니 감사합니다. {business_name} 모든 팀원이 힘이 납니다!",
            "revisit_intent": "재이용 의사를 남겨주셔서 감사합니다. {business_name}에서 항상 반갑게 맞이하겠습니다.",
            "photo_praise": "완성된 인테리어 사진 감사합니다! {business_name}의 작업이 더욱 빛나 보입니다.",
            "overall_praise": "소중한 리뷰 감사합니다! {business_name}에서 항상 최선을 다하겠습니다.",
        },
        "neutral": _build_neutral(),
        "negative": _build_negative("시공 품질", "소통"),
    },
    "auto": {
        "positive": {
            "food_praise": "정비 결과에 만족하셨다니 정말 기쁩니다! {business_name}에서 안전 운전을 위해 최선을 다하겠습니다.",
            "service_praise": "전문적인 정비에 만족하셨다니 감사합니다. {business_name} 모든 기술자가 힘이 납니다!",
            "revisit_intent": "재방문 의사를 남겨주셔서 감사합니다. {business_name}에서 항상 반갑게 맞이하겠습니다.",
            "photo_praise": "감사한 후기 남겨주셔서 감사합니다! {business_name}의 정비 기술이 더욱 빛나 보입니다.",
            "overall_praise": "소중한 리뷰 감사합니다! {business_name}에서 항상 최선을 다하겠습니다.",
        },
        "neutral": _build_neutral(),
        "negative": _build_negative("정비 품질", "응대"),
    },
    "cleaning": {
        "positive": {
            "food_praise": "청소 결과에 만족하셨다니 정말 기쁩니다! {business_name}에서 깨끗한 공간을 위해 최선을 다하겠습니다.",
            "service_praise": "꼼꼼한 청소 서비스에 만족하셨다니 감사합니다. {business_name} 모든 직원이 힘이 납니다!",
            "revisit_intent": "재이용 의사를 남겨주셔서 감사합니다. {business_name}에서 항상 반갑게 맞이하겠습니다.",
            "photo_praise": "깨끗해진 공간 사진 감사합니다! {business_name}의 서비스가 더욱 빛나 보입니다.",
            "overall_praise": "소중한 리뷰 감사합니다! {business_name}에서 항상 최선을 다하겠습니다.",
        },
        "neutral": _build_neutral(),
        "negative": _build_negative("청소 품질", "응대"),
    },
    "shopping": {
        "positive": {
            "food_praise": "상품에 만족하셨다니 정말 기쁩니다! {business_name}에서 더 좋은 제품으로 다시 찾아주세요.",
            "service_praise": "쇼핑 경험에 만족하셨다니 감사합니다. {business_name} 모든 직원이 힘이 납니다!",
            "revisit_intent": "재구매 의사를 남겨주셔서 감사합니다. {business_name}에서 항상 반갑게 맞이하겠습니다.",
            "photo_praise": "멋진 상품 사진 감사합니다! {business_name}의 제품이 더욱 빛나 보입니다.",
            "overall_praise": "소중한 리뷰 감사합니다! {business_name}에서 항상 최선을 다하겠습니다.",
        },
        "neutral": _build_neutral(),
        "negative": _build_negative("상품 품질", "응대"),
    },
    "fashion": {
        "positive": {
            "food_praise": "패션 아이템에 만족하셨다니 정말 기쁩니다! {business_name}에서 더 멋진 스타일로 다시 찾아주세요.",
            "service_praise": "전문적인 스타일링 서비스에 만족하셨다니 감사합니다. {business_name} 모든 직원이 힘이 납니다!",
            "revisit_intent": "재방문 의사를 남겨주셔서 감사합니다. {business_name}에서 항상 반갑게 맞이하겠습니다.",
            "photo_praise": "멋진 스타일 사진 감사합니다! {business_name}의 아이템이 더욱 빛나 보입니다.",
            "overall_praise": "소중한 리뷰 감사합니다! {business_name}에서 항상 최선을 다하겠습니다.",
        },
        "neutral": _build_neutral(),
        "negative": _build_negative("상품 품질", "응대"),
    },
    "photo": {
        "positive": {
            "food_praise": "촬영 결과물에 만족하셨다니 정말 기쁩니다! {business_name}에서 소중한 순간을 더 아름답게 담겠습니다.",
            "service_praise": "전문적인 촬영에 만족하셨다니 감사합니다. {business_name} 모든 작가가 힘이 납니다!",
            "revisit_intent": "재방문 의사를 남겨주셔서 감사합니다. {business_name}에서 항상 반갑게 맞이하겠습니다.",
            "photo_praise": "멋진 결과물 사진 감사합니다! {business_name}의 촬영 실력이 더욱 빛나 보입니다.",
            "overall_praise": "소중한 리뷰 감사합니다! {business_name}에서 항상 최선을 다하겠습니다.",
        },
        "neutral": _build_neutral(),
        "negative": _build_negative("촬영 품질", "응대"),
    },
    "video": {
        "positive": {
            "food_praise": "영상 제작 결과물에 만족하셨다니 정말 기쁩니다! {business_name}에서 더 멋진 영상을 제작해 드리겠습니다.",
            "service_praise": "전문적인 제작 서비스에 만족하셨다니 감사합니다. {business_name} 모든 팀원이 힘이 납니다!",
            "revisit_intent": "재의뢰 의사를 남겨주셔서 감사합니다. {business_name}에서 항상 반갑게 맞이하겠습니다.",
            "photo_praise": "완성된 영상 공유해 주셔서 감사합니다! {business_name}의 제작 능력이 더욱 빛나 보입니다.",
            "overall_praise": "소중한 리뷰 감사합니다! {business_name}에서 항상 최선을 다하겠습니다.",
        },
        "neutral": _build_neutral(),
        "negative": _build_negative("영상 품질", "소통"),
    },
    "design": {
        "positive": {
            "food_praise": "디자인 결과물에 만족하셨다니 정말 기쁩니다! {business_name}에서 브랜드를 더욱 빛나게 만들어 드리겠습니다.",
            "service_praise": "전문적인 디자인 서비스에 만족하셨다니 감사합니다. {business_name} 모든 디자이너가 힘이 납니다!",
            "revisit_intent": "재의뢰 의사를 남겨주셔서 감사합니다. {business_name}에서 항상 반갑게 맞이하겠습니다.",
            "photo_praise": "완성된 디자인 공유해 주셔서 감사합니다! {business_name}의 디자인이 더욱 빛나 보입니다.",
            "overall_praise": "소중한 리뷰 감사합니다! {business_name}에서 항상 최선을 다하겠습니다.",
        },
        "neutral": _build_neutral(),
        "negative": _build_negative("디자인 품질", "소통"),
    },
    "accommodation": {
        "positive": {
            "food_praise": "투숙이 만족스러우셨다니 정말 기쁩니다! {business_name}에서 다음 여행도 함께 하겠습니다.",
            "service_praise": "따뜻한 서비스에 만족하셨다니 감사합니다. {business_name} 모든 직원이 힘이 납니다!",
            "revisit_intent": "재방문 의사를 남겨주셔서 감사합니다. {business_name}에서 항상 반갑게 맞이하겠습니다.",
            "photo_praise": "멋진 숙소 사진 감사합니다! {business_name}의 시설이 더욱 빛나 보입니다.",
            "overall_praise": "소중한 리뷰 감사합니다! {business_name}에서 항상 편안한 숙박을 제공하기 위해 최선을 다하겠습니다.",
        },
        "neutral": _build_neutral(),
        "negative": _build_negative("시설·서비스", "응대"),
    },
    "other": {
        "positive": _build_positive("서비스", "응대", "서비스"),
        "neutral": _build_neutral(),
        "negative": _build_negative("서비스 품질", "응대"),
    },
}


def get_reply_templates(
    category: str,
    sentiment: str,
    business_name: str = "",
) -> list[dict]:
    """업종·감정별 답글 템플릿 반환 + {business_name} 치환.

    Args:
        category: 25개 업종 코드 (미등록 시 'other' 폴백)
        sentiment: 'positive' | 'neutral' | 'negative' (미등록 시 'neutral' 폴백)
        business_name: 사업장명 치환 (미입력 시 '저희 가게')

    Returns:
        list[dict]: pattern, text 포함 항목 목록
    """
    cat_templates = REPLY_TEMPLATES.get(category, REPLY_TEMPLATES["other"])
    sent_templates = cat_templates.get(sentiment, cat_templates["neutral"])
    _biz = business_name.strip() or "저희 가게"

    result = []
    for pattern, text in sent_templates.items():
        result.append(
            {
                "pattern": pattern,
                "text": text.replace("{business_name}", _biz),
            }
        )
    return result
