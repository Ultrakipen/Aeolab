import os
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, EmailStr

from db.supabase_client import get_client, execute
from middleware.plan_gate import get_current_user

router = APIRouter()
_logger = logging.getLogger("aeolab.inquiry")


# ── 관리자 검증 ────────────────────────────────────────────────────────────────

def _verify_admin(x_admin_key: str = Header(None)) -> None:
    key = os.getenv("ADMIN_SECRET_KEY", "")
    if not key or x_admin_key != key:
        raise HTTPException(status_code=403, detail="관리자 권한 필요")


# ── Pydantic 모델 ──────────────────────────────────────────────────────────────

class InquiryCreate(BaseModel):
    name: str
    email: str
    subject: str
    content: str


class AdminAnswerBody(BaseModel):
    answer: str


class InquiryResponse(BaseModel):
    id: int
    name: str
    email: str
    subject: str
    content: str
    status: str
    answer: Optional[str] = None
    answered_at: Optional[str] = None
    created_at: str


# ── 사용자 엔드포인트 ──────────────────────────────────────────────────────────

@router.post("", summary="문의 제출 (로그인 필요)", status_code=201)
async def submit_inquiry(
    body: InquiryCreate,
    user: dict = Depends(get_current_user),
):
    """로그인한 사용자가 문의를 제출합니다. user_id가 자동으로 저장됩니다."""
    if not body.name.strip():
        raise HTTPException(status_code=422, detail="이름을 입력해 주세요.")
    if not body.subject.strip():
        raise HTTPException(status_code=422, detail="제목을 입력해 주세요.")
    if not body.content.strip():
        raise HTTPException(status_code=422, detail="문의 내용을 입력해 주세요.")

    try:
        supabase = get_client()
        ins = await execute(
            supabase.table("inquiries").insert({
                "user_id": str(user["id"]),
                "name": body.name.strip(),
                "email": body.email.strip(),
                "subject": body.subject.strip(),
                "content": body.content.strip(),
                "status": "pending",
            })
        )
        inquiry_id = ins.data[0]["id"] if ins.data else None
        _logger.info("inquiry submitted id=%s user=%s", inquiry_id, user["id"])
        return {"id": inquiry_id, "message": "문의가 접수되었습니다."}
    except HTTPException:
        raise
    except Exception as e:
        _logger.warning("inquiry submit error user=%s: %s", user.get("id"), e)
        raise HTTPException(status_code=500, detail="문의 접수 중 오류가 발생했습니다.")


@router.get("/me", summary="내 문의 목록 (로그인 필요)")
async def my_inquiries(user: dict = Depends(get_current_user)):
    """로그인한 사용자의 본인 문의 목록을 최신순으로 반환합니다. 최대 20개."""
    try:
        supabase = get_client()
        res = await execute(
            supabase.table("inquiries")
            .select("id, name, email, subject, content, status, answer, answered_at, created_at")
            .eq("user_id", str(user["id"]))
            .order("created_at", desc=True)
            .limit(20)
        )
        return {"items": res.data or []}
    except Exception as e:
        _logger.warning("inquiry me error user=%s: %s", user.get("id"), e)
        raise HTTPException(status_code=500, detail="문의 목록 조회 실패")


# ── 관리자 엔드포인트 ──────────────────────────────────────────────────────────

@router.get("/admin/list", summary="전체 문의 목록 (관리자 전용)")
async def admin_list_inquiries(
    status: Optional[str] = Query("all", description="pending | answered | all"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    x_admin_key: str = Header(None),
):
    _verify_admin(x_admin_key)
    try:
        supabase = get_client()
        offset = (page - 1) * limit

        # 전체 카운트
        count_q = supabase.table("inquiries").select("id", count="exact")
        if status and status != "all":
            count_q = count_q.eq("status", status)
        count_res = await execute(count_q)
        total = count_res.count or 0

        # 목록 조회: 최신순
        q = supabase.table("inquiries").select(
            "id, user_id, name, email, subject, content, status, answer, answered_at, created_at"
        ).order("created_at", desc=True).range(offset, offset + limit - 1)
        if status and status != "all":
            q = q.eq("status", status)

        res = await execute(q)
        return {"items": res.data or [], "total": total, "page": page}
    except HTTPException:
        raise
    except Exception as e:
        _logger.warning("inquiry admin list error: %s", e)
        raise HTTPException(status_code=500, detail="문의 목록 조회 실패")


@router.patch("/admin/{inquiry_id}/answer", summary="답변 등록 (관리자 전용)")
async def admin_answer_inquiry(
    inquiry_id: int,
    body: AdminAnswerBody,
    x_admin_key: str = Header(None),
):
    _verify_admin(x_admin_key)
    if not body.answer.strip():
        raise HTTPException(status_code=422, detail="답변 내용을 입력해 주세요.")

    try:
        supabase = get_client()

        # 존재 확인
        chk = await execute(
            supabase.table("inquiries").select("id, status").eq("id", inquiry_id).single()
        )
        if not chk.data:
            raise HTTPException(status_code=404, detail="문의를 찾을 수 없습니다.")

        now_iso = datetime.now(timezone.utc).isoformat()
        res = await execute(
            supabase.table("inquiries")
            .update({
                "answer": body.answer.strip(),
                "status": "answered",
                "answered_at": now_iso,
            })
            .eq("id", inquiry_id)
            .select("id, status, answered_at")
            .single()
        )
        _logger.info("inquiry answered id=%s", inquiry_id)
        return {"id": inquiry_id, "status": "answered", "message": "답변이 등록되었습니다."}
    except HTTPException:
        raise
    except Exception as e:
        _logger.warning("inquiry answer error id=%s: %s", inquiry_id, e)
        raise HTTPException(status_code=500, detail="답변 등록 중 오류가 발생했습니다.")
