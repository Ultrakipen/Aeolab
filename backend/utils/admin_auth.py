"""Admin 인증 공유 유틸.

기존에 messages.py / tips.py 등 라우터마다 동일 _verify_admin 함수가 복제돼 있던 것을 통합.
새 라우터는 항상 이 모듈의 verify_admin을 import 해서 사용한다.

P0 사고 사례 (2026-05-20):
- feedback.py / system_status.py에 _verify_admin 미적용으로 인증 없이 외부 200 OK 응답
- POST /api/system/status/maintenance 누구나 토글 가능 → 서비스 중단 공격 가능
- 재발 방지를 위해 단일 진실 소스로 분리
"""

import os
import secrets

from fastapi import Header, HTTPException


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
