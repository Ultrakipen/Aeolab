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
    """창업 패키지 경쟁 분석 리포트 생성 (startup/biz 전용)"""
    supabase = get_client()
    from middleware.plan_gate import get_user_plan
    plan = await get_user_plan(user["id"], supabase)
    if plan not in ("startup", "biz"):
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "required_plans": ["startup", "biz"]},
        )

    from services.startup_report import StartupReportService
    service = StartupReportService()
    result = await service.generate(req.category, req.region, req.business_name)
    # 창업 타이밍 지수 추가
    try:
        timing_key = f"timing:{req.category}:{req.region}"
        timing_data = _cache.get(timing_key)
        if not timing_data:
            _supabase = get_client()
            biz_res = await execute(
                _supabase.table("businesses")
                .select("id")
                .ilike("category", f"{req.category}%")
                .ilike("region", f"{req.region}%")
                .eq("is_active", True)
            )
            total = len(biz_res.data or [])
            if total == 0:
                timing_data = {"timing": "데이터수집중", "timing_label": "데이터 수집 중", "timing_color": "gray", "reasoning": "등록 데이터가 아직 없습니다.", "opportunity_score": 50}
            elif total < 3:
                timing_data = {"timing": "기회있음", "timing_label": "기회 있음 — 선점 가능", "timing_color": "emerald", "reasoning": f"{req.region} {req.category} 업종 경쟁사가 {total}개로 매우 적어 선점이 유리합니다.", "opportunity_score": 85}
            elif result.get("competition_level") in ("매우 치열", "치열"):
                timing_data = {"timing": "포화", "timing_label": "경쟁 과열 — 차별화 필수", "timing_color": "red", "reasoning": f"{req.region} {req.category} 업종은 경쟁이 치열합니다. 틈새 키워드 전략 없이는 노출이 어렵습니다.", "opportunity_score": 25}
            else:
                timing_data = {"timing": "안정", "timing_label": "안정적 — 꾸준한 성장 가능", "timing_color": "blue", "reasoning": f"{req.region} {req.category} 업종은 안정적인 시장입니다. 꾸준한 관리로 경쟁력을 높일 수 있습니다.", "opportunity_score": 60}
        result["timing"] = timing_data
    except Exception as _e:
        import logging
        logging.getLogger("aeolab.startup").warning(f"timing_data error: {_e}")
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


@router.get("/timing/{category}/{region}")
async def get_timing_index(category: str, region: str):
    """창업 타이밍 지수 — 지역/업종 AI 노출 트렌드 기반 (Startup+)"""
    from db.supabase_client import get_client, execute
    pass  # cache already imported at top level
    from datetime import datetime, timezone, timedelta

    cache_key = f"timing:{category}:{region}"
    cached = _cache.get(cache_key)
    if cached:
        return cached

    supabase = get_client()

    # 해당 업종/지역 사업장 목록
    biz_res = await execute(
        supabase.table("businesses")
        .select("id")
        .ilike("category", f"{category}%")
        .ilike("region", f"{region}%")
        .eq("is_active", True)
    )
    biz_list = biz_res.data or []
    total_count = len(biz_list)

    if total_count == 0:
        result = {
            "category": category, "region": region,
            "timing": "데이터수집중",
            "timing_label": "데이터 수집 중",
            "timing_color": "gray",
            "reasoning": f"{region} {category} 업종의 등록 사업장 데이터가 아직 없습니다. 서비스 이용자가 늘면 더 정확한 분석이 가능합니다.",
            "competitor_count": 0,
            "avg_score": 0,
            "score_trend": 0,
            "opportunity_score": 50,
        }
        _cache.set(cache_key, result, 1800)
        return result

    biz_ids = [b["id"] for b in biz_list]

    # 최근 30일 점수 트렌드
    now = datetime.now(timezone.utc)
    month_ago = (now - timedelta(days=30)).isoformat()
    two_month_ago = (now - timedelta(days=60)).isoformat()

    recent_scores = await execute(
        supabase.table("score_history")
        .select("total_score, score_date")
        .in_("business_id", biz_ids)
        .gte("score_date", month_ago[:10])
        .order("score_date", desc=True)
    )
    old_scores = await execute(
        supabase.table("score_history")
        .select("total_score")
        .in_("business_id", biz_ids)
        .gte("score_date", two_month_ago[:10])
        .lt("score_date", month_ago[:10])
    )

    recent = [r["total_score"] for r in (recent_scores.data or []) if r.get("total_score")]
    old = [r["total_score"] for r in (old_scores.data or []) if r.get("total_score")]

    avg_recent = sum(recent) / len(recent) if recent else 0
    avg_old = sum(old) / len(old) if old else 0
    score_trend = round(avg_recent - avg_old, 1) if (recent and old) else 0

    # 타이밍 판단
    if not recent:
        timing = "데이터수집중"
        timing_label = "데이터 수집 중"
        timing_color = "gray"
        reasoning = f"{region} {category} 업종 데이터가 수집되고 있습니다. 더 정확한 분석을 위해 데이터를 축적 중입니다."
        opportunity = 50
    elif total_count < 3:
        timing = "기회있음"
        timing_label = "기회 있음 — 선점 가능"
        timing_color = "emerald"
        reasoning = f"{region} {category} 업종에 등록된 경쟁 사업장이 {total_count}개로 매우 적습니다. 지금 시작하면 AI 노출을 선점할 수 있습니다."
        opportunity = 85
    elif avg_recent >= 70 and total_count > 10:
        timing = "포화"
        timing_label = "경쟁 과열 — 차별화 필수"
        timing_color = "red"
        reasoning = f"{region} {category} 업종 평균 점수가 {avg_recent:.0f}점으로 높고 경쟁사가 {total_count}개입니다. 틈새 키워드 전략 없이는 생존이 어렵습니다."
        opportunity = 25
    elif score_trend > 3:
        timing = "상승중"
        timing_label = "성장 중 — 지금이 적기"
        timing_color = "blue"
        reasoning = f"{region} {category} 업종 AI 노출 점수가 최근 30일간 {score_trend:+.1f}점 상승 중입니다. 시장이 성장하는 지금 진입하면 유리합니다."
        opportunity = 70
    elif score_trend < -3:
        timing = "쇠퇴"
        timing_label = "하락세 — 신중한 검토 필요"
        timing_color = "amber"
        reasoning = f"{region} {category} 업종 AI 노출 점수가 최근 {score_trend:.1f}점 하락 중입니다. 시장 변화 원인을 파악한 후 진입 여부를 결정하세요."
        opportunity = 35
    else:
        timing = "안정"
        timing_label = "안정적 — 꾸준한 성장 가능"
        timing_color = "blue"
        reasoning = f"{region} {category} 업종은 안정적인 시장입니다. 평균 점수 {avg_recent:.0f}점이며 꾸준한 관리로 경쟁력을 높일 수 있습니다."
        opportunity = 60

    result = {
        "category": category,
        "region": region,
        "timing": timing,
        "timing_label": timing_label,
        "timing_color": timing_color,
        "reasoning": reasoning,
        "competitor_count": total_count,
        "avg_score": round(avg_recent, 1),
        "score_trend": score_trend,
        "opportunity_score": opportunity,
    }
    _cache.set(cache_key, result, 1800)
    return result
