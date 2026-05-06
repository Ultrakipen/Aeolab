"""AI 어시스턴트 채팅 — Claude Haiku 기반, 사업장 컨텍스트 주입"""
import logging
import os
from datetime import datetime, timezone
from typing import Optional

import aiohttp
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db.supabase_client import get_client, execute
from middleware.plan_gate import get_current_user

router = APIRouter()
_logger = logging.getLogger(__name__)

_ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
_HAIKU_MODEL = "claude-haiku-4-5-20251001"
_MAX_TOKENS = 400

# Basic+ 월 20회, Pro+ 무제한
_MONTHLY_LIMITS = {
    "basic": 20,
    "startup": 20,
    "pro": 999,
    "biz": 999,
    "enterprise": 999,
}

_QUICK_QUESTIONS = [
    "내 점수가 왜 낮아요?",
    "FAQ를 어디에 올리나요?",
    "경쟁 가게보다 뒤처진 이유가 뭔가요?",
]

_SYSTEM_PROMPT = """당신은 AEOlab의 소상공인 전담 AI 도우미입니다.
40~60대 소상공인도 쉽게 이해할 수 있도록 간결하고 친근하게 답변하세요.
전문 용어보다 일상 언어를 사용하고, 항상 구체적인 행동 1가지를 제안하세요.
답변은 3~5문장 이내로 짧게 유지하세요.

사업장 정보:
{context}
"""


class ChatRequest(BaseModel):
    business_id: Optional[str] = None
    question: str


class ChatResponse(BaseModel):
    answer: str
    quick_questions: list = _QUICK_QUESTIONS


async def _get_biz_context(biz_id: str, user_id: str) -> str:
    """사업장 컨텍스트 문자열 생성"""
    try:
        supabase = get_client()
        biz = (await execute(
            supabase.table("businesses")
            .select("name, category, region")
            .eq("id", biz_id)
            .eq("user_id", user_id)
            .single()
        )).data
        if not biz:
            return "사업장 정보 없음"
        # 최근 점수
        score_row = (await execute(
            supabase.table("scan_results")
            .select("unified_score, track1_score, track2_score, growth_stage")
            .eq("business_id", biz_id)
            .order("scanned_at", desc=True)
            .limit(1)
        )).data
        score_info = ""
        if score_row:
            s = score_row[0]
            score_info = (
                f"AI 노출 점수: {s.get('unified_score', 0):.1f}점 "
                f"(네이버 {s.get('track1_score', 0):.1f} / 글로벌 {s.get('track2_score', 0):.1f}), "
                f"성장단계: {s.get('growth_stage', '알 수 없음')}"
            )
        return (
            f"가게명: {biz['name']}, 업종: {biz['category']}, 지역: {biz['region']}. "
            f"{score_info}"
        )
    except Exception as e:
        _logger.warning("biz context fetch failed: %s", e)
        return "사업장 정보를 불러오지 못했습니다."


async def _check_monthly_limit(user_id: str, plan: str) -> bool:
    """월별 사용 횟수 체크"""
    limit = _MONTHLY_LIMITS.get(plan, 20)
    if limit >= 999:
        return True
    try:
        supabase = get_client()
        month_start = datetime.now(timezone.utc).replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
        count_resp = (await execute(
            supabase.table("assistant_logs")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .gte("created_at", month_start.isoformat())
        ))
        count = count_resp.count if hasattr(count_resp, "count") and count_resp.count else 0
        return count < limit
    except Exception as e:
        _logger.warning(f"assistant rate limit check failed (fail-open): {e}")
        return True


@router.get("/quick-questions")
async def get_quick_questions():
    """빠른 질문 목록 (공개)"""
    return {"questions": _QUICK_QUESTIONS}


@router.post("/chat", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    current_user=Depends(get_current_user),
):
    """AI 어시스턴트 채팅 — Basic+ 월 20회"""
    from middleware.plan_gate import get_user_plan, PLAN_HIERARCHY

    user_id = current_user["id"]
    supabase = get_client()

    # 플랜 확인
    plan = await get_user_plan(user_id, supabase)
    if PLAN_HIERARCHY.get(plan, 0) < PLAN_HIERARCHY.get("basic", 0):
        raise HTTPException(
            status_code=403,
            detail={"code": "PLAN_REQUIRED", "message": "Basic 이상 플랜에서 이용할 수 있습니다", "upgrade_url": "/pricing"},
        )

    # 월별 한도 체크
    if not await _check_monthly_limit(user_id, plan):
        raise HTTPException(
            status_code=429,
            detail="이번 달 AI 어시스턴트 사용 횟수를 초과했습니다 (Basic: 월 20회)",
        )

    # 컨텍스트 구성
    context = ""
    if req.business_id:
        context = await _get_biz_context(req.business_id, user_id)

    system = _SYSTEM_PROMPT.format(context=context or "사업장 정보 없음")

    if not _ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="AI 서비스를 사용할 수 없습니다")

    # Claude Haiku 호출
    answer = "죄송합니다. 답변을 생성하지 못했습니다. 잠시 후 다시 시도해주세요."
    try:
        async with aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30)
        ) as session:
            async with session.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": _ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": _HAIKU_MODEL,
                    "max_tokens": _MAX_TOKENS,
                    "system": system,
                    "messages": [{"role": "user", "content": req.question}],
                },
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    answer = data["content"][0]["text"]
                else:
                    _logger.warning("claude haiku returned status %d", resp.status)
    except Exception as e:
        _logger.warning("claude haiku chat failed: %s", e)

    # 로그 저장
    try:
        await execute(
            supabase.table("assistant_logs").insert({
                "user_id": user_id,
                "business_id": req.business_id,
                "question": req.question[:500],
                "answer": answer[:1000],
            })
        )
    except Exception as e:
        _logger.warning("assistant log save failed: %s", e)

    return ChatResponse(answer=answer)
