"""
가이드 생성 라우터
도메인 모델 v2.1 Phase D: ActionPlan 타입 반환
"""
import logging
from fastapi import APIRouter, Header, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel
from models.schemas import GuideRequest
from services.guide_generator import GuideGenerator
from db.supabase_client import get_client, execute
from middleware.plan_gate import get_current_user

_logger = logging.getLogger("aeolab")
router = APIRouter()


async def _verify_biz_ownership(supabase, biz_id: str, user_id: str) -> None:
    """사업장 소유권 검증 — 타인 소유 또는 없는 경우 404 반환"""
    from db.supabase_client import execute as _exec
    row = (await _exec(
        supabase.table("businesses")
        .select("id")
        .eq("id", biz_id)
        .eq("user_id", user_id)
        .maybe_single()
    )).data
    if not row:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")


class ChecklistUpdate(BaseModel):
    done: list[int]


@router.post("/generate")
async def generate_guide(
    req: GuideRequest,
    bg: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    """Claude API로 개선 가이드 생성 (비동기 백그라운드).
    월별 생성 한도: Basic 2회 / Pro 10회 / Biz 무제한
    """
    from middleware.plan_gate import check_guide_limit
    supabase = get_client()
    allowed, used, limit = await check_guide_limit(current_user["id"], supabase)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "GUIDE_LIMIT_EXCEEDED",
                "used": used,
                "limit": limit,
                "message": f"이번 달 가이드 생성 한도({limit}회)를 초과했습니다. 다음 달 1일에 초기화됩니다.",
                "upgrade_url": "/pricing",
            },
        )
    bg.add_task(_generate_and_save, req)
    return {"status": "generating", "business_id": req.business_id}


@router.patch("/{guide_id}/checklist")
async def update_checklist(guide_id: str, payload: ChecklistUpdate, current_user=Depends(get_current_user)):
    """가이드 체크리스트 완료 항목 저장"""
    supabase = get_client()
    guide_row = (await execute(
        supabase.table("guides").select("business_id").eq("id", guide_id).single()
    )).data
    if not guide_row:
        raise HTTPException(status_code=404, detail="Guide not found")
    biz = (await execute(
        supabase.table("businesses").select("id")
        .eq("id", guide_row["business_id"]).eq("user_id", current_user["id"]).single()
    )).data
    if not biz:
        raise HTTPException(status_code=403, detail="Not authorized")
    await execute(
        supabase.table("guides").update({"checklist_done": payload.done}).eq("id", guide_id)
    )
    return {"ok": True}


@router.get("/{biz_id}/latest")
async def get_latest_guide(biz_id: str, user=Depends(get_current_user)):
    """최신 가이드 조회 (ActionPlan 구조 포함)"""
    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])
    # v2.1 컬럼 포함 조회 시도, 없으면 레거시 컬럼만
    try:
        result = await execute(
            supabase.table("guides")
            .select("id, business_id, items_json, priority_json, summary, checklist_done, generated_at, context, next_month_goal, tools_json")
            .eq("business_id", biz_id)
            .order("generated_at", desc=True)
            .limit(1)
        )
    except Exception:
        result = await execute(
            supabase.table("guides")
            .select("id, business_id, items_json, priority_json, summary, checklist_done, generated_at")
            .eq("business_id", biz_id)
            .order("generated_at", desc=True)
            .limit(1)
        )
    if not result.data:
        raise HTTPException(status_code=404, detail="No guide found")
    return result.data[0]


@router.post("/ad-defense/{biz_id}")
async def generate_ad_defense_guide(biz_id: str, x_user_id: str = Header(...)):
    """ChatGPT 광고 대응 가이드 생성 (Basic+ 전용)"""
    supabase = get_client()
    sub = (
        await execute(
            supabase.table("subscriptions")
            .select("plan, status")
            .eq("user_id", x_user_id)
            .maybe_single()
        )
    ).data
    plan = (sub or {}).get("plan", "free")
    status = (sub or {}).get("status", "inactive")
    if plan == "free" or status != "active":
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "required_plans": ["basic", "pro", "biz"]},
        )

    biz = (await execute(
        supabase.table("businesses")
        .select("id, name, category, region, keywords, website_url, description")
        .eq("id", biz_id).single()
    )).data
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")

    scan = (
        await execute(
            supabase.table("scan_results")
            .select("id, total_score, score_breakdown, gemini_result, chatgpt_result, naver_result, google_result, perplexity_result, naver_channel_score, global_channel_score")
            .eq("business_id", biz_id)
            .order("scanned_at", desc=True)
            .limit(1)
        )
    ).data
    if not scan:
        raise HTTPException(status_code=404, detail="No scan results found")

    from services.ad_defense_guide import AdDefenseGuideService
    svc = AdDefenseGuideService()
    return await svc.generate(biz, scan[0])


async def _generate_and_save(req: GuideRequest):
    """가이드 생성 백그라운드 태스크 — ActionPlan 구조로 저장"""
    try:
        supabase = get_client()
        biz = (await execute(
            supabase.table("businesses")
            .select("id, name, category, region, keywords, website_url, description, google_place_id, kakao_place_id, business_type, naver_place_id, address, phone")
            .eq("id", req.business_id).single()
        )).data
        if not biz:
            _logger.error(f"Guide gen: business {req.business_id} not found")
            return

        scan = (await execute(
            supabase.table("scan_results")
            .select("id, total_score, score_breakdown, naver_channel_score, global_channel_score, kakao_result, website_check_result, chatgpt_result, naver_result, google_result, perplexity_result, gemini_result, exposure_freq")
            .eq("id", req.scan_id).single()
        )).data
        if not scan:
            _logger.error(f"Guide gen: scan {req.scan_id} not found")
            return

        competitors = (
            await execute(
                supabase.table("competitors")
                .select("id, name")
                .eq("business_id", req.business_id)
                .eq("is_active", True)
            )
        ).data or []

        # 경쟁사 점수 (scan_results.competitor_scores)
        raw_comp = scan.get("competitor_scores") or {}
        competitor_data = [
            {
                "name": v.get("name", k),
                "score": float(v.get("score", 0)),
                "exposure_freq": float(v.get("exposure_freq", 0)),
            }
            for k, v in raw_comp.items()
        ] if isinstance(raw_comp, dict) else []

        context = biz.get("business_type") or "location_based"
        generator = GuideGenerator()

        score_data = {
            "total_score": scan.get("total_score", 0),
            "exposure_freq": scan.get("exposure_freq", 0),
            "breakdown": scan.get("score_breakdown", {}),
            "naver_channel_score": scan.get("naver_channel_score"),
            "global_channel_score": scan.get("global_channel_score"),
            "context": context,
            "kakao_result": scan.get("kakao_result"),
            "website_check_result": scan.get("website_check_result"),
            "chatgpt_result": scan.get("chatgpt_result"),
            "naver_result": scan.get("naver_result"),
            "google_result": scan.get("google_result"),
            "perplexity_result": scan.get("perplexity_result"),
            "gemini_result": scan.get("gemini_result"),
        }

        # ActionPlan 생성 (v2.1)
        action_plan = await generator.generate_action_plan(
            biz=biz,
            score_data=score_data,
            competitor_data=competitor_data,
            scan_id=req.scan_id,
            context=context,
            naver_data=None,
            website_health=scan.get("website_check_result"),
        )

        # guides 테이블에 저장 — 새 컬럼(v2.1) 우선 시도, 없으면 레거시 폴백
        base_payload = {
            "business_id": req.business_id,
            "items_json": [item.model_dump() for item in action_plan.items],
            "priority_json": [item.title for item in action_plan.quick_wins],
            "summary": action_plan.summary,
        }
        try:
            await execute(
                supabase.table("guides").insert({
                    **base_payload,
                    "scan_id": req.scan_id,
                    "context": context,
                    "next_month_goal": action_plan.next_month_goal,
                    "tools_json": action_plan.tools.model_dump(),
                })
            )
        except Exception as col_err:
            _logger.warning(
                f"Guide insert with v2.1 columns failed ({col_err}), "
                "falling back to legacy format"
            )
            await execute(supabase.table("guides").insert(base_payload))

    except Exception as e:
        _logger.error(f"Guide generation failed: {e}", exc_info=True)
