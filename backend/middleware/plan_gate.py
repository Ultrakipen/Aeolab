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
#   "basic"  → Gemini(100회) + 네이버 매일 / 나머지 6개 AI 월요일만 (basic)
#   "pro"    → 8개 AI 전체 스캔 주 3회(월·수·금) / 나머지 날 basic (pro)
#   "full"   → 8개 AI 매일 (biz)
#
# guide_monthly        : 월 Claude Sonnet 가이드 생성 허용 횟수 (999 = 무제한)
# manual_scan_daily    : 하루 수동 스캔 허용 횟수 (999 = 무제한)
# history_days         : 점수 히스토리 보관 일수 (999 = 무제한)
# businesses           : 등록 가능 사업장 수
# review_reply_monthly : 월 리뷰 답변 생성 허용 횟수 (Claude Haiku 사용)
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
        "review_reply_monthly": 0,
        "faq_monthly": 0,
        "blog_monthly": 0,
    },
    "basic": {
        # v3.4 강화: 경쟁사 3곳, CSV 포함, 리뷰답변 무제한, FAQ 무제한, 히스토리 60일
        "competitors": 3,
        "guide_monthly": 3,
        "manual_scan_daily": 2,
        "auto_scan_mode": "basic",
        "schema": True, "pdf": False, "csv": True,
        "startup_report": False, "api_keys": False,
        "history_days": 60,
        "businesses": 1,
        "ad_defense": False,
        "review_reply_monthly": 20,
        "faq_monthly": 5,
        "blog_monthly": 3,
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
        "review_reply_monthly": 999,
        "faq_monthly": 999,
        "blog_monthly": 10,
    },
    "biz": {
        "competitors": 999,
        "guide_monthly": 20,
        "manual_scan_daily": 15,
        "auto_scan_mode": "full",
        "schema": True, "pdf": True, "csv": True,
        "startup_report": True, "api_keys": True,
        "history_days": 999,
        "businesses": 5,
        "ad_defense": True,
        "review_reply_monthly": 999,
        "faq_monthly": 999,
        "blog_monthly": 999,
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
        "review_reply_monthly": 999,
        "faq_monthly": 999,
        "blog_monthly": 5,
    },
}

PLAN_HIERARCHY = {"free": 0, "basic": 1, "startup": 1.5, "pro": 2, "biz": 3}


async def get_user_plan(user_id: str, supabase) -> str:
    """현재 사용자의 활성 구독 플랜 반환.

    grace_period 상태(자동결제 실패 후 3일 유예)도 active와 동일하게 취급하여
    유예기간 중 유료 기능이 차단되는 버그를 방지한다.

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
        .select("plan")
        .eq("user_id", user_id)
        .in_("status", ["active", "grace_period"])
        .maybe_single()
    )
    return row.data["plan"] if (row and row.data) else "free"


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


async def check_manual_scan_limit(user_id: str, supabase, business_id: Optional[str] = None) -> tuple[bool, int, int]:
    """하루 수동 스캔 한도 체크 (plan_gate PLAN_LIMITS manual_scan_daily 기준).

    free 플랜: 해당 사업장의 전체 스캔 이력이 0건이면 첫 스캔 1회 허용.

    Returns:
        (allowed, used_count, daily_limit)
    """
    if _DEV_MODE:
        return True, 0, 999

    plan = await get_user_plan(user_id, supabase)
    limit = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["manual_scan_daily"]

    if limit >= 999:
        return True, 0, 999
    if limit == 0:
        # free 플랜: user 단위로 무료 스캔 1회 사용 여부 체크
        # 사업장 삭제 후 재등록해도 우회 불가
        try:
            profile_row = await _exec(
                supabase.table("profiles")
                .select("free_scan_used")
                .eq("user_id", user_id)
                .single()
            )
            already_used = profile_row.data.get("free_scan_used", False) if profile_row and profile_row.data else False
        except Exception as e:
            _logger.warning(f"free_scan_used 조회 실패 (profiles 컬럼 미존재 가능): {e}")
            already_used = False

        if not already_used:
            # 무료 스캔 사용 처리 (사용 완료로 마킹)
            from datetime import datetime, timezone
            await _exec(supabase.table("profiles").upsert({
                "user_id": user_id,
                "free_scan_used": True,
                "free_scan_used_at": datetime.now(timezone.utc).isoformat()
            }))
            return True, 0, 1  # 첫 스캔 통과

        raise HTTPException(
            status_code=403,
            detail={
                "code": "PLAN_REQUIRED",
                "message": "무료 체험 스캔을 이미 사용했습니다. 계속 이용하려면 유료 플랜으로 업그레이드하세요.",
                "upgrade_url": "/pricing",
            },
        )

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
