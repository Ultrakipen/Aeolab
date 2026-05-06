"""톡톡 채팅방 메뉴 업종별 템플릿 라이브러리.

25개 업종 × 5종 메뉴 타입 = 125개 정적 템플릿.
link_type: "message" | "url"
"""

# 메뉴 타입 5종
MENU_TYPES = ["reservation", "menu_recommendation", "parking", "event", "general"]

# 업종별 시그니처 키워드 (치환용 기본값)
_SIGNATURE_DEFAULTS: dict[str, str] = {
    "restaurant": "대표 메뉴",
    "cafe": "시그니처 음료",
    "bakery": "인기 빵",
    "bar": "추천 칵테일",
    "beauty": "헤어 스타일",
    "nail": "네일 디자인",
    "medical": "진료 서비스",
    "pharmacy": "건강 상담",
    "fitness": "트레이닝 프로그램",
    "yoga": "요가 클래스",
    "pet": "반려동물 서비스",
    "education": "수업 프로그램",
    "tutoring": "과외 과목",
    "legal": "법률 서비스",
    "realestate": "매물",
    "interior": "인테리어 스타일",
    "auto": "정비 서비스",
    "cleaning": "청소 서비스",
    "shopping": "추천 상품",
    "fashion": "추천 아이템",
    "photo": "촬영 패키지",
    "video": "영상 제작 서비스",
    "design": "디자인 서비스",
    "accommodation": "객실",
    "other": "주요 서비스",
}

TALKTALK_TEMPLATES: dict[str, dict[str, dict]] = {
    "restaurant": {
        "reservation": {
            "title": "예약 안내",
            "message": "{business_name} 예약 문의입니다. 방문 날짜와 인원을 알려주시면 빠르게 확인해 드리겠습니다.",
            "link_type": "message",
        },
        "menu_recommendation": {
            "title": "메뉴 추천",
            "message": "{business_name}의 {signature_menu}을(를) 강력 추천드립니다. 오늘의 추천 메뉴를 확인해보세요!",
            "link_type": "message",
        },
        "parking": {
            "title": "주차 안내",
            "message": "{business_name} 주차장 이용 안내입니다. 자세한 위치는 지도를 확인해 주세요.",
            "link_type": "message",
        },
        "event": {
            "title": "이벤트·할인",
            "message": "{business_name}의 현재 진행 중인 이벤트 및 할인 정보를 안내해 드립니다.",
            "link_type": "message",
        },
        "general": {
            "title": "일반 문의",
            "message": "{business_name}에 문의해 주셔서 감사합니다. 빠른 시간 내에 답변 드리겠습니다.",
            "link_type": "message",
        },
    },
    "cafe": {
        "reservation": {
            "title": "좌석 예약",
            "message": "{business_name} 좌석 예약 문의입니다. 방문 날짜·시간·인원을 알려주시면 확인 후 안내해 드리겠습니다.",
            "link_type": "message",
        },
        "menu_recommendation": {
            "title": "음료 추천",
            "message": "{business_name}의 {signature_menu}을(를) 추천드립니다. 계절 한정 메뉴도 확인해보세요!",
            "link_type": "message",
        },
        "parking": {
            "title": "주차 안내",
            "message": "{business_name} 주변 주차 안내입니다. 근처 공영주차장 이용을 권장드립니다.",
            "link_type": "message",
        },
        "event": {
            "title": "프로모션 안내",
            "message": "{business_name}의 현재 진행 중인 시즌 프로모션과 할인 정보를 안내해 드립니다.",
            "link_type": "message",
        },
        "general": {
            "title": "일반 문의",
            "message": "{business_name}에 문의해 주셔서 감사합니다. 영업시간 등 궁금한 사항을 말씀해 주세요.",
            "link_type": "message",
        },
    },
    "bakery": {
        "reservation": {
            "title": "케이크 예약",
            "message": "{business_name} 케이크·빵 사전 예약 문의입니다. 원하시는 제품과 픽업 날짜를 알려주세요.",
            "link_type": "message",
        },
        "menu_recommendation": {
            "title": "인기 빵 추천",
            "message": "{business_name}의 {signature_menu}은(는) 매일 완판되는 인기 제품입니다. 오늘의 신상도 확인해보세요!",
            "link_type": "message",
        },
        "parking": {
            "title": "주차 안내",
            "message": "{business_name} 주차 이용 안내입니다. 매장 앞 단기 주차 공간을 이용해 주세요.",
            "link_type": "message",
        },
        "event": {
            "title": "시즌 특선",
            "message": "{business_name}의 시즌 한정 특선 상품과 이벤트 정보를 안내해 드립니다.",
            "link_type": "message",
        },
        "general": {
            "title": "일반 문의",
            "message": "{business_name}에 문의해 주셔서 감사합니다. 재료·알레르기 정보 등 궁금한 사항을 말씀해 주세요.",
            "link_type": "message",
        },
    },
    "bar": {
        "reservation": {
            "title": "자리 예약",
            "message": "{business_name} 자리 예약 문의입니다. 방문 날짜·시간·인원을 알려주시면 안내해 드리겠습니다.",
            "link_type": "message",
        },
        "menu_recommendation": {
            "title": "추천 드링크",
            "message": "{business_name}의 {signature_menu}을(를) 추천드립니다. 오늘의 스페셜 칵테일도 확인해보세요!",
            "link_type": "message",
        },
        "parking": {
            "title": "교통 안내",
            "message": "{business_name} 방문 시 대중교통 이용을 권장드립니다. 인근 지하철역과 버스 노선을 안내해 드립니다.",
            "link_type": "message",
        },
        "event": {
            "title": "이벤트 안내",
            "message": "{business_name}의 현재 진행 중인 이벤트와 특별 공연 일정을 안내해 드립니다.",
            "link_type": "message",
        },
        "general": {
            "title": "일반 문의",
            "message": "{business_name}에 문의해 주셔서 감사합니다. 영업시간·드레스코드 등 궁금한 사항을 말씀해 주세요.",
            "link_type": "message",
        },
    },
    "beauty": {
        "reservation": {
            "title": "시술 예약",
            "message": "{business_name} 시술 예약 문의입니다. 원하시는 시술 종류와 방문 날짜·시간을 알려주세요.",
            "link_type": "message",
        },
        "menu_recommendation": {
            "title": "스타일 추천",
            "message": "{business_name}의 {signature_menu} 서비스를 추천드립니다. 모발 상태에 맞는 맞춤 시술을 제안해 드립니다.",
            "link_type": "message",
        },
        "parking": {
            "title": "주차 안내",
            "message": "{business_name} 주차 이용 안내입니다. 방문 전 주차 가능 여부를 확인해 주세요.",
            "link_type": "message",
        },
        "event": {
            "title": "이벤트·할인",
            "message": "{business_name}의 현재 진행 중인 프로모션과 신규 고객 할인 혜택을 안내해 드립니다.",
            "link_type": "message",
        },
        "general": {
            "title": "일반 문의",
            "message": "{business_name}에 문의해 주셔서 감사합니다. 모발 상담이나 시술 관련 궁금한 사항을 말씀해 주세요.",
            "link_type": "message",
        },
    },
    "nail": {
        "reservation": {
            "title": "네일 예약",
            "message": "{business_name} 네일 예약 문의입니다. 원하시는 디자인과 방문 날짜·시간을 알려주시면 확인해 드리겠습니다.",
            "link_type": "message",
        },
        "menu_recommendation": {
            "title": "디자인 추천",
            "message": "{business_name}의 {signature_menu}을(를) 추천드립니다. 이번 시즌 트렌드 디자인도 확인해보세요!",
            "link_type": "message",
        },
        "parking": {
            "title": "주차 안내",
            "message": "{business_name} 방문 시 주차 안내입니다. 인근 주차 공간 이용 방법을 안내해 드립니다.",
            "link_type": "message",
        },
        "event": {
            "title": "시즌 이벤트",
            "message": "{business_name}의 시즌 한정 디자인 이벤트와 할인 정보를 안내해 드립니다.",
            "link_type": "message",
        },
        "general": {
            "title": "일반 문의",
            "message": "{business_name}에 문의해 주셔서 감사합니다. 네일 관리·시술 관련 궁금한 사항을 말씀해 주세요.",
            "link_type": "message",
        },
    },
    "medical": {
        "reservation": {
            "title": "진료 예약",
            "message": "{business_name} 진료 예약 문의입니다. 원하시는 진료 날짜·시간과 증상을 간략히 알려주시면 안내해 드리겠습니다.",
            "link_type": "message",
        },
        "menu_recommendation": {
            "title": "진료과 안내",
            "message": "{business_name}의 {signature_menu}에 대해 안내해 드립니다. 전문 의료진이 친절하게 도와드립니다.",
            "link_type": "message",
        },
        "parking": {
            "title": "주차 안내",
            "message": "{business_name} 주차장 이용 안내입니다. 환자 분들을 위한 무료 주차 서비스를 제공합니다.",
            "link_type": "message",
        },
        "event": {
            "title": "건강 검진 안내",
            "message": "{business_name}의 건강 검진 패키지와 예방 접종 일정을 안내해 드립니다.",
            "link_type": "message",
        },
        "general": {
            "title": "일반 문의",
            "message": "{business_name}에 문의해 주셔서 감사합니다. 진료 관련 궁금한 사항을 말씀해 주세요.",
            "link_type": "message",
        },
    },
    "pharmacy": {
        "reservation": {
            "title": "상담 예약",
            "message": "{business_name} 약사 상담 예약 문의입니다. 상담 날짜·시간을 알려주시면 준비해 드리겠습니다.",
            "link_type": "message",
        },
        "menu_recommendation": {
            "title": "건강 상품 추천",
            "message": "{business_name}의 {signature_menu}을(를) 추천드립니다. 건강 상태에 맞는 제품을 안내해 드립니다.",
            "link_type": "message",
        },
        "parking": {
            "title": "주차 안내",
            "message": "{business_name} 주변 주차 안내입니다. 짧은 방문이시면 문 앞 잠깐 정차도 가능합니다.",
            "link_type": "message",
        },
        "event": {
            "title": "건강 이벤트",
            "message": "{business_name}의 건강 프로모션과 할인 행사 정보를 안내해 드립니다.",
            "link_type": "message",
        },
        "general": {
            "title": "일반 문의",
            "message": "{business_name}에 문의해 주셔서 감사합니다. 약품·건강 상품 관련 궁금한 사항을 말씀해 주세요.",
            "link_type": "message",
        },
    },
    "fitness": {
        "reservation": {
            "title": "트레이닝 예약",
            "message": "{business_name} PT·그룹 수업 예약 문의입니다. 원하시는 프로그램과 날짜·시간을 알려주세요.",
            "link_type": "message",
        },
        "menu_recommendation": {
            "title": "프로그램 추천",
            "message": "{business_name}의 {signature_menu}을(를) 추천드립니다. 목표에 맞는 맞춤 트레이닝을 제공합니다.",
            "link_type": "message",
        },
        "parking": {
            "title": "주차 안내",
            "message": "{business_name} 주차장 이용 안내입니다. 회원 전용 주차 공간을 제공합니다.",
            "link_type": "message",
        },
        "event": {
            "title": "이벤트·할인",
            "message": "{business_name}의 현재 진행 중인 신규 회원 혜택과 프로모션을 안내해 드립니다.",
            "link_type": "message",
        },
        "general": {
            "title": "일반 문의",
            "message": "{business_name}에 문의해 주셔서 감사합니다. 회원권·수업 관련 궁금한 사항을 말씀해 주세요.",
            "link_type": "message",
        },
    },
    "yoga": {
        "reservation": {
            "title": "클래스 예약",
            "message": "{business_name} 요가·필라테스 클래스 예약 문의입니다. 원하시는 수업과 날짜·시간을 알려주세요.",
            "link_type": "message",
        },
        "menu_recommendation": {
            "title": "클래스 추천",
            "message": "{business_name}의 {signature_menu}을(를) 추천드립니다. 수준에 맞는 최적의 클래스를 안내해 드립니다.",
            "link_type": "message",
        },
        "parking": {
            "title": "주차 안내",
            "message": "{business_name} 방문 시 주차 안내입니다. 인근 공영주차장 위치를 안내해 드립니다.",
            "link_type": "message",
        },
        "event": {
            "title": "이벤트 안내",
            "message": "{business_name}의 신규 회원 체험 이벤트와 특별 클래스 일정을 안내해 드립니다.",
            "link_type": "message",
        },
        "general": {
            "title": "일반 문의",
            "message": "{business_name}에 문의해 주셔서 감사합니다. 수업 난이도·준비물 등 궁금한 사항을 말씀해 주세요.",
            "link_type": "message",
        },
    },
    "pet": {
        "reservation": {
            "title": "펫 서비스 예약",
            "message": "{business_name} 반려동물 서비스 예약 문의입니다. 반려동물 종류·크기와 원하시는 날짜·시간을 알려주세요.",
            "link_type": "message",
        },
        "menu_recommendation": {
            "title": "서비스 추천",
            "message": "{business_name}의 {signature_menu}을(를) 추천드립니다. 반려동물에게 최적화된 서비스를 제공합니다.",
            "link_type": "message",
        },
        "parking": {
            "title": "주차 안내",
            "message": "{business_name} 방문 시 주차 안내입니다. 반려동물과 함께 편하게 방문해 주세요.",
            "link_type": "message",
        },
        "event": {
            "title": "이벤트 안내",
            "message": "{business_name}의 반려동물 이벤트와 시즌 할인 정보를 안내해 드립니다.",
            "link_type": "message",
        },
        "general": {
            "title": "일반 문의",
            "message": "{business_name}에 문의해 주셔서 감사합니다. 반려동물 서비스 관련 궁금한 사항을 말씀해 주세요.",
            "link_type": "message",
        },
    },
    "education": {
        "reservation": {
            "title": "수업 상담 예약",
            "message": "{business_name} 수업 상담 예약 문의입니다. 학생 학년·희망 과목과 상담 날짜를 알려주세요.",
            "link_type": "message",
        },
        "menu_recommendation": {
            "title": "수업 추천",
            "message": "{business_name}의 {signature_menu}을(를) 추천드립니다. 학생 수준에 맞는 맞춤 커리큘럼을 제공합니다.",
            "link_type": "message",
        },
        "parking": {
            "title": "주차·위치 안내",
            "message": "{business_name} 방문 안내입니다. 대중교통 이용 시 가장 가까운 정류장을 안내해 드립니다.",
            "link_type": "message",
        },
        "event": {
            "title": "입학 이벤트",
            "message": "{business_name}의 신규 등록 혜택과 무료 체험 수업 일정을 안내해 드립니다.",
            "link_type": "message",
        },
        "general": {
            "title": "일반 문의",
            "message": "{business_name}에 문의해 주셔서 감사합니다. 수업료·시간표 등 궁금한 사항을 말씀해 주세요.",
            "link_type": "message",
        },
    },
    "tutoring": {
        "reservation": {
            "title": "과외 상담 예약",
            "message": "{business_name} 과외 상담 예약 문의입니다. 학생 학년·과목·원하는 수업 스타일을 알려주세요.",
            "link_type": "message",
        },
        "menu_recommendation": {
            "title": "과목 추천",
            "message": "{business_name}의 {signature_menu} 과외를 추천드립니다. 1:1 맞춤 지도로 효율적인 학습을 돕겠습니다.",
            "link_type": "message",
        },
        "parking": {
            "title": "방문 수업 안내",
            "message": "{business_name}에서는 방문 과외 또는 온라인 수업도 가능합니다. 수업 방식을 말씀해 주세요.",
            "link_type": "message",
        },
        "event": {
            "title": "특별 혜택 안내",
            "message": "{business_name}의 신규 학생 첫 달 혜택과 패키지 할인 정보를 안내해 드립니다.",
            "link_type": "message",
        },
        "general": {
            "title": "일반 문의",
            "message": "{business_name}에 문의해 주셔서 감사합니다. 과외 비용·시간·방식 관련 궁금한 사항을 말씀해 주세요.",
            "link_type": "message",
        },
    },
    "legal": {
        "reservation": {
            "title": "법률 상담 예약",
            "message": "{business_name} 법률 상담 예약 문의입니다. 상담 분야와 희망 날짜·시간을 알려주시면 안내해 드리겠습니다.",
            "link_type": "message",
        },
        "menu_recommendation": {
            "title": "전문 분야 안내",
            "message": "{business_name}의 {signature_menu} 서비스를 안내해 드립니다. 풍부한 경험의 전문 변호사가 도와드립니다.",
            "link_type": "message",
        },
        "parking": {
            "title": "주차 안내",
            "message": "{business_name} 방문 시 주차 안내입니다. 건물 내 주차장 이용 방법을 안내해 드립니다.",
            "link_type": "message",
        },
        "event": {
            "title": "무료 상담 안내",
            "message": "{business_name}의 초회 무료 법률 상담 혜택을 안내해 드립니다.",
            "link_type": "message",
        },
        "general": {
            "title": "일반 문의",
            "message": "{business_name}에 문의해 주셔서 감사합니다. 법률 서비스 관련 궁금한 사항을 말씀해 주세요.",
            "link_type": "message",
        },
    },
    "realestate": {
        "reservation": {
            "title": "상담 예약",
            "message": "{business_name} 부동산 상담 예약 문의입니다. 관심 지역·매물 종류와 방문 날짜를 알려주세요.",
            "link_type": "message",
        },
        "menu_recommendation": {
            "title": "추천 매물",
            "message": "{business_name}의 {signature_menu} 매물을 추천드립니다. 조건에 맞는 맞춤 매물을 찾아드립니다.",
            "link_type": "message",
        },
        "parking": {
            "title": "방문 안내",
            "message": "{business_name} 방문 시 주차 안내입니다. 사무실 위치 및 교통편을 안내해 드립니다.",
            "link_type": "message",
        },
        "event": {
            "title": "신규 매물 안내",
            "message": "{business_name}의 신규 등록 매물과 특가 매물 정보를 안내해 드립니다.",
            "link_type": "message",
        },
        "general": {
            "title": "일반 문의",
            "message": "{business_name}에 문의해 주셔서 감사합니다. 매매·임대·전세 관련 궁금한 사항을 말씀해 주세요.",
            "link_type": "message",
        },
    },
    "interior": {
        "reservation": {
            "title": "상담 예약",
            "message": "{business_name} 인테리어 상담 예약 문의입니다. 공간 종류·면적·희망 스타일과 방문 날짜를 알려주세요.",
            "link_type": "message",
        },
        "menu_recommendation": {
            "title": "스타일 추천",
            "message": "{business_name}의 {signature_menu} 인테리어를 추천드립니다. 공간에 맞는 최적의 디자인을 제안합니다.",
            "link_type": "message",
        },
        "parking": {
            "title": "쇼룸 방문 안내",
            "message": "{business_name} 쇼룸 방문 안내입니다. 주차 공간과 위치를 안내해 드립니다.",
            "link_type": "message",
        },
        "event": {
            "title": "시공 이벤트",
            "message": "{business_name}의 시즌 할인 시공 이벤트와 무료 상담 혜택을 안내해 드립니다.",
            "link_type": "message",
        },
        "general": {
            "title": "일반 문의",
            "message": "{business_name}에 문의해 주셔서 감사합니다. 시공 기간·비용·자재 관련 궁금한 사항을 말씀해 주세요.",
            "link_type": "message",
        },
    },
    "auto": {
        "reservation": {
            "title": "정비 예약",
            "message": "{business_name} 차량 정비 예약 문의입니다. 차종·정비 항목과 방문 날짜를 알려주시면 준비해 드리겠습니다.",
            "link_type": "message",
        },
        "menu_recommendation": {
            "title": "정비 서비스 추천",
            "message": "{business_name}의 {signature_menu}을(를) 추천드립니다. 차량 상태에 맞는 최적의 정비를 제공합니다.",
            "link_type": "message",
        },
        "parking": {
            "title": "입고 안내",
            "message": "{business_name} 입고 안내입니다. 차량 입고 방법 및 대기 시간을 안내해 드립니다.",
            "link_type": "message",
        },
        "event": {
            "title": "정비 이벤트",
            "message": "{business_name}의 정기 점검 할인 이벤트와 무료 진단 서비스를 안내해 드립니다.",
            "link_type": "message",
        },
        "general": {
            "title": "일반 문의",
            "message": "{business_name}에 문의해 주셔서 감사합니다. 차량 정비 관련 궁금한 사항을 말씀해 주세요.",
            "link_type": "message",
        },
    },
    "cleaning": {
        "reservation": {
            "title": "청소 예약",
            "message": "{business_name} 청소 서비스 예약 문의입니다. 청소 공간·면적·희망 날짜를 알려주시면 견적을 안내해 드리겠습니다.",
            "link_type": "message",
        },
        "menu_recommendation": {
            "title": "서비스 추천",
            "message": "{business_name}의 {signature_menu}을(를) 추천드립니다. 공간에 맞는 맞춤 청소 솔루션을 제공합니다.",
            "link_type": "message",
        },
        "parking": {
            "title": "방문 안내",
            "message": "{business_name} 방문 청소 서비스 안내입니다. 작업 전 주차 및 출입 방법을 안내해 드립니다.",
            "link_type": "message",
        },
        "event": {
            "title": "할인 이벤트",
            "message": "{business_name}의 신규 고객 할인 혜택과 정기 계약 특가를 안내해 드립니다.",
            "link_type": "message",
        },
        "general": {
            "title": "일반 문의",
            "message": "{business_name}에 문의해 주셔서 감사합니다. 청소 범위·시간·비용 관련 궁금한 사항을 말씀해 주세요.",
            "link_type": "message",
        },
    },
    "shopping": {
        "reservation": {
            "title": "구매 상담",
            "message": "{business_name} 구매 상담 문의입니다. 원하시는 상품과 수량을 알려주시면 상세히 안내해 드리겠습니다.",
            "link_type": "message",
        },
        "menu_recommendation": {
            "title": "상품 추천",
            "message": "{business_name}의 {signature_menu}을(를) 추천드립니다. 고객님의 니즈에 맞는 최적의 상품을 찾아드립니다.",
            "link_type": "message",
        },
        "parking": {
            "title": "주차 안내",
            "message": "{business_name} 방문 시 주차 안내입니다. 무료 주차 서비스를 제공하고 있습니다.",
            "link_type": "message",
        },
        "event": {
            "title": "할인 이벤트",
            "message": "{business_name}의 현재 진행 중인 할인 이벤트와 기획전 정보를 안내해 드립니다.",
            "link_type": "message",
        },
        "general": {
            "title": "일반 문의",
            "message": "{business_name}에 문의해 주셔서 감사합니다. 상품·배송·교환·환불 관련 궁금한 사항을 말씀해 주세요.",
            "link_type": "message",
        },
    },
    "fashion": {
        "reservation": {
            "title": "스타일링 예약",
            "message": "{business_name} 퍼스널 스타일링 예약 문의입니다. 방문 날짜·시간을 알려주시면 전담 스타일리스트를 배정해 드립니다.",
            "link_type": "message",
        },
        "menu_recommendation": {
            "title": "아이템 추천",
            "message": "{business_name}의 {signature_menu}을(를) 추천드립니다. 이번 시즌 트렌드 아이템도 확인해보세요!",
            "link_type": "message",
        },
        "parking": {
            "title": "주차 안내",
            "message": "{business_name} 방문 시 주차 안내입니다. 주차 지원 서비스를 이용해 주세요.",
            "link_type": "message",
        },
        "event": {
            "title": "시즌 세일",
            "message": "{business_name}의 시즌 세일과 신상품 출시 이벤트를 안내해 드립니다.",
            "link_type": "message",
        },
        "general": {
            "title": "일반 문의",
            "message": "{business_name}에 문의해 주셔서 감사합니다. 사이즈·재고·교환 관련 궁금한 사항을 말씀해 주세요.",
            "link_type": "message",
        },
    },
    "photo": {
        "reservation": {
            "title": "촬영 예약",
            "message": "{business_name} 촬영 예약 문의입니다. 촬영 목적·인원과 희망 날짜를 알려주시면 상세히 안내해 드리겠습니다.",
            "link_type": "message",
        },
        "menu_recommendation": {
            "title": "패키지 추천",
            "message": "{business_name}의 {signature_menu}을(를) 추천드립니다. 목적에 맞는 최적의 촬영 패키지를 제안합니다.",
            "link_type": "message",
        },
        "parking": {
            "title": "스튜디오 안내",
            "message": "{business_name} 스튜디오 방문 안내입니다. 주차 공간 및 위치를 안내해 드립니다.",
            "link_type": "message",
        },
        "event": {
            "title": "촬영 이벤트",
            "message": "{business_name}의 시즌 촬영 이벤트와 할인 패키지를 안내해 드립니다.",
            "link_type": "message",
        },
        "general": {
            "title": "일반 문의",
            "message": "{business_name}에 문의해 주셔서 감사합니다. 촬영 준비물·보정·결과물 제공 방식 관련 궁금한 사항을 말씀해 주세요.",
            "link_type": "message",
        },
    },
    "video": {
        "reservation": {
            "title": "제작 상담 예약",
            "message": "{business_name} 영상 제작 상담 예약 문의입니다. 제작 목적·분량·희망 스타일과 일정을 알려주세요.",
            "link_type": "message",
        },
        "menu_recommendation": {
            "title": "제작 서비스 추천",
            "message": "{business_name}의 {signature_menu}을(를) 추천드립니다. 브랜드에 맞는 맞춤 영상을 제작해 드립니다.",
            "link_type": "message",
        },
        "parking": {
            "title": "스튜디오 방문 안내",
            "message": "{business_name} 스튜디오 방문 안내입니다. 주차 및 위치 정보를 안내해 드립니다.",
            "link_type": "message",
        },
        "event": {
            "title": "제작 패키지 이벤트",
            "message": "{business_name}의 시즌 영상 제작 패키지 할인 이벤트를 안내해 드립니다.",
            "link_type": "message",
        },
        "general": {
            "title": "일반 문의",
            "message": "{business_name}에 문의해 주셔서 감사합니다. 제작 기간·비용·수정 정책 관련 궁금한 사항을 말씀해 주세요.",
            "link_type": "message",
        },
    },
    "design": {
        "reservation": {
            "title": "디자인 상담 예약",
            "message": "{business_name} 디자인 상담 예약 문의입니다. 프로젝트 종류·예산·일정을 알려주시면 안내해 드리겠습니다.",
            "link_type": "message",
        },
        "menu_recommendation": {
            "title": "서비스 추천",
            "message": "{business_name}의 {signature_menu}을(를) 추천드립니다. 브랜드 아이덴티티에 맞는 최적의 디자인을 제안합니다.",
            "link_type": "message",
        },
        "parking": {
            "title": "방문 안내",
            "message": "{business_name} 방문 미팅 안내입니다. 사무소 위치 및 주차 정보를 안내해 드립니다.",
            "link_type": "message",
        },
        "event": {
            "title": "패키지 이벤트",
            "message": "{business_name}의 스타트업·소상공인 특별 디자인 패키지 이벤트를 안내해 드립니다.",
            "link_type": "message",
        },
        "general": {
            "title": "일반 문의",
            "message": "{business_name}에 문의해 주셔서 감사합니다. 작업 기간·수정 횟수·저작권 관련 궁금한 사항을 말씀해 주세요.",
            "link_type": "message",
        },
    },
    "accommodation": {
        "reservation": {
            "title": "객실 예약",
            "message": "{business_name} 객실 예약 문의입니다. 체크인 날짜·박수·인원을 알려주시면 빠르게 확인해 드리겠습니다.",
            "link_type": "message",
        },
        "menu_recommendation": {
            "title": "객실 추천",
            "message": "{business_name}의 {signature_menu}을(를) 추천드립니다. 여행 목적에 맞는 최적의 객실을 안내해 드립니다.",
            "link_type": "message",
        },
        "parking": {
            "title": "주차·교통 안내",
            "message": "{business_name} 주차장 이용 안내입니다. 체크인 시 무료 주차 서비스를 제공합니다.",
            "link_type": "message",
        },
        "event": {
            "title": "패키지 이벤트",
            "message": "{business_name}의 시즌 패키지 상품과 얼리버드 할인 혜택을 안내해 드립니다.",
            "link_type": "message",
        },
        "general": {
            "title": "일반 문의",
            "message": "{business_name}에 문의해 주셔서 감사합니다. 체크인·체크아웃·부대 시설 관련 궁금한 사항을 말씀해 주세요.",
            "link_type": "message",
        },
    },
    "other": {
        "reservation": {
            "title": "예약·상담 안내",
            "message": "{business_name} 예약·상담 문의입니다. 서비스 종류와 희망 날짜·시간을 알려주시면 안내해 드리겠습니다.",
            "link_type": "message",
        },
        "menu_recommendation": {
            "title": "서비스 추천",
            "message": "{business_name}의 {signature_menu}을(를) 추천드립니다. 니즈에 맞는 최적의 서비스를 안내해 드립니다.",
            "link_type": "message",
        },
        "parking": {
            "title": "방문 안내",
            "message": "{business_name} 방문 안내입니다. 위치 및 주차 정보를 안내해 드립니다.",
            "link_type": "message",
        },
        "event": {
            "title": "이벤트·할인",
            "message": "{business_name}의 현재 진행 중인 이벤트와 혜택을 안내해 드립니다.",
            "link_type": "message",
        },
        "general": {
            "title": "일반 문의",
            "message": "{business_name}에 문의해 주셔서 감사합니다. 서비스 관련 궁금한 사항을 말씀해 주세요.",
            "link_type": "message",
        },
    },
}


def get_templates(
    category: str,
    business_name: str = "",
    signature_menu: str = "",
) -> list[dict]:
    """업종별 채팅방 메뉴 템플릿 반환 + 변수 치환.

    Args:
        category: 25개 업종 코드 (미등록 업종은 'other' 폴백)
        business_name: 사업장명 치환 (미입력 시 '매장')
        signature_menu: 대표 상품·서비스명 치환 (미입력 시 업종별 기본값)

    Returns:
        list[dict]: type, title, message, link_type 포함 5개 항목
    """
    templates = TALKTALK_TEMPLATES.get(category, TALKTALK_TEMPLATES["other"])
    _biz = business_name.strip() or "매장"
    _sig = signature_menu.strip() or _SIGNATURE_DEFAULTS.get(category, "주요 서비스")

    result = []
    for menu_type, tpl in templates.items():
        msg = (
            tpl["message"]
            .replace("{business_name}", _biz)
            .replace("{signature_menu}", _sig)
        )
        result.append(
            {
                "type": menu_type,
                "title": tpl["title"],
                "message": msg,
                "link_type": tpl["link_type"],
            }
        )
    return result
