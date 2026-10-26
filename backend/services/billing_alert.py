"""AI API 결제·크레딧 소진 감지 → 운영자 알림 (2026-10-26).

배경: 2026-10-26 첫 분석 시험에서 Anthropic 크레딧 부족(`Your credit balance is too low`)으로 개선 가이드 생성이
실패했는데, 로그 한 줄만 남고 운영자가 알 방법이 없었다(시험을 돌려서 우연히 발견). 가이드·소개글·FAQ·리뷰 답변·감정 분석이
모두 Claude를 쓰므로 크레딧이 떨어지면 핵심 기능이 한꺼번에 멈춘다. OpenAI도 2026-07-12 결제 미등록으로 전면 실패한 전례가 있다.

호출부(anthropic_retry, chatgpt_scanner._log_failure)가 예외를 그대로 삼키거나 올리는 흐름을 바꾸지 않도록,
감지는 절대 예외를 내지 않고 알림은 별도 태스크로 보낸다. 같은 제공자의 알림은 6시간에 한 번만 보낸다.
"""
import asyncio
import logging
import time

_logger = logging.getLogger("aeolab")

COOLDOWN_SEC = 6 * 3600
_last_sent: dict = {}

_PATTERNS = {
    "anthropic": ("credit balance is too low",),
    "openai": ("insufficient_quota", "exceeded your current quota"),
}
_INFO = {
    "anthropic": (
        "Anthropic(Claude) API 크레딧 부족",
        "Claude 크레딧 잔액이 부족합니다. 개선 가이드·소개글·FAQ·리뷰 답변·감정 분석·창업 리포트 등 Claude를 쓰는 기능이 모두 실패합니다.\n"
        "조치: Anthropic Console → Plans & Billing에서 크레딧을 충전하고, 자동 충전을 설정해 두세요.",
    ),
    "openai": (
        "OpenAI API 결제·한도 문제",
        "OpenAI 결제 수단 미등록 또는 한도 초과입니다. ChatGPT 노출 측정(체험·정기 스캔)이 실패합니다.\n"
        "조치: OpenAI 대시보드 → Billing에서 결제 수단·한도를 확인하세요.",
    ),
}


def is_billing_error(provider: str, err: BaseException) -> bool:
    msg = str(err).lower()
    return any(p in msg for p in _PATTERNS.get(provider, ()))


async def _send(provider: str) -> None:
    try:
        from services.email_sender import send_operator_alert
        subject, message = _INFO[provider]
        await send_operator_alert(subject, message)
    except Exception as e:  # 알림 실패가 본래 기능에 영향을 주지 않게
        _logger.warning("[billing_alert] %s 알림 발송 실패: %s", provider, e)


def note_billing_error(provider: str, err: BaseException) -> bool:
    """결제·크레딧 소진 오류면 운영자 알림 태스크를 예약한다(6시간에 1회). 예약했으면 True.
    어떤 경우에도 예외를 내지 않는다."""
    try:
        if provider not in _INFO or not is_billing_error(provider, err):
            return False
        now = time.time()
        if now - _last_sent.get(provider, 0.0) < COOLDOWN_SEC:
            return False
        _last_sent[provider] = now
        asyncio.get_running_loop().create_task(_send(provider))
        _logger.error("[billing_alert] %s 결제·크레딧 오류 감지 — 운영자 알림 예약", provider)
        return True
    except Exception:
        return False
