"""자동화 도구 엔드포인트 (Sprint 1: 정적 데이터 2종).

GET /api/tools/talktalk-templates/{category}  — 톡톡 채팅방 메뉴 업종 템플릿 (Basic+)
GET /api/tools/reply-templates/{category}/{sentiment}  — 후기 답글 템플릿 (Basic+)
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from middleware.plan_gate import get_current_user, get_user_plan
from db.supabase_client import get_client
from services.talktalk_templates import get_templates, TALKTALK_TEMPLATES
from services.reply_templates import get_reply_templates, SENTIMENTS

_logger = logging.getLogger("aeolab")

router = APIRouter()

_VALID_CATEGORIES = set(TALKTALK_TEMPLATES.keys())
_PLAN_HIERARCHY = {"free": 0, "basic": 1, "startup": 1.5, "pro": 2, "biz": 3}

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


@router.get("/talktalk-templates/{category}")
async def get_talktalk_templates(
    category: str,
    business_name: str = "",
    signature_menu: str = "",
    user: dict = Depends(_require_basic_plus),
):
    """업종별 톡톡 채팅방 메뉴 템플릿 5종 반환.

    - 인증 필수 (Basic+)
    - 미등록 업종은 'other' 폴백
    """
    if category not in _VALID_CATEGORIES:
        _logger.debug(f"[tools] 미등록 업종 폴백: {category!r} -> 'other'")
        category = "other"

    templates = get_templates(
        category=category,
        business_name=business_name,
        signature_menu=signature_menu,
    )
    return {"category": category, "templates": templates}


@router.get("/reply-templates/{category}/{sentiment}")
async def get_reply_template_list(
    category: str,
    sentiment: str,
    business_name: str = "",
    user: dict = Depends(_require_basic_plus),
):
    """업종·감정별 후기 답글 템플릿 반환.

    - 인증 필수 (Basic+)
    - 미등록 업종은 'other' 폴백
    - 미등록 감정은 'neutral' 폴백
    """
    if category not in _VALID_CATEGORIES:
        _logger.debug(f"[tools] 미등록 업종 폴백: {category!r} -> 'other'")
        category = "other"

    if sentiment not in SENTIMENTS:
        raise HTTPException(
            status_code=400,
            detail=f"sentiment 값이 올바르지 않습니다. 허용값: {', '.join(SENTIMENTS)}",
        )

    templates = get_reply_templates(
        category=category,
        sentiment=sentiment,
        business_name=business_name,
    )
    return {"category": category, "sentiment": sentiment, "templates": templates}
