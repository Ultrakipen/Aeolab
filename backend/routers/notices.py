import os
import logging
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel
from typing import Optional
from db.supabase_client import get_client, execute

router = APIRouter()
_logger = logging.getLogger("aeolab.notices")


# ── 관리자 검증 ──────────────────────────────────────────────────────────────

def _verify_admin(x_admin_key: str = Header(None)):
    key = os.getenv("ADMIN_SECRET_KEY", "")
    if not key or x_admin_key != key:
        raise HTTPException(status_code=403, detail="관리자 권한 필요")


# ── Pydantic 모델 ─────────────────────────────────────────────────────────────

class NoticeCreate(BaseModel):
    title: str
    content: str
    category: str = "general"
    is_pinned: bool = False


class NoticeUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    is_pinned: Optional[bool] = None


class NoticeResponse(BaseModel):
    id: int
    title: str
    content: str
    category: str
    is_pinned: bool
    created_at: str
    updated_at: str


# ── 엔드포인트 ────────────────────────────────────────────────────────────────

@router.get("", summary="공지사항 목록 조회 (공개)")
async def list_notices(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    category: Optional[str] = Query(None),
):
    """pinned 먼저, 이후 최신순 반환. 인증 불필요."""
    try:
        supabase = get_client()
        offset = (page - 1) * limit

        # 전체 카운트 쿼리
        count_q = supabase.table("notices").select("id", count="exact")
        if category:
            count_q = count_q.eq("category", category)
        count_res = await execute(count_q)
        total = count_res.count or 0

        # 목록 쿼리: pinned DESC, created_at DESC
        q = supabase.table("notices").select(
            "id, title, content, category, is_pinned, created_at, updated_at"
        ).order("is_pinned", desc=True).order("created_at", desc=True).range(offset, offset + limit - 1)
        if category:
            q = q.eq("category", category)

        res = await execute(q)
        return {"items": res.data or [], "total": total, "page": page}
    except Exception as e:
        _logger.warning("notices list error: %s", e)
        raise HTTPException(status_code=500, detail="공지사항 조회 실패")


@router.get("/{notice_id}", summary="공지사항 상세 조회 (공개)")
async def get_notice(notice_id: int):
    """단건 조회. 인증 불필요."""
    try:
        supabase = get_client()
        res = await execute(
            supabase.table("notices")
            .select("id, title, content, category, is_pinned, created_at, updated_at")
            .eq("id", notice_id)
            .single()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail="공지사항을 찾을 수 없습니다")
        return res.data
    except HTTPException:
        raise
    except Exception as e:
        _logger.warning("notices get error id=%s: %s", notice_id, e)
        raise HTTPException(status_code=500, detail="공지사항 조회 실패")


@router.post("", summary="공지사항 작성 (관리자 전용)", status_code=201)
async def create_notice(body: NoticeCreate, x_admin_key: str = Header(None)):
    _verify_admin(x_admin_key)
    try:
        supabase = get_client()
        ins = await execute(
            supabase.table("notices").insert({
                "title": body.title,
                "content": body.content,
                "category": body.category,
                "is_pinned": body.is_pinned,
            })
        )
        row_id = ins.data[0]["id"] if ins.data else None
        if not row_id:
            raise Exception("insert returned no id")
        res = await execute(
            supabase.table("notices")
            .select("id, title, content, category, is_pinned, created_at, updated_at")
            .eq("id", row_id).single()
        )
        return res.data
    except Exception as e:
        _logger.warning("notices create error: %s", e)
        raise HTTPException(status_code=500, detail="공지사항 작성 실패")


@router.patch("/{notice_id}", summary="공지사항 수정 (관리자 전용)")
async def update_notice(notice_id: int, body: NoticeUpdate, x_admin_key: str = Header(None)):
    _verify_admin(x_admin_key)
    try:
        supabase = get_client()

        # 존재 확인
        chk = await execute(
            supabase.table("notices").select("id").eq("id", notice_id).single()
        )
        if not chk.data:
            raise HTTPException(status_code=404, detail="공지사항을 찾을 수 없습니다")

        update_data = {k: v for k, v in body.model_dump().items() if v is not None}
        if not update_data:
            raise HTTPException(status_code=400, detail="수정할 내용이 없습니다")

        from datetime import datetime, timezone
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

        await execute(
            supabase.table("notices").update(update_data).eq("id", notice_id)
        )
        res = await execute(
            supabase.table("notices")
            .select("id, title, content, category, is_pinned, created_at, updated_at")
            .eq("id", notice_id).single()
        )
        return res.data
    except HTTPException:
        raise
    except Exception as e:
        _logger.warning("notices update error id=%s: %s", notice_id, e)
        raise HTTPException(status_code=500, detail="공지사항 수정 실패")


@router.delete("/{notice_id}", summary="공지사항 삭제 (관리자 전용)")
async def delete_notice(notice_id: int, x_admin_key: str = Header(None)):
    _verify_admin(x_admin_key)
    try:
        supabase = get_client()

        chk = await execute(
            supabase.table("notices").select("id").eq("id", notice_id).single()
        )
        if not chk.data:
            raise HTTPException(status_code=404, detail="공지사항을 찾을 수 없습니다")

        await execute(supabase.table("notices").delete().eq("id", notice_id))
        return {"message": "삭제되었습니다"}
    except HTTPException:
        raise
    except Exception as e:
        _logger.warning("notices delete error id=%s: %s", notice_id, e)
        raise HTTPException(status_code=500, detail="공지사항 삭제 실패")
