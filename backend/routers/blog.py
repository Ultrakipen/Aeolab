"""
블로그 진단 라우터

POST /api/blog/analyze    — 블로그 URL 분석 실행 (Basic+)
GET  /api/blog/result/{business_id} — 블로그 분석 결과 조회
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from middleware.plan_gate import get_current_user, get_user_plan, PLAN_LIMITS
from db.supabase_client import get_client, execute
from services.blog_analyzer import analyze_blog

# 블로그 분석 전체 작업에 대한 라우터 레벨 타임아웃
# blog_analyzer 내부 HTTP 타임아웃(8초) × 최대 4쿼리 + RSS 병렬 + 파싱 여유 = 35초
_ANALYZE_TIMEOUT_SECONDS = 35

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
    limit = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["blog_monthly"]
    if limit == 0:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "PLAN_REQUIRED",
                "message": "블로그 진단은 Basic 플랜(월 9,900원)부터 이용 가능합니다.",
                "upgrade_url": "/pricing",
            },
        )

    # 사업장 조회 및 소유권 검증 (blog_analyzed_at 포함 — 24h 쿨다운 체크용)
    biz_row = (await execute(
        supabase.table("businesses")
        .select("id, name, category, region, user_id, blog_analyzed_at")
        .eq("id", request.business_id)
        .single()
    )).data
    if not biz_row:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")
    if biz_row["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="접근 권한 없음")

    now_utc = datetime.now(timezone.utc)

    # 24시간 쿨다운 — 블로그가 실시간으로 바뀌지 않으므로 동일 결과 반복 방지
    last_analyzed = biz_row.get("blog_analyzed_at")
    if last_analyzed:
        try:
            last_dt = datetime.fromisoformat(last_analyzed.replace("Z", "+00:00"))
            delta = now_utc - last_dt
            if timedelta(0) < delta < timedelta(hours=24):
                remaining = max(1, 24 - int(delta.total_seconds() // 3600))
                raise HTTPException(
                    status_code=429,
                    detail={
                        "code": "COOLDOWN",
                        "message": f"블로그 진단은 24시간에 1회 가능합니다. {remaining}시간 후 다시 시도해 주세요.",
                    },
                )
        except HTTPException:
            raise
        except Exception as e:
            _logger.warning(f"blog cooldown parse failed for biz={request.business_id}: {e}")

    # 월 사용 횟수 체크 (notifications 테이블, type='blog_analysis')
    if limit < 999:
        month_start = now_utc.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
        used_res = (await execute(
            supabase.table("notifications")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("type", "blog_analysis")
            .gte("sent_at", month_start)
        ))
        used = used_res.count or 0
        if used >= limit:
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "MONTHLY_LIMIT",
                    "message": f"이번 달 블로그 진단 한도({limit}회)에 도달했습니다. Pro 플랜으로 업그레이드하면 월 10회 이용 가능합니다.",
                    "upgrade_url": "/pricing",
                    "used": used,
                    "limit": limit,
                },
            )

    business_name = biz_row.get("name", "")
    category = biz_row.get("category", "restaurant")
    region = biz_row.get("region", "")

    # 블로그 분석 실행
    try:
        analysis = await asyncio.wait_for(
            analyze_blog(
                blog_url=request.blog_url,
                business_name=business_name,
                category=category,
                region=region,
                business_id=request.business_id,
            ),
            timeout=_ANALYZE_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        _logger.warning(f"blog analysis timeout (>{_ANALYZE_TIMEOUT_SECONDS}s) for biz={request.business_id}")
        raise HTTPException(status_code=504, detail="블로그 분석 시간이 초과됐습니다. 잠시 후 다시 시도해 주세요.")
    except Exception as e:
        _logger.warning(f"blog analysis failed for biz={request.business_id}: {e}")
        raise HTTPException(status_code=502, detail="블로그 분석 중 오류가 발생했습니다")

    now_iso = now_utc.isoformat()

    # keyword_coverage 객체 구성 — 프론트엔드가 present/missing 키를 기대함
    keyword_coverage = {
        "present": analysis.get("covered_keywords", []),
        "missing": analysis.get("missing_keywords", []),
        "competitor_only": [],
    }

    # v2: 경쟁사 블로그 비교 데이터 수집
    competitor_blog_comparison = None
    try:
        from services.blog_analyzer import _build_competitor_comparison
        comp_rows = (await execute(
            supabase.table("competitors")
            .select("name, blog_analysis_json")
            .eq("business_id", request.business_id)
        )).data or []
        # blog_analysis_json이 있는 경쟁사만
        comp_with_blog = [c for c in comp_rows if c.get("blog_analysis_json")]
        if comp_with_blog:
            competitor_blog_comparison = _build_competitor_comparison(
                my_score=analysis.get("ai_readiness_score", 0),
                my_post_count=analysis.get("post_count", 0),
                my_freshness=analysis.get("freshness", "outdated"),
                my_keyword_coverage=analysis.get("keyword_coverage", 0),
                competitor_blogs=comp_with_blog,
                my_covered_keywords=analysis.get("covered_keywords", []),
            )
    except Exception as e:
        _logger.warning(f"competitor blog comparison failed: {e}")

    # 반환할 전체 결과 객체 (새로고침·재진입 시 복원용으로도 사용)
    analysis_json = {
        "business_id": request.business_id,
        "blog_url": request.blog_url,
        "post_count": analysis.get("post_count", 0),
        "total_post_count": analysis.get("total_post_count", 0),
        "platform": analysis.get("platform"),
        "citation_score": analysis.get("ai_readiness_score", 0),
        "freshness_score": analysis.get("ai_readiness_score", 0),
        "freshness": analysis.get("freshness"),
        "keyword_coverage": keyword_coverage,
        "missing_keywords": analysis.get("missing_keywords", []),
        "top_recommendation": analysis.get("top_recommendation"),
        # 블로그 콘텐츠 유형 분석 (guide_generator 프롬프트에서 활용)
        "content_type": analysis.get("content_type"),
        "promotional_ratio": analysis.get("promotional_ratio", 0),
        "informational_ratio": analysis.get("informational_ratio", 0),
        "content_issue": analysis.get("content_issue"),
        "title_suggestions": analysis.get("title_suggestions", []),
        # v2 신규 필드
        "posts_detail": analysis.get("posts_detail", []),
        "weekly_actions": analysis.get("weekly_actions", []),
        "competitor_blog_comparison": competitor_blog_comparison,
        # v3 신규 필드
        "posting_frequency": analysis.get("posting_frequency"),
        "best_citation_candidate": analysis.get("best_citation_candidate"),
        "duplicate_topics": analysis.get("duplicate_topics", []),
        "analyzed_at": now_iso,
        "error": analysis.get("error"),
    }

    # 기본 저장 필드 (blog_analysis_json 컬럼이 없어도 동작)
    base_payload: dict = {
        "blog_url": request.blog_url,
        "blog_analyzed_at": now_iso,
        "blog_keyword_coverage": analysis.get("keyword_coverage", 0.0),
        "blog_post_count": analysis.get("post_count", 0),
    }
    latest_date = analysis.get("latest_post_date")
    if latest_date:
        base_payload["blog_latest_post_date"] = latest_date

    # blog_analysis_json 컬럼이 있으면 전체 결과도 저장 (없으면 graceful 생략)
    full_payload = {**base_payload, "blog_analysis_json": analysis_json}

    try:
        await execute(
            supabase.table("businesses")
            .update(full_payload)
            .eq("id", request.business_id)
        )
    except Exception as e:
        err_str = str(e)
        # blog_analysis_json 컬럼 미존재 에러 감지 — 기본 필드만 저장
        if (
            "blog_analysis_json" in err_str
            or "42703" in err_str
            or ("column" in err_str.lower() and "does not exist" in err_str.lower())
        ):
            _logger.info(
                "blog_analysis_json column not found — saving base fields only. "
                "Run SQL to enable full result persistence: "
                "ALTER TABLE businesses ADD COLUMN IF NOT EXISTS blog_analysis_json JSONB;"
            )
            try:
                await execute(
                    supabase.table("businesses")
                    .update(base_payload)
                    .eq("id", request.business_id)
                )
            except Exception as e2:
                _logger.warning(f"blog analysis base DB save failed for biz={request.business_id}: {e2}")
        else:
            _logger.warning(f"blog analysis DB save failed for biz={request.business_id}: {e}")

    # 월 사용 기록 (biz=무제한 포함 모두 기록 — 통계 목적)
    try:
        await execute(
            supabase.table("notifications")
            .insert({
                "user_id": user_id,
                "type": "blog_analysis",
                "channel": "internal",
                "status": "sent",
                "content": {"business_id": request.business_id},
            })
        )
    except Exception as e:
        _logger.warning(f"blog analysis usage log failed: {e}")

    return analysis_json


@router.get("/result/{business_id}")
async def get_blog_result(
    business_id: str,
    user: dict = Depends(get_current_user),
):
    """
    블로그 분석 결과 조회
    - blog_analysis_json JSONB가 있으면 전체 결과 반환 (새로고침·재진입 복원용)
    - 없으면 businesses 테이블의 요약 필드만 반환 (하위호환)
    """
    user_id = user["id"]
    supabase = get_client()

    # blog_analysis_json 컬럼 존재 여부에 따라 SELECT 분기
    # 컬럼이 없는 경우 SELECT에 포함하면 422 에러가 나므로 try/except로 처리
    biz_row = None
    has_json_column = True
    try:
        biz_row = (await execute(
            supabase.table("businesses")
            .select("id, user_id, blog_url, blog_keyword_coverage, blog_post_count, blog_latest_post_date, blog_analyzed_at, blog_analysis_json")
            .eq("id", business_id)
            .single()
        )).data
    except Exception as e:
        err_str = str(e)
        if (
            "blog_analysis_json" in err_str
            or "42703" in err_str
            or ("column" in err_str.lower() and "does not exist" in err_str.lower())
        ):
            has_json_column = False
            # blog_analysis_json 없이 재조회
            try:
                biz_row = (await execute(
                    supabase.table("businesses")
                    .select("id, user_id, blog_url, blog_keyword_coverage, blog_post_count, blog_latest_post_date, blog_analyzed_at")
                    .eq("id", business_id)
                    .single()
                )).data
            except Exception as e2:
                _logger.warning(f"get_blog_result fallback query failed: {e2}")
        else:
            raise

    if not biz_row:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")
    if biz_row["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="접근 권한 없음")

    # blog_analysis_json이 있으면 전체 결과 그대로 반환 (새로고침 후 복원)
    if has_json_column:
        saved_json = biz_row.get("blog_analysis_json")
        if saved_json and isinstance(saved_json, dict):
            return {**saved_json, "has_blog_analysis": True}

    # 하위호환: blog_analysis_json 없는 경우 요약 필드만 반환
    return {
        "business_id": business_id,
        "blog_url": biz_row.get("blog_url"),
        "blog_keyword_coverage": biz_row.get("blog_keyword_coverage"),
        "blog_post_count": biz_row.get("blog_post_count"),
        "blog_latest_post_date": biz_row.get("blog_latest_post_date"),
        "blog_analyzed_at": biz_row.get("blog_analyzed_at"),
        "has_blog_analysis": biz_row.get("blog_analyzed_at") is not None,
    }
