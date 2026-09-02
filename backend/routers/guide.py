"""
가이드 생성 라우터
도메인 모델 v2.1 Phase D: ActionPlan 타입 반환
"""
import asyncio
import logging
from fastapi import APIRouter, Body, Header, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel
from models.schemas import GuideRequest
from services.ai_usage_logger import log_ai_usage
from services.guide_generator import GuideGenerator
from db.supabase_client import get_client, execute
from middleware.plan_gate import get_current_user
from utils import cache as _cache

_logger = logging.getLogger("aeolab")
router = APIRouter()

# 월별 가이드 생성 한도 TOCTOU 레이스 방지(security_audit_v1.0.md M2, 2026-07-12).
# check_guide_limit()는 COUNT 쿼리 시점 스냅샷이고 실제 insert는 백그라운드 태스크
# 완료 후에나 일어나 그 사이 동시 요청이 같은 한도를 여러 번 통과할 수 있었다.
# 단일 프로세스(PM2 fork) 배포라 in-memory set으로 충분 — scan.py _active_scans와 동일 패턴.
_guide_generation_locks: set[str] = set()

# review-reply/crisis-reply도 COUNT 체크 후 Claude 호출(수백ms~수초) 사이 동시요청이
# 같은 월별 한도를 여러 번 통과할 수 있는 동일한 TOCTOU 구조 — 위와 같은 이유로 락 추가.
_review_reply_locks: set[str] = set()
_crisis_reply_locks: set[str] = set()

# ad-defense도 동일한 TOCTOU 구조 — check_ad_defense_limit() COUNT 체크 후 Claude Sonnet
# 호출(10~20초, 프론트 안내 문구 기준)까지의 창이 review-reply보다 훨씬 길어 동시요청(중복
# 클릭·다중 탭)이 월별 한도(Pro 5회/Biz 10회)를 여러 번 통과하기 더 쉬움. 2026-07-08
# check_ad_defense_limit 신설(c4ee252) 시 review-reply/crisis-reply와 달리 락이 누락돼
# 있었음 — 동일 패턴으로 추가(2026-07-15).
_ad_defense_locks: set[str] = set()

# review-reply/crisis-reply 요청속도 제한 — Pro·창업패키지·Biz·Enterprise는
# review_reply_monthly/crisis_reply_monthly가 999(=무제한)라 월별 한도가 사실상 없음.
# 콜당 비용은 Haiku 기준 저렴(약 2~3원)하지만 스크립트로 연속 호출하면 무제한 티어에서
# 비용이 통제 없이 쌓일 수 있어 feedback.py/webhook.py와 동일한 패턴으로 캡 추가.
# 인증 엔드포인트라 IP 대신 user_id 기준.
_AI_REPLY_RATE_LIMIT = 10
_AI_REPLY_RATE_WINDOW = 60  # seconds


def _check_ai_reply_rate_limit(user_id: str, scope: str) -> None:
    key = f"ai_reply_rate:{scope}:{user_id}"
    count: int = _cache.get(key) or 0
    if count >= _AI_REPLY_RATE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "RATE_LIMIT",
                "message": "잠시 후 다시 시도해 주세요 (분당 10회 제한).",
                "retry_after": _AI_REPLY_RATE_WINDOW,
            },
        )
    _cache.set(key, count + 1, _AI_REPLY_RATE_WINDOW)


# 이 라우터의 AsyncAnthropic 클라이언트 재사용 — 호출마다 새로 만들면 커넥션풀을
# 재사용하지 못해 매번 TLS 핸드셰이크가 발생, 동시 사용자 늘 때 지연이 누적됨.
# review-reply(_generate_reply) + pioneer-detail 둘 다 공유(2026-07-15 pioneer-detail
# 편입, 이전엔 _review_reply_ai_client란 이름으로 review-reply 전용이었음).
# crisis_guide.py·guide_generator.py도 동일 패턴 적용됨.
_guide_ai_client = None


def _get_guide_ai_client(api_key: str):
    global _guide_ai_client
    if _guide_ai_client is None:
        import anthropic
        _guide_ai_client = anthropic.AsyncAnthropic(api_key=api_key)
    return _guide_ai_client


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

    user_id = current_user["id"]
    if user_id in _guide_generation_locks:
        from utils.system_alert_log import record_alert
        asyncio.create_task(record_alert(
            "GUIDE_GENERATION_IN_PROGRESS", "가이드 생성 락 충돌(동시 요청)",
            level="info", source="lock_contention",
        ))
        raise HTTPException(
            status_code=409,
            detail={
                "code": "GUIDE_GENERATION_IN_PROGRESS",
                "message": "이미 가이드 생성이 진행 중입니다. 완료 후 다시 시도해 주세요.",
            },
        )
    _guide_generation_locks.add(user_id)

    try:
        # Basic 체험 사용자: 체험 대상 사업장에 한해 1회 가이드 생성 허용
        if await is_basic_trial_user(user_id, supabase):
            prof = await execute(
                supabase.table("profiles")
                .select("basic_trial_business_id")
                .eq("user_id", user_id)
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
            bg.add_task(_generate_and_save_release_lock, req, user_id)
            return {"status": "generating", "business_id": req.business_id, "trial": True}

        allowed, used, limit = await check_guide_limit(user_id, supabase)
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
        bg.add_task(_generate_and_save_release_lock, req, user_id)
        return {"status": "generating", "business_id": req.business_id}
    except Exception:
        # bg.add_task 스케줄링 전 경로에서 예외가 나면 락을 여기서 해제.
        # 스케줄링 성공 후에는 이 블록에 도달하지 않고, 락은 백그라운드 태스크가 해제한다.
        _guide_generation_locks.discard(user_id)
        raise


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
async def get_latest_guide(biz_id: str, scan_id: str | None = None, context: str | None = None, user=Depends(get_current_user)):
    """최신 가이드 조회 (ActionPlan 구조 포함). scan_id 지정 시 해당 스캔의 가이드만 반환(재생성 폴링용)

    guides 테이블은 ad_defense·crisis_reply·startup_report·faq_draft·intro_draft·
    talktalk_faq·post_draft 등 서로 다른 기능의 카운터/콘텐츠 행을 함께 저장한다.
    context 필터 없이 business_id만으로 "가장 최근 1건"을 가져오면 다른 기능을 방금
    사용한 직후 이 엔드포인트가 그 행(대부분 items_json이 비어있음)을 반환한다 —
    GuideClient.tsx:2665가 이미 `?context=post_draft`로 이 필터링을 기대하고 호출하고
    있었으나 파라미터 자체가 구현돼 있지 않아 무시되고 있었음(2026-09-02 발견·수정).
    """
    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])
    query = (
        supabase.table("guides")
        .select("id, business_id, items_json, priority_json, summary, checklist_done, generated_at, context, next_month_goal, tools_json")
        .eq("business_id", biz_id)
    )
    if scan_id:
        # 개선 가이드(location_based/non_location)만 scan_id를 채워 저장하므로
        # 이 필터만으로 이미 다른 context의 카운터 행과 구분됨
        query = query.eq("scan_id", scan_id)
    elif context:
        query = query.eq("context", context)
    else:
        query = query.in_("context", ["location_based", "non_location"])
    result = await execute(query.order("generated_at", desc=True).limit(1))
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

    월별 한도: Basic 50회 / Startup·Pro·Biz·Enterprise 무제한(999) — PLAN_LIMITS 단일 소스
    """
    from middleware.plan_gate import check_review_reply_limit
    supabase = get_client()

    # 0. 요청속도 제한 — 무제한(999) 티어 스크립트 남용 방지, DB 조회 전에 먼저 차단
    _check_ai_reply_rate_limit(current_user["id"], "review_reply")

    # 1. 소유권 검증 먼저
    await _verify_biz_ownership(supabase, req.business_id, current_user["id"])

    # 2. 플랜 체크 (free 플랜이면 403) — plan_gate 단일 소스(해지 후 잔여기간도 유료 인정)
    from middleware.plan_gate import get_user_plan
    _plan = await get_user_plan(current_user["id"], supabase)
    if _plan == "free":
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "required_plans": ["basic", "pro", "biz"]},
        )

    # 3. 월별 한도 체크 — COUNT 스냅샷 후 Claude 호출까지 TOCTOU 레이스 방지 락(M2와 동일 패턴)
    user_id = current_user["id"]
    if user_id in _review_reply_locks:
        from utils.system_alert_log import record_alert
        asyncio.create_task(record_alert(
            "REVIEW_REPLY_IN_PROGRESS", "리뷰 답변 생성 락 충돌(동시 요청)",
            level="info", source="lock_contention",
        ))
        raise HTTPException(
            status_code=409,
            detail={
                "code": "REVIEW_REPLY_IN_PROGRESS",
                "message": "이미 리뷰 답변 생성이 진행 중입니다. 완료 후 다시 시도해 주세요.",
            },
        )
    _review_reply_locks.add(user_id)
    try:
        allowed, used, limit = await check_review_reply_limit(user_id, supabase)
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

        reply_draft, sentiment, is_fallback = await _generate_reply(biz, req.review_text)

        # 저장 — 폴백(AI 실패)이면 한도 소비·이력 오염 방지 위해 저장 건너뜀 (smartplace-faq와 동일 패턴)
        if not is_fallback:
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
            "draft_response": reply_draft,
            "tone": sentiment,
            "is_fallback": is_fallback,
            "used": used if is_fallback else used + 1,
            "limit": limit,
            "keywords_used": biz.get("keywords") or [],
        }
    finally:
        _review_reply_locks.discard(user_id)


async def _generate_reply(biz: dict, review_text: str) -> tuple[str, str, bool]:
    """Claude Haiku로 감정 분류 + 답변 초안 생성"""
    import os
    from services.schema_generator import CATEGORY_KO

    client = _get_guide_ai_client(os.getenv("ANTHROPIC_API_KEY", ""))
    keywords = ", ".join((biz.get("keywords") or [])[:5])
    category = CATEGORY_KO.get(biz.get("category", ""), biz.get("category", ""))
    biz_name = biz.get("name", "저희 가게")

    prompt = f"""당신은 한국 소상공인({biz_name}, 업종: {category})의 고객 리뷰 답변을 작성하는 전문가입니다.
주요 키워드: {keywords}

다음 리뷰에 대해 두 가지를 응답하세요.
1. sentiment: "positive"(긍정), "negative"(부정), "neutral"(일반) 중 하나만
2. reply: 80~150자, 2~3문장의 진심 어린 답변 (업종 키워드 자연스럽게 포함, 혜택·쿠폰 제공 문구 절대 금지, 네이버 정책 준수)

[답변 필수 조건] 리뷰에서 언급된 구체적 내용(메뉴명·서비스명·장소·불만 요인 등)을 답변에 반드시 1개 이상 직접 반영할 것. "소중한 의견 감사합니다" 같은 일반론적 문구만으로 구성하지 말 것.
[문체] 문장 길이에 자연스러운 변화를 줄 것(짧은 문장+긴 문장 혼합). 마무리 어미를 매번 "~하겠습니다"로 고정하지 말고 리뷰 내용에 맞게 다르게 쓸 것.

형식:
sentiment: <값>
reply: <답변 내용>

리뷰: {review_text[:500]}"""

    try:
        from services.anthropic_retry import create_message_with_retry
        try:
            msg = await create_message_with_retry(
                client,
                model="claude-haiku-4-5-20251001",
                max_tokens=256,
                messages=[{"role": "user", "content": prompt}],
            )
        except Exception as _ce:
            log_ai_usage("claude", "claude-haiku-4-5-20251001", f"review_reply:FAILED:{type(_ce).__name__}", 0, 0)
            raise
        try:
            log_ai_usage("claude", "claude-haiku-4-5-20251001", "review_reply", msg.usage.input_tokens, msg.usage.output_tokens)
        except Exception as _le:
            logging.getLogger(__name__).debug("review_reply usage 로깅 실패(무시): %s", _le)
        text = msg.content[0].text.strip()
        sentiment = "neutral"
        reply_lines: list[str] = []
        reply_started = False
        for line in text.splitlines():
            if not reply_started and line.lower().startswith("sentiment:"):
                raw = line.split(":", 1)[1].strip().lower()
                if raw in ("positive", "negative", "neutral"):
                    sentiment = raw
                continue
            if not reply_started and line.lower().startswith("reply:"):
                reply_started = True
                reply_lines.append(line.split(":", 1)[1].strip())
                continue
            if reply_started:
                # reply: 다음 줄부터는 필드 구분 없이 답변 본문의 연속으로 취급 —
                # 이전엔 "reply:"로 시작하는 줄만 잡아 멀티라인 응답이 첫 줄 외엔 유실됐음
                reply_lines.append(line)
        reply = "\n".join(reply_lines).strip()
        if not reply:
            reply = text
        return reply, sentiment, False
    except Exception as e:
        _logger.error(f"review reply generation failed: {e}")
        return "소중한 리뷰 감사드립니다. 더 나은 서비스로 보답하겠습니다.", "neutral", True


@router.get("/{biz_id}/review-replies")
async def get_review_replies(biz_id: str, user=Depends(get_current_user)):
    """최근 리뷰 답변 이력 조회 (최대 20개)"""
    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])
    def _normalize(rows: list) -> list:
        return [
            {
                "id": r["id"],
                "review_text": r.get("review_text", ""),
                "draft_response": r.get("reply_draft", ""),
                "tone": r.get("sentiment", "neutral"),
                "keywords_used": r.get("keywords_used") or [],
                "created_at": r["created_at"],
            }
            for r in rows
        ]

    async def _query(select_cols: str, filter_deleted: bool):
        q = (
            supabase.table("review_replies")
            .select(select_cols)
            .eq("business_id", biz_id)
        )
        if filter_deleted:
            q = q.is_("deleted_at", "null")
        return await execute(q.order("created_at", desc=True).limit(20))

    full_cols = "id, review_text, reply_draft, sentiment, keywords_used, created_at"
    legacy_cols = "id, review_text, reply_draft, keywords_used, created_at"
    try:
        result = await _query(full_cols, filter_deleted=True)
        return _normalize(result.data or [])
    except Exception as e:
        if "deleted_at" not in str(e) or "does not exist" not in str(e):
            if "sentiment" in str(e) and "does not exist" in str(e):
                _logger.warning("review_replies.sentiment 컬럼 미적용 — 마이그레이션 필요 (sentiment 제외 조회)")
                result = await _query(legacy_cols, filter_deleted=True)
                return _normalize(result.data or [])
            raise
        # deleted_at 컬럼 미적용 — 마이그레이션 전 과도기, 소프트 삭제 필터 없이 조회
        _logger.warning("review_replies.deleted_at 컬럼 미적용 — 마이그레이션 필요 (소프트 삭제 필터 제외 조회)")
        try:
            result = await _query(full_cols, filter_deleted=False)
            return _normalize(result.data or [])
        except Exception as e2:
            if "sentiment" in str(e2) and "does not exist" in str(e2):
                _logger.warning("review_replies.sentiment 컬럼 미적용 — 마이그레이션 필요 (sentiment 제외 조회)")
                result = await _query(legacy_cols, filter_deleted=False)
                return _normalize(result.data or [])
            raise


@router.get("/{biz_id}/review-reply/usage")
async def get_review_reply_usage(biz_id: str, user=Depends(get_current_user)):
    """이번 달 리뷰 답변 사용량 조회 (Basic+ 전용, 페이지 진입 시 호출)"""
    from middleware.plan_gate import check_review_reply_limit
    supabase = get_client()
    await _verify_biz_ownership(supabase, biz_id, user["id"])
    _, used, limit = await check_review_reply_limit(user["id"], supabase)
    return {"used": used, "limit": limit}


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

    # 소프트 삭제 — 하드 삭제 시 "삭제 후 재생성"으로 월 한도(check_review_reply_limit) 우회 가능.
    # deleted_at만 채워 목록에서는 숨기되, 한도 카운트(created_at 기준)에는 계속 반영되게 유지.
    try:
        from datetime import datetime, timezone
        await execute(
            supabase.table("review_replies")
            .update({"deleted_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", reply_id)
        )
    except Exception as e:
        err_str = str(e)
        if "deleted_at" in err_str and "does not exist" in err_str:
            # 마이그레이션 전 과도기 — 하드 삭제로 폴백(이 경우에 한해 한도 우회 가능성 있음)
            _logger.warning("review_replies.deleted_at 컬럼 미적용 — 마이그레이션 필요 (하드 삭제로 폴백)")
            try:
                await execute(
                    supabase.table("review_replies").delete().eq("id", reply_id)
                )
            except Exception as e2:
                _logger.warning(f"review reply delete failed reply_id={reply_id}: {e2}")
                raise HTTPException(status_code=500, detail="삭제 처리 중 오류가 발생했습니다")
            return {"success": True}
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
        # QR+PIL 렌더링은 CPU 바운드 동기 작업 — 단일 uvicorn 워커에서 이벤트 루프에
        # 직접 실행하면 그 시간 동안 다른 모든 사용자 요청이 함께 멈춘다. to_thread로 분리(2026-07-15)
        buf = await asyncio.to_thread(
            generate_review_qr_card,
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
    from datetime import datetime, timezone
    from middleware.plan_gate import get_user_plan, check_ad_defense_limit

    supabase = get_client()
    x_user_id = current_user["id"]

    # 소유권 검증 먼저 — 타인 biz_id로 플랜 체크 우회 방지
    await _verify_biz_ownership(supabase, biz_id, x_user_id)

    plan = await get_user_plan(x_user_id, supabase)
    if plan not in ("pro", "biz", "enterprise"):
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "required_plans": ["pro", "biz", "enterprise"]},
        )

    # 월별 한도 체크 — COUNT 스냅샷 후 Claude 호출까지 TOCTOU 레이스 방지 락(M2와 동일 패턴)
    if x_user_id in _ad_defense_locks:
        from utils.system_alert_log import record_alert
        asyncio.create_task(record_alert(
            "AD_DEFENSE_GENERATION_IN_PROGRESS", "AI 광고 대비 가이드 생성 락 충돌(동시 요청)",
            level="info", source="lock_contention",
        ))
        raise HTTPException(
            status_code=409,
            detail={
                "code": "AD_DEFENSE_GENERATION_IN_PROGRESS",
                "message": "이미 가이드 생성이 진행 중입니다. 완료 후 다시 시도해 주세요.",
            },
        )
    _ad_defense_locks.add(x_user_id)
    try:
        # 월별 한도 체크 (2026-07-08 신설 — 이전엔 무제한 호출 가능했음)
        allowed, used, limit = await check_ad_defense_limit(x_user_id, supabase)
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "AD_DEFENSE_LIMIT_EXCEEDED",
                    "used": used,
                    "limit": limit,
                    "message": f"이번 달 AI 광고 대비 가이드 생성 한도({limit}회)를 초과했습니다.",
                    "upgrade_url": "/pricing",
                },
            )

        biz_res, scan_res, comp_res, prev_guide_res = await asyncio.gather(
            execute(
                supabase.table("businesses")
                .select("id, name, category, region, keywords, website_url, is_franchise")
                .eq("id", biz_id).single()
            ),
            execute(
                supabase.table("scan_results")
                .select("id, total_score, score_breakdown, gemini_result, chatgpt_result, naver_result, google_result, naver_channel_score, global_channel_score, competitor_scores")
                .eq("business_id", biz_id)
                .order("scanned_at", desc=True)
                .limit(1)
            ),
            execute(
                supabase.table("competitors").select("name").eq("business_id", biz_id).limit(3)
            ),
            # 직전 ad_defense 가이드의 저장된 스냅샷 — "지난 가이드 이후 변화" 비교용.
            # score_history(일별 자동 적재)는 스캔이 실제로 없었던 기간에도 0으로 채워지는
            # 사례를 실측 확인해(2026-09-02) 신뢰할 수 없음 — 반드시 실제 scan_results
            # 시점에만 존재하는 스냅샷끼리 비교해야 허위 "0으로 폭락" 표시를 피할 수 있음.
            execute(
                supabase.table("guides")
                .select("items_json")
                .eq("business_id", biz_id)
                .eq("context", "ad_defense")
                .order("generated_at", desc=True)
                .limit(1)
            ),
            return_exceptions=True,
        )
        if isinstance(biz_res, Exception):
            raise biz_res
        biz = biz_res.data
        if not biz:
            raise HTTPException(status_code=404, detail="Business not found")
        if isinstance(scan_res, Exception):
            raise scan_res
        scan = scan_res.data
        if not scan:
            raise HTTPException(status_code=404, detail="No scan results found")

        from services.ad_defense_guide import AdDefenseGuideService
        from services.score_engine import get_briefing_eligibility
        eligibility = get_briefing_eligibility(biz.get("category", ""), bool(biz.get("is_franchise")))

        # 경쟁사 이름 조회 (최대 3개, 미등록 시 빈 배열)
        competitor_names: list[str] = []
        try:
            if isinstance(comp_res, Exception):
                raise comp_res
            competitor_names = [c.get("name", "") for c in (comp_res.data or []) if c.get("name")]
        except Exception as _ce:
            _logger.warning(f"ad-defense 경쟁사 조회 실패 — 빈 배열 사용 [biz={biz_id}]: {_ce}")

        # 실제 AI에 언급된 경쟁사만 추출 — competitor_scores는 백그라운드에서 채워져
        # null일 수 있고, score_estimated=true 항목은 실측이 아닌 추정 폴백이라 제외
        # (2026-09-02 라이브 데이터로 두 케이스 모두 확인).
        competitor_mentioned_names: list[str] = []
        try:
            _comp_scores = (scan[0].get("competitor_scores") or {}) if isinstance(scan, list) and scan else {}
            competitor_mentioned_names = [
                v.get("name", "") for v in _comp_scores.values()
                if v.get("mentioned") is True and not v.get("score_estimated") and v.get("name")
            ]
        except Exception as _cme:
            _logger.warning(f"ad-defense 경쟁사 노출현황 조회 실패 — 생략 [biz={biz_id}]: {_cme}")

        # 미확보 키워드 (gap_analyzer 재사용, 실패 시 빈 배열)
        gap_keywords: list[str] = []
        try:
            from services.gap_analyzer import analyze_gap_from_db
            _gap = await analyze_gap_from_db(biz_id, supabase)
            if _gap and _gap.review_keyword_gap:
                gap_keywords = (_gap.review_keyword_gap.missing_keywords or [])[:5]
        except Exception as _ge:
            _logger.warning(f"ad-defense gap_keywords 조회 실패 — 빈 배열 사용 [biz={biz_id}]: {_ge}")

        # 직전 ad_defense 가이드 스냅샷에서 global_channel_score만 추출(있을 때만)
        prev_global_channel_score = None
        try:
            if not isinstance(prev_guide_res, Exception) and prev_guide_res.data:
                _prev_items = prev_guide_res.data[0].get("items_json") or {}
                prev_global_channel_score = _prev_items.get("global_channel_score")
        except Exception as _pge:
            _logger.warning(f"ad-defense 직전 스냅샷 조회 실패 — 생략 [biz={biz_id}]: {_pge}")

        svc = AdDefenseGuideService()
        result = await svc.generate(
            biz, scan[0], eligibility, competitor_names, gap_keywords,
            competitor_mentioned_names=competitor_mentioned_names,
            prev_global_channel_score=prev_global_channel_score,
        )

        # 사용량 카운트 — AI 호출 성공 후에만 기록 (crisis_reply와 동일 원칙)
        # items_json에 결과 전체를 저장(2026-09-02 추가) — 기존엔 카운터 행만 남기고
        # 실제 가이드 내용은 응답 한 번(React state)에만 존재해 페이지 새로고침·재방문 시
        # 영구 소실됐음. 유료 플랜 월 한도(Pro 5/Biz 10회)를 태워 만든 Claude Sonnet
        # 결과인데 다시 보려면 한도를 또 소모해 재생성해야 했던 문제.
        is_fallback = result.get("is_fallback", False) if isinstance(result, dict) else False
        if not is_fallback:
            try:
                _ins = await execute(
                    supabase.table("guides").insert({
                        "business_id": biz_id,
                        "context": "ad_defense",
                        "items_json": result if isinstance(result, dict) else None,
                        "generated_at": datetime.now(timezone.utc).isoformat(),
                    })
                )
                # 체크리스트 추적용 — 기존 PATCH /{guide_id}/checklist를 그대로 재사용하기
                # 위해 방금 insert한 행의 id를 응답에 포함(2026-09-02 추가)
                if _ins and _ins.data and isinstance(result, dict):
                    result["id"] = _ins.data[0].get("id")
            except Exception as e:
                _logger.warning(f"ad-defense 사용량 기록 실패 (응답은 정상 반환, biz={biz_id}): {e}")

        if isinstance(result, dict):
            result["used"] = used if is_fallback else used + 1
            result["limit"] = limit
        return result
    finally:
        _ad_defense_locks.discard(x_user_id)


async def _generate_and_save_release_lock(req: GuideRequest, user_id: str):
    """_generate_and_save 실행 후 월별 한도 락 해제 (M2 레이스 방지, _guide_generation_locks 참조)."""
    try:
        await _generate_and_save(req)
    finally:
        _guide_generation_locks.discard(user_id)


async def _generate_and_save(req: GuideRequest):
    """가이드 생성 백그라운드 태스크 — ActionPlan 구조로 저장"""
    try:
        supabase = get_client()
        biz_res, scan_res, comp_res = await asyncio.gather(
            execute(
                supabase.table("businesses")
                .select("id, name, category, region, keywords, website_url, google_place_id, kakao_place_id, business_type, naver_place_id, address, phone, is_smart_place, has_faq, has_intro, has_recent_post, review_count, avg_rating, visitor_review_count, receipt_review_count, blog_analysis_json, sp_completeness_json, is_franchise")
                .eq("id", req.business_id).single()
            ),
            execute(
                supabase.table("scan_results")
                .select("id, total_score, score_breakdown, naver_channel_score, global_channel_score, kakao_result, website_check_result, chatgpt_result, naver_result, google_result, gemini_result, exposure_freq, track1_score, track2_score, competitor_scores")
                .eq("id", req.scan_id).single()
            ),
            execute(
                supabase.table("competitors")
                .select("id, name")
                .eq("business_id", req.business_id)
                .eq("is_active", True)
            ),
        )
        biz = biz_res.data
        if not biz:
            _logger.error(f"Guide gen: business {req.business_id} not found")
            return
        scan = scan_res.data
        if not scan:
            _logger.error(f"Guide gen: scan {req.scan_id} not found")
            return
        competitors = comp_res.data or []

        # 경쟁사 점수 (scan_results.competitor_scores)
        raw_comp = scan.get("competitor_scores") or {}
        competitor_data = [
            {
                "name": v.get("name", k),
                "score": float(v.get("score", 0)),
                "exposure_freq": float(v.get("exposure_freq", 0)),
                "breakdown": v.get("breakdown", {}),
            }
            for k, v in raw_comp.items()
        ] if isinstance(raw_comp, dict) else []

        context = biz.get("business_type") or "location_based"
        generator = GuideGenerator()

        # AI 브리핑·AI탭 적합성 (가이드 콘텐츠 분기용)
        from services.score_engine import get_briefing_eligibility, get_ai_tab_eligibility
        _category = biz.get("category", "other")
        _is_franchise = bool(biz.get("is_franchise"))
        briefing_eligibility = get_briefing_eligibility(_category, _is_franchise)
        ai_tab_eligibility = get_ai_tab_eligibility(_category)

        score_data = {
            "total_score": scan.get("total_score", 0),
            "exposure_freq": scan.get("exposure_freq", 0),
            "breakdown": scan.get("score_breakdown", {}),
            "naver_channel_score": scan.get("naver_channel_score"),
            "global_channel_score": scan.get("global_channel_score"),
            "track1_score": scan.get("track1_score"),
            "track2_score": scan.get("track2_score"),
            "context": context,
            "kakao_result": scan.get("kakao_result"),
            "website_check_result": scan.get("website_check_result"),
            "chatgpt_result": scan.get("chatgpt_result"),
            "naver_result": scan.get("naver_result"),
            "google_result": scan.get("google_result"),
            "gemini_result": scan.get("gemini_result"),
            "briefing_eligibility": briefing_eligibility,
            "ai_tab_eligibility": ai_tab_eligibility,
        }

        # gap_analyzer로 keyword_gap + growth_stage 조회 (경쟁사 실데이터 기반 구체 조언 제공)
        keyword_gap = None
        growth_stage_dict = None
        try:
            from services.gap_analyzer import analyze_gap_from_db
            gap_result = await analyze_gap_from_db(req.business_id, supabase)
            if gap_result and gap_result.keyword_gap:
                keyword_gap = gap_result.keyword_gap
            if gap_result and gap_result.growth_stage:
                growth_stage_dict = gap_result.growth_stage.model_dump()
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
            growth_stage=growth_stage_dict,
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
            # 노출 횟수의 분모(플랜별 표본 크기 50/100) — 절대값 임계값 판정 시 정규화용
            "my_freq_max": int((score_data.get("gemini_result") or {}).get("sample_size") or 50),
            "track1_score": round(float(score_data.get("track1_score") or 0), 1) if score_data.get("track1_score") is not None else None,
            "track2_score": round(float(score_data.get("track2_score") or 0), 1) if score_data.get("track2_score") is not None else None,
            # 주의: naver_result.mentioned은 일반 플레이스 검색결과 노출까지 포함하는 넓은 신호이고,
            # in_briefing이 실제 AI 브리핑 박스 인용 여부다(naver_scanner.py:244-245 "mentioned": mentioned or in_briefing).
            # "AI 브리핑에 있다"고 단정하려면 반드시 in_briefing을 봐야 한다.
            "naver_in_briefing": bool((score_data.get("naver_result") or {}).get("in_briefing", False)),
            # CAPTCHA 차단·API 오류로 측정 자체가 안 된 경우 프론트가 "미노출 확정"으로 표시하지 않도록
            "naver_measured": not (
                bool((score_data.get("naver_result") or {}).get("captcha_detected"))
                or bool((score_data.get("naver_result") or {}).get("error"))
            ),
            "chatgpt_mentioned": bool(
                (score_data.get("chatgpt_result") or {}).get("mentioned")
                or (score_data.get("chatgpt_result") or {}).get("exposure_freq", 0) > 0
            ),
            # 네이버와 동일하게 스캔 자체 실패(error)를 "미언급 확정"과 구분
            "chatgpt_measured": not bool((score_data.get("chatgpt_result") or {}).get("error")),
            "gemini_measured": not bool((score_data.get("gemini_result") or {}).get("error")),
            "keyword_gap_count": len((_kw_gap_dict_ss or {}).get("missing_keywords") or []),
            "coverage_rate": float((_kw_gap_dict_ss or {}).get("coverage_rate") or 0),
            "competitor_count": len(competitor_data or []),
        }

        # D.I.A. 점수 — generate_action_plan()이 재생성 후 이미 검증 완료한 점수 우선 사용
        # generate_action_plan() 미실행(하위호환 경로) 시 사후 검증 폴백
        if action_plan.dia_score is not None:
            tools_data["dia_score"] = action_plan.dia_score
            tools_data["dia_regenerated"] = action_plan.dia_regenerated or 0
            if action_plan.dia_improvement_hints:
                tools_data["dia_improvement_hints"] = action_plan.dia_improvement_hints
        else:
            try:
                from services.content_validator import validate_intro_dia
                guide_text = " ".join(
                    [action_plan.summary or ""] +
                    [item.get("title", "") + " " + item.get("description", "") for item in base_payload["items_json"]]
                )
                biz_keywords = biz.get("keywords") or []
                dia = validate_intro_dia(guide_text, keywords=biz_keywords, lsi_keywords=biz_keywords)
                tools_data["dia_score"] = dia.get("score")
                tools_data["dia_regenerated"] = 0
                if (dia.get("score") or 0) < 90:
                    _logger.warning(
                        "[D.I.A. 검증] guide biz=%s score=%s diversity=%s information=%s timeliness=%s",
                        req.business_id, dia.get("score"),
                        dia.get("diversity", {}).get("score"),
                        dia.get("information", {}).get("score"),
                        dia.get("timeliness", {}).get("score"),
                    )
            except Exception as dia_exc:
                _logger.warning("guide_generator: D.I.A. 검증 실패 (%s)", dia_exc)

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
        _logger.error(f"Guide generation failed (biz={req.business_id}, scan={req.scan_id}): {e}", exc_info=True)


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
    from middleware.plan_gate import get_user_plan, PLAN_LIMITS, _DEV_MODE
    from services.guide_generator import generate_talktalk_faq
    from datetime import datetime, timezone

    _CAT_KO = {
        "restaurant": "음식점", "cafe": "카페", "bakery": "베이커리", "bar": "주점",
        "beauty": "미용실", "nail": "네일샵", "medical": "의료/병원", "pharmacy": "약국",
        "fitness": "헬스/피트니스", "yoga": "요가/필라테스", "pet": "반려동물",
        "education": "교육/학원", "tutoring": "과외", "legal": "법률/법무",
        "realestate": "부동산", "interior": "인테리어", "auto": "자동차",
        "cleaning": "청소/세탁", "shopping": "쇼핑", "fashion": "패션",
        "photo": "사진스튜디오", "video": "영상제작", "design": "디자인",
        "accommodation": "숙박", "other": "기타",
    }

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
        .select("id, name, category, region, user_id, talktalk_faq_draft, keywords")
        .eq("id", biz_id)
        .single()
    )
    if not biz_row.data or biz_row.data.get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")

    biz = biz_row.data

    # TOCTOU 방지 락 — business.py의 intro-generate/global-ai-intro-generate/talktalk-faq-generate
    # 3곳과 faq_monthly 한도를 공유하는 4번째 경로라 같은 공유 락으로 방어(2026-08-06, plan_gate.py 참조)
    from middleware.plan_gate import _faq_monthly_generation_locks
    if user_id in _faq_monthly_generation_locks:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "INTRO_GENERATION_IN_PROGRESS",
                "message": "이미 생성이 진행 중입니다. 완료 후 다시 시도해 주세요.",
            },
        )
    _faq_monthly_generation_locks.add(user_id)
    try:
        # 월별 사용 횟수 체크 — intro_draft + faq_draft + talktalk_faq 합산 (plan_gate faq_monthly 공유 한도)
        # DEV_MODE=true 시 한도 검사 전체 우회
        now = datetime.now(timezone.utc)
        used = 0
        if not _DEV_MODE:
            month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
            used_res = await execute(
                supabase.table("guides")
                .select("id", count="exact")
                .eq("business_id", biz_id)
                .in_("context", ["intro_draft", "faq_draft", "talktalk_faq"])
                .gte("generated_at", month_start)
            )
            used = used_res.count or 0
            if used >= limit:
                raise HTTPException(
                    status_code=429,
                    detail=f"이번 달 소개글·FAQ 합산 한도({limit}회)에 도달했습니다",
                )

        # 키워드 결정: 사용자 제공 키워드 우선, 없으면 사업장에 등록된 키워드(실제 보유 서비스) 사용.
        # top_missing_keywords(갭분석상 "미보유 추정" 키워드, scan_results)는 여기서 쓰지 않는다 —
        # 아래 프롬프트가 이 값을 "주요 서비스"로 Claude에 전달해 단정 서술로 이어지면
        # 사실 지어내기가 된다(2026-07-08 guide_generator intro 사고와 동일 계열, 2026-08-22 발견).
        if req.keywords:
            final_keywords = req.keywords
        else:
            _biz_kw = biz.get("keywords")
            final_keywords = _biz_kw if isinstance(_biz_kw, list) else []

        category_label = _CAT_KO.get(biz.get("category", ""), biz.get("category", ""))
        services = ", ".join(final_keywords) if final_keywords else ""

        _SMARTPLACE_FAQ_FALLBACK = {
            "items": [
                {"question": f"{biz.get('name', '')} 가격이 어떻게 되나요?", "answer": "정확한 가격은 매장으로 문의해 주세요.", "category": "가격"},
                {"question": "예약은 어떻게 하나요?", "answer": "전화 또는 네이버 예약으로 미리 예약하시면 대기 없이 이용하실 수 있습니다.", "category": "예약"},
                {"question": "위치가 어디인가요?", "answer": f"{biz.get('region', '')}에 위치해 있습니다. 상세 주소는 네이버 지도를 확인해 주세요.", "category": "위치"},
                {"question": "주차가 가능한가요?", "answer": "주차 가능 여부는 매장으로 문의해 주세요.", "category": "위치"},
                {"question": "영업시간이 어떻게 되나요?", "answer": "영업시간은 매장으로 문의하거나 네이버 플레이스에서 확인해 주세요.", "category": "예약"},
            ],
            "chat_menus": ["가격 안내", "예약 방법", "위치/교통", "영업시간", "서비스 안내"],
        }

        is_fallback = False
        try:
            result = await generate_talktalk_faq(
                biz_name=biz.get("name", ""),
                category_label=category_label,
                region=biz.get("region", ""),
                services=services,
                count=5,
            )
            if not result or not isinstance(result.get("items"), list):
                _logger.warning(f"smartplace-faq 응답 구조 불량 (biz={biz_id}), 폴백 사용")
                result = _SMARTPLACE_FAQ_FALLBACK
                is_fallback = True
        except Exception as e:
            _logger.warning(f"smartplace-faq Claude 호출 실패 (biz={biz_id}): {e}, 폴백 사용")
            result = _SMARTPLACE_FAQ_FALLBACK
            is_fallback = True

        items: list = result.get("items") or []
        raw_menus: list = result.get("chat_menus") or []

        # 톡톡 채팅방 메뉴 객체화 — AI는 chat_menus를 ["가격 안내", ...] 형태의 string[](메뉴명만)로 반환한다.
        # 그대로 두면 프론트 normalizeChatMenus가 message==menu_name으로 변환해 "메뉴명==메시지" 저가치 표시가 된다.
        # → 메뉴명을 items의 카테고리와 매칭해 해당 Q&A 답변을 메시지로 채운다(클릭 시 보낼 실제 안내문).
        def _menu_message_for(name: str, idx: int) -> str:
            # 1순위: 메뉴명에 카테고리가 포함된 Q&A 답변 (예: "가격 안내" → 카테고리 "가격")
            for it in items:
                cat = (it.get("category") or "").strip()
                if cat and cat in name:
                    return (it.get("answer") or "").strip()
            # 2순위: 같은 순번 Q&A (AI가 메뉴·Q&A를 동일 주제 순서로 생성하므로 위치/서비스 등 명칭 불일치 보정)
            if 0 <= idx < len(items):
                return (items[idx].get("answer") or "").strip()
            return ""

        # 메뉴명 6자 제한(네이버 톡톡 메뉴명 제약) — 잘림 후 끝 공백 제거로 "자주 묻는 " 같은 어색한 표시 방지
        def _clip_name(s: str) -> str:
            return s.strip()[:6].strip()

        chat_menus: list = []
        for i, m in enumerate(raw_menus[:5]):
            if isinstance(m, str):
                nm = m.strip()
                chat_menus.append({"menu_name": _clip_name(nm), "link_type": "message", "message": _menu_message_for(nm, i)})
            elif isinstance(m, dict):
                nm = str(m.get("menu_name") or m.get("name") or "").strip()
                msg = (m.get("message") or "").strip() or _menu_message_for(nm, i)
                entry = {"menu_name": _clip_name(nm), "link_type": m.get("link_type") or "message", "message": msg}
                if m.get("url"):
                    entry["url"] = m.get("url")
                chat_menus.append(entry)

        # AI가 chat_menus를 누락한 경우 items(Q&A)로부터 직접 파생
        if not chat_menus and items:
            for idx, it in enumerate(items[:6]):
                ans = (it.get("answer") or "").strip()
                if not ans:
                    continue
                name = _clip_name((it.get("category") or "").strip() or (it.get("question") or "").strip() or f"메뉴{idx + 1}")
                chat_menus.append({"menu_name": name, "link_type": "message", "message": ans})

        # guides 테이블에 저장 (이력용) — 폴백(AI 실패)이면 한도 소비 없이 저장 건너뜀 (business.py 패턴과 동일)
        if not is_fallback:
            try:
                await execute(
                    supabase.table("guides").insert({
                        "business_id": biz_id,
                        "context": "faq_draft",
                        "items_json": items,
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
                    "talktalk_faq_draft": {"items": items, "chat_menus": chat_menus},
                    "talktalk_faq_generated_at": now.isoformat(),
                })
                .eq("id", biz_id)
            )
        except Exception as biz_save_err:
            _logger.warning(f"FAQ draft businesses 저장 실패 (컬럼 없을 수 있음): {biz_save_err}")

        # 폴백(AI 실패)이면 guides 저장을 건너뛰므로(위 is_fallback 분기) 한도 카운트도 늘리지 않음 — 실제 소비 없이 표시만 부풀리는 것 방지
        return {"is_fallback": is_fallback, "items": items, "chat_menus": chat_menus, "used": used if is_fallback else used + 1, "limit": limit, "keywords_used": final_keywords}
    finally:
        _faq_monthly_generation_locks.discard(user_id)


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
    from middleware.plan_gate import check_crisis_reply_limit
    from datetime import datetime, timezone

    user_id = current_user.get("id") or current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="인증 정보가 없습니다")

    # 요청속도 제한 — 무제한(999) 티어 스크립트 남용 방지, DB 조회 전에 먼저 차단
    _check_ai_reply_rate_limit(user_id, "crisis_reply")

    supabase = get_client()

    # 소유권 검증
    await _verify_biz_ownership(supabase, biz_id, user_id)

    # Basic+ 플랜 체크
    from middleware.plan_gate import get_user_plan
    _plan = await get_user_plan(user_id, supabase)
    if _plan == "free":
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "required_plans": ["basic", "pro", "biz"]},
        )

    # 월별 한도 체크 (2026-07-06 신설) — COUNT 스냅샷 후 Claude 호출까지 TOCTOU 레이스 방지 락(M2와 동일 패턴)
    if user_id in _crisis_reply_locks:
        from utils.system_alert_log import record_alert
        asyncio.create_task(record_alert(
            "CRISIS_REPLY_IN_PROGRESS", "위기관리 가이드 생성 락 충돌(동시 요청)",
            level="info", source="lock_contention",
        ))
        raise HTTPException(
            status_code=409,
            detail={
                "code": "CRISIS_REPLY_IN_PROGRESS",
                "message": "이미 위기관리 가이드 생성이 진행 중입니다. 완료 후 다시 시도해 주세요.",
            },
        )
    _crisis_reply_locks.add(user_id)
    try:
        allowed, used, limit = await check_crisis_reply_limit(user_id, supabase)
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "CRISIS_REPLY_LIMIT_EXCEEDED",
                    "used": used,
                    "limit": limit,
                    "message": f"이번 달 위기관리 가이드 생성 한도({limit}회)를 초과했습니다.",
                    "upgrade_url": "/pricing",
                },
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

        from services.schema_generator import CATEGORY_KO
        result = await generate_crisis_reply(
            review_text=review_text,
            business_name=biz.get("name", ""),
            category=CATEGORY_KO.get(biz.get("category", ""), biz.get("category", "")),
            rating=rating,
        )

        # 사용량 카운트 — 폴백(AI 실패)이면 실제 소비 없음으로 간주해 기록 생략 (review-reply/faq와 동일 원칙)
        is_fallback = result.get("is_fallback", False)
        if not is_fallback:
            try:
                await execute(
                    supabase.table("guides").insert({
                        "business_id": biz_id,
                        "context": "crisis_reply",
                        "generated_at": datetime.now(timezone.utc).isoformat(),
                    })
                )
            except Exception as e:
                _logger.warning(f"crisis-reply 사용량 기록 실패 (응답은 정상 반환, biz={biz_id}): {e}")

        result["used"] = used if is_fallback else used + 1
        result["limit"] = limit
        return result
    finally:
        _crisis_reply_locks.discard(user_id)


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
        from services.anthropic_retry import create_message_with_retry
        client = _get_guide_ai_client(os.getenv("ANTHROPIC_API_KEY", ""))
        try:
            msg = await create_message_with_retry(
                client,
                model="claude-haiku-4-5-20251001",
                max_tokens=1000,
                messages=[{"role": "user", "content": prompt}],
            )
        except Exception as _ce:
            log_ai_usage("claude", "claude-haiku-4-5-20251001", f"pioneer_detail:FAILED:{type(_ce).__name__}", 0, 0)
            raise
        try:
            log_ai_usage("claude", "claude-haiku-4-5-20251001", "pioneer_detail", msg.usage.input_tokens, msg.usage.output_tokens)
        except Exception as _le:
            import logging as _logging
            _logging.getLogger(__name__).debug("pioneer_detail usage 로깅 실패(무시): %s", _le)
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

    # 사업장 정보 + 최신 스캔 키워드 병렬 조회 (두 쿼리 독립적)
    biz_row, scan_row = await asyncio.gather(
        execute(
            supabase.table("businesses")
            .select("name, region, category")
            .eq("id", biz_id)
            .maybe_single()
        ),
        execute(
            supabase.table("scan_results")
            .select("top_missing_keywords")
            .eq("business_id", biz_id)
            .order("scanned_at", desc=True)
            .limit(1)
            .maybe_single()
        ),
    )
    if not biz_row.data:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")

    biz = biz_row.data
    biz_name = biz.get("name", "")
    region = biz.get("region", "")
    category = biz.get("category", "")

    top_missing: list[str] = []
    if scan_row.data:
        top_missing = (scan_row.data.get("top_missing_keywords") or [])[:5]

    from services.schema_generator import CATEGORY_KO
    category_ko = CATEGORY_KO.get(category, category)

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

        raw = (data.get("candidates") or [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
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

    # 사업장 category, keywords, blog_analysis_json 조회
    biz_row = await execute(
        supabase.table("businesses")
        .select("category, keywords, blog_analysis_json")
        .eq("id", biz_id)
        .maybe_single()
    )
    if not (biz_row and biz_row.data):
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다")

    biz = biz_row.data
    category: str = biz.get("category") or "restaurant"
    my_keywords: list[str] = biz.get("keywords") or []

    # 블로그 분석에서 이미 발견된 키워드도 "보유" 키워드로 포함
    blog_covered: list[str] = []
    blog_json = biz.get("blog_analysis_json")
    if isinstance(blog_json, dict):
        blog_covered = blog_json.get("covered_keywords") or []

    # taxonomy 키 정규화 (없으면 "restaurant" fallback)
    taxonomy_key: str = _CATEGORY_ALIASES.get(category, "restaurant")
    taxonomy_dict: dict = KEYWORD_TAXONOMY.get(taxonomy_key, KEYWORD_TAXONOMY.get("restaurant", {}))

    # ⚠️ 2026-07-02: 이전에는 scan_results.keyword_coverage(JSONB로 가정)에서 covered_keywords를
    # 보완하려 했으나, 해당 컬럼은 실제로 NUMERIC(4,2) 스칼라 비율이라 dict 파싱이 항상 실패해
    # 아무 값도 추가하지 못하는 죽은 코드였다. 실측 커버리지 키워드 목록은 gap_analyzer가 계산하는
    # GapAnalysis.covered_keywords에만 존재하며 이 엔드포인트는 그 결과를 조회하지 않으므로 제거함.
    # 전체 covered 키워드 집합 (내 키워드 + 블로그 분석 covered)
    all_covered_set: set[str] = set(my_keywords) | set(blog_covered)

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
