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
    월별 생성 한도: Basic 1회 / Startup 5회 / Pro 8회 / Biz 20회 / Enterprise 무제한
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
    except Exception as e:
        _logger.warning(f"guide fetch fallback (v3.0 columns not found): {e}")
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


class ReviewReplyRequest(BaseModel):
    business_id: str
    review_text: str


@router.post("/review-reply")
async def generate_review_reply(
    req: ReviewReplyRequest,
    current_user: dict = Depends(get_current_user),
):
    """리뷰 답변 초안 생성 (Claude Haiku, Basic+ 전용).

    월별 한도: Basic/Startup 10회, Pro 50회, Biz/Enterprise 무제한
    """
    from middleware.plan_gate import check_review_reply_limit
    supabase = get_client()

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

    await _verify_biz_ownership(supabase, req.business_id, current_user["id"])

    biz = (await execute(
        supabase.table("businesses")
        .select("name, category, keywords")
        .eq("id", req.business_id).single()
    )).data
    if not biz:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")

    reply_draft, sentiment = await _generate_reply(biz, req.review_text)

    # 저장
    await execute(
        supabase.table("review_replies").insert({
            "business_id": req.business_id,
            "review_text": req.review_text,
            "reply_draft": reply_draft,
            "sentiment": sentiment,
            "keywords_used": biz.get("keywords") or [],
        })
    )

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
    result = await execute(
        supabase.table("review_replies")
        .select("id, review_text, reply_draft, sentiment, created_at")
        .eq("business_id", biz_id)
        .order("created_at", desc=True)
        .limit(20)
    )
    return result.data or []


@router.get("/{biz_id}/qr-card")
async def get_qr_card(biz_id: str, user=Depends(get_current_user)):
    """리뷰 유도 QR 카드 PNG 반환 (인쇄용, Basic+ 전용)"""
    from fastapi.responses import StreamingResponse
    from services.action_tools import build_qr_message
    from services.qr_generator import generate_review_qr_card

    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])

    # Basic+ 플랜 체크
    sub = (await execute(
        supabase.table("subscriptions")
        .select("plan, status")
        .eq("user_id", user["id"])
        .maybe_single()
    )).data
    _plan = (sub or {}).get("plan", "free")
    _status = (sub or {}).get("status", "inactive")
    if _plan == "free" or _status != "active":
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "required_plans": ["basic", "pro", "biz", "enterprise"]},
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
    if plan not in ("pro", "biz", "enterprise") or status != "active":
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "required_plans": ["pro", "biz", "enterprise"]},
        )

    await _verify_biz_ownership(supabase, biz_id, x_user_id)

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
