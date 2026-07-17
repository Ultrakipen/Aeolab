"""블로그 포스트 품질 판정 서비스 — Claude Haiku로 진솔한 경험담 vs 홍보성 템플릿 판별.

2026-07-17 신설(§2-C): 기존 _analyze_single_post()의 문자열 휴리스틱(글자수·키워드매칭·
의도어 포함 여부)은 "추천"이라는 단어만 있으면 통과라 실제 경험담 여부·전문성 신호
(E-E-A-T)를 판단하지 못함. 비용 통제를 위해 posts_detail 중 최대 5개만, 단일 API
호출로 일괄 판정한다(포스트별 개별 호출 금지 — N배 비용 증가 방지).
호출 1회당 비용은 수 원 수준(Haiku 단가 $1/$5 per 1M 토큰, 입력 ~1천 토큰 내외)이라
BEP 미달 상태에서도 부담 없는 규모로 판단해 §2-C 보류 사유(비용)와 별개로 적용.
"""
import os
import json
import logging
import re

from services.ai_usage_logger import log_ai_usage

_logger = logging.getLogger("aeolab.blog_quality_scorer")

_client = None


def _get_client():
    global _client
    if _client is None:
        import anthropic
        _client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    return _client


_MAX_POSTS_SCORED = 5


async def score_posts_quality(posts: list[dict]) -> dict[int, dict]:
    """posts: [{"title": str, "text": str}, ...] — 앞에서부터 최대 5개만 판정.

    반환: {원본 인덱스: {"genuine": bool, "reason": str}} — 실패·데이터 부족 시 빈 dict
    (호출부는 이 결과 없이도 기존 분석이 정상 동작하도록 설계돼 있음, 부가 기능 원칙).
    """
    sample = [(i, p) for i, p in enumerate(posts[:_MAX_POSTS_SCORED]) if (p.get("title") or p.get("text"))]
    if not sample:
        return {}

    numbered = "\n\n".join(
        f"{n+1}. 제목: {p.get('title', '')}\n내용: {(p.get('text', '') or '')[:200]}"
        for n, (_, p) in enumerate(sample)
    )

    prompt = f"""아래 블로그 포스트들이 실제 방문·경험을 담은 진솔한 글인지, 홍보 문구 위주의 상투적인 글인지 판정해주세요.

{numbered}

각 글에 대해 JSON 배열로만 응답 (다른 텍스트 없이):
[{{"idx": 1, "genuine": true/false, "reason": "1줄 근거(한국어, 25자 이내)"}}, ...]

- genuine=true: 구체적 경험(가격·위치·느낀점 등)이 드러남
- genuine=false: "완료했습니다", "감사합니다" 같은 홍보성 상투 문구 위주, 구체성 없음
- 정보가 부족해 판단이 어려우면 genuine=true로 (불확실할 때 불이익 주지 않음)"""

    try:
        from services.anthropic_retry import create_message_with_retry
        msg = await create_message_with_retry(
            _get_client(),
            model="claude-haiku-4-5-20251001",
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        )
        try:
            log_ai_usage(
                "claude", "claude-haiku-4-5-20251001", "blog_quality",
                msg.usage.input_tokens, msg.usage.output_tokens,
            )
        except Exception as _le:
            _logger.debug("blog_quality usage 로깅 실패(무시): %s", _le)

        raw = msg.content[0].text.strip()
        m = re.search(r"\[.*\]", raw, re.DOTALL)
        if not m:
            return {}
        parsed = json.loads(m.group())

        result: dict[int, dict] = {}
        for entry in parsed:
            n = entry.get("idx")
            if not isinstance(n, int) or not (1 <= n <= len(sample)):
                continue
            original_idx = sample[n - 1][0]
            result[original_idx] = {
                "genuine": bool(entry.get("genuine", True)),
                "reason": str(entry.get("reason", ""))[:40],
            }
        return result
    except Exception as e:
        _logger.warning("blog quality scoring failed: %s", e)
        return {}
