"""
AI 브리핑 직접 관리 경로 엔진 (Direct Briefing Path Engine)
모델 엔진 v3.0

핵심 인사이트:
  네이버 AI 브리핑은 고객 리뷰뿐 아니라 사장님이 직접 쓰는
  4가지 텍스트(리뷰 답변 / FAQ / 소식 / 소개글)도 읽습니다.

  고객 리뷰는 기다려야 하지만, 이 4가지는 오늘 당장 할 수 있습니다.

경로별 AI 브리핑 영향도:
  A. 리뷰 답변  : 답변에 키워드 포함 → AI가 '사장님이 이 키워드를 제공한다'고 인식
  B. FAQ(Q&A)   : 답변이 브리핑에 직접 인용 (가장 직접적인 경로)
  C. 소식(공지) : 주 1회 업데이트 → 최신성 점수 + 키워드 커버리지
  D. 소개글     : 한 번 설정 → 영구적 키워드 기반 데이터
"""

import re
import logging
from typing import Optional
from services.keyword_taxonomy import get_industry_keywords, normalize_category

_logger = logging.getLogger("aeolab")

# 경로별 스마트플레이스 접근 URL
_SMARTPLACE_URLS = {
    "review_response": "https://smartplace.naver.com/business/reviews",
    "faq":             "https://smartplace.naver.com/business/faq",
    "post":            "https://smartplace.naver.com/business/notice",
    "intro":           "https://smartplace.naver.com/business/edit/basic",
}

# 경로별 실행 단계
_ACTION_STEPS = {
    "review_response": [
        "1. smartplace.naver.com 접속 → '리뷰 관리' 탭",
        "2. 미답변 리뷰 목록 확인",
        "3. 아래 '준비된 답변 초안' 복사 → 답변 등록",
        "4. 답변에 목표 키워드가 자연스럽게 포함되어 있는지 확인",
    ],
    "faq": [
        "1. smartplace.naver.com 접속 → '사장님 Q&A' 탭",
        "2. '질문 추가' 버튼 클릭",
        "3. 아래 FAQ 질문/답변을 그대로 붙여넣기",
        "4. 저장 — 네이버 AI 브리핑이 이 답변을 직접 인용합니다",
    ],
    "post": [
        "1. smartplace.naver.com 접속 → '소식' 탭",
        "2. '소식 작성' 버튼 클릭",
        "3. 아래 소식 초안 붙여넣기 (사진 1장 추가 권장)",
        "4. 발행 — 주 1회 이상 업데이트 시 AI 브리핑 최신성 점수 유지",
    ],
    "intro": [
        "1. smartplace.naver.com 접속 → '기본 정보' 탭",
        "2. '소개글' 항목 찾기",
        "3. 아래 소개글로 교체 (최대 500자)",
        "4. 저장 — 한 번만 하면 됩니다",
    ],
}

# 업종별 FAQ 질문 목록 (스마트플레이스 Q&A 탭 직접 등록용)
# 실제 고객이 물어보는 자연스러운 말투로 작성
_FAQ_QUESTIONS: dict[str, list[str]] = {
    "photo": [
        "돌스냅 비용이 얼마예요?",
        "야외 촬영도 가능한가요?",
        "촬영 후 사진 보정은 얼마나 걸려요?",
        "웨딩스냅 예약은 어떻게 하나요?",
        "돌잔치 당일 스냅도 가능한가요?",
    ],
    "restaurant": [
        "주차는 가능한가요?",
        "단체 예약 받으시나요?",
        "포장이나 배달도 되나요?",
        "예약 없이 방문해도 되나요?",
        "생일 파티나 회식 이용 가능한가요?",
    ],
    "cafe": [
        "주차 공간이 있나요?",
        "노트북 작업하기 좋은가요?",
        "반려견 동반 가능한가요?",
        "단체석이나 룸 예약 되나요?",
        "디저트 종류가 어떻게 되나요?",
    ],
    "beauty": [
        "예약 없이 방문해도 되나요?",
        "염색 비용이 얼마 정도 되나요?",
        "주차는 가능한가요?",
        "어린이 커트도 가능한가요?",
        "당일 예약도 가능한가요?",
    ],
    "clinic": [
        "예약 없이 방문 가능한가요?",
        "주차 공간이 있나요?",
        "야간 진료나 주말 진료 하시나요?",
        "건강보험 적용이 되나요?",
        "진료 대기 시간이 얼마나 되나요?",
    ],
    "academy": [
        "체험 수업이나 무료 상담이 가능한가요?",
        "수업 레벨이 어떻게 나뉘나요?",
        "중간에 등록해도 따라갈 수 있나요?",
        "교재비나 재료비가 따로 있나요?",
        "휴강이 생기면 보충 수업이 있나요?",
    ],
    "fitness": [
        "1일 체험권이 있나요?",
        "개인 PT도 가능한가요?",
        "샤워 시설이 있나요?",
        "주차는 가능한가요?",
        "등록 전 시설 둘러볼 수 있나요?",
    ],
    "pet": [
        "예약 없이 방문해도 되나요?",
        "모든 견종 미용 가능한가요?",
        "미용 시간이 얼마나 걸리나요?",
        "대형견도 가능한가요?",
        "픽업 서비스가 있나요?",
    ],
    "shopping": [
        "반품/교환은 어떻게 하나요?",
        "배송은 얼마나 걸리나요?",
        "사이즈 교환이 가능한가요?",
        "재입고 알림을 받을 수 있나요?",
    ],
    "_default": [
        "영업시간이 어떻게 되나요?",
        "주차는 가능한가요?",
        "예약 없이 방문해도 되나요?",
    ],
}

# 업종별 카테고리 정규화 맵 (FAQ 질문 분류용)
_CATEGORY_TO_FAQ_KEY: dict[str, str] = {
    "restaurant": "restaurant",
    "food": "restaurant",
    "korean": "restaurant",
    "japanese": "restaurant",
    "chinese": "restaurant",
    "cafe": "cafe",
    "coffee": "cafe",
    "dessert": "cafe",
    "beauty": "beauty",
    "hair": "beauty",
    "salon": "beauty",
    "nail": "beauty",
    "skin": "beauty",
    "clinic": "clinic",
    "hospital": "clinic",
    "medical": "clinic",
    "dental": "clinic",
    "pharmacy": "clinic",
    "academy": "academy",
    "education": "academy",
    "tutoring": "academy",
    "fitness": "fitness",
    "gym": "fitness",
    "pilates": "fitness",
    "yoga": "fitness",
    "pet": "pet",
    "grooming": "pet",
    "vet": "pet",
    "shopping": "shopping",
    "online": "shopping",
    "photo": "photo",
    "studio": "photo",
    "photography": "photo",
}


def _normalize_to_faq_key(category: str) -> str:
    """카테고리 문자열을 FAQ 질문 목록 키로 정규화."""
    if not category:
        return "_default"
    cat_lower = category.lower().strip()
    return _CATEGORY_TO_FAQ_KEY.get(cat_lower, "_default")


def _clean_keyword(kw: str) -> str:
    """
    키워드 끝의 조사/어미 제거.
    rstrip 대신 re.sub 사용 — rstrip은 문자 집합 기반이라 '이' 등 단일 자모도 소거됨.
    """
    return re.sub(r"(이며|이고|있음|입니다|이오니|합니다)$", "", kw).strip()


def _make_review_response_content(
    target_keywords: list[str],
    business_name: str,
    category: str,
) -> str:
    """
    목표 키워드를 자연스럽게 포함한 리뷰 답변 초안 생성.

    네이버 AI 브리핑은 사장님 답변에서도 키워드를 수집합니다.
    답변에 키워드를 심는 것은 합법적인 AI 신호 강화 방법입니다.
    """
    if not target_keywords:
        return (
            f"방문해 주셔서 진심으로 감사합니다! "
            f"{business_name}에서 좋은 경험을 하셨다니 기쁩니다. "
            f"다음에 또 방문해 주시면 더 좋은 서비스로 맞이하겠습니다."
        )

    kw1 = _clean_keyword(target_keywords[0])
    kw2 = _clean_keyword(target_keywords[1]) if len(target_keywords) > 1 else ""

    if kw2:
        kw_sentence = (
            f"저희 {business_name}은 {kw1}과 {kw2} 서비스를 함께 운영하고 있어 "
            f"다양한 상황에서 편리하게 방문하실 수 있습니다."
        )
    else:
        kw_sentence = f"저희 {business_name}은 {kw1} 서비스를 운영하고 있으니 다음에도 편하게 방문해 주세요."

    category_ko = _to_ko_category(category)
    return (
        f"소중한 리뷰 남겨주셔서 정말 감사합니다! "
        f"{kw_sentence} "
        f"앞으로도 더 좋은 {category_ko} 서비스로 보답하겠습니다. "
        f"다음 방문도 기다리고 있겠습니다."
    )


def _make_faq_pair(question: str, business_name: str, target_keyword: str) -> str:
    """
    단일 Q&A 쌍 생성.
    target_keyword를 답변에 자연스럽게 1회 포함.
    """
    kw_clean = _clean_keyword(target_keyword) if target_keyword else ""

    if kw_clean:
        answer = (
            f"네, {business_name}의 {kw_clean}에 대해 안내해 드립니다. "
            f"자세한 내용은 카카오톡 채널 또는 전화로 문의해 주시면 빠르게 안내해 드리겠습니다."
        )
    else:
        answer = (
            f"네, {business_name}에서 안내해 드립니다. "
            f"카카오톡 채널 또는 전화로 문의해 주시면 자세히 안내해 드리겠습니다."
        )

    return f"Q: {question}\nA: {answer}"


def _make_faq_content(
    target_keywords: list[str],
    business_name: str,
    category: str,
    region: str,
) -> str:
    """
    업종별 자연스러운 FAQ Q&A 3쌍 생성 (스마트플레이스 Q&A 탭 직접 등록용).

    - 업종별로 실제 고객이 물어보는 말투의 질문 사용
    - 각 답변에 target_keyword를 1회 자연스럽게 포함
    - 네이버 AI 브리핑은 FAQ 답변을 가장 직접적으로 인용
    """
    faq_key = _normalize_to_faq_key(category)
    questions = _FAQ_QUESTIONS.get(faq_key, _FAQ_QUESTIONS["_default"])

    # 질문 3개 선택 (목록 개수가 3 미만이면 있는 만큼만)
    selected_questions = questions[:3]

    # 키워드 3개 준비 (부족하면 반복 사용)
    kws = (target_keywords or []) + ([""] * 3)

    lines = []
    for i, question in enumerate(selected_questions):
        kw = kws[i] if i < len(kws) else ""
        lines.append(_make_faq_pair(question, business_name, kw))

    return "\n\n".join(lines)


def _make_post_content(
    target_keywords: list[str],
    business_name: str,
    category: str,
    region: str,
) -> str:
    """
    목표 키워드를 포함한 스마트플레이스 소식 초안 생성.

    소식은 주 1회 업데이트 시 AI 브리핑 최신성 점수가 유지됩니다.
    200~300자 단문으로, 사장님이 5분 안에 작성·발행 가능한 분량.
    """
    category_ko = _to_ko_category(category)
    region_short = region.split()[0] if region else region

    if not target_keywords:
        return (
            f"{business_name} 소식\n\n"
            f"{region_short} {category_ko}을 찾으시나요? "
            f"{business_name}에서 편안한 시간 보내세요.\n\n"
            f"문의 및 예약: 네이버 예약 또는 전화"
        )

    kw1_clean = _clean_keyword(target_keywords[0])
    kw_phrase = " · ".join(_clean_keyword(kw) for kw in target_keywords[:2])

    return (
        f"{business_name} 안내\n\n"
        f"{region_short}에서 {kw_phrase}을 찾고 계신가요?\n\n"
        f"{business_name}에서는 {kw1_clean} 서비스를 운영하고 있어 "
        f"다양한 상황에서 편리하게 이용하실 수 있습니다.\n\n"
        f"방문 전 네이버 예약 또는 전화로 미리 확인해 주세요.\n\n"
        f"#{region_short}{category_ko} #{kw1_clean.replace(' ', '')}"
    )


_CATEGORY_KO: dict[str, str] = {
    "restaurant": "음식점·카페", "cafe": "카페", "food": "음식점",
    "beauty": "미용실", "hair": "미용실", "salon": "뷰티살롱",
    "clinic": "병원", "hospital": "병원", "medical": "의원",
    "academy": "학원", "education": "교육",
    "legal": "법률사무소", "lawyer": "변호사", "tax": "세무사",
    "shopping": "쇼핑몰", "online": "온라인몰",
    "fitness": "헬스·필라테스", "gym": "헬스장", "pilates": "필라테스",
    "pet": "반려동물", "grooming": "펫미용",
    "photo": "사진관·스튜디오", "studio": "스튜디오",
}


def _to_ko_category(category: str) -> str:
    return _CATEGORY_KO.get(category.lower(), category)


def _make_intro_content(
    target_keywords: list[str],
    business_name: str,
    category: str,
    region: str,
    existing_keywords: list[str],
) -> str:
    """
    목표 키워드를 포함한 스마트플레이스 소개글 개선안 생성.

    소개글은 네이버 AI가 사업장의 핵심 정보를 파악하는 기반 텍스트입니다.
    한 번 잘 써두면 영구적으로 AI 브리핑 키워드 기반이 됩니다.
    """
    clean_target = [_clean_keyword(kw) for kw in target_keywords[:3]]
    clean_existing = [_clean_keyword(kw) for kw in (existing_keywords or [])[:3]]
    all_kws = clean_existing + [kw for kw in clean_target if kw not in clean_existing]
    kw_str = ", ".join(all_kws[:5]) if all_kws else category

    region_short = region.split()[0] if region else region
    category_ko = _to_ko_category(category)

    return (
        f"{region_short} {category_ko} {business_name}입니다.\n\n"
        f"저희 가게는 {kw_str} 등 다양한 상황에 맞춰 편리하게 이용하실 수 있습니다.\n\n"
        f"{region_short}에서 {category_ko}을 찾으신다면 {business_name}을 추천드립니다. "
        f"네이버 예약으로 간편하게 방문 예약하세요."
    )


def build_direct_briefing_paths(
    biz: dict,
    missing_keywords: list[str],
    competitor_only_keywords: list[str],
    existing_keywords: list[str],
) -> list[dict]:
    """
    소상공인이 오늘 당장 실행할 수 있는 AI 브리핑 직접 관리 경로 4개 생성.

    Args:
        biz: 사업장 정보
        missing_keywords: 아직 없는 키워드 (전체)
        competitor_only_keywords: 경쟁사엔 있고 내겐 없는 키워드 (긴급)
        existing_keywords: 이미 보유한 키워드

    Returns:
        경로별 dict 목록 (urgency 순으로 정렬)
    """
    name = biz.get("name", "우리 가게")
    category = biz.get("category", "")
    region = biz.get("region", "")
    naver_place_id = biz.get("naver_place_id", "")

    # 긴급 키워드 우선, 없으면 missing 상위 3개
    urgent = competitor_only_keywords[:3] if competitor_only_keywords else missing_keywords[:3]
    top2 = urgent[:2]

    def smartplace_url(path_key: str) -> str:
        return _SMARTPLACE_URLS.get(path_key, "https://smartplace.naver.com")

    paths = []

    # 경로 B: FAQ — 가장 직접적인 경로 (즉시, 효과 최강)
    paths.append({
        "path_id": "faq",
        "path_name": "스마트플레이스 FAQ 등록",
        "urgency": "do_now",
        "urgency_label": "지금 당장",
        "reason": (
            "FAQ 답변은 네이버 AI 브리핑이 가장 직접적으로 인용하는 텍스트입니다. "
            f"'{top2[0] if top2 else ''}' 관련 질문을 등록하면 "
            "해당 조건 검색에 내 가게가 노출되기 시작합니다."
        ),
        "target_keywords": top2,
        "ready_content": _make_faq_content(top2, name, category, region),
        "action_url": smartplace_url("faq"),
        "action_steps": _ACTION_STEPS["faq"],
        "estimated_time": "5분",
        "impact": "AI 브리핑 직접 인용 — 가장 빠른 효과",
    })

    # 경로 A: 리뷰 답변 (즉시, 효과 높음)
    paths.append({
        "path_id": "review_response",
        "path_name": "미답변 리뷰에 키워드 담아 답변",
        "urgency": "do_now",
        "urgency_label": "지금 당장",
        "reason": (
            "사장님 답변에도 키워드를 포함하면 AI 브리핑 신호가 강화됩니다. "
            "미답변 리뷰가 있을 경우 오늘 답변하면서 목표 키워드를 자연스럽게 포함하세요."
        ),
        "target_keywords": top2,
        "ready_content": _make_review_response_content(top2, name, category),
        "action_url": smartplace_url("review_response"),
        "action_steps": _ACTION_STEPS["review_response"],
        "estimated_time": "3분",
        "impact": "리뷰 답변율 100% → AI 브리핑 가중치 상승",
    })

    # 경로 C: 소식 업데이트 (이번 주)
    paths.append({
        "path_id": "post",
        "path_name": "스마트플레이스 소식 업데이트",
        "urgency": "this_week",
        "urgency_label": "이번 주",
        "reason": (
            "소식을 7일 이상 업데이트하지 않으면 AI 브리핑 최신성 점수가 떨어집니다. "
            "이번 주 소식에 목표 키워드를 포함하면 두 가지를 동시에 해결합니다."
        ),
        "target_keywords": top2,
        "ready_content": _make_post_content(top2, name, category, region),
        "action_url": smartplace_url("post"),
        "action_steps": _ACTION_STEPS["post"],
        "estimated_time": "5분",
        "impact": "최신성 점수 유지 + 키워드 커버리지 확장",
    })

    # 경로 D: 소개글 수정 (이번 달, 한 번만)
    paths.append({
        "path_id": "intro",
        "path_name": "스마트플레이스 소개글 키워드 보강",
        "urgency": "this_month",
        "urgency_label": "이번 달 중",
        "reason": (
            "소개글은 한 번 잘 써두면 영구적으로 AI 브리핑 키워드 기반이 됩니다. "
            "현재 소개글에 목표 키워드가 빠져 있다면 지금이 수정할 때입니다."
        ),
        "target_keywords": missing_keywords[:4],
        "ready_content": _make_intro_content(
            missing_keywords[:3], name, category, region, existing_keywords
        ),
        "action_url": smartplace_url("intro"),
        "action_steps": _ACTION_STEPS["intro"],
        "estimated_time": "10분",
        "impact": "영구 키워드 기반 — 한 번 하면 계속 효과",
    })

    return paths


def build_briefing_summary(
    paths: list[dict],
    coverage_rate: float,
    top_priority_keyword: str | None,
) -> str:
    """
    AI 브리핑 직접 관리 경로 전체 요약 메시지 생성.
    대시보드 상단 안내 문구로 사용.
    """
    do_now_count = sum(1 for p in paths if p.get("urgency") == "do_now")
    coverage_pct = round(coverage_rate * 100)

    if coverage_pct < 20:
        state = "아직 AI 브리핑에 내 가게가 잘 나오지 않습니다"
    elif coverage_pct < 50:
        state = "AI 브리핑에 일부 조건 검색에서 나오고 있습니다"
    else:
        state = "AI 브리핑에 다양한 조건 검색에서 노출되고 있습니다"

    kw_msg = (
        f" '{_clean_keyword(top_priority_keyword)}' 키워드를 먼저 확보하는 것이 가장 급합니다."
        if top_priority_keyword else ""
    )

    return (
        f"{state}.{kw_msg} "
        f"지금 당장 할 수 있는 {do_now_count}가지 방법이 있습니다 — "
        f"고객 없이, 오늘 10분 안에 AI 브리핑 신호를 강화할 수 있습니다."
    )
