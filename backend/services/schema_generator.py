"""
스마트플레이스 · 블로그 AI 최적화 — 템플릿 기반 콘텐츠 생성
Claude 호출 없음 (비용 정책: Claude Sonnet은 guide_generator.py 전용)
- 소개글·블로그 AI 생성은 guide_generator.generate_smartplace_intro() 에 위임
"""
import json
from models.schemas import SchemaRequest
from services.keyword_taxonomy import KEYWORD_TAXONOMY

# ── 업종 한국어 매핑 ──────────────────────────────────────────────────────────
CATEGORY_KO: dict[str, str] = {
    "restaurant": "음식점", "cafe": "카페", "chicken": "치킨집", "bbq": "고기집",
    "seafood": "횟집", "bakery": "베이커리·제과점", "bar": "술집", "snack": "분식집",
    "delivery": "배달음식점", "health_food": "건강식품점",
    "hospital": "의원·병원", "dental": "치과", "oriental": "한의원",
    "pharmacy": "약국", "skincare": "피부과", "eye": "안과",
    "mental": "심리상담소", "rehab": "물리치료", "checkup": "건강검진",
    "fitness": "헬스장", "yoga": "요가·필라테스", "swimming": "수영장",
    "academy": "학원", "language": "영어학원", "coding": "코딩학원",
    "daycare": "어린이집", "tutoring": "과외", "music_edu": "음악학원",
    "art_studio": "미술학원", "art_edu": "미술공예학원",
    "sports_edu": "태권도학원", "driving": "운전학원",
    "law": "법률사무소", "tax": "세무회계사무소", "realestate": "부동산",
    "architecture": "건축설계사무소", "insurance": "보험사무소",
    "it": "IT개발", "design": "디자인사무소", "marketing": "마케팅",
    "photo": "사진·영상", "photo_wedding": "웨딩스튜디오", "video": "영상제작",
    "consulting": "컨설팅", "translation": "번역통역",
    "beauty": "미용실", "nail": "네일샵", "makeup": "메이크업", "spa": "마사지스파",
    "clothing": "의류", "shoes": "신발", "eyewear": "안경점",
    "shopping": "매장", "grocery": "식자재", "electronics": "전자제품",
    "furniture": "가구", "stationery": "문구점", "book": "서점",
    "supplement": "건강식품", "baby": "유아용품", "interior": "인테리어",
    "auto": "자동차정비", "laundry": "세탁소", "pet": "반려동물용품",
    "vet": "동물병원", "cleaning": "청소대행", "moving": "이사",
    "repair": "가전수리", "flower": "꽃집",
    "wedding_hall": "웨딩홀", "wedding_plan": "웨딩플래너",
    "accommodation": "숙박·펜션", "guesthouse": "게스트하우스",
    "camping": "캠핑·글램핑", "travel": "여행사",
    "kids": "키즈카페", "study_cafe": "스터디카페",
    "workshop": "공방·클래스", "karaoke_pro": "노래방",
    "other": "사업장",
}

# ── 스마트플레이스 표준 체크리스트 ───────────────────────────────────────────
SMARTPLACE_CHECKLIST = [
    {"item": "가게 이름에 지역·업종 키워드 포함",
     "tip": "예: '강남 24시 돼지갈비'처럼 지역+업종이 이름에 있으면 AI가 검색할 때 정확히 찾아냅니다."},
    {"item": "대표 사진 10장 이상 등록",
     "tip": "음식·내부·외부·메뉴판 사진을 고루 올리세요. 사진이 많을수록 AI가 가게를 실제 영업 중인 곳으로 인식합니다."},
    {"item": "메뉴·서비스 항목 전체 등록",
     "tip": "메뉴 이름과 가격을 빠짐없이 입력하세요. AI는 메뉴 텍스트를 그대로 학습합니다."},
    {"item": "영업시간·정기휴무 정확히 입력",
     "tip": "변경됐다면 즉시 수정하세요. AI가 '현재 영업 중'인지 판단할 때 이 정보를 씁니다."},
    {"item": "전화번호 최신 정보로 유지",
     "tip": "번호가 틀리면 AI가 연락 불가능한 가게로 인식해 추천하지 않습니다."},
    {"item": "소개글 500자 이상 작성",
     "tip": "생성된 소개글을 복사해 붙여넣으세요. 키워드가 자연스럽게 포함돼 있습니다."},
    {"item": "리뷰 답글 — 키워드 포함 여부 확인 후 등록",
     "tip": "네이버 AI 답글 도구로 초안을 만든 뒤, 업종 핵심 키워드가 빠졌다면 한 단어 추가하고 등록하세요. AI 활성도 신호가 강화됩니다."},
    {"item": "스마트플레이스 '소식' 월 1회 이상 발행",
     "tip": "이벤트·신메뉴·계절 정보를 소식으로 올리면 최신성 점수가 올라갑니다."},
    {"item": "네이버 블로그 포스트 연결",
     "tip": "생성된 블로그 초안을 올리고 스마트플레이스와 연결하세요."},
    {"item": "카카오맵·구글 지도 동일 정보 유지",
     "tip": "세 플랫폼의 이름·주소·전화번호가 일치해야 AI가 신뢰할 수 있는 가게로 판단합니다."},
]

# ── 업종별 맞춤 팁 ────────────────────────────────────────────────────────────
CATEGORY_TIPS: dict[str, dict[str, str]] = {
    "restaurant": {
        "smartplace_tip": "메뉴 사진을 10장 이상 등록하면 AI 브리핑 인용률이 높아집니다. '배달 가능', '주차 가능' 등 검색 조건 키워드를 소개글에 포함하세요.",
        "blog_tip": "월 2회 이상 신메뉴·이벤트 포스트를 올리면 네이버 AI가 최신성 높은 정보로 인식합니다.",
        "no_website_guide": "홈페이지 없이도 카카오맵 비즈니스 채널에 메뉴·영업시간·사진을 등록하면 Google AI Overview 노출에 동일한 효과를 낼 수 있습니다.",
    },
    "cafe": {
        "smartplace_tip": "음료 메뉴와 가격을 모두 등록하고 '공부 가능', '노트북 사용 가능', '24시간 운영' 등 조건 키워드를 소개글에 명시하세요.",
        "blog_tip": "시즌 음료 출시 때마다 블로그 포스트를 올리면 '봄 신메뉴 카페' 등 시즌 검색에서 노출됩니다.",
        "no_website_guide": "카카오 채널 개설 후 메뉴·분위기 사진을 등록하면 '근처 카페 추천' AI 검색에서 노출 가능성이 높아집니다.",
    },
    "beauty": {
        "smartplace_tip": "전문 시술 항목(염색·펌·두피케어 등)을 모두 메뉴로 등록하고, '당일 예약 가능' 여부를 소개글에 명시하세요.",
        "blog_tip": "시술 전후 사진 포스트가 AI 브리핑 인용에 가장 효과적입니다. '강남 탈색 후기' 등 키워드 포함 제목을 사용하세요.",
        "no_website_guide": "네이버 플레이스 포트폴리오 기능을 활용하면 홈페이지 없이도 시술 결과를 체계적으로 보여줄 수 있습니다.",
    },
    "clinic": {
        "smartplace_tip": "진료 과목을 모두 등록하고 '야간 진료', '주말 진료', '당일 예약' 등 접근성 키워드를 소개글에 포함하세요.",
        "blog_tip": "증상별 Q&A 형식의 포스트가 AI 브리핑 인용률이 매우 높습니다. '허리 통증 원인과 치료법' 등 정보성 콘텐츠를 작성하세요.",
        "no_website_guide": "구글 비즈니스 프로필을 완성하면 Google AI Overview에서 '내 주변 병원' 검색 시 노출됩니다.",
    },
    "academy": {
        "smartplace_tip": "수강 대상(성인·초등·중등)과 수업 방식(1:1·그룹·온라인)을 명확히 등록하고 체험 수업 가능 여부를 소개글에 포함하세요.",
        "blog_tip": "수강생 성과 사례(합격·성적 향상) 포스트는 AI 검색 인용률이 높습니다. 실제 후기 기반으로 작성하세요.",
        "no_website_guide": "네이버 스마트플레이스 소개글 안 Q&A 섹션을 적극 활용하면 '강남 영어학원 추천' 등 조건 검색에서 우선 노출됩니다.",
    },
    "legal": {
        "smartplace_tip": "전문 분야(이혼·부동산·형사 등)를 소개글에 명확히 명시하고, '무료 초기 상담' 가능 여부를 포함하세요.",
        "blog_tip": "법률 상식 Q&A 형식의 블로그 포스트가 ChatGPT·Gemini 인용에 효과적입니다. 월 2회 이상 발행을 권장합니다.",
        "no_website_guide": "네이버 블로그를 주요 채널로 운영하면 홈페이지 없이도 AI 검색 노출이 가능합니다. 법률 상식 콘텐츠 10개 이상 축적을 목표로 하세요.",
    },
    "fitness": {
        "smartplace_tip": "PT·필라테스·요가 등 프로그램 종류와 '첫 달 프로모션', '1:1 PT' 가능 여부를 소개글에 명시하세요.",
        "blog_tip": "운동 방법·다이어트 후기 포스트가 AI 검색 인용률이 높습니다. '강남 헬스장 초보자 가이드' 형식을 활용하세요.",
        "no_website_guide": "인스타그램과 네이버 플레이스를 연동하면 홈페이지 없이도 프로그램 소개와 시설 사진을 효과적으로 노출할 수 있습니다.",
    },
    "pet": {
        "smartplace_tip": "반려동물 종류별 서비스(개·고양이·소형견 전용 등)와 '노령견 가능', '대형견 가능' 여부를 소개글에 명시하세요.",
        "blog_tip": "반려동물 케어 팁과 미용 전후 사진 포스트가 AI 검색 인용에 효과적입니다. '강아지 목욕 방법' 등 정보성 콘텐츠를 활용하세요.",
        "no_website_guide": "카카오채널을 개설하여 예약·문의를 받으면 홈페이지 없이도 고객 접점을 효과적으로 만들 수 있습니다.",
    },
    "shopping": {
        "smartplace_tip": "주요 상품 카테고리와 가격대를 소개글에 포함하고, '당일 배송', '무료 반품' 등 쇼핑 조건 키워드를 명시하세요.",
        "blog_tip": "상품 리뷰·비교 포스트가 AI 검색 인용률이 높습니다. 실제 사용 후기 형식으로 월 4회 이상 발행하세요.",
        "no_website_guide": "구글 비즈니스 프로필과 네이버 스마트스토어를 연동하면 AI 검색에서 상품 정보가 직접 표시될 수 있습니다.",
    },
}

# ── 업종별 추가 체크리스트 ─────────────────────────────────────────────────────
CHECKLIST_BY_CATEGORY: dict[str, list[dict]] = {
    "restaurant": [
        {"item": "배달앱(배달의민족/쿠팡이츠) 연동 등록", "tip": "배달앱 등록 정보가 네이버 AI에 추가 신호로 작용합니다."},
        {"item": "네이버 테이블 주문 또는 예약 시스템 연동", "tip": "예약 가능 여부가 AI 브리핑 인용 조건 중 하나입니다."},
        {"item": "단체 예약·회식 가능 여부 소개글에 명시", "tip": "조건 검색 '회식 가능한 식당 추천'에서 우선 노출됩니다."},
    ],
    "cafe": [
        {"item": "공부·노트북 사용 가능 여부 소개글에 명시", "tip": "'공부 카페 추천' 조건 검색에서 노출됩니다."},
        {"item": "반려동물 동반 가능 여부 표시", "tip": "'애견 동반 카페' 검색 결과에 포함됩니다."},
        {"item": "주차 가능 여부 및 주차 팁 소개글에 추가", "tip": "주차 정보는 카페 선택의 주요 조건입니다."},
    ],
    "beauty": [
        {"item": "예약 시스템(네이버 예약 또는 카카오 예약) 연동", "tip": "온라인 예약 가능 여부가 AI 브리핑 인용 조건입니다."},
        {"item": "시술 포트폴리오 사진 20장 이상 등록", "tip": "시술 전후 사진이 AI 신뢰도를 높입니다."},
        {"item": "전문 시술(두피·탈색 등) 항목 소개글에 명시", "tip": "전문 시술 키워드로 조건 검색 노출이 가능합니다."},
    ],
    "clinic": [
        {"item": "진료과목 전체 소개글·메뉴에 등록", "tip": "세부 진료과목이 AI 검색 인덱스에 포함됩니다."},
        {"item": "야간·주말 진료 여부 소개글에 명시", "tip": "'야간 진료 병원 추천' 조건 검색에 노출됩니다."},
        {"item": "건강보험 적용 여부 및 비급여 항목 안내 추가", "tip": "비용 투명성이 AI 추천 신뢰도를 높입니다."},
        {"item": "온라인 예약 시스템 연동 (네이버 예약)", "tip": "예약 가능 여부가 AI 브리핑 인용 조건 중 하나입니다."},
    ],
    "academy": [
        {"item": "무료 체험 수업 가능 여부 소개글에 명시", "tip": "'체험 가능한 학원' 조건 검색에 노출됩니다."},
        {"item": "수강 대상(연령·레벨) 구체적으로 등록", "tip": "'성인 영어 학원 추천' 등 타겟 검색에 노출됩니다."},
        {"item": "합격·성과 사례 소개글·포스트에 포함", "tip": "성과 데이터가 AI 브리핑 인용률을 높입니다."},
    ],
    "legal": [
        {"item": "전문 분야 소개글에 구체적으로 명시", "tip": "'이혼 전문 변호사 추천' 등 특화 검색에 노출됩니다."},
        {"item": "무료 초기 상담 가능 여부 표시", "tip": "무료 상담 여부가 AI 브리핑 인용 조건입니다."},
        {"item": "주요 수임 사례(승소 결과) 블로그에 게시", "tip": "실적 콘텐츠가 신뢰도와 AI 인용률을 높입니다."},
    ],
    "fitness": [
        {"item": "프로그램 종류(PT·그룹·필라테스) 전체 등록", "tip": "프로그램 다양성이 AI 검색 노출을 확대합니다."},
        {"item": "첫 달 프로모션·무료 체험 정보 소개글에 추가", "tip": "'헬스장 첫 달 이벤트' 조건 검색에 노출됩니다."},
        {"item": "시설 사진(기구·샤워실·주차) 15장 이상 등록", "tip": "시설 사진이 AI 신뢰도와 전환율을 높입니다."},
    ],
    "pet": [
        {"item": "서비스 대상 동물 종류(개·고양이·소형견) 명시", "tip": "'소형견 미용' 등 조건 검색에 우선 노출됩니다."},
        {"item": "노령·대형견 서비스 가능 여부 소개글에 표시", "tip": "특수 조건 검색에서 경쟁 우위를 가질 수 있습니다."},
        {"item": "미용 전후 사진 20장 이상 등록", "tip": "시각 자료가 AI 인용 신뢰도를 높입니다."},
    ],
    "shopping": [
        {"item": "상품 카테고리별 가격대 소개글에 명시", "tip": "가격 정보가 AI 비교 검색에서 인용됩니다."},
        {"item": "배송 정책(당일·무료·반품) 소개글에 명시", "tip": "배송 조건이 AI 쇼핑 검색 인용 조건입니다."},
        {"item": "구글 비즈니스 프로필·네이버 스마트스토어 연동", "tip": "플랫폼 연동이 글로벌 AI 노출을 확대합니다."},
    ],
}


def score_intro_for_ai_briefing(intro_text: str, category: str) -> dict:
    """생성된 소개글이 AI 브리핑 키워드를 얼마나 포함하는지 점수 계산"""
    # keyword_taxonomy의 CATEGORY_ALIASES를 통해 정규화된 키 사용
    _ALIASES: dict[str, str] = {
        "restaurant": "restaurant", "cafe": "cafe", "beauty": "beauty",
        "clinic": "clinic", "hospital": "clinic", "academy": "academy",
        "legal": "legal", "law": "legal", "fitness": "fitness",
        "pet": "pet", "shopping": "shopping",
    }
    normalized = _ALIASES.get(category, category)
    taxonomy = KEYWORD_TAXONOMY.get(normalized, KEYWORD_TAXONOMY.get("restaurant", {}))

    all_keywords: list[str] = []
    for cat_data in taxonomy.values():
        if isinstance(cat_data, dict) and "keywords" in cat_data:
            all_keywords.extend(cat_data["keywords"])

    # 중복 제거 후 상위 20개
    unique_keywords = list(dict.fromkeys(all_keywords))[:20]

    matched = [kw for kw in unique_keywords if kw in intro_text]
    missing = [kw for kw in unique_keywords if kw not in intro_text][:5]

    score = int(len(matched) / max(len(unique_keywords), 1) * 100)
    grade = "A" if score >= 80 else "B" if score >= 60 else "C" if score >= 40 else "D"

    return {
        "score": score,
        "grade": grade,
        "matched_keywords": matched,
        "missing_top_keywords": missing,
        "total_checked": len(unique_keywords),
    }


# ── Schema.org JSON-LD (홈페이지 있는 경우 전용) ─────────────────────────────
CATEGORY_TYPE_MAP = {
    "restaurant": "Restaurant", "cafe": "CafeOrCoffeeShop", "chicken": "Restaurant",
    "bbq": "Restaurant", "seafood": "Restaurant", "bakery": "Bakery",
    "hospital": "MedicalBusiness", "dental": "Dentist", "oriental": "MedicalBusiness",
    "pharmacy": "Pharmacy", "skincare": "MedicalBusiness",
    "fitness": "SportsActivityLocation", "yoga": "SportsActivityLocation",
    "academy": "EducationalOrganization", "language": "EducationalOrganization",
    "law": "LegalService", "tax": "AccountingService", "realestate": "RealEstateAgent",
    "beauty": "HairSalon", "nail": "BeautySalon", "spa": "BeautySalon",
    "vet": "VeterinaryCare", "flower": "Florist", "shopping": "Store",
}


def build_script_tag(req: SchemaRequest) -> str:
    """홈페이지 <head>에 삽입할 JSON-LD <script> 태그 (홈페이지 있는 경우에만 사용)"""
    schema_type = CATEGORY_TYPE_MAP.get(req.category, "LocalBusiness")
    schema: dict = {
        "@context": "https://schema.org",
        "@type": schema_type,
        "name": req.business_name,
    }
    if req.address:
        schema["address"] = {
            "@type": "PostalAddress",
            "addressLocality": req.region,
            "streetAddress": req.address,
            "addressCountry": "KR",
        }
    if req.phone:
        schema["telephone"] = req.phone
    if req.website_url:
        schema["url"] = req.website_url
    if req.opening_hours:
        schema["openingHours"] = req.opening_hours
    if req.description:
        schema["description"] = req.description
    return f'<script type="application/ld+json">\n{json.dumps(schema, ensure_ascii=False, indent=2)}\n</script>'


def build_keywords(req: SchemaRequest) -> list[str]:
    """업종·지역 기반 핵심 키워드 10개 생성 (템플릿)"""
    name = req.business_name
    region = req.region
    cat = CATEGORY_KO.get(req.category, "사업장")
    base = [
        f"{region} {cat}",
        f"{name}",
        f"{region} {cat} 추천",
        f"{region} {cat} 후기",
        f"{name} 위치",
        f"{name} 전화번호",
        f"{region} {cat} 가격",
        f"{region} 맛집 추천" if req.category in ("restaurant","cafe","chicken","bbq","seafood","bakery","snack") else f"{region} {cat} 예약",
        f"{name} 영업시간",
        f"{region} 근처 {cat}",
    ]
    return base[:10]


# 하위호환 alias (기존 라우터 import 유지)
def generate_local_business_schema(req: SchemaRequest) -> dict:
    return {}  # 더 이상 단독 사용하지 않음 — schema_gen.py 라우터에서 통합


def generate_script_tag(schema: dict) -> str:
    return ""  # 하위호환 stub


def generate_faq_schema(faqs: list) -> dict:
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {"@type": "Question", "name": qa["q"],
             "acceptedAnswer": {"@type": "Answer", "text": qa["a"]}}
            for qa in faqs
        ],
    }


def schema_to_html_tag(schema: dict) -> str:
    return f'<script type="application/ld+json">\n{json.dumps(schema, ensure_ascii=False, indent=2)}\n</script>'
