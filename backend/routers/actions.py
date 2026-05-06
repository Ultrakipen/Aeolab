"""routers/actions.py — 행동 완료 추적 + 7일 후 재스캔 Before/After API"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db.supabase_client import get_client
from middleware.plan_gate import get_current_user

router = APIRouter()
_logger = logging.getLogger(__name__)


# ── Pydantic 모델 ────────────────────────────────────────────────────────────

class ActionCompleteRequest(BaseModel):
    business_id: str
    action_type: str  # 'faq_keyword' | 'intro_keyword' | 'review_reply' | 'blog_post'
    keyword: str
    action_text: str = ""


class ActionResult(BaseModel):
    id: str
    action_type: str
    keyword: Optional[str] = None
    action_text: Optional[str] = None
    completed_at: Optional[str] = None
    rescan_at: Optional[str] = None
    rescan_done: bool = False
    before_score: Optional[float] = None
    after_score: Optional[float] = None
    before_mentioned: Optional[bool] = None
    after_mentioned: Optional[bool] = None
    result_summary: Optional[str] = None


# ── 헬퍼 ────────────────────────────────────────────────────────────────────

def _verify_biz_ownership(supabase, biz_id: str, user_id: str) -> dict:
    """사업장 소유권 검증. 실패 시 HTTPException 발생."""
    biz = (
        supabase.table("businesses")
        .select("id, user_id, name, region, category, keywords")
        .eq("id", biz_id)
        .maybe_single()
        .execute()
    )
    if not biz.data:
        raise HTTPException(404, "사업장을 찾을 수 없습니다")
    if biz.data["user_id"] != user_id:
        raise HTTPException(403, "접근 권한 없음")
    return biz.data


# ── 엔드포인트 ───────────────────────────────────────────────────────────────

@router.post("", status_code=201)
async def complete_action(
    body: ActionCompleteRequest,
    user=Depends(get_current_user),
):
    """행동 완료 기록. Basic 이상 플랜 필요."""
    supabase = get_client()
    user_id: str = user["id"]

    # 소유권 검증
    _verify_biz_ownership(supabase, body.business_id, user_id)

    # 최신 스캔 결과에서 before 값 조회
    scan_row = (
        supabase.table("scan_results")
        .select("id, unified_score, track1_score, gemini_result")
        .eq("business_id", body.business_id)
        .order("scanned_at", desc=True)
        .limit(1)
        .maybe_single()
        .execute()
    )

    before_score: Optional[float] = None
    before_mentioned: Optional[bool] = None

    if scan_row.data:
        before_score = scan_row.data.get("unified_score") or scan_row.data.get("track1_score")
        gemini = scan_row.data.get("gemini_result") or {}
        before_mentioned = bool(gemini.get("mentioned") or (gemini.get("exposure_freq", 0) > 0))

    now = datetime.now(timezone.utc)
    rescan_at = now + timedelta(days=7)

    insert_data = {
        "business_id": body.business_id,
        "user_id": user_id,
        "action_type": body.action_type,
        "keyword": body.keyword,
        "action_text": body.action_text,
        "completed_at": now.isoformat(),
        "rescan_at": rescan_at.isoformat(),
        "rescan_done": False,
        "before_score": before_score,
        "before_mentioned": before_mentioned,
    }

    result = supabase.table("action_completions").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(500, "행동 완료 저장 실패")

    _logger.info(
        f"[actions] 행동 완료 기록 — biz={body.business_id}, "
        f"type={body.action_type}, keyword={body.keyword}, "
        f"rescan_at={rescan_at.date()}"
    )
    return {"id": result.data[0]["id"], "rescan_at": rescan_at.isoformat()}


@router.get("/biz/{biz_id}", response_model=list[ActionResult])
async def list_actions(
    biz_id: str,
    user=Depends(get_current_user),
):
    """사업장의 행동 완료 목록 조회."""
    supabase = get_client()
    _verify_biz_ownership(supabase, biz_id, user["id"])

    rows = (
        supabase.table("action_completions")
        .select(
            "id, action_type, keyword, action_text, completed_at, rescan_at, "
            "rescan_done, before_score, after_score, before_mentioned, "
            "after_mentioned, result_summary"
        )
        .eq("business_id", biz_id)
        .order("completed_at", desc=True)
        .limit(50)
        .execute()
        .data
    ) or []

    return [ActionResult(**r) for r in rows]


@router.get("/result/{action_id}", response_model=ActionResult)
async def get_action_result(
    action_id: str,
    user=Depends(get_current_user),
):
    """특정 행동의 Before/After 결과 조회."""
    supabase = get_client()
    user_id: str = user["id"]

    row = (
        supabase.table("action_completions")
        .select(
            "id, business_id, action_type, keyword, action_text, completed_at, "
            "rescan_at, rescan_done, before_score, after_score, before_mentioned, "
            "after_mentioned, result_summary"
        )
        .eq("id", action_id)
        .maybe_single()
        .execute()
    )

    if not row.data:
        raise HTTPException(404, "행동 기록을 찾을 수 없습니다")

    # 소유권 검증 (action의 business_id로)
    _verify_biz_ownership(supabase, row.data["business_id"], user_id)

    return ActionResult(**row.data)
