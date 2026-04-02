from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from models.schemas import SchemaRequest
from services.schema_generator import (
    CATEGORY_KO, SMARTPLACE_CHECKLIST, build_keywords, build_script_tag,
)
from services.guide_generator import generate_smartplace_intro
from db.supabase_client import get_client

router = APIRouter()


@router.post("/generate")
async def generate_schema(req: SchemaRequest, x_user_id: Optional[str] = Header(None)):
    """
    스마트플레이스 소개글 + 블로그 포스트 초안 + 키워드 생성
    - 소개글·블로그: Claude Sonnet (guide_generator.py 경유 — 비용 정책 준수)
    - 키워드·체크리스트: 템플릿 기반 (무비용)
    - JSON-LD script 태그: 홈페이지 있는 경우에만 포함
    - 플랜 제한: basic 이상 (free 불가)
    """
    # 플랜 체크 (basic 이상만 사용 가능)
    if x_user_id:
        from middleware.plan_gate import get_user_plan, PLAN_LIMITS
        supabase = get_client()
        plan = await get_user_plan(x_user_id, supabase)
        if not PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["schema"]:
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "PLAN_REQUIRED",
                    "message": "Schema 생성은 Basic 플랜(월 9,900원)부터 이용 가능합니다.",
                    "upgrade_url": "/pricing",
                },
            )
    else:
        raise HTTPException(status_code=401, detail="인증이 필요합니다")

    category_ko = CATEGORY_KO.get(req.category, "사업장")

    # Claude 콘텐츠 생성 (guide_generator.py 경유)
    ai_content = await generate_smartplace_intro(
        business_name=req.business_name,
        category_ko=category_ko,
        region=req.region,
        address=req.address,
        phone=req.phone,
        opening_hours=req.opening_hours,
        menu_items=req.menu_items,
        specialty=req.specialty,
        description=req.description,
    )

    result = {
        "smartplace_intro": ai_content.get("smartplace_intro", ""),
        "blog_title":       ai_content.get("blog_title", ""),
        "blog_content":     ai_content.get("blog_content", ""),
        "keywords":         build_keywords(req),
        "smartplace_checklist": SMARTPLACE_CHECKLIST,
    }

    # 홈페이지 있는 경우에만 JSON-LD 추가
    if req.website_url:
        result["script_tag"] = build_script_tag(req)

    return result
