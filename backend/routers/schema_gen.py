from fastapi import APIRouter, HTTPException, Depends
from models.schemas import SchemaRequest
from middleware.plan_gate import get_current_user, get_user_plan, PLAN_LIMITS
from services.schema_generator import (
    CATEGORY_KO, SMARTPLACE_CHECKLIST, CATEGORY_TIPS, CHECKLIST_BY_CATEGORY,
    build_keywords, build_script_tag, score_intro_for_ai_briefing,
)
from services.guide_generator import generate_smartplace_intro
from db.supabase_client import get_client
from utils import cache as _cache

router = APIRouter()

# schema 생성은 PLAN_LIMITS["schema"]가 True/False 게이트일 뿐 월별 횟수 제한이 없어
# review-reply/crisis-reply와 달리 요청속도 제한·중복생성 락이 전혀 없었음. Claude Haiku
# 호출(max_tokens=4096, 소개글+블로그 3종이라 review-reply보다 길게 걸림)이라 동시 사용자
# 늘면 남용 시 영향이 더 큼 — 동일 패턴으로 보강(2026-07-15).
_schema_generation_locks: set[str] = set()

_SCHEMA_RATE_LIMIT = 10
_SCHEMA_RATE_WINDOW = 60  # seconds


def _check_schema_rate_limit(user_id: str) -> None:
    key = f"schema_rate:{user_id}"
    count: int = _cache.get(key) or 0
    if count >= _SCHEMA_RATE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "RATE_LIMIT",
                "message": "잠시 후 다시 시도해 주세요 (분당 10회 제한).",
                "retry_after": _SCHEMA_RATE_WINDOW,
            },
        )
    _cache.set(key, count + 1, _SCHEMA_RATE_WINDOW)


@router.post("/generate")
async def generate_schema(req: SchemaRequest, user: dict = Depends(get_current_user)):
    """
    스마트플레이스 소개글 + 블로그 포스트 초안 3종 + 키워드 생성
    - 소개글·블로그: Claude Haiku (guide_generator.py 경유 — 2026-06-17 Sonnet→Haiku 전환)
    - 키워드·체크리스트: 템플릿 기반 (무비용)
    - JSON-LD script 태그: 홈페이지 있는 경우에만 포함
    - intro_score: 소개글 AI 브리핑 키워드 포함 점수
    - category_tips: 업종별 맞춤 팁 (smartplace_tip / blog_tip)
    - extended_checklist: 표준 체크리스트 + 업종별 추가 체크리스트
    - no_website_guide: 홈페이지 없는 경우 대안 안내
    - blog_drafts: 블로그 초안 3종 (신규_오픈 / 메뉴_소개 / 리뷰_모음)
    - 플랜 제한: basic 이상 (free 불가), 월별 횟수 제한은 없음(불린 게이트) — 남용 방지는
      요청속도 제한(분당 10회)·동시 중복생성 락으로 처리
    """
    user_id = user["id"]

    # 0. 요청속도 제한 — DB 조회 전에 먼저 차단
    _check_schema_rate_limit(user_id)

    # 플랜 체크 (basic 이상만 사용 가능)
    supabase = get_client()
    plan = await get_user_plan(user_id, supabase)
    if not PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["schema"]:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "PLAN_REQUIRED",
                "message": "Schema 생성은 Basic 플랜(월 11,900원)부터 이용 가능합니다.",
                "upgrade_url": "/pricing",
            },
        )

    # 동시 중복 생성 방지 — Claude Haiku 호출(소개글+블로그 3종, 수 초~10여 초 소요) 중
    # 같은 사용자의 중복 요청 차단(review-reply/crisis-reply와 동일 패턴)
    if user_id in _schema_generation_locks:
        import asyncio
        from utils.system_alert_log import record_alert
        asyncio.create_task(record_alert(
            "SCHEMA_GENERATION_IN_PROGRESS", "JSON-LD 생성 락 충돌(동시 요청)",
            level="info", source="lock_contention",
        ))
        raise HTTPException(
            status_code=409,
            detail={
                "code": "SCHEMA_GENERATION_IN_PROGRESS",
                "message": "이미 생성이 진행 중입니다. 완료 후 다시 시도해 주세요.",
            },
        )
    _schema_generation_locks.add(user_id)
    try:
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
            # Claude 호출 실패로 일반 템플릿이 대신 반환된 경우 — 사용자에게 반드시 고지
            "is_fallback": bool(ai_content.get("is_fallback", False)),
        }

        # 소개글 AI 브리핑 키워드 포함 점수
        result["intro_score"] = score_intro_for_ai_briefing(smartplace_intro, req.category)

        # 업종별 맞춤 팁 (업종 alias 정규화 — CATEGORY_TIPS/CHECKLIST 키는 대표 업종군으로 통합)
        _TIPS_ALIAS: dict[str, str] = {
            "hospital": "clinic", "dental": "clinic", "oriental": "clinic", "skincare": "clinic",
            "rehab": "clinic", "checkup": "clinic", "mental": "clinic", "eye": "clinic",
            "oriental_medicine": "clinic", "optics": "clinic", "medical": "clinic",
            "nail": "beauty", "makeup": "beauty", "spa": "beauty",
            "semi_permanent": "beauty", "massage": "beauty", "jjimjil": "beauty",
            "yoga": "fitness", "swimming": "fitness",
            "dance": "fitness", "ballet": "fitness", "golf": "fitness", "swim": "fitness",
            "martial_arts": "fitness", "climbing": "fitness",
            "language": "academy", "coding": "academy", "art_studio": "academy",
            "art_edu": "academy", "sports_edu": "academy", "driving": "academy",
            "daycare": "academy", "tutoring": "academy", "music_edu": "academy",
            "education": "academy", "study": "academy", "music_class": "academy",
            "music_lesson": "academy", "cooking": "academy", "art_class": "academy",
            "childcare": "academy",
            "chicken": "restaurant", "bbq": "restaurant", "seafood": "restaurant",
            "bar": "restaurant", "snack": "restaurant", "delivery": "restaurant",
            "bakery": "cafe",
            "tax": "legal", "architecture": "legal", "accounting": "legal",
            "realestate": "legal",
            "vet": "pet",
            "clothing": "shopping", "shoes": "shopping", "grocery": "shopping",
            "electronics": "shopping", "furniture": "shopping", "stationery": "shopping",
            "book": "shopping", "supplement": "shopping", "baby": "shopping",
            "fashion": "shopping", "footwear": "shopping", "flower": "shopping",
            # 생활서비스(출장·시공형) — 2026-07-14 신설 그룹
            "interior": "service", "auto": "service", "cleaning": "service",
            "car_wash": "service", "laundry": "service", "electronics_repair": "service",
            # 사진·영상·디자인(포트폴리오형) — 2026-07-14 신설 그룹
            "photo": "creative", "video": "creative", "design": "creative",
            # 여가·오락·공방(공간 예약형) — 2026-07-14 신설 그룹
            "norebang": "leisure", "billiards": "leisure", "workshop": "leisure",
            "escape": "leisure", "experience": "leisure",
        }
        _tips_key = _TIPS_ALIAS.get(req.category, req.category)
        result["category_tips"] = CATEGORY_TIPS.get(_tips_key, {})

        # 표준 체크리스트 + 업종별 추가 체크리스트
        result["extended_checklist"] = (
            SMARTPLACE_CHECKLIST + CHECKLIST_BY_CATEGORY.get(_tips_key, [])
        )

        # 홈페이지 있는 경우에만 JSON-LD 추가
        if req.website_url:
            result["script_tag"] = build_script_tag(req)
        else:
            # 홈페이지 없을 때 대안 가이드
            result["no_website_guide"] = CATEGORY_TIPS.get(_tips_key, {}).get(
                "no_website_guide",
                "카카오맵 비즈니스 채널에 가게 정보를 등록하면 홈페이지 없이도 Google AI Overview 노출이 가능합니다.",
            )

        return result
    finally:
        _schema_generation_locks.discard(user_id)
