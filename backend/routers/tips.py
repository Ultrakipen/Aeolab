from fastapi import APIRouter, Depends, Query
from db.supabase_client import get_client
import logging

router = APIRouter(prefix="/api/tips", tags=["tips"])
_logger = logging.getLogger("aeolab")


@router.get("")
async def get_tips(
    section: str = Query(""),
    industry: str = Query(""),
    supabase=Depends(get_client),
):
    """대시보드 섹션별 운영자 작성 컨텍스트 팁 조회 (인증 불필요, 캐시 5분)"""
    try:
        q = (
            supabase.table("context_tips")
            .select("id,section,title,body,cta_label,cta_url,industry_filter,priority")
            .eq("is_active", True)
        )
        if section:
            q = q.eq("section", section)
        res = q.order("priority", desc=False).limit(5).execute()
        tips = []
        for row in (res.data or []):
            filters = row.get("industry_filter") or []
            if not filters or industry in filters:
                # 클라이언트에 불필요한 필드 제거
                tips.append({k: v for k, v in row.items() if k != "industry_filter"})
        return {"tips": tips}
    except Exception as _e:
        _logger.warning(f"[tips] get_tips 실패 — {_e}")
        return {"tips": []}


@router.post("")
async def create_tip(body: dict, supabase=Depends(get_client)):
    """Admin 전용 팁 생성"""
    # TODO: admin 인증 추가 (현재 admin_required 미들웨어 패턴 확인 후 적용)
    try:
        res = supabase.table("context_tips").insert(body).execute()
        return {"tip": (res.data or [{}])[0]}
    except Exception as _e:
        _logger.warning(f"[tips] create_tip 실패 — {_e}")
        return {"error": str(_e)}


@router.patch("/{tip_id}")
async def update_tip(tip_id: str, body: dict, supabase=Depends(get_client)):
    try:
        res = supabase.table("context_tips").update(body).eq("id", tip_id).execute()
        return {"tip": (res.data or [{}])[0]}
    except Exception as _e:
        _logger.warning(f"[tips] update_tip 실패 — {_e}")
        return {"error": str(_e)}


@router.delete("/{tip_id}")
async def delete_tip(tip_id: str, supabase=Depends(get_client)):
    try:
        supabase.table("context_tips").delete().eq("id", tip_id).execute()
        return {"ok": True}
    except Exception as _e:
        _logger.warning(f"[tips] delete_tip 실패 — {_e}")
        return {"error": str(_e)}
