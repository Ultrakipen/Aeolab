"""
창업 패키지 API 라우터
업종·지역 경쟁 강도 분석 + 진입 전략 (startup 플랜 전용)
"""
import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from db.supabase_client import get_client, execute
from middleware.plan_gate import get_current_user
from utils import cache as _cache

_logger = logging.getLogger(__name__)
router = APIRouter()

_TTL_MARKET = 1800  # 시장 현황 캐시: 30분


class StartupReportRequest(BaseModel):
    category: str
    region: str
    business_name: str = ""


@router.post("/report")
async def generate_startup_report(
    req: StartupReportRequest,
    user: dict = Depends(get_current_user),
):
    """창업 패키지 경쟁 분석 리포트 생성 (startup/biz/enterprise 전용)"""
    supabase = get_client()
    sub = (
        await execute(
            supabase.table("subscriptions")
            .select("plan, status")
            .eq("user_id", user["id"])
            .maybe_single()
        )
    ).data
    plan = (sub or {}).get("plan", "free")
    status = (sub or {}).get("status", "inactive")

    if plan not in ("startup", "biz", "enterprise") or status not in ("active", "grace_period"):
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
    cache_key = _cache._make_key("market_overview", category, region)
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

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

    # 평균 점수 계산 — 단일 IN 쿼리로 N+1 제거
    scores: list[float] = []
    if businesses:
        biz_ids = [b["id"] for b in businesses[:20]]
        all_scans = (
            await execute(
                supabase.table("scan_results")
                .select("business_id, total_score")
                .in_("business_id", biz_ids)
                .order("scanned_at", desc=True)
            )
        ).data or []
        # 사업장별 최신 스캔 1건만 집계
        seen: set = set()
        for s in all_scans:
            bid = s.get("business_id")
            if bid not in seen and s.get("total_score") is not None:
                scores.append(s["total_score"])
                seen.add(bid)

    avg_score = round(sum(scores) / len(scores), 1) if scores else 0
    result = {
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
    _cache.set(cache_key, result, _TTL_MARKET)
    return result
