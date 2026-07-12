"""AI API 실사용 토큰·비용 텔레메트리 — 사업성 점검(2026-07-12)에서 신설.

2026-07-12 발견: Gemini/ChatGPT/Claude 어떤 호출 경로에도 토큰 사용량 로깅이
전혀 없어 CLAUDE.md의 마진율 수치가 코드 출시 이후 단 한 번도 실측 검증된 적
없는 구조였음. 특히 Gemini 2.5 Flash는 설치된 SDK(google-generativeai==0.8.3)의
protobuf GenerationConfig에 thinking_config 필드 자체가 없어 thinking 토큰을
코드로 끌 수 없고 사용량도 몰랐음 — 이 모듈이 최소 그 사용량만이라도 기록한다.

fire-and-forget 원칙: 로깅 실패가 스캔을 절대 막으면 안 됨 — 모든 예외 흡수.
"""
import asyncio
import logging

from db.supabase_client import get_client

_logger = logging.getLogger("aeolab")

# USD→KRW 근사 환율 — 실시간 API 아님, 분기별 재확인 권장 (2026-07-12 기준 ~1,400원)
USD_KRW = 1400

# $/1M 토큰 단가 — CLAUDE.md "API 비용 관리" 표 2026-06-25 공식 확인 값과 동일 소스 유지
_PRICES_PER_1M_USD = {
    ("gemini", "gemini-2.5-flash"):     {"in": 0.30, "out": 2.50},  # out에 thinking 토큰 포함(Standard tier)
    ("chatgpt", "gpt-4.1-mini"):        {"in": 0.40, "out": 1.60},
    ("claude", "claude-sonnet-4-6"):    {"in": 3.00, "out": 15.00},
    ("claude", "claude-haiku-4-5-20251001"): {"in": 1.00, "out": 5.00},
}


def _estimate_cost_krw(provider: str, model: str, tokens_in: int, tokens_out: int) -> float | None:
    price = _PRICES_PER_1M_USD.get((provider, model))
    if not price:
        return None
    usd = (tokens_in / 1_000_000) * price["in"] + (tokens_out / 1_000_000) * price["out"]
    return round(usd * USD_KRW, 4)


def log_ai_usage(
    provider: str,
    model: str,
    purpose: str,
    tokens_in: int,
    tokens_out: int,
    thinking_tokens: int | None = None,
) -> None:
    """AI 호출 직후 실제 토큰 사용량을 비동기 fire-and-forget으로 기록.

    호출부 예: log_ai_usage("gemini", "gemini-2.5-flash", "scan_check", 120, 40)
    thinking_tokens는 현재 Gemini에서 항상 None — Developer API는 candidates_token_count에
    thinking을 이미 포함해 반환하므로(Vertex AI와 다름) tokens_out만으로 비용은 정확히 계산되고,
    thinking만 따로 분리할 방법이 SDK 레벨에 없음(gemini_scanner.py:_log_usage 주석 참조).
    실패해도 스캔 흐름에 영향 없음 — asyncio.create_task + 내부 예외 흡수.
    """
    try:
        asyncio.create_task(_insert(provider, model, purpose, tokens_in, tokens_out, thinking_tokens))
    except RuntimeError as e:
        # 실행 중인 이벤트 루프가 없는 동기 컨텍스트(예: 스크립트) — 스캔엔 무해하나 추적용 로그는 남김
        _logger.debug("log_ai_usage: 이벤트 루프 없는 컨텍스트라 스킵 (%s)", e)


async def _insert(
    provider: str,
    model: str,
    purpose: str,
    tokens_in: int,
    tokens_out: int,
    thinking_tokens: int | None,
) -> None:
    try:
        out_billed = tokens_out + (thinking_tokens or 0)
        cost_krw = _estimate_cost_krw(provider, model, tokens_in, out_billed)
        row = {
            "provider": provider,
            "model": model,
            "purpose": purpose,
            "tokens_in": tokens_in,
            "tokens_out": tokens_out,
            "thinking_tokens": thinking_tokens,
            "estimated_cost_krw": cost_krw,
        }
        await asyncio.wait_for(
            asyncio.to_thread(lambda: get_client().table("ai_usage_log").insert(row).execute()),
            timeout=5.0,
        )
    except Exception as e:
        # 테이블 미생성(SQL 미실행) 등으로 매 스캔마다 실패해도 스캔 흐름엔 영향 없음 —
        # 다만 debug는 운영 로그에서 안 보여 원인 파악이 늦어지므로 warning으로 상향
        _logger.warning("ai_usage_log insert 실패(스캔은 정상 진행): %s", e)
