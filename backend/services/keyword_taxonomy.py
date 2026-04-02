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
    "clinic": "clinic", "hospital": "clinic", "medical": "clinic",
    "병원": "clinic", "한의원": "clinic", "치과": "clinic",
    "의원": "clinic", "약국": "clinic",
    # 학원·교육
    "academy": "academy", "education": "academy",
    "학원": "academy", "교육": "academy", "과외": "academy",
    # 법률·세무
    "legal": "legal", "lawyer": "legal", "tax": "legal", "accounting": "legal",
    "법률": "legal", "세무": "legal", "변호사": "legal", "회계": "legal",
    # 쇼핑몰·온라인
    "shopping": "shopping", "online": "shopping",
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
}

# 업종별 상황 키워드 분류 체계 (모델 엔진 명세서 v1.0 § 02)
KEYWORD_TAXONOMY: dict[str, dict[str, KeywordCategory]] = {

    # § 2.1 음식점·카페
    "restaurant": {
        "접근편의": {
            "keywords": ["주차 가능", "주차 무료", "발렛 서비스", "지하철 도보 3분", "휠체어 접근 가능", "대중교통 편리"],
            "weight": 0.20,
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
    },

    # § 2.2 미용실·뷰티
    "beauty": {
        "접근편의": {
            "keywords": ["주차 가능", "지하철 도보", "당일 예약 가능", "무료 주차", "365일 영업"],
            "weight": 0.20,
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
            "keywords": ["입시 전문", "원어민 강사", "1:1 맞춤", "소수정예", "레벨테스트", "국가 자격증"],
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
            "weight": 0.25,
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
    },

    # § 2.8 헬스장·피트니스 (스포츠·운동시설)
    "fitness": {
        "시설장비": {
            "keywords": ["최신 장비", "넓은 공간", "개인 락커", "샤워실 있음", "주차 가능", "깨끗한 환경"],
            "weight": 0.20,
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
    },

    # § 2.9 반려동물 (미용·동물병원)
    "pet": {
        "전문성": {
            "keywords": ["수의사 직접 진료", "전문 그루머", "품종별 전문", "소형견 전문", "대형견 가능", "고양이 전문"],
            "weight": 0.35,
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
    },
}


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


def analyze_keyword_coverage(
    category: str,
    review_excerpts: list[str],
    competitor_review_excerpts: list[str] | None = None,
) -> dict:
    """
    리뷰 텍스트에서 업종별 키워드 커버리지 분석

    소상공인의 가게가 AI 브리핑 조건 검색에 나오려면
    리뷰에 업종별 핵심 키워드가 포함되어 있어야 합니다.

    Args:
        category: 업종 (DB 저장값, normalize_category로 정규화됨)
        review_excerpts: 내 가게 리뷰 텍스트 목록
        competitor_review_excerpts: 경쟁사 리뷰 텍스트 목록 (없으면 None)

    Returns:
        covered: 내 리뷰에 이미 있는 키워드
        missing: 아직 없는 키워드 (전체)
        competitor_only: 경쟁사 리뷰엔 있고 내 리뷰엔 없는 것 (긴급 확보 대상)
        pioneer: 아무도 없는 선점 가능 키워드
        coverage_rate: 커버리지 비율 (0.0~1.0)
        top_priority_keyword: 지금 당장 확보해야 할 1순위 키워드
        category_scores: 카테고리별 {"score": 80, "covered": 4, "total": 5, "weight": 0.2}
    """
    industry = get_industry_keywords(category)
    all_keywords = get_all_keywords_flat(category)

    # 내 리뷰 키워드 검색 (공백 제거 후 부분 매칭)
    my_text = " ".join(review_excerpts).lower() if review_excerpts else ""
    my_text_nospace = my_text.replace(" ", "")

    covered: list[str] = []
    missing: list[str] = []
    for kw in all_keywords:
        if kw.replace(" ", "") in my_text_nospace or kw in my_text:
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
) -> dict:
    """
    위치 무관(non_location) 사업장을 위한 키워드 분석.

    네이버 AI 브리핑 비해당이므로 리뷰 키워드 대신
    ChatGPT·Perplexity가 전문직을 추천할 때 사용하는 키워드 패턴을 분석.

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
    # 비위치 사업장 전문 키워드 (ChatGPT·Perplexity 추천 패턴)
    nonlocation_keywords: dict[str, list[str]] = {
        "legal":    ["무료 상담", "전문 변호사", "승소 사례", "이혼 전문", "형사 전문", "세무 전문", "칼럼", "유튜브"],
        "shopping": ["당일 배송", "무료 반품", "정품 인증", "친환경", "수제", "한정판", "구독 서비스"],
        "consulting": ["성공 사례", "전문가 칼럼", "인터뷰", "언론 보도", "포트폴리오", "무료 진단"],
        "fitness":  ["온라인 PT", "비대면 레슨", "영상 콘텐츠", "성과 사례", "인증 자격증"],
        "academy":  ["수강 후기", "합격 사례", "강사 경력", "커리큘럼", "온라인 수업", "영상 강의"],
        "default":  ["전문 콘텐츠", "블로그 운영", "전문가 의견", "사례 포트폴리오", "언론 보도"],
    }

    key = normalize_category(category)
    kws = nonlocation_keywords.get(key, nonlocation_keywords["default"])

    joined = " ".join(ai_excerpts).lower() if ai_excerpts else ""
    covered = [kw for kw in kws if kw.lower() in joined]
    missing = [kw for kw in kws if kw.lower() not in joined]
    coverage_rate = len(covered) / len(kws) if kws else 0.0
    top_priority = missing[0] if missing else None

    advice = (
        f"{business_name}은(는) 위치 무관 사업장입니다. "
        "ChatGPT·Perplexity가 추천할 때 '전문성·신뢰' 키워드가 중요합니다. "
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
