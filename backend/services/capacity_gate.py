"""신규 구독 수용 한도 스위치 — 용량이 찼을 때만 신규 구독을 대기자로 돌린다 (2026-10-30, 기본 꺼짐).

배경: 수용량은 서버 사양이 아니라 네이버 접속 한도가 정한다(docs/naver_capacity_300_playbook_2026_10_29.md). 한도에 닿은 뒤에도 신규 구독을 받으면
점검 항목이 "확인 전"으로 비는 사용자가 늘어 신뢰가 떨어진다. 그래서 **100% 도달 시에만** 신규 결제 전 단계에서 대기자 안내로 전환한다.

원칙:
- 기본은 꺼짐(`NEW_SUBSCRIBER_CAPACITY_GATE` 미설정 = 모든 신규 구독 수용). 켜는 것은 사용자 결정이다.
- 켜져 있어도 **이미 구독 중인 사용자(갱신·플랜 변경)는 막지 않는다** — 신규·재구독만 대상.
- 한도 계산이 실패하면 **막지 않는다**(fail-open) — 집계 오류로 결제를 막는 쪽이 더 나쁘다.
- 결제 **전**에만 막는다(빌링키 발급 이전). 결제 후 대기시키지 않는다.
- 사용자에게는 내부 한도·횟수를 내보내지 않는다(`accepting`·안내 문구만).
"""
from __future__ import annotations

import os
import time

CACHE_TTL_SEC = 60
# monotonic()은 부팅 후 경과 시간이라 0.0으로 시작하면 갓 켜진 머신(CI 등)에서 캐시가 유효한 것으로 보인다 → -inf
_cache: dict = {"at": float("-inf"), "accepting": True}

WAITLIST_MESSAGE = (
    "지금은 측정 품질을 지키기 위해 신규 구독을 잠시 받지 않고 있어요. 대기자 명단에 등록해 주시면 자리가 나는 대로 먼저 알려 드립니다. "
    "결제는 진행되지 않았습니다."
)


def gate_enabled() -> bool:
    return os.getenv("NEW_SUBSCRIBER_CAPACITY_GATE", "false").strip().lower() == "true"


def gate_pct() -> float:
    try:
        v = float(os.getenv("CAPACITY_GATE_PCT", "100"))
        return v if v > 0 else 100.0
    except ValueError:
        return 100.0


async def accepting_new_subscribers(supabase=None) -> bool:
    """신규 구독을 받는 중인가. 꺼져 있거나 한도 계산이 실패하면 True."""
    if not gate_enabled():
        return True
    now = time.monotonic()
    if now - _cache["at"] < CACHE_TTL_SEC:
        return bool(_cache["accepting"])
    try:
        from services.naver_capacity import capacity_snapshot
        snap = await capacity_snapshot(supabase)
        accepting = float(snap.get("used_pct") or 0.0) < gate_pct()
    except Exception:  # noqa: BLE001 — 집계 실패로 결제를 막지 않는다
        accepting = True
    _cache.update({"at": now, "accepting": accepting})
    return accepting


async def _is_existing_subscriber(user_id: str, supabase=None) -> bool:
    from db.supabase_client import get_client, execute
    supabase = supabase or get_client()
    res = await execute(
        supabase.table("subscriptions").select("status").eq("user_id", user_id).in_("status", ["active", "grace_period"]).limit(1)
    )
    return bool(res and res.data)


async def new_subscriber_blocked(user_id: str, supabase=None) -> dict | None:
    """이 사용자의 신규 구독 결제를 막아야 하면 {"code","message"}, 아니면 None. 기존 구독자는 막지 않는다."""
    if not gate_enabled():
        return None
    try:
        if await accepting_new_subscribers(supabase):
            return None
        if await _is_existing_subscriber(user_id, supabase):
            return None
    except Exception:  # noqa: BLE001
        return None
    return {"code": "CAPACITY_WAITLIST", "message": WAITLIST_MESSAGE}


def reset_cache() -> None:
    _cache.update({"at": float("-inf"), "accepting": True})
