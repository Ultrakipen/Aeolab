import asyncio
import os
import secrets
from fastapi import APIRouter, Depends, Header, HTTPException
from db.supabase_client import get_client, execute as _db_execute
from typing import Optional
import logging

router = APIRouter(prefix="/api/messages", tags=["messages"])
_logger = logging.getLogger("aeolab")


def _verify_admin(x_admin_key: str = Header(None)) -> None:
    key = os.getenv("ADMIN_SECRET_KEY", "")
    if not key or not x_admin_key or not secrets.compare_digest(x_admin_key, key):
        raise HTTPException(status_code=403, detail="Admin only")


def _parse_ts(v):
    """ISO 문자열/datetime → tz-aware datetime. 해석 불가면 None."""
    from datetime import datetime, timezone
    if not v:
        return None
    if isinstance(v, datetime):
        dt = v
    else:
        try:
            dt = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
        except ValueError:
            return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _only_after_signup(msgs: list, user_created) -> list:
    """가입 전에 만들어진 공지는 신규 가입자에게 보이지 않게 거른다 (2026-10-26).

    2026-05 '점수 모델 v3.1 업그레이드' 공지가 만료일 없이 남아, 오늘 가입한 사용자에게도
    '업그레이드되었습니다'가 읽지 않은 알림으로 표시됐다. 공지는 '그 시점에 이미 가입한 사용자'에게
    알리는 것이므로 가입일보다 먼저 만들어진 메시지는 제외한다.
    가입일을 알 수 없으면 거르지 않고 기존 동작을 유지한다(메시지 누락보다 안전).
    """
    joined = _parse_ts(user_created)
    if joined is None:
        return msgs
    kept = []
    for m in msgs:
        created = _parse_ts(m.get("created_at"))
        if created is None or created >= joined:
            kept.append(m)
    return kept


@router.get("/unread")
async def get_unread_messages(
    authorization: Optional[str] = Header(None),
    supabase=Depends(get_client),
):
    """로그인 사용자의 미확인 인앱 메시지 조회"""  # public (Bearer token 인증)
    if not authorization:
        return {"messages": [], "unread_count": 0}
    token = authorization.replace("Bearer ", "")
    try:
        user_res = await asyncio.to_thread(supabase.auth.get_user, token)
        user_id = user_res.user.id if (user_res and user_res.user) else None
        if not user_id:
            return {"messages": [], "unread_count": 0}

        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()

        # in_app_messages와 message_reads는 서로 독립적이므로 병렬 조회
        msgs_res, reads_res = await asyncio.gather(
            _db_execute(
                supabase.table("in_app_messages")
                .select("id,title,body,cta_label,cta_url,target_segment,created_at")
                .eq("is_active", True)
                .or_(f"expires_at.is.null,expires_at.gt.{now}")
            ),
            _db_execute(
                supabase.table("message_reads")
                .select("message_id")
                .eq("user_id", user_id)
            ),
        )
        read_ids = {r["message_id"] for r in (reads_res.data or [])}

        unread = [m for m in (msgs_res.data or []) if m["id"] not in read_ids]
        unread = _only_after_signup(unread, getattr(user_res.user, "created_at", None))
        return {"messages": unread, "unread_count": len(unread)}
    except Exception as _e:
        _logger.warning(f"[messages] get_unread_messages 실패 — {_e}")
        return {"messages": [], "unread_count": 0}


@router.post("/{message_id}/read")
async def mark_read(
    message_id: str,
    authorization: Optional[str] = Header(None),
    supabase=Depends(get_client),
):
    """메시지 읽음 처리"""  # public (Bearer token 인증)
    if not authorization:
        return {"ok": False}
    token = authorization.replace("Bearer ", "")
    try:
        user_res = await asyncio.to_thread(supabase.auth.get_user, token)
        user_id = user_res.user.id if (user_res and user_res.user) else None
        if not user_id:
            return {"ok": False}
        supabase.table("message_reads").upsert(
            {"message_id": message_id, "user_id": user_id}
        ).execute()
        return {"ok": True}
    except Exception as _e:
        _logger.warning(f"[messages] mark_read 실패 — {_e}")
        return {"ok": False}


@router.get("")
async def list_messages_admin(
    supabase=Depends(get_client),
    _: None = Depends(_verify_admin),
):
    """Admin 전용 전체 메시지 목록"""
    try:
        res = (
            supabase.table("in_app_messages")
            .select("id,title,body,cta_label,cta_url,target_segment,is_active,expires_at,created_at")
            .order("created_at", desc=True)
            .execute()
        )
        return {"messages": res.data or []}
    except Exception as _e:
        _logger.warning(f"[messages] list_messages_admin 실패 — {_e}")
        return {"messages": []}


@router.post("")
async def create_message(
    body: dict,
    supabase=Depends(get_client),
    _: None = Depends(_verify_admin),
):
    """Admin 전용 메시지 생성"""
    try:
        res = supabase.table("in_app_messages").insert(body).execute()
        return {"message": (res.data or [{}])[0]}
    except Exception as _e:
        _logger.warning(f"[messages] create_message 실패 — {_e}")
        return {"error": str(_e)}


@router.patch("/{message_id}")
async def update_message(
    message_id: str,
    body: dict,
    supabase=Depends(get_client),
    _: None = Depends(_verify_admin),
):
    try:
        res = (
            supabase.table("in_app_messages")
            .update(body)
            .eq("id", message_id)
            .execute()
        )
        return {"message": (res.data or [{}])[0]}
    except Exception as _e:
        _logger.warning(f"[messages] update_message 실패 — {_e}")
        return {"error": str(_e)}


@router.delete("/{message_id}")
async def delete_message(
    message_id: str,
    supabase=Depends(get_client),
    _: None = Depends(_verify_admin),
):
    try:
        supabase.table("in_app_messages").delete().eq("id", message_id).execute()
        return {"ok": True}
    except Exception as _e:
        _logger.warning(f"[messages] delete_message 실패 — {_e}")
        return {"error": str(_e)}
