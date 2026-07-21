"""자동화 도구 엔드포인트.

GET /api/tools/menu-template.xlsx             — 메뉴 일괄 등록 Excel 양식 (Basic+)
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from middleware.plan_gate import get_current_user, get_user_plan
from db.supabase_client import get_client
from services.menu_template import generate_menu_template

_logger = logging.getLogger("aeolab")

router = APIRouter()

BASIC_PLUS_PLANS = {"basic", "startup", "pro", "biz", "enterprise"}


async def _require_basic_plus(user: dict = Depends(get_current_user)) -> dict:
    """Basic 이상 플랜 인증 의존성."""
    supabase = get_client()
    plan = await get_user_plan(user["id"], supabase)
    if plan not in BASIC_PLUS_PLANS:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "PLAN_REQUIRED",
                "current_plan": plan,
                "required_plans": list(BASIC_PLUS_PLANS),
                "upgrade_url": "/pricing",
            },
        )
    return user


@router.get("/menu-template.xlsx")
async def download_menu_template(user: dict = Depends(_require_basic_plus)):
    """메뉴 일괄 등록용 Excel 양식 다운로드.

    - 인증 필수 (Basic+)
    - AI 호출 없음, 서버 CPU만 사용
    """
    try:
        xlsx_bytes = generate_menu_template()
    except Exception as exc:
        _logger.error("[tools] 메뉴 양식 생성 실패: %s", exc)
        raise HTTPException(status_code=500, detail="메뉴 양식 생성에 실패했습니다.")
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="aeolab_menu_template.xlsx"'},
    )
