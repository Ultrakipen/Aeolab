"""네이버 접속 용량 대비 활성 사업장 수 (2026-10-29).

한도는 `scripts/naver_load_model.py`(코드 기준 모델, 실측 아님)에서 일일 상한 600 기준 월요일이 먼저 닿는 규모(약 50곳)다.
결제는 막지 않고 운영자에게 알리기만 한다(사용자 결정). 실측 데이터가 쌓이면 NAVER_CAPACITY_BUSINESSES로 보정한다.
"""
from __future__ import annotations

import os

DEFAULT_CAPACITY_BUSINESSES = 50
# 단계: (비율, 이름) — 높은 단계부터 판정
LEVELS = ((1.0, "100%"), (0.9, "90%"), (0.7, "70%"))


def capacity_limit() -> int:
    try:
        v = int(os.getenv("NAVER_CAPACITY_BUSINESSES", str(DEFAULT_CAPACITY_BUSINESSES)))
        return v if v > 0 else DEFAULT_CAPACITY_BUSINESSES
    except ValueError:
        return DEFAULT_CAPACITY_BUSINESSES


def capacity_level(count: int, limit: int) -> str | None:
    """count가 한도의 몇 % 단계에 닿았는지. 70% 미만이면 None."""
    if limit <= 0:
        return None
    for ratio, name in LEVELS:
        if count >= limit * ratio:
            return name
    return None


async def active_business_count(supabase=None) -> int:
    """활성 구독자가 소유한 활성 사업장 수(네이버 접속 대상 규모)."""
    from db.supabase_client import get_client, execute
    supabase = supabase or get_client()
    subs = await execute(supabase.table("subscriptions").select("user_id").eq("status", "active"))
    user_ids = list({s["user_id"] for s in ((subs.data if subs else None) or []) if s.get("user_id")})
    if not user_ids:
        return 0
    biz = await execute(
        supabase.table("businesses").select("id").eq("is_active", True).in_("user_id", user_ids)
    )
    return len((biz.data if biz else None) or [])


async def capacity_snapshot(supabase=None) -> dict:
    limit = capacity_limit()
    count = await active_business_count(supabase)
    return {
        "active_businesses": count,
        "limit": limit,
        "used_pct": round(count / limit * 100, 1),
        "level": capacity_level(count, limit),
        "basis": "코드 기준 모델(실측 아님) — scripts/naver_load_model.py, NAVER_CAPACITY_BUSINESSES로 보정",
    }
