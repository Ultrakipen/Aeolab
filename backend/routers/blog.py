"""
블로그 진단 라우터

POST /api/blog/analyze    — 블로그 URL 분석 실행 (Basic+)
GET  /api/blog/result/{business_id} — 블로그 분석 결과 조회
"""
import asyncio
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from middleware.plan_gate import get_current_user, get_user_plan, PLAN_LIMITS
from db.supabase_client import get_client, execute
from services.blog_analyzer import analyze_blog

# 블로그 분석 전체 작업에 대한 라우터 레벨 타임아웃
# blog_analyzer 내부 HTTP 타임아웃(8초) × 최대 2회 + 파싱 여유 = 25초
_ANALYZE_TIMEOUT_SECONDS = 25

router = APIRouter()
_logger = logging.getLogger("aeolab")


class BlogAnalyzeRequest(BaseModel):
    business_id: str = Field(..., description="사업장 ID")
    blog_url: str = Field(..., max_length=300, description="블로그 URL")


@router.post("/analyze")
async def analyze_blog_endpoint(
    request: BlogAnalyzeRequest,
    user: dict = Depends(get_current_user),
):
    """
    블로그 URL 분석 실행 (Basic+)
    - 네이버 블로그: 네이버 검색 API 사용 (직접 크롤링 금지)
    - 외부 블로그(티스토리/워드프레스): aiohttp 파싱
    - 분석 결과를 businesses 테이블에 저장
    """
    user_id = user["id"]
    supabase = get_client()

    # 플랜 체크 (basic 이상)
    plan = await get_user_plan(user_id, supabase)
    if not PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["schema"]:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "PLAN_REQUIRED",
                "message": "블로그 진단은 Basic 플랜(월 9,900원)부터 이용 가능합니다.",
                "upgrade_url": "/pricing",
            },
        )

    # 사업장 조회 및 소유권 검증
    biz_row = (await execute(
        supabase.table("businesses")
        .select("id, name, category, region, user_id")
        .eq("id", request.business_id)
        .single()
    )).data
    if not biz_row:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")
    if biz_row["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="접근 권한 없음")

    business_name = biz_row.get("name", "")
    category = biz_row.get("category", "restaurant")
    region = biz_row.get("region", "")

    # 블로그 분석 실행 (라우터 레벨 타임아웃 25초 — 내부 HTTP 타임아웃 8초 × 2 + 파싱 여유)
    try:
        analysis = await asyncio.wait_for(
            analyze_blog(
                blog_url=request.blog_url,
                business_name=business_name,
                category=category,
                region=region,
            ),
            timeout=_ANALYZE_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        _logger.warning(f"blog analysis timeout (>{_ANALYZE_TIMEOUT_SECONDS}s) for biz={request.business_id}")
        raise HTTPException(status_code=504, detail="블로그 분석 시간이 초과됐습니다. 잠시 후 다시 시도해 주세요.")
    except Exception as e:
        _logger.warning(f"blog analysis failed for biz={request.business_id}: {e}")
        raise HTTPException(status_code=502, detail="블로그 분석 중 오류가 발생했습니다")

    # 분석 결과를 businesses 테이블에 저장
    now_iso = datetime.now(timezone.utc).isoformat()
    update_payload: dict = {
        "blog_url": request.blog_url,
        "blog_analyzed_at": now_iso,
        "blog_keyword_coverage": analysis.get("keyword_coverage", 0.0),
        "blog_post_count": analysis.get("post_count", 0),
    }
    latest_date = analysis.get("latest_post_date")
    if latest_date:
        update_payload["blog_latest_post_date"] = latest_date

    try:
        await execute(
            supabase.table("businesses")
            .update(update_payload)
            .eq("id", request.business_id)
        )
    except Exception as e:
        # DB 저장 실패 시 결과는 그대로 반환 (분석 결과는 유효)
        _logger.warning(f"blog analysis DB save failed for biz={request.business_id}: {e}")

    return {
        "business_id": request.business_id,
        "blog_url": request.blog_url,
        **analysis,
    }


@router.get("/result/{business_id}")
async def get_blog_result(
    business_id: str,
    user: dict = Depends(get_current_user),
):
    """
    블로그 분석 결과 조회
    - businesses 테이블의 blog_url, blog_keyword_coverage, blog_analyzed_at 등 반환
    """
    user_id = user["id"]
    supabase = get_client()

    biz_row = (await execute(
        supabase.table("businesses")
        .select("id, name, category, region, user_id, blog_url, blog_keyword_coverage, blog_post_count, blog_latest_post_date, blog_analyzed_at")
        .eq("id", business_id)
        .single()
    )).data

    if not biz_row:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")
    if biz_row["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="접근 권한 없음")

    return {
        "business_id": business_id,
        "blog_url": biz_row.get("blog_url"),
        "blog_keyword_coverage": biz_row.get("blog_keyword_coverage"),
        "blog_post_count": biz_row.get("blog_post_count"),
        "blog_latest_post_date": biz_row.get("blog_latest_post_date"),
        "blog_analyzed_at": biz_row.get("blog_analyzed_at"),
        "has_blog_analysis": biz_row.get("blog_analyzed_at") is not None,
    }
