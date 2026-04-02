"""
AI 브리핑 직접 관리 경로 엔진 (Direct Briefing Path Engine)
모델 엔진 v2.6

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

    kw1 = target_keywords[0]
    kw2 = target_keywords[1] if len(target_keywords) > 1 else ""

    if kw2:
        kw_sentence = (
            f"저희 {business_name}은 {kw1}이며, {kw2} 환경을 갖추고 있어 "
            f"다양한 상황에서 방문하실 수 있습니다."
        )
    else:
        kw_sentence = f"저희 {business_name}은 {kw1}이오니 다음에도 편하게 방문해 주세요."

    return (
        f"소중한 리뷰 남겨주셔서 정말 감사합니다! "
        f"{kw_sentence} "
        f"앞으로도 더 좋은 {category} 서비스로 보답하겠습니다. "
        f"다음 방문도 기다리고 있겠습니다 😊"
    )


def _make_faq_content(
    target_keywords: list[str],
    business_name: str,
    category: str,
    region: str,
) -> str:
    """
    목표 키워드 기반 FAQ Q&A 쌍 생성 (스마트플레이스 Q&A 탭 직접 등록용).

    네이버 AI 브리핑은 FAQ 답변을 가장 직접적으로 인용합니다.
    '단체 예약 가능한가요?' 답변이 브리핑에 그대로 노출됩니다.
    """
    if not target_keywords:
        return (
            f"Q: {business_name} 이용 방법을 알려주세요.\n"
            f"A: 네이버 예약 또는 전화로 문의해 주시면 안내해 드리겠습니다."
        )

    lines = []
    for kw in target_keywords[:3]:
        # 키워드별 자연스러운 Q&A 생성
        if "주차" in kw:
            lines.append(
                f"Q: {business_name} 주차 가능한가요?\n"
                f"A: 네, 저희는 {kw}하게 운영하고 있습니다. "
                f"{region} {category}을 방문하실 때 주차 걱정 없이 편하게 오실 수 있습니다."
            )
        elif "예약" in kw or "단체" in kw:
            lines.append(
                f"Q: {business_name} 단체 예약 가능한가요?\n"
                f"A: 네, {kw}입니다. "
                f"회식·모임·행사 등 단체 방문 시 미리 연락 주시면 더욱 편리하게 준비하겠습니다."
            )
        elif "반려견" in kw or "동반" in kw:
            lines.append(
                f"Q: 반려견 동반 가능한가요?\n"
                f"A: 네, {kw}입니다. "
                f"반려동물과 함께 편안하게 이용하실 수 있습니다."
            )
        elif "야간" in kw or "심야" in kw:
            lines.append(
                f"Q: 늦게까지 영업하나요?\n"
                f"A: 네, {kw}합니다. "
                f"야간에도 편하게 방문하실 수 있으니 영업시간을 확인하고 오세요."
            )
        else:
            lines.append(
                f"Q: {business_name}의 {kw.rstrip('이며있음')} 서비스가 있나요?\n"
                f"A: 네, 저희는 {kw}입니다. "
                f"{region}에서 {kw}를 찾으신다면 {business_name}을 추천드립니다."
            )

    return "\n\n".join(lines)


def _make_post_content(  # noqa: E302
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
            f"✨ {business_name} 소식\n\n"
            f"{region_short} {category_ko}을 찾으시나요? "
            f"{business_name}에서 편안한 시간 보내세요.\n\n"
            f"📞 문의 및 예약: 네이버 예약 또는 전화"
        )

    kw_phrase = " · ".join(target_keywords[:2])

    return (
        f"✨ {business_name} 안내\n\n"
        f"{region_short}에서 {kw_phrase}을 찾고 계신가요?\n\n"
        f"{business_name}은 {kw_phrase}로 운영하고 있어 "
        f"다양한 상황에서 편리하게 이용하실 수 있습니다.\n\n"
        f"방문 전 네이버 예약 또는 전화로 미리 확인해 주세요.\n\n"
        f"#{region_short}{category_ko} #{target_keywords[0].replace(' ', '')}"
    )


_CATEGORY_KO: dict[str, str] = {
    "restaurant": "음식점·카페", "cafe": "카페", "food": "음식점",
    "beauty": "미용실", "hair": "미용실", "salon": "뷰티살롱",
    "clinic": "병원", "hospital": "병원", "medical": "의원",
    "academy": "학원", "education": "교육",
    "legal": "법률사무소", "lawyer": "변호사", "tax": "세무사",
    "shopping": "쇼핑몰", "online": "온라인몰",
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
    all_kws = (existing_keywords or [])[:3] + target_keywords[:2]
    kw_str = ", ".join(all_kws) if all_kws else category

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

    # URL에 place_id 포함 (있을 경우)
    def smartplace_url(path_key: str) -> str:
        base = _SMARTPLACE_URLS.get(path_key, "https://smartplace.naver.com")
        return base

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

    kw_msg = f" '{top_priority_keyword}' 키워드를 먼저 확보하는 것이 가장 급합니다." if top_priority_keyword else ""

    return (
        f"{state}.{kw_msg} "
        f"지금 당장 할 수 있는 {do_now_count}가지 방법이 있습니다 — "
        f"고객 없이, 오늘 10분 안에 AI 브리핑 신호를 강화할 수 있습니다."
    )
