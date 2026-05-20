from fastapi import APIRouter, Depends, Header
from db.supabase_client import get_client
from typing import Optional
import logging

router = APIRouter(prefix="/api/feedback", tags=["feedback"])
_logger = logging.getLogger("aeolab")


@router.post("")
async def submit_feedback(
    body: dict,
    authorization: Optional[str] = Header(None),
    supabase=Depends(get_client),
):
    """만족도 피드백 제출. body: {event_type, rating(1=good/-1=bad), context}"""
    user_id = None
    if authorization:
        token = authorization.replace("Bearer ", "")
        try:
            user_res = supabase.auth.get_user(token)
            user_id = user_res.user.id if (user_res and user_res.user) else None
        except Exception as _auth_e:
            _logger.warning(f"[feedback] 토큰 파싱 실패 (비회원 처리) — {_auth_e}")

    try:
        payload = {
            "event_type": body.get("event_type", "general"),
            "rating": int(body.get("rating", 1)),
            "context": body.get("context"),
            "user_id": user_id,
        }
        supabase.table("user_feedback").insert(payload).execute()
        return {"ok": True}
    except Exception as _e:
        _logger.warning(f"[feedback] submit_feedback 실패 — {_e}")
        return {"ok": False}


@router.get("/summary")
async def get_feedback_summary(supabase=Depends(get_client)):
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
