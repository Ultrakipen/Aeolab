"""
블로그 진단 라우터

POST /api/blog/analyze    — 블로그 URL 분석 실행 (Basic+)
GET  /api/blog/result/{business_id} — 블로그 분석 결과 조회
"""
import asyncio
import logging
import os
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from middleware.plan_gate import get_current_user, get_user_plan, PLAN_LIMITS
from db.supabase_client import get_client, execute
from services.blog_analyzer import analyze_blog
from utils import cache as _cache

# 블로그 분석 전체 작업에 대한 라우터 레벨 타임아웃
# blog_analyzer 내부 호출은 직렬(RSS 8초 + 실패 시 재시도 5초) + API 쿼리 최대 4개(각 8초) 순차 실행
# = 최악의 경우 8+5+32=45초. 여유분 포함 50초로 설정 (2026-07-06 재점검: 기존 35초는
# RSS 재시도 추가 전에도 이미 40초로 예산을 초과하고 있었음 — 독립 코드리뷰로 발견)
_ANALYZE_TIMEOUT_SECONDS = 50

router = APIRouter()
_logger = logging.getLogger("aeolab")

# 동시 사용자 증가 대응(2026-07-15, schema.py 55055b9와 동일 패턴) — 이 엔드포인트는
# 월별 한도 체크(COUNT 스냅샷)가 최대 50초 걸리는 실제 네이버 RSS/API·SearchAd 호출
# 완료 후에나 소비되는 TOCTOU 구조였고, biz/enterprise(blog_monthly=999)는 24시간
# 쿨다운도 건너뛰어 어떤 요청속도 제한도 없었다(guide.py M2가 고친 것과 동일한 취약 계열).
# 네이버 쪽 서버 단일 IP에서 나가는 요청이라 동시 다발 호출은 봇 탐지·차단 리스크도 키운다
# (docs/naver_scraping_legal_risk_assessment_v1.0.md 참조) — 요청속도 제한 + 중복생성 락으로 보강.
_blog_analysis_locks: set[str] = set()
_BLOG_RATE_LIMIT = 3
_BLOG_RATE_WINDOW = 60  # seconds

# 전역 동시성 상한(2026-07-15 신설) — 위 두 장치는 "한 사용자의 남용"만 막을 뿐,
# 서로 다른 여러 사용자가 동시에 분석을 실행하면 서버 단일 IP에서 네이버로 나가는
# 요청이 그만큼 겹쳐 나간다. Playwright 스캐너의 PLAYWRIGHT_SEMAPHORE와 동일한 이유로
# 전역 상한을 둔다 — 서버 사양 업그레이드 시 환경변수로 상향 가능하도록 분리.
_BLOG_ANALYZE_MAX_CONCURRENCY = int(os.getenv("BLOG_ANALYZE_MAX_CONCURRENCY", "3"))
_blog_analyze_semaphore = asyncio.Semaphore(_BLOG_ANALYZE_MAX_CONCURRENCY)

# 세마포어 대기열 상한(2026-07-15 신설) — 세마포어 획득 자체는 원래 무제한 대기라
# 동시 요청이 몰리면 뒷사람이 nginx proxy_read_timeout(60s)까지 대기하다 원인불명
# 502/504로 실패함. 대기 8s + 실행 50s(_ANALYZE_TIMEOUT_SECONDS)로 nginx 60s 안에
# 항상 친절한 오류를 먼저 반환하도록 예산 분리.
_BLOG_ANALYZE_QUEUE_TIMEOUT_SEC = float(os.getenv("BLOG_ANALYZE_QUEUE_TIMEOUT_SEC", "8"))


async def _fetch_multi_channel_citations(business_id: str, supabase) -> dict:
    """최근 3회 스캔의 platform별 AI 인용 통계. 신규 AI 호출 없음 — ai_citations SELECT만.

    반환 형식:
    {"gemini": {"mentioned_count": 2, "total": 3}, "chatgpt": {...}, ...}
    """
    try:
        # 최근 3 scan_results ID 조회
        scan_res = (await execute(
            supabase.table("scan_results")
            .select("id")
            .eq("business_id", business_id)
            .order("scanned_at", desc=True)
            .limit(3)
        )).data or []
        if not scan_res:
            return {}

        scan_ids = [r["id"] for r in scan_res]
        cit_res = (await execute(
            supabase.table("ai_citations")
            .select("platform, mentioned")
            .in_("scan_id", scan_ids)
        )).data or []

        result: dict[str, dict] = {}
        for c in cit_res:
            p = c.get("platform") or "unknown"
            if p not in result:
                result[p] = {"mentioned_count": 0, "total": 0}
            result[p]["total"] += 1
            if c.get("mentioned"):
                result[p]["mentioned_count"] += 1
        return result
    except Exception as e:
        _logger.warning(f"multi_channel_citations 조회 실패 [biz={business_id}]: {e}")
        return {}


async def _fetch_competitor_blog_mentions(business_id: str, supabase) -> dict:
    """내 사업장 + 경쟁사 블로그 언급 수 벤치마크. 신규 API 호출 없음 — 기존 컬럼 SELECT만.

    반환 형식:
    {"my_count": 42, "competitors": [{"name": "라포뮤직", "blog_mention_count": 296}], "avg_count": 169.0}
    """
    try:
        biz_res = (await execute(
            supabase.table("businesses")
            .select("blog_mention_count")
            .eq("id", business_id)
            .single()
        )).data
        my_count = int((biz_res or {}).get("blog_mention_count") or 0)

        comp_res = (await execute(
            supabase.table("competitors")
            .select("name, blog_mention_count")
            .eq("business_id", business_id)
        )).data or []

        competitors = [
            {
                "name": c.get("name") or "경쟁사",
                "blog_mention_count": int(c.get("blog_mention_count") or 0),
            }
            for c in comp_res
        ]
        all_counts = [my_count] + [c["blog_mention_count"] for c in competitors]
        avg_count = round(sum(all_counts) / max(len(all_counts), 1), 1)
        return {
            "my_count": my_count,
            "competitors": competitors,
            "avg_count": avg_count,
        }
    except Exception as e:
        _logger.warning(f"competitor_blog_mentions 조회 실패 [biz={business_id}]: {e}")
        return {}


def _check_blog_rate_limit(user_id: str) -> None:
    key = f"blog_analyze_rate:{user_id}"
    count: int = _cache.get(key) or 0
    if count >= _BLOG_RATE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "RATE_LIMIT",
                "message": "잠시 후 다시 시도해 주세요 (분당 3회 제한).",
                "retry_after": _BLOG_RATE_WINDOW,
            },
        )
    _cache.set(key, count + 1, _BLOG_RATE_WINDOW)


async def _get_monthly_blog_count(user_id: str, supabase) -> int:
    """이번 달 블로그 분석 사용 횟수 조회 (notifications.sent_at 기준 UTC)"""
    today = datetime.now(timezone.utc)
    month_start = f"{today.year:04d}-{today.month:02d}-01"
    try:
        res = await execute(
            supabase.table("notifications")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .eq("type", "blog_analysis")
            .gte("sent_at", month_start)
        )
        return res.count or 0
    except Exception as e:
        _logger.warning(f"monthly blog count query failed for user={user_id}: {e}")
        return 0


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

    # 0. 요청속도 제한 — DB 조회 전에 먼저 차단 (모든 플랜 공통, biz/enterprise도 예외 없음)
    _check_blog_rate_limit(user_id)

    # 0-1. 동시 중복 분석 방지 — 같은 사용자가 이전 요청 처리 중(최대 50초) 새 요청을 보내면
    # 월별 한도 COUNT 체크가 TOCTOU 레이스로 여러 번 통과할 수 있었음(guide.py M2와 동일 패턴)
    if user_id in _blog_analysis_locks:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "BLOG_ANALYSIS_IN_PROGRESS",
                "message": "이미 블로그 분석이 진행 중입니다. 완료 후 다시 시도해 주세요.",
            },
        )
    _blog_analysis_locks.add(user_id)

    supabase = get_client()

    try:
        return await _run_blog_analysis(request, user_id, supabase)
    finally:
        _blog_analysis_locks.discard(user_id)


async def _run_blog_analysis(request: BlogAnalyzeRequest, user_id: str, supabase) -> dict:
    # 플랜 체크 (basic 이상)
    plan = await get_user_plan(user_id, supabase)
    limit = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["blog_monthly"]
    if limit == 0:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "PLAN_REQUIRED",
                "message": "블로그 진단은 Basic 플랜(월 11,900원)부터 이용 가능합니다.",
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

    # 월별 사용량 체크 (free 이외 플랜: basic=3, pro=10, startup=5)
    monthly_used = 0
    if limit < 999:
        monthly_used = await _get_monthly_blog_count(user_id, supabase)
        if monthly_used >= limit:
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "MONTHLY_LIMIT_REACHED",
                    "message": f"이번 달 블로그 분석 횟수({limit}회)를 모두 사용했습니다.",
                    "monthly_used": monthly_used,
                    "monthly_limit": limit,
                    "upgrade_url": "/pricing",
                },
            )

    # 24시간 쿨다운 — 사업장별 마지막 분석 시각 기준
    last_analyzed = biz_row.get("blog_analyzed_at")
    if last_analyzed and limit < 999:
        last_dt = datetime.fromisoformat(last_analyzed.replace("Z", "+00:00"))
        elapsed = now_utc - last_dt
        if elapsed < timedelta(hours=24):
            remaining_h = 24 - int(elapsed.total_seconds() / 3600)
            raise HTTPException(
                status_code=429,
                detail=f"블로그 분석은 24시간에 1회 가능합니다. 약 {remaining_h}시간 후 다시 시도해 주세요.",
            )

    business_name = biz_row.get("name", "")
    category = biz_row.get("category", "restaurant")
    region = biz_row.get("region", "")

    # 블로그 분석 실행 — 전역 세마포어로 서버가 네이버에 동시에 내보내는 요청 수 자체를 제한
    # 세마포어 획득도 대기열 타임아웃 적용 — 무제한 대기 시 nginx 타임아웃에 걸려
    # 원인불명 오류로 실패하는 문제 방지(2026-07-15)
    try:
        await asyncio.wait_for(_blog_analyze_semaphore.acquire(), timeout=_BLOG_ANALYZE_QUEUE_TIMEOUT_SEC)
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
        finally:
            _blog_analyze_semaphore.release()
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

    # v2: 경쟁사 블로그 비교 데이터 수집 (C. competitor_keyword_detail 포함)
    competitor_blog_comparison = None
    try:
        from services.blog_analyzer import _build_competitor_comparison
        # comp_keywords: TEXT[] — C. 봉쇄 원인 분석에서 blog 데이터 없는 경쟁사 보완 소스
        comp_rows = (await execute(
            supabase.table("competitors")
            .select("name, blog_analysis_json, comp_keywords")
            .eq("business_id", request.business_id)
        )).data or []
        # blog_analysis_json이 있는 경쟁사만 점수 비교에 사용
        comp_with_blog = [c for c in comp_rows if c.get("blog_analysis_json")]
        if comp_with_blog:
            competitor_blog_comparison = _build_competitor_comparison(
                my_score=analysis.get("ai_readiness_score", 0),
                my_post_count=analysis.get("post_count", 0),
                my_freshness=analysis.get("freshness", "outdated"),
                my_keyword_coverage=analysis.get("keyword_coverage", 0),
                competitor_blogs=comp_with_blog,
                my_covered_keywords=analysis.get("covered_keywords", []),
                # C: comp_keywords — 전체 경쟁사 대상(blog 데이터 없는 경쟁사도 포함)
                competitor_comp_keywords=[
                    {"name": c.get("name"), "comp_keywords": c.get("comp_keywords") or []}
                    for c in comp_rows
                ],
            )
    except Exception as e:
        _logger.warning(f"competitor blog comparison failed: {e}")

    # 이번 달 블로그 주제 추천 (경쟁사 갭 + 업종 미커버 키워드 기반, API 호출 없음)
    topic_suggestions_v2: list[dict] = []
    try:
        from services.blog_analyzer import _generate_topic_suggestions
        comp_kw_gaps = (
            competitor_blog_comparison.get("competitor_keyword_gaps", [])
            if competitor_blog_comparison
            else []
        )
        topic_suggestions_v2 = _generate_topic_suggestions(
            missing_keywords=analysis.get("missing_keywords", []),
            competitor_keyword_gaps=comp_kw_gaps,
            region=biz_row.get("region", ""),
            category=biz_row.get("category", ""),
            covered_keywords=analysis.get("covered_keywords", []),
        )
    except Exception as e:
        _logger.warning(f"topic suggestions generation failed for biz={request.business_id}: {e}")

    # 소재 추천에 실제 월간 검색량 병합 (base_keyword 기준 조회, 표시는 topic 문구 유지)
    if topic_suggestions_v2:
        try:
            from services.naver_searchad import get_searchad_client
            base_keywords = [
                t["base_keyword"] for t in topic_suggestions_v2 if t.get("base_keyword")
            ]
            ad_client = get_searchad_client()
            volumes = await ad_client.get_volumes_with_cache(
                base_keywords, biz_row.get("category", ""), supabase
            )
            for t in topic_suggestions_v2:
                vol = volumes.get(t.get("base_keyword"))
                t["monthly_volume"] = vol.get("monthly_total") if vol else None
                t["competition"] = vol.get("competition") if vol else None
            # 검색량 내림차순 정렬(None은 맨 뒤), 단 competitor_gap(high) 우선순위는 유지
            topic_suggestions_v2.sort(
                key=lambda t: (t.get("priority") != "high", -(t.get("monthly_volume") or -1))
            )
        except Exception as e:
            _logger.warning(f"topic suggestions 검색량 병합 실패: {e}")

    # 반환할 전체 결과 객체 (새로고침·재진입 시 복원용으로도 사용)
    analysis_json = {
        "business_id": request.business_id,
        "blog_url": request.blog_url,
        "post_count": analysis.get("post_count", 0),
        "total_post_count": analysis.get("total_post_count", 0),
        # 티스토리 등 외부 블로그는 단일 페이지 추정치 — 네이버(API 정확 카운트)와 구분 표시 필요
        "is_post_count_estimated": bool(analysis.get("is_post_count_estimated", False)),
        "platform": analysis.get("platform"),
        "citation_score": analysis.get("ai_readiness_score", 0),
        # freshness_score: freshness 문자열 → 숫자 변환 (ai_readiness_score와 혼용 금지)
        "freshness_score": {"fresh": 80, "stale": 50, "outdated": 20}.get(
            analysis.get("freshness", "outdated"), 50
        ),
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
        "templated_content": analysis.get("templated_content", []),
        "ai_readiness_items": analysis.get("ai_readiness_items", []),
        # v2: 이번 달 블로그 주제 추천
        "topic_suggestions_v2": topic_suggestions_v2,
        # RSS 실패(재시도 포함)로 API 스니펫만으로 분석됨 — 이미지/본문 길이 측정치가
        # 평소보다 제한적일 수 있음을 프론트에서 안내하는 데 사용 (2026-07-06 재점검 신설)
        "rss_failed": bool(analysis.get("rss_failed", False)),
        "analyzed_at": now_iso,
        "error": analysis.get("error"),
        # 월 사용량 — 실패 시 소비하지 않으므로 +1 하지 않음
        "monthly_used": monthly_used if analysis.get("error") else monthly_used + 1,
        "monthly_limit": limit,
        # A~D 기본값 — 아래 블록에서 실제 값으로 덮어씀 (실패해도 키 존재 보장)
        "multi_channel_citations": {},
        "competitor_blog_mentions": {},
    }

    # A. 포스트별 실측 인용 여부 매핑
    # naver platform ai_citations에서 source_url IS NOT NULL 레코드만 조회.
    # 과거 스캔 데이터(source_url=NULL)는 제외 — cited 셋이 비면 전부 is_cited=False 반환.
    try:
        from services.blog_analyzer import _annotate_posts_with_citations
        cit_src_res = (await execute(
            supabase.table("ai_citations")
            .select("source_url, source_blog_id")
            .eq("business_id", request.business_id)
            .eq("platform", "naver")
            .not_.is_("source_url", "null")
        )).data or []
        cited_urls: set[str] = {
            (r.get("source_url") or "").split("?")[0].replace("//m.blog.naver.com/", "//blog.naver.com/")
            for r in cit_src_res
            if r.get("source_url")
        }
        cited_blog_ids: set[str] = {
            r["source_blog_id"] for r in cit_src_res if r.get("source_blog_id")
        }
        analysis_json["posts_detail"] = _annotate_posts_with_citations(
            analysis_json.get("posts_detail", []),
            cited_urls,
            cited_blog_ids,
        )
    except Exception as _e:
        _logger.warning(f"post citation annotation 실패 [biz={request.business_id}]: {_e}")

    # B. 5채널 AI 인용 영향 대시보드
    try:
        analysis_json["multi_channel_citations"] = await _fetch_multi_channel_citations(
            request.business_id, supabase
        )
    except Exception as _e:
        _logger.warning(f"multi_channel_citations 추가 실패 [biz={request.business_id}]: {_e}")

    # D. 블로그 언급 수 벤치마크
    try:
        analysis_json["competitor_blog_mentions"] = await _fetch_competitor_blog_mentions(
            request.business_id, supabase
        )
    except Exception as _e:
        _logger.warning(f"competitor_blog_mentions 추가 실패 [biz={request.business_id}]: {_e}")

    # 분석이 실패한 경우(크롤링/API 오류 등) — 기존에 저장된 실제 값을 0으로 덮어쓰지 않고,
    # 24시간 쿨다운·월 사용량도 소비시키지 않는다 (우리 쪽 오류로 사용자에게 불이익 금지)
    _analysis_failed = bool(analysis.get("error"))
    if _analysis_failed:
        _logger.warning(
            f"blog analysis returned error for biz={request.business_id}: {analysis.get('error')} "
            "— DB 저장·사용량 차감 생략"
        )
        return analysis_json

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

    # 월 사용 기록 (biz=무제한 포함 모두 기록 — 통계 목적, 실측 성공 시에만)
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

    # blog_score_history upsert — 성공 경로에서만 실행 (_analysis_failed 얼리 리턴으로 보장)
    try:
        await execute(
            supabase.table("blog_score_history")
            .upsert({
                "business_id": request.business_id,
                "analyzed_date": datetime.now(timezone.utc).date().isoformat(),
                "citation_score": analysis.get("ai_readiness_score", 0),
                "keyword_coverage": analysis.get("keyword_coverage", 0.0),
                "post_count": analysis.get("post_count", 0),
                "freshness": analysis.get("freshness", "outdated"),
            }, on_conflict="business_id,analyzed_date")
        )
    except Exception as e:
        _logger.warning(f"blog_score_history upsert 실패 [biz={request.business_id}]: {e}")

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

    # 플랜 + 월 사용량 조회 (모든 경로에 포함)
    plan = await get_user_plan(user_id, supabase)
    limit = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["blog_monthly"]
    monthly_used = await _get_monthly_blog_count(user_id, supabase) if limit < 999 else 0

    # blog_analysis_json이 있으면 전체 결과 반환 (새로고침 후 복원)
    # B, D는 ai_citations·competitors 데이터가 스캔마다 업데이트되므로 매 조회 시 신선하게 갱신
    if has_json_column:
        saved_json = biz_row.get("blog_analysis_json")
        if saved_json and isinstance(saved_json, dict):
            live_multi_channel: dict = {}
            live_blog_mentions: dict = {}
            try:
                live_multi_channel = await _fetch_multi_channel_citations(business_id, supabase)
            except Exception as _e:
                _logger.warning(f"get_blog_result multi_channel 조회 실패: {_e}")
            try:
                live_blog_mentions = await _fetch_competitor_blog_mentions(business_id, supabase)
            except Exception as _e:
                _logger.warning(f"get_blog_result blog_mentions 조회 실패: {_e}")
            return {
                **saved_json,
                "multi_channel_citations": live_multi_channel,  # B: 최신 데이터로 갱신
                "competitor_blog_mentions": live_blog_mentions,  # D: 최신 데이터로 갱신
                "has_blog_analysis": True,
                "monthly_used": monthly_used,
                "monthly_limit": limit,
            }

    # 하위호환: blog_analysis_json 없는 경우 요약 필드만 반환
    return {
        "business_id": business_id,
        "blog_url": biz_row.get("blog_url"),
        "blog_keyword_coverage": biz_row.get("blog_keyword_coverage"),
        "blog_post_count": biz_row.get("blog_post_count"),
        "blog_latest_post_date": biz_row.get("blog_latest_post_date"),
        "blog_analyzed_at": biz_row.get("blog_analyzed_at"),
        "has_blog_analysis": biz_row.get("blog_analyzed_at") is not None,
        "monthly_used": monthly_used,
        "monthly_limit": limit,
    }


@router.get("/score-history/{business_id}")
async def get_blog_score_history(
    business_id: str,
    user: dict = Depends(get_current_user),
):
    """블로그 진단 점수 30일 추세 (Basic+)"""
    user_id = user["id"]
    supabase = get_client()

    biz_row = (await execute(
        supabase.table("businesses").select("id, user_id").eq("id", business_id).single()
    )).data
    if not biz_row:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")
    if biz_row["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="접근 권한 없음")

    plan = await get_user_plan(user_id, supabase)
    if PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["blog_monthly"] == 0:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "PLAN_REQUIRED",
                "message": "블로그 진단은 Basic 플랜부터 이용 가능합니다.",
                "upgrade_url": "/pricing",
            },
        )

    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).date().isoformat()
    try:
        rows = (await execute(
            supabase.table("blog_score_history")
            .select("analyzed_date, citation_score, keyword_coverage, post_count, freshness")
            .eq("business_id", business_id)
            .gte("analyzed_date", cutoff)
            .order("analyzed_date")
        )).data or []
    except Exception as e:
        _logger.warning(f"blog_score_history 조회 실패 [biz={business_id}]: {e}")
        rows = []

    return {"business_id": business_id, "history": rows}
