"""Admin 인증 공유 유틸.

기존에 messages.py / tips.py 등 라우터마다 동일 _verify_admin 함수가 복제돼 있던 것을 통합.
새 라우터는 항상 이 모듈의 verify_admin을 import 해서 사용한다.

P0 사고 사례 (2026-05-20):
- feedback.py / system_status.py에 _verify_admin 미적용으로 인증 없이 외부 200 OK 응답
- POST /api/system/status/maintenance 누구나 토글 가능 → 서비스 중단 공격 가능
- 재발 방지를 위해 단일 진실 소스로 분리
"""

import logging
import os
import secrets

from fastapi import Header, HTTPException

_logger = logging.getLogger("aeolab")


def verify_admin(x_admin_key: str = Header(None)) -> None:
    """Admin 헤더 검증. ADMIN_SECRET_KEY 환경변수와 일치해야 통과.

    Usage:
        from utils.admin_auth import verify_admin
        @router.get("/admin-only")
        async def f(_: None = Depends(verify_admin)): ...
    """
    key = os.getenv("ADMIN_SECRET_KEY", "")
    if not key or not x_admin_key or not secrets.compare_digest(x_admin_key, key):
        raise HTTPException(status_code=403, detail="Admin only")


async def require_owner(
    x_admin_key: str = Header(None),
    x_admin_email: str = Header(None),
) -> str:
    """구독 강제해지/환불 등 금전이동 액션 전용 — verify_admin 위에 owner 역할까지 추가 검증.

    admin_service_oversight_design_v1.0.md §3-A-H. ADMIN_SECRET_KEY 공유 시크릿
    (1차 방어선) 통과 후, X-Admin-Email이 admin_users 테이블에서 role='owner'인지
    2차 확인한다. X-Admin-Email은 프론트 admin-proxy가 Supabase 인증 세션에서
    채워 넣는 값이라 정상 로그인 경로에서는 위조 불가능하지만, ADMIN_SECRET_KEY를
    이미 아는 상태에서 curl로 직접 호출하면 이메일 헤더를 조작할 수 있다 — 이
    설계는 "여러 정상 관리자 간 권한 분리"가 목적이며 시크릿 유출 자체에 대한
    방어는 아니다(감사 로그 X-Admin-Email과 동일한 구조적 제약, admin_audit.py 참조).

    Returns:
        owner의 이메일 (호출부에서 로깅 등에 활용 가능).
    """
    verify_admin(x_admin_key)

    if not x_admin_email:
        raise HTTPException(status_code=403, detail="Owner 전용 기능 — 관리자 이메일을 확인할 수 없습니다")

    from db.supabase_client import get_client, execute

    try:
        supabase = get_client()
        res = await execute(
            supabase.table("admin_users").select("role").eq("email", x_admin_email).maybe_single()
        )
        role = (res.data or {}).get("role") if res else None
    except Exception as e:
        _logger.warning(f"[admin_auth] admin_users 조회 실패: {e}")
        raise HTTPException(status_code=503, detail="권한 확인 중 오류가 발생했습니다")

    if role != "owner":
        raise HTTPException(status_code=403, detail="Owner 권한이 필요한 기능입니다")

    return x_admin_email
