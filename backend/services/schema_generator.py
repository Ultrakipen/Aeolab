"""
스마트플레이스 · 블로그 AI 최적화 — 템플릿 기반 콘텐츠 생성
Claude 호출 없음 (비용 정책: Claude Sonnet은 guide_generator.py 전용)
- 소개글·블로그 AI 생성은 guide_generator.generate_smartplace_intro() 에 위임
"""
import json
from models.schemas import SchemaRequest
from services.keyword_taxonomy import KEYWORD_TAXONOMY, normalize_category
# 업종 체크리스트·팁 데이터는 category_tips_data.py로 분리(2026-11-06) — 기존 import 경로 유지를 위해 다시 내보낸다
from services.category_tips_data import SMARTPLACE_CHECKLIST, CATEGORY_TIPS, CHECKLIST_BY_CATEGORY  # noqa: F401

# ── 업종 한국어 매핑 ──────────────────────────────────────────────────────────
# 59개 화이트리스트(frontend/lib/categories.ts FLAT_CATEGORY_GROUPS)의 leaf value 전체를 커버해야 함.
# 레거시 키(chicken/hospital/law 등)는 과거 DB에 남아있을 수 있는 값이라 하위호환을 위해 유지.
CATEGORY_KO: dict[str, str] = {
    # 음식·음료
    "restaurant": "음식점", "cafe": "카페", "bakery": "베이커리", "bar": "술집",
    "kids": "키즈카페",
    # 뷰티
    "beauty": "미용실", "nail": "네일샵", "skincare": "피부관리실", "semi_permanent": "반영구화장",
    # 마사지·스파
    "massage": "마사지", "spa": "스파", "jjimjil": "찜질방·사우나",
    # 운동·피트니스
    "fitness": "헬스장", "yoga": "요가·필라테스", "dance": "댄스", "ballet": "발레",
    "golf": "골프연습장", "swim": "수영·아쿠아", "martial_arts": "태권도·무술",
    "climbing": "클라이밍·볼더링",
    # 의료·건강
    "dental": "치과", "oriental_medicine": "한의원", "optics": "안경원",
    "medical": "병원·의원", "pharmacy": "약국",
    # 반려동물
    "pet": "반려동물",
    # 교육·레슨
    "education": "학원", "tutoring": "과외", "study": "스터디카페",
    "music_class": "음악교실", "music_lesson": "악기레슨", "cooking": "요리교실·쿠킹",
    "art_class": "미술학원", "childcare": "어린이집·유치원",
    # 전문직·서비스
    "legal": "법률사무소", "accounting": "세무회계사무소", "realestate": "부동산",
    "interior": "인테리어", "auto": "카센터·정비", "cleaning": "청소",
    "car_wash": "세차장", "electronics_repair": "핸드폰·가전수리",
    # 쇼핑·생활
    "shopping": "쇼핑몰", "fashion": "패션", "clothing": "의류", "footwear": "신발",
    "stationery": "문구·사무용품", "flower": "꽃집·화원", "laundry": "세탁소",
    # 사진·영상·디자인
    "photo": "사진스튜디오", "video": "영상제작", "design": "디자인",
    # 여가·오락 / 공방·공예
    "norebang": "노래방", "billiards": "당구장", "workshop": "공방·공예",
    "escape": "방탈출", "experience": "체험공간",
    # 숙박 / 기타
    "accommodation": "숙박", "other": "사업장",
    # ── 레거시 alias (마이그레이션 이전 DB 값 하위호환) ──
    "chicken": "치킨집", "bbq": "고기집", "seafood": "횟집", "snack": "분식집",
    "delivery": "배달음식점", "health_food": "건강식품점",
    "hospital": "의원·병원", "oriental": "한의원", "eye": "안과",
    "mental": "심리상담소", "rehab": "물리치료", "checkup": "건강검진",
    "swimming": "수영장", "academy": "학원", "language": "영어학원", "coding": "코딩학원",
    "daycare": "어린이집", "music_edu": "음악학원", "art_studio": "미술학원",
    "art_edu": "미술공예학원", "sports_edu": "태권도학원", "driving": "운전학원",
    "law": "법률사무소", "tax": "세무회계사무소", "architecture": "건축설계사무소",
    "insurance": "보험사무소", "it": "IT개발", "marketing": "마케팅",
    "photo_wedding": "웨딩스튜디오", "consulting": "컨설팅", "translation": "번역통역",
    "makeup": "메이크업", "shoes": "신발", "eyewear": "안경점",
    "grocery": "식자재", "electronics": "전자제품", "furniture": "가구",
    "book": "서점", "supplement": "건강식품", "baby": "유아용품",
    "vet": "동물병원", "moving": "이사", "repair": "가전수리",
    "wedding_hall": "웨딩홀", "wedding_plan": "웨딩플래너", "guesthouse": "게스트하우스",
    "camping": "캠핑·글램핑", "travel": "여행사", "study_cafe": "스터디카페",
    "karaoke_pro": "노래방", "hair": "미용실",
}



def score_intro_for_ai_briefing(intro_text: str, category: str) -> dict:
    """생성된 소개글이 AI 브리핑 키워드 주제를 얼마나 커버하는지 점수 계산.

    매칭 기준:
    - 완전 일치: 키워드 어구가 소개글에 그대로 있으면 매칭
    - 핵심 토큰: 어순 차이("무료 주차" vs "주차 무료") 흡수 — 2자 이상 첫 토큰이 소개글에 있으면 매칭
    - 가중치 내림차순 정렬 후 상위 20개 채취 (weight=0 카테고리 제외)
    """
    normalized = normalize_category(category)
    taxonomy = KEYWORD_TAXONOMY.get(normalized, KEYWORD_TAXONOMY.get("restaurant", {}))

    # 가중치 내림차순 정렬, weight=0(메뉴종류 등 확장 풀) 제외
    sorted_cats = sorted(
        [(k, v) for k, v in taxonomy.items()
         if isinstance(v, dict) and "keywords" in v and v.get("weight", 0) > 0],
        key=lambda x: x[1].get("weight", 0),
        reverse=True,
    )

    all_keywords: list[str] = []
    for _, cat_data in sorted_cats:
        all_keywords.extend(cat_data["keywords"])

    unique_keywords = list(dict.fromkeys(all_keywords))[:20]

    def _is_matched(kw: str, text: str) -> bool:
        if kw in text:
            return True
        # 핵심 토큰 매칭: 첫 번째 2자 이상 토큰이 소개글에 있으면 주제 커버로 인정
        tokens = [t for t in kw.split() if len(t) >= 2]
        return bool(tokens) and tokens[0] in text

    matched = [kw for kw in unique_keywords if _is_matched(kw, intro_text)]
    missing = [kw for kw in unique_keywords if not _is_matched(kw, intro_text)][:5]

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
