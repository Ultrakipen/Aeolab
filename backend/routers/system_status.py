from fastapi import APIRouter, Depends
from db.supabase_client import get_client
from utils.admin_auth import verify_admin
import logging

router = APIRouter(prefix="/api/system", tags=["system"])
_logger = logging.getLogger("aeolab")


@router.get("/status")
async def get_system_status(supabase=Depends(get_client)):
    """서비스 상태 조회 (점검 중 여부, 공지 메시지).
    캐시 불필요 — 긴급 상황 실시간 반영.
    """
    try:
        res = supabase.table("system_status").select("key,value,message").execute()
        rows = {
            r["key"]: {"value": r["value"], "message": r.get("message", "")}
            for r in (res.data or [])
        }
        return {
            "maintenance": rows.get("maintenance", {}).get("value") == "true",
            "maintenance_message": rows.get("maintenance", {}).get("message", ""),
            "scan_status": rows.get("scan_status", {}).get("value", "normal"),
            "scan_message": rows.get("scan_status", {}).get("message", ""),
        }
    except Exception as _e:
        _logger.warning(f"[system_status] get_system_status 실패 — {_e}")
        return {
            "maintenance": False,
            "maintenance_message": "",
            "scan_status": "normal",
            "scan_message": "",
        }


@router.post("/status/{key}")
async def set_system_status(
    key: str,
    body: dict,
    supabase=Depends(get_client),
    _: None = Depends(verify_admin),
):
    """Admin 전용: 시스템 상태 설정. body: {value, message}"""
    try:
        supabase.table("system_status").upsert(
            {
                "key": key,
                "value": body.get("value", ""),
                "message": body.get("message", ""),
            }
        ).execute()
        return {"ok": True}
    except Exception as _e:
        _logger.warning(f"[system_status] set_system_status 실패 — {_e}")
        return {"ok": False}
