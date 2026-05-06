"""
공개 API: AI 브리핑 업종 분류 단일 소스 (인증 불필요 — # public: 프론트 단일 소스 동기화용)
score_engine.BRIEFING_*_CATEGORIES를 직접 참조하여 프론트엔드와 항상 일치 보장.
"""
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from utils import cache as _cache

_logger = logging.getLogger("aeolab")
router = APIRouter()

_TTL_BRIEFING_CATS = 1800  # 30분 캐시
_CACHE_KEY = "public:briefing_categories"

# IP당 분당 30회 rate limit (인메모리 카운터, scan.py 패턴 통일)
_rate_counts: dict[str, int] = {}
_RATE_LIMIT = 30
_RATE_WINDOW = 60  # seconds


def _check_rate_limit(ip: str) -> None:
    """IP 기반 분당 30회 제한 — 초과 시 429"""
    key = f"briefing_cats:{ip}"
    count: int = _cache.get(key) or 0
    if count >= _RATE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "RATE_LIMIT",
                "message": "잠시 후 다시 시도해 주세요 (분당 30회 제한).",
                "retry_after": _RATE_WINDOW,
            },
        )
    if count == 0:
        _cache.set(key, 1, _RATE_WINDOW)
    else:
        _cache.set(key, count + 1, _RATE_WINDOW)


@router.get("/briefing-categories")
async def get_briefing_categories(request: Request):
    """업종별 AI 브리핑 노출 분류 단일 소스 (캐시 30분, 인증 불필요 — public).

    score_engine.BRIEFING_*_CATEGORIES를 직접 참조하여 반환하므로
    백엔드와 프론트엔드의 업종 분류가 항상 일치한다.
    프론트엔드에서는 이 엔드포인트를 단일 소스로 사용하고
    하드코딩된 BRIEFING_ACTIVE 상수 대신 이 응답을 캐시하여 사용 권장.

    Rate limit: IP 분당 30회
    """
    # Rate limit (인메모리 카운터)
    client_ip = (request.client.host if request.client else "unknown")
    _check_rate_limit(client_ip)

    cached = _cache.get(_CACHE_KEY)
    if cached is not None:
        return cached

    try:
        from services.score_engine import (
            BRIEFING_ACTIVE_CATEGORIES,
            BRIEFING_LIKELY_CATEGORIES,
            BRIEFING_INACTIVE_CATEGORIES,
        )
    except Exception as e:
        _logger.warning(f"[briefing_categories] score_engine import 실패: {e}")
        raise HTTPException(status_code=500, detail="서비스 초기화 오류")

    result = {
        "active":   sorted(BRIEFING_ACTIVE_CATEGORIES),
        "likely":   sorted(BRIEFING_LIKELY_CATEGORIES),
        "inactive": sorted(BRIEFING_INACTIVE_CATEGORIES),
        "version":  "v3.1",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "note": (
            "active = 현재 네이버 AI 브리핑 대상 업종 (프랜차이즈 제외). "
            "likely = 확대 예상 업종. "
            "inactive = 비대상 업종 (글로벌 AI 채널로 노출 가능). "
            "출처: 네이버 공식 help.naver.com/service/30026/contents/24632"
        ),
    }

    _cache.set(_CACHE_KEY, result, _TTL_BRIEFING_CATS)
    return result
