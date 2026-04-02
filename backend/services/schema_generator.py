"""
스마트플레이스 · 블로그 AI 최적화 — 템플릿 기반 콘텐츠 생성
Claude 호출 없음 (비용 정책: Claude Sonnet은 guide_generator.py 전용)
- 소개글·블로그 AI 생성은 guide_generator.generate_smartplace_intro() 에 위임
"""
import json
from models.schemas import SchemaRequest

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
    "photo": "사진관", "photo_wedding": "웨딩스튜디오", "video": "영상제작",
    "consulting": "컨설팅", "translation": "번역통역",
    "beauty": "미용실", "nail": "네일샵", "makeup": "메이크업", "spa": "마사지스파",
    "clothing": "의류", "shoes": "신발", "eyewear": "안경점",
    "shop": "매장", "grocery": "식자재", "electronics": "전자제품",
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
    {"item": "리뷰 답글 최근 3개월 이내 작성",
     "tip": "답글을 달면 가게 활성도가 높아져 AI 추천 순위가 올라갑니다."},
    {"item": "스마트플레이스 '소식' 월 1회 이상 발행",
     "tip": "이벤트·신메뉴·계절 정보를 소식으로 올리면 최신성 점수가 올라갑니다."},
    {"item": "네이버 블로그 포스트 연결",
     "tip": "생성된 블로그 초안을 올리고 스마트플레이스와 연결하세요."},
    {"item": "카카오맵·구글 지도 동일 정보 유지",
     "tip": "세 플랫폼의 이름·주소·전화번호가 일치해야 AI가 신뢰할 수 있는 가게로 판단합니다."},
]

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
    "vet": "VeterinaryCare", "flower": "Florist", "shop": "Store",
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
