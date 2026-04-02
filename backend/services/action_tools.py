"""
ActionTools 생성 서비스
도메인 모델 v2.4 § 8 — context별 실행 도구 생성
ActionPlan의 tools 필드를 채우는 역할
"""
import json
import logging
from models.context import ScanContext
from models.action import ActionTools, FAQ, ReviewResponseDraft

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


def build_review_response_drafts(biz: dict, recent_reviews: list[dict] = None) -> list[ReviewResponseDraft]:
    """리뷰 답변 초안 3개 생성 (긍정/부정/일반)

    리뷰 답변율은 네이버 AI 브리핑·Google AI 추천의 직접 신호.
    recent_reviews: [{"text": str, "rating": int}, ...] — 없으면 템플릿으로 생성
    """
    name = biz.get("name", "우리 가게")
    category = biz.get("category", "")

    if recent_reviews:
        drafts = []
        for review in recent_reviews[:3]:
            rating = review.get("rating", 5)
            snippet = review.get("text", "")[:50]
            if rating >= 4:
                tone = "grateful"
                response = (
                    f"소중한 리뷰 감사합니다! {name}을 찾아주셔서 정말 기쁩니다. "
                    f"앞으로도 더 좋은 서비스로 보답하겠습니다. 또 방문해 주세요 😊"
                )
            elif rating <= 2:
                tone = "apologetic"
                response = (
                    f"불편을 드려 진심으로 사과드립니다. 소중한 말씀 감사히 듣겠습니다. "
                    f"더 나은 {category} 서비스를 위해 즉시 개선하겠습니다. "
                    f"다음에 다시 방문해 주신다면 더 만족스러운 경험을 드리겠습니다."
                )
            else:
                tone = "neutral"
                response = (
                    f"리뷰 남겨주셔서 감사합니다. {name}을 이용해 주셔서 감사드립니다. "
                    f"더 좋은 서비스로 보답하겠습니다. 또 뵙겠습니다!"
                )
            drafts.append(ReviewResponseDraft(
                review_snippet=snippet,
                rating=rating,
                draft_response=response,
                tone=tone,
            ))
        return drafts

    # 템플릿 기반 (리뷰 데이터 없을 때)
    return [
        ReviewResponseDraft(
            review_snippet="(긍정 리뷰 — 별점 4~5)",
            rating=5,
            draft_response=(
                f"소중한 리뷰 감사합니다! {name}을 찾아주셔서 정말 기쁩니다. "
                f"앞으로도 최고의 {category} 서비스로 보답하겠습니다. 다음에 또 만나요 😊"
            ),
            tone="grateful",
        ),
        ReviewResponseDraft(
            review_snippet="(부정 리뷰 — 별점 1~2)",
            rating=2,
            draft_response=(
                f"불편을 드려 진심으로 사과드립니다. 소중한 말씀 감사히 받겠습니다. "
                f"{name}은 고객 만족을 최우선으로 생각합니다. "
                f"지적해 주신 부분을 즉시 개선하겠습니다. 다시 한 번 기회를 주시면 더 나은 모습을 보여드리겠습니다."
            ),
            tone="apologetic",
        ),
        ReviewResponseDraft(
            review_snippet="(일반 리뷰 — 별점 3)",
            rating=3,
            draft_response=(
                f"방문해 주시고 리뷰 남겨주셔서 감사합니다. "
                f"{name}을 이용해 주셔서 감사드립니다. "
                f"더 좋은 서비스로 보답하겠습니다. 또 방문해 주세요!"
            ),
            tone="neutral",
        ),
    ]


def build_smart_place_faq_answers(biz: dict) -> list[FAQ]:
    """스마트플레이스 '사장님 Q&A' 탭에 바로 등록 가능한 FAQ (location_based 전용)

    네이버 AI 브리핑의 가장 직접적 인용 경로:
    스마트플레이스 FAQ 답변이 네이버 AI 브리핑에 그대로 노출됨.
    """
    name = biz.get("name", "저희 가게")
    category = biz.get("category", "")
    region = biz.get("region", "")
    region_short = region.split()[0] if region else region
    address = biz.get("address", f"{region} 위치")
    phone = biz.get("phone", "")
    keywords = biz.get("keywords") or []
    kw1 = keywords[0] if keywords else category

    return [
        FAQ(
            question=f"{region_short} {category} 추천할 수 있나요?",
            answer=(
                f"네, {name}을 추천드립니다. {region_short}에서 {kw1} 전문으로 운영하고 있으며, "
                f"지역 고객분들께 꾸준히 사랑받고 있습니다. "
                f"방문 전 전화 또는 네이버 예약을 이용해 주세요."
            ),
        ),
        FAQ(
            question="영업시간이 어떻게 되나요?",
            answer=(
                f"{name}의 영업시간은 네이버 스마트플레이스에서 확인하실 수 있습니다. "
                f"공휴일 및 임시 휴무는 네이버 공지사항을 참고해 주세요. "
                f"방문 전 확인을 권장드립니다."
            ),
        ),
        FAQ(
            question="주차가 가능한가요?",
            answer=(
                f"{name} 주변 주차 정보는 네이버 지도에서 '주차' 검색으로 확인하실 수 있습니다. "
                f"자세한 안내는 {phone or '전화 문의'}를 통해 확인해 주세요."
            ),
        ),
        FAQ(
            question="예약이 필요한가요?",
            answer=(
                f"{name}은 네이버 예약을 통해 편리하게 예약하실 수 있습니다. "
                f"주말·공휴일은 사전 예약을 권장드립니다. "
                f"당일 방문도 가능하지만, 대기 시간이 발생할 수 있습니다."
            ),
        ),
        FAQ(
            question=f"{name}의 대표 메뉴(서비스)는 무엇인가요?",
            answer=(
                f"{name}의 대표 {kw1}는 고객들이 가장 많이 찾는 메뉴입니다. "
                f"자세한 내용은 네이버 스마트플레이스 메뉴 탭 또는 "
                f"카카오맵에서 확인하실 수 있습니다."
            ),
        ),
    ]


def build_review_request_message(
    biz: dict,
    top_priority_keyword: str | None = None,
    missing_keywords: list[str] | None = None,
) -> str:
    """QR코드·영수증·테이블 카드에 넣을 리뷰 유도 문구

    리뷰 수 증가 → review_quality 점수 상승 → AI 검색 추천 확률 상승

    키워드 타겟팅:
    - top_priority_keyword가 있으면 그 키워드를 자연스럽게 유도
    - 네이버 리뷰 정책 엄수: 리워드 제공 암시 금지 (정책 위반 시 리뷰 삭제 + 제재)
    """
    from services.keyword_taxonomy import build_qr_message as _qr_msg

    name = biz.get("name", "저희 가게")
    naver_place_id = biz.get("naver_place_id", "")

    naver_url = (
        f"https://map.naver.com/p/entry/place/{naver_place_id}"
        if naver_place_id else f"네이버 지도에서 '{name}' 검색 후 리뷰 작성"
    )

    # 키워드 타겟팅 문구 (있을 경우)
    if top_priority_keyword:
        keyword_msg = _qr_msg(
            top_priority_keyword=top_priority_keyword,
            missing_keywords=missing_keywords or [],
            business_name=name,
        )
    else:
        keyword_msg = f"오늘 {name} 방문 어떠셨나요? 솔직한 경험을 짧게 남겨주시면 감사하겠습니다."

    return (
        f"{keyword_msg}\n\n"
        f"📝 네이버 리뷰 작성: {naver_url}"
    )


def build_naver_post_template(biz: dict) -> str:
    """스마트플레이스 '소식' (공지사항) 등록용 초안 (location_based 전용)

    블로그 글쓰기가 어려운 소상공인용 대안.
    스마트플레이스 소식은 네이버 검색 결과와 AI 브리핑에 직접 노출됨.
    200~300자 단문으로 작성.
    """
    name = biz.get("name", "저희 가게")
    category = biz.get("category", "")
    region = biz.get("region", "")
    region_short = region.split()[0] if region else region
    keywords = biz.get("keywords") or []
    kw1 = keywords[0] if keywords else category

    return (
        f"✨ {name} 소식\n\n"
        f"{region_short} {category}을 찾고 계신가요?\n\n"
        f"{name}은 {kw1} 전문으로 지역 고객분들께 꾸준히 사랑받고 있습니다.\n"
        f"최신 메뉴와 이벤트 정보는 네이버 스마트플레이스에서 확인하세요!\n\n"
        f"📌 예약: 네이버 예약\n"
        f"📞 문의: {biz.get('phone', '전화 문의')}\n"
        f"📍 위치: {biz.get('address', region)}"
    )


async def build_action_tools(
    biz: dict,
    context: str,
    website_health: dict = None,
    naver_data: dict = None,
    scan_id: str = None,
    recent_reviews: list[dict] = None,
    keyword_gap: dict | None = None,
) -> ActionTools:
    """ActionTools 전체 생성 (guide_generator.py에서 호출)

    v2.6 추가: direct_briefing_paths — 고객 없이 오늘 당장 할 수 있는 AI 브리핑 강화 4경로
    """
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

    # v2.4 추가 — 소상공인 즉시 활용 도구
    review_drafts = build_review_response_drafts(biz, recent_reviews)

    smart_place_faq = build_smart_place_faq_answers(biz) if ctx == ScanContext.LOCATION_BASED else None

    # v2.5 — keyword_gap이 있으면 1순위 키워드 타겟팅 QR 문구 생성
    top_kw = keyword_gap.get("top_priority_keyword") if keyword_gap else None
    missing_kws = keyword_gap.get("missing_keywords") if keyword_gap else None
    comp_only_kws = keyword_gap.get("competitor_only_keywords") if keyword_gap else None
    covered_kws = keyword_gap.get("covered_keywords") if keyword_gap else None
    coverage_rate = keyword_gap.get("coverage_rate", 0.0) if keyword_gap else 0.0

    review_request = build_review_request_message(biz, top_kw, missing_kws)

    naver_post = build_naver_post_template(biz) if ctx == ScanContext.LOCATION_BASED else None

    # v2.6 — AI 브리핑 직접 관리 경로 (location_based 전용)
    direct_paths: list[dict] = []
    briefing_summary = ""
    if ctx == ScanContext.LOCATION_BASED and keyword_gap:
        try:
            from services.briefing_engine import build_direct_briefing_paths, build_briefing_summary
            direct_paths = build_direct_briefing_paths(
                biz=biz,
                missing_keywords=missing_kws or [],
                competitor_only_keywords=comp_only_kws or [],
                existing_keywords=covered_kws or [],
            )
            briefing_summary = build_briefing_summary(
                paths=direct_paths,
                coverage_rate=coverage_rate,
                top_priority_keyword=top_kw,
            )
        except Exception as e:
            _logger.warning(f"direct_briefing_paths 생성 실패: {e}")

    return ActionTools(
        json_ld_schema=json_ld,
        faq_list=faq_list,
        keyword_list=keyword_list,
        blog_post_template=blog_template,
        smart_place_checklist=smart_place,
        seo_checklist=seo_checklist,
        review_response_drafts=review_drafts,
        smart_place_faq_answers=smart_place_faq,
        review_request_message=review_request,
        naver_post_template=naver_post,
        direct_briefing_paths=direct_paths,
        briefing_summary=briefing_summary,
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
