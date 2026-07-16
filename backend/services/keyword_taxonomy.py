"""
업종별 상황 키워드 분류 체계
모델 엔진 명세서 v1.0 § 02 기준

이 분류 체계가 AEOlab의 핵심 데이터 자산입니다.
네이버 AI 브리핑은 리뷰에서 이 카테고리의 키워드를 추출해 조건 검색에 활용합니다.
업종 추가 시 반드시 이 파일에 먼저 정의 후 개발 적용.
"""

import logging

from typing import TypedDict

_logger = logging.getLogger("aeolab")


def _norm_kw(kw: str) -> str:
    """키워드 정규화: 공백 제거 + 소문자. 비교 시 양쪽에 적용해 띄어쓰기 차이 흡수."""
    return kw.strip().replace(" ", "").lower()


class _KeywordCategoryRequired(TypedDict):
    keywords: list[str]
    weight: float
    condition_search_example: str


class KeywordCategory(_KeywordCategoryRequired, total=False):
    # 전역 플래그 (M1·P2-1 신설, 옵셔널 — 미명시 시 기본값 사용)
    # in_ai_tab=True(기본): 이 카테고리 키워드가 AI탭 답변 생성 신호로 활용 가능
    # ad_only=True: 이 키워드는 광고 영역에서 주로 노출 — 유기 점수에서 제외 필요
    in_ai_tab: bool
    ad_only: bool


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
    "네일": "beauty",
    # 피부관리실·에스테틱 (beauty와 분리 — 피부관리실이 미용실 taxonomy 받는 문제 수정)
    "skincare": "skincare", "피부관리": "skincare", "에스테틱": "skincare",
    "스킨케어": "skincare", "피부샵": "skincare", "피부": "skincare",
    # 마사지·스파
    "massage": "massage", "마사지": "massage", "스파": "massage",
    "체형관리": "massage", "안마": "massage", "아로마": "massage", "타이마사지": "massage",
    # 병원·한의원
    "clinic": "clinic", "hospital": "clinic", "medical": "clinic",
    "병원": "clinic", "한의원": "clinic", "치과": "clinic",
    "의원": "clinic", "약국": "clinic",
    # 학원·교육
    "academy": "academy", "education": "academy", "tutoring": "academy",
    "학원": "academy", "교육": "academy", "과외": "academy",
    # 스터디카페·독서실
    "study": "study", "스터디카페": "study", "독서실": "study", "스터디룸": "study",
    # 음악·예체능 교습소 (학원과 구분 — 원어민 키워드 오추천 방지)
    # "음악학원"/"피아노학원" → L162-163 music_class가 최종. "기타" → L221 restaurant(fallback) 최종.
    # 작곡·레코딩 특화는 "music_studio" value를 통해서만 "music" taxonomy에 도달하도록 설계.
    "music": "music", "음악": "music", "음악교습소": "music",
    "피아노": "music", "피아노교습소": "music",
    "바이올린": "music", "첼로": "music", "드럼": "music",
    "보컬": "music", "성악": "music", "실용음악": "music", "작곡": "music",
    "music_studio": "music",  # 작곡·레코딩 스튜디오 신규 value (2026-07-17)
    "미술": "art_class", "미술학원": "art_class", "미술교습소": "art_class",
    "발레": "ballet", "무용": "ballet", "댄스": "dance",
    # 법률
    "legal": "legal", "lawyer": "legal", "law": "legal",
    "법률": "legal", "변호사": "legal",
    # 세무·회계 (legal에서 분리)
    "accounting": "accounting", "tax": "accounting",
    "세무": "accounting", "회계": "accounting",
    "세무사": "accounting", "세무법인": "accounting", "기장": "accounting",
    "공인회계사": "accounting",
    # 쇼핑몰·온라인
    "shop": "shopping", "shopping": "shopping", "online": "shopping",
    "쇼핑몰": "shopping", "온라인": "shopping", "이커머스": "shopping",
    # 카페 추가 별칭
    "coffee": "cafe", "coffeeshop": "cafe", "커피숍": "cafe", "디저트카페": "cafe",
    # 헬스장·피트니스
    "fitness": "fitness", "gym": "fitness", "pilates": "fitness",
    "헬스": "fitness", "헬스장": "fitness", "피트니스": "fitness",
    "필라테스": "fitness", "pt": "fitness",
    # 요가는 별도 taxonomy — fitness 오분류 방지 (2026-05-18 수정)
    "yoga": "yoga", "요가": "yoga", "요가원": "yoga", "요가스튜디오": "yoga",
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
    "bakery": "bakery", "베이커리": "bakery", "빵집": "bakery", "디저트": "bakery",
    "베이커리카페": "bakery", "제과": "bakery", "제과점": "bakery", "케이크샵": "bakery",
    "bar": "restaurant", "주점": "restaurant", "술집": "restaurant", "포차": "restaurant",
    # 네일샵 — 별도 taxonomy (beauty 오분류 방지, 2026-05-18 수정)
    "nail": "nail", "네일아트": "nail", "네일샵": "nail",
    # 약국 (신규 dict)
    "pharmacy": "pharmacy", "약사": "pharmacy",
    # 부동산 (신규 dict)
    "realestate": "realestate", "부동산": "realestate", "공인중개사": "realestate",
    "매매": "realestate", "임대": "realestate", "전세": "realestate",
    # 인테리어 (신규 dict — 기존 "인테리어" living alias 대체)
    "interior": "interior", "인테리어": "interior", "리모델링": "interior", "시공": "interior",
    # 자동차 (신규 dict)
    "auto": "auto", "자동차": "auto", "정비소": "auto", "카센터": "auto", "수리": "auto",
    # 청소 — 별도 taxonomy (living 오분류 방지, 2026-05-18 수정)
    "cleaning": "cleaning", "청소": "cleaning", "청소업체": "cleaning", "가사도우미": "cleaning",
    # 꽃집
    "flower": "flower", "꽃집": "flower", "화원": "flower", "플라워": "flower", "꽃": "flower",
    # 세탁소
    "laundry": "laundry", "세탁소": "laundry", "드라이클리닝": "laundry",
    "코인세탁": "laundry",
    # 키즈카페·어린이
    "kids": "kids", "키즈카페": "kids", "어린이카페": "kids", "어린이": "kids",
    # 공방·원데이클래스
    "workshop": "workshop", "공방": "workshop", "원데이클래스": "workshop",
    "공예": "workshop", "클래스": "workshop", "아틀리에": "workshop",
    # 패션·의류 (분리)
    "fashion": "fashion", "패션": "fashion", "편집샵": "fashion", "브랜드샵": "fashion",
    "clothing": "clothing", "의류": "clothing", "옷": "clothing", "옷가게": "clothing",
    "교복": "clothing", "단체복": "clothing",
    # 댄스 스튜디오 (신규)
    "dance": "dance", "댄스": "dance", "댄스학원": "dance",
    "댄스스튜디오": "dance", "방송댄스": "dance", "힙합댄스": "dance",
    # 발레 (분리)
    "ballet": "ballet", "발레": "ballet", "발레학원": "ballet", "발레스튜디오": "ballet",
    "무용": "ballet", "무용학원": "ballet",
    # 골프연습장 (신규)
    "golf": "golf", "골프": "golf", "골프연습장": "golf", "스크린골프": "golf",
    "실내골프": "golf",
    # 수영·아쿠아 (신규)
    "swim": "swim", "수영": "swim", "수영장": "swim", "아쿠아": "swim",
    "아쿠아로빅": "swim",
    # 찜질방·사우나 (신규)
    "jjimjil": "jjimjil", "찜질방": "jjimjil", "사우나": "jjimjil", "한증막": "jjimjil",
    # 스파 (마사지와 분리)
    "spa": "spa", "스파": "spa", "아로마스파": "spa", "스파센터": "spa", "온천스파": "spa",
    # 음악교실 (그룹·학원형)
    "music_class": "music_class", "음악교실": "music_class", "음악학원": "music_class",
    "피아노학원": "music_class", "바이올린학원": "music_class", "첼로학원": "music_class",
    # 악기레슨 (개인레슨형)
    "music_lesson": "music_lesson", "악기레슨": "music_lesson", "음악레슨": "music_lesson",
    "피아노레슨": "music_lesson", "기타레슨": "music_lesson", "보컬레슨": "music_lesson",
    # 요리교실·쿠킹클래스 (신규)
    "cooking": "cooking", "요리교실": "cooking", "쿠킹클래스": "cooking",
    "베이킹클래스": "cooking", "요리수업": "cooking",
    # 방탈출 (신규)
    "escape": "escape", "방탈출": "escape", "탈출게임": "escape",
    "방탈출카페": "escape", "이스케이프룸": "escape",
    # 체험공간 (방탈출과 분리)
    "experience": "experience", "체험공간": "experience", "원데이체험": "experience",
    "도예체험": "experience", "향수만들기": "experience", "체험형": "experience",
    # 치과 (신규 — v5.7)
    "dental": "dental", "치과": "dental", "치과의원": "dental", "치과클리닉": "dental",
    "임플란트": "dental", "치아교정": "dental",
    # 한의원 (신규 — v5.7)
    "oriental_medicine": "oriental_medicine", "한의원": "oriental_medicine",
    "한방병원": "oriental_medicine", "한의사": "oriental_medicine", "추나": "oriental_medicine",
    # 안경원 (신규 — v5.7)
    "optics": "optics", "안경원": "optics", "안경점": "optics", "안경사": "optics",
    "렌즈": "optics", "라식": "optics",
    # 반영구화장 (신규 — v5.7)
    "semi_permanent": "semi_permanent", "반영구": "semi_permanent", "눈썹문신": "semi_permanent",
    "아이라인문신": "semi_permanent", "입술문신": "semi_permanent",
    # 태권도·무술 (신규 — v5.7)
    "martial_arts": "martial_arts", "태권도": "martial_arts", "검도": "martial_arts",
    "유도": "martial_arts", "합기도": "martial_arts", "무에타이": "martial_arts",
    "주짓수": "martial_arts", "무술도장": "martial_arts",
    # 클라이밍 (신규 — v5.7)
    "climbing": "climbing", "클라이밍": "climbing", "볼더링": "climbing",
    "암벽등반": "climbing", "클라이밍센터": "climbing",
    # 미술학원 (신규 — v5.7)
    "art_class": "art_class", "미술학원": "art_class", "미술교실": "art_class",
    "입시미술": "art_class", "어린이미술": "art_class",
    # 어린이집·유치원 (신규 — v5.7)
    "childcare": "childcare", "어린이집": "childcare", "유치원": "childcare",
    "보육원": "childcare", "영어유치원": "childcare",
    # 세차장 (신규 — v5.7)
    "car_wash": "car_wash", "세차": "car_wash", "세차장": "car_wash",
    "자동세차": "car_wash", "손세차": "car_wash", "코팅": "car_wash",
    # 핸드폰·가전수리 (신규 — v5.7)
    "electronics_repair": "electronics_repair", "핸드폰수리": "electronics_repair",
    "스마트폰수리": "electronics_repair", "액정교체": "electronics_repair",
    "가전수리": "electronics_repair", "노트북수리": "electronics_repair",
    # 신발 (신규 — v5.7)
    "footwear": "footwear", "신발": "footwear", "구두": "footwear", "운동화": "footwear",
    "신발가게": "footwear", "슈즈샵": "footwear",
    # 문구·사무용품 (신규 — v5.7)
    "stationery": "stationery", "문구점": "stationery", "문구사": "stationery",
    "사무용품": "stationery", "학용품": "stationery", "문구": "stationery",
    # 노래방 (신규 — v5.7)
    "norebang": "norebang", "노래방": "norebang", "코인노래방": "norebang",
    "노래연습장": "norebang",
    # 당구장 (신규 — v5.7)
    "billiards": "billiards", "당구장": "billiards", "포켓볼": "billiards",
    "당구": "billiards", "3쿠션": "billiards",
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
            "keywords": ["단체 예약 가능", "회식 장소", "단체석 있음", "프라이빗룸", "30명 수용", "단체 이용 가능"],
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
        # 키워드 풀 확장용 (weight=0.0 — 점수 산정 미반영, 조건검색 키워드 갭 분석용)
        "메뉴종류": {
            "keywords": [
                "삼겹살", "흑돼지", "항정살", "곱창", "막창", "갈비",
                "한식", "중식", "일식", "초밥", "횟집",
                "파스타", "피자", "스테이크",
                "냉면", "막국수", "국밥", "순대국", "설렁탕",
                "치킨", "닭갈비",
            ],
            "weight": 0.0,
            "condition_search_example": "창원 삼겹살 맛집",
            "in_ai_tab": False,
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
        # 키워드 풀 확장용 (weight=0.0 — 점수 산정 미반영, 조건검색 키워드 갭 분석용)
        "시술종류": {
            "keywords": [
                "헤어커트", "파마", "탈색", "염색",
                "클리닉파마", "매직", "디지털파마",
                "케라틴트리트먼트",
            ],
            "weight": 0.0,
            "condition_search_example": "강남 파마 미용실",
            "in_ai_tab": False,
        },
    },

    # § 2.3 병원·한의원
    # 접근편의(0.15) + 전문성(0.30) + 진료경험(0.25) + 운영정보(0.20) + 비용보험(0.05) + ai_tab_context(0.05) = 1.0
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
            "weight": 0.05,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "진료과목", "전문의", "야간진료", "주말진료", "예약방법",
                "비급여항목", "주차가능", "진료시간", "초진예약", "당일진료",
                "응급처치", "검사종류", "대기시간", "주차정보", "근처의원",
            ],
            "weight": 0.05,
            "description": "AI탭 플레이스 검색에서 자주 등장하는 의원 관련 질문 키워드",
        },
        # 키워드 풀 확장용 (weight=0.0 — 점수 산정 미반영, 조건검색 키워드 갭 분석용)
        "진료과목": {
            "keywords": [
                "내과", "정형외과", "피부과", "한의원",
                "산부인과", "소아과", "이비인후과", "신경과",
                "정신건강의학과", "재활의학과",
            ],
            "weight": 0.0,
            "condition_search_example": "강남 피부과 의원",
            "in_ai_tab": False,
        },
    },

    # § 2.4 학원·교육
    # 접근편의(0.15) + 교육전문성(0.35) + 대상조건(0.25) + 운영정보(0.15) + 성과결과(0.05) + ai_tab_context(0.05) = 1.0
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
            "weight": 0.05,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "수강대상", "커리큘럼", "수업방식", "원장경력", "합격실적",
                "개인과외", "그룹수업", "온라인수업", "체험수업", "수강료",
                "시간표", "레벨테스트", "교재비포함", "환불정책", "셔틀운행",
            ],
            "weight": 0.05,
            "description": "AI탭에서 학원 검색 시 자주 나오는 정보 요청 키워드",
        },
        # 키워드 풀 확장용 (weight=0.0 — 점수 산정 미반영, 조건검색 키워드 갭 분석용)
        "과목분야": {
            "keywords": [
                "수학", "영어", "과학", "코딩", "국어", "논술",
                "한국사", "사회", "수능전문", "내신전문",
            ],
            "weight": 0.0,
            "condition_search_example": "강남 수학 학원",
            "in_ai_tab": False,
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
            "weight": 0.05,
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
        "ai_tab_context": {
            "keywords": [
                "악기 종류", "수업 방식", "체험 레슨 가능", "성인 취미반", "어린이 전용",
                "방과후 수업", "주말 수업", "1대1 개인 레슨", "그룹 수업", "주차 가능",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 피아노 성인 취미 레슨",
        },
    },

    # § 2.5 법률·세무
    # 접근편의(0.10) + 전문분야(0.40) + 경력신뢰(0.25) + 상담조건(0.15) + 소통신뢰(0.05) + ai_tab_context(0.05) = 1.0
    "legal": {
        "접근편의": {
            "keywords": ["주차 가능", "지하철 도보", "온라인 상담 가능", "야간 상담"],
            "weight": 0.10,
            "condition_search_example": "",
        },
        "전문분야": {
            "keywords": [
                "이혼 전문", "부동산 전문", "형사 전문", "노동법 전문", "세무조사 전문",
                "상속", "교통사고", "성범죄", "기업법무", "임대차", "의료분쟁",
            ],
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
            "weight": 0.05,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "전문분야", "무료상담", "상담방법", "성공보수", "착수금",
                "이혼전문", "형사전문", "부동산전문", "노동전문", "상담예약",
                "방문상담", "전화상담", "야간상담", "경력변호사", "수임사례",
            ],
            "weight": 0.05,
            "description": "AI탭에서 법률 서비스 검색 시 자주 나오는 질문 키워드",
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
            "ad_only": True,
        },
        "신뢰AS": {
            "keywords": ["교환 환불 쉬움", "CS 빠른 응대", "인증 획득", "리뷰 많음"],
            "weight": 0.15,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": ["ChatGPT 추천", "AI 쇼핑 연동", "상품 구조화 데이터", "Schema 적용",
                         "당일 배송 가능", "무료 반품", "실시간 재고 확인"],
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
        # 키워드 풀 확장용 (weight=0.0 — 점수 산정 미반영, 조건검색 키워드 갭 분석용)
        "음료메뉴확장": {
            "keywords": [
                "아메리카노", "라떼", "스페셜티", "핸드드립", "콜드브루",
                "디저트카페", "브런치카페", "베이커리카페", "버블티", "스무디",
            ],
            "weight": 0.0,
            "condition_search_example": "연남동 스페셜티 카페",
            "in_ai_tab": False,
        },
        # bakery는 cafe taxonomy로 매핑됨 (_CATEGORY_ALIASES 참조)
        "베이커리종류": {
            "keywords": [
                "소금빵", "크루아상", "케이크", "마카롱", "타르트",
                "식빵", "베이글", "스콘",
            ],
            "weight": 0.0,
            "condition_search_example": "마포 소금빵 베이커리",
            "in_ai_tab": False,
        },
    },

    # § 2.8 베이커리·디저트 (빵집·제과점 — 카페와 구분, 뷰·루프탑 키워드 제외)
    "bakery": {
        "빵메뉴": {
            "keywords": ["소금빵", "크루아상", "케이크", "마카롱", "타르트", "식빵", "베이글", "스콘", "파이", "브레드"],
            "weight": 0.30,
            "condition_search_example": "창원 소금빵 베이커리",
        },
        "재료품질": {
            "keywords": ["천연 발효", "국내산 밀", "당일 제조", "수제 제조", "무방부제", "유기농 재료", "홈메이드", "직접 굽는"],
            "weight": 0.25,
            "condition_search_example": "수제 천연발효 빵집",
        },
        "이용목적": {
            "keywords": ["선물 포장 가능", "테이크아웃 전문", "구독 베이커리", "조각 케이크", "맞춤 제작 케이크", "생일 케이크 예약"],
            "weight": 0.20,
            "condition_search_example": "생일 케이크 예약 제과점",
        },
        "공간분위기": {
            "keywords": ["아늑한 분위기", "브런치 가능", "카페 분위기", "테이블 있음"],
            "weight": 0.15,
            "condition_search_example": "브런치 베이커리 카페",
        },
        "운영정보": {
            "keywords": ["당일 예약 가능", "주차 가능", "조기 마감 가능", "온라인 주문", "포장 가능"],
            "weight": 0.10,
            "condition_search_example": "주차 가능 베이커리",
        },
        "ai_tab_context": {
            "keywords": ["수제 빵 추천", "당일 구운 빵", "케이크 예약", "국내산 재료", "무방부제 빵"],
            "weight": 0.0,
            "condition_search_example": "수제 베이커리 추천",
            "in_ai_tab": True,
        },
    },

    # § 2.9 헬스장·피트니스 (스포츠·운동시설)
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
            "weight": 0.05,
            "condition_search_example": "스냅 출장 촬영",
        },
        "ai_tab_context": {
            "keywords": [
                "당일 예약 가능", "출장 촬영 가능", "야외 촬영 가능",
                "웨딩스냅 전문", "증명사진 당일 출력", "어린이 촬영 전문",
                "가족 사진 전문", "보정 빠름", "원본 제공",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 증명사진 당일 출력",
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
            "weight": 0.05,
            "condition_search_example": "영상 제작 포트폴리오",
        },
        "ai_tab_context": {
            "keywords": [
                "빠른 납품 가능", "당일 편집", "드론 촬영 가능",
                "유튜브 영상 전문", "기업 홍보 영상", "웨딩 영상 전문",
                "무료 견적", "포트폴리오 공개",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 기업 홍보영상 빠른 납품",
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
            "weight": 0.05,
            "condition_search_example": "브랜딩 디자인 포트폴리오",
        },
        "ai_tab_context": {
            "keywords": [
                "당일 제작 가능", "무제한 수정", "빠른 납품",
                "로고 디자인 전문", "명함 당일 제작", "무료 견적 가능",
                "소량 인쇄 가능", "온라인 상담 가능",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 로고 디자인 당일 제작",
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
            "weight": 0.05,
            "condition_search_example": "가성비 청소 업체",
        },
        "ai_tab_context": {
            "keywords": [
                "당일 방문 가능", "무료 견적", "정기 서비스 가능",
                "이사 후 청소 전문", "주말 영업", "여성 전담 직원",
                "특수 청소 전문", "방역 포함",
            ],
            "weight": 0.05,
            "condition_search_example": "당일 이사 후 청소 업체",
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
    # 전문분야(0.30) + 지역전문(0.25) + 서비스조건(0.20) + 신뢰경력(0.15) + 운영조건(0.05) + ai_tab_context(0.05) = 1.0
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
            "weight": 0.05,
            "condition_search_example": "강남 주말 부동산 상담",
        },
        "ai_tab_context": {
            "keywords": [
                "전문지역", "매물유형", "거래실적", "수수료", "전세매매",
                "원룸전문", "아파트전문", "상가전문", "투자상담", "갭투자",
                "시세조회", "분양정보", "임대관리", "학군정보", "재개발정보",
            ],
            "weight": 0.05,
            "description": "AI탭에서 부동산 중개 검색 시 자주 나오는 정보 요청 키워드",
        },
    },

    # § 2.17 인테리어·시공 (지역 기반)
    # 시공분야(0.30) + 공간유형(0.20) + 견적가격(0.20) + 공기품질(0.20) + 포트폴리오(0.05) + ai_tab_context(0.05) = 1.0
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
            "weight": 0.05,
            "condition_search_example": "강남 인테리어 포트폴리오",
        },
        "ai_tab_context": {
            "keywords": [
                "시공분야", "평당단가", "견적방법", "시공기간", "포트폴리오",
                "AS보장", "자재브랜드", "3D설계", "무료견적", "방문견적",
                "아파트전문", "상업공간전문", "부분시공", "전체시공", "시공사례",
            ],
            "weight": 0.05,
            "description": "AI탭에서 인테리어 업체 검색 시 자주 나오는 정보 요청 키워드",
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
            "weight": 0.05,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "당일 수리 가능", "무료 견적", "보험 처리 가능",
                "수입차 전문", "픽업 서비스", "주말 영업",
                "정품 부품 사용", "경력 10년 이상",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 당일 자동차 수리 보험 처리",
        },
    },

    # § 2.19 마사지·스파
    "massage": {
        "전문시술": {
            "keywords": ["스웨디시", "타이마사지", "아로마마사지", "스포츠마사지", "림프마사지", "딥티슈"],
            "weight": 0.30,
            "condition_search_example": "강남 스웨디시 마사지",
        },
        "공간환경": {
            "keywords": ["프라이빗룸", "커플룸", "1:1 전담", "깔끔한 시설", "조용한 분위기"],
            "weight": 0.20,
            "condition_search_example": "강남 프라이빗 마사지",
        },
        "운영조건": {
            "keywords": ["당일 예약 가능", "야간 영업", "주차 가능", "365일 운영", "예약 없이 방문"],
            "weight": 0.25,
            "condition_search_example": "강남 야간 마사지",
        },
        "가격혜택": {
            "keywords": ["첫방문 할인", "정기권 있음", "합리적 가격", "패키지 할인"],
            "weight": 0.15,
            "condition_search_example": "강남 마사지 정기권",
        },
        "신뢰전문성": {
            "keywords": ["자격증 보유", "경력 관리사", "위생 관리 철저", "남성 관리사 가능", "여성 전용"],
            "weight": 0.05,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "당일 예약 가능", "프라이빗룸 있음", "커플 마사지 가능",
                "야간 영업", "여성 전용 관리사", "주차 가능",
                "첫방문 이벤트", "1:1 전담 관리",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 프라이빗 커플 마사지",
        },
    },

    # § 2.20 피부관리실·에스테틱
    "skincare": {
        "전문시술": {
            "keywords": ["모공케어", "여드름 관리", "미백 관리", "안티에이징", "수분 케어", "탄력 관리"],
            "weight": 0.30,
            "condition_search_example": "강남 모공케어 피부관리",
        },
        "기기장비": {
            "keywords": ["레이저 시술", "RF 리프팅", "LED 테라피", "초음파 기기", "갈바닉"],
            "weight": 0.20,
            "condition_search_example": "강남 RF리프팅 피부관리",
        },
        "공간환경": {
            "keywords": ["1:1 전담 관리", "프라이빗룸", "여성 전용", "청결한 시설"],
            "weight": 0.20,
            "condition_search_example": "강남 프라이빗 피부관리",
        },
        "운영조건": {
            "keywords": ["당일 예약 가능", "야간 영업", "주차 가능", "정기 관리 프로그램"],
            "weight": 0.20,
            "condition_search_example": "강남 피부관리 당일 예약",
        },
        "가격혜택": {
            "keywords": ["첫방문 이벤트", "패키지 할인", "정기권", "합리적 가격"],
            "weight": 0.05,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "당일 예약 가능", "1:1 전담 관리", "여성 전용",
                "야간 영업", "첫방문 이벤트", "프라이빗룸",
                "레이저 시술 가능", "피부 상담 무료",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 여성 전용 피부관리 당일",
        },
    },

    # § 2.21 세무·회계
    "accounting": {
        "전문분야": {
            "keywords": ["기장대행", "법인세 신고", "소득세 신고", "부가세 신고", "세무조사 대리", "절세 컨설팅"],
            "weight": 0.35,
            "condition_search_example": "강남 기장대행 세무사",
        },
        "창업지원": {
            "keywords": ["법인설립", "사업자등록", "창업 세무 지원", "스타트업 전문"],
            "weight": 0.25,
            "condition_search_example": "강남 법인설립 세무사",
        },
        "신뢰경력": {
            "keywords": ["세무사 직접 상담", "공인회계사", "경력 10년+", "대형 기업 경험", "언론 보도"],
            "weight": 0.25,
            "condition_search_example": "",
        },
        "상담조건": {
            "keywords": ["초기 무료 상담", "온라인 상담 가능", "빠른 응대", "명확한 수수료"],
            "weight": 0.10,
            "condition_search_example": "강남 무료 세무 상담",
        },
        "ai_tab_context": {
            "keywords": [
                "기장비용", "세무 상담 방법", "법인세 신고", "개인사업자 세무", "창업 세무 지원",
                "온라인 상담 가능", "방문 상담", "무료 초기 상담", "수수료 투명", "절세 컨설팅",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 소규모 법인 기장대행 세무사",
        },
    },

    # § 2.22 꽃집·화원
    "flower": {
        "상품구성": {
            "keywords": ["생화 꽃다발", "드라이플라워", "화환", "화분", "꽃바구니", "프리저브드"],
            "weight": 0.30,
            "condition_search_example": "강남 프리저브드 꽃다발",
        },
        "서비스": {
            "keywords": ["당일 배달", "전국 배송", "맞춤 제작", "정기 구독", "픽업 가능"],
            "weight": 0.30,
            "condition_search_example": "강남 꽃 당일 배달",
        },
        "용도목적": {
            "keywords": ["생일 선물", "결혼기념일", "프러포즈", "졸업 축하", "장례 화환", "개업 축하"],
            "weight": 0.25,
            "condition_search_example": "강남 프러포즈 꽃다발",
        },
        "운영정보": {
            "keywords": ["주차 가능", "당일 제작 가능", "온라인 주문", "카카오 주문"],
            "weight": 0.10,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "꽃 종류", "당일 배달 가능", "전국 배송", "선물 포장 가능", "맞춤 제작",
                "프러포즈 용품", "생일 꽃다발", "카카오 주문 가능", "결제 방법", "주차 가능",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 프러포즈 꽃다발 당일 배달",
        },
    },

    # § 2.23 세탁소
    "laundry": {
        "서비스종류": {
            "keywords": ["드라이클리닝", "이불 세탁", "가죽 세탁", "명품 케어", "운동화 세탁", "카펫 세탁"],
            "weight": 0.35,
            "condition_search_example": "강남 드라이클리닝 세탁소",
        },
        "편의성": {
            "keywords": ["수거 배달 세탁", "당일 완성", "빠른 세탁", "24시간 코인세탁", "픽업 서비스"],
            "weight": 0.30,
            "condition_search_example": "강남 수거배달 세탁소",
        },
        "전문성": {
            "keywords": ["얼룩 제거", "복원 세탁", "스팀 다림질", "수선 가능", "섬세한 케어"],
            "weight": 0.25,
            "condition_search_example": "강남 얼룩제거 세탁소",
        },
        "운영정보": {
            "keywords": ["주차 가능", "주말 영업", "합리적 가격", "오랜 경력"],
            "weight": 0.05,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "수거 배달 가능", "드라이클리닝 가격", "처리 기간", "픽업 서비스", "당일 완성",
                "이불 세탁 가능", "명품 케어 가능", "얼룩 제거 전문", "운영시간", "주차 가능",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 이불 수거배달 세탁소",
        },
    },

    # § 2.24 키즈카페·어린이
    "kids": {
        "시설놀이": {
            "keywords": ["볼풀장", "미끄럼틀", "클라이밍", "모래놀이", "트램펄린", "역할놀이"],
            "weight": 0.30,
            "condition_search_example": "강남 키즈카페 볼풀",
        },
        "연령조건": {
            "keywords": ["영아 가능", "신생아 입장 가능", "36개월 이하", "초등생 가능", "연령 제한 없음"],
            "weight": 0.25,
            "condition_search_example": "강남 영아 키즈카페",
        },
        "운영서비스": {
            "keywords": ["생일파티 가능", "단체 예약", "음식 반입 가능", "주차 가능", "수유실"],
            "weight": 0.25,
            "condition_search_example": "강남 생일파티 키즈카페",
        },
        "안전위생": {
            "keywords": ["안전요원 상주", "위생 관리", "정기 소독", "CCTV 설치"],
            "weight": 0.15,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "연령 제한", "입장 가능 개월수", "생일파티 가능", "단체 예약", "음식 반입",
                "주차 가능", "수유실 있음", "유모차 입장 가능", "입장료", "운영시간",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 36개월 이하 키즈카페 주차",
        },
    },

    # § 2.25 스터디카페·독서실
    "study": {
        "공간시설": {
            "keywords": ["1인 독립석", "4인 스터디룸", "화상회의실", "프린터 무료", "충전기 비치"],
            "weight": 0.30,
            "condition_search_example": "강남 1인 독립석 스터디카페",
        },
        "운영조건": {
            "keywords": ["24시간 운영", "연중무휴", "주차 가능", "예약 없이 방문", "당일 이용 가능"],
            "weight": 0.30,
            "condition_search_example": "강남 24시간 스터디카페",
        },
        "요금혜택": {
            "keywords": ["시간권", "월정액", "무제한 커피", "정기권 할인", "첫방문 이벤트"],
            "weight": 0.25,
            "condition_search_example": "강남 스터디카페 월정액",
        },
        "환경": {
            "keywords": ["조용한 환경", "쾌적한 공조", "빠른 와이파이", "금식 가능", "음료 반입"],
            "weight": 0.10,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "좌석 종류", "1인 독립석 여부", "스터디룸 예약", "운영시간", "요금제",
                "무료 커피 제공", "프린터 이용", "주차 가능", "예약 없이 방문", "와이파이 속도",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 24시간 1인 독립석 스터디카페",
        },
    },

    # § 2.26 공방·원데이클래스
    "workshop": {
        "분야종류": {
            "keywords": ["도자기 공방", "가죽공예", "플라워 클래스", "캔들 만들기", "목공", "그림 클래스", "향수 만들기"],
            "weight": 0.35,
            "condition_search_example": "강남 도자기 공방 원데이클래스",
        },
        "수업형태": {
            "keywords": ["원데이클래스", "정기수업", "단체 체험", "커플 클래스", "소수정예"],
            "weight": 0.30,
            "condition_search_example": "강남 원데이클래스 공방",
        },
        "서비스조건": {
            "keywords": ["재료비 포함", "완성품 가져가기", "초보 환영", "예약 필수", "주차 가능"],
            "weight": 0.20,
            "condition_search_example": "강남 공방 재료비 포함",
        },
        "운영정보": {
            "keywords": ["주말 클래스", "야간 수업", "선물 포장", "단체 할인", "기업 체험"],
            "weight": 0.10,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "체험 종류", "예약 방법", "재료비 포함 여부", "최소 인원", "결과물 가져가기",
                "커플 클래스", "단체 체험", "초보 환영", "소요 시간", "주차 가능",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 도자기 공방 원데이 커플",
        },
    },

    # § 2.27 댄스·발레 스튜디오 (신규 2026-05-13)
    "dance": {
        "facility": {
            "keywords": ["댄스학원", "댄스스튜디오", "발레학원", "연습실", "전용 연습실"],
            "weight": 0.20,
            "condition_search_example": "강남 댄스스튜디오",
        },
        "style": {
            "keywords": ["방송댄스", "힙합댄스", "재즈댄스", "발레", "걸스힙합", "왁킹", "스트릿댄스"],
            "weight": 0.25,
            "condition_search_example": "강남 방송댄스 학원",
        },
        "features": {
            "keywords": ["소수정예", "초보 환영", "성인 취미반", "어린이반", "1:1 레슨"],
            "weight": 0.25,
            "condition_search_example": "강남 성인 취미 댄스 학원",
        },
        "booking": {
            "keywords": ["체험 수업", "월정액", "주차 가능", "당일 예약 가능"],
            "weight": 0.15,
            "condition_search_example": "강남 댄스 체험 수업",
        },
        "성과결과": {
            "keywords": ["공연 기회", "발표회 개최", "콩쿠르 참가", "영상 촬영 제공"],
            "weight": 0.10,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "수업 종류", "성인 취미반", "어린이반", "체험 수업 가능", "월정액 요금",
                "주차 가능", "샤워실 완비", "유연한 일정", "소수정예", "발표회 기회",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 성인 취미 방송댄스 체험",
        },
    },

    # § 2.28 골프연습장 (신규 2026-05-13)
    "golf": {
        "facility": {
            "keywords": ["골프연습장", "스크린골프", "실내골프", "타석 연습"],
            "weight": 0.25,
            "condition_search_example": "강남 실내골프 연습장",
        },
        "features": {
            "keywords": ["레슨 가능", "개인 부스", "탄도 분석", "시뮬레이터", "스윙 분석"],
            "weight": 0.30,
            "condition_search_example": "강남 탄도 분석 골프 레슨",
        },
        "service": {
            "keywords": ["24시간 운영", "초보 환영", "주차 가능", "PGA 자격 코치"],
            "weight": 0.25,
            "condition_search_example": "강남 24시간 골프연습장",
        },
        "pricing": {
            "keywords": ["월정액", "시간권", "1회권", "합리적 가격"],
            "weight": 0.15,
            "condition_search_example": "강남 골프연습장 월정액",
        },
        "ai_tab_context": {
            "keywords": [
                "타석 수", "레슨 가능 여부", "운영시간", "예약 방법", "요금제",
                "주차 가능", "스크린 종류", "탄도 분석 장비", "초보 환영", "1회권 가능",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 초보 레슨 가능 골프연습장",
        },
    },

    # § 2.29 수영·아쿠아 (신규 2026-05-13)
    "swim": {
        "facility": {
            "keywords": ["수영장", "아쿠아", "실내수영장", "온수풀"],
            "weight": 0.15,
            "condition_search_example": "강남 온수 수영장",
        },
        "program": {
            "keywords": ["수영강습", "아쿠아로빅", "성인 수영", "어린이 수영", "마스터즈 수영"],
            "weight": 0.30,
            "condition_search_example": "강남 성인 수영 강습",
        },
        "features": {
            "keywords": ["소수정예", "초보반", "자유수영", "레인 분리"],
            "weight": 0.25,
            "condition_search_example": "강남 초보 수영 강습",
        },
        "booking": {
            "keywords": ["연간 등록", "월정액", "주차 가능", "당일 등록 가능"],
            "weight": 0.25,
            "condition_search_example": "강남 수영 월정액",
        },
        "ai_tab_context": {
            "keywords": [
                "수업 종류", "어린이 수영 가능", "성인 취미반", "레인 분리 여부", "운영시간",
                "등록 방법", "샤워실 완비", "주차 가능", "월정액 요금", "자유 수영 가능",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 성인 초보 수영 강습 등록",
        },
    },

    # § 2.30 찜질방·사우나 (신규 2026-05-13)
    "jjimjil": {
        "facility": {
            "keywords": ["찜질방", "사우나", "한증막", "황토방", "소금방"],
            "weight": 0.25,
            "condition_search_example": "강남 찜질방 황토방",
        },
        "features": {
            "keywords": ["스파풀", "가족실", "커플실", "냉탕", "온탕", "노천탕"],
            "weight": 0.25,
            "condition_search_example": "강남 스파풀 찜질방",
        },
        "service": {
            "keywords": ["24시간 운영", "주차 가능", "식사 제공", "수면실", "휴게공간"],
            "weight": 0.30,
            "condition_search_example": "강남 24시간 사우나",
        },
        "pricing": {
            "keywords": ["입장료", "정기권", "합리적 가격"],
            "weight": 0.15,
            "condition_search_example": "강남 찜질방 정기권",
        },
        "ai_tab_context": {
            "keywords": [
                "시설 종류", "운영시간", "입장료", "정기권 가능", "주차 가능",
                "식사 제공", "수면실 있음", "가족실 이용", "짐 보관", "수건 제공",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 24시간 찜질방 가족실 주차",
        },
    },

    # § 2.31 음악교실·레슨 (신규 2026-05-13 — music taxonomy의 소규모 교습소 특화)
    "music_lesson": {
        "instrument": {
            "keywords": ["피아노 레슨", "기타 레슨", "바이올린", "드럼", "플루트", "우쿨렐레"],
            "weight": 0.30,
            "condition_search_example": "강남 피아노 레슨 교습소",
        },
        "program": {
            "keywords": ["보컬 레슨", "입시 준비", "취미반", "성인 레슨"],
            "weight": 0.25,
            "condition_search_example": "강남 성인 보컬 레슨",
        },
        "features": {
            "keywords": ["어린이 전용", "성인 가능", "소수정예", "1:1 레슨", "초보 환영"],
            "weight": 0.25,
            "condition_search_example": "강남 1대1 음악 레슨",
        },
        "service": {
            "keywords": ["홈레슨 출장", "주차 가능", "체험 수업", "유연한 일정"],
            "weight": 0.15,
            "condition_search_example": "강남 음악 교습소 체험 수업",
        },
        "ai_tab_context": {
            "keywords": [
                "악기 종류", "레슨 방식", "체험 레슨 가능", "성인 입문 가능", "어린이 가능",
                "1대1 개인 레슨", "주차 가능", "요금", "유연한 일정", "홈레슨 출장",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 성인 입문 피아노 레슨 교습소",
        },
    },

    # § 2.32 요리교실·쿠킹클래스 (신규 2026-05-13)
    "cooking": {
        "program": {
            "keywords": ["원데이 쿠킹", "베이킹 클래스", "한식 요리", "이탈리안", "일식 요리", "디저트 클래스"],
            "weight": 0.30,
            "condition_search_example": "강남 한식 원데이 쿠킹 클래스",
        },
        "features": {
            "keywords": ["소수정예", "재료비 포함", "초보 환영", "정기 수업"],
            "weight": 0.25,
            "condition_search_example": "강남 요리교실 재료비 포함",
        },
        "special": {
            "keywords": ["어린이 요리", "커플 클래스", "자격증 과정", "단체 클래스"],
            "weight": 0.25,
            "condition_search_example": "강남 커플 쿠킹 클래스",
        },
        "service": {
            "keywords": ["주차 가능", "앞치마 제공", "레시피 제공", "예약 필수"],
            "weight": 0.15,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "요리 종류", "재료비 포함 여부", "예약 방법", "최소 인원", "소요 시간",
                "커플 클래스", "어린이 요리 가능", "결과물 포장", "주차 가능", "초보 환영",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 커플 쿠킹 클래스 재료 포함",
        },
    },

    # § 2.33 스파 (마사지와 분리, 신규 2026-05-13)
    "spa": {
        "treatment": {
            "keywords": ["아로마테라피", "바디랩", "스톤테라피", "스팀사우나", "스파풀", "머드팩"],
            "weight": 0.30,
            "condition_search_example": "강남 아로마스파 바디랩",
        },
        "course": {
            "keywords": ["힐링 코스", "커플스파", "프라이빗 패키지", "데이스파", "풀바디 케어"],
            "weight": 0.25,
            "condition_search_example": "강남 커플스파 풀패키지",
        },
        "facilities": {
            "keywords": ["프라이빗룸", "스파풀", "사우나", "족욕탕", "온탕·냉탕"],
            "weight": 0.25,
            "condition_search_example": "",
        },
        "service": {
            "keywords": ["당일 예약", "고급 케어", "전문 테라피스트", "선물권 구매 가능"],
            "weight": 0.15,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "프로그램 종류", "예약 방법", "프라이빗 룸 여부", "가격대", "소요 시간",
                "커플 스파 가능", "당일 예약 가능", "선물권 구매", "주차 가능", "드레스 코드",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 커플 프라이빗 스파 당일 예약",
        },
    },

    # § 2.34 발레 (댄스와 분리, 신규 2026-05-13)
    "ballet": {
        "program": {
            "keywords": ["클래식 발레", "성인 발레", "어린이 발레", "콩쿠르 준비", "입시반"],
            "weight": 0.30,
            "condition_search_example": "강남 성인 발레 취미반",
        },
        "level": {
            "keywords": ["초보 환영", "취미반", "전문반", "심화 과정", "발레리나 전문"],
            "weight": 0.25,
            "condition_search_example": "강남 발레 초보 취미반",
        },
        "features": {
            "keywords": ["소수정예", "1:1 레슨", "체험 수업", "유연성 향상", "자세 교정"],
            "weight": 0.25,
            "condition_search_example": "",
        },
        "service": {
            "keywords": ["주차 가능", "연습복 대여", "발레 용품 구비", "무료 체험 가능"],
            "weight": 0.15,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "수업 종류", "연령 제한", "체험 수업 가능", "성인 취미반", "발레복 대여",
                "소수정예", "발표회 참가", "주차 가능", "월정액", "강사 경력",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 성인 취미 발레 체험 수업",
        },
    },

    # § 2.35 음악교실 (그룹·학원형, 신규 2026-05-13)
    "music_class": {
        "instrument": {
            "keywords": ["피아노", "바이올린", "첼로", "플루트", "드럼", "기타", "성악"],
            "weight": 0.30,
            "condition_search_example": "강남 피아노 학원 초등",
        },
        "program": {
            "keywords": ["입시반", "취미반", "그룹 레슨", "방과후 클래스", "어린이 전용"],
            "weight": 0.25,
            "condition_search_example": "강남 음악교실 입시반",
        },
        "level": {
            "keywords": ["성인 가능", "성인 취미", "초보 환영", "전문 강사", "콩쿠르 준비"],
            "weight": 0.25,
            "condition_search_example": "",
        },
        "service": {
            "keywords": ["주차 가능", "셔틀버스", "악기 대여 가능", "연습실 개방"],
            "weight": 0.15,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "악기 종류", "연령 대상", "입시반 여부", "성인 취미 가능", "체험 수업",
                "주차 가능", "악기 대여", "발표회 기회", "수업 방식", "월 수강료",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 초등 바이올린 학원 체험",
        },
    },

    # § 2.36 의류 (패션과 분리, 신규 2026-05-13)
    "clothing": {
        "target": {
            "keywords": ["남성 의류", "여성 의류", "아동 의류", "유아 의류", "남녀공용"],
            "weight": 0.30,
            "condition_search_example": "강남 여성 의류 맞춤 제작",
        },
        "type": {
            "keywords": ["교복", "단체복", "근무복", "운동복", "캐주얼", "포멀"],
            "weight": 0.25,
            "condition_search_example": "강남 교복 수선",
        },
        "service": {
            "keywords": ["맞춤 제작", "수선 가능", "원단 직판", "당일 배송", "정기 세일"],
            "weight": 0.25,
            "condition_search_example": "",
        },
        "features": {
            "keywords": ["친환경 소재", "국내 제조", "사이즈 다양", "무료 반품"],
            "weight": 0.15,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "의류 종류", "사이즈 범위", "맞춤 제작 가능", "수선 가능", "운영시간",
                "온라인 주문 연동", "당일 픽업", "주차 가능", "결제 방법", "가격대",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 단체복 맞춤 제작 업체",
        },
    },

    # § 2.36-B 패션·편집샵 (fashion alias를 위한 섹션 — 2026-05-17 추가)
    # 브랜드스타일(0.30) + 상품구색(0.25) + 쇼핑경험(0.20) + 운영정보(0.15) + 가격혜택(0.05) + ai_tab_context(0.05) = 1.0
    "fashion": {
        "브랜드스타일": {
            "keywords": ["편집샵", "독립 브랜드", "국내 브랜드", "해외 브랜드", "한정판", "시즌 신상", "빈티지"],
            "weight": 0.30,
            "condition_search_example": "강남 편집샵 빈티지 브랜드",
        },
        "상품구색": {
            "keywords": ["남성 의류", "여성 의류", "남녀공용", "아우터", "캐주얼", "스트릿", "포멀", "스포티"],
            "weight": 0.25,
            "condition_search_example": "강남 남성 스트릿 편집샵",
        },
        "쇼핑경험": {
            "keywords": ["스타일링 상담", "피팅룸 있음", "시착 가능", "반품 쉬움", "선물 포장", "사이즈 교환"],
            "weight": 0.20,
            "condition_search_example": "편집샵 스타일링 상담 가능",
        },
        "운영정보": {
            "keywords": ["온라인 주문 가능", "당일 픽업", "주말 영업", "주차 가능", "직접 수령 가능"],
            "weight": 0.15,
            "condition_search_example": "강남 편집샵 당일 픽업",
        },
        "가격혜택": {
            "keywords": ["시즌오프 세일", "멤버십 할인", "첫구매 할인", "포인트 적립"],
            "weight": 0.05,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "스타일링 상담 가능", "트렌드 코디 추천", "피팅룸 완비", "사이즈 다양",
                "온라인 주문 후 픽업", "당일 픽업 가능", "반품·교환 쉬움", "선물 포장 가능",
                "남녀 모두 가능", "빈티지 아이템 구비",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 스타일링 상담 편집샵 남성",
        },
    },

    # § 2.37 체험공간 (방탈출과 분리, 신규 2026-05-13)
    "experience": {
        "activity": {
            "keywords": ["도예 체험", "향수 만들기", "초콜릿 공방", "천연 비누", "캔들 공방", "도자기"],
            "weight": 0.30,
            "condition_search_example": "강남 도예 체험 원데이",
        },
        "occasion": {
            "keywords": ["가족 체험", "어린이 체험", "커플 체험", "생일파티", "데이트 코스"],
            "weight": 0.25,
            "condition_search_example": "강남 가족 체험 주말",
        },
        "features": {
            "keywords": ["소규모", "재료비 포함", "예약 필수", "체험 키트 증정", "원데이 클래스"],
            "weight": 0.25,
            "condition_search_example": "",
        },
        "service": {
            "keywords": ["주차 가능", "사진 촬영 가능", "완성품 포장", "선물 포장"],
            "weight": 0.15,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "체험 종류", "예약 방법", "재료비 포함", "최소 인원", "소요 시간",
                "커플·가족 가능", "어린이 참여", "완성품 증정", "주차 가능", "초보 환영",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 커플 도예 체험 원데이 클래스",
        },
    },

    # § 2.38 방탈출 (체험공간과 분리, 신규 2026-05-13)
    "escape": {
        "theme": {
            "keywords": ["방탈출", "공포 테마", "힐링 테마", "스토리 테마", "SF 테마"],
            "weight": 0.30,
            "condition_search_example": "강남 방탈출 공포 테마",
        },
        "features": {
            "keywords": ["체험형 게임", "스토리형", "배우 참여형", "몰입형"],
            "weight": 0.25,
            "condition_search_example": "강남 배우 참여 방탈출",
        },
        "booking": {
            "keywords": ["단체 예약", "커플 코스", "생일파티", "예약 필수", "2인 이상"],
            "weight": 0.25,
            "condition_search_example": "강남 단체 방탈출 예약",
        },
        "service": {
            "keywords": ["주차 가능", "힌트 제공", "사진 촬영 가능", "음료 제공"],
            "weight": 0.15,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "테마 종류", "참가 인원", "예약 방법", "운영시간", "공포 테마 여부",
                "커플 코스", "생일파티 가능", "가격대", "주차 가능", "힌트 제공",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 2인 커플 방탈출 예약 가능",
        },
    },

    # ── 신규 14개 업종 (v5.7 — 2026-05-13) ──────────────────────────────────

    "dental": {
        "treatment": {
            "keywords": ["임플란트", "치아교정", "스케일링", "충치 치료", "라미네이트", "사랑니 발치"],
            "weight": 0.30,
            "condition_search_example": "강남 임플란트 잘하는 치과",
        },
        "speciality": {
            "keywords": ["소아치과", "어린이치과", "교정 전문", "임플란트 전문", "심미치과"],
            "weight": 0.25,
            "condition_search_example": "강남 어린이치과 무통",
        },
        "features": {
            "keywords": ["무통마취", "당일 치료", "야간 진료", "주말 진료", "디지털 장비"],
            "weight": 0.25,
            "condition_search_example": "",
        },
        "service": {
            "keywords": ["주차 가능", "당일 예약", "실손 적용", "의료보험 적용"],
            "weight": 0.15,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "진료 분야", "당일 예약 가능", "야간·주말 진료", "무통마취 여부", "어린이치과 가능",
                "실손 보험 적용", "치료 비용 안내", "주차 가능", "대기 시간", "초진 예약",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 어린이 치과 무통 당일 예약",
        },
    },

    "oriental_medicine": {
        "treatment": {
            "keywords": ["침", "추나요법", "한약 처방", "뜸", "부항", "약침"],
            "weight": 0.30,
            "condition_search_example": "강남 허리 디스크 한의원",
        },
        "condition": {
            "keywords": ["허리 디스크", "한방 다이어트", "성장 클리닉", "산후조리", "두통·편두통", "불면증"],
            "weight": 0.25,
            "condition_search_example": "강남 한방 다이어트 한의원",
        },
        "features": {
            "keywords": ["면역력 강화", "자연 치유", "체질 개선", "당일 예약", "여성 전문"],
            "weight": 0.25,
            "condition_search_example": "",
        },
        "service": {
            "keywords": ["주차 가능", "야간 진료", "주말 진료", "전화 상담"],
            "weight": 0.15,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "진료 분야", "한약 처방 가능", "예약 방법", "야간·주말 진료", "초진 상담",
                "건강보험 적용", "치료 비용", "주차 가능", "대기 시간", "전화 상담",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 허리디스크 한의원 당일 예약",
        },
    },

    "optics": {
        "product": {
            "keywords": ["안경 맞춤", "도수 안경", "선글라스", "초고층 렌즈", "블루라이트 차단"],
            "weight": 0.30,
            "condition_search_example": "강남 도수 안경 맞춤",
        },
        "service": {
            "keywords": ["무료 시력검사", "렌즈 처방", "라식 상담", "1시간 제작", "당일 수령"],
            "weight": 0.25,
            "condition_search_example": "강남 안경 당일 제작",
        },
        "features": {
            "keywords": ["브랜드 다양", "국산 프레임", "가격 투명", "무료 조정 서비스"],
            "weight": 0.25,
            "condition_search_example": "",
        },
        "accessibility": {
            "keywords": ["주차 가능", "예약 불필요", "어린이 안경 전문"],
            "weight": 0.15,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "안경 종류", "제작 소요 시간", "무료 시력 검사", "가격대", "운영시간",
                "예약 없이 방문", "어린이 안경 전문", "주차 가능", "라식 상담", "렌즈 처방",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 안경 당일 제작 무료 시력 검사",
        },
    },

    "semi_permanent": {
        "treatment": {
            "keywords": ["눈썹 문신", "아이라인 반영구", "입술 반영구", "헤어라인", "앞머리 반영구"],
            "weight": 0.30,
            "condition_search_example": "강남 눈썹 문신 자연스러운",
        },
        "technique": {
            "keywords": ["엠보 눈썹", "페더링", "콤보 눈썹", "수정 가능", "리무빙 가능"],
            "weight": 0.25,
            "condition_search_example": "강남 엠보 눈썹 자연스러운",
        },
        "features": {
            "keywords": ["마취 크림 적용", "전문 아티스트", "위생 철저", "포트폴리오 공개", "지속력 2년+"],
            "weight": 0.25,
            "condition_search_example": "",
        },
        "service": {
            "keywords": ["당일 예약", "주차 가능", "프라이빗 공간", "남성 가능"],
            "weight": 0.15,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "시술 종류", "마취 방법", "유지 기간", "가격대", "예약 방법",
                "포트폴리오 확인", "수정 가능", "리무빙 가능", "남성 가능", "주차 가능",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 눈썹 문신 자연스러운 반영구 예약",
        },
    },

    "martial_arts": {
        "type": {
            "keywords": ["태권도", "검도", "유도", "합기도", "무에타이", "주짓수", "킥복싱"],
            "weight": 0.30,
            "condition_search_example": "강남 태권도 어린이",
        },
        "program": {
            "keywords": ["유소년반", "성인반", "여성 전용반", "단증 취득", "심사 대비", "대회 준비"],
            "weight": 0.25,
            "condition_search_example": "강남 검도 성인 취미",
        },
        "features": {
            "keywords": ["체험 수업", "초보 환영", "소수정예", "전문 사범", "안전 장비 구비"],
            "weight": 0.25,
            "condition_search_example": "",
        },
        "service": {
            "keywords": ["주차 가능", "방과후 클래스", "셔틀버스", "당일 체험 가능"],
            "weight": 0.15,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "종목 종류", "연령대", "체험 수업 가능", "단증 취득 과정", "시간표",
                "여성 전용반", "성인 취미", "주차 가능", "월 수강료", "안전 장비 대여",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 성인 태권도 주짓수 체험 수업",
        },
    },

    "climbing": {
        "type": {
            "keywords": ["볼더링", "리드 클라이밍", "탑로핑", "킬터보드", "캠퍼스보드"],
            "weight": 0.30,
            "condition_search_example": "강남 볼더링 초보",
        },
        "program": {
            "keywords": ["초보 강습", "레벨별 수업", "개인 레슨", "그룹 레슨", "대회 준비"],
            "weight": 0.25,
            "condition_search_example": "강남 클라이밍 초보 강습",
        },
        "features": {
            "keywords": ["장비 대여", "월정액", "자유 이용", "난이도 다양", "안전 강습 무료"],
            "weight": 0.25,
            "condition_search_example": "",
        },
        "service": {
            "keywords": ["주차 가능", "샤워실 완비", "락커 보관", "음료 판매"],
            "weight": 0.15,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "난이도 범위", "장비 대여 가능", "레슨 가능", "초보 강습", "운영시간",
                "월정액 요금", "자유 이용", "주차 가능", "샤워실 완비", "락커 보관",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 볼더링 초보 강습 장비 대여",
        },
    },

    "art_class": {
        "program": {
            "keywords": ["어린이 미술", "입시 미술", "취미 미술", "성인 드로잉", "수채화 클래스"],
            "weight": 0.30,
            "condition_search_example": "강남 어린이 미술학원",
        },
        "technique": {
            "keywords": ["수채화", "유화", "아크릴화", "드로잉", "소묘·크로키", "일러스트"],
            "weight": 0.25,
            "condition_search_example": "강남 수채화 취미 미술",
        },
        "features": {
            "keywords": ["1:1 지도", "소수정예", "전시 참가 기회", "포트폴리오 제작", "입시 합격률"],
            "weight": 0.25,
            "condition_search_example": "",
        },
        "service": {
            "keywords": ["주차 가능", "재료비 포함", "체험 수업", "주말 수업"],
            "weight": 0.15,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "수업 종류", "연령 제한", "강사 경력", "체험 수업 가능", "재료비 포함",
                "입시 미술 가능", "1대1 지도", "발표 기회", "주말 수업", "주차 가능",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 성인 취미 수채화 체험 미술",
        },
    },

    "childcare": {
        "type": {
            "keywords": ["어린이집", "유치원", "영어유치원", "방과후 교실", "종일반"],
            "weight": 0.30,
            "condition_search_example": "강남 영어유치원 추천",
        },
        "curriculum": {
            "keywords": ["놀이중심교육", "체험학습", "예체능 강화", "영어 수업", "코딩 교육"],
            "weight": 0.25,
            "condition_search_example": "강남 어린이집 영어 특화",
        },
        "features": {
            "keywords": ["친환경 급식", "CCTV 설치", "소규모 반", "보조교사 운영", "보육료 지원"],
            "weight": 0.25,
            "condition_search_example": "",
        },
        "service": {
            "keywords": ["셔틀버스", "안전 놀이터", "부모 참관 가능", "병설 특기학원"],
            "weight": 0.15,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "보육 시간", "급식 여부", "셔틀버스 운행", "연령 제한", "보육료",
                "부모 참관", "안전 놀이터", "영어 수업", "특기 학원 병설", "CCTV 확인",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 36개월 영어유치원 셔틀버스",
        },
    },

    "car_wash": {
        "service": {
            "keywords": ["손 세차", "자동 세차", "실내 청소", "광택", "왁스 코팅"],
            "weight": 0.30,
            "condition_search_example": "강남 손세차 광택",
        },
        "coating": {
            "keywords": ["유리막 코팅", "PPF 필름", "도장 보호", "세라믹 코팅", "발수 코팅"],
            "weight": 0.25,
            "condition_search_example": "강남 유리막 코팅 세차",
        },
        "features": {
            "keywords": ["당일 가능", "예약 가능", "정기권", "기업 차량 가능", "SUV·대형 가능"],
            "weight": 0.25,
            "condition_search_example": "",
        },
        "accessibility": {
            "keywords": ["주차 여유", "대기 없음", "가격 투명", "친환경 세제"],
            "weight": 0.15,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "세차 종류", "코팅 종류", "예약 방법", "소요 시간", "운영시간",
                "대형 차량 가능", "당일 가능", "가격 안내", "친환경 세제", "주차 여유",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 손세차 예약 가능 당일 가격",
        },
    },

    "electronics_repair": {
        "device": {
            "keywords": ["아이폰 수리", "갤럭시 수리", "노트북 수리", "태블릿 수리", "애플워치 수리"],
            "weight": 0.30,
            "condition_search_example": "강남 아이폰 액정 교체",
        },
        "repair_type": {
            "keywords": ["액정 교체", "배터리 교체", "충전 포트 수리", "카메라 수리", "데이터 복구"],
            "weight": 0.25,
            "condition_search_example": "강남 갤럭시 배터리 교체",
        },
        "features": {
            "keywords": ["당일 수리", "공식 부품", "가격 투명", "무상 AS", "출장 수리"],
            "weight": 0.25,
            "condition_search_example": "",
        },
        "service": {
            "keywords": ["주차 가능", "무료 진단", "예약 가능", "공식 인증 기사"],
            "weight": 0.15,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "수리 종류", "소요 시간", "가격 안내", "당일 수리 가능", "부품 종류",
                "출장 수리 가능", "무료 진단", "운영시간", "주차 가능", "보증 기간",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 아이폰 액정 교체 당일 가격",
        },
    },

    "footwear": {
        "product": {
            "keywords": ["운동화", "구두", "부츠", "샌들", "슬리퍼", "브랜드 스니커즈"],
            "weight": 0.30,
            "condition_search_example": "강남 운동화 브랜드 매장",
        },
        "features": {
            "keywords": ["사이즈 다양", "수제 구두", "신발 수선", "맞춤 제작", "반품 쉬움"],
            "weight": 0.25,
            "condition_search_example": "강남 넓은 사이즈 구두",
        },
        "service": {
            "keywords": ["무료 배송", "당일 배송", "온라인몰 연동", "가격 비교 가능"],
            "weight": 0.25,
            "condition_search_example": "",
        },
        "target": {
            "keywords": ["남성 신발", "여성 신발", "아동 신발", "임산부 신발", "등산화"],
            "weight": 0.15,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "신발 종류", "사이즈 범위", "수선 가능", "맞춤 제작", "운영시간",
                "온라인 주문 가능", "당일 픽업", "주차 가능", "가격대", "브랜드",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 넓은 사이즈 운동화 수선 가능",
        },
    },

    "stationery": {
        "product": {
            "keywords": ["학용품", "필기구", "색연필·사인펜", "미술 재료", "공책·노트"],
            "weight": 0.30,
            "condition_search_example": "강남 미술 재료 문구점",
        },
        "office": {
            "keywords": ["복사 용지", "프린터 토너", "파일·바인더", "사무용 소모품", "사무 가구"],
            "weight": 0.25,
            "condition_search_example": "강남 사무용품 구매",
        },
        "service": {
            "keywords": ["단체 주문", "학교 납품", "기업 납품", "복사·인쇄 서비스", "당일 구매"],
            "weight": 0.25,
            "condition_search_example": "",
        },
        "features": {
            "keywords": ["가격 저렴", "종류 다양", "문구 전문점", "대량 구매 할인"],
            "weight": 0.15,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "상품 종류", "대량 구매 가능", "배달 서비스", "운영시간", "학교·기업 납품",
                "복사·인쇄 서비스", "가격대", "주차 가능", "온라인 주문", "당일 구매",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 학교 납품 문구점 대량 주문",
        },
    },

    "norebang": {
        "type": {
            "keywords": ["코인노래방", "개인 노래방", "연습실 노래방", "파티룸 노래방"],
            "weight": 0.30,
            "condition_search_example": "강남 코인노래방 깨끗한",
        },
        "features": {
            "keywords": ["최신곡 업데이트", "대형 스크린", "방음 완비", "탬버린·마라카스", "음식 반입"],
            "weight": 0.25,
            "condition_search_example": "강남 24시간 노래방",
        },
        "occasion": {
            "keywords": ["생일파티", "단체 예약", "회식 후", "소모임", "데이트"],
            "weight": 0.25,
            "condition_search_example": "강남 생일파티 노래방",
        },
        "service": {
            "keywords": ["24시간 운영", "주차 가능", "음료 판매", "깔끔한 시설"],
            "weight": 0.15,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "룸 종류", "운영시간", "시간당 가격", "예약 방법", "음식 반입 여부",
                "생일파티 가능", "주류 판매", "주차 가능", "깨끗한 시설", "24시간 운영",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 생일파티 24시간 노래방 예약",
        },
    },

    "billiards": {
        "type": {
            "keywords": ["3쿠션", "포켓볼", "볼 당구", "스누커", "4구"],
            "weight": 0.30,
            "condition_search_example": "강남 3쿠션 당구장",
        },
        "program": {
            "keywords": ["당구 레슨", "초보 강습", "개인 레슨", "동호회 모임 가능"],
            "weight": 0.25,
            "condition_search_example": "강남 당구 레슨 초보",
        },
        "features": {
            "keywords": ["개인 큐 보관", "테이블 상태 좋음", "조용한 분위기", "최신 테이블"],
            "weight": 0.25,
            "condition_search_example": "",
        },
        "service": {
            "keywords": ["24시간 운영", "월정액", "주차 가능", "음료 판매", "초보 환영"],
            "weight": 0.15,
            "condition_search_example": "",
        },
        "ai_tab_context": {
            "keywords": [
                "종목 종류", "레슨 가능 여부", "운영시간", "시간당 요금", "월정액",
                "초보 환영", "주차 가능", "분위기", "음료 판매", "개인 큐 보관",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 3쿠션 당구 레슨 초보",
        },
    },

    # ── normalizer 버그 수정으로 신규 독립 분리된 3개 업종 taxonomy (2026-05-18) ──

    # § 2.39 네일샵 (beauty에서 분리)
    # 디자인(0.30) + 케어관리(0.25) + 접근편의(0.20) + 가격서비스(0.20) + ai_tab_context(0.05) = 1.0
    "nail": {
        "디자인": {
            "keywords": [
                "젤네일", "아트네일", "네일아트", "네일연장", "빌더젤",
                "오로라네일", "글리터네일", "그라데이션", "프렌치네일",
                "레이스네일", "꽃네일", "캐릭터네일", "시즌아트",
            ],
            "weight": 0.30,
            "condition_search_example": "강남 젤네일 아트 네일샵",
        },
        "케어관리": {
            "keywords": [
                "케어", "큐티클케어", "손발관리", "발각질제거", "손발케어",
                "네일 보수", "네일 제거", "오프 서비스", "보습관리",
            ],
            "weight": 0.25,
            "condition_search_example": "강남 큐티클 케어 네일샵",
        },
        "접근편의": {
            "keywords": [
                "당일예약", "주차가능", "아이랑 네일", "커플네일",
                "남성 네일 가능", "1인 전담", "프라이빗 공간",
                "예약 없이 방문",
            ],
            "weight": 0.20,
            "condition_search_example": "강남 당일예약 네일샵",
        },
        "가격서비스": {
            "keywords": [
                "가격대", "가성비", "이벤트", "첫방문 할인",
                "정기권", "멤버십", "패키지", "손발 세트",
            ],
            "weight": 0.20,
            "condition_search_example": "강남 합리적 가격 네일샵",
        },
        "ai_tab_context": {
            "keywords": [
                "청결한 시설", "위생 철저", "일회용 도구", "향 없음",
                "조용한 분위기", "네일 상담", "트렌드 디자인",
                "빠른 시술", "오래 지속",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 위생 철저 네일샵 당일예약",
        },
    },

    # § 2.40 요가원 (fitness에서 분리)
    # 수업종류(0.30) + 강사자격(0.25) + 접근편의(0.20) + 가격서비스(0.20) + ai_tab_context(0.05) = 1.0
    "yoga": {
        "수업종류": {
            "keywords": [
                "하타요가", "빈야사", "음요가", "명상요가", "산전요가",
                "산후요가", "아헹가", "인요가", "아쉬탕가", "쿤달리니",
                "초급반", "중급반", "고급반", "소수정예",
            ],
            "weight": 0.30,
            "condition_search_example": "강남 하타요가 초급반",
        },
        "강사자격": {
            "keywords": [
                "전문 강사", "RYT 200", "RYT 500", "자격증 강사",
                "호흡법 지도", "명상 지도", "수련 경력", "친절한 교정",
            ],
            "weight": 0.25,
            "condition_search_example": "강남 자격증 요가 강사 요가원",
        },
        "접근편의": {
            "keywords": [
                "당일등록", "체험수업", "첫수업 무료", "주차가능",
                "지하철 도보", "샤워실 완비", "락커 보관", "요가복 대여",
            ],
            "weight": 0.20,
            "condition_search_example": "강남 체험수업 요가원",
        },
        "가격서비스": {
            "keywords": [
                "월정액", "10회권", "등록비", "가성비", "이벤트",
                "필라테스 병행", "명상 포함",
            ],
            "weight": 0.20,
            "condition_search_example": "강남 가성비 요가원 월정액",
        },
        "ai_tab_context": {
            "keywords": [
                "초보 환영", "조용한 수련 공간", "명상 가능", "소수정예 클래스",
                "아침 수업", "저녁 수업", "주말 수업", "임산부 가능",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 초보 환영 조용한 요가원",
        },
    },

    # § 2.41 청소업체 (living에서 분리)
    # 서비스종류(0.30) + 출장범위(0.25) + 가격서비스(0.20) + 신뢰성(0.20) + ai_tab_context(0.05) = 1.0
    "cleaning": {
        "서비스종류": {
            "keywords": [
                "입주청소", "이사청소", "에어컨청소", "소파청소",
                "거실청소", "원룸청소", "공장청소", "방역청소",
                "욕실청소", "주방청소", "카펫청소", "사무실청소",
            ],
            "weight": 0.30,
            "condition_search_example": "강남 입주청소 업체",
        },
        "출장범위": {
            "keywords": [
                "출장가능", "당일예약", "전국출장", "지역출장",
                "빠른 방문", "당일처리", "주말출장",
            ],
            "weight": 0.25,
            "condition_search_example": "강남 당일예약 청소업체",
        },
        "가격서비스": {
            "keywords": [
                "견적무료", "합리적가격", "정찰제", "패키지할인",
                "정기구독", "월정기청소", "가격투명",
            ],
            "weight": 0.20,
            "condition_search_example": "강남 견적무료 청소업체",
        },
        "신뢰성": {
            "keywords": [
                "업체선정방법", "전문청소부", "자격증보유", "보험가입",
                "친환경세제", "위생관리", "후기많음", "재방문율높음",
            ],
            "weight": 0.20,
            "condition_search_example": "강남 믿을 수 있는 청소업체",
        },
        "ai_tab_context": {
            "keywords": [
                "냄새제거", "새집증후군제거", "살균소독",
                "쾌적한 환경", "이사 전 청소", "이사 후 청소",
                "아이있는집", "반려동물있는집",
            ],
            "weight": 0.05,
            "condition_search_example": "강남 이사 후 청소 당일 가능",
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


def get_category_flags(category: str, cat_key: str) -> dict[str, bool]:
    """카테고리 단위 전역 플래그 조회 (P2-1 신설).

    in_ai_tab: 이 카테고리 키워드가 AI탭 답변 생성 신호로 활용 가능
      - 명시값 우선, 없으면 자동 규칙:
        weight=0.0 → False (키워드 풀·갭 분석 전용, 점수 미반영 → AI탭 신호 아님)
        그 외 → True
    ad_only: 이 키워드는 광고 영역에서 주로 노출 — 유기 점수에서 제외 (기본 False)

    naver_scanner 실측 결과(`in_ai_tab`/`ad_only`)와 교차 검증해 점수·UI 분기 정합성 확보.
    """
    industry = get_industry_keywords(category)
    cat_data = industry.get(cat_key, {})
    if "in_ai_tab" in cat_data:
        in_ai_tab = bool(cat_data["in_ai_tab"])
    elif cat_data.get("weight", 1.0) == 0.0:
        # weight=0.0 카테고리 = 키워드 확장 풀, 점수 미반영 → AI탭 신호 제외
        in_ai_tab = False
    else:
        in_ai_tab = True
    return {
        "in_ai_tab": in_ai_tab,
        "ad_only": bool(cat_data.get("ad_only", False)),
    }


def get_ai_tab_eligible_keywords(category: str) -> list[str]:
    """AI탭 답변 신호로 활용 가능한 키워드만 반환 (in_ai_tab=True 카테고리).

    briefing_engine·naver_scanner 교차 검증에 사용.
    """
    industry = get_industry_keywords(category)
    result: list[str] = []
    for cat_key, cat_data in industry.items():
        if not isinstance(cat_data, dict):
            continue
        flags = get_category_flags(category, cat_key)
        if flags["in_ai_tab"] and not flags["ad_only"]:
            result.extend(cat_data.get("keywords") or [])
    return result


def log_ad_only_mismatch(category: str, scanned_ad_only: bool) -> None:
    """naver_scanner 실측 ad_only 결과와 taxonomy 메타를 교차 검증.

    실측 ad_only=True 이고 taxonomy에 ad_only=False(기본값)인 경우 WARNING 로그를 남긴다.
    Q2 광고 도입 후 taxonomy 메타 업데이트의 근거 데이터로 활용.

    KEYWORD_TAXONOMY 데이터 항목을 직접 수정하지 않는다 —
    실측 축적 후 업종별 메타를 업데이트하는 구조를 유지.
    """
    if not scanned_ad_only:
        return  # 광고 미감지 시 검증 불필요

    industry = get_industry_keywords(category)
    # 업종 전체 카테고리 중 하나라도 taxonomy ad_only=True 이면 사전 분류와 일치
    taxonomy_any_ad_only = any(
        get_category_flags(category, cat_key).get("ad_only", False)
        for cat_key in industry
        if isinstance(industry.get(cat_key), dict)
    )
    if not taxonomy_any_ad_only:
        _logger.warning(
            "[P2-1 ad_only] taxonomy 불일치: category=%s naver_scanner=True taxonomy=False"
            " — 실측 ad_only 발생. Q2 광고 출시 후 taxonomy 메타 업데이트 필요",
            category,
        )
    else:
        _logger.debug(
            "[P2-1 ad_only] taxonomy 일치: category=%s naver_scanner=True taxonomy=True",
            category,
        )


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
        _norm_kw(k) for k in (excluded_keywords or []) if isinstance(k, str) and k.strip()
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
    # _norm_kw 양방향 적용으로 "웨딩본식" ↔ "웨딩 본식" 같은 띄어쓰기 차이 흡수
    if excluded_set:
        all_keywords = [kw for kw in all_keywords if _norm_kw(kw) not in excluded_set]

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
        # 등록 키워드 prefix 매칭: taxonomy가 등록KW로 시작하거나 그 반대
        # 예: 등록="주차" → covered: "주차 가능", "주차 무료" / 등록="당일예약" → covered: "당일 예약 가능"
        # 반대 방향 오탐 차단: 등록="보정"이 "무보정 가능"을 covered로 처리하던 버그 수정
        reg_hit = any(
            kw_nospace == reg_kw
            or kw_nospace.startswith(reg_kw)
            or reg_kw.startswith(kw_nospace)
            for reg_kw in registered_kw_nospace if len(reg_kw) >= 2
        )
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
        covered = [k for k in covered if _norm_kw(k) not in excluded_set]
        missing = [k for k in missing if _norm_kw(k) not in excluded_set]
        competitor_only = [k for k in competitor_only if _norm_kw(k) not in excluded_set]
        pioneer = [k for k in pioneer if _norm_kw(k) not in excluded_set]
        if top_priority and _norm_kw(top_priority) in excluded_set:
            top_priority = next((k for k in missing if _norm_kw(k) not in excluded_set), None)

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
        _norm_kw(k) for k in (excluded_keywords or []) if isinstance(k, str) and k.strip()
    }
    if excluded_set:
        kws = [kw for kw in kws if _norm_kw(kw) not in excluded_set]

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
    "photo": [
        "{region} 웨딩스냅 촬영",
        "{region} 돌스냅 스튜디오",
        "{region} 행사촬영 추천",
        "{region} 웨딩본식 스냅",
        "{region} 프로필 사진 스튜디오",
    ],
    "video": [
        "{region} 유튜브 영상 제작",
        "{region} 광고 영상 촬영",
        "{region} 행사 영상 촬영",
        "{region} 드론 촬영",
        "{region} 기업 홍보 영상",
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


def build_ai_scan_queries(region: str, keyword: str) -> list[str]:
    """AI 노출 스캔용 쿼리 리스트 단일 소스.

    근거: 네이버 공식 — 롱테일/긴 자연어 질의 전년比 2.5배 증가(2026.3).
    짧은 키워드형(기존)에 긴 자연어 다중조건 변형을 추가해 측정 범위를 현실에 맞춘다.

    규칙:
      - 첫 요소는 항상 짧은 쿼리 — naver/google Playwright 단일쿼리(_scan_queries[0])용 회귀 방지.
      - sample_n이 N회를 쿼리별 균등 분산하므로 쿼리 수만 늘 뿐 총 샘플·API 호출 수 불변(비용 동일).
      - 사실 안전: 사업장이 보유하지 않은 속성(조용함·주차 등)을 쿼리에 날조하지 않음. 일반 의도 표현만.
    """
    kw = (keyword or "").strip()
    reg = (region or "").strip()
    if not kw:
        return [reg] if reg else [""]
    if reg:
        queries = [
            f"{reg} {kw} 추천",            # 짧은(기존) — [0] naver용 유지
            f"{reg} {kw}",
            f"{kw} 잘하는 {reg}",
            f"{reg}에서 {kw} 잘하는 곳 추천해줘",   # 긴 자연어(신규)
            f"{reg} {kw} 중에 어디가 제일 괜찮아?",
        ]
    else:
        queries = [
            f"{kw} 추천",                  # 짧은(기존) — [0]
            f"{kw}",
            f"{kw} 잘하는 곳",
            f"{kw} 잘하는 곳 추천해줘",      # 긴 자연어(신규)
            f"{kw} 어디가 제일 괜찮아?",
        ]
    return list(dict.fromkeys(queries))


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


# ─── weight 합계 검증 (2026-05-19 P0 §5.1) ─────────────────────────────────
def _validate_taxonomy_weights() -> dict[str, float]:
    """업종별 weight 합계가 1.0 ± 0.01 인지 모듈 로드 시 검증.

    weight=0.0 그룹(키워드 확장 풀, 점수 미반영)은 합계에서 제외.
    합계 1.0 이탈 시 WARNING 로그 — 신규 업종 추가 시 합계 초과 방지.

    Returns:
        업종별 weight 합계 dict (테스트·디버깅용).
    """
    sums: dict[str, float] = {}
    for industry_key, groups in KEYWORD_TAXONOMY.items():
        if not isinstance(groups, dict):
            continue
        total = sum(
            float(g.get("weight", 0.0))
            for g in groups.values()
            if isinstance(g, dict) and float(g.get("weight", 0.0)) > 0
        )
        sums[industry_key] = round(total, 4)
        if abs(total - 1.0) >= 0.01:
            _logger.warning(
                "[taxonomy weight] %s weight 합계 1.0 이탈: sum=%.3f (그룹 weight 재배분 필요)",
                industry_key, total,
            )
    return sums


# 모듈 로드 시 자동 실행
_validate_taxonomy_weights()
