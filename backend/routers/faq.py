import logging
from fastapi import APIRouter, Depends, HTTPException, Header, Query, Request
from pydantic import BaseModel
from typing import Optional
from db.supabase_client import get_client, execute
from utils.admin_auth import verify_admin
from utils import cache as _cache

router = APIRouter()
_logger = logging.getLogger("aeolab.faq")

# ── FAQ 검색 rate limit (인메모리, IP당 분당 30회) ────────────────────────────
_SEARCH_RATE_LIMIT = 30
_SEARCH_RATE_WINDOW = 60  # seconds


def _check_search_rate_limit(ip: str) -> None:
    """IP 기반 분당 30회 제한 — 초과 시 429."""
    key = f"faq_search:{ip}"
    count: int = _cache.get(key) or 0
    if count >= _SEARCH_RATE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "RATE_LIMIT",
                "message": "잠시 후 다시 시도해 주세요 (분당 30회 제한).",
                "retry_after": _SEARCH_RATE_WINDOW,
            },
        )
    if count == 0:
        _cache.set(key, 1, _SEARCH_RATE_WINDOW)
    else:
        _cache.set(key, count + 1, _SEARCH_RATE_WINDOW)


class FAQCreate(BaseModel):
    question: str
    answer: str
    category: str = "general"
    order_num: int = 0


class FAQUpdate(BaseModel):
    question: Optional[str] = None
    answer: Optional[str] = None
    category: Optional[str] = None
    order_num: Optional[int] = None
    is_active: Optional[bool] = None


@router.get("/search", summary="FAQ 키워드 검색 (공개, 분당 30회 제한)")
async def search_faqs(
    request: Request,
    q: str = Query(..., min_length=1, max_length=100, description="검색어"),
    limit: int = Query(10, ge=1, le=20),
):
    """question + answer ILIKE 부분일치 검색. 인증 불필요. IP당 분당 30회 제한.

    Returns:
        items: [{id, question, answer, category, relevance_score}]
    """
    client_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")
    _check_search_rate_limit(client_ip)

    keyword = q.strip()
    if not keyword:
        return {"items": [], "query": q}

    try:
        supabase = get_client()
        pattern = f"%{keyword}%"
        res = await execute(
            supabase.table("faqs")
            .select("id, question, answer, category")
            .eq("is_active", True)
            .or_(f"question.ilike.{pattern},answer.ilike.{pattern}")
            .order("order_num")
            .limit(limit)
        )
        items = res.data or []

        # 관련도 점수: question 매칭 = 2점, answer 매칭 = 1점 (단순 휴리스틱)
        kw_lower = keyword.lower()
        scored = []
        for row in items:
            score = 0
            if kw_lower in (row.get("question") or "").lower():
                score += 2
            if kw_lower in (row.get("answer") or "").lower():
                score += 1
            scored.append({**row, "relevance_score": score})
        scored.sort(key=lambda x: x["relevance_score"], reverse=True)

        return {"items": scored, "query": q}
    except Exception as e:
        _logger.warning("faq search error q=%r: %s", q[:50], e)
        raise HTTPException(status_code=500, detail="FAQ 검색 실패")


@router.get("")
async def list_faqs(category: Optional[str] = Query(None)):
    try:
        supabase = get_client()
        q = (
            supabase.table("faqs")
            .select("id, question, answer, category, order_num, is_active, created_at")
            .eq("is_active", True)
            .order("category")
            .order("order_num")
        )
        if category:
            q = q.eq("category", category)
        res = await execute(q)
        return {"items": res.data or []}
    except Exception as e:
        _logger.warning("faq list error: %s", e)
        raise HTTPException(status_code=500, detail="FAQ 조회 실패")


@router.post("", status_code=201)
async def create_faq(body: FAQCreate, _: None = Depends(verify_admin)):
    try:
        supabase = get_client()
        ins = await execute(
            supabase.table("faqs").insert({
                "question": body.question,
                "answer": body.answer,
                "category": body.category,
                "order_num": body.order_num,
            })
        )
        row_id = ins.data[0]["id"] if ins.data else None
        if not row_id:
            raise Exception("insert returned no id")
        res = await execute(
            supabase.table("faqs")
            .select("id, question, answer, category, order_num, is_active, created_at")
            .eq("id", row_id)
            .single()
        )
        return res.data
    except Exception as e:
        _logger.warning("faq create error: %s", e)
        raise HTTPException(status_code=500, detail="FAQ 작성 실패")


@router.patch("/{faq_id}")
async def update_faq(faq_id: int, body: FAQUpdate, _: None = Depends(verify_admin)):
    try:
        supabase = get_client()
        chk = await execute(
            supabase.table("faqs").select("id").eq("id", faq_id).single()
        )
        if not chk.data:
            raise HTTPException(status_code=404, detail="FAQ를 찾을 수 없습니다")
        update_data = {k: v for k, v in body.model_dump().items() if v is not None}
        if not update_data:
            raise HTTPException(status_code=400, detail="수정할 내용이 없습니다")
        await execute(supabase.table("faqs").update(update_data).eq("id", faq_id))
        res = await execute(
            supabase.table("faqs")
            .select("id, question, answer, category, order_num, is_active, created_at")
            .eq("id", faq_id)
            .single()
        )
        return res.data
    except HTTPException:
        raise
    except Exception as e:
        _logger.warning("faq update error id=%s: %s", faq_id, e)
        raise HTTPException(status_code=500, detail="FAQ 수정 실패")


@router.delete("/{faq_id}")
async def delete_faq(faq_id: int, _: None = Depends(verify_admin)):
    try:
        supabase = get_client()
        chk = await execute(
            supabase.table("faqs").select("id").eq("id", faq_id).single()
        )
        if not chk.data:
            raise HTTPException(status_code=404, detail="FAQ를 찾을 수 없습니다")
        await execute(supabase.table("faqs").delete().eq("id", faq_id))
        return {"message": "삭제되었습니다"}
    except HTTPException:
        raise
    except Exception as e:
        _logger.warning("faq delete error id=%s: %s", faq_id, e)
        raise HTTPException(status_code=500, detail="FAQ 삭제 실패")
