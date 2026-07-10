"""성공 사례 갤러리 엔드포인트.

공개 라우터:
  GET  /api/stories         — 목록 (카테고리·지역 필터, 페이지네이션, 비로그인)
  GET  /api/stories/{id}    — 상세 + 조회수 +1 (비로그인)

관리자 라우터 (X-Admin-Key 헤더):
  POST /admin/stories       — 성공 사례 게시
"""

import logging
import os
import secrets
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, field_validator

from db.supabase_client import get_client, execute

_logger = logging.getLogger("aeolab")

router = APIRouter()
admin_router = APIRouter()


# ── 관리자 인증 ────────────────────────────────────────────────────────────────
def verify_admin(x_admin_key: str = Header(None)) -> None:
    """delivery.py와 동일한 verify_admin 패턴."""
    secret = os.getenv("ADMIN_SECRET_KEY")
    if not secret:
        raise HTTPException(status_code=503, detail="관리자 키가 설정되지 않았습니다")
    if not x_admin_key or not secrets.compare_digest(x_admin_key, secret):
        raise HTTPException(status_code=403, detail="관리자 전용")


# ── Pydantic 모델 ──────────────────────────────────────────────────────────────
class StoryCreate(BaseModel):
    category: str
    region: str = ""
    title: str
    body: str
    score_before: Optional[float] = None
    score_after: Optional[float] = None
    is_anonymous: bool = True
    display_name: Optional[str] = None
    business_id: Optional[str] = None
    delivery_order_id: Optional[str] = None

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("카테고리를 입력해 주세요")
        return v

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("제목을 입력해 주세요")
        if len(v) > 200:
            raise ValueError("제목은 200자 이내로 입력해 주세요")
        return v

    @field_validator("body")
    @classmethod
    def validate_body(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("내용을 입력해 주세요")
        if len(v) > 5000:
            raise ValueError("내용은 5000자 이내로 입력해 주세요")
        return v


class StoryUpdate(BaseModel):
    category: Optional[str] = None
    region: Optional[str] = None
    title: Optional[str] = None
    body: Optional[str] = None
    score_before: Optional[float] = None
    score_after: Optional[float] = None
    is_anonymous: Optional[bool] = None
    display_name: Optional[str] = None

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("카테고리를 입력해 주세요")
        return v

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("제목을 입력해 주세요")
        if len(v) > 200:
            raise ValueError("제목은 200자 이내로 입력해 주세요")
        return v

    @field_validator("body")
    @classmethod
    def validate_body(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("내용을 입력해 주세요")
        if len(v) > 5000:
            raise ValueError("내용은 5000자 이내로 입력해 주세요")
        return v


# ── 공개 엔드포인트 ────────────────────────────────────────────────────────────
@router.get("")
async def list_stories(
    category: Optional[str] = Query(None, description="업종 필터 (선택)"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    per_page: int = Query(12, ge=1, le=50, description="페이지당 항목 수"),
):
    """성공 사례 목록 반환 (비로그인 가능).

    - published_at IS NOT NULL 행만 반환
    - 카테고리·페이지네이션 지원
    """
    try:
        supabase = get_client()
        offset = (page - 1) * per_page

        # 전체 카운트 쿼리
        count_query = (
            supabase.table("success_stories")
            .select("id", count="exact")
            .not_.is_("published_at", "null")
        )
        if category:
            count_query = count_query.eq("category", category)

        count_res = await execute(count_query)
        total = count_res.count if (count_res and count_res.count is not None) else 0

        # 데이터 조회
        data_query = (
            supabase.table("success_stories")
            .select(
                "id, category, region, title, body, score_before, score_after, "
                "score_delta, is_anonymous, display_name, published_at, view_count"
            )
            .not_.is_("published_at", "null")
            .order("published_at", desc=True)
            .range(offset, offset + per_page - 1)
        )
        if category:
            data_query = data_query.eq("category", category)

        data_res = await execute(data_query)
        items = (data_res.data if data_res and data_res.data else []) or []

        return {"items": items, "total": total, "page": page}

    except Exception as e:
        _logger.warning(f"[stories] 목록 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="성공 사례 목록을 불러오지 못했습니다")


@router.get("/{story_id}")
async def get_story(story_id: str):
    """성공 사례 상세 조회 + 조회수 +1 (비로그인 가능)."""
    try:
        supabase = get_client()

        res = await execute(
            supabase.table("success_stories")
            .select(
                "id, category, region, title, body, score_before, score_after, "
                "score_delta, is_anonymous, display_name, published_at, view_count"
            )
            .eq("id", story_id)
            .not_.is_("published_at", "null")
            .maybe_single()
        )
        if not (res and res.data):
            raise HTTPException(status_code=404, detail="성공 사례를 찾을 수 없습니다")

        story = res.data

        # 조회수 +1 (실패해도 응답은 정상 반환)
        try:
            await execute(
                supabase.table("success_stories")
                .update({"view_count": (story.get("view_count") or 0) + 1})
                .eq("id", story_id)
            )
        except Exception as view_err:
            _logger.warning(f"[stories] 조회수 갱신 실패 id={story_id}: {view_err}")

        return story

    except HTTPException:
        raise
    except Exception as e:
        _logger.warning(f"[stories] 상세 조회 실패 id={story_id}: {e}")
        raise HTTPException(status_code=500, detail="성공 사례를 불러오지 못했습니다")


# ── 관리자 엔드포인트 ──────────────────────────────────────────────────────────
@admin_router.post("")
async def create_story(
    payload: StoryCreate,
    _: None = Depends(verify_admin),
):
    """성공 사례 게시 (관리자 전용, X-Admin-Key 헤더 필수)."""
    try:
        supabase = get_client()

        insert_data: dict = {
            "category": payload.category,
            "region": payload.region,
            "title": payload.title,
            "body": payload.body,
            "is_anonymous": payload.is_anonymous,
        }
        if payload.score_before is not None:
            insert_data["score_before"] = payload.score_before
        if payload.score_after is not None:
            insert_data["score_after"] = payload.score_after
        if payload.display_name is not None:
            insert_data["display_name"] = payload.display_name
        if payload.business_id is not None:
            insert_data["business_id"] = payload.business_id
        if payload.delivery_order_id is not None:
            insert_data["delivery_order_id"] = payload.delivery_order_id

        res = await execute(
            supabase.table("success_stories").insert(insert_data)
        )
        if not (res and res.data):
            raise HTTPException(status_code=500, detail="성공 사례 저장에 실패했습니다")

        _logger.info(f"[stories] 성공 사례 게시 id={res.data[0].get('id')}")
        return res.data[0]

    except HTTPException:
        raise
    except Exception as e:
        _logger.warning(f"[stories] 게시 실패: {e}")
        raise HTTPException(status_code=500, detail="성공 사례 게시에 실패했습니다")


@admin_router.patch("/{story_id}")
async def update_story(
    story_id: str,
    payload: StoryUpdate,
    _: None = Depends(verify_admin),
):
    """성공 사례 수정 (관리자 전용, X-Admin-Key 헤더 필수).

    score_delta는 GENERATED STORED 컬럼이라 직접 갱신 불가 — score_before/after
    갱신 시 DB가 자동 재계산한다.
    """
    try:
        supabase = get_client()

        # single()은 0건일 때도 PostgrestAPIError(PGRST116)를 던져 generic except에 걸려
        # 500으로 오응답한다(faq.py update_faq에 있는 기존 결함과 동일 클래스) — maybe_single()로
        # 0건을 None으로 안전 처리해 의도한 404를 반환하도록 함.
        chk = await execute(
            supabase.table("success_stories").select("id").eq("id", story_id).maybe_single()
        )
        if not (chk and chk.data):
            raise HTTPException(status_code=404, detail="성공 사례를 찾을 수 없습니다")

        update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
        if not update_data:
            raise HTTPException(status_code=400, detail="수정할 내용이 없습니다")

        await execute(
            supabase.table("success_stories").update(update_data).eq("id", story_id)
        )
        res = await execute(
            supabase.table("success_stories")
            .select(
                "id, category, region, title, body, score_before, score_after, "
                "score_delta, is_anonymous, display_name, published_at, view_count"
            )
            .eq("id", story_id)
            .single()
        )
        return res.data

    except HTTPException:
        raise
    except Exception as e:
        _logger.warning(f"[stories] 수정 실패 id={story_id}: {e}")
        raise HTTPException(status_code=500, detail="성공 사례 수정에 실패했습니다")
