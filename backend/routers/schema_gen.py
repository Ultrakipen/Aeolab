from fastapi import APIRouter, HTTPException, Depends
from models.schemas import SchemaRequest
from middleware.plan_gate import get_current_user, get_user_plan, PLAN_LIMITS
from services.schema_generator import (
    CATEGORY_KO, SMARTPLACE_CHECKLIST, CATEGORY_TIPS, CHECKLIST_BY_CATEGORY,
    build_keywords, build_script_tag, score_intro_for_ai_briefing,
)
from services.guide_generator import generate_smartplace_intro
from db.supabase_client import get_client

router = APIRouter()


@router.post("/generate")
async def generate_schema(req: SchemaRequest, user: dict = Depends(get_current_user)):
    """
    스마트플레이스 소개글 + 블로그 포스트 초안 3종 + 키워드 생성
    - 소개글·블로그: Claude Sonnet (guide_generator.py 경유 — 비용 정책 준수)
    - 키워드·체크리스트: 템플릿 기반 (무비용)
    - JSON-LD script 태그: 홈페이지 있는 경우에만 포함
    - intro_score: 소개글 AI 브리핑 키워드 포함 점수
    - category_tips: 업종별 맞춤 팁 (smartplace_tip / blog_tip)
    - extended_checklist: 표준 체크리스트 + 업종별 추가 체크리스트
    - no_website_guide: 홈페이지 없는 경우 대안 안내
    - blog_drafts: 블로그 초안 3종 (신규_오픈 / 메뉴_소개 / 리뷰_모음)
    - 플랜 제한: basic 이상 (free 불가)
    """
    user_id = user["id"]

    # 플랜 체크 (basic 이상만 사용 가능)
    supabase = get_client()
    plan = await get_user_plan(user_id, supabase)
    if not PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["schema"]:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "PLAN_REQUIRED",
                "message": "Schema 생성은 Basic 플랜(월 9,900원)부터 이용 가능합니다.",
                "upgrade_url": "/pricing",
            },
        )

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

    smartplace_intro = ai_content.get("smartplace_intro", "")
    blog_drafts = ai_content.get("blog_drafts", [])

    result: dict = {
        "smartplace_intro": smartplace_intro,
        # blog_drafts: 3종 블로그 초안
        "blog_drafts": blog_drafts,
        # 하위호환 필드 유지
        "blog_title": ai_content.get("blog_title", blog_drafts[0]["title"] if blog_drafts else ""),
        "blog_content": ai_content.get("blog_content", blog_drafts[0]["content"] if blog_drafts else ""),
        "keywords": build_keywords(req),
        "smartplace_checklist": SMARTPLACE_CHECKLIST,
    }

    # 소개글 AI 브리핑 키워드 포함 점수
    result["intro_score"] = score_intro_for_ai_briefing(smartplace_intro, req.category)

    # 업종별 맞춤 팁
    result["category_tips"] = CATEGORY_TIPS.get(req.category, CATEGORY_TIPS.get("restaurant", {}))

    # 표준 체크리스트 + 업종별 추가 체크리스트
    result["extended_checklist"] = (
        SMARTPLACE_CHECKLIST + CHECKLIST_BY_CATEGORY.get(req.category, [])
    )

    # 홈페이지 있는 경우에만 JSON-LD 추가
    if req.website_url:
        result["script_tag"] = build_script_tag(req)
    else:
        # 홈페이지 없을 때 대안 가이드
        result["no_website_guide"] = CATEGORY_TIPS.get(req.category, {}).get(
            "no_website_guide",
            "카카오맵 비즈니스 채널에 가게 정보를 등록하면 홈페이지 없이도 Google AI Overview 노출이 가능합니다.",
        )

    return result
