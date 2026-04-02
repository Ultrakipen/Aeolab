import os
import logging
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel
from typing import Optional
from db.supabase_client import get_client, execute

router = APIRouter()
_logger = logging.getLogger("aeolab.faq")


def _verify_admin(x_admin_key: str = Header(None)):
    key = os.getenv("ADMIN_SECRET_KEY", "")
    if not key or x_admin_key != key:
        raise HTTPException(status_code=403, detail="관리자 권한 필요")


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
async def create_faq(body: FAQCreate, x_admin_key: str = Header(None)):
    _verify_admin(x_admin_key)
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
async def update_faq(faq_id: int, body: FAQUpdate, x_admin_key: str = Header(None)):
    _verify_admin(x_admin_key)
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
async def delete_faq(faq_id: int, x_admin_key: str = Header(None)):
    _verify_admin(x_admin_key)
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
