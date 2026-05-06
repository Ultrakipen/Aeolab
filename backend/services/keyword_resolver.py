"""
사용자 맞춤 키워드 해석 — Taxonomy ∪ custom − excluded

전 시스템이 이 단일 진입점을 통해 "effective keywords"를 얻도록 강제한다.
이 파일만 수정하면 키워드 관련 로직 전체가 영향을 받는다.

DB 전제:
- businesses.custom_keywords TEXT[] (사용자가 직접 추가한 키워드)
- businesses.excluded_keywords TEXT[] (사용자가 제외한 키워드)
두 컬럼 중 하나라도 없으면 graceful fallback(빈 배열)으로 동작한다.
"""

from typing import Optional
import logging

from services.keyword_taxonomy import get_all_keywords_flat, normalize_category  # noqa: F401
from db.supabase_client import get_client, execute

_logger = logging.getLogger("aeolab")

# 사용자 커스텀 키워드 상한 및 길이 제약
MAX_CUSTOM_KEYWORDS = 10
MAX_KEYWORD_LENGTH = 20


def _is_missing_column_error(err: Exception) -> bool:
    """Supabase PostgREST 'column does not exist' 패턴 감지"""
    s = str(err)
    return (
        "custom_keywords" in s
        or "excluded_keywords" in s
        or "42703" in s
        or ("column" in s.lower() and "does not exist" in s.lower())
    )


async def get_user_keyword_prefs(business_id: str, supabase=None) -> dict:
    """businesses에서 custom_keywords + excluded_keywords 조회.

    컬럼이 아직 없으면(`42703`/`column does not exist`) 빈 배열로 graceful fallback.
    """
    if not business_id:
        return {"custom": [], "excluded": []}
    if supabase is None:
        supabase = get_client()
    try:
        resp = await execute(
            supabase.table("businesses")
            .select("custom_keywords, excluded_keywords")
            .eq("id", business_id)
            .single()
        )
        row = resp.data if resp is not None else None
        if not row:
            return {"custom": [], "excluded": []}
        custom = row.get("custom_keywords") or []
        excluded = row.get("excluded_keywords") or []
        # DB가 list 이외의 타입을 반환해도 안전하게 처리
        if not isinstance(custom, list):
            custom = []
        if not isinstance(excluded, list):
            excluded = []
        return {"custom": custom, "excluded": excluded}
    except Exception as e:
        if _is_missing_column_error(e):
            return {"custom": [], "excluded": []}
        _logger.warning(f"get_user_keyword_prefs failed (biz={business_id}): {e}")
        return {"custom": [], "excluded": []}


async def resolve_effective_keywords(
    business_id: Optional[str],
    category: str,
    supabase=None,
) -> dict:
    """
    Effective = (Taxonomy ∪ custom) − excluded

    Args:
        business_id: 사업장 ID. None이면 taxonomy만 반환.
        category: 업종 (keyword_taxonomy 정규화 대상)

    Returns:
        {
            "taxonomy": [...],   # 업종 기본 키워드
            "custom":   [...],   # 사용자 추가 키워드
            "excluded": [...],   # 사용자 제외 키워드
            "effective":[...],   # 실제 시스템이 사용할 키워드 (taxonomy ∪ custom - excluded)
        }
    """
    taxonomy = get_all_keywords_flat(category) or []
    if not business_id:
        return {
            "taxonomy": taxonomy,
            "custom": [],
            "excluded": [],
            "effective": list(taxonomy),
        }

    prefs = await get_user_keyword_prefs(business_id, supabase)
    custom = [k.strip() for k in prefs["custom"] if isinstance(k, str) and k.strip()]
    excluded_set = {k.strip() for k in prefs["excluded"] if isinstance(k, str) and k.strip()}

    # taxonomy + custom 순서 유지 dedupe
    merged = list(dict.fromkeys([*taxonomy, *custom]))
    effective = [k for k in merged if k not in excluded_set]

    return {
        "taxonomy": taxonomy,
        "custom": custom,
        "excluded": list(excluded_set),
        "effective": effective,
    }


def validate_keyword(kw: str) -> tuple[bool, str]:
    """커스텀 키워드 추가 전 검증.

    Returns:
        (ok, error_msg) — ok=False면 error_msg를 사용자에게 표시.
    """
    if not isinstance(kw, str) or not kw.strip():
        return False, "키워드가 비어 있습니다"
    kw = kw.strip()
    if len(kw) < 2:
        return False, "키워드는 2자 이상이어야 합니다"
    if len(kw) > MAX_KEYWORD_LENGTH:
        return False, f"키워드는 {MAX_KEYWORD_LENGTH}자 이내여야 합니다"
    return True, ""
