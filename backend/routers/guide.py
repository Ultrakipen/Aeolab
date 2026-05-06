"""
가이드 생성 라우터
도메인 모델 v2.1 Phase D: ActionPlan 타입 반환
"""
import logging
from fastapi import APIRouter, Body, Header, HTTPException, BackgroundTasks, Depends
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
    월별 생성 한도: Basic 3회 / Startup 5회 / Pro 10회 / Biz 20회 / Enterprise 무제한
    """
    from middleware.plan_gate import check_guide_limit, is_basic_trial_user
    supabase = get_client()

    # 소유권 검증 — 타인 business_id로 가이드 생성 우회 방지
    await _verify_biz_ownership(supabase, req.business_id, current_user["id"])

    # Basic 체험 사용자: 체험 대상 사업장에 한해 1회 가이드 생성 허용
    if await is_basic_trial_user(current_user["id"], supabase):
        prof = await execute(
            supabase.table("profiles")
            .select("basic_trial_business_id")
            .eq("user_id", current_user["id"])
            .maybe_single()
        )
        trial_biz_id = (prof.data or {}).get("basic_trial_business_id") if (prof and prof.data) else None
        if trial_biz_id != req.business_id:
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "PLAN_REQUIRED",
                    "message": "무료 체험은 체험 스캔한 사업장에만 가이드를 생성할 수 있습니다.",
                    "upgrade_url": "/pricing",
                },
            )
        # 체험 기간 중 해당 사업장 가이드 존재 여부 확인 (1회 제한)
        existing = await execute(
            supabase.table("guides")
            .select("id")
            .eq("business_id", req.business_id)
            .limit(1)
        )
        if existing and existing.data:
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "BASIC_TRIAL_GUIDE_USED",
                    "message": "무료 체험 가이드는 1회만 생성 가능합니다. 구독 후 이용하세요.",
                    "upgrade_url": "/pricing",
                },
            )
        bg.add_task(_generate_and_save, req)
        return {"status": "generating", "business_id": req.business_id, "trial": True}

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
    result = await execute(
        supabase.table("guides")
        .select("id, business_id, items_json, priority_json, summary, checklist_done, generated_at, context, next_month_goal, tools_json")
        .eq("business_id", biz_id)
        .order("generated_at", desc=True)
        .limit(1)
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="No guide found")
    row = result.data[0]
    row.setdefault("checklist_done", {})
    row.setdefault("context", None)
    row.setdefault("next_month_goal", None)
    row.setdefault("tools_json", None)
    return row


class ReviewReplyRequest(BaseModel):
    business_id: str
    review_text: str


@router.post("/review-reply")
async def generate_review_reply(
    req: ReviewReplyRequest,
    current_user: dict = Depends(get_current_user),
):
    """리뷰 답변 초안 생성 (Claude Haiku, Basic+ 전용).

    월별 한도: Basic 10회 / Startup 20회, Pro 50회, Biz/Enterprise 무제한
    """
    from middleware.plan_gate import check_review_reply_limit
    supabase = get_client()

    # 1. 소유권 검증 먼저
    await _verify_biz_ownership(supabase, req.business_id, current_user["id"])

    # 2. 플랜 체크 (free 플랜이면 403)
    sub = (await execute(
        supabase.table("subscriptions")
        .select("plan, status")
        .eq("user_id", current_user["id"])
        .maybe_single()
    )).data
    _plan = (sub or {}).get("plan", "free")
    _status = (sub or {}).get("status", "inactive")
    if _plan == "free" or _status not in ("active", "grace_period"):
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "required_plans": ["basic", "pro", "biz"]},
        )

    # 3. 월별 한도 체크
    allowed, used, limit = await check_review_reply_limit(current_user["id"], supabase)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "REVIEW_REPLY_LIMIT_EXCEEDED",
                "used": used,
                "limit": limit,
                "message": f"이번 달 리뷰 답변 생성 한도({limit}회)를 초과했습니다.",
                "upgrade_url": "/pricing",
            },
        )

    biz = (await execute(
        supabase.table("businesses")
        .select("name, category, keywords")
        .eq("id", req.business_id).single()
    )).data
    if not biz:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")

    reply_draft, sentiment = await _generate_reply(biz, req.review_text)

    # 저장
    try:
        await execute(
            supabase.table("review_replies").insert({
                "business_id": req.business_id,
                "review_text": req.review_text,
                "reply_draft": reply_draft,
                "sentiment": sentiment,
                "keywords_used": biz.get("keywords") or [],
            })
        )
    except Exception as e:
        err_str = str(e)
        if "sentiment" in err_str and "does not exist" in err_str:
            # sentiment 컬럼 미적용 DB 환경 fallback
            _logger.warning("review_replies.sentiment 컬럼 미적용 — sentiment 제외 저장 (마이그레이션 필요)")
            await execute(
                supabase.table("review_replies").insert({
                    "business_id": req.business_id,
                    "review_text": req.review_text,
                    "reply_draft": reply_draft,
                    "keywords_used": biz.get("keywords") or [],
                })
            )
        else:
            raise

    return {
        "reply_draft": reply_draft,
        "sentiment": sentiment,
        "used": used + 1,
        "limit": limit,
    }


async def _generate_reply(biz: dict, review_text: str) -> tuple[str, str]:
    """Claude Haiku로 감정 분류 + 답변 초안 생성"""
    import anthropic
    import os

    client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))
    keywords = ", ".join((biz.get("keywords") or [])[:5])
    category = biz.get("category", "")
    biz_name = biz.get("name", "저희 가게")

    prompt = f"""당신은 한국 소상공인({biz_name}, 업종: {category})의 고객 리뷰 답변을 작성하는 전문가입니다.
주요 키워드: {keywords}

다음 리뷰에 대해 두 가지를 응답하세요.
1. sentiment: "positive"(긍정), "negative"(부정), "neutral"(일반) 중 하나만
2. reply: 50~80자 사이의 진심 어린 답변 (업종 키워드 자연스럽게 포함, 네이버 정책상 혜택 제공 문구 금지)

형식:
sentiment: <값>
reply: <답변 내용>

리뷰: {review_text[:300]}"""

    try:
        msg = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            messages=[{"role": "user", "content": prompt}],
        )
        text = msg.content[0].text.strip()
        sentiment = "neutral"
        reply = ""
        for line in text.splitlines():
            if line.lower().startswith("sentiment:"):
                raw = line.split(":", 1)[1].strip().lower()
                if raw in ("positive", "negative", "neutral"):
                    sentiment = raw
            elif line.lower().startswith("reply:"):
                reply = line.split(":", 1)[1].strip()
        if not reply:
            reply = text
        return reply, sentiment
    except Exception as e:
        _logger.error(f"review reply generation failed: {e}")
        return "소중한 리뷰 감사드립니다. 더 나은 서비스로 보답하겠습니다.", "neutral"


@router.get("/{biz_id}/review-replies")
async def get_review_replies(biz_id: str, user=Depends(get_current_user)):
    """최근 리뷰 답변 이력 조회 (최대 20개)"""
    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])
    try:
        result = await execute(
            supabase.table("review_replies")
            .select("id, review_text, reply_draft, sentiment, created_at")
            .eq("business_id", biz_id)
            .order("created_at", desc=True)
            .limit(20)
        )
        return result.data or []
    except Exception as e:
        # sentiment 컬럼 미적용 DB 환경 fallback — sentiment 제외 조회
        err_str = str(e)
        if "sentiment" in err_str and "does not exist" in err_str:
            _logger.warning("review_replies.sentiment 컬럼 미적용 — 마이그레이션 필요 (sentiment 제외 조회)")
            result = await execute(
                supabase.table("review_replies")
                .select("id, review_text, reply_draft, created_at")
                .eq("business_id", biz_id)
                .order("created_at", desc=True)
                .limit(20)
            )
            rows = result.data or []
            for row in rows:
                row.setdefault("sentiment", "neutral")
            return rows
        raise


@router.delete("/{biz_id}/review-replies/{reply_id}")
async def delete_review_reply(
    biz_id: str,
    reply_id: str,
    current_user: dict = Depends(get_current_user),
):
    """리뷰 답변 이력 삭제 (소유권 검증 포함)"""
    user_id = current_user.get("id") or current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="인증 정보가 없습니다")

    supabase = get_client()

    # 사업장 소유권 검증
    biz_row = await execute(
        supabase.table("businesses").select("id, user_id").eq("id", biz_id).maybe_single()
    )
    if not (biz_row and biz_row.data) or biz_row.data.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="권한이 없습니다")

    # 해당 이력이 이 사업장 소유인지 확인
    reply_res = await execute(
        supabase.table("review_replies")
        .select("id, business_id")
        .eq("id", reply_id)
        .eq("business_id", biz_id)
        .maybe_single()
    )
    if not (reply_res and reply_res.data):
        raise HTTPException(status_code=404, detail="이력을 찾을 수 없습니다")

    try:
        await execute(
            supabase.table("review_replies").delete().eq("id", reply_id)
        )
    except Exception as e:
        _logger.warning(f"review reply delete failed reply_id={reply_id}: {e}")
        raise HTTPException(status_code=500, detail="삭제 처리 중 오류가 발생했습니다")

    return {"success": True}


@router.get("/{biz_id}/qr-card")
async def get_qr_card(biz_id: str, user=Depends(get_current_user)):
    """리뷰 유도 QR 카드 PNG 반환 (인쇄용, Basic+ 전용)"""
    from fastapi.responses import StreamingResponse
    from services.action_tools import build_qr_message
    from services.qr_generator import generate_review_qr_card

    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])

    # Basic+ 플랜 체크 — get_user_plan() 경유 (grace_period·admin bypass 포함)
    from middleware.plan_gate import get_user_plan, PLAN_HIERARCHY
    _plan = await get_user_plan(user["id"], supabase)
    if PLAN_HIERARCHY.get(_plan, 0) < PLAN_HIERARCHY.get("basic", 1):
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "required_plans": ["basic", "pro", "biz"]},
        )

    biz = (await execute(
        supabase.table("businesses")
        .select("name, category, region, keywords, naver_place_id")
        .eq("id", biz_id).single()
    )).data
    if not biz:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")

    naver_place_id = biz.get("naver_place_id") or ""
    if naver_place_id:
        review_url = f"https://map.naver.com/p/entry/place/{naver_place_id}?reviews=1"
    else:
        import urllib.parse
        q = urllib.parse.quote(f"{biz['name']} 리뷰")
        review_url = f"https://search.naver.com/search.naver?query={q}"

    # 업종 최우선 키워드
    top_keyword = (biz.get("keywords") or [None])[0]
    qr_message = build_qr_message(biz.get("category", ""), top_keyword)

    try:
        buf = generate_review_qr_card(
            business_name=biz["name"],
            naver_review_url=review_url,
            qr_message=qr_message,
            category=biz.get("category", ""),
        )
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="QR 생성 패키지 미설치: pip install qrcode[pil]",
        )

    filename = f"review_qr_{biz['name']}.png"
    return StreamingResponse(
        buf,
        media_type="image/png",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/ad-defense/{biz_id}")
async def generate_ad_defense_guide(biz_id: str, current_user: dict = Depends(get_current_user)):
    """ChatGPT 광고 대응 가이드 생성 (Pro+ 전용)"""
    supabase = get_client()
    x_user_id = current_user["id"]

    # 소유권 검증 먼저 — 타인 biz_id로 플랜 체크 우회 방지
    await _verify_biz_ownership(supabase, biz_id, x_user_id)

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
    if plan not in ("pro", "biz") or status not in ("active", "grace_period"):
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "required_plans": ["pro", "biz"]},
        )

    biz = (await execute(
        supabase.table("businesses")
        .select("id, name, category, region, keywords, website_url")
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
            .select("id, name, category, region, keywords, website_url, google_place_id, kakao_place_id, business_type, naver_place_id, address, phone, is_smart_place, has_faq, has_intro, has_recent_post, review_count, avg_rating, visitor_review_count, receipt_review_count, blog_analysis_json, sp_completeness_json")
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

        # gap_analyzer로 keyword_gap 조회 (경쟁사 실데이터 기반 구체 조언 제공)
        keyword_gap = None
        try:
            from services.gap_analyzer import analyze_gap_from_db
            gap_result = await analyze_gap_from_db(req.business_id, supabase)
            if gap_result and gap_result.keyword_gap:
                keyword_gap = gap_result.keyword_gap
        except Exception as e:
            _logger.warning(f"Guide gen: keyword_gap 조회 실패 (biz={req.business_id}): {e}")

        # ActionPlan 생성 (v2.1)
        action_plan = await generator.generate_action_plan(
            biz=biz,
            score_data=score_data,
            competitor_data=competitor_data,
            scan_id=req.scan_id,
            context=context,
            naver_data=None,
            website_health=scan.get("website_check_result"),
            keyword_gap=keyword_gap,
        )

        # guides 테이블에 저장 — 새 컬럼(v2.1) 우선 시도, 없으면 레거시 폴백
        base_payload = {
            "business_id": req.business_id,
            "items_json": [item.model_dump() for item in action_plan.items],
            "priority_json": [item.title for item in action_plan.quick_wins],
            "summary": action_plan.summary,
        }

        # tools_json에 weekly_roadmap, this_week_mission 병합 (Claude 응답에서 추출)
        tools_data = action_plan.tools.model_dump()
        if action_plan.weekly_roadmap:
            tools_data["weekly_roadmap"] = action_plan.weekly_roadmap
        if action_plan.this_week_mission:
            tools_data["this_week_mission"] = action_plan.this_week_mission
        # 실제 스캔 수치 스냅샷 저장 (프론트엔드 데이터 카드용)
        _kw_gap_dict_ss = keyword_gap if isinstance(keyword_gap, dict) else (keyword_gap.model_dump() if hasattr(keyword_gap, "model_dump") else {})
        tools_data["scan_snapshot"] = {
            "my_score": round(float(score_data.get("total_score") or 0), 1),
            "my_freq": int(score_data.get("exposure_freq") or 0),
            "track1_score": round(float(score_data.get("track1_score") or 0), 1) if score_data.get("track1_score") is not None else None,
            "track2_score": round(float(score_data.get("track2_score") or 0), 1) if score_data.get("track2_score") is not None else None,
            "naver_in_briefing": bool((score_data.get("naver_result") or {}).get("mentioned", False)),
            "chatgpt_mentioned": bool(
                (score_data.get("chatgpt_result") or {}).get("mentioned")
                or (score_data.get("chatgpt_result") or {}).get("exposure_freq", 0) > 0
            ),
            "keyword_gap_count": len((_kw_gap_dict_ss or {}).get("missing_keywords") or []),
            "coverage_rate": float((_kw_gap_dict_ss or {}).get("coverage_rate") or 0),
            "competitor_count": len(competitor_data or []),
        }

        try:
            await execute(
                supabase.table("guides").insert({
                    **base_payload,
                    "scan_id": req.scan_id,
                    "context": context,
                    "next_month_goal": action_plan.next_month_goal,
                    "tools_json": tools_data,
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


class SmartplaceFAQRequest(BaseModel):
    keywords: list[str] = []  # 사용자 지정 키워드 (빈 리스트면 스캔 결과에서 자동 추출)


@router.post("/{biz_id}/smartplace-faq")
async def generate_smartplace_faq(
    biz_id: str,
    req: SmartplaceFAQRequest = SmartplaceFAQRequest(),
    current_user: dict = Depends(get_current_user),
):
    """스마트플레이스 Q&A용 FAQ 초안 생성 (Basic+, 월 5회)

    body(optional): {"keywords": ["키워드1", "키워드2"]}
    keywords 비어있으면 최신 스캔 결과에서 자동 추출
    """
    from middleware.plan_gate import get_user_plan, PLAN_LIMITS
    from services.guide_generator import generate_faq_drafts
    from datetime import datetime, timezone

    user_id = current_user.get("id") or current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="인증 정보가 없습니다")

    supabase = get_client()
    plan = await get_user_plan(user_id, supabase)
    limit = PLAN_LIMITS.get(plan, {}).get("faq_monthly", 0)
    if limit == 0:
        raise HTTPException(status_code=403, detail="Basic 이상 플랜 필요")

    # 소유권 확인
    biz_row = await execute(
        supabase.table("businesses")
        .select("id, name, category, user_id, talktalk_faq_draft")
        .eq("id", biz_id)
        .single()
    )
    if not biz_row.data or biz_row.data.get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")

    biz = biz_row.data

    # 월별 사용 횟수 체크
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    used_res = await execute(
        supabase.table("guides")
        .select("id", count="exact")
        .eq("business_id", biz_id)
        .eq("context", "faq_draft")
        .gte("generated_at", month_start)
    )
    used = used_res.count or 0
    if used >= limit:
        raise HTTPException(
            status_code=429,
            detail=f"이번 달 FAQ 초안 생성 한도({limit}회)에 도달했습니다",
        )

    # 키워드 결정: 사용자 제공 키워드 우선, 없으면 최신 스캔에서 자동 추출
    if req.keywords:
        final_keywords = req.keywords
    else:
        scan_res = await execute(
            supabase.table("scan_results")
            .select("gemini_result")
            .eq("business_id", biz_id)
            .order("scanned_at", desc=True)
            .limit(1)
        )
        final_keywords = []
        if scan_res.data:
            gemini = scan_res.data[0].get("gemini_result") or {}
            final_keywords = gemini.get("top_keywords", []) or []

    faqs = await generate_faq_drafts(
        biz_name=biz.get("name", ""),
        category=biz.get("category", ""),
        keywords=final_keywords,
        count=5,
    )

    # guides 테이블에 저장 (이력용)
    try:
        await execute(
            supabase.table("guides").insert({
                "business_id": biz_id,
                "context": "faq_draft",
                "items_json": faqs,
                "generated_at": now.isoformat(),
            })
        )
    except Exception as save_err:
        _logger.warning(f"FAQ draft 저장 실패 (응답은 반환): {save_err}")

    # businesses.talktalk_faq_draft 에 최신 초안 저장 (재방문 시 자동 로드용)
    try:
        await execute(
            supabase.table("businesses")
            .update({
                "talktalk_faq_draft": {"items": faqs, "chat_menus": []},
                "talktalk_faq_generated_at": now.isoformat(),
            })
            .eq("id", biz_id)
        )
    except Exception as biz_save_err:
        _logger.warning(f"FAQ draft businesses 저장 실패 (컬럼 없을 수 있음): {biz_save_err}")

    return {"faqs": faqs, "used": used + 1, "limit": limit, "keywords_used": final_keywords}


@router.delete("/{biz_id}/smartplace-faq/{faq_index}")
async def delete_smartplace_faq_item(
    biz_id: str,
    faq_index: int,
    current_user: dict = Depends(get_current_user),
):
    """소개글 Q&A 초안 특정 항목 삭제 (0-based index)"""
    user_id = current_user.get("id") or current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="인증 정보가 없습니다")

    supabase = get_client()

    # 소유권 검증
    biz_row = await execute(
        supabase.table("businesses").select("id, user_id").eq("id", biz_id).single()
    )
    if not biz_row.data or biz_row.data.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="권한이 없습니다")

    # 최신 FAQ 초안 조회 (context="faq_draft", items_json 사용)
    guide_res = await execute(
        supabase.table("guides")
        .select("id, items_json")
        .eq("business_id", biz_id)
        .eq("context", "faq_draft")
        .order("generated_at", desc=True)
        .limit(1)
    )
    if not (guide_res and guide_res.data):
        raise HTTPException(status_code=404, detail="FAQ 초안을 찾을 수 없습니다")

    guide_row = guide_res.data[0]
    faqs = guide_row.get("items_json") or []

    if not isinstance(faqs, list):
        raise HTTPException(status_code=500, detail="FAQ 데이터 형식이 올바르지 않습니다")

    if faq_index < 0 or faq_index >= len(faqs):
        raise HTTPException(status_code=400, detail=f"유효하지 않은 인덱스입니다 (0~{len(faqs)-1})")

    faqs.pop(faq_index)

    try:
        await execute(
            supabase.table("guides")
            .update({"items_json": faqs})
            .eq("id", guide_row["id"])
        )
    except Exception as e:
        _logger.warning(f"FAQ item delete DB update failed: {e}")
        raise HTTPException(status_code=500, detail="삭제 처리 중 오류가 발생했습니다")

    return {"success": True, "remaining": len(faqs)}


@router.post("/{biz_id}/crisis-reply")
async def generate_crisis_reply_endpoint(
    biz_id: str,
    review_text: str = Body(..., description="부정 리뷰 원문"),
    rating: int = Body(default=1, ge=1, le=3, description="별점 (1~3점)"),
    current_user: dict = Depends(get_current_user),
):
    """부정 리뷰 위기관리 가이드 생성 (Basic+ 전용)

    Claude Haiku가 공개 답변 초안, AI 검색 영향 최소화 팁,
    하지 말아야 할 행동, 오프라인 해결 단계를 생성합니다.
    """
    from services.crisis_guide import generate_crisis_reply

    user_id = current_user.get("id") or current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="인증 정보가 없습니다")

    supabase = get_client()

    # 소유권 검증
    await _verify_biz_ownership(supabase, biz_id, user_id)

    # Basic+ 플랜 체크
    sub = (await execute(
        supabase.table("subscriptions")
        .select("plan, status")
        .eq("user_id", user_id)
        .maybe_single()
    )).data
    _plan = (sub or {}).get("plan", "free")
    _status = (sub or {}).get("status", "inactive")
    if _plan == "free" or _status not in ("active", "grace_period"):
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "required_plans": ["basic", "pro", "biz"]},
        )

    # 사업장 정보 조회
    biz = (await execute(
        supabase.table("businesses")
        .select("name, category")
        .eq("id", biz_id)
        .single()
    )).data
    if not biz:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")

    result = await generate_crisis_reply(
        review_text=review_text,
        business_name=biz.get("name", ""),
        category=biz.get("category", ""),
        rating=rating,
    )
    return result


@router.get("/{biz_id}/pioneer-detail")
async def get_pioneer_detail(biz_id: str, current_user: dict = Depends(get_current_user)):
    """선점 키워드 상세 — 이유 + 예시 문장 (Basic+)"""
    from middleware.plan_gate import get_user_plan
    from services.gap_analyzer import analyze_gap_from_db
    from utils import cache as _cache
    import os, json, re, anthropic

    user_id = current_user.get("id")
    supabase = get_client()
    plan = await get_user_plan(user_id, supabase)
    if plan == "free":
        raise HTTPException(status_code=403, detail="Basic 이상 플랜 필요")

    # 소유권 검증을 캐시 조회 전에 수행 (타 사용자 캐시 접근 방지)
    biz_row = await execute(
        supabase.table("businesses").select("id, name, category, user_id").eq("id", biz_id).single()
    )
    if not biz_row.data or biz_row.data.get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")

    cache_key = f"pioneer_detail:{biz_id}"
    cached = _cache.get(cache_key)
    if cached:
        return cached

    biz = biz_row.data
    gap = await analyze_gap_from_db(biz_id, supabase)
    pioneers = (gap.keyword_gap.pioneer_keywords if gap and gap.keyword_gap else [])[:5]

    if not pioneers:
        return {"items": [], "status": "no_keywords"}

    biz_name = biz.get("name", "")
    biz_category = biz.get("category", "")
    biz_region = biz.get("region", "")
    kw_list = ", ".join(pioneers)
    prompt = f"""당신은 소상공인 네이버 스마트플레이스 최적화 전문가입니다.

아래 사업장의 '선점 가능 키워드'는 경쟁사 리뷰에도, 내 리뷰에도 아직 등장하지 않는 키워드입니다.
즉, 지금 먼저 사용하면 AI 검색 노출에서 앞서갈 수 있는 기회입니다.

사업장명: {biz_name}
업종: {biz_category}
지역: {biz_region}
선점 가능한 키워드: {kw_list}

각 키워드에 대해 다음 2가지를 작성하세요:
1. reason: 이 키워드가 왜 선점 기회인지 — 경쟁이 없는 이유, 고객 수요 근거 (1-2문장, 구체적으로)
2. example: 사업장 소개글이나 리뷰 답변에 바로 쓸 수 있는 예시 문장 (1문장, 반드시 실제 업종에 맞게, 사업장명이나 업종 특성 반영)

주의: 사실이 아닌 내용(예: 시설이 있다고 단정, 확인되지 않은 특성)은 작성하지 마세요. 예시는 사업주가 직접 쓸 수 있는 자연스러운 문장이어야 합니다.

반드시 아래 JSON 배열 형식으로만 응답하세요:
[{{"keyword": "키워드", "reason": "이유", "example": "예시문장"}}]"""

    try:
        import asyncio as _aio
        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        msg = await _aio.to_thread(
            lambda: client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=1000,
                messages=[{"role": "user", "content": prompt}],
            )
        )
        raw = msg.content[0].text.strip()
        m = re.search(r"\[.*\]", raw, re.DOTALL)
        items = json.loads(m.group()) if m else []
    except Exception as e:
        import logging
        logging.getLogger("aeolab.guide").warning(f"pioneer_detail error: {e}")
        items = [{"keyword": kw, "reason": "경쟁사 미활용 키워드", "example": f"{kw}로 검색하면 바로 찾으실 수 있어요"} for kw in pioneers]

    result = {"items": items, "status": "ok"}
    _cache.set(cache_key, result, 7200)
    return result


@router.post("/{biz_id}/blog-topics")
async def generate_blog_topics(
    biz_id: str,
    current_user: dict = Depends(get_current_user),
):
    """블로그 주제 5개 자동 생성 — Gemini Flash 기반 (Basic+ 플랜, 월 guide_monthly 한도 공유).

    businesses.name/region/category + 최신 스캔의 top_missing_keywords를 활용해
    지역 SEO에 최적화된 블로그 제목 5개를 생성한다.
    동일 biz_id 반복 호출 방지: 1시간 TTL 캐시 적용.
    """
    import os, json, re, aiohttp as _aiohttp
    from middleware.plan_gate import check_guide_limit, PLAN_LIMITS, get_user_plan as _get_plan
    supabase = get_client()

    # 소유권 검증
    await _verify_biz_ownership(supabase, biz_id, current_user["id"])

    # Basic+ 플랜 체크
    user_plan = await _get_plan(current_user["id"], supabase)
    if user_plan == "free":
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "message": "Basic 이상 플랜이 필요합니다", "upgrade_url": "/pricing"},
        )

    # 월 한도 체크 (guide_monthly 공유)
    allowed, used, limit = await check_guide_limit(current_user["id"], supabase)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "GUIDE_LIMIT_EXCEEDED",
                "used": used,
                "limit": limit,
                "message": f"이번 달 가이드 생성 한도({limit}회)를 초과했습니다.",
                "upgrade_url": "/pricing",
            },
        )

    # 1시간 캐시
    cache_key = f"blog_topics:{biz_id}"
    cached = _cache.get(cache_key)
    if cached:
        return cached

    # 사업장 정보 조회
    biz_row = await execute(
        supabase.table("businesses")
        .select("name, region, category")
        .eq("id", biz_id)
        .maybe_single()
    )
    if not biz_row.data:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")

    biz = biz_row.data
    biz_name = biz.get("name", "")
    region = biz.get("region", "")
    category = biz.get("category", "")

    # 최신 스캔에서 top_missing_keywords 추출
    scan_row = await execute(
        supabase.table("scan_results")
        .select("gemini_result")
        .eq("business_id", biz_id)
        .order("scanned_at", desc=True)
        .limit(1)
        .maybe_single()
    )
    top_missing: list[str] = []
    if scan_row.data:
        gemini_r = scan_row.data.get("gemini_result") or {}
        top_missing = (gemini_r.get("top_missing_keywords") or [])[:5]

    category_ko = {
        "restaurant": "음식점", "cafe": "카페", "bakery": "베이커리·빵집",
        "bar": "주점·바", "beauty": "미용·뷰티", "nail": "네일샵",
        "medical": "병원·의원", "pharmacy": "약국", "fitness": "운동·헬스",
        "yoga": "요가·필라테스", "pet": "반려동물", "education": "교육·학원",
        "tutoring": "과외·튜터링", "legal": "법률·행정", "realestate": "부동산",
        "interior": "인테리어", "auto": "자동차", "cleaning": "청소·세탁",
        "shopping": "쇼핑몰", "fashion": "패션·의류", "photo": "사진·영상",
        "video": "영상제작", "design": "디자인", "accommodation": "숙박·펜션",
        "other": "소상공인",
        # 구버전 호환
        "hair": "미용실", "medical": "병원", "legal": "법률사무소",
    }.get(category, category)

    kw_hint = (", ".join(top_missing[:3])) if top_missing else f"{region} {category_ko}"

    prompt = (
        f"{region} {category_ko} 소상공인을 위한 블로그 글 제목 5개를 생성해주세요. "
        f"조건: 1) 지역명({region})과 서비스명 포함 2) 정보형+비교형+후기형 혼합 "
        f"3) 다음 키워드 중 하나 이상 포함: {kw_hint}. "
        f"사업장명: {biz_name}. "
        f'JSON 배열로만 반환하세요: ["제목1", "제목2", "제목3", "제목4", "제목5"]'
    )

    gemini_api_key = os.getenv("GEMINI_API_KEY", "")
    if not gemini_api_key:
        _logger.warning("[blog_topics] GEMINI_API_KEY 미설정")
        raise HTTPException(status_code=503, detail="AI 서비스를 일시적으로 사용할 수 없습니다")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={gemini_api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.8, "maxOutputTokens": 512},
    }

    try:
        async with _aiohttp.ClientSession(timeout=_aiohttp.ClientTimeout(total=20)) as session:
            async with session.post(url, json=payload) as resp:
                if resp.status != 200:
                    body = await resp.text()
                    _logger.warning(f"[blog_topics] Gemini API 오류 status={resp.status}: {body[:200]}")
                    raise HTTPException(status_code=503, detail="블로그 주제 생성에 실패했습니다")
                data = await resp.json()

        raw = data["candidates"][0]["content"]["parts"][0]["text"].strip()
        m = re.search(r"\[.*\]", raw, re.DOTALL)
        topics: list[str] = json.loads(m.group()) if m else []
        if not topics:
            raise ValueError("빈 응답")

    except (HTTPException, Exception) as e:
        if isinstance(e, HTTPException):
            raise
        _logger.warning(f"[blog_topics] 생성 실패 biz={biz_id}: {e}")
        # fallback 제목 생성
        topics = [
            f"{region} {category_ko} 추천 — {biz_name} 방문 후기",
            f"{region}에서 {category_ko} 찾는다면? 직접 비교해봤습니다",
            f"{biz_name} 솔직 리뷰 — {region} 단골이 알려주는 꿀팁",
            f"{region} {category_ko} 가격·후기 총정리",
            f"처음 방문하는 분을 위한 {biz_name} 완전 가이드",
        ]

    result = {"topics": topics[:5]}
    _cache.set(cache_key, result, 3600)
    return result


@router.get("/{biz_id}/keyword-completeness")
async def get_keyword_completeness(
    biz_id: str,
    current_user: dict = Depends(get_current_user),
):
    """키워드 충족도 분석 — taxonomy 기준 내 키워드 커버리지 (Basic+ 플랜, AI 호출 없음).

    KEYWORD_TAXONOMY 업종 카테고리별로 내 사업장 keywords와 최신 scan_results.keyword_coverage를
    비교해 covered/missing 분류 및 커버리지 비율을 반환한다.
    """
    from middleware.plan_gate import get_user_plan as _get_plan
    from services.keyword_taxonomy import KEYWORD_TAXONOMY, _CATEGORY_ALIASES

    supabase = get_client()

    # 소유권 검증
    await _verify_biz_ownership(supabase, biz_id, current_user["id"])

    # Basic+ 플랜 체크
    plan = await _get_plan(current_user["id"], supabase)
    if plan == "free":
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "message": "Basic 이상 플랜이 필요합니다", "upgrade_url": "/pricing"},
        )

    # 사업장 category, keywords 조회
    biz_row = await execute(
        supabase.table("businesses")
        .select("category, keywords")
        .eq("id", biz_id)
        .maybe_single()
    )
    if not (biz_row and biz_row.data):
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")

    biz = biz_row.data
    category: str = biz.get("category") or "restaurant"
    my_keywords: list[str] = biz.get("keywords") or []

    # taxonomy 키 정규화 (없으면 "restaurant" fallback)
    taxonomy_key: str = _CATEGORY_ALIASES.get(category, "restaurant")
    taxonomy_dict: dict = KEYWORD_TAXONOMY.get(taxonomy_key, KEYWORD_TAXONOMY.get("restaurant", {}))

    # 최신 스캔의 keyword_coverage로 covered_keywords 보완
    scan_row = await execute(
        supabase.table("scan_results")
        .select("keyword_coverage")
        .eq("business_id", biz_id)
        .order("scanned_at", desc=True)
        .limit(1)
        .maybe_single()
    )
    scan_covered: list[str] = []
    if scan_row and scan_row.data:
        kw_cov = scan_row.data.get("keyword_coverage")
        # keyword_coverage는 JSONB 또는 None일 수 있음
        if isinstance(kw_cov, dict):
            scan_covered = kw_cov.get("covered_keywords") or []

    # 전체 covered 키워드 집합 (내 키워드 + 스캔 covered)
    all_covered_set: set[str] = set(my_keywords) | set(scan_covered)

    # 카테고리별 covered/missing 분류
    category_results = []
    total_tax_count = 0
    total_covered_count = 0
    all_covered_flat: list[str] = []
    all_missing_flat: list[str] = []
    classified_tax_keywords: set[str] = set()

    for cat_name, cat_data in taxonomy_dict.items():
        tax_keywords: list[str] = cat_data.get("keywords") or []
        weight: float = cat_data.get("weight") or 0.0
        condition_example: str = cat_data.get("condition_search_example") or ""

        covered: list[str] = []
        missing: list[str] = []

        for tax_kw in tax_keywords:
            classified_tax_keywords.add(tax_kw)
            # 부분 일치: 내 키워드 중 하나라도 taxonomy 키워드를 포함하거나 taxonomy 키워드가 내 키워드에 포함
            is_covered = any(
                tax_kw in my_kw or my_kw in tax_kw
                for my_kw in all_covered_set
            )
            if is_covered:
                covered.append(tax_kw)
                all_covered_flat.append(tax_kw)
            else:
                missing.append(tax_kw)
                all_missing_flat.append(tax_kw)

        cat_total = len(tax_keywords)
        cat_covered = len(covered)
        covered_pct = round(cat_covered / cat_total * 100) if cat_total else 0

        total_tax_count += cat_total
        total_covered_count += cat_covered

        category_results.append({
            "name": cat_name,
            "weight": weight,
            "covered": covered,
            "missing": missing,
            "covered_pct": covered_pct,
            "condition_search_example": condition_example,
        })

    # 전체 커버리지 퍼센트
    overall_pct = round(total_covered_count / total_tax_count * 100) if total_tax_count else 0

    # 상위 missing 키워드 (weight 높은 카테고리 우선)
    top_missing: list[str] = []
    for cat in sorted(category_results, key=lambda c: -c["weight"]):
        for kw in cat["missing"]:
            if kw not in top_missing:
                top_missing.append(kw)
            if len(top_missing) >= 10:
                break
        if len(top_missing) >= 10:
            break

    # 내 키워드 중 taxonomy에 분류되지 않은 것
    my_unclassified: list[str] = [
        kw for kw in my_keywords
        if not any(
            tax_kw in kw or kw in tax_kw
            for tax_kw in classified_tax_keywords
        )
    ]

    return {
        "category": category,
        "taxonomy_key": taxonomy_key,
        "overall_pct": overall_pct,
        "categories": category_results,
        "top_missing": top_missing[:10],
        "my_unclassified_keywords": my_unclassified,
    }
