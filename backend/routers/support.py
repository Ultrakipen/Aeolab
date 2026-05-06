"""Q&A 게시판 엔드포인트.

사용자 라우터 (prefix: /api/support):
  POST /api/support/tickets                  — 문의 작성 (인증 필수, 요금제별 월 한도)
  GET  /api/support/tickets/me               — 내 문의 목록 (인증 필수)
  GET  /api/support/tickets/{ticket_id}      — 문의 상세 (인증 필수, 본인 OR 공개 답변)
  POST /api/support/tickets/{ticket_id}/replies — 사용자 추가 답글 (인증 필수)
  GET  /api/support/public                   — 공개 답변 완료 목록 (인증 불필요)

관리자 라우터 (prefix: /admin/support, X-Admin-Key 헤더):
  GET   /admin/support/tickets                       — 전체 목록
  POST  /admin/support/{ticket_id}/reply             — 관리자 답글 + 이메일 알림
  PATCH /admin/support/{ticket_id}/visibility        — 공개/비공개 전환
  PATCH /admin/support/{ticket_id}/status            — 상태 변경 (closed)
"""

import logging
import os
import secrets
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, field_validator

from db.supabase_client import get_client, execute
from middleware.plan_gate import get_current_user, get_user_plan

_logger = logging.getLogger("aeolab")

router = APIRouter()
admin_router = APIRouter()

# ── 요금제별 월 문의 한도 ─────────────────────────────────────────────────────────
# None = 무제한
MONTHLY_LIMITS: dict[str, Optional[int]] = {
    "free": 1,
    "basic": 3,
    "pro": None,
    "biz": None,
    "startup": None,
    "enterprise": None,
}

# 결제/계정 카테고리는 공개 전환 금지
_PRIVATE_CATEGORIES = {"payment", "account"}

# 유효한 문의 카테고리
_VALID_CATEGORIES = {"payment", "feature", "score", "bug", "other"}

# 유효한 문의 상태
_VALID_STATUSES = {"open", "answered", "closed"}


# ── 관리자 인증 ────────────────────────────────────────────────────────────────
def verify_admin(x_admin_key: str = Header(None)) -> None:
    secret = os.getenv("ADMIN_SECRET_KEY")
    if not secret:
        raise HTTPException(status_code=503, detail="관리자 키가 설정되지 않았습니다")
    if not x_admin_key or not secrets.compare_digest(x_admin_key, secret):
        raise HTTPException(status_code=403, detail="관리자 전용")


# ── Pydantic 모델 ──────────────────────────────────────────────────────────────
class TicketCreate(BaseModel):
    category: str
    title: str
    body: str
    visibility: str = "private"

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in _VALID_CATEGORIES:
            raise ValueError(f"유효하지 않은 카테고리입니다. 허용값: {', '.join(sorted(_VALID_CATEGORIES))}")
        return v

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("제목을 입력해 주세요")
        if len(v) > 100:
            raise ValueError("제목은 100자 이내로 입력해 주세요")
        return v

    @field_validator("body")
    @classmethod
    def validate_body(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("내용을 입력해 주세요")
        if len(v) > 3000:
            raise ValueError("내용은 3000자 이내로 입력해 주세요")
        return v

    @field_validator("visibility")
    @classmethod
    def validate_visibility(cls, v: str) -> str:
        if v not in ("public", "private"):
            raise ValueError("visibility는 'public' 또는 'private'이어야 합니다")
        return v


class ReplyCreate(BaseModel):
    body: str

    @field_validator("body")
    @classmethod
    def validate_body(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("내용을 입력해 주세요")
        if len(v) > 2000:
            raise ValueError("내용은 2000자 이내로 입력해 주세요")
        return v


class AdminReplyCreate(BaseModel):
    body: str

    @field_validator("body")
    @classmethod
    def validate_body(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("내용을 입력해 주세요")
        if len(v) > 3000:
            raise ValueError("내용은 3000자 이내로 입력해 주세요")
        return v


class VisibilityUpdate(BaseModel):
    visibility: str

    @field_validator("visibility")
    @classmethod
    def validate_visibility(cls, v: str) -> str:
        if v not in ("public", "private"):
            raise ValueError("visibility는 'public' 또는 'private'이어야 합니다")
        return v


class StatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in _VALID_STATUSES:
            raise ValueError(f"유효하지 않은 상태입니다. 허용값: {', '.join(sorted(_VALID_STATUSES))}")
        return v


# ── 공통 유틸 ──────────────────────────────────────────────────────────────────
async def _get_ticket_or_404(ticket_id: str) -> dict:
    """support_tickets 조회 — 없으면 404."""
    supabase = get_client()
    res = await execute(
        supabase.table("support_tickets")
        .select("id, user_id, category, title, body, status, visibility, view_count, created_at, updated_at, answered_at")
        .eq("id", ticket_id)
        .single()
    )
    if not (res and res.data):
        raise HTTPException(status_code=404, detail="문의를 찾을 수 없습니다")
    return res.data


async def _check_monthly_limit(user_id: str) -> None:
    """이번 달 문의 작성 건수가 요금제 한도를 초과하면 429."""
    supabase = get_client()
    plan = await get_user_plan(user_id, supabase)
    limit = MONTHLY_LIMITS.get(plan, 1)

    if limit is None:
        return  # 무제한 플랜

    month_start = date.today().replace(day=1).isoformat() + "T00:00:00"
    res = await execute(
        supabase.table("support_tickets")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .gte("created_at", month_start)
    )
    used = res.count or 0
    if used >= limit:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "TICKET_MONTHLY_LIMIT",
                "used": used,
                "limit": limit,
                "message": f"이번 달 문의 작성 한도({limit}건)를 모두 사용했습니다. 플랜을 업그레이드하면 더 많은 문의를 작성할 수 있습니다.",
                "upgrade_url": "/pricing",
            },
        )


async def _send_reply_notification(ticket_id: str, ticket_title: str, user_id: str) -> None:
    """관리자 답글 등록 시 이메일 알림 (RESEND_API_KEY 미설정 시 skip)."""
    resend_key = os.getenv("RESEND_API_KEY", "")
    if not resend_key:
        _logger.debug(f"[support] 이메일 알림 skip — RESEND_API_KEY 미설정")
        return
    try:
        supabase = get_client()
        profile_res = await execute(
            supabase.table("profiles")
            .select("email")
            .eq("user_id", user_id)
            .single()
        )
        email = ""
        if profile_res and profile_res.data:
            email = (profile_res.data.get("email") or "").strip()
        if not email:
            _logger.debug(f"[support] 이메일 알림 skip — 이메일 없음: user_id={user_id}")
            return

        import resend as _resend
        _resend.api_key = resend_key
        from_email = os.getenv("FROM_EMAIL", "noreply@aeolab.co.kr")
        subject = f"[AEOlab] 문의 답변이 등록되었습니다: {ticket_title[:40]}"
        html_body = f"""
<div style="font-family: 'Apple SD Gothic Neo', sans-serif; max-width:560px; margin:0 auto; padding:32px 24px; color:#1e293b;">
  <h2 style="font-size:20px; margin:0 0 16px;">문의 답변 알림</h2>
  <p style="font-size:15px; line-height:1.7; margin:0 0 20px;">
    문의하신 내용에 답변이 등록되었습니다.
  </p>
  <div style="background:#f8fafc; border-radius:10px; padding:16px 20px; margin-bottom:24px;">
    <p style="font-size:13px; color:#64748b; margin:0 0 4px; font-weight:600;">문의 제목</p>
    <p style="font-size:15px; color:#1e293b; margin:0;">{ticket_title}</p>
  </div>
  <div style="text-align:center; margin-top:8px;">
    <a href="https://aeolab.co.kr/dashboard/support/{ticket_id}"
       style="background:#1d4ed8; color:#ffffff; text-decoration:none; padding:12px 28px; border-radius:8px; font-size:14px; font-weight:600;">
      답변 확인하기
    </a>
  </div>
  <p style="font-size:12px; color:#94a3b8; margin-top:32px; text-align:center;">
    AEOlab · <a href="https://aeolab.co.kr" style="color:#94a3b8;">aeolab.co.kr</a>
  </p>
</div>
"""
        _resend.Emails.send({
            "from": from_email,
            "to": [email],
            "subject": subject,
            "html": html_body,
        })
        _logger.info(f"[support] 답변 이메일 발송: ticket_id={ticket_id}")
    except Exception as e:
        _logger.warning(f"[support] 이메일 알림 발송 실패 (무시): ticket_id={ticket_id}, error={e}")


# ── 사용자 엔드포인트 ───────────────────────────────────────────────────────────

@router.post("/tickets")
async def create_ticket(
    body: TicketCreate,
    user: dict = Depends(get_current_user),
):
    """문의 작성 — 요금제별 월 한도 검증 후 INSERT."""
    user_id = user["id"]

    await _check_monthly_limit(user_id)

    supabase = get_client()
    now = datetime.now(timezone.utc).isoformat()
    payload = {
        "user_id": user_id,
        "category": body.category,
        "title": body.title,
        "body": body.body,
        "status": "open",
        "visibility": body.visibility,
        "view_count": 0,
        "created_at": now,
        "updated_at": now,
    }
    insert_res = await execute(
        supabase.table("support_tickets").insert(payload).select("id, category, title, status, visibility, created_at")
    )
    if not (insert_res and insert_res.data):
        _logger.warning(f"[support] support_tickets INSERT 실패: user_id={user_id}")
        raise HTTPException(status_code=500, detail="문의 등록에 실패했습니다")

    ticket = insert_res.data[0]
    _logger.info(f"[support] 문의 등록: ticket_id={ticket['id']}, user_id={user_id}, category={body.category}")
    return {"ticket": ticket}


@router.get("/tickets/me")
async def list_my_tickets(user: dict = Depends(get_current_user)):
    """내 문의 목록 최신순 20건."""
    supabase = get_client()
    res = await execute(
        supabase.table("support_tickets")
        .select("id, category, title, status, visibility, created_at, answered_at")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .limit(20)
    )
    return {"tickets": res.data or []}


@router.get("/tickets/{ticket_id}")
async def get_ticket(
    ticket_id: str,
    user: dict = Depends(get_current_user),
):
    """문의 상세 조회.

    접근 조건: 본인 소유 OR (visibility='public' AND status='answered')
    조회수 +1 업데이트 (view_count)
    replies도 함께 반환
    """
    ticket = await _get_ticket_or_404(ticket_id)
    user_id = user["id"]

    # 접근 권한 검증
    is_owner = ticket["user_id"] == user_id
    is_public_answered = (
        ticket.get("visibility") == "public"
        and ticket.get("status") == "answered"
    )
    if not (is_owner or is_public_answered):
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다")

    # 조회수 +1 (실패해도 응답에 영향 없음)
    try:
        supabase = get_client()
        new_count = (ticket.get("view_count") or 0) + 1
        await execute(
            supabase.table("support_tickets")
            .update({"view_count": new_count})
            .eq("id", ticket_id)
        )
        ticket["view_count"] = new_count
    except Exception as e:
        _logger.warning(f"[support] view_count 업데이트 실패 (무시): ticket_id={ticket_id}, error={e}")

    # replies 조회
    supabase = get_client()
    replies_res = await execute(
        supabase.table("support_replies")
        .select("id, author_type, body, created_at")
        .eq("ticket_id", ticket_id)
        .order("created_at", desc=False)
    )
    ticket["replies"] = replies_res.data or []

    return {"ticket": ticket}


@router.post("/tickets/{ticket_id}/replies")
async def create_reply(
    ticket_id: str,
    body: ReplyCreate,
    user: dict = Depends(get_current_user),
):
    """사용자 추가 답글 — 본인 소유 + 미종료 상태 검증."""
    ticket = await _get_ticket_or_404(ticket_id)
    user_id = user["id"]

    if ticket["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다")
    if ticket.get("status") == "closed":
        raise HTTPException(status_code=400, detail="종료된 문의에는 답글을 작성할 수 없습니다")

    supabase = get_client()
    now = datetime.now(timezone.utc).isoformat()
    payload = {
        "ticket_id": ticket_id,
        "author_type": "user",
        "author_id": user_id,
        "body": body.body,
        "created_at": now,
    }
    insert_res = await execute(
        supabase.table("support_replies")
        .insert(payload)
        .select("id, author_type, body, created_at")
    )
    if not (insert_res and insert_res.data):
        _logger.warning(f"[support] support_replies INSERT 실패: ticket_id={ticket_id}")
        raise HTTPException(status_code=500, detail="답글 등록에 실패했습니다")

    # updated_at 갱신
    await execute(
        supabase.table("support_tickets")
        .update({"updated_at": now})
        .eq("id", ticket_id)
    )

    return {"reply": insert_res.data[0]}


@router.get("/public")
async def list_public_tickets(
    category: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """공개 답변 완료 목록 (인증 불필요).

    visibility='public' AND status='answered' 필터.
    """
    supabase = get_client()
    query = (
        supabase.table("support_tickets")
        .select("id, category, title, status, view_count, created_at, answered_at")
        .eq("visibility", "public")
        .eq("status", "answered")
        .order("answered_at", desc=True)
        .range(offset, offset + limit - 1)
    )
    if category:
        if category not in _VALID_CATEGORIES:
            raise HTTPException(status_code=400, detail=f"유효하지 않은 카테고리입니다")
        query = query.eq("category", category)

    res = await execute(query)
    return {"tickets": res.data or [], "offset": offset, "limit": limit}


# ── 관리자 엔드포인트 ───────────────────────────────────────────────────────────

@admin_router.get("/tickets")
async def admin_list_tickets(
    status: Optional[str] = Query(None),
    _: None = Depends(verify_admin),
):
    """전체 문의 목록 최신순 50건 (status 필터 optional)."""
    if status and status not in _VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"유효하지 않은 상태입니다. 허용값: {', '.join(sorted(_VALID_STATUSES))}")

    supabase = get_client()
    query = (
        supabase.table("support_tickets")
        .select("id, user_id, category, title, status, visibility, view_count, created_at, updated_at, answered_at")
        .order("created_at", desc=True)
        .limit(50)
    )
    if status:
        query = query.eq("status", status)

    res = await execute(query)
    return {"tickets": res.data or []}


@admin_router.get("/{ticket_id}")
async def admin_get_ticket(
    ticket_id: str,
    _: None = Depends(verify_admin),
):
    """관리자 단건 상세 조회 (replies 포함)."""
    ticket = await _get_ticket_or_404(ticket_id)
    supabase = get_client()
    replies_res = await execute(
        supabase.table("support_replies")
        .select("id, author_type, body, created_at")
        .eq("ticket_id", ticket_id)
        .order("created_at", desc=False)
    )
    ticket["replies"] = replies_res.data or []
    return {"ticket": ticket}


@admin_router.post("/{ticket_id}/reply")
async def admin_reply_ticket(
    ticket_id: str,
    body: AdminReplyCreate,
    _: None = Depends(verify_admin),
):
    """관리자 답글 등록 + 상태 answered 전환 + 이메일 알림."""
    ticket = await _get_ticket_or_404(ticket_id)

    supabase = get_client()
    now = datetime.now(timezone.utc).isoformat()

    # 답글 INSERT
    payload = {
        "ticket_id": ticket_id,
        "author_type": "admin",
        "author_id": "system",
        "body": body.body,
        "created_at": now,
    }
    insert_res = await execute(
        supabase.table("support_replies")
        .insert(payload)
        .select("id, author_type, body, created_at")
    )
    if not (insert_res and insert_res.data):
        _logger.warning(f"[admin/support] support_replies INSERT 실패: ticket_id={ticket_id}")
        raise HTTPException(status_code=500, detail="답글 등록에 실패했습니다")

    # 티켓 상태 업데이트
    await execute(
        supabase.table("support_tickets")
        .update({
            "status": "answered",
            "answered_at": now,
            "updated_at": now,
        })
        .eq("id", ticket_id)
    )

    _logger.info(f"[admin/support] 관리자 답글 등록: ticket_id={ticket_id}")

    # 이메일 알림 (실패해도 응답에 영향 없음)
    try:
        await _send_reply_notification(ticket_id, ticket["title"], ticket["user_id"])
    except Exception as e:
        _logger.warning(f"[admin/support] 이메일 알림 실패 (무시): {e}")

    return {"ticket_id": ticket_id, "reply": insert_res.data[0], "status": "answered"}


@admin_router.patch("/{ticket_id}/visibility")
async def admin_update_visibility(
    ticket_id: str,
    body: VisibilityUpdate,
    _: None = Depends(verify_admin),
):
    """공개/비공개 전환 — 결제·계정 카테고리는 public 전환 금지."""
    ticket = await _get_ticket_or_404(ticket_id)

    if body.visibility == "public" and ticket.get("category") in _PRIVATE_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"'{ticket['category']}' 카테고리 문의는 공개 전환할 수 없습니다",
        )

    supabase = get_client()
    now = datetime.now(timezone.utc).isoformat()
    await execute(
        supabase.table("support_tickets")
        .update({"visibility": body.visibility, "updated_at": now})
        .eq("id", ticket_id)
    )

    _logger.info(f"[admin/support] visibility 변경: ticket_id={ticket_id}, visibility={body.visibility}")
    return {"ticket_id": ticket_id, "visibility": body.visibility}


@admin_router.patch("/{ticket_id}/status")
async def admin_update_status(
    ticket_id: str,
    body: StatusUpdate,
    _: None = Depends(verify_admin),
):
    """상태 변경 (closed 처리 시 closed_at 기록)."""
    await _get_ticket_or_404(ticket_id)

    supabase = get_client()
    now = datetime.now(timezone.utc).isoformat()
    update_payload: dict = {"status": body.status, "updated_at": now}
    if body.status == "closed":
        update_payload["closed_at"] = now

    await execute(
        supabase.table("support_tickets")
        .update(update_payload)
        .eq("id", ticket_id)
    )

    _logger.info(f"[admin/support] 상태 변경: ticket_id={ticket_id}, status={body.status}")
    return {"ticket_id": ticket_id, "status": body.status}
