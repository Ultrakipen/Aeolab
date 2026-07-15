import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, EmailStr

from db.supabase_client import get_client, execute
from middleware.plan_gate import get_current_user, check_support_ticket_limit
from utils.admin_auth import verify_admin

router = APIRouter()
_logger = logging.getLogger("aeolab.inquiry")

# 요금제별 월 문의 한도는 middleware/plan_gate.py PLAN_LIMITS["support_ticket_monthly"]가 단일 소스
# (2026-07-15 통합 — support.py와 각자 dict를 들고 있어 값 변경 시 양쪽 동기화가 필요했던 구조를 제거).
# 구 문의 폼(inquiries)과 신 Q&A 티켓(support_tickets) 두 테이블 합산 검사는 check_support_ticket_limit() 참조
# (2026-07-11 한쪽 테이블 한도만 걸어 다른 쪽으로 우회 가능했던 버그 수정 이력).


def _limit_exceeded_error(used: int, limit: int) -> HTTPException:
    return HTTPException(
        status_code=429,
        detail={
            "code": "TICKET_MONTHLY_LIMIT",
            "used": used,
            "limit": limit,
            "message": f"이번 달 문의 작성 한도({limit}건)를 모두 사용했습니다. 플랜을 업그레이드하면 더 많은 문의를 작성할 수 있습니다.",
            "upgrade_url": "/pricing",
        },
    )


async def _check_monthly_limit(user_id: str) -> None:
    """이번 달 문의(구 폼 + Q&A 티켓 합산) 건수가 요금제 한도를 초과하면 429."""
    supabase = get_client()
    allowed, used, limit = await check_support_ticket_limit(user_id, supabase)
    if not allowed:
        raise _limit_exceeded_error(used, limit)


async def _notify_admin_new_inquiry(name: str, email: str, subject: str, inquiry_id) -> None:
    resend_key = os.getenv("RESEND_API_KEY", "")
    from_email = os.getenv("FROM_EMAIL", "noreply@aeolab.co.kr")
    admin_emails_raw = os.getenv("ADMIN_EMAILS", "contact@aeolab.co.kr")
    admin_emails = [e.strip() for e in admin_emails_raw.split(",") if e.strip()]
    if not resend_key or not admin_emails:
        return
    try:
        import resend as _resend
        _resend.api_key = resend_key
        _resend.Emails.send({
            "from": f"AEOlab <{from_email}>",
            "to": admin_emails,
            "subject": f"[AEOlab] 새 문의 접수 #{inquiry_id}: {subject}",
            "html": (
                f"<p><b>문의 ID:</b> {inquiry_id}</p>"
                f"<p><b>이름:</b> {name}</p>"
                f"<p><b>이메일:</b> {email}</p>"
                f"<p><b>제목:</b> {subject}</p>"
                f"<p><a href='https://aeolab.co.kr/admin'>관리자 페이지에서 확인</a></p>"
            ),
        })
        _logger.debug("[inquiry] 관리자 알림 발송 완료 id=%s", inquiry_id)
    except Exception as e:
        _logger.warning("[inquiry] 관리자 알림 발송 실패 (무시) id=%s: %s", inquiry_id, e)


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
        user_id = str(user["id"])
        await _check_monthly_limit(user_id)
        supabase = get_client()
        ins = await execute(
            supabase.table("inquiries").insert({
                "user_id": user_id,
                "name": body.name.strip(),
                "email": body.email.strip(),
                "subject": body.subject.strip(),
                "content": body.content.strip(),
                "status": "pending",
            })
        )
        inquiry_id = ins.data[0]["id"] if ins.data else None

        # 동시 제출 레이스 보정 — support.py create_ticket()과 동일 패턴(2026-07-15)
        allowed_after, used_after, limit_after = await check_support_ticket_limit(user_id, supabase)
        if not allowed_after and inquiry_id is not None:
            await execute(supabase.table("inquiries").delete().eq("id", inquiry_id))
            _logger.warning("동시 제출 레이스 감지 — 문의 롤백: id=%s user=%s", inquiry_id, user_id)
            raise _limit_exceeded_error(used_after, limit_after)

        _logger.info("inquiry submitted id=%s user=%s", inquiry_id, user["id"])
        asyncio.create_task(_notify_admin_new_inquiry(
            body.name.strip(), body.email.strip(), body.subject.strip(), inquiry_id
        ))
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
    _: None = Depends(verify_admin),
):
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
    _: None = Depends(verify_admin),
):
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
        await execute(
            supabase.table("inquiries")
            .update({
                "answer": body.answer.strip(),
                "status": "answered",
                "answered_at": now_iso,
            })
            .eq("id", inquiry_id)
        )
        _logger.info("inquiry answered id=%s", inquiry_id)
        return {"id": inquiry_id, "status": "answered", "message": "답변이 등록되었습니다."}
    except HTTPException:
        raise
    except Exception as e:
        _logger.warning("inquiry answer error id=%s: %s", inquiry_id, e)
        raise HTTPException(status_code=500, detail="답변 등록 중 오류가 발생했습니다.")
