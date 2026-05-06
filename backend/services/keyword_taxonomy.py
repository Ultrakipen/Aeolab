"""
업종별 상황 키워드 분류 체계
모델 엔진 명세서 v1.0 § 02 기준

이 분류 체계가 AEOlab의 핵심 데이터 자산입니다.
네이버 AI 브리핑은 리뷰에서 이 카테고리의 키워드를 추출해 조건 검색에 활용합니다.
업종 추가 시 반드시 이 파일에 먼저 정의 후 개발 적용.
"""

from typing import TypedDict


class KeywordCategory(TypedDict):
    keywords: list[str]
    weight: float
    condition_search_example: str


# DB 카테고리 값 → taxonomy 키 정규화
_CATEGORY_ALIASES: dict[str, str] = {
    # 음식점 (카페는 별도 분류)
    "restaurant": "restaurant", "food": "restaurant",
    "음식점": "restaurant", "맛집": "restaurant",
    "한식": "restaurant", "중식": "restaurant", "일식": "restaurant",
    "양식": "restaurant", "분식": "restaurant", "치킨": "restaurant",
    # 카페 (음식점과 구분 — 분위기·공간·음료 중심)
    "cafe": "cafe", "카페": "cafe",
    # 미용·뷰티
    "beauty": "beauty", "hair": "beauty", "salon": "beauty",
    "미용": "beauty", "미용실": "beauty", "뷰티": "beauty",
    "네일": "beauty", "피부": "beauty",
    # 병원·한의원
    "clinic": "medical", "hospital": "medical", "medical": "medical",
    "병원": "medical", "한의원": "medical", "치과": "medical",
    "의원": "medical", "약국": "medical",
    # 학원·교육
    "academy": "academy", "education": "academy", "tutoring": "academy",
    "학원": "academy", "교육": "academy", "과외": "academy",
    # 음악·예체능 교습소 (학원과 구분 — 원어민 키워드 오추천 방지)
    "music": "music", "음악": "music", "음악교습소": "music", "음악학원": "music",
    "피아노": "music", "피아노학원": "music", "피아노교습소": "music",
    "바이올린": "music", "첼로": "music", "기타": "music", "드럼": "music",
    "보컬": "music", "성악": "music", "실용음악": "music", "작곡": "music",
    "미술": "music", "미술학원": "music", "미술교습소": "music",
    "발레": "music", "무용": "music", "댄스": "music",
    # 법률·세무
    "legal": "legal", "lawyer": "legal", "tax": "legal", "accounting": "legal",
    "법률": "legal", "세무": "legal", "변호사": "legal", "회계": "legal",
    # 쇼핑몰·온라인
    "shop": "shopping", "shopping": "shopping", "online": "shopping",
    "쇼핑몰": "shopping", "온라인": "shopping", "이커머스": "shopping",
    # 카페 추가 별칭
    "coffee": "cafe", "coffeeshop": "cafe", "커피숍": "cafe", "디저트카페": "cafe",
    # 헬스장·피트니스
    "fitness": "fitness", "gym": "fitness", "pilates": "fitness", "yoga": "fitness",
    "헬스": "fitness", "헬스장": "fitness", "피트니스": "fitness",
    "필라테스": "fitness", "요가": "fitness", "pt": "fitness",
    # 반려동물
    "pet": "pet", "petshop": "pet", "vet": "pet", "grooming": "pet",
    "반려동물": "pet", "펫샵": "pet", "동물병원": "pet", "반려견": "pet", "반려묘": "pet",
    # 사진
    "photo": "photo", "사진": "photo", "사진관": "photo", "스튜디오": "photo",
    "웨딩스튜디오": "photo", "프로필사진": "photo",
    # 영상
    "video": "video", "영상": "video", "영상제작": "video", "드론": "video",
    "유튜브": "video", "광고영상": "video",
    # 디자인
    "design": "design", "디자인": "design", "그래픽": "design", "인쇄": "design",
    "로고": "design", "브랜딩": "design", "명함": "design",
    # 전문직·기타 서비스 (professional → 업종별 세분화)
    # 사진·영상 관련
    "professional": "photo",          # 기본: 사진/스튜디오로 분류 (전문직 중 가장 많은 비중)
    "웨딩": "photo", "스냅": "photo", "촬영": "photo",
    "사진작가": "photo", "웨딩스냅": "photo", "돌스냅": "photo",
    # 숙박
    "accommodation": "accommodation", "숙박": "accommodation",
    "펜션": "accommodation", "모텔": "accommodation", "호텔": "accommodation",
    # 생활서비스
    "living": "living", "세탁": "living",
    "이사": "living", "청소": "living",
    # ── 폼 25개 업종 추가 매핑 (2026-04-23) ──
    # 음식 계열 alias
    "bakery": "cafe", "베이커리": "cafe", "빵집": "cafe", "디저트": "cafe",
    "bar": "restaurant", "주점": "restaurant", "술집": "restaurant", "포차": "restaurant",
    # 미용 alias
    "nail": "beauty", "네일아트": "beauty", "네일샵": "beauty",
    # 약국 (신규 dict)
    "pharmacy": "pharmacy", "약사": "pharmacy",
    # 부동산 (신규 dict)
    "realestate": "realestate", "부동산": "realestate", "공인중개사": "realestate",
    "매매": "realestate", "임대": "realestate", "전세": "realestate",
    # 인테리어 (신규 dict — 기존 "인테리어" living alias 대체)
    "interior": "interior", "인테리어": "interior", "리모델링": "interior", "시공": "interior",
    # 자동차 (신규 dict)
    "auto": "auto", "자동차": "auto", "정비소": "auto", "카센터": "auto", "수리": "auto",
    # 청소 alias
    "cleaning": "living",
    # 패션 alias (쇼핑몰 분류)
    "fashion": "shopping", "패션": "shopping", "의류": "shopping", "옷": "shopping",
    # 기타 (default fallback)
    "other": "restaurant", "기타": "restaurant",
}

# 업종별 상황 키워드 분류 체계 (모델 엔진 명세서 v1.0 § 02)
KEYWORD_TAXONOMY: dict[str, dict[str, KeywordCategory]] = {

    # § 2.1 음식점·카페
    # 접근편의(0.15) + 단체모임(0.20) + 분위기상황(0.15) + 동반자조건(0.20) + 메뉴특장점(0.15) + 운영정보(0.10) + ai_tab_context(0.05) = 1.0
    "restaurant": {
        "접근편의": {
            "keywords": ["주차 가능", "주차 무료", "발렛 서비스", "지하철 도보 3분", "휠체어 접근 가능", "대중교통 편리"],
            "weight": 0.15,
            "condition_search_example": "강남 식당 주차 가능",
        },
        "단체모임": {
            "keywords": ["단체 예약 가능", "회식 장소", "프라이빗룸", "생일 파티 가능", "기업 행사 가능", "30명 수용"],
            "weight": 0.20,
            "condition_search_example": "을지로 회식 단체 예약",
        },
        "분위기상황": {
            "keywords": ["비즈니스 미팅 적합", "데이트 분위기", "조용한 분위기", "루프탑 있음", "야외석 있음", "뷰 좋음"],
            "weight": 0.15,
            "condition_search_example": "신촌 맛집 비즈니스 미팅",
        },
        "동반자조건": {
            "keywords": ["반려견 동반 가능", "유아 의자 있음", "키즈존", "혼밥 가능", "1인석 있음", "노키즈존"],
            "weight": 0.20,
            "condition_search_example": "홍대 카페 반려견 동반",
        },
        "메뉴특장점": {
            "keywords": ["가성비 좋음", "점심 특선", "브런치 메뉴", "채식 옵션 있음", "글루텐프리", "수제"],
            "weight": 0.15,
            "condition_search_example": "종로 채식 맛집",
        },
        "운영정보": {
            "keywords": ["당일 예약 가능", "포장 가능", "배달 가능", "심야 영업", "예약 필수", "웨이팅 있음"],
            "weight": 0.10,
            "condition_search_example": "홍대 심야 식당",
        },
        "ai_tab_context": {
            "keywords": [
                "테이블 간격 넓음", "조용한 분위기", "1인 좌석", "단체석 가능",
                "노트북 작업 가능", "콘센트 자리", "어린이 동반 가능",
                "데이트 추천", "비즈니스 미팅 적합", "혼밥 환경",
                "평일 저녁 한산", "주말 점심 붐빔",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 평일 저녁 데이트 분위기 식당",
        },
    },

    # § 2.2 미용실·뷰티
    "beauty": {
        "접근편의": {
            "keywords": ["주차 가능", "지하철 도보", "당일 예약 가능", "무료 주차", "365일 영업"],
            "weight": 0.15,
            "condition_search_example": "강남 미용실 당일 예약",
        },
        "전문시술": {
            "keywords": ["염색 전문", "탈모 케어", "두피 관리", "웨딩 전문", "남성 전문", "외국인 가능"],
            "weight": 0.25,
            "condition_search_example": "강남 탈모 두피 미용실",
        },
        "공간분위기": {
            "keywords": ["프라이빗 공간", "1:1 전담 관리", "개인실 있음", "조용한 분위기", "인테리어 예쁨"],
            "weight": 0.15,
            "condition_search_example": "신사 프라이빗 미용실",
        },
        "운영조건": {
            "keywords": ["야간 영업", "일요일 영업", "당일 예약 가능", "정기권 있음", "홈케어 서비스"],
            "weight": 0.20,
            "condition_search_example": "홍대 야간 미용실",
        },
        "가격혜택": {
            "keywords": ["합리적 가격", "첫방문 이벤트", "학생 할인", "멤버십 혜택", "신규 할인"],
            "weight": 0.10,
            "condition_search_example": "강남 미용실 신규 할인",
        },
        "시술결과": {
            "keywords": ["자연스러운 결과", "모발 손상 없음", "오래 지속됨", "재방문 의향 높음"],
            "weight": 0.10,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "프라이빗 룸 있음", "1인 전담 관리", "여성 전용", "남성 전용",
                "당일 예약 가능", "예약 없이 방문", "주차 편리", "아이 동반 가능",
                "조용한 상담", "카드 결제 가능",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 프라이빗 여성 전용 미용실",
        },
    },

    # § 2.3 병원·한의원
    "clinic": {
        "접근편의": {
            "keywords": ["주차 가능", "지하철 도보", "주차 무료", "장애인 접근", "대중교통 편리"],
            "weight": 0.15,
            "condition_search_example": "강남 정형외과 주차 가능",
        },
        "전문성": {
            "keywords": ["전문의 직접 진료", "해당 질환 전문", "장비 최신화", "학회 인증", "논문 게재 의사"],
            "weight": 0.30,
            "condition_search_example": "강남 허리디스크 전문 병원",
        },
        "진료경험": {
            "keywords": ["친절한 설명", "대기 없음", "충분한 상담 시간", "초진 꼼꼼히", "재진율 높음"],
            "weight": 0.25,
            "condition_search_example": "강남 친절한 내과",
        },
        "운영정보": {
            "keywords": ["야간 진료", "주말 진료", "당일 예약 가능", "야간 응급", "비급여 안내"],
            "weight": 0.20,
            "condition_search_example": "강남 야간 진료 내과",
        },
        "비용보험": {
            "keywords": ["비용 합리적", "건강보험 적용", "비급여 투명 공개", "카드 결제 가능"],
            "weight": 0.10,
            "condition_search_example": "",
        },
    },

    # § 2.4 학원·교육
    "academy": {
        "접근편의": {
            "keywords": ["주차 가능", "지하철 도보", "셔틀버스 운행", "야간 수업"],
            "weight": 0.15,
            "condition_search_example": "강남 영어학원 주차",
        },
        "교육전문성": {
            "keywords": ["입시 전문", "1:1 맞춤", "소수정예", "레벨테스트", "국가 자격증", "전문 강사"],
            "weight": 0.35,
            "condition_search_example": "강남 수학 전문 학원",
        },
        "대상조건": {
            "keywords": ["성인 가능", "직장인 반", "주말 수업", "초등 전문", "온라인 병행", "시험 대비"],
            "weight": 0.25,
            "condition_search_example": "강남 직장인 영어 학원",
        },
        "운영정보": {
            "keywords": ["체험 수업 가능", "환불 정책 명확", "진도 관리", "학부모 상담"],
            "weight": 0.15,
            "condition_search_example": "",
        },
        "성과결과": {
            "keywords": ["합격률 높음", "성적 향상 사례", "졸업생 후기", "포트폴리오 있음"],
            "weight": 0.10,
            "condition_search_example": "",
        },
    },

    # § 2.4-B 음악·예체능 교습소
    "music": {
        "접근편의": {
            "keywords": ["주차 가능", "지하철 도보", "주차 무료", "셔틀버스"],
            "weight": 0.10,
            "condition_search_example": "강남 피아노학원 주차",
        },
        "레슨전문성": {
            "keywords": ["1:1 개인 레슨", "소수정예", "콩쿠르 수상 강사", "전공자 강사", "입시 전문", "레벨테스트"],
            "weight": 0.25,
            "condition_search_example": "강남 피아노 1대1 레슨",
        },
        "대상조건": {
            "keywords": ["성인 가능", "직장인 레슨", "주말 수업", "유아 가능", "입문자 환영", "온라인 레슨"],
            "weight": 0.20,
            "condition_search_example": "강남 성인 피아노 레슨",
        },
        "운영정보": {
            "keywords": ["체험 레슨 가능", "유연한 일정", "보강 가능", "월 단위 등록"],
            "weight": 0.10,
            "condition_search_example": "",
        },
        "성과결과": {
            "keywords": ["콩쿠르 입상 사례", "음대 합격 사례", "발표회 개최", "학생 연주 영상"],
            "weight": 0.10,
            "condition_search_example": "",
        },
        # 실용음악·작곡·녹음 스튜디오 전용 키워드 (weight 0.25)
        # 홍뮤직스튜디오 등 작곡교습소·녹음스튜디오 업종 대응
        "스튜디오전문성": {
            "keywords": ["녹음 가능", "작곡 레슨", "편곡 레슨", "미디 작업", "레코딩 스튜디오",
                         "실용음악 전문", "작곡 전문", "홈레코딩 강의", "음악 제작"],
            "weight": 0.25,
            "condition_search_example": "작곡 레슨 녹음 스튜디오",
        },
    },

    # § 2.5 법률·세무
    "legal": {
        "접근편의": {
            "keywords": ["주차 가능", "지하철 도보", "온라인 상담 가능", "야간 상담"],
            "weight": 0.10,
            "condition_search_example": "",
        },
        "전문분야": {
            "keywords": ["이혼 전문", "부동산 전문", "형사 전문", "노동법 전문", "세무조사 전문"],
            "weight": 0.40,
            "condition_search_example": "강남 이혼 전문 변호사",
        },
        "경력신뢰": {
            "keywords": ["경력 20년+", "전관 출신", "대형로펌 경력", "승소율 높음", "언론 보도"],
            "weight": 0.25,
            "condition_search_example": "",
        },
        "상담조건": {
            "keywords": ["초기 무료 상담", "성공보수제", "착수금 없음", "24시간 연락 가능"],
            "weight": 0.15,
            "condition_search_example": "강남 무료 법률 상담",
        },
        "소통신뢰": {
            "keywords": ["친절한 설명", "칼럼 발행", "유튜브 운영", "AI 답변 인용"],
            "weight": 0.10,
            "condition_search_example": "",
        },
    },

    # § 2.6 쇼핑몰·온라인 (비위치 기반)
    "shopping": {
        "배송편의": {
            "keywords": ["당일 배송", "무료 배송", "새벽 배송", "빠른 배송", "해외 직구"],
            "weight": 0.25,
            "condition_search_example": "당일 배송 가능 쇼핑몰",
        },
        "상품특징": {
            "keywords": ["국내 제조", "친환경 인증", "비건 인증", "수제 제작", "한정판"],
            "weight": 0.30,
            "condition_search_example": "친환경 국내산 식품 쇼핑몰",
        },
        "가격혜택": {
            "keywords": ["최저가 보장", "정기 구독 할인", "대량 구매 할인", "포인트 적립"],
            "weight": 0.20,
            "condition_search_example": "",
        },
        "신뢰AS": {
            "keywords": ["교환 환불 쉬움", "CS 빠른 응대", "인증 획득", "리뷰 많음"],
            "weight": 0.15,
            "condition_search_example": "",
        },
        "AI검색대비": {
            "keywords": ["ChatGPT 추천", "AI 쇼핑 연동", "상품 구조화 데이터", "Schema 적용"],
            "weight": 0.10,
            "condition_search_example": "ChatGPT 추천 쇼핑몰",
        },
    },

    # § 2.7 카페·디저트 (음식점과 구분 — 분위기·공간·음료 중심)
    # 공간분위기(0.25) + 음료메뉴(0.20) + 이용목적(0.20) + 동반자조건(0.15) + 운영정보(0.15) + ai_tab_context(0.05) = 1.0
    "cafe": {
        "공간분위기": {
            "keywords": ["감성 인테리어", "아늑한 분위기", "뷰 좋음", "루프탑 있음", "인스타 감성", "포토존"],
            "weight": 0.25,
            "condition_search_example": "홍대 감성 카페 루프탑",
        },
        "음료메뉴": {
            "keywords": ["스페셜티 커피", "수제 음료", "비건 옵션", "시그니처 음료", "디카페인 가능", "오트밀크 가능"],
            "weight": 0.20,
            "condition_search_example": "연남 스페셜티 카페",
        },
        "이용목적": {
            "keywords": ["작업하기 좋음", "노트북 가능", "콘센트 있음", "조용한 카페", "혼자 오기 좋음", "공부 가능"],
            "weight": 0.20,
            "condition_search_example": "강남 노트북 카페 콘센트",
        },
        "동반자조건": {
            "keywords": ["반려견 동반 가능", "데이트 장소", "단체 모임 가능", "유아 동반 가능", "키즈 프렌들리"],
            "weight": 0.15,
            "condition_search_example": "홍대 반려견 카페",
        },
        "운영정보": {
            "keywords": ["당일 예약 가능", "심야 영업", "주차 가능", "포장 가능", "테이크아웃 전문"],
            "weight": 0.15,
            "condition_search_example": "신촌 심야 카페",
        },
        "ai_tab_context": {
            "keywords": [
                "노트북 작업 가능", "콘센트 자리", "조용한 분위기", "오픈 좌석 많음",
                "창가 자리", "반려동물 동반", "아이 동반 가능", "데이트 카페",
                "스터디 카페 분위기", "빈티지 인테리어", "야외 테라스",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 노트북 가능 조용한 카페",
        },
    },

    # § 2.8 헬스장·피트니스 (스포츠·운동시설)
    "fitness": {
        "시설장비": {
            "keywords": ["최신 장비", "넓은 공간", "개인 락커", "샤워실 있음", "주차 가능", "깨끗한 환경"],
            "weight": 0.15,
            "condition_search_example": "강남 헬스장 깨끗한",
        },
        "프로그램": {
            "keywords": ["PT 전문", "그룹 수업", "필라테스 병행", "요가 클래스", "스트레칭 프로그램", "체형 교정"],
            "weight": 0.30,
            "condition_search_example": "강남 PT 체형교정 헬스장",
        },
        "트레이너": {
            "keywords": ["자격증 보유 트레이너", "1:1 맞춤 PT", "여성 트레이너", "남성 트레이너", "식단 관리"],
            "weight": 0.25,
            "condition_search_example": "강남 여성 전담 PT",
        },
        "이용조건": {
            "keywords": ["24시간 운영", "일일권 가능", "월정액 저렴", "등록 없이 이용", "초보자 환영"],
            "weight": 0.15,
            "condition_search_example": "강남 24시간 헬스장",
        },
        "결과성과": {
            "keywords": ["다이어트 성공 사례", "근육 증가", "체성분 측정", "전후 사진", "체력 향상"],
            "weight": 0.10,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "초보자 환영", "직장인 야간 가능", "여성 전용 시간대", "시니어 수업 있음",
                "단기 이용 가능", "주차 무료", "1회권 가능", "혼자 와도 OK",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 직장인 야간 헬스장",
        },
    },

    # § 2.9 반려동물 (미용·동물병원)
    "pet": {
        "전문성": {
            "keywords": ["수의사 직접 진료", "전문 그루머", "품종별 전문", "소형견 전문", "대형견 가능", "고양이 전문"],
            "weight": 0.30,
            "condition_search_example": "강남 소형견 미용 전문",
        },
        "시설안전": {
            "keywords": ["CCTV 확인 가능", "개별 케이지", "청결한 환경", "분리 대기", "안전한 케어"],
            "weight": 0.25,
            "condition_search_example": "강남 CCTV 펫샵",
        },
        "서비스": {
            "keywords": ["호텔링 가능", "픽드롭 서비스", "목욕 포함", "귀 청소 포함", "발톱 정리", "스케일링"],
            "weight": 0.20,
            "condition_search_example": "강남 반려견 호텔링",
        },
        "운영정보": {
            "keywords": ["당일 예약 가능", "주말 영업", "야간 진료", "응급 진료 가능", "예약 없이 방문"],
            "weight": 0.10,
            "condition_search_example": "강남 응급 동물병원",
        },
        "비용": {
            "keywords": ["가격 투명", "항목별 견적", "할인 이벤트", "정기권"],
            "weight": 0.10,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "소형견 전용", "대형견 가능", "고양이 전문", "당일 예약 가능",
                "CCTV 실시간 확인", "보호자 동행 가능", "불안한 아이 가능", "무마취 가능",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 고양이 전문 미용",
        },
    },

    # § 2.10 사진·영상 (스냅·영상 촬영 포함)
    "photo": {
        "촬영목적": {
            "keywords": [
                "웨딩스냅", "돌스냅", "행사촬영", "웨딩본식", "스냅촬영", "야외스냅",
                "웨딩 사진", "프로필 사진", "증명사진", "가족사진", "돌잔치 사진", "기업 사진",
                "돌잔치스냅", "행사 스냅", "본식 스냅",
            ],
            "weight": 0.30,
            "condition_search_example": "웨딩스냅 추천 스튜디오",
        },
        "결과물품질": {
            "keywords": [
                "보정 포함", "무보정 가능", "원본 제공", "고화질", "앨범 제작", "즉석 출력",
                "스냅 보정", "빠른 보정 납품", "전체컷 제공", "RAW 원본",
            ],
            "weight": 0.25,
            "condition_search_example": "웨딩스냅 보정 포함",
        },
        "스튜디오환경": {
            "keywords": [
                "야외 촬영 가능", "실내 스튜디오", "자연광 스튜디오", "컨셉 다양", "소품 구비",
                "야외스냅 가능", "로케이션 다양", "공원 스냅", "한복 스냅",
            ],
            "weight": 0.20,
            "condition_search_example": "야외스냅 자연광 스튜디오",
        },
        "가격투명도": {
            "keywords": [
                "패키지 가격 명시", "추가 비용 없음", "할인 이벤트", "대여 시간 명확",
                "스냅 패키지", "웨딩스냅 가격", "돌스냅 가격",
            ],
            "weight": 0.15,
            "condition_search_example": "돌스냅 가격 패키지",
        },
        "접근편의": {
            "keywords": ["주차 가능", "대중교통 접근", "예약제 운영", "당일 예약 가능", "출장 촬영 가능"],
            "weight": 0.10,
            "condition_search_example": "스냅 출장 촬영",
        },
    },

    # § 2.11 영상·드론
    "video": {
        "제작목적": {
            "keywords": ["유튜브 영상", "광고 영상", "웨딩 영상", "기업 홍보 영상", "드론 촬영", "항공 촬영"],
            "weight": 0.30,
            "condition_search_example": "강남 기업 홍보영상 제작",
        },
        "기술품질": {
            "keywords": ["4K 촬영", "편집 포함", "색보정 포함", "자막 작업 가능", "당일 편집"],
            "weight": 0.25,
            "condition_search_example": "4K 드론 촬영 업체",
        },
        "납기일정": {
            "keywords": ["당일 납품", "3일 납품", "빠른 편집", "급행 작업 가능"],
            "weight": 0.20,
            "condition_search_example": "웨딩 영상 빠른 납품",
        },
        "장비보유": {
            "keywords": ["드론 보유", "짐벌 보유", "조명 장비", "전문 카메라"],
            "weight": 0.15,
            "condition_search_example": "드론 보유 영상 제작",
        },
        "포트폴리오": {
            "keywords": ["포트폴리오 공개", "샘플 영상 제공", "레퍼런스 다수"],
            "weight": 0.10,
            "condition_search_example": "영상 제작 포트폴리오",
        },
    },

    # § 2.12 디자인·인쇄
    "design": {
        "디자인유형": {
            "keywords": ["로고 디자인", "브랜딩", "명함 디자인", "현수막", "포스터", "SNS 콘텐츠"],
            "weight": 0.30,
            "condition_search_example": "로고 디자인 업체 추천",
        },
        "납기속도": {
            "keywords": ["당일 제작", "빠른 납품", "급행 가능", "3일 납품"],
            "weight": 0.25,
            "condition_search_example": "명함 당일 제작 인쇄",
        },
        "수정가능횟수": {
            "keywords": ["무제한 수정", "3회 수정 포함", "수정 빠름", "피드백 반영"],
            "weight": 0.20,
            "condition_search_example": "로고 디자인 무제한 수정",
        },
        "가격": {
            "keywords": ["합리적 가격", "소량 인쇄 가능", "패키지 할인", "견적 무료"],
            "weight": 0.15,
            "condition_search_example": "현수막 소량 저렴하게",
        },
        "포트폴리오": {
            "keywords": ["포트폴리오 공개", "작업 샘플", "다양한 스타일"],
            "weight": 0.10,
            "condition_search_example": "브랜딩 디자인 포트폴리오",
        },
    },

    # § 2.13 숙박업 (v3.3 — 4그룹 재편 + ai_tab_context 추가, 합계 1.0)
    # facility(0.25) + room(0.25) + dining(0.20) + activity(0.15) + value(0.10) + ai_tab_context(0.05) = 1.0
    "accommodation": {
        "facility": {
            "keywords": ["수영장", "사우나", "피트니스", "스파", "비즈니스 센터",
                         "주차장", "와이파이 무료", "엘리베이터"],
            "weight": 0.25,
            "condition_search_example": "수영장 있는 호텔",
        },
        "room": {
            "keywords": ["스탠다드", "디럭스", "스위트", "오션뷰", "마운틴뷰",
                         "킹베드", "트윈베드", "넓은 방", "신축 객실"],
            "weight": 0.25,
            "condition_search_example": "오션뷰 디럭스 객실",
        },
        "dining": {
            "keywords": ["조식 제공", "룸서비스", "부대 식당", "바", "라운지",
                         "조식 뷔페", "한식 조식", "객실 내 식사"],
            "weight": 0.20,
            "condition_search_example": "조식 제공 펜션",
        },
        "activity": {
            "keywords": ["키즈 프로그램", "액티비티", "주변 관광", "바베큐",
                         "캠프파이어", "수상 레저", "셔틀버스"],
            "weight": 0.15,
            "condition_search_example": "키즈 프로그램 풀빌라",
        },
        "value": {
            "keywords": ["가성비", "합리적인 가격", "얼리버드 할인", "패키지"],
            "weight": 0.10,
            "condition_search_example": "펜션 가성비",
        },
        "ai_tab_context": {
            "keywords": [
                "커플 여행 추천", "가족 여행 적합", "혼자 여행 가능",
                "단체 워크숍", "반려동물 동반 가능", "허니문 추천",
                "시티뷰 감성", "힐링 여행", "자연 속 숙소",
            ],
            "weight": 0.05,
            "condition_search_example": "커플 여행 오션뷰 펜션",
        },
    },

    # § 2.14 생활서비스 (세탁·인테리어·이사·청소)
    "living": {
        "situation": {
            "keywords": ["이사 후", "봄맞이 청소", "특수 청소", "급하게", "쓰레기 처리"],
            "weight": 0.25,
            "condition_search_example": "이사 후 청소 업체",
        },
        "service": {
            "keywords": ["당일 방문", "정기 서비스", "방역 포함", "무료 견적", "음식점 청소"],
            "weight": 0.25,
            "condition_search_example": "당일 청소 업체 가능",
        },
        "quality": {
            "keywords": ["꼼꼼한", "믿을 수 있는", "친절한", "전문가", "비산 제품"],
            "weight": 0.25,
            "condition_search_example": "청소 꼼꼼한 업체",
        },
        "access": {
            "keywords": ["근처 당일", "실시간 예약", "체계형 요금", "섹터 담당"],
            "weight": 0.15,
            "condition_search_example": "근처 당일 보일러 수리",
        },
        "value": {
            "keywords": ["합리적 가격", "가성비", "투명한 가격", "추가 비용 없음"],
            "weight": 0.10,
            "condition_search_example": "가성비 청소 업체",
        },
    },

    # § 2.15 약국 (지역 기반)
    "pharmacy": {
        "접근편의": {
            "keywords": ["주차 가능", "지하철 도보", "심야 영업", "24시간 영업", "휴일 영업"],
            "weight": 0.20,
            "condition_search_example": "강남 24시간 약국",
        },
        "전문상담": {
            "keywords": ["복약 지도", "약사 상담", "전문 상담", "건강 상담", "처방 분석"],
            "weight": 0.25,
            "condition_search_example": "강남 복약 지도 약국",
        },
        "취급품목": {
            "keywords": ["일반의약품 다양", "건강기능식품", "의료기기 판매", "수입 영양제", "조제 가능"],
            "weight": 0.20,
            "condition_search_example": "강남 영양제 추천 약국",
        },
        "운영정보": {
            "keywords": ["조제 빠름", "처방전 즉시 조제", "예약 픽업", "비대면 처방 가능", "약 배달 가능"],
            "weight": 0.20,
            "condition_search_example": "강남 처방 빠른 약국",
        },
        "신뢰서비스": {
            "keywords": ["친절한 상담", "꼼꼼한 설명", "오랜 경력 약사", "재방문율 높음"],
            "weight": 0.10,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "24시간 영업", "심야 조제 가능", "주말·공휴일 영업", "처방전 즉시 조제",
                "어린이 약 상담", "노인 복약 지도", "외국어 상담 가능", "주차 가능",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 심야 조제 약국",
        },
    },

    # § 2.16 부동산 (지역 기반)
    "realestate": {
        "전문분야": {
            "keywords": ["아파트 매매 전문", "오피스텔 전문", "원룸 전문", "상가 전문", "전세 전문", "월세 전문"],
            "weight": 0.30,
            "condition_search_example": "강남 오피스텔 전문 부동산",
        },
        "지역전문": {
            "keywords": ["지역 토박이", "단지 전문", "재개발 전문", "신축 분양 전문", "학군 정보 풍부"],
            "weight": 0.25,
            "condition_search_example": "강남 학군 부동산",
        },
        "서비스조건": {
            "keywords": ["매물 다수 보유", "중개 수수료 협의 가능", "법무 상담 연계", "대출 상담 연계", "이사 업체 연계"],
            "weight": 0.20,
            "condition_search_example": "강남 매물 많은 부동산",
        },
        "신뢰경력": {
            "keywords": ["경력 10년+", "실거래 사례 다수", "공인중개사 자격", "분쟁 없음", "정직한 거래"],
            "weight": 0.15,
            "condition_search_example": "강남 신뢰할 수 있는 부동산",
        },
        "운영조건": {
            "keywords": ["주말 상담 가능", "야간 상담 가능", "현장 동행", "온라인 상담 가능"],
            "weight": 0.10,
            "condition_search_example": "강남 주말 부동산 상담",
        },
    },

    # § 2.17 인테리어·시공 (지역 기반)
    "interior": {
        "시공분야": {
            "keywords": ["전체 리모델링", "부분 리모델링", "주방 시공", "욕실 시공", "도배 장판", "타일 시공"],
            "weight": 0.30,
            "condition_search_example": "강남 욕실 리모델링 업체",
        },
        "공간유형": {
            "keywords": ["아파트 전문", "상가 전문", "사무실 시공", "카페 인테리어", "원룸 시공", "신축 시공"],
            "weight": 0.20,
            "condition_search_example": "강남 카페 인테리어 업체",
        },
        "견적가격": {
            "keywords": ["무료 견적", "현장 견적", "평당 가격 명확", "추가 비용 없음", "패키지 가격"],
            "weight": 0.20,
            "condition_search_example": "강남 인테리어 무료 견적",
        },
        "공기품질": {
            "keywords": ["빠른 시공", "당일 견적", "AS 보장", "1년 사후관리", "친환경 자재"],
            "weight": 0.20,
            "condition_search_example": "강남 친환경 인테리어",
        },
        "포트폴리오": {
            "keywords": ["포트폴리오 공개", "시공 사례 다수", "후기 인증", "디자이너 직접 상담"],
            "weight": 0.10,
            "condition_search_example": "강남 인테리어 포트폴리오",
        },
    },

    # § 2.18 자동차 정비·수리 (지역 기반)
    "auto": {
        "정비분야": {
            "keywords": ["엔진 정비", "미션 수리", "타이어 교체", "사고 수리", "판금 도색", "에어컨 정비"],
            "weight": 0.30,
            "condition_search_example": "강남 사고 수리 카센터",
        },
        "차종전문": {
            "keywords": ["수입차 전문", "국산차 전문", "전기차 정비 가능", "하이브리드 정비", "대형차 가능"],
            "weight": 0.20,
            "condition_search_example": "강남 수입차 정비",
        },
        "견적가격": {
            "keywords": ["무료 견적", "투명한 가격", "정품 부품 사용", "보험 처리 가능", "할부 가능"],
            "weight": 0.20,
            "condition_search_example": "강남 보험 처리 가능 정비소",
        },
        "운영편의": {
            "keywords": ["당일 수리", "예약 가능", "픽업 서비스", "주말 영업", "긴급 출장 가능"],
            "weight": 0.20,
            "condition_search_example": "강남 당일 자동차 정비",
        },
        "신뢰경력": {
            "keywords": ["경력 10년+", "정비 자격증", "친절한 설명", "재방문율 높음", "리뷰 우수"],
            "weight": 0.10,
            "condition_search_example": "",
        },
    },
}


# 음악·예체능 관련 사업장 감지 키워드 — academy 카테고리 오추천 방지
# 사업장의 등록 키워드에 아래 항목이 포함되면 taxonomy를 music으로 자동 전환
_MUSIC_INDICATOR_KWS: frozenset = frozenset({
    "녹음", "작곡", "음악", "피아노", "기타", "드럼", "보컬", "성악",
    "실용음악", "미디", "레코딩", "스튜디오", "편곡", "작사",
    "미술", "발레", "무용", "댄스", "바이올린", "첼로", "플루트",
    "색소폰", "트럼펫", "클라리넷", "하모니카", "우쿨렐레",
    "기악", "합창", "합주", "오케스트라", "뮤지컬", "재즈",
})


def _infer_taxonomy_key(category: str, business_keywords: list[str] | None = None) -> str:
    """DB category → taxonomy key 결정, business_keywords로 오버라이드 가능.

    academy(education) 카테고리여도 음악·예체능 관련 등록 키워드가 있으면
    music taxonomy로 전환하여 학원 관련 키워드 오추천을 방지합니다.
    """
    if not category:
        return "restaurant"
    cat_lower = category.lower().strip()
    base_key = _CATEGORY_ALIASES.get(cat_lower, "restaurant")
    # academy 카테고리인데 음악·예체능 키워드가 등록된 경우 → music taxonomy 오버라이드
    if base_key == "academy" and business_keywords:
        kw_set = {k.lower() for k in business_keywords if isinstance(k, str)}
        if kw_set & _MUSIC_INDICATOR_KWS:
            return "music"
    return base_key


def normalize_category(category: str) -> str:
    """DB 카테고리 값을 taxonomy 키로 정규화"""
    if not category:
        return "restaurant"
    cat_lower = category.lower().strip()
    return _CATEGORY_ALIASES.get(cat_lower, "restaurant")


def get_industry_keywords(category: str) -> dict[str, KeywordCategory]:
    """업종별 키워드 분류 사전 반환"""
    key = normalize_category(category)
    return KEYWORD_TAXONOMY.get(key, KEYWORD_TAXONOMY["restaurant"])


def get_all_keywords_flat(category: str) -> list[str]:
    """업종의 모든 키워드를 가중치 높은 순으로 평탄화 반환"""
    industry = get_industry_keywords(category)
    result: list[str] = []
    for cat_data in sorted(industry.values(), key=lambda x: x["weight"], reverse=True):
        result.extend(cat_data["keywords"])
    return result


def get_missing_keywords_for_query(
    selected_keyword: str,
    taxonomy_key: str,
    covered_keywords: list[str],
    max_count: int = 3,
) -> list[str]:
    """선택 키워드와 관련 있는 sub-category의 미보유 키워드를 우선 반환.

    예) "녹음" 선택 → music taxonomy의 "스튜디오전문성" 카테고리 키워드 먼저,
        부족하면 weight 높은 카테고리로 보충.
    """
    industry = KEYWORD_TAXONOMY.get(taxonomy_key, KEYWORD_TAXONOMY["restaurant"])
    covered_set = {k.lower().replace(" ", "") for k in covered_keywords}
    sel_nospace = selected_keyword.lower().replace(" ", "")

    # 선택 키워드가 포함된 sub-category 탐색
    matched_cat: str | None = None
    for cat_name, cat_data in industry.items():
        for kw in cat_data["keywords"]:
            kw_ns = kw.lower().replace(" ", "")
            if sel_nospace in kw_ns or kw_ns in sel_nospace:
                matched_cat = cat_name
                break
        if matched_cat:
            break

    result: list[str] = []

    # 1순위: 매칭 카테고리 missing 키워드
    if matched_cat:
        for kw in industry[matched_cat]["keywords"]:
            if kw.lower().replace(" ", "") not in covered_set:
                result.append(kw)
                if len(result) >= max_count:
                    return result

    # 2순위: weight 높은 순으로 나머지 카테고리 보충
    for cat_name, cat_data in sorted(industry.items(), key=lambda x: x[1]["weight"], reverse=True):
        if cat_name == matched_cat:
            continue
        for kw in cat_data["keywords"]:
            if kw.lower().replace(" ", "") not in covered_set and kw not in result:
                result.append(kw)
                if len(result) >= max_count:
                    return result

    return result


def analyze_keyword_coverage(
    category: str,
    review_excerpts: list[str],
    competitor_review_excerpts: list[str] | None = None,
    business_keywords: list[str] | None = None,
    excluded_keywords: list[str] | None = None,
) -> dict:
    """
    리뷰 텍스트에서 업종별 키워드 커버리지 분석

    소상공인의 가게가 AI 브리핑 조건 검색에 나오려면
    리뷰에 업종별 핵심 키워드가 포함되어 있어야 합니다.

    Args:
        category: 업종 (DB 저장값, normalize_category로 정규화됨)
        review_excerpts: 내 가게 리뷰 텍스트 목록
        competitor_review_excerpts: 경쟁사 리뷰 텍스트 목록 (없으면 None)
        business_keywords: 사업장 등록 키워드 목록 — taxonomy 오버라이드 판단에 사용.
            여기에 들어있는 키워드 중 taxonomy에 없는 항목은 분석 대상에 합류(union).
            (예: education 카테고리인데 "녹음", "작곡" 키워드 → music taxonomy 자동 전환)
        excluded_keywords: 사용자가 제외한 키워드 — 분석 결과의 covered/missing/pioneer/competitor_only
            모든 리스트에서 필터링됨.

    Returns:
        covered: 내 리뷰에 이미 있는 키워드
        missing: 아직 없는 키워드 (전체)
        competitor_only: 경쟁사 리뷰엔 있고 내 리뷰엔 없는 것 (긴급 확보 대상)
        pioneer: 아무도 없는 선점 가능 키워드
        coverage_rate: 커버리지 비율 (0.0~1.0)
        top_priority_keyword: 지금 당장 확보해야 할 1순위 키워드
        category_scores: 카테고리별 {"score": 80, "covered": 4, "total": 5, "weight": 0.2}
    """
    excluded_set: set = {
        k.strip() for k in (excluded_keywords or []) if isinstance(k, str) and k.strip()
    }

    _taxonomy_key = _infer_taxonomy_key(category, business_keywords)
    industry = KEYWORD_TAXONOMY.get(_taxonomy_key, KEYWORD_TAXONOMY["restaurant"])
    # taxonomy_key 기반으로 직접 평탄화 (get_industry_keywords/get_all_keywords_flat 우회)
    _raw_kw_list: list[str] = []
    for _cd in sorted(industry.values(), key=lambda x: x["weight"], reverse=True):
        _raw_kw_list.extend(_cd["keywords"])

    # 사용자 custom 키워드(business_keywords 중 taxonomy에 없는 것) 합류
    if business_keywords:
        _tax_set_nospace = {kw.replace(" ", "") for kw in _raw_kw_list}
        for ck in business_keywords:
            if not isinstance(ck, str):
                continue
            ck_s = ck.strip()
            if len(ck_s) < 2:
                continue
            if ck_s.replace(" ", "") not in _tax_set_nospace:
                _raw_kw_list.append(ck_s)

    all_keywords = _raw_kw_list

    # 공백 제거 기준 중복 키워드 제거 (예: "돌스냅"과 "돌 스냅" 동시 존재 방지)
    seen_nospace: set = set()
    deduped_keywords: list = []
    for kw in all_keywords:
        nospace = kw.replace(" ", "")
        if nospace not in seen_nospace:
            seen_nospace.add(nospace)
            deduped_keywords.append(kw)
    all_keywords = deduped_keywords

    # excluded 키워드는 분석 대상 전체에서 제거 (category_scores 포함)
    if excluded_set:
        all_keywords = [kw for kw in all_keywords if kw not in excluded_set]

    # 내 리뷰 키워드 검색 (공백 제거 후 부분 매칭)
    my_text = " ".join(review_excerpts).lower() if review_excerpts else ""
    my_text_nospace = my_text.replace(" ", "")

    # 등록 키워드는 리뷰에 없어도 covered로 처리 (등록=보유 의미)
    registered_kw_nospace = {
        kw.replace(" ", "").lower()
        for kw in (business_keywords or [])
        if isinstance(kw, str) and kw.strip()
    }

    covered: list[str] = []
    missing: list[str] = []
    for kw in all_keywords:
        kw_nospace = kw.replace(" ", "").lower()
        # 등록 키워드가 taxonomy 키워드의 부분 문자열인 경우 covered 처리
        # 예: 등록="작곡" → taxonomy="작곡 레슨" 매칭
        reg_hit = any(reg_kw in kw_nospace for reg_kw in registered_kw_nospace if len(reg_kw) >= 2)
        if kw_nospace in my_text_nospace or kw in my_text or reg_hit:
            covered.append(kw)
        else:
            missing.append(kw)

    # 경쟁사 리뷰 분석
    competitor_only: list[str] = []
    pioneer: list[str] = list(missing)

    if competitor_review_excerpts:
        comp_text = " ".join(competitor_review_excerpts).lower()
        comp_text_nospace = comp_text.replace(" ", "")
        comp_covered_set = {
            kw for kw in missing
            if kw.replace(" ", "") in comp_text_nospace or kw in comp_text
        }
        competitor_only = [kw for kw in missing if kw in comp_covered_set]
        pioneer = [kw for kw in missing if kw not in comp_covered_set]

    coverage_rate = len(covered) / len(all_keywords) if all_keywords else 0.0

    # 카테고리별 커버리지 점수
    category_scores: dict[str, dict] = {}
    for cat_name, cat_data in industry.items():
        cat_kws = cat_data["keywords"]
        cat_covered = sum(1 for kw in cat_kws if kw in covered)
        category_scores[cat_name] = {
            "score": round(cat_covered / len(cat_kws) * 100) if cat_kws else 0,
            "covered": cat_covered,
            "total": len(cat_kws),
            "weight": cat_data["weight"],
        }

    # 1순위 키워드: 가중치 높은 카테고리에서 가장 먼저 missing된 것
    # 경쟁사엔 있는 것(competitor_only) 우선, 없으면 일반 missing
    urgent_pool = competitor_only if competitor_only else missing
    top_priority: str | None = None
    for cat_name, cat_data in sorted(industry.items(), key=lambda x: x[1]["weight"], reverse=True):
        for kw in cat_data["keywords"]:
            if kw in urgent_pool:
                top_priority = kw
                break
        if top_priority:
            break

    # excluded 최종 방어 필터 (all_keywords에서 이미 제거되었지만, 상류에서 우회로 들어온 경우 대비)
    if excluded_set:
        covered = [k for k in covered if k not in excluded_set]
        missing = [k for k in missing if k not in excluded_set]
        competitor_only = [k for k in competitor_only if k not in excluded_set]
        pioneer = [k for k in pioneer if k not in excluded_set]
        if top_priority and top_priority in excluded_set:
            top_priority = next((k for k in missing if k not in excluded_set), None)

    return {
        "covered": covered,
        "missing": missing,
        "competitor_only": competitor_only[:5],
        "pioneer": pioneer[:3],
        "coverage_rate": round(coverage_rate, 3),
        "top_priority_keyword": top_priority or (missing[0] if missing else None),
        "category_scores": category_scores,
    }


def build_qr_message(
    top_priority_keyword: str | None,
    missing_keywords: list[str],
    business_name: str,
) -> str:
    """
    특정 키워드를 자연스럽게 리뷰에 남기도록 유도하는 QR 카드 문구 생성.

    네이버 리뷰 정책 위반 내용 금지 (리워드 제공 암시 금지).
    조작처럼 보이지 않는 자연스러운 부탁 형식.
    """
    if not top_priority_keyword:
        return (
            f"오늘 {business_name} 방문 감사합니다!\n"
            "솔직한 리뷰 한 줄이 저희에게 큰 힘이 됩니다 😊"
        )

    # 상위 2개 키워드로 문구 구성
    targets = [top_priority_keyword]
    for kw in missing_keywords:
        if kw != top_priority_keyword:
            targets.append(kw)
            break

    keyword_phrase = " 또는 ".join(targets[:2])

    return (
        f"오늘 방문 어떠셨나요? "
        f"{keyword_phrase} 등 이용하신 경험을 솔직하게 남겨주시면 "
        f"다음 손님께 큰 도움이 됩니다. "
        f"리뷰를 남겨주시면 감사하겠습니다."
    )


def analyze_nonlocation_keywords(
    category: str,
    business_name: str,
    ai_excerpts: list[str],
    excluded_keywords: list[str] | None = None,
    business_keywords: list[str] | None = None,
) -> dict:
    """
    위치 무관(non_location) 사업장을 위한 키워드 분석.

    네이버 AI 브리핑 비해당이므로 리뷰 키워드 대신
    ChatGPT·Gemini가 전문직을 추천할 때 사용하는 키워드 패턴을 분석.

    Args:
        category: 업종 코드
        business_name: 사업장명
        ai_excerpts: AI 플랫폼 언급 발췌문 목록

    Returns:
        covered: AI 언급에 포함된 전문 키워드
        missing: 아직 없는 전문 키워드
        top_priority_keyword: 지금 가장 필요한 1순위
        coverage_rate: 0.0~1.0
        advice: 비위치 사업장을 위한 키워드 전략 메시지
    """
    # 비위치 사업장 전문 키워드 (ChatGPT·Gemini 추천 패턴)
    nonlocation_keywords: dict[str, list[str]] = {
        "legal":    ["무료 상담", "전문 변호사", "승소 사례", "이혼 전문", "형사 전문", "세무 전문", "칼럼", "유튜브"],
        "shopping": ["당일 배송", "무료 반품", "정품 인증", "친환경", "수제", "한정판", "구독 서비스"],
        "consulting": ["성공 사례", "전문가 칼럼", "인터뷰", "언론 보도", "포트폴리오", "무료 진단"],
        "fitness":  ["온라인 PT", "비대면 레슨", "영상 콘텐츠", "성과 사례", "인증 자격증"],
        "academy":  ["수강 후기", "합격 사례", "강사 경력", "커리큘럼", "온라인 수업", "영상 강의"],
        "default":  ["전문 콘텐츠", "블로그 운영", "전문가 의견", "사례 포트폴리오", "언론 보도"],
    }

    key = normalize_category(category)
    kws = list(nonlocation_keywords.get(key, nonlocation_keywords["default"]))

    # business_keywords 중 taxonomy에 없는 항목 합류 (custom 추가)
    if business_keywords:
        _kws_nospace = {k.replace(" ", "") for k in kws}
        for ck in business_keywords:
            if isinstance(ck, str) and len(ck.strip()) >= 2 and ck.strip().replace(" ", "") not in _kws_nospace:
                kws.append(ck.strip())

    excluded_set = {
        k.strip() for k in (excluded_keywords or []) if isinstance(k, str) and k.strip()
    }
    if excluded_set:
        kws = [kw for kw in kws if kw not in excluded_set]

    joined = " ".join(ai_excerpts).lower() if ai_excerpts else ""
    covered = [kw for kw in kws if kw.lower() in joined]
    missing = [kw for kw in kws if kw.lower() not in joined]
    coverage_rate = len(covered) / len(kws) if kws else 0.0
    top_priority = missing[0] if missing else None

    advice = (
        f"{business_name}은(는) 위치 무관 사업장입니다. "
        "ChatGPT·Gemini가 추천할 때 '전문성·신뢰' 키워드가 중요합니다. "
        f"지금 가장 필요한 것: '{top_priority}' 관련 콘텐츠 발행 (블로그·칼럼·사례)."
        if top_priority else
        f"{business_name}의 전문 키워드 커버리지가 양호합니다. 콘텐츠 최신성을 유지하세요."
    )

    return {
        "covered": covered,
        "missing": missing,
        "top_priority_keyword": top_priority,
        "coverage_rate": round(coverage_rate, 3),
        "advice": advice,
    }


# ---------------------------------------------------------------------------
# 조건검색 시뮬레이션 쿼리 (업종별 상위 5개 조건 검색어)
# 실제 고객이 AI에게 묻는 방식 -- 조건 포함 자연어 검색
# ---------------------------------------------------------------------------
CONDITION_SEARCH_QUERIES: dict[str, list[str]] = {
    "restaurant": [
        "{region} 주차 가능 식당",
        "{region} 단체 예약 식당",
        "{region} 반려동물 동반 식당",
        "{region} 포장 가능 식당",
        "{region} 런치 특선 식당",
    ],
    "cafe": [
        "{region} 주차 가능 카페",
        "{region} 노트북 카페",
        "{region} 반려동물 카페",
        "{region} 대관 카페",
        "{region} 24시 카페",
    ],
    "beauty": [
        "{region} 당일 예약 미용실",
        "{region} 주차 가능 미용실",
        "{region} 아이 동반 미용실",
        "{region} 남성 미용실",
        "{region} 탈색 잘하는 미용실",
    ],
    "clinic": [
        "{region} 주차 가능 병원",
        "{region} 야간 진료 병원",
        "{region} 당일 예약 병원",
        "{region} 소아과",
        "{region} 주말 진료 병원",
    ],
    "fitness": [
        "{region} 주차 가능 헬스장",
        "{region} 여성 전용 헬스장",
        "{region} PT 가능 헬스장",
        "{region} 24시 헬스장",
        "{region} 당일 등록 헬스장",
    ],
    "pet": [
        "{region} 주차 가능 동물병원",
        "{region} 당일 예약 동물병원",
        "{region} 야간 동물병원",
        "{region} 고양이 동물병원",
        "{region} 24시 동물병원",
    ],
    "academy": [
        "{region} 무료 체험 학원",
        "{region} 소수 정원 학원",
        "{region} 온라인 병행 학원",
        "{region} 주말 학원",
        "{region} 성인 학원",
    ],
    "music": [
        "{region} 성인 피아노 레슨",
        "{region} 1대1 음악 레슨",
        "{region} 체험 레슨 음악교습소",
        "{region} 직장인 피아노",
        "{region} 입시 음악학원",
    ],
    "legal": [
        "{region} 무료 상담 변호사",
        "{region} 이혼 전문 변호사",
        "{region} 형사 전문 변호사",
        "{region} 교통사고 변호사",
        "{region} 세무사 무료 상담",
    ],
    "shopping": [
        "당일 배송 쇼핑몰",
        "무료 반품 쇼핑몰",
        "친환경 제품 쇼핑몰",
        "수제 제품 쇼핑몰",
        "한정판 쇼핑몰",
    ],
    "pharmacy": [
        "{region} 24시간 약국",
        "{region} 심야 약국",
        "{region} 휴일 약국",
        "{region} 영양제 추천 약국",
        "{region} 처방 빠른 약국",
    ],
    "realestate": [
        "{region} 아파트 매매 부동산",
        "{region} 오피스텔 전문 부동산",
        "{region} 신축 분양 부동산",
        "{region} 학군 좋은 부동산",
        "{region} 매물 많은 부동산",
    ],
    "interior": [
        "{region} 욕실 리모델링 업체",
        "{region} 주방 시공 업체",
        "{region} 무료 견적 인테리어",
        "{region} 친환경 인테리어",
        "{region} 카페 인테리어 업체",
    ],
    "auto": [
        "{region} 사고 수리 카센터",
        "{region} 수입차 정비",
        "{region} 당일 자동차 정비",
        "{region} 보험 처리 카센터",
        "{region} 24시간 정비소",
    ],
    "default": [
        "{region} 주차 가능",
        "{region} 예약 가능",
        "{region} 주말 영업",
        "{region} 배달 가능",
        "{region} 단체 예약",
    ],
}


def get_condition_queries(category: str, region: str) -> list[str]:
    """업종과 지역으로 조건검색 쿼리 생성.

    region에서 구/동 레벨만 추출합니다.
    예: "서울 강남구" -> "강남" / "홍대입구" -> "홍대입구"
    """
    cat_key = normalize_category(category)
    queries = CONDITION_SEARCH_QUERIES.get(cat_key, CONDITION_SEARCH_QUERIES["default"])
    region_part = region.split()[-1] if region else region or ""
    region_short = (
        region_part
        .replace("특별시", "")
        .replace("광역시", "")
        .replace("군", "")
        .replace("구", "")
        .replace("시", "")
        .strip()
    ) if region_part else ""
    region_final = region_short if region_short else region_part
    return [q.format(region=region_final) for q in queries]


def build_location_service_keywords(region: str, category: str) -> list[str]:
    """지역 + 업종 서비스 키워드 조합 생성 (블로그 제목·가이드용).

    예: region="창원시", category="restaurant" → ["창원 맛집", "창원 식당 추천", ...]
    """
    import re as _re
    if not region:
        return []
    city = region.strip().split()[0]
    # 특별시/광역시/도 접미사 제거 → "서울시" → "서울"
    city = _re.sub(r"(특별시|광역시|특별자치시|특별자치도|시|도)$", "", city)

    cat_key = normalize_category(category)
    taxonomy = KEYWORD_TAXONOMY.get(cat_key, {})

    base_keywords: list[str] = []
    for cat_data in taxonomy.values():
        if isinstance(cat_data, dict) and "keywords" in cat_data:
            base_keywords.extend(cat_data["keywords"])

    # 상위 6개 키워드로 지역+서비스 조합 생성
    unique = list(dict.fromkeys(base_keywords))[:6]
    return [f"{city} {kw}" for kw in unique if kw]


# ─── 계절별 키워드 ─────────────────────────────────────────────────────────────
SEASONAL_KEYWORDS: dict[str, dict[str, list[str]]] = {
    "restaurant": {
        "spring": ["봄나물", "꽃구경 맛집", "소풍 도시락", "벚꽃 맛집", "봄 제철"],
        "summer": ["냉면 맛집", "빙수", "여름 보양식", "야외 테라스", "시원한"],
        "autumn": ["단풍 맛집", "제철 버섯", "추석 음식", "가을 별미", "뜨끈한"],
        "winter": ["뜨끈한 국물", "크리스마스 맛집", "연말 회식", "겨울 보양식", "따뜻한"],
        "01": ["신년 특선", "설날 음식", "새해 맛집"],
        "02": ["발렌타인 맛집", "설 연휴", "명절 음식"],
        "03": ["봄나물", "개강 맛집"],
        "04": ["벚꽃 맛집", "봄 소풍"],
        "05": ["어버이날", "가정의달 맛집"],
        "06": ["여름 준비", "시원한 맛집"],
        "07": ["여름 휴가", "피서지 맛집"],
        "08": ["여름 끝물", "개학 맛집"],
        "09": ["추석", "가을 나들이"],
        "10": ["단풍", "할로윈"],
        "11": ["수능", "연말 시작"],
        "12": ["크리스마스", "연말 회식", "송년"],
    },
    "cafe": {
        "spring": ["봄 음료", "벚꽃 라떼", "플라워 카페", "야외 테라스 카페"],
        "summer": ["아이스 음료", "빙수 카페", "시원한 카페", "수박 주스"],
        "autumn": ["고구마 라떼", "단호박 음료", "가을 분위기 카페"],
        "winter": ["호캉스 카페", "따뜻한 음료", "핫초코", "크리스마스 카페"],
        "01": ["신년 카페", "새해 음료"],
        "02": ["발렌타인 카페", "초콜릿 음료"],
        "05": ["어버이날 케이크", "가정의달"],
        "12": ["크리스마스 케이크", "연말 카페"],
    },
    "beauty": {
        "spring": ["봄 헤어 컬러", "봄 퍼머", "웨딩 헤어"],
        "summer": ["여름 헤어", "휴가 전 미용", "시원한 단발"],
        "autumn": ["가을 헤어 컬러", "다크 톤 염색"],
        "winter": ["겨울 헤어", "크리스마스 헤어", "연말 미용"],
        "03": ["입학 헤어", "개학 미용"],
        "05": ["어버이날 헤어"],
        "09": ["개학 헤어"],
        "12": ["연말 파티 헤어"],
    },
    "clinic": {
        "spring": ["봄 피부 관리", "자외선 차단", "환절기 피부"],
        "summer": ["여름 피부 관리", "선크림 추천", "모공 관리"],
        "autumn": ["가을 피부 재생", "건조한 피부", "환절기 트러블"],
        "winter": ["겨울 피부 보습", "건조 피부 관리", "아토피"],
        "03": ["봄 알레르기", "환절기 비염"],
        "07": ["여름 피부", "자외선 손상"],
    },
    "fitness": {
        "spring": ["봄 다이어트", "야외 운동", "봄맞이 PT"],
        "summer": ["여름 바디 라인", "다이어트 PT", "수영"],
        "autumn": ["가을 체력 관리", "마라톤 준비"],
        "winter": ["겨울 홈트", "실내 운동", "새해 다짐 PT"],
        "01": ["새해 다이어트", "새해 운동"],
        "12": ["연말 다이어트"],
    },
    "academy": {
        "spring": ["봄학기 시작", "개학 준비", "신입생 과외"],
        "summer": ["여름방학 특강", "수능 준비"],
        "autumn": ["가을학기", "수능 D-100"],
        "winter": ["겨울방학 특강", "선행학습", "입시 준비"],
        "02": ["졸업 전 과외", "예비 중학생"],
        "03": ["새학기 준비", "초등 입학"],
        "11": ["수능", "입시 결과"],
    },
    "pet": {
        "spring": ["봄 산책", "반려견 미용", "알레르기 주의"],
        "summer": ["여름 반려견 관리", "더위 대처", "털 관리"],
        "autumn": ["가을 산책", "털 빠짐 관리"],
        "winter": ["겨울 반려견 보호", "실내 운동", "발바닥 관리"],
        "01": ["새해 반려동물"],
        "05": ["어린이날 반려동물"],
    },
}


def _month_to_season(month: int) -> str:
    if month in (3, 4, 5):
        return "spring"
    if month in (6, 7, 8):
        return "summer"
    if month in (9, 10, 11):
        return "autumn"
    return "winter"


def get_seasonal_keywords(category: str, month: int) -> list[str]:
    """현재 월 기준 계절 키워드 상위 5개 반환.

    Args:
        category: 업종 코드 (restaurant, cafe, beauty 등)
        month: 1~12 정수

    Returns:
        최대 5개의 계절 키워드 리스트 (중복 제거, 월별 > 계절별 우선)
    """
    cat_key = normalize_category(category)
    base = SEASONAL_KEYWORDS.get(cat_key)
    if base is None:
        # fallback: restaurant
        base = SEASONAL_KEYWORDS.get("restaurant", {})

    season = _month_to_season(month)
    month_str = f"{month:02d}"

    combined = base.get(month_str, []) + base.get(season, [])
    seen: set[str] = set()
    result: list[str] = []
    for kw in combined:
        if kw not in seen:
            seen.add(kw)
            result.append(kw)
        if len(result) >= 5:
            break
    return result
