"""
ActionTools 생성 서비스
도메인 모델 v2.4 § 8 — context별 실행 도구 생성
ActionPlan의 tools 필드를 채우는 역할
"""
import json
import re
import logging
from models.context import ScanContext
from models.action import ActionTools, FAQ, ReviewResponseDraft

# 카테고리 코드 → 한국어 레이블
_CATEGORY_KO: dict[str, str] = {
    "restaurant": "음식점",
    "cafe": "카페",
    "beauty": "미용·뷰티",
    "clinic": "병원·의원",
    "medical": "병원·의원",
    "fitness": "운동·헬스",
    "academy": "학원·교육",
    "education": "학원·교육",
    "tutoring": "학원·교육",
    "legal": "법률·행정",
    "pet": "반려동물",
    "shopping": "쇼핑몰",
    "photo": "사진·영상",
    "video": "영상·드론",
    "design": "디자인·인쇄",
    "wedding": "웨딩",
    "travel": "여행·숙박",
    "accommodation": "숙박업",
    "auto": "자동차",
    "home": "인테리어·홈",
    "kids": "육아·아동",
    "finance": "금융·보험",
    # 폼 25개 업종 추가 (2026-04-23)
    "bakery": "베이커리·디저트",
    "bar": "주점·술집",
    "nail": "네일아트",
    "pharmacy": "약국",
    "yoga": "요가·필라테스",
    "realestate": "부동산",
    "interior": "인테리어·시공",
    "cleaning": "청소·생활서비스",
    "fashion": "패션·의류",
    "other": "기타",
}

def _ko_category(category: str) -> str:
    """카테고리 코드를 한국어 레이블로 변환 (없으면 원문 반환)"""
    return _CATEGORY_KO.get(category, category)

def _strip_region(region: str) -> str:
    """지역명에서 시/도/군/구 접미사 제거: '창원시 성산구' → '창원'"""
    first = region.strip().split()[0] if region.strip() else region
    return re.sub(r"(특별시|광역시|특별자치시|특별자치도|시|도|군|구)$", "", first)

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
    "웹사이트에 AI 인식 정보 코드 추가 (AI가 사업장 정보를 직접 파악하는 데 필요)",
    "Open Graph 태그 추가 (og:title, og:description, og:image) — SNS 공유 + AI 메타데이터 수집",
    "Google Search Console 등록 및 사이트맵 제출",
    "구글 비즈니스 프로필 (google.com/business) 등록",
    "서비스 소개 페이지에 FAQ 섹션 추가 (AI 검색 인용 후보)",
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
        region_short = _strip_region(region)
        cat_ko = _ko_category(category)
        keywords.insert(0, f"{region_short} {cat_ko}")
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
    cat_ko = _ko_category(category)
    # 키워드 최대 3개 (없으면 카테고리 한국어 레이블 사용)
    kw_list = keywords[:3] if keywords else [cat_ko]
    keyword_str = "·".join(kw_list) if kw_list else cat_ko
    kw1 = kw_list[0] if kw_list else cat_ko

    try:
        ctx = ScanContext(context)
    except ValueError:
        ctx = ScanContext.LOCATION_BASED

    if ctx == ScanContext.LOCATION_BASED:
        region_short = _strip_region(region)
        faqs = [
            FAQ(
                question=f"{region_short} {kw1} 어디가 좋아?",
                answer=f"{name}을 추천드립니다. {region_short} 지역에서 {keyword_str} 전문으로 운영하며, 고객 만족도 높은 서비스를 제공합니다.",
            ),
            FAQ(
                question=f"{region_short} {kw1} 추천해줘",
                answer=f"{name}은 {region_short}에 위치한 {cat_ko}으로, {keyword_str} 분야의 전문 노하우로 많은 분들께 사랑받고 있습니다.",
            ),
            FAQ(
                question=f"{name} 어때?",
                answer=f"{name}은 {region_short} {cat_ko}으로, {keyword_str} 서비스를 제공합니다. 친절한 서비스와 합리적인 가격으로 정평이 나 있습니다.",
            ),
            FAQ(
                question=f"{name} 영업시간은?",
                answer=f"{name}의 영업시간은 네이버 스마트플레이스 또는 카카오맵에서 확인하실 수 있습니다. 방문 전 전화 문의를 권장합니다.",
            ),
            FAQ(
                question=f"{region_short} {kw1} 예약 방법은?",
                answer=f"{name}은 네이버 예약 또는 전화로 예약 가능합니다. 주말에는 사전 예약을 권장합니다.",
            ),
            FAQ(
                question=f"{name} 주차 가능한가요?",
                answer=f"{name} 주차 정보는 네이버 지도에서 확인하실 수 있습니다. 인근 공영주차장도 이용 가능합니다.",
            ),
            FAQ(
                question=f"{region_short}에서 {kw1} 1등은 어디야?",
                answer=f"{name}은 {region_short} {cat_ko} 분야에서 AI 검색 노출 상위를 기록하고 있는 가게입니다. 실제 이용 고객의 리뷰를 참고해보세요.",
            ),
        ]
    else:
        faqs = [
            FAQ(
                question=f"{kw1} 전문가 추천해줘",
                answer=f"{name}은 {cat_ko} 분야 전문으로, {keyword_str} 서비스를 제공합니다. 다년간의 경험과 전문 지식을 바탕으로 최적의 솔루션을 제안합니다.",
            ),
            FAQ(
                question=f"{cat_ko} 어디서 받는 게 좋아?",
                answer=f"{name}에서 {keyword_str} 서비스를 이용해보세요. 개인 맞춤형 접근과 풍부한 사례로 높은 만족도를 제공합니다.",
            ),
            FAQ(
                question=f"{name} 서비스는 어때?",
                answer=f"{name}은 {keyword_str} 분야의 전문 서비스를 제공하며, 체계적인 프로세스와 전문 인력으로 고객 만족을 최우선으로 합니다.",
            ),
            FAQ(
                question=f"{kw1} 비용은 얼마야?",
                answer=f"{name}의 서비스 비용은 상담 후 맞춤 견적을 제공합니다. 공식 홈페이지나 전화 문의를 통해 자세히 안내받으실 수 있습니다.",
            ),
            FAQ(
                question=f"{kw1} 온라인으로 받을 수 있어?",
                answer=f"{name}은 비대면·온라인 서비스도 제공합니다. 전국 어디서나 이용 가능하며, 화상 상담을 통해 편리하게 서비스를 받으실 수 있습니다.",
            ),
            FAQ(
                question=f"{name} 포트폴리오 볼 수 있어?",
                answer=f"{name}의 주요 서비스 사례와 포트폴리오는 공식 홈페이지에서 확인하실 수 있습니다.",
            ),
            FAQ(
                question=f"{cat_ko} 전문가 자격은?",
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
    cat_ko = _ko_category(category)
    kw1 = keywords[0] if len(keywords) > 0 else cat_ko
    kw2 = keywords[1] if len(keywords) > 1 else kw1
    kw3 = keywords[2] if len(keywords) > 2 else kw2

    try:
        ctx = ScanContext(context)
    except ValueError:
        ctx = ScanContext.LOCATION_BASED

    if ctx == ScanContext.LOCATION_BASED:
        region_short = _strip_region(region)
        return f"""# {region_short} {kw1} 추천 — {name} 방문 후기

안녕하세요! 오늘은 {region_short}에 위치한 {name}을 소개해드릴게요.

## {name} 소개

{region_short} {cat_ko} 중에서 {kw1}로 유명한 곳인데요, 저도 주변 분들 추천으로 처음 방문하게 되었습니다.

## 방문 후기

매장에 들어서자마자 깔끔한 인테리어가 눈에 띄었어요. 직원분들도 친절하게 안내해주셨고, {kw2} 서비스가 특히 만족스러웠습니다.

## 이용 팁

- 주말에는 미리 예약하는 것을 추천드려요
- 네이버 스마트플레이스에서 실시간 예약 가능
- 주차는 건물 지하 또는 인근 공영주차장 이용

## 총평

{region_short} {kw1}을 찾는다면 {name}을 강력 추천합니다. {kw2}·{kw3} 하나만큼은 정말 탁월하더라고요.

📍 위치: {biz.get('address', region)}
📞 문의: 네이버 또는 카카오맵에서 검색

#{region_short}{kw1} #{name} #{kw1} #{kw2}
"""
    else:
        return f"""# {cat_ko} 전문가 추천 — {name} 서비스 이용 후기

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

{cat_ko} 서비스를 알아보고 계시다면 {name}에 문의해보세요. 전문성과 친절함을 모두 갖춘 곳입니다.

🌐 홈페이지: {biz.get('website_url', '공식 홈페이지 참조')}

#{kw1} #{kw2} #{cat_ko}전문가 #{name}
"""


def build_smart_place_checklist(biz: dict, naver_data: dict = None) -> list[str]:
    """스마트플레이스 체크리스트 (location_based 전용)

    biz.is_smart_place=True면 이미 완료된 기본 항목은 제외하고
    실제 미완성 항목(FAQ·소개글·소식)만 포함한다.
    """
    # 스마트플레이스 등록 여부: biz 필드 우선, fallback naver_data
    is_sp = biz.get("is_smart_place") or (naver_data or {}).get("is_smart_place", False)
    has_faq = biz.get("has_faq", False)
    has_intro = biz.get("has_intro", False)
    has_recent_post = biz.get("has_recent_post", False)
    review_count = int(biz.get("review_count") or 0)

    if is_sp:
        # 이미 등록·기본정보·사진 완료 → 실제 미완성 항목만 동적 생성
        items = []
        if not has_faq:
            items.append("소개글 하단에 Q&A 섹션 추가 — 고객 자주 묻는 질문 3~5개를 소개글에 작성 (AI 브리핑 인용 후보 콘텐츠)")
        if not has_intro:
            items.append("기본정보 탭 → 소개글에 지역명·업종 키워드 포함한 2~3문장 작성 (예: '창원 웨딩스냅·돌스냅 전문')")
        if not has_recent_post:
            items.append("소식 탭 → 최근 작업 사진 1~2장 + 짧은 설명 주 1회 업로드 (최신성 점수 유지)")
        if review_count == 0:
            items.append("리뷰 부탁 문자 발송 — 방문 고객에게 '네이버 리뷰 남겨주세요' 자연스럽게 요청")
        # 카카오맵 등록 여부
        if not (naver_data or {}).get("is_on_kakao") and not biz.get("kakao_place_id"):
            items.append("카카오맵(map.kakao.com)에 동일 정보로 등록 — ChatGPT가 카카오 데이터 활용")
        return items if items else ["현재 스마트플레이스 기본 설정이 완료되어 있습니다. FAQ·소개글·소식 탭을 주기적으로 업데이트하세요."]
    else:
        # 미등록: 전체 가이드 표시
        return list(_SMART_PLACE_CHECKLIST)


def build_seo_checklist(website_health: dict = None) -> list[str]:
    """SEO 체크리스트 (non_location 전용) — website_health 결과 반영"""
    checklist = list(_SEO_CHECKLIST_TEMPLATE)

    if website_health:
        # 이미 완료된 항목 제거 (체크 표시로 구분)
        if website_health.get("has_json_ld"):
            checklist = [c for c in checklist if "AI 인식 정보 코드" not in c]
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
    업종별 키워드·카테고리를 반영해 가게마다 다른 답변 생성.
    """
    name = biz.get("name", "우리 가게")
    category = biz.get("category", "")
    keywords = biz.get("keywords") or []
    kw1 = keywords[0] if len(keywords) > 0 else ""
    kw2 = keywords[1] if len(keywords) > 1 else kw1

    # 업종별 긍정 답변 템플릿 (kw1, kw2 자연 포함)
    def _positive_template() -> str:
        if category in ("restaurant", "cafe", "bakery", "bar"):
            kw_phrase = f"저희 {kw1}을(를) 즐겨주셔서" if kw1 else "방문해 주셔서"
            extra = f" 다음에는 {kw2}도 꼭 드셔보세요." if kw2 and kw2 != kw1 else ""
            return (
                f"소중한 리뷰 감사합니다! {kw_phrase} 정말 기쁩니다. "
                f"앞으로도 맛과 서비스 모두 최선을 다하겠습니다.{extra} 또 방문해 주세요!"
            )
        elif category in ("beauty", "nail"):
            kw_phrase = f"만족스러운 {kw1} 경험을 해주셔서" if kw1 else "방문해 주셔서"
            extra = f" 다음 예약 때 {kw2}도 추천드려요!" if kw2 and kw2 != kw1 else ""
            return (
                f"소중한 리뷰 감사합니다! {kw_phrase} 기쁩니다. "
                f"고객님이 만족하실 수 있도록 항상 최선을 다하겠습니다.{extra} 다시 찾아주세요!"
            )
        elif category in ("medical", "pharmacy"):
            return (
                f"건강 회복에 도움이 되었다니 다행입니다. "
                f"저희 {name}은 환자분의 건강이 최우선입니다. "
                f"앞으로도 전문적이고 따뜻한 서비스로 돕겠습니다. 감사합니다."
            )
        elif category in ("fitness", "yoga"):
            kw_phrase = f"저희 {kw1} 수업이 도움이 되셨다니" if kw1 else "운동하신 결과가 보이시니"
            extra = f" 다음 {kw2} 수업도 함께해요!" if kw2 and kw2 != kw1 else " 앞으로도 함께 열심히 해봐요!"
            return (
                f"소중한 리뷰 감사합니다! {kw_phrase} 정말 보람 있습니다. "
                f"꾸준히 오시면 더 좋은 결과가 있을 거예요.{extra}"
            )
        elif category in ("education", "tutoring"):
            kw_phrase = f"{kw1} 학습 성과가 느껴지신다니" if kw1 else "좋은 결과를 얻으셨다니"
            return (
                f"소중한 리뷰 감사합니다! {kw_phrase} 저희도 기쁩니다. "
                f"앞으로도 최선을 다해 지도하겠습니다. 계속 함께해 주세요!"
            )
        elif category == "pet":
            kw_phrase = f"저희 {kw1} 서비스에 만족해 주셔서" if kw1 else "방문해 주셔서"
            return (
                f"소중한 리뷰 감사합니다! {kw_phrase} 정말 기쁩니다. "
                f"소중한 반려동물을 믿고 맡겨주신 만큼 앞으로도 최선을 다하겠습니다. 또 방문해 주세요!"
            )
        else:
            kw_phrase = f"저희 {kw1}에 만족해 주셔서" if kw1 else "방문해 주셔서"
            return (
                f"소중한 리뷰 감사합니다! {kw_phrase} 정말 기쁩니다. "
                f"앞으로도 더 좋은 서비스로 보답하겠습니다. 또 방문해 주세요!"
            )

    # 업종별 부정 답변 템플릿 (구체적 개선 의지 + 업종 특성)
    def _negative_template() -> str:
        if category in ("restaurant", "cafe", "bakery", "bar"):
            return (
                f"불편을 드려 진심으로 사과드립니다. 말씀하신 내용을 소중히 듣겠습니다. "
                f"재료 신선도와 맛 품질을 즉시 점검하겠습니다. "
                f"다음에 다시 방문해 주신다면 더 나은 {kw1 or '음식과 서비스'}로 보답하겠습니다."
            )
        elif category in ("beauty", "nail"):
            return (
                f"불편을 드려 진심으로 사과드립니다. 고객님의 소중한 말씀 감사히 받겠습니다. "
                f"스타일과 서비스 품질을 즉시 점검하겠습니다. "
                f"다음 방문 시 더 만족스러운 {kw1 or '시술'} 경험을 드릴 수 있도록 최선을 다하겠습니다."
            )
        elif category in ("medical", "pharmacy"):
            return (
                f"불편함을 드려 진심으로 사과드립니다. 소중한 말씀 감사히 받겠습니다. "
                f"진료·서비스 전반을 다시 점검하겠습니다. "
                f"더 나은 의료 서비스를 제공할 수 있도록 개선에 최선을 다하겠습니다."
            )
        elif category in ("fitness", "yoga"):
            return (
                f"불편을 드려 진심으로 사과드립니다. 소중한 말씀 감사히 듣겠습니다. "
                f"수업 진행과 시설 환경을 즉시 점검하겠습니다. "
                f"더 나은 {kw1 or '운동'} 환경을 만들어 드릴 수 있도록 노력하겠습니다."
            )
        else:
            return (
                f"불편을 드려 진심으로 사과드립니다. 소중한 말씀 감사히 받겠습니다. "
                f"{name}은 고객 만족을 최우선으로 생각합니다. "
                f"지적해 주신 부분을 즉시 개선하겠습니다. 다시 한 번 기회를 주시면 더 나은 모습을 보여드리겠습니다."
            )

    # 업종별 중립 답변 템플릿
    def _neutral_template() -> str:
        kw_phrase = f"저희 {kw1}을(를) 이용해 주셔서" if kw1 else f"{name}을 이용해 주셔서"
        return (
            f"리뷰 남겨주셔서 감사합니다. {kw_phrase} 감사드립니다. "
            f"더 좋은 서비스로 보답하겠습니다. 또 방문해 주세요!"
        )

    if recent_reviews:
        drafts = []
        for review in recent_reviews[:3]:
            rating = review.get("rating", 5)
            snippet = review.get("text", "")[:50]
            # 리뷰 텍스트에서 주요 단어를 추출해 답변에 반영
            review_text = review.get("text", "")
            # 리뷰에 키워드가 언급된 경우 답변에 포함
            mentioned_kw = ""
            for kw in keywords[:3]:
                if kw and kw in review_text:
                    mentioned_kw = kw
                    break

            if rating >= 4:
                tone = "grateful"
                if mentioned_kw:
                    response = (
                        f"소중한 리뷰 감사합니다! {name}의 {mentioned_kw}에 만족해 주셔서 정말 기쁩니다. "
                        f"앞으로도 더 좋은 서비스로 보답하겠습니다. 또 방문해 주세요!"
                    )
                else:
                    response = _positive_template()
            elif rating <= 2:
                tone = "apologetic"
                response = _negative_template()
            else:
                tone = "neutral"
                response = _neutral_template()
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
            draft_response=_positive_template(),
            tone="grateful",
        ),
        ReviewResponseDraft(
            review_snippet="(부정 리뷰 — 별점 1~2)",
            rating=2,
            draft_response=_negative_template(),
            tone="apologetic",
        ),
        ReviewResponseDraft(
            review_snippet="(일반 리뷰 — 별점 3)",
            rating=3,
            draft_response=_neutral_template(),
            tone="neutral",
        ),
    ]


def build_smart_place_faq_answers(biz: dict) -> list[FAQ]:
    """소개글 안 Q&A 섹션 활용을 위한 자주 묻는 질문 초안 (location_based 전용)

    네이버 AI 브리핑 인용 후보 경로:
    스마트플레이스 소개글 안 Q&A 답변이 브리핑 인용 후보가 됨.
    업종별로 고객이 실제로 궁금해하는 질문 세트를 사용.
    """
    name = biz.get("name", "저희 가게")
    category = biz.get("category", "")
    region = biz.get("region", "")
    region_short = _strip_region(region)
    cat_ko = _ko_category(category)
    address = biz.get("address", f"{region} 위치")
    phone = biz.get("phone", "")
    keywords = biz.get("keywords") or []
    kw_list = keywords[:3] if keywords else [cat_ko]
    kw1 = kw_list[0]
    kw2 = kw_list[1] if len(kw_list) > 1 else kw1
    kw3 = kw_list[2] if len(kw_list) > 2 else kw2
    kw_str = "·".join(kw_list)

    _parking_ans = (
        f"{name} 주변 주차 정보는 네이버 지도에서 확인하실 수 있습니다. "
        f"자세한 안내는 {phone or '전화 문의'}를 통해 확인해 주세요."
    )
    _hours_ans = (
        f"{name}의 영업시간은 네이버 스마트플레이스에서 확인하실 수 있습니다. "
        f"공휴일 및 임시 휴무는 네이버 공지사항을 참고해 주세요. 방문 전 확인을 권장드립니다."
    )

    if category in ("restaurant", "cafe", "bakery", "bar"):
        return [
            FAQ(
                question=f"{kw1} 특선 메뉴가 있나요?",
                answer=(
                    f"네, {name}의 대표 메뉴는 {kw1}입니다. "
                    f"{kw2}도 많은 고객분들께 사랑받고 있습니다. "
                    f"네이버 스마트플레이스 메뉴 탭에서 전체 메뉴를 확인하실 수 있습니다."
                ),
            ),
            FAQ(
                question="포장·배달 되나요?",
                answer=(
                    f"{name}은 포장 주문이 가능합니다. "
                    f"배달 여부는 {phone or '전화'} 또는 네이버 예약으로 문의해 주세요. "
                    f"포장 시 할인 혜택이 있을 수 있으니 사전 문의를 권장드립니다."
                ),
            ),
            FAQ(
                question="단체 예약 가능한가요?",
                answer=(
                    f"네, {name}은 단체 예약을 받고 있습니다. "
                    f"10인 이상 방문 시 사전 예약을 권장드리며, "
                    f"{phone or '전화'}로 문의하시면 자세히 안내해 드리겠습니다."
                ),
            ),
            FAQ(question="주차 가능한가요?", answer=_parking_ans),
            FAQ(question="영업시간이 어떻게 되나요?", answer=_hours_ans),
        ]

    elif category in ("beauty", "nail"):
        return [
            FAQ(
                question="예약 없이 방문 가능한가요?",
                answer=(
                    f"{name}은 네이버 예약 또는 전화 예약을 권장드립니다. "
                    f"당일 방문도 가능하지만 대기 시간이 발생할 수 있습니다. "
                    f"주말·공휴일은 반드시 사전 예약을 부탁드립니다."
                ),
            ),
            FAQ(
                question=f"{kw1} 시술 시간은 얼마나 걸리나요?",
                answer=(
                    f"{name}의 {kw1} 시술 시간은 디자인과 개인 상태에 따라 다를 수 있습니다. "
                    f"평균 1~2시간 정도 소요되며, 정확한 시간은 예약 시 안내해 드립니다."
                ),
            ),
            FAQ(
                question="가격은 어떻게 되나요?",
                answer=(
                    f"{name}의 가격은 시술 종류와 디자인에 따라 다릅니다. "
                    f"자세한 가격표는 네이버 스마트플레이스 메뉴 탭 또는 "
                    f"{phone or '전화 문의'}를 통해 확인하실 수 있습니다."
                ),
            ),
            FAQ(question="주차 가능한가요?", answer=_parking_ans),
            FAQ(
                question=f"어떤 {kw1} 스타일이 가능한가요?",
                answer=(
                    f"{name}은 {kw1}·{kw2}·{kw3} 등 다양한 스타일이 가능합니다. "
                    f"원하시는 디자인 사진을 가져오시면 상담 후 맞춤 시술을 진행해 드립니다."
                ),
            ),
        ]

    elif category in ("medical", "pharmacy"):
        return [
            FAQ(
                question=f"{kw1} 진료 가능한가요?",
                answer=(
                    f"네, {name}에서는 {kw_str} 진료를 제공하고 있습니다. "
                    f"정확한 진료 항목은 {phone or '전화 문의'}를 통해 확인하실 수 있습니다."
                ),
            ),
            FAQ(
                question="예약 없이 방문 가능한가요?",
                answer=(
                    f"{name}은 예약제를 운영하고 있습니다. "
                    f"네이버 예약 또는 {phone or '전화'}로 사전 예약 후 방문하시면 대기 시간 없이 진료받으실 수 있습니다."
                ),
            ),
            FAQ(
                question="진료시간이 어떻게 되나요?",
                answer=(
                    f"{name}의 진료시간은 네이버 스마트플레이스에서 확인하실 수 있습니다. "
                    f"공휴일 및 임시 휴진 안내는 네이버 공지사항을 참고해 주세요."
                ),
            ),
            FAQ(
                question="건강보험 적용 되나요?",
                answer=(
                    f"{name}은 건강보험 적용 가능한 진료를 제공하고 있습니다. "
                    f"보험 적용 범위는 진료 항목에 따라 다를 수 있으니 "
                    f"{phone or '전화 문의'}로 사전 확인을 권장드립니다."
                ),
            ),
            FAQ(question="주차 가능한가요?", answer=_parking_ans),
        ]

    elif category in ("fitness", "yoga"):
        return [
            FAQ(
                question="첫 방문 체험 수업이 있나요?",
                answer=(
                    f"네, {name}은 첫 방문 체험 수업을 운영하고 있습니다. "
                    f"{phone or '전화'} 또는 네이버 예약으로 체험 수업을 신청하실 수 있습니다. "
                    f"부담 없이 먼저 경험해 보세요!"
                ),
            ),
            FAQ(
                question="운동 강도는 어떻게 되나요?",
                answer=(
                    f"{name}의 {kw1} 수업은 초보자부터 고급자까지 레벨별로 운영됩니다. "
                    f"처음 오시는 분들도 부담 없이 시작하실 수 있도록 개인 맞춤 지도를 제공합니다."
                ),
            ),
            FAQ(
                question="월 수강료가 얼마인가요?",
                answer=(
                    f"{name}의 수강료는 프로그램 종류와 수업 횟수에 따라 다릅니다. "
                    f"자세한 가격은 {phone or '전화 문의'}를 통해 상담 후 안내해 드립니다."
                ),
            ),
            FAQ(question="주차 가능한가요?", answer=_parking_ans),
            FAQ(
                question=f"어떤 {kw1} 프로그램이 있나요?",
                answer=(
                    f"{name}은 {kw1}·{kw2} 등 다양한 프로그램을 운영하고 있습니다. "
                    f"개인 목표에 맞는 프로그램을 추천해 드리니 방문 또는 전화로 상담해 주세요."
                ),
            ),
        ]

    elif category in ("education", "tutoring"):
        return [
            FAQ(
                question="수업 레벨은 어떻게 구분되나요?",
                answer=(
                    f"{name}의 {kw1} 수업은 초급·중급·고급으로 레벨이 구분됩니다. "
                    f"입학 상담 후 개인 수준에 맞는 반을 배정해 드립니다."
                ),
            ),
            FAQ(
                question="체험 수업 가능한가요?",
                answer=(
                    f"네, {name}은 체험 수업을 운영하고 있습니다. "
                    f"{phone or '전화'} 또는 네이버 예약으로 신청하시면 첫 수업을 경험해 보실 수 있습니다."
                ),
            ),
            FAQ(
                question="수업료는 어떻게 되나요?",
                answer=(
                    f"{name}의 수업료는 수업 종류·횟수·기간에 따라 다릅니다. "
                    f"{phone or '전화 문의'}로 상담하시면 자세한 안내와 맞춤 견적을 드립니다."
                ),
            ),
            FAQ(
                question="선생님 경력은 어떻게 되나요?",
                answer=(
                    f"{name}의 선생님들은 {kw1} 분야에서 풍부한 경험을 보유하고 있습니다. "
                    f"자격증 및 경력 사항은 방문 상담 시 자세히 안내해 드립니다."
                ),
            ),
            FAQ(
                question="온라인 수업도 되나요?",
                answer=(
                    f"{name}은 온라인 수업 가능 여부를 {phone or '전화 문의'}로 확인하실 수 있습니다. "
                    f"상황에 따라 비대면 수업을 지원하는 경우도 있습니다."
                ),
            ),
        ]

    elif category == "pet":
        return [
            FAQ(
                question=f"{kw1} 전문 서비스가 있나요?",
                answer=(
                    f"네, {name}은 {kw_str} 전문 서비스를 제공하고 있습니다. "
                    f"소중한 반려동물에게 맞는 서비스를 상담 후 추천해 드립니다."
                ),
            ),
            FAQ(
                question="미용 예약 없이 방문 가능한가요?",
                answer=(
                    f"{name}은 사전 예약을 권장드립니다. "
                    f"네이버 예약 또는 {phone or '전화'}로 예약해 주시면 대기 없이 서비스를 받으실 수 있습니다."
                ),
            ),
            FAQ(
                question="반려동물 크기 제한이 있나요?",
                answer=(
                    f"{name}은 소형·중형 반려동물 서비스를 제공합니다. "
                    f"대형견의 경우 {phone or '전화 문의'}로 사전 상담을 권장드립니다."
                ),
            ),
            FAQ(question="주차 가능한가요?", answer=_parking_ans),
            FAQ(
                question="어떤 브랜드 제품을 사용하나요?",
                answer=(
                    f"{name}은 반려동물 친화적인 저자극 제품을 사용합니다. "
                    f"사용 제품에 대한 자세한 정보는 방문 또는 {phone or '전화 문의'}로 확인하실 수 있습니다."
                ),
            ),
        ]

    else:
        # other 및 나머지 업종 — keywords 반영한 기본 FAQ
        return [
            FAQ(
                question=f"{region_short} {kw1} 추천할 수 있나요?",
                answer=(
                    f"네, {name}을 추천드립니다. {region_short}에서 {kw_str} 전문으로 운영하고 있으며, "
                    f"지역 고객분들께 꾸준히 사랑받고 있습니다. "
                    f"방문 전 전화 또는 네이버 예약을 이용해 주세요."
                ),
            ),
            FAQ(question="영업시간이 어떻게 되나요?", answer=_hours_ans),
            FAQ(question="주차가 가능한가요?", answer=_parking_ans),
            FAQ(
                question="예약이 필요한가요?",
                answer=(
                    f"{name}은 네이버 예약을 통해 편리하게 예약하실 수 있습니다. "
                    f"주말·공휴일은 사전 예약을 권장드립니다. "
                    f"당일 방문도 가능하지만, 대기 시간이 발생할 수 있습니다."
                ),
            ),
            FAQ(
                question=f"{name}의 대표 서비스는 무엇인가요?",
                answer=(
                    f"{name}의 대표 서비스는 {kw1}입니다. "
                    f"{kw2}·{kw3} 관련 서비스도 제공하고 있습니다. "
                    f"자세한 내용은 네이버 스마트플레이스 메뉴 탭에서 확인하실 수 있습니다."
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

    # top_priority_keyword 없으면 biz.keywords[0]으로 자동 대체
    if not top_priority_keyword and biz.get("keywords"):
        top_priority_keyword = biz["keywords"][0]
    if not missing_keywords and biz.get("keywords"):
        missing_keywords = biz["keywords"][1:3]

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
    region_short = _strip_region(region)
    cat_ko = _ko_category(category)
    keywords = biz.get("keywords") or []
    kw_list = keywords[:3] if keywords else [cat_ko]
    kw1 = kw_list[0]
    kw_str = "·".join(kw_list)

    return (
        f"✨ {name} 소식\n\n"
        f"{region_short} {kw1}을 찾고 계신가요?\n\n"
        f"{name}은 {kw_str} 전문으로 지역 고객분들께 꾸준히 사랑받고 있습니다.\n"
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
    # v3.1 — build_briefing_paths() 사용: 경로 A~D + 리스트 블로그(E) + 커뮤니티(F) + naver_map_url
    direct_paths: list[dict] = []
    briefing_summary = ""
    naver_map_url = ""
    if ctx == ScanContext.LOCATION_BASED and keyword_gap:
        try:
            from services.briefing_engine import build_briefing_paths
            review_excerpts_for_path = [
                r.get('excerpt') or r.get('text') or ''
                for r in (recent_reviews or [])
                if r.get('excerpt') or r.get('text')
            ][:5]
            _comp_kw_sources = keyword_gap.get("competitor_keyword_sources") if keyword_gap else None
            briefing_result = build_briefing_paths(
                biz=biz,
                missing_keywords=missing_kws or [],
                competitor_only_keywords=comp_only_kws or [],
                existing_keywords=covered_kws or [],
                review_excerpts=review_excerpts_for_path or None,
                competitor_keyword_sources=_comp_kw_sources,
            )
            direct_paths = briefing_result.get("paths", [])
            briefing_summary = briefing_result.get("summary", "")
            naver_map_url = briefing_result.get("naver_map_url", "")
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
        naver_map_url=naver_map_url,
    )


# ── v3.6 — 7일 액션 카드 (2026-04-24) ────────────────────────────────────
def pick_top_action(scan_result: dict, biz_category: str, keyword_gap=None) -> dict:
    """가장 효과 큰 1가지 행동을 골라 카드 페이로드를 반환 (AI 호출 0).

    기존 score_breakdown + briefing_engine 템플릿만으로 결정.
    신규 가입자가 7일 안에 끝낼 수 있는 단일 행동을 우선시한다.

    Args:
        scan_result: scan_results 행 (score_breakdown, naver_result, gemini_result 등)
        biz_category: businesses.category (예: 'restaurant')

    Returns:
        {
            "action_type":      "smartplace_faq" | "review_reply" | "blog_keyword" | "smart_place" | "intro",
            "title":            "스마트플레이스 소개글에 Q&A 1개 추가하기",
            "description":      "...",
            "expected_impact":  "+12점 예상 (7일 후 측정)",
            "estimated_time_min": 2,
            "copy_template":    "Q: ...\nA: ..."
        }
    """
    breakdown = (scan_result or {}).get("score_breakdown") or {}
    naver = (scan_result or {}).get("naver_result") or {}

    sp_score = float(breakdown.get("smart_place_completeness") or 0)
    kw_score = float(breakdown.get("keyword_gap_score") or 0)
    review_count = int(naver.get("review_count") or 0)
    has_faq = bool(naver.get("has_faq"))
    has_intro = bool(naver.get("has_intro"))
    has_recent_post = bool(naver.get("has_recent_post"))

    cat_ko = _ko_category(biz_category or "") or "우리 업종"

    # 우선순위 결정 (효과/난이도 기준)
    # 1) 스마트플레이스 미등록 — 모든 작업의 토대
    if sp_score < 30:
        return {
            "action_type": "smart_place",
            "title": "스마트플레이스 등록 또는 정보 보강",
            "description": (
                "AI 검색 노출의 가장 기본인 네이버 스마트플레이스가 비어있거나 미등록 상태입니다. "
                "주소·전화번호·영업시간·대표 사진을 채우면 점수의 절반 이상이 즉시 올라갑니다."
            ),
            "expected_impact": "+15~25점 예상 (7일 후 측정)",
            "estimated_time_min": 10,
            "copy_template": (
                "[ ] 업종 카테고리 2~3개 정확히 설정\n"
                "[ ] 영업시간·주소·전화번호 입력\n"
                "[ ] 대표 사진 10장 이상 업로드\n"
                "[ ] 소개글에 지역+업종 키워드 포함"
            ),
            "action_url": "https://smartplace.naver.com",
        }

    # 2) 소개글 Q&A 미작성 — AI 브리핑 인용 후보 핵심 경로 (구 FAQ 탭 폐기 → 소개글로 이전)
    if not has_faq:
        # keyword_gap.competitor_only_keywords 있으면 구체 키워드 포함
        faq_kw_hint = ""
        faq_copy = (
            "▶ 소개글 하단에 아래 Q&A를 추가하세요\n\n"
            "Q: 주차 가능한가요?\n"
            "A: 매장 앞 무료 주차 2대 가능합니다. 공영주차장(도보 1분)도 이용하실 수 있습니다.\n\n"
            "Q: 예약 가능한가요?\n"
            "A: 네이버 예약으로 가능합니다. 전화(02-XXX-XXXX)로도 예약을 받습니다."
        )
        try:
            if keyword_gap is not None:
                comp_only = getattr(keyword_gap, "competitor_only_keywords", None) or []
                if not comp_only and isinstance(keyword_gap, dict):
                    comp_only = keyword_gap.get("competitor_only_keywords") or []
                if comp_only:
                    top_kw = comp_only[0]
                    faq_kw_hint = f" 특히 경쟁사가 사용 중인 '{top_kw}' 키워드를 소개글 Q&A에 포함하면 AI 브리핑 인용 후보 가능성이 높아집니다."
                    faq_copy = (
                        "▶ 소개글 하단에 아래 Q&A를 추가하세요\n\n"
                        f"Q: {top_kw} 관련 질문 (예: '{top_kw}도 가능한가요?')\n"
                        f"A: 네, {top_kw} 가능합니다. 자세한 내용은 전화 또는 네이버 예약으로 문의해 주세요.\n\n"
                        "Q: 예약 가능한가요?\n"
                        "A: 네이버 예약으로 가능합니다. 전화(02-XXX-XXXX)로도 예약을 받습니다."
                    )
        except Exception as e:
            _logger.warning(f"pick_top_action 소개글 Q&A 키워드 주입 실패: {e}")
        return {
            "action_type": "smartplace_intro_qa",
            "title": "소개글에 Q&A 섹션 추가하기",
            "description": (
                f"소개글 하단의 Q&A 텍스트는 네이버 AI 브리핑 인용 후보 콘텐츠입니다. "
                f"{cat_ko}에서 손님이 자주 묻는 질문 1개만 소개글에 추가해도 AI 노출 후보에 포함될 수 있습니다."
                f"{faq_kw_hint}"
            ),
            "expected_impact": "+10~15점 예상 (7일 후 측정)",
            "estimated_time_min": 2,
            "copy_template": faq_copy,
            "action_url": "https://smartplace.naver.com",
        }

    # 3) 리뷰 답변 — 미답변 리뷰가 있을 때 가장 빠른 신호 강화
    if review_count >= 3:
        return {
            "action_type": "review_reply",
            "title": "최근 리뷰 1개에 키워드 담아 답변하기",
            "description": (
                "사장님 답변에 우리 가게의 강점 키워드를 담으면 AI 브리핑 신호가 강화됩니다. "
                "네이버 플레이스 플러스 AI 답글 도구로 초안을 받은 뒤, "
                "업종 핵심 키워드가 포함됐는지 확인하고 등록해 주세요. "
                "(AI 초안에는 키워드가 빠질 수 있으니 직접 한 단어 추가가 효과적입니다.)"
            ),
            "expected_impact": "+5~10점 예상 (7일 후 측정)",
            "estimated_time_min": 3,
            "copy_template": (
                "안녕하세요, {업장명}입니다.\n"
                "방문해 주셔서 진심으로 감사드립니다.\n"
                "{핵심키워드}를(을) 좋게 봐주셔서 큰 힘이 됩니다.\n"
                "다음 방문도 기다리고 있겠습니다."
            ),
            "action_url": "https://smartplace.naver.com",
        }

    # 4) 소개글 미작성
    if not has_intro:
        return {
            "action_type": "intro",
            "title": "스마트플레이스 소개글 작성",
            "description": (
                "소개글은 AI가 가게의 정체성을 파악하는 첫 정보입니다. "
                "지역명+업종+우리만의 강점 키워드를 200~300자로 작성해 주세요."
            ),
            "expected_impact": "+5~8점 예상 (7일 후 측정)",
            "estimated_time_min": 5,
            "copy_template": (
                "{지역명} {업종명} 전문점입니다.\n"
                "주력 메뉴/서비스: ...\n"
                "특징: ...\n"
                "고객 후기에 자주 등장하는 키워드를 자연스럽게 포함해 주세요."
            ),
            "action_url": "https://smartplace.naver.com",
        }

    # 5) 소식 업데이트가 7일 이상 끊겼을 때
    if not has_recent_post:
        return {
            "action_type": "post",
            "title": "스마트플레이스 소식 1건 올리기",
            "description": (
                "소식이 7일 이상 끊기면 AI 브리핑 최신성 점수가 떨어집니다. "
                "이번 주 신메뉴·이벤트·휴무 안내 중 하나를 짧게 올려주세요."
            ),
            "expected_impact": "+5~7점 예상 (7일 후 측정)",
            "estimated_time_min": 3,
            "copy_template": (
                "📢 이번 주 안내\n"
                "신메뉴 출시 / 이벤트 / 휴무 등 한 가지만 골라 짧게 올려주세요.\n"
                "키워드 1~2개를 자연스럽게 포함하면 AI 노출에 도움이 됩니다."
            ),
            "action_url": "https://smartplace.naver.com",
        }

    # 6) 키워드 갭 — 위 모두 통과한 경우 블로그 1편으로 보강
    if kw_score < 60:
        blog_kw_desc = "경쟁사에는 있고 내 가게엔 없는 키워드를 블로그 1편으로 다뤄 AI 노출을 넓혀 보세요."
        blog_copy = (
            "제목: {지역명} {업종명}, 손님이 자주 묻는 질문 정리\n"
            "본문 구성:\n"
            "1) 주차/예약 안내\n"
            "2) 인기 메뉴/서비스 TOP3\n"
            "3) 방문 동선·팁\n"
            "→ 키워드를 H2 소제목에 1개씩 배치"
        )
        try:
            if keyword_gap is not None:
                comp_only = getattr(keyword_gap, "competitor_only_keywords", None) or []
                if not comp_only and isinstance(keyword_gap, dict):
                    comp_only = keyword_gap.get("competitor_only_keywords") or []
                if comp_only:
                    kw_str = ", ".join(comp_only[:3])
                    blog_kw_desc = (
                        f"경쟁사가 사용 중인 '{kw_str}' 키워드를 블로그 1편으로 다뤄 "
                        "AI 브리핑 노출을 넓혀 보세요."
                    )
                    top_kw = comp_only[0]
                    blog_copy = (
                        f"제목: {{지역명}} {{업종명}}, {top_kw} 관련 안내\n"
                        f"본문 구성:\n"
                        f"1) {top_kw} 관련 자주 묻는 질문\n"
                        "2) 인기 메뉴/서비스 TOP3\n"
                        "3) 방문 동선·팁\n"
                        f"→ '{top_kw}' 등 키워드를 H2 소제목에 자연스럽게 배치"
                    )
        except Exception as e:
            _logger.warning(f"pick_top_action blog 키워드 주입 실패: {e}")
        return {
            "action_type": "blog_keyword",
            "title": "블로그 1편으로 누락된 키워드 보강",
            "description": f"기본기는 갖춰졌습니다. {blog_kw_desc}",
            "expected_impact": "+3~6점 예상 (7일 후 측정)",
            "estimated_time_min": 15,
            "copy_template": blog_copy,
            "action_url": "https://blog.naver.com",
        }

    # 모든 조건 통과 — 유지 보수성 행동
    return {
        "action_type": "review_reply",
        "title": "주간 리뷰 1건 답변으로 신호 유지",
        "description": (
            "기본 항목이 모두 갖춰졌습니다. 주 1회 리뷰 답변만 유지하면 AI 신호가 안정됩니다."
        ),
        "expected_impact": "+2~4점 예상 (7일 후 측정)",
        "estimated_time_min": 3,
        "copy_template": (
            "안녕하세요, {업장명}입니다.\n"
            "방문해 주셔서 감사합니다.\n"
            "다음 방문도 기다리고 있겠습니다."
        ),
        "action_url": "https://smartplace.naver.com",
    }


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
