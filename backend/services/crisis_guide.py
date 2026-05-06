"""부정 리뷰 위기관리 가이드 (Claude Haiku)

소상공인이 별점 1~3점 리뷰를 받았을 때:
- AI 검색 신뢰도 손상을 최소화하는 공개 답변 초안
- 네이버 AI 브리핑에서 부정 리뷰 영향을 줄이는 구체적 팁
- 절대 하지 말아야 할 행동
- 오프라인 해결 단계
"""
import json
import os
import logging

_logger = logging.getLogger("aeolab")


async def generate_crisis_reply(
    review_text: str,
    business_name: str,
    category: str,
    rating: int,  # 1~3점
) -> dict:
    """부정 리뷰 대응 전략 생성 (Claude Haiku)

    반환:
        {
            "public_reply": str,          # 공개 답변 초안 (150자 이내)
            "ai_impact_tips": list[str],  # AI 검색 부정 영향 최소화 팁 3가지
            "do_not": list[str],          # 하지 말아야 할 것 2가지
            "resolution_steps": list[str] # 오프라인 해결 단계 3가지
        }
    """
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        _logger.warning("crisis_guide: ANTHROPIC_API_KEY 미설정 — fallback 반환")
        return _fallback_response(business_name, rating)

    import anthropic

    client = anthropic.AsyncAnthropic(api_key=api_key)

    prompt = f"""당신은 한국 소상공인의 리뷰 위기관리 전문가입니다.

사업장: {business_name} (업종: {category})
리뷰 평점: {rating}점 / 5점
리뷰 내용: {review_text[:400]}

다음 형식으로 JSON만 응답해주세요 (다른 텍스트 없이):
{{
  "public_reply": "고객에게 보낼 공개 답변 초안 (150자 이내, 진심 어린 사과와 개선 약속 포함, 혜택·쿠폰 제공 문구 절대 금지, 네이버 정책 준수)",
  "ai_impact_tips": [
    "팁1 — 네이버 AI 브리핑/AI 검색 관련 구체적 행동",
    "팁2",
    "팁3"
  ],
  "do_not": [
    "하지 말아야 할 행동1 (예: 리뷰 삭제 요청)",
    "하지 말아야 할 행동2"
  ],
  "resolution_steps": [
    "단계1 — 지금 당장 할 수 있는 것",
    "단계2",
    "단계3"
  ]
}}

규칙:
- public_reply는 반드시 한국어, 공손한 어투, 150자 이내
- ai_impact_tips는 "네이버 AI 브리핑은 답변 진정성을 감지합니다" 등 AI 검색 최적화 구체적 팁
- do_not에는 "삭제 요청", "감정적 반박", "허위 사실 주장" 등 역효과 행동
- resolution_steps는 실제로 할 수 있는 오프라인/온라인 조치"""

    try:
        resp = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=900,
            messages=[{"role": "user", "content": prompt}],
        )
        text = resp.content[0].text.strip()
        # JSON 블록 추출
        start = text.find("{")
        end = text.rfind("}") + 1
        if start == -1 or end == 0:
            _logger.warning("crisis_guide: JSON 파싱 실패 — fallback 반환")
            return _fallback_response(business_name, rating)
        return json.loads(text[start:end])
    except json.JSONDecodeError as e:
        _logger.warning("crisis_guide: JSON decode error: %s", e)
        return _fallback_response(business_name, rating)
    except Exception as e:
        _logger.warning("crisis_guide: Claude Haiku 호출 실패: %s", e)
        return _fallback_response(business_name, rating)


def _fallback_response(business_name: str, rating: int) -> dict:
    """API 호출 실패 또는 파싱 오류 시 기본 응답"""
    apology = (
        "안녕하세요, 소중한 의견 남겨주셔서 감사합니다. "
        "불편한 경험을 드려 진심으로 사과드립니다. "
        "말씀 주신 부분을 꼼꼼히 살펴 개선하겠습니다. "
        "다시 한번 방문해 주시면 더 나은 모습으로 맞이하겠습니다."
    )
    return {
        "public_reply": apology,
        "ai_impact_tips": [
            "답변을 빠르게 달수록 네이버 AI 브리핑 신뢰도 점수에 유리합니다",
            "진정성 있는 답변은 AI가 긍정 신호로 분류해 브리핑 인용 가능성을 높입니다",
            "이후 긍정 리뷰가 쌓이면 AI 검색에서 부정 리뷰 영향이 희석됩니다",
        ],
        "do_not": [
            "리뷰 삭제 요청 — 플랫폼 정책 위반이며 오히려 신뢰 손상",
            "감정적 반박 — 공개 논쟁은 브랜드 이미지에 치명적",
        ],
        "resolution_steps": [
            "고객에게 직접 연락해 해결 의사를 먼저 전달",
            "리뷰에서 언급된 문제를 실제로 파악하고 개선",
            "개선 내용을 공개 답변에 업데이트하여 다른 잠재 고객에게도 신뢰 제공",
        ],
    }
