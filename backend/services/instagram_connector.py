"""
Instagram AI 인용 신호 분석기

Instagram Graph API 심사 대기 중 → 사용자 직접 입력 기반으로 AI 인용 가능성 점수 계산
향후 Meta App Review 승인 후 OAuth 방식으로 업그레이드 예정
"""
import logging
from typing import Optional

logger = logging.getLogger("aeolab")


def _get_category_keywords(category: str) -> list[str]:
    """업종별 키워드 목록 반환 (keyword_taxonomy.py 활용)"""
    try:
        from services.keyword_taxonomy import KEYWORD_TAXONOMY, normalize_category
        normalized = normalize_category(category)
        taxonomy = KEYWORD_TAXONOMY.get(normalized, {})
        keywords: list[str] = []
        for cat_data in taxonomy.values():
            if isinstance(cat_data, dict):
                keywords.extend(cat_data.get("keywords", []))
        return keywords
    except Exception as e:
        logger.warning(f"keyword_taxonomy 로드 실패 (category={category}): {e}")
        return []


def _calc_keyword_coverage(captions: list[str], keywords: list[str]) -> float:
    """
    캡션 텍스트에서 업종 키워드 커버리지 계산 (0.0~1.0)

    - 전체 카테고리 키워드 중 캡션에 등장한 고유 키워드 비율
    - 키워드 없는 업종은 0.5 기본값 반환 (왜곡 방지)
    """
    if not keywords:
        return 0.5

    combined_text = " ".join(captions).lower()
    matched = sum(1 for kw in keywords if kw.lower() in combined_text)
    return round(matched / len(keywords), 4)


def _build_tips(
    follower_score: float,
    activity_score: float,
    keyword_score: float,
    follower_count: int,
    post_count_30d: int,
    top_missing_keywords: list[str],
) -> list[str]:
    """
    점수 기반 1~3가지 개선 조언 생성 (한국어, 소상공인 눈높이)
    """
    tips: list[str] = []

    if activity_score < 0.15:  # 월 4회 미만
        tips.append("주 2회 이상 게시하면 AI 인용 가능성이 높아집니다. 음식 사진, 매장 분위기 등 일상 콘텐츠도 충분합니다.")

    if keyword_score < 0.1:
        if top_missing_keywords:
            kw_example = ", ".join(top_missing_keywords[:2])
            tips.append(
                f"업종 키워드(예: {kw_example})를 캡션에 자연스럽게 포함하세요. "
                "AI는 키워드가 풍부한 계정을 신뢰할 수 있는 정보 출처로 인식합니다."
            )
        else:
            tips.append("캡션에 업종 관련 키워드(메뉴명, 서비스명, 특장점 등)를 자연스럽게 포함하세요.")

    if follower_score < 0.1 and follower_count < 500:
        tips.append(
            "팔로워가 늘수록 AI 인용 신뢰도가 높아집니다. "
            "단골 고객에게 인스타그램 팔로우를 요청하거나 QR 코드를 매장에 부착해보세요."
        )

    if not tips:
        tips.append(
            "현재 인스타그램 운영 수준이 양호합니다. "
            "꾸준히 게시하고 해시태그에 업종 키워드를 포함하면 AI 인용 가능성이 더욱 높아집니다."
        )

    return tips[:3]


async def analyze_instagram_signal(
    username: str,
    follower_count: int = 0,
    post_count_30d: int = 0,
    recent_captions: list[str] | None = None,
    category: str = "",
) -> dict:
    """
    인스타그램 AI 인용 가능성 점수 계산 (0.0~1.0)

    점수 구성:
    - 팔로워 점수 (40%): min(1.0, follower_count / 10_000) * 0.4
    - 활동 점수   (30%): min(1.0, post_count_30d / 8) * 0.3
    - 키워드 점수 (30%): keyword_coverage * 0.3

    Args:
        username:        인스타그램 계정명 (@제외)
        follower_count:  팔로워 수 (사용자 직접 입력)
        post_count_30d:  최근 30일 게시물 수 (사용자 직접 입력)
        recent_captions: 최근 게시물 캡션 텍스트 목록 (선택)
        category:        사업장 업종 코드 (keyword_taxonomy 매핑용)

    Returns:
        {
          "username": str,
          "follower_count": int,
          "post_count_30d": int,
          "ai_citation_signal": float,  # 0.0~1.0
          "follower_score": float,
          "activity_score": float,
          "keyword_score": float,
          "keyword_coverage": float,
          "top_missing_keywords": list[str],
          "tips": list[str],
        }
    """
    if recent_captions is None:
        recent_captions = []

    # 업종 키워드 목록 조회
    keywords = _get_category_keywords(category)

    # 키워드 커버리지 계산
    keyword_coverage = _calc_keyword_coverage(recent_captions, keywords)

    # 각 세부 점수 계산
    follower_score = min(1.0, follower_count / 10_000) * 0.4
    activity_score = min(1.0, post_count_30d / 8) * 0.3
    keyword_score  = keyword_coverage * 0.3

    ai_citation_signal = round(follower_score + activity_score + keyword_score, 4)

    # 부족 키워드 추출 (캡션에 없는 키워드 중 앞 5개)
    combined_text = " ".join(recent_captions).lower()
    top_missing_keywords = [
        kw for kw in keywords if kw.lower() not in combined_text
    ][:5]

    # 개선 조언 생성
    tips = _build_tips(
        follower_score=follower_score,
        activity_score=activity_score,
        keyword_score=keyword_score,
        follower_count=follower_count,
        post_count_30d=post_count_30d,
        top_missing_keywords=top_missing_keywords,
    )

    logger.info(
        f"[instagram_signal] username={username} "
        f"signal={ai_citation_signal:.3f} "
        f"follower={follower_count} posts30d={post_count_30d} "
        f"kw_coverage={keyword_coverage:.3f}"
    )

    return {
        "username": username,
        "follower_count": follower_count,
        "post_count_30d": post_count_30d,
        "ai_citation_signal": ai_citation_signal,
        "follower_score": round(follower_score, 4),
        "activity_score": round(activity_score, 4),
        "keyword_score":  round(keyword_score, 4),
        "keyword_coverage": keyword_coverage,
        "top_missing_keywords": top_missing_keywords,
        "tips": tips,
    }
