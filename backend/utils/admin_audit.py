"""관리자 액션 감사 로그 저장 헬퍼.

admin_service_oversight_design_v1.0.md §3-A-E — 관리자 강제 구독해지/환불처럼
되돌릴 수 없는 금전 이동 액션이 "누가 언제 무엇을 했는지" 기록이 전혀 없었다.
ADMIN_SECRET_KEY는 모든 관리자가 공유하는 단일 시크릿이라 백엔드만으로는 개인을
식별할 수 없다 — 프론트 admin-proxy가 Supabase 세션에서 얻은 관리자 이메일을
X-Admin-Email 헤더로 함께 전달하고, 이 헤더를 여기서 기록한다(헤더가 없으면
curl 등 직접 호출로 간주해 admin_email=NULL로 남긴다 — 기록 자체는 유지).
"""

import logging

from db.supabase_client import get_client, execute

_logger = logging.getLogger("aeolab")


async def record_admin_action(
    admin_email: str | None,
    method: str,
    path: str,
    status_code: int,
    body_snippet: str | None,
) -> None:
    """admin_audit_log에 관리자 액션 1건 기록. 실패해도 원 요청 흐름을 막지 않는다."""
    try:
        supabase = get_client()
        await execute(
            supabase.table("admin_audit_log").insert({
                "admin_email": admin_email,
                "method": method,
                "path": path,
                "status_code": status_code,
                "body_snippet": body_snippet,
            })
        )
    except Exception as e:
        _logger.warning(f"[admin_audit] 감사 로그 저장 실패: {e}")
