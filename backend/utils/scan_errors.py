"""스캔 엔드포인트 표준 에러 응답 헬퍼.

사용자 친화 메시지 + 에러 코드를 HTTPException으로 일관 반환한다.
새 에러 코드 추가 시 이 파일에만 추가하면 된다.
"""
import logging
from fastapi import HTTPException

_logger = logging.getLogger("aeolab")

# 에러 코드 → (HTTP 상태코드, 기본 메시지) 매핑
_SCAN_ERROR_CATALOG: dict[str, tuple[int, str]] = {
    "RATE_LIMIT_EXCEEDED": (
        429,
        "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    ),
    "PLAN_LIMIT_EXCEEDED": (
        402,
        "플랜 사용 한도에 도달했습니다. 상위 플랜으로 업그레이드하거나 다음 달을 기다려 주세요.",
    ),
    "BUSINESS_NOT_FOUND": (
        404,
        "사업장을 찾을 수 없거나 접근 권한이 없습니다.",
    ),
    "AI_SERVICE_UNAVAILABLE": (
        503,
        "AI 서비스 일시 응답 지연입니다. 잠시 후 다시 시도해 주세요.",
    ),
    "PLAYWRIGHT_TIMEOUT": (
        504,
        "네이버·Google 페이지 로딩 시간이 초과됐습니다. 잠시 후 다시 시도해 주세요.",
    ),
    "SCAN_IN_PROGRESS": (
        409,
        "이미 스캔이 진행 중입니다. 완료 후 다시 시도해 주세요.",
    ),
    "INTERNAL_ERROR": (
        500,
        "일시적인 오류가 발생했습니다. 문제가 지속되면 고객센터로 문의해 주세요.",
    ),
}

_SUPPORT_EMAIL = "contact@aeolab.co.kr"


def make_scan_error(
    code: str,
    *,
    message: str | None = None,
    detail: str | None = None,
    biz_id: str | None = None,
    endpoint: str | None = None,
    original_exc: BaseException | None = None,
) -> HTTPException:
    """표준 스캔 에러 HTTPException 생성.

    Args:
        code: 에러 코드 (_SCAN_ERROR_CATALOG 키, 없으면 INTERNAL_ERROR 폴백)
        message: 재정의 메시지 (None이면 카탈로그 기본 메시지)
        detail: 내부 디버그용 추가 설명 (응답에는 포함되지 않음, 로그에만)
        biz_id: 로그에 포함할 사업장 ID
        endpoint: 로그에 포함할 엔드포인트 이름
        original_exc: 로그에 포함할 원본 예외

    Returns:
        HTTPException (raise하면 FastAPI가 처리)
    """
    catalog_code = code if code in _SCAN_ERROR_CATALOG else "INTERNAL_ERROR"
    status_code, default_message = _SCAN_ERROR_CATALOG[catalog_code]
    user_message = message or default_message

    # 구조화 로그 — 디버깅 가능한 정보 기록
    _log_level = _logger.error if status_code >= 500 else _logger.warning
    _log_level(
        "[scan error] endpoint=%s biz_id=%s code=%s status=%s detail=%s exc=%s",
        endpoint or "unknown",
        biz_id or "-",
        catalog_code,
        status_code,
        detail or "-",
        repr(original_exc) if original_exc else "-",
    )

    body: dict = {
        "code": catalog_code,
        "message": user_message,
        "support": _SUPPORT_EMAIL,
    }
    return HTTPException(status_code=status_code, detail=body)


def classify_exception(exc: BaseException) -> str:
    """예외 타입으로 에러 코드 자동 분류.

    호출자에서 except 블록의 분기를 줄이기 위한 헬퍼.
    """
    exc_type = type(exc).__name__
    exc_str = str(exc).lower()

    if "playwright" in exc_type.lower() or "timeout" in exc_str:
        return "PLAYWRIGHT_TIMEOUT"
    if "ratelimit" in exc_type.lower() or "rate limit" in exc_str or "429" in exc_str:
        return "RATE_LIMIT_EXCEEDED"
    if "gemini" in exc_str or "chatgpt" in exc_str or "openai" in exc_str or "anthropic" in exc_str:
        return "AI_SERVICE_UNAVAILABLE"
    if "not found" in exc_str or "404" in exc_str:
        return "BUSINESS_NOT_FOUND"
    return "INTERNAL_ERROR"
