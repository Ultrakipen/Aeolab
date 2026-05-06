"""사용자 맞춤 키워드 CRUD

GET    /api/businesses/{biz_id}/keywords
POST   /api/businesses/{biz_id}/keywords/exclude    — body: {"keyword": "xxx"}
DELETE /api/businesses/{biz_id}/keywords/exclude/{keyword}
POST   /api/businesses/{biz_id}/keywords/custom     — body: {"keyword": "xxx"}
DELETE /api/businesses/{biz_id}/keywords/custom/{keyword}

- 모든 엔드포인트: get_current_user JWT 인증 + businesses 소유권 검증
- DB 컬럼 미존재(`42703`) 시 503 "DB 마이그레이션 필요" 반환
- URL path의 {keyword}는 urllib.parse.unquote로 한글 복원 후 strip()
"""
import logging
from urllib.parse import unquote

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from db.supabase_client import get_client, execute
from middleware.plan_gate import get_current_user, get_user_plan, PLAN_LIMITS
from services.keyword_resolver import (
    MAX_CUSTOM_KEYWORDS,
    validate_keyword,
    _is_missing_column_error,
)
from services.keyword_taxonomy import get_all_keywords_flat

router = APIRouter()
_logger = logging.getLogger("aeolab")


class KeywordRequest(BaseModel):
    keyword: str = Field(..., min_length=1, max_length=50)


async def _get_business_or_403(biz_id: str, user_id: str, supabase) -> dict:
    """사업장 조회 + 소유권 검증. 인증/인가 실패시 HTTPException raise.

    Returns biz row dict with at least {id, user_id, category, custom_keywords, excluded_keywords}.
    두 컬럼이 없는 상태에서는 column-select를 축소하고 기본값을 채워 반환.
    """
    try:
        resp = await execute(
            supabase.table("businesses")
            .select("id, user_id, category, custom_keywords, excluded_keywords")
            .eq("id", biz_id)
            .single()
        )
        row = resp.data if resp is not None else None
    except Exception as e:
        if _is_missing_column_error(e):
            # 컬럼 없으면 최소 필드만 다시 조회
            try:
                resp2 = await execute(
                    supabase.table("businesses")
                    .select("id, user_id, category")
                    .eq("id", biz_id)
                    .single()
                )
                row = resp2.data if resp2 is not None else None
                if row:
                    row["custom_keywords"] = []
                    row["excluded_keywords"] = []
            except Exception as e2:
                _logger.warning(f"business lookup fallback failed (biz={biz_id}): {e2}")
                raise HTTPException(status_code=503, detail={
                    "code": "DB_MIGRATION_REQUIRED",
                    "message": "사용자 맞춤 키워드 기능을 사용하려면 DB 마이그레이션이 필요합니다.",
                })
        else:
            _logger.warning(f"business lookup failed (biz={biz_id}): {e}")
            raise HTTPException(status_code=500, detail="사업장 조회 실패")

    if not row:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")
    if row.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="접근 권한 없음")

    # 기본값 보정
    if not isinstance(row.get("custom_keywords"), list):
        row["custom_keywords"] = list(row.get("custom_keywords") or [])
    if not isinstance(row.get("excluded_keywords"), list):
        row["excluded_keywords"] = list(row.get("excluded_keywords") or [])
    return row


def _handle_db_column_error(e: Exception):
    """UPDATE 시 컬럼 없음을 사용자에게 503으로 전달."""
    if _is_missing_column_error(e):
        raise HTTPException(status_code=503, detail={
            "code": "DB_MIGRATION_REQUIRED",
            "message": (
                "DB 마이그레이션이 필요합니다. 관리자에게 문의하세요. "
                "(businesses.custom_keywords / excluded_keywords 컬럼 누락)"
            ),
        })
    _logger.warning(f"keyword update DB error: {e}")
    raise HTTPException(status_code=500, detail="키워드 저장 실패")


@router.get("/{biz_id}/keywords")
async def get_keywords(biz_id: str, user: dict = Depends(get_current_user)):
    supabase = get_client()
    biz = await _get_business_or_403(biz_id, user["id"], supabase)
    taxonomy = get_all_keywords_flat(biz.get("category") or "") or []
    return {
        "business_id": biz_id,
        "custom": biz.get("custom_keywords") or [],
        "excluded": biz.get("excluded_keywords") or [],
        "taxonomy_count": len(taxonomy),
    }


@router.post("/{biz_id}/keywords/exclude")
async def add_excluded_keyword(
    biz_id: str,
    req: KeywordRequest,
    user: dict = Depends(get_current_user),
):
    kw = (req.keyword or "").strip()
    if not kw:
        raise HTTPException(status_code=400, detail="키워드가 비어 있습니다")

    supabase = get_client()
    biz = await _get_business_or_403(biz_id, user["id"], supabase)
    current = list(biz.get("excluded_keywords") or [])
    if kw not in current:
        current.append(kw)

    try:
        await execute(
            supabase.table("businesses")
            .update({"excluded_keywords": current})
            .eq("id", biz_id)
        )
    except Exception as e:
        _handle_db_column_error(e)

    return {"business_id": biz_id, "excluded": current, "added": kw}


@router.delete("/{biz_id}/keywords/exclude/{keyword}")
async def remove_excluded_keyword(
    biz_id: str,
    keyword: str,
    user: dict = Depends(get_current_user),
):
    decoded = unquote(keyword or "").strip()
    if not decoded:
        raise HTTPException(status_code=400, detail="키워드가 비어 있습니다")

    supabase = get_client()
    biz = await _get_business_or_403(biz_id, user["id"], supabase)
    current = [k for k in (biz.get("excluded_keywords") or []) if k != decoded]

    try:
        await execute(
            supabase.table("businesses")
            .update({"excluded_keywords": current})
            .eq("id", biz_id)
        )
    except Exception as e:
        _handle_db_column_error(e)

    return {"business_id": biz_id, "excluded": current, "removed": decoded}


@router.post("/{biz_id}/keywords/custom")
async def add_custom_keyword(
    biz_id: str,
    req: KeywordRequest,
    user: dict = Depends(get_current_user),
):
    kw = (req.keyword or "").strip()
    ok, err_msg = validate_keyword(kw)
    if not ok:
        raise HTTPException(status_code=400, detail=err_msg)

    supabase = get_client()

    plan = await get_user_plan(user["id"], supabase)
    if not PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["schema"]:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "PLAN_REQUIRED",
                "message": "맞춤 키워드 추가는 Basic 플랜(월 9,900원)부터 이용 가능합니다.",
                "upgrade_url": "/pricing",
            },
        )

    biz = await _get_business_or_403(biz_id, user["id"], supabase)
    current = list(biz.get("custom_keywords") or [])

    if kw in current:
        # 중복 추가는 성공으로 처리 (멱등)
        return {"business_id": biz_id, "custom": current, "added": kw}

    if len(current) >= MAX_CUSTOM_KEYWORDS:
        raise HTTPException(
            status_code=400,
            detail=f"커스텀 키워드는 최대 {MAX_CUSTOM_KEYWORDS}개까지 추가 가능합니다",
        )

    current.append(kw)
    try:
        await execute(
            supabase.table("businesses")
            .update({"custom_keywords": current})
            .eq("id", biz_id)
        )
    except Exception as e:
        _handle_db_column_error(e)

    return {"business_id": biz_id, "custom": current, "added": kw}


@router.delete("/{biz_id}/keywords/custom/{keyword}")
async def remove_custom_keyword(
    biz_id: str,
    keyword: str,
    user: dict = Depends(get_current_user),
):
    decoded = unquote(keyword or "").strip()
    if not decoded:
        raise HTTPException(status_code=400, detail="키워드가 비어 있습니다")

    supabase = get_client()
    biz = await _get_business_or_403(biz_id, user["id"], supabase)
    current = [k for k in (biz.get("custom_keywords") or []) if k != decoded]

    try:
        await execute(
            supabase.table("businesses")
            .update({"custom_keywords": current})
            .eq("id", biz_id)
        )
    except Exception as e:
        _handle_db_column_error(e)

    return {"business_id": biz_id, "custom": current, "removed": decoded}
