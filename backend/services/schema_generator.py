import json
from models.schemas import SchemaRequest

CATEGORY_TYPE_MAP = {
    "restaurant": "Restaurant",
    "cafe": "CafeOrCoffeeShop",
    "hospital": "MedicalBusiness",
    "academy": "EducationalOrganization",
    "law": "LegalService",
    "beauty": "HealthAndBeautyBusiness",
    "shop": "Store",
}

CATEGORY_KO = {
    "restaurant": "음식점", "cafe": "카페", "hospital": "의원",
    "academy": "학원", "law": "법률사무소", "beauty": "미용실", "shop": "매장",
}


def _build_description(biz: dict) -> str:
    """사업장 정보를 바탕으로 AI 검색에 효과적인 설명 생성"""
    parts = []
    if biz.get("name"):
        parts.append(f"{biz['name']}은")
    if biz.get("region"):
        parts.append(f"{biz['region']}에 위치한")
    if biz.get("category"):
        parts.append(f"{CATEGORY_KO.get(biz['category'], biz['category'])}입니다.")
    if biz.get("keywords"):
        parts.append(f"주요 서비스: {', '.join(biz['keywords'][:5])}")
    return " ".join(parts)


def generate_local_business_schema(req: SchemaRequest) -> dict:
    """LocalBusiness Schema.org JSON-LD 자동 생성 (AI 검색 노출 최적화)"""
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
    else:
        desc = _build_description({
            "name": req.business_name, "region": req.region, "category": req.category
        })
        if desc:
            schema["description"] = desc

    # 업종별 추가 필드
    if req.category == "restaurant":
        schema["servesCuisine"] = "한식"
        schema["priceRange"] = "$$"
    elif req.category == "hospital":
        schema["medicalSpecialty"] = ""
    elif req.category == "academy":
        schema["educationalCredentialAwarded"] = ""

    return schema


def generate_faq_schema(faqs: list) -> dict:
    """FAQ Schema — AI가 Q&A 형식으로 인용하기 좋음"""
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": qa["q"],
                "acceptedAnswer": {"@type": "Answer", "text": qa["a"]},
            }
            for qa in faqs
        ],
    }


def schema_to_html_tag(schema: dict) -> str:
    """웹사이트 <head>에 삽입할 <script> 태그 생성"""
    return f'<script type="application/ld+json">\n{json.dumps(schema, ensure_ascii=False, indent=2)}\n</script>'


def generate_script_tag(schema: dict) -> str:
    """하위 호환 alias"""
    return schema_to_html_tag(schema)
