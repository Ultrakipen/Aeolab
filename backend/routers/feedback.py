from fastapi import APIRouter, Depends, Header, HTTPException, Request
from db.supabase_client import get_client
from utils.admin_auth import verify_admin
from utils import cache as _cache
from typing import Optional
import json
import logging

router = APIRouter(prefix="/api/feedback", tags=["feedback"])
_logger = logging.getLogger("aeolab")

# IP당 분당 10회 rate limit + context 크기 제한(security_audit_v1.0.md M4) —
# 인증 선택적·rate limit 부재 상태라 Supabase Free Tier(500MB) 스토리지 고갈 가능성이 있었음.
_FEEDBACK_RATE_LIMIT = 10
_FEEDBACK_RATE_WINDOW = 60  # seconds
_FEEDBACK_CONTEXT_MAX_BYTES = 5000


def _check_feedback_rate_limit(ip: str) -> None:
    key = f"feedback:{ip}"
    count: int = _cache.get(key) or 0
    if count >= _FEEDBACK_RATE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "RATE_LIMIT",
                "message": "잠시 후 다시 시도해 주세요 (분당 10회 제한).",
                "retry_after": _FEEDBACK_RATE_WINDOW,
            },
        )
    if count == 0:
        _cache.set(key, 1, _FEEDBACK_RATE_WINDOW)
    else:
        _cache.set(key, count + 1, _FEEDBACK_RATE_WINDOW)


@router.post("")
async def submit_feedback(
    body: dict,
    request: Request,
    authorization: Optional[str] = Header(None),
    supabase=Depends(get_client),
):
    """만족도 피드백 제출. body: {event_type, rating(1=good/-1=bad), context}"""
    client_ip = (request.client.host if request.client else "unknown")
    _check_feedback_rate_limit(client_ip)

    user_id = None
    if authorization:
        token = authorization.replace("Bearer ", "")
        try:
            user_res = supabase.auth.get_user(token)
            user_id = user_res.user.id if (user_res and user_res.user) else None
        except Exception as _auth_e:
            _logger.warning(f"[feedback] 토큰 파싱 실패 (비회원 처리) — {_auth_e}")

    context = body.get("context")
    if context is not None and len(json.dumps(context, ensure_ascii=False)) > _FEEDBACK_CONTEXT_MAX_BYTES:
        raise HTTPException(status_code=400, detail="context 크기가 너무 큽니다")

    try:
        payload = {
            "event_type": body.get("event_type", "general"),
            "rating": int(body.get("rating", 1)),
            "context": context,
            "user_id": user_id,
        }
        supabase.table("user_feedback").insert(payload).execute()
        return {"ok": True}
    except Exception as _e:
        _logger.warning(f"[feedback] submit_feedback 실패 — {_e}")
        return {"ok": False}


@router.get("/summary")
async def get_feedback_summary(
    supabase=Depends(get_client),
    _: None = Depends(verify_admin),
):
    """Admin 전용: 이벤트별 만족도 집계"""
    try:
        res = supabase.table("user_feedback").select("event_type,rating").execute()
        rows = res.data or []
        from collections import defaultdict
        summary: dict = defaultdict(lambda: {"good": 0, "bad": 0})
        for r in rows:
            key = "good" if r.get("rating", 1) > 0 else "bad"
            summary[r.get("event_type", "general")][key] += 1
        return {"summary": dict(summary)}
    except Exception as _e:
        _logger.warning(f"[feedback] get_feedback_summary 실패 — {_e}")
        return {"summary": {}}
