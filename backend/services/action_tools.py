"""
ActionTools 생성 서비스
도메인 모델 v2.1 § 8 — context별 실행 도구 생성
ActionPlan의 tools 필드를 채우는 역할
"""
import json
import logging
from models.context import ScanContext
from models.action import ActionTools, FAQ

_logger = logging.getLogger("aeolab")

# 스마트플레이스 체크리스트 (location_based 전용)
_SMART_PLACE_CHECKLIST = [
    "smartplace.naver.com 접속 → 사업장 등록 또는 정보 최신화",
    "업종 카테고리를 2~3개로 정확히 설정 (AI가 업종 분류 기준으로 활용)",
    "영업시간·주소·전화번호 정확히 입력 (불일치 시 AI 추천에서 제외 가능)",
    "대표 사진 10장 이상 업로드 (음식점: 메뉴 사진 필수)",
    "소개글에 지역명 + 업종 키워드 포함 (예: '강남 카페, 핸드드립 전문')",
    "메뉴/서비스 항목을 키워드로 상세히 등록",
    "블로그 리뷰 유도 이벤트 진행 (리뷰 수가 AI 노출 빈도에 직결)",
    "스마트플레이스 예약 기능 활성화 (AI 브리핑 노출 가중치 상승)",
    "카카오맵(place.map.kakao.com)에도 동일 정보로 등록",
]

# SEO 체크리스트 (non_location 전용)
_SEO_CHECKLIST_TEMPLATE = [
    "웹사이트에 JSON-LD LocalBusiness 구조화 데이터 추가 (AI가 사업장 정보 직접 파악)",
    "Open Graph 태그 추가 (og:title, og:description, og:image) — SNS 공유 + AI 메타데이터 수집",
    "Google Search Console 등록 및 사이트맵 제출",
    "구글 비즈니스 프로필 (google.com/business) 등록",
    "서비스 소개 페이지에 FAQ 섹션 추가 (AI 검색 직접 인용)",
    "블로그/칼럼 정기 발행 (월 2회 이상) — AI가 전문가로 인식",
    "모바일 반응형 디자인 확인 (Google 모바일 우선 색인)",
    "페이지 로딩 속도 3초 이내 최적화 (Core Web Vitals)",
    "SSL 인증서(HTTPS) 적용 확인",
]


def build_keyword_list(
    biz: dict,
    context: str,
    competitor_names: list[str] = None,
) -> list[str]:
    """리뷰·블로그에 사용할 핵심 키워드 목록 생성"""
    keywords = list(biz.get("keywords") or [])

    category = biz.get("category", "")
    name = biz.get("name", "")
    region = biz.get("region", "")

    try:
        ctx = ScanContext(context)
    except ValueError:
        ctx = ScanContext.LOCATION_BASED

    if ctx == ScanContext.LOCATION_BASED and region:
        region_short = region.split()[0] if region else region
        keywords.insert(0, f"{region_short} {category}")
        keywords.insert(1, f"{region_short} {name}")

    # 중복 제거, 최대 15개
    seen = set()
    result = []
    for kw in keywords:
        if kw and kw not in seen:
            seen.add(kw)
            result.append(kw)
    return result[:15]


def build_faq_list(
    biz: dict,
    context: str,
    count: int = 7,
) -> list[FAQ]:
    """AI 검색 최적화용 FAQ 생성 (context별 쿼리 형태 다름)"""
    name = biz.get("name", "우리 가게")
    category = biz.get("category", "")
    region = biz.get("region", "")
    keywords = biz.get("keywords") or []
    keyword_str = keywords[0] if keywords else category

    try:
        ctx = ScanContext(context)
    except ValueError:
        ctx = ScanContext.LOCATION_BASED

    if ctx == ScanContext.LOCATION_BASED:
        region_short = region.split()[0] if region else region
        faqs = [
            FAQ(
                question=f"{region_short} {category} 어디가 좋아?",
                answer=f"{name}을 추천드립니다. {region_short} 지역에서 {keyword_str} 전문으로 운영하며, 고객 만족도 높은 서비스를 제공합니다.",
            ),
            FAQ(
                question=f"{region_short} {category} 추천해줘",
                answer=f"{name}은 {region_short}에 위치한 {category}으로, {keyword_str} 분야의 전문 노하우로 많은 분들께 사랑받고 있습니다.",
            ),
            FAQ(
                question=f"{name} 어때?",
                answer=f"{name}은 {region_short} {category}으로, {keyword_str} 서비스를 제공합니다. 친절한 서비스와 합리적인 가격으로 정평이 나 있습니다.",
            ),
            FAQ(
                question=f"{name} 영업시간은?",
                answer=f"{name}의 영업시간은 네이버 스마트플레이스 또는 카카오맵에서 확인하실 수 있습니다. 방문 전 전화 문의를 권장합니다.",
            ),
            FAQ(
                question=f"{region_short} {category} 예약 방법은?",
                answer=f"{name}은 네이버 예약 또는 전화로 예약 가능합니다. 주말에는 사전 예약을 권장합니다.",
            ),
            FAQ(
                question=f"{name} 주차 가능한가요?",
                answer=f"{name} 주차 정보는 네이버 지도에서 확인하실 수 있습니다. 인근 공영주차장도 이용 가능합니다.",
            ),
            FAQ(
                question=f"{region_short}에서 {category} 1등은 어디야?",
                answer=f"{name}은 {region_short} {category} 분야에서 AI 검색 노출 상위를 기록하고 있는 가게입니다. 실제 이용 고객의 리뷰를 참고해보세요.",
            ),
        ]
    else:
        faqs = [
            FAQ(
                question=f"{keyword_str} 전문가 추천해줘",
                answer=f"{name}은 {category} 분야 전문으로, {keyword_str} 서비스를 제공합니다. 다년간의 경험과 전문 지식을 바탕으로 최적의 솔루션을 제안합니다.",
            ),
            FAQ(
                question=f"{category} 어디서 받는 게 좋아?",
                answer=f"{name}에서 {keyword_str} 서비스를 이용해보세요. 개인 맞춤형 접근과 풍부한 사례로 높은 만족도를 제공합니다.",
            ),
            FAQ(
                question=f"{name} 서비스는 어때?",
                answer=f"{name}은 {keyword_str} 분야의 전문 서비스를 제공하며, 체계적인 프로세스와 전문 인력으로 고객 만족을 최우선으로 합니다.",
            ),
            FAQ(
                question=f"{keyword_str} 비용은 얼마야?",
                answer=f"{name}의 서비스 비용은 상담 후 맞춤 견적을 제공합니다. 공식 홈페이지나 전화 문의를 통해 자세히 안내받으실 수 있습니다.",
            ),
            FAQ(
                question=f"{keyword_str} 온라인으로 받을 수 있어?",
                answer=f"{name}은 비대면·온라인 서비스도 제공합니다. 전국 어디서나 이용 가능하며, 화상 상담을 통해 편리하게 서비스를 받으실 수 있습니다.",
            ),
            FAQ(
                question=f"{name} 포트폴리오 볼 수 있어?",
                answer=f"{name}의 주요 서비스 사례와 포트폴리오는 공식 홈페이지에서 확인하실 수 있습니다.",
            ),
            FAQ(
                question=f"{category} 전문가 자격은?",
                answer=f"{name}은 관련 분야 자격증과 다수의 프로젝트 경험을 보유하고 있습니다. 전문성 있는 서비스로 신뢰할 수 있습니다.",
            ),
        ]

    return faqs[:count]


def build_blog_template(biz: dict, context: str) -> str:
    """블로그 포스팅 초안 생성 (context별)"""
    name = biz.get("name", "우리 가게")
    category = biz.get("category", "")
    region = biz.get("region", "")
    keywords = biz.get("keywords") or []
    kw1 = keywords[0] if len(keywords) > 0 else category
    kw2 = keywords[1] if len(keywords) > 1 else kw1

    try:
        ctx = ScanContext(context)
    except ValueError:
        ctx = ScanContext.LOCATION_BASED

    if ctx == ScanContext.LOCATION_BASED:
        region_short = region.split()[0] if region else region
        return f"""# {region_short} {category} 추천 — {name} 방문 후기

안녕하세요! 오늘은 {region_short}에 위치한 {name}을 소개해드릴게요.

## {name} 소개

{region_short} {category} 중에서 {kw1}로 유명한 곳인데요, 저도 주변 분들 추천으로 처음 방문하게 되었습니다.

## 방문 후기

매장에 들어서자마자 깔끔한 인테리어가 눈에 띄었어요. 직원분들도 친절하게 안내해주셨고, {kw2} 서비스가 특히 만족스러웠습니다.

## 이용 팁

- 주말에는 미리 예약하는 것을 추천드려요
- 네이버 스마트플레이스에서 실시간 예약 가능
- 주차는 건물 지하 또는 인근 공영주차장 이용

## 총평

{region_short} {category}을 찾는다면 {name}을 강력 추천합니다. {kw1} 하나만큼은 정말 탁월하더라고요.

📍 위치: {biz.get('address', region)}
📞 문의: 네이버 또는 카카오맵에서 검색

##{region_short}{category} #{name} #{kw1} #{kw2}
"""
    else:
        return f"""# {category} 전문가 추천 — {name} 서비스 이용 후기

{kw1} 서비스를 알아보다가 {name}을 알게 되었어요. 오늘은 실제 이용 경험을 공유해드리겠습니다.

## {name}은 어떤 곳인가요?

{name}은 {kw1} 분야 전문 서비스를 제공하는 곳으로, {kw2}에 특화된 노하우를 가지고 있습니다.

## 서비스 이용 과정

처음에는 홈페이지에서 기본 정보를 확인하고, 비대면 상담을 통해 구체적인 서비스 내용을 논의했습니다. 맞춤형 접근 방식이 인상적이었어요.

## 서비스 결과

{kw1} 관련 고민이 많았는데, 전문적인 분석과 실행 방안으로 실질적인 도움을 받을 수 있었습니다.

## 추천 대상

- {kw1} 서비스가 필요하신 분
- 전문가의 체계적인 도움이 필요하신 분
- 비대면으로 편리하게 이용하고 싶으신 분

## 총평

{category} 서비스를 알아보고 계시다면 {name}에 문의해보세요. 전문성과 친절함을 모두 갖춘 곳입니다.

🌐 홈페이지: {biz.get('website_url', '공식 홈페이지 참조')}

#{kw1} #{kw2} #{category}전문가 #{name}
"""


def build_smart_place_checklist(biz: dict, naver_data: dict = None) -> list[str]:
    """스마트플레이스 체크리스트 (location_based 전용)"""
    checklist = list(_SMART_PLACE_CHECKLIST)

    # 이미 스마트플레이스 등록된 경우 등록 항목 제거
    if naver_data and naver_data.get("is_smart_place"):
        checklist = [c for c in checklist if "등록" not in c or "예약" in c or "카카오" in c]
    return checklist


def build_seo_checklist(website_health: dict = None) -> list[str]:
    """SEO 체크리스트 (non_location 전용) — website_health 결과 반영"""
    checklist = list(_SEO_CHECKLIST_TEMPLATE)

    if website_health:
        # 이미 완료된 항목 제거 (체크 표시로 구분)
        if website_health.get("has_json_ld"):
            checklist = [c for c in checklist if "JSON-LD" not in c]
        if website_health.get("has_open_graph"):
            checklist = [c for c in checklist if "Open Graph" not in c]
        if website_health.get("is_https"):
            checklist = [c for c in checklist if "SSL" not in c]
        if website_health.get("is_mobile_friendly"):
            checklist = [c for c in checklist if "모바일" not in c]

    return checklist


async def build_action_tools(
    biz: dict,
    context: str,
    website_health: dict = None,
    naver_data: dict = None,
    scan_id: str = None,
) -> ActionTools:
    """ActionTools 전체 생성 (guide_generator.py에서 호출)"""
    try:
        ctx = ScanContext(context)
    except ValueError:
        ctx = ScanContext.LOCATION_BASED

    # JSON-LD 스키마 생성 (schema_generator.py 재사용)
    json_ld = await _generate_json_ld(biz)

    # FAQ 목록 (context별)
    faq_list = build_faq_list(biz, context)

    # 키워드 목록
    keyword_list = build_keyword_list(biz, context)

    # 블로그 포스팅 초안
    blog_template = build_blog_template(biz, context)

    # 스마트플레이스 체크리스트 (location_based 전용)
    smart_place = build_smart_place_checklist(biz, naver_data) if ctx == ScanContext.LOCATION_BASED else None

    # SEO 체크리스트 (non_location 전용)
    seo_checklist = build_seo_checklist(website_health) if ctx == ScanContext.NON_LOCATION else None

    return ActionTools(
        json_ld_schema=json_ld,
        faq_list=faq_list,
        keyword_list=keyword_list,
        blog_post_template=blog_template,
        smart_place_checklist=smart_place,
        seo_checklist=seo_checklist,
    )


async def _generate_json_ld(biz: dict) -> str:
    """JSON-LD 구조화 데이터 생성"""
    try:
        from services.schema_generator import generate_schema
        schema = generate_schema(
            business_name=biz.get("name", ""),
            category=biz.get("category", ""),
            region=biz.get("region", ""),
            address=biz.get("address"),
            phone=biz.get("phone"),
            website_url=biz.get("website_url"),
        )
        return f'<script type="application/ld+json">\n{json.dumps(schema, ensure_ascii=False, indent=2)}\n</script>'
    except Exception as e:
        _logger.warning(f"JSON-LD generation failed: {e}")
        # 기본 LocalBusiness 스키마
        name = biz.get("name", "")
        return f'''<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "{name}",
  "address": {{
    "@type": "PostalAddress",
    "addressLocality": "{biz.get('region', '')}",
    "streetAddress": "{biz.get('address', '')}"
  }},
  "telephone": "{biz.get('phone', '')}",
  "url": "{biz.get('website_url', '')}"
}}
</script>'''
