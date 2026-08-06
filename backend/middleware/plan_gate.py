import os
import logging
from fastapi import HTTPException, Depends, Header

# DEV_MODE=true 시 수동 스캔 일 한도 검사를 건너뜀.
_DEV_MODE = os.getenv("DEV_MODE", "").lower() in ("1", "true", "yes")
from functools import wraps
from typing import Optional
from datetime import date
from db.supabase_client import get_client, execute as _exec

_logger = logging.getLogger(__name__)

# ─── 개발 기간 관리자 이메일 (biz 권한 부여) ────────────────────────────────────
# .env ADMIN_EMAILS 환경변수로 관리 (쉼표 구분 복수 설정 가능)
ADMIN_EMAILS: set[str] = {
    e.strip().lower()
    for e in os.getenv("ADMIN_EMAILS", "hoozdev@gmail.com").split(",")
    if e.strip()
}

# ─── 플랜별 한도 정의 ──────────────────────────────────────────────────────────
#
# auto_scan_mode:
#   None     → 자동 스캔 없음 (free)
#   "basic"  → Gemini 50회 + ChatGPT 50회 + 네이버 자동 스캔 (A안 50/50).
#              실행 주기는 auto_scan_mode 문자열이 아니라 scheduler/jobs.py의 plan 값으로 분기:
#              basic 플랜=주 2회(월·목, 2026-07-15 창업패키지 대비 차별화) / startup 플랜=주 1회(월요일만)
#   "pro"    → 8개 AI 전체 스캔 주 3회(월·수·금) / 나머지 날 basic (pro)
#   "full"   → 8개 AI 매일 (biz)
#
# guide_monthly        : 월 Claude Sonnet 가이드 생성 허용 횟수 (999 = 무제한)
# manual_scan_daily    : 하루 수동 스캔 허용 횟수 (999 = 무제한)
# history_days         : 점수 히스토리 보관 일수 (999 = 무제한)
# businesses           : 등록 가능 사업장 수
# review_reply_monthly : 월 리뷰 답변 생성 허용 횟수 (Claude Haiku 사용)
# keyword_suggest_monthly : 월 키워드 제안 생성 허용 횟수
# ──────────────────────────────────────────────────────────────────────────────
PLAN_LIMITS = {
    "free": {
        "competitors": 0,
        "guide_monthly": 0,
        "manual_scan_daily": 0,
        "auto_scan_mode": None,
        "schema": False, "pdf": False, "csv": False,
        "startup_report": False, "api_keys": False,
        "history_days": 0,
        "businesses": 1,
        "ad_defense": False,
        "ad_defense_monthly": 0,
        "review_reply_monthly": 0,
        "faq_monthly": 0,
        "blog_monthly": 0,
        "keyword_suggest_monthly": 0,
        "crisis_reply_monthly": 0,
        "startup_report_monthly": 0,
        "support_ticket_monthly": 1,  # support.py/inquiry.py 단일 소스 (2026-07-15 통합)
    },
    "basic": {
        # v3.5 한도 조정: 리뷰답변 20→50회, 소개글+채팅방메뉴 5→10건 (Haiku 추가 비용 <25원/월)
        "competitors": 3,
        "guide_monthly": 3,
        "manual_scan_daily": 2,
        "auto_scan_mode": "basic",
        "schema": True, "pdf": False, "csv": True,
        "startup_report": False, "api_keys": False,
        "history_days": 60,
        "businesses": 1,
        "ad_defense": False,
        "ad_defense_monthly": 0,  # basic은 ad_defense 기능 미제공
        "review_reply_monthly": 50,
        "faq_monthly": 10,
        "blog_monthly": 5,  # 2026-07-18 naeo.kr 경쟁분석 후 3→5 상향(무료 경쟁사도 월5회라 최소 동등 수준 확보)
        "keyword_suggest_monthly": 5,
        "crisis_reply_monthly": 20,  # 부정 리뷰 위기관리(Claude Haiku) — 무제한 호출 방지용 신설(2026-07-06)
        "startup_report_monthly": 0,  # basic은 startup_report 미제공
        "support_ticket_monthly": 3,
    },
    "pro": {
        # v3.4 강화: 리뷰답변 무제한, 히스토리 90일, FAQ 무제한 (Basic보다 낮으면 안 됨)
        "competitors": 5,
        "guide_monthly": 10,
        "manual_scan_daily": 5,
        "auto_scan_mode": "pro",
        "schema": True, "pdf": True, "csv": True,
        "startup_report": False, "api_keys": False,
        "history_days": 90,
        "businesses": 2,
        "ad_defense": True,
        "ad_defense_monthly": 5,  # AI 광고 대비 가이드(Claude Sonnet) — 무제한 호출 방지용 신설(2026-07-08)
        "review_reply_monthly": 999,
        "faq_monthly": 30,  # 소개글+FAQ 합산 — 남용 방지. DEV_MODE=true 시 우회.
        "blog_monthly": 10,
        "keyword_suggest_monthly": 20,
        "crisis_reply_monthly": 999,
        "startup_report_monthly": 0,  # pro는 startup_report 미제공
        "support_ticket_monthly": 999,
    },
    "biz": {
        "competitors": 999,
        "guide_monthly": 20,
        "manual_scan_daily": 10,
        "auto_scan_mode": "full",
        "schema": True, "pdf": True, "csv": True,
        "startup_report": True, "api_keys": True,
        "history_days": 999,
        "businesses": 5,
        "ad_defense": True,
        "ad_defense_monthly": 10,  # AI 광고 대비 가이드(Claude Sonnet) — 무제한 호출 방지용 신설(2026-07-08)
        "review_reply_monthly": 999,
        "faq_monthly": 60,  # 5사업장 합산 — 남용 방지. DEV_MODE=true 시 우회.
        "blog_monthly": 999,
        "keyword_suggest_monthly": 999,
        "crisis_reply_monthly": 999,
        "startup_report_monthly": 10,  # 창업 시장 분석(Claude Sonnet) — 무제한 호출 방지용 신설(2026-07-08)
        "support_ticket_monthly": 999,
    },
    "startup": {
        # v3.4 강화: 리뷰답변 무제한, FAQ 무제한
        "competitors": 5,
        "guide_monthly": 5,
        "manual_scan_daily": 3,
        "auto_scan_mode": "basic",
        "schema": True, "pdf": False, "csv": True,
        "startup_report": True, "api_keys": False,
        "history_days": 90,
        "businesses": 1,
        "ad_defense": False,
        "ad_defense_monthly": 0,  # startup 플랜은 ad_defense 미제공
        "review_reply_monthly": 999,
        "faq_monthly": 20,  # 소개글+FAQ 합산 — 남용 방지. DEV_MODE=true 시 우회.
        "blog_monthly": 5,
        "keyword_suggest_monthly": 10,
        "crisis_reply_monthly": 999,
        "startup_report_monthly": 5,  # 창업 시장 분석(Claude Sonnet) — 무제한 호출 방지용 신설(2026-07-08)
        "support_ticket_monthly": 999,
    },
    "enterprise": {
        # 영업 전용 200,000원/월 — Biz 한도 전부 + 사업장 무제한 + 팀 20명 + API 키 무제한
        "competitors": 999,
        "guide_monthly": 999,
        "manual_scan_daily": 999,
        "auto_scan_mode": "full",
        "schema": True, "pdf": True, "csv": True,
        "startup_report": True, "api_keys": True,
        "history_days": 999,
        "businesses": 999,
        "ad_defense": True,
        "ad_defense_monthly": 999,
        "review_reply_monthly": 999,
        "faq_monthly": 999,
        "blog_monthly": 999,
        "keyword_suggest_monthly": 999,
        "crisis_reply_monthly": 999,
        "startup_report_monthly": 999,
        "support_ticket_monthly": 999,
    },
}

PLAN_HIERARCHY = {"free": 0, "basic": 1, "startup": 1.5, "pro": 2, "biz": 3, "enterprise": 4}


def _end_at_in_future(end_at) -> bool:
    """end_at(ISO 문자열)이 아직 지나지 않았는지 확인. 파싱 실패/None이면 False(보수적).

    end_at은 날짜만 있는 문자열("2026-07-15")로 저장되는 경우가 많은데(webhook.py/jobs.py가
    date().isoformat()로 기록), 그대로 파싱하면 그 날짜의 00:00:00 UTC(=09:00 KST)로 해석되어
    "그 날짜까지 서비스 유지"라고 안내한 마지막 날 오전 9시(KST)부터 이미 만료 취급되는
    실측 버그가 있었다(2026-07-10). 시각 정보가 없는 날짜 문자열은 그 날짜의 하루 전체를
    포함하도록(자정 직전까지) 보정한다.
    """
    if not end_at:
        return False
    from datetime import datetime, timezone, timedelta
    end_at_str = str(end_at)
    try:
        end_dt = datetime.fromisoformat(end_at_str.replace("Z", "+00:00"))
        if end_dt.tzinfo is None:
            end_dt = end_dt.replace(tzinfo=timezone.utc)
        # 시각 정보 없이 날짜만 온 경우(HH:MM:SS 부분이 없음) — 해당 날짜 전체를 포함
        if len(end_at_str) <= 10:
            end_dt = end_dt + timedelta(days=1)
        return end_dt > datetime.now(timezone.utc)
    except (ValueError, TypeError):
        return False


async def get_user_plan(user_id: str, supabase) -> str:
    """현재 사용자의 활성 구독 플랜 반환.

    grace_period 상태(자동결제 실패 후 3일 유예)도 active와 동일하게 취급하여
    유예기간 중 유료 기능이 차단되는 버그를 방지한다.

    cancelled 상태도 end_at 이전이면 active와 동일 취급한다 — settings.py의
    cancel_subscription()이 "해지해도 end_at까지 서비스 유지"라고 명시하고
    프론트(SettingsClient.tsx)도 사용자에게 그렇게 안내하는데, 실제로는
    해지 즉시 free로 강등되던 버그 수정(2026-07-06).

    관리자 이메일(ADMIN_EMAILS)은 개발 기간 동안 biz 플랜으로 취급.
    """
    # ── 관리자 우회: ADMIN_EMAILS 체크 (auth.admin API, 서비스 롤 키 필요) ──────
    if ADMIN_EMAILS:
        try:
            admin_resp = supabase.auth.admin.get_user_by_id(user_id)
            email = (admin_resp.user.email or "").lower() if admin_resp and admin_resp.user else ""
            if email and email in ADMIN_EMAILS:
                return "biz"
        except Exception as e:
            _logger.debug(f"Admin user lookup failed (fallback to normal plan): {e}")

    row = await _exec(
        supabase.table("subscriptions")
        .select("plan, status, end_at")
        .eq("user_id", user_id)
        .in_("status", ["active", "grace_period", "cancelled"])
        .maybe_single()
    )
    if not (row and row.data):
        return "free"
    data = row.data
    if data["status"] == "cancelled" and not _end_at_in_future(data.get("end_at")):
        return "free"
    return data["plan"]


async def check_guide_limit(user_id: str, supabase) -> tuple[bool, int, int]:
    """월 가이드 생성 한도 체크 (guides → businesses → user_id 조인).

    Returns:
        (allowed, used_count, monthly_limit)
    """
    plan = await get_user_plan(user_id, supabase)
    limit = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["guide_monthly"]

    if limit >= 999:
        return True, 0, 999

    biz_res = await _exec(
        supabase.table("businesses").select("id").eq("user_id", user_id)
    )
    biz_rows = biz_res.data or []
    if not biz_rows:
        return True, 0, limit  # 사업장 없음 → 한도 미적용

    biz_ids = [b["id"] for b in biz_rows]
    month_start = date.today().replace(day=1).isoformat() + "T00:00:00"
    result = await _exec(
        supabase.table("guides")
        .select("id", count="exact")
        .in_("business_id", biz_ids)
        .gte("generated_at", month_start)
    )
    used = result.count or 0
    return used < limit, used, limit


async def check_review_reply_limit(user_id: str, supabase) -> tuple[bool, int, int]:
    """월 리뷰 답변 생성 한도 체크 (Claude Haiku, 별도 카운터).

    Returns:
        (allowed, used_count, monthly_limit)
    """
    plan = await get_user_plan(user_id, supabase)
    limit = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["review_reply_monthly"]

    if limit >= 999:
        return True, 0, 999

    biz_res = await _exec(
        supabase.table("businesses").select("id").eq("user_id", user_id)
    )
    biz_rows = biz_res.data or []
    if not biz_rows:
        return True, 0, limit

    biz_ids = [b["id"] for b in biz_rows]
    month_start = date.today().replace(day=1).isoformat() + "T00:00:00"
    result = await _exec(
        supabase.table("review_replies")
        .select("id", count="exact")
        .in_("business_id", biz_ids)
        .gte("created_at", month_start)
    )
    used = result.count or 0
    return used < limit, used, limit


async def check_support_ticket_limit(user_id: str, supabase) -> tuple[bool, int, int]:
    """월 1:1 문의 한도 체크 — 구 문의 폼(inquiries) + Q&A 티켓(support_tickets) 합산.

    support.py/inquiry.py 양쪽이 각자 한도 dict를 들고 있던 것을 단일 소스로 통합(2026-07-15).
    두 테이블 중 하나로만 한도를 걸면 다른 테이블로 우회 가능하므로(2026-07-11 실제 발견된 버그)
    항상 두 테이블 합산으로 검사한다.

    Returns:
        (allowed, used_count, monthly_limit)
    """
    plan = await get_user_plan(user_id, supabase)
    limit = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["support_ticket_monthly"]

    if limit >= 999:
        return True, 0, 999

    month_start = date.today().replace(day=1).isoformat() + "T00:00:00"
    ticket_res = await _exec(
        supabase.table("support_tickets").select("id", count="exact")
        .eq("user_id", user_id).gte("created_at", month_start)
    )
    inquiry_res = await _exec(
        supabase.table("inquiries").select("id", count="exact")
        .eq("user_id", user_id).gte("created_at", month_start)
    )
    used = (ticket_res.count or 0) + (inquiry_res.count or 0)
    return used < limit, used, limit


async def check_crisis_reply_limit(user_id: str, supabase) -> tuple[bool, int, int]:
    """월 위기관리 가이드(crisis-reply) 생성 한도 체크 (Claude Haiku, guides.context='crisis_reply' 카운트).

    2026-07-06 신설 — 이전엔 한도 없이 무제한 호출 가능했음.
    guides.context CHECK 제약에 'crisis_reply' 추가하는 마이그레이션 필요
    (scripts/supabase_schema.sql 참조, 미실행 시 insert는 실패해도 warning 로그만 남기고
    응답은 정상 반환 — 한도 카운트만 항상 0으로 표시됨, 사용자 차단 없음).

    Returns:
        (allowed, used_count, monthly_limit)
    """
    plan = await get_user_plan(user_id, supabase)
    limit = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["crisis_reply_monthly"]

    if limit >= 999:
        return True, 0, 999

    biz_res = await _exec(
        supabase.table("businesses").select("id").eq("user_id", user_id)
    )
    biz_rows = biz_res.data or []
    if not biz_rows:
        return True, 0, limit

    biz_ids = [b["id"] for b in biz_rows]
    month_start = date.today().replace(day=1).isoformat() + "T00:00:00"
    result = await _exec(
        supabase.table("guides")
        .select("id", count="exact")
        .in_("business_id", biz_ids)
        .eq("context", "crisis_reply")
        .gte("generated_at", month_start)
    )
    used = result.count or 0
    return used < limit, used, limit


async def check_ad_defense_limit(user_id: str, supabase) -> tuple[bool, int, int]:
    """월 AI 광고 대비 가이드(ad_defense) 생성 한도 체크 (Claude Sonnet, guides.context='ad_defense' 카운트).

    2026-07-08 신설 — 이전엔 한도 없이 무제한 호출 가능했음.
    guides.context CHECK 제약에 'ad_defense' 추가하는 마이그레이션 필요
    (scripts/supabase_schema.sql 참조, 미실행 시 insert는 실패해도 warning 로그만 남기고
    응답은 정상 반환 — 한도 카운트만 항상 0으로 표시됨, 사용자 차단 없음).

    Returns:
        (allowed, used_count, monthly_limit)
    """
    plan = await get_user_plan(user_id, supabase)
    limit = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["ad_defense_monthly"]

    if limit >= 999:
        return True, 0, 999

    biz_res = await _exec(
        supabase.table("businesses").select("id").eq("user_id", user_id)
    )
    biz_rows = biz_res.data or []
    if not biz_rows:
        return True, 0, limit

    biz_ids = [b["id"] for b in biz_rows]
    month_start = date.today().replace(day=1).isoformat() + "T00:00:00"
    result = await _exec(
        supabase.table("guides")
        .select("id", count="exact")
        .in_("business_id", biz_ids)
        .eq("context", "ad_defense")
        .gte("generated_at", month_start)
    )
    used = result.count or 0
    return used < limit, used, limit


async def check_startup_report_limit(user_id: str, supabase) -> tuple[bool, int, int]:
    """월 창업 시장 분석(startup_report) 생성 한도 체크 (Claude Sonnet, guides.context='startup_report' 카운트).

    2026-07-08 신설 — 이전엔 한도 없이 무제한 호출 가능했음.
    guides.context CHECK 제약에 'startup_report' 추가하는 마이그레이션 필요
    (scripts/supabase_schema.sql 참조, 미실행 시 insert는 실패해도 warning 로그만 남기고
    응답은 정상 반환 — 한도 카운트만 항상 0으로 표시됨, 사용자 차단 없음).

    startup_report는 biz_id 없는 per-user 요청이지만,
    사용량 기록은 user의 사업장(businesses) 중 하나의 business_id에 저장됨.
    사업장이 없는 신규 유저는 카운트 불가 → 항상 허용 (추적 시작 전 상태).

    Returns:
        (allowed, used_count, monthly_limit)
    """
    plan = await get_user_plan(user_id, supabase)
    limit = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["startup_report_monthly"]

    if limit >= 999:
        return True, 0, 999

    biz_res = await _exec(
        supabase.table("businesses").select("id").eq("user_id", user_id)
    )
    biz_rows = biz_res.data or []
    if not biz_rows:
        # 사업장 미등록 = 카운트 추적 불가 → 허용 (limit 카운트 시작 불가 상태)
        return True, 0, limit

    biz_ids = [b["id"] for b in biz_rows]
    month_start = date.today().replace(day=1).isoformat() + "T00:00:00"
    result = await _exec(
        supabase.table("guides")
        .select("id", count="exact")
        .in_("business_id", biz_ids)
        .eq("context", "startup_report")
        .gte("generated_at", month_start)
    )
    used = result.count or 0
    return used < limit, used, limit


def require_plan(*required_plans: str):
    """플랜 검사 데코레이터 — 함수에 user_id, supabase 의존성 필요"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            user_id = kwargs.get("user_id")
            supabase = kwargs.get("supabase")
            if user_id and supabase:
                plan = await get_user_plan(user_id, supabase)
                if plan not in required_plans:
                    raise HTTPException(
                        status_code=403,
                        detail={
                            "code": "PLAN_REQUIRED",
                            "current_plan": plan,
                            "required_plans": list(required_plans),
                            "upgrade_url": "/pricing",
                        },
                    )
            return await func(*args, **kwargs)
        return wrapper
    return decorator


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Authorization: Bearer <supabase_jwt> 토큰 검증 후 사용자 정보 반환"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="인증 토큰이 필요합니다")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        supabase = get_client()
        response = supabase.auth.get_user(token)
        if not response or not response.user:
            raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다")
        return {"id": response.user.id, "email": response.user.email}
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Token validation failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=401, detail="토큰 검증에 실패했습니다")


async def is_basic_trial_user(user_id: str, supabase) -> bool:
    """Basic 무료 체험 사용자 여부 — profiles.basic_trial_used=True + 활성 구독 없음"""
    try:
        prof = await _exec(
            supabase.table("profiles")
            .select("basic_trial_used")
            .eq("user_id", user_id)
            .maybe_single()
        )
        used = bool(prof.data.get("basic_trial_used")) if (prof and prof.data) else False
        if not used:
            return False
        sub = await _exec(
            supabase.table("subscriptions")
            .select("status")
            .eq("user_id", user_id)
            .in_("status", ["active", "grace_period"])
            .maybe_single()
        )
        return not (sub and sub.data)
    except Exception as e:
        _logger.warning(f"is_basic_trial_user lookup failed: {e}")
        return False


# free 플랜 월 1회 스캔 TOCTOU 방지 락 (guide.py _guide_generation_locks와 동일 패턴)
# 단일 uvicorn 워커 환경에서 동일 user_id 동시 호출을 직렬화. 워커 수 늘릴 경우
# (ecosystem.config.js 경고 참조) Redis 기반 분산 락으로 교체 필요.
_free_plan_scan_lock: set[str] = set()

# faq_monthly 공유 한도(소개글+FAQ+채팅방메뉴 합산) TOCTOU 방지 락 — business.py의
# /intro-generate·/global-ai-intro-generate·/talktalk-faq-generate 3곳과 guide.py의
# /{biz_id}/smartplace-faq 4곳 전부가 같은 월별 카운트(guides.context in intro_draft/
# faq_draft/talktalk_faq)를 공유하는데, 과거 business.py 3곳은 자체 로컬 락을 쓰고
# smartplace-faq는 락이 아예 없어 4번째 경로로 동시 요청 시 한도를 넘길 수 있었다
# (2026-08-06 발견·수정). 4곳 전부 이 하나의 락으로 통일.
_faq_monthly_generation_locks: set[str] = set()


async def check_manual_scan_limit(user_id: str, supabase, business_id: Optional[str] = None) -> tuple[bool, int, int]:
    """수동 스캔 한도 체크 (plan_gate PLAN_LIMITS manual_scan_daily 기준).

    free 플랜: 매월 1회 무료 스캔. 달이 바뀌면 자동 리셋 (free_scan_month 'YYYY-MM').
    - free_scan_month(TEXT), free_scan_monthly_count(INT DEFAULT 0) 기준
    - 하위 호환: free_scan_used / free_scan_used_at 도 함께 갱신

    NOTE: SSE 경로(/scan/stream)에서는 /stream/prepare가 이미 이 함수를 호출해
    free 플랜 사용 기록을 마킹한다. SSE 제너레이터에서 재호출하면 "이미 사용됨"으로
    차단되므로, scan.py SSE gen() 내부에서는 free 플랜을 재확인하지 않는다.

    Returns:
        (allowed, used_count, monthly_or_daily_limit)
    """
    if _DEV_MODE:
        return True, 0, 999

    plan = await get_user_plan(user_id, supabase)
    limit = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["manual_scan_daily"]

    if limit >= 999:
        return True, 0, 999
    if limit == 0:
        # free 플랜: 월 1회 무료 스캔 (매월 리셋)
        # TOCTOU 방어: 동일 user_id의 동시 요청을 직렬화 (단일 워커 내)
        if user_id in _free_plan_scan_lock:
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "SCAN_IN_PROGRESS",
                    "message": "스캔 요청이 처리 중입니다. 잠시 후 다시 시도해 주세요.",
                },
            )

        _free_plan_scan_lock.add(user_id)
        try:
            from datetime import datetime, timezone
            current_month = datetime.now(timezone.utc).strftime('%Y-%m')

            try:
                profile_row = await _exec(
                    supabase.table("profiles")
                    .select("free_scan_month, free_scan_monthly_count, free_scan_used")
                    .eq("user_id", user_id)
                    .single()
                )
                data = profile_row.data if (profile_row and profile_row.data) else {}
            except Exception as e:
                _logger.warning(f"free_scan 상태 조회 실패 (profiles 컬럼 미존재 가능): {e}")
                # 안전 방향: 차단 (통과 허용 시 컬럼 장애마다 무제한 스캔이 됨)
                raise HTTPException(
                    status_code=503,
                    detail={
                        "code": "SERVICE_UNAVAILABLE",
                        "message": "무료 스캔 상태 확인에 실패했습니다. 잠시 후 다시 시도해 주세요.",
                    },
                )

            db_month = data.get("free_scan_month")
            db_count = int(data.get("free_scan_monthly_count") or 0)

            if db_month == current_month and db_count >= 1:
                raise HTTPException(
                    status_code=403,
                    detail={
                        "code": "PLAN_REQUIRED",
                        "message": "이번 달 무료 스캔을 이미 사용했습니다. 다음 달에 다시 이용하거나, 계속 이용하려면 유료 플랜으로 업그레이드하세요.",
                        "upgrade_url": "/pricing",
                    },
                )

            # 통과 — 이달 사용 기록 마킹
            now_iso = datetime.now(timezone.utc).isoformat()
            await _exec(supabase.table("profiles").upsert({
                "user_id": user_id,
                "free_scan_month": current_month,
                "free_scan_monthly_count": 1,
                "free_scan_used": True,       # 하위 호환: "한 번이라도 사용했는지" 유지
                "free_scan_used_at": now_iso,
            }))
            return True, 0, 1  # 통과 (used=0, monthly_limit=1)

        finally:
            _free_plan_scan_lock.discard(user_id)

    today_str = date.today().isoformat() + "T00:00:00"
    biz_res = await _exec(
        supabase.table("businesses").select("id").eq("user_id", user_id)
    )
    biz_rows = biz_res.data or []
    if not biz_rows:
        return True, 0, limit

    biz_ids = [b["id"] for b in biz_rows]
    result = await _exec(
        supabase.table("scan_results")
        .select("id", count="exact")
        .in_("business_id", biz_ids)
        .gte("scanned_at", today_str)
    )
    used = result.count or 0
    if used >= limit:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "SCAN_DAILY_LIMIT",
                "used": used,
                "limit": limit,
                "message": f"오늘 수동 스캔 횟수({limit}회)를 모두 사용했습니다. 자동 스캔은 새벽 2시에 실행됩니다.",
                "upgrade_url": "/pricing",
            },
        )
    return True, used, limit
