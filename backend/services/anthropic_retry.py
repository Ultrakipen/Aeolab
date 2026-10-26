"""Claude(Anthropic) messages.create 429 재시도 공통 헬퍼.

여러 서비스 파일(guide_generator·startup_report·ad_defense_guide·keyword_suggester·
review_sentiment·crisis_guide·scheduler/jobs)이 각자 AsyncAnthropic 클라이언트를
독립 생성해 호출하는 구조라, 재시도 로직만 이 모듈로 공유한다.
Gemini/ChatGPT 스캐너와 동일 패턴(429 한정 1회 재시도, 1.5s 대기, 2026-07-15).
"""
import asyncio
import logging

_logger = logging.getLogger("aeolab")


async def create_message_with_retry(client, **kwargs):
    """429(rate limit) 한정 1회 재시도. client는 호출부에서 이미 구성된 AsyncAnthropic 인스턴스."""
    from services.billing_alert import note_billing_error  # 크레딧 소진 시 운영자 알림(6시간에 1회) — 호출 흐름은 바꾸지 않음
    try:
        return await client.messages.create(**kwargs)
    except Exception as e:
        is_rate_limit = (
            type(e).__name__ == "RateLimitError"
            or "429" in str(e)
            or "rate limit" in str(e).lower()
        )
        if not is_rate_limit:
            note_billing_error("anthropic", e)
            raise
        _logger.warning("Claude rate-limited(429), retrying in 1.5s: model=%s", kwargs.get("model"))
        await asyncio.sleep(1.5)
        try:
            return await client.messages.create(**kwargs)
        except Exception as e2:
            note_billing_error("anthropic", e2)
            raise
