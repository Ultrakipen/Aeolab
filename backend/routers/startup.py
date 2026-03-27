"""
창업 패키지 API 라우터
업종·지역 경쟁 강도 분석 + 진입 전략 (startup 플랜 전용)
"""
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from db.supabase_client import get_client, execute

router = APIRouter()

PLAN_RANK = {"free": 0, "basic": 1, "pro": 2, "startup": 2, "biz": 3, "enterprise": 4}


class StartupReportRequest(BaseModel):
    category: str
    region: str
    business_name: str = ""


@router.post("/report")
async def generate_startup_report(req: StartupReportRequest, x_user_id: str = Header(...)):
    """창업 패키지 경쟁 분석 리포트 생성 (startup/biz/enterprise 전용)"""
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

    if plan not in ("startup", "biz", "enterprise") or status != "active":
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "required_plans": ["startup", "biz", "enterprise"]},
        )

    from services.startup_report import StartupReportService
    service = StartupReportService()
    result = await service.generate(req.category, req.region, req.business_name)
    return result


@router.get("/market/{category}/{region}")
async def get_market_overview(category: str, region: str):
    """업종·지역 시장 현황 요약 (무료 공개 — 상세 전략은 startup 전용)"""
    supabase = get_client()
    businesses = (
        await execute(
            supabase.table("businesses")
            .select("id")
            .eq("category", category)
            .eq("region", region)
            .eq("is_active", True)
        )
    ).data or []
    count = len(businesses)

    # 평균 점수 계산
    scores = []
    for biz in businesses[:20]:
        scan = (
            await execute(
                supabase.table("scan_results")
                .select("total_score")
                .eq("business_id", biz["id"])
                .order("scanned_at", desc=True)
                .limit(1)
            )
        ).data
        if scan:
            scores.append(scan[0]["total_score"])

    avg_score = round(sum(scores) / len(scores), 1) if scores else 0
    return {
        "category": category,
        "region": region,
        "competitor_count": count,
        "avg_score": avg_score,
        "competition_level": (
            "매우 치열" if avg_score >= 70 else
            "치열" if avg_score >= 55 else
            "보통" if avg_score >= 40 else
            "기회 있음"
        ),
    }
