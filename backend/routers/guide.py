from fastapi import APIRouter, Header, HTTPException, BackgroundTasks
from models.schemas import GuideRequest
from services.guide_generator import GuideGenerator
from db.supabase_client import get_client, execute

router = APIRouter()


@router.post("/generate")
async def generate_guide(req: GuideRequest, bg: BackgroundTasks):
    """Claude API로 개선 가이드 생성 (비동기 백그라운드)"""
    bg.add_task(_generate_and_save, req)
    return {"status": "generating", "business_id": req.business_id}


@router.get("/{biz_id}/latest")
async def get_latest_guide(biz_id: str):
    """최신 가이드 조회"""
    supabase = get_client()
    result = await execute(
        supabase.table("guides")
        .select("*")
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

    biz = (await execute(supabase.table("businesses").select("*").eq("id", biz_id).single())).data
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")

    scan = (
        await execute(
            supabase.table("scan_results")
            .select("*")
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
    try:
        supabase = get_client()
        biz = (await execute(supabase.table("businesses").select("*").eq("id", req.business_id).single())).data
        scan = (await execute(supabase.table("scan_results").select("*").eq("id", req.scan_id).single())).data
        competitors = (
            await execute(
                supabase.table("competitors")
                .select("*, scan_results(total_score)")
                .eq("business_id", req.business_id)
            )
        ).data

        generator = GuideGenerator()
        score_data = {
            "total_score": scan.get("total_score", 0),
            "breakdown": scan.get("score_breakdown", {}),
        }
        guide = await generator.generate(biz, score_data, competitors)

        await execute(
            supabase.table("guides").insert(
                {
                    "business_id": req.business_id,
                    "items_json": guide.get("priority_items", []),
                    "priority_json": guide.get("quick_wins", []),
                    "summary": guide.get("summary", ""),
                }
            )
        )

    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Guide generation failed: {e}")
