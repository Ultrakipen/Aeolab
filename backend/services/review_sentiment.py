"""리뷰 감정 분석 서비스 — Claude Haiku로 ai_citations.excerpt 분류"""
import os
import json
import logging
import re
from typing import Optional

_logger = logging.getLogger("aeolab.review_sentiment")


async def analyze_review_sentiment(
    biz_id: str,
    excerpts: list[str],
    biz_name: str = "",
) -> dict:
    """리뷰 발췌문 목록을 감정 분석 → {positive, neutral, negative, top_positive, top_negative}"""
    if not excerpts:
        return {
            "positive": 0,
            "neutral": 0,
            "negative": 0,
            "top_positive": [],
            "top_negative": [],
            "total": 0,
            "status": "no_data",
        }

    # 최대 30개만 분석 (비용 절약)
    sample = excerpts[:30]
    texts = "\n".join(f"{i+1}. {t[:100]}" for i, t in enumerate(sample))

    prompt = f"""아래 가게 리뷰 발췌문들의 감정을 분석해주세요.

가게명: {biz_name}
리뷰 {len(sample)}건:
{texts}

각 리뷰를 긍정/중립/부정으로 분류하고, 가장 자주 언급되는 긍정/부정 키워드를 추출해주세요.

JSON 형식으로만 응답:
{{
  "positive": 긍정 개수,
  "neutral": 중립 개수,
  "negative": 부정 개수,
  "top_positive": ["키워드1", "키워드2", "키워드3"],
  "top_negative": ["키워드1", "키워드2"]
}}"""

    try:
        import anthropic
        import asyncio as _aio
        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        msg = await _aio.to_thread(
            lambda: client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=500,
                messages=[{"role": "user", "content": prompt}],
            )
        )
        raw = msg.content[0].text.strip()
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if m:
            result = json.loads(m.group())
            result["total"] = len(sample)
            result["status"] = "ok"
            return result
    except Exception as e:
        _logger.warning("review_sentiment error: %s", e)

    return {
        "positive": 0, "neutral": 0, "negative": 0,
        "top_positive": [], "top_negative": [],
        "total": 0, "status": "error",
    }
