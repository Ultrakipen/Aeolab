"""채널 정보 일관성 점검 라우터 (2026-10-30) — Basic 이상.

GET  /api/consistency/{biz_id}/status             — 연결 여부·오늘 남은 횟수 (외부 호출 없음)
POST /api/consistency/{biz_id}/google-candidates  — 구글 지도 후보 검색 (사장님이 직접 골라 연결)
POST /api/consistency/{biz_id}/link-google        — 확인한 구글 지도 장소 연결/해제 (businesses.google_place_id)
POST /api/consistency/{biz_id}/check              — "지금 점검" (입력값 vs 카카오·네이버·구글)

설계: docs/naver_independence_design_v2.0_final_2026_10_29.md §5-2
- 구글 응답은 저장하지 않는다(Places 약관). 저장하는 것은 장소 ID(businesses.google_place_id)와
  사용 횟수 기록(consistency_checks: user_id·business_id·kind·시각만)뿐이다.
- 호출 시점 요금이 드는 조회라 화면 로드마다 호출하지 않고 버튼으로만 실행하며 하루 한도를 둔다.
- consistency_checks 테이블이 아직 없으면 프로세스 메모리 카운터로 한도를 지킨다(재시작 시 초기화).
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db.supabase_client import execute, get_client
from middleware.plan_gate import PLAN_LIMITS, get_current_user, get_user_plan
from services import google_places_client as places
from services.channel_consistency import run_consistency_check
from services.kakao_visibility import _region_query_prefix

router = APIRouter()
_logger = logging.getLogger("aeolab")

_KST = timezone(timedelta(hours=9))
_CANDIDATE_DAILY_CAP = 10  # 후보 검색(Pro 단계, 월 5,000건 무료) 남용 방지
_BIZ_COLS = "id, user_id, name, region, address, phone, website_url, google_place_id, kakao_place_id, naver_place_id"

_mem_counts: dict[tuple[str, str, str], int] = {}
_locks: dict[str, asyncio.Lock] = {}


def _today_key() -> str:
    return datetime.now(_KST).strftime("%Y-%m-%d")


def _day_start_utc_iso() -> str:
    start = datetime.now(_KST).replace(hour=0, minute=0, second=0, microsecond=0)
    return start.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _lock_for(user_id: str) -> asyncio.Lock:
    return _locks.setdefault(user_id, asyncio.Lock())


async def _load_biz(supabase, biz_id: str, user_id: str) -> dict:
    try:
        res = await execute(supabase.table("businesses").select(_BIZ_COLS).eq("id", biz_id).limit(1))
    except Exception as e:
        _logger.warning("[consistency] businesses 조회 실패 biz=%s: %s", biz_id, type(e).__name__)
        raise HTTPException(404, "사업장을 찾을 수 없습니다")
    rows = (res and res.data) or []
    if not rows:
        raise HTTPException(404, "사업장을 찾을 수 없습니다")
    biz = rows[0]
    if biz.get("user_id") != user_id:
        raise HTTPException(403, "접근 권한 없음")
    return biz


async def _plan_and_limit(supabase, user_id: str) -> tuple[str, int]:
    plan = await get_user_plan(user_id, supabase)
    limit = int(PLAN_LIMITS.get(plan, PLAN_LIMITS["free"]).get("consistency_daily", 0))
    return plan, limit


def _require_allowed(limit: int) -> None:
    if limit <= 0:
        raise HTTPException(403, "채널 정보 일치 점검은 Basic 이상 플랜에서 사용할 수 있어요")


async def _used_today(supabase, user_id: str, kind: str) -> int:
    """DB 기록과 메모리 카운터 중 큰 값 — DB 기록이 실패해도(테이블 미생성 등) 한도는 지킨다."""
    mem = _mem_counts.get((user_id, kind, _today_key()), 0)
    try:
        res = await execute(
            supabase.table("consistency_checks").select("id", count="exact")
            .eq("user_id", user_id).eq("kind", kind).gte("created_at", _day_start_utc_iso())
        )
        return max(int(res.count or 0), mem)
    except Exception as e:
        _logger.warning("[consistency] 사용 횟수 조회 실패(테이블 미생성일 수 있음) — 메모리 카운터 사용: %s", type(e).__name__)
        return mem


async def _record(supabase, user_id: str, biz_id: str, kind: str) -> Optional[str]:
    """사용 1회를 기록하고 DB 행 id(없으면 None)를 돌려준다."""
    today = _today_key()
    for k in [k for k in _mem_counts if k[2] != today]:  # 지난 날짜 카운터 정리
        _mem_counts.pop(k, None)
    key = (user_id, kind, today)
    _mem_counts[key] = _mem_counts.get(key, 0) + 1
    try:
        res = await execute(supabase.table("consistency_checks").insert({"user_id": user_id, "business_id": biz_id, "kind": kind}))
        rows = (res and res.data) or []
        return rows[0].get("id") if rows else None
    except Exception as e:
        _logger.warning("[consistency] 사용 기록 저장 실패(테이블 미생성일 수 있음): %s", type(e).__name__)
        return None


async def _refund(supabase, user_id: str, kind: str, row_id: Optional[str]) -> None:
    key = (user_id, kind, _today_key())
    if _mem_counts.get(key, 0) > 0:
        _mem_counts[key] -= 1
    if row_id:
        try:
            await execute(supabase.table("consistency_checks").delete().eq("id", row_id))
        except Exception as e:
            _logger.warning("[consistency] 사용 기록 환불 실패: %s", type(e).__name__)


_PLACES_ERRORS = {
    "not_configured": (503, "구글 지도 연결이 아직 준비되지 않았어요"),
    "forbidden": (502, "구글 지도 연결에 문제가 있어요. 잠시 후 다시 시도해 주세요"),
    "rate_limited": (429, "구글 지도 조회가 몰렸어요. 잠시 후 다시 시도해 주세요"),
    "timeout": (504, "구글 지도 응답이 늦어요. 잠시 후 다시 시도해 주세요"),
}


def _places_http_error(code: str) -> HTTPException:
    status, msg = _PLACES_ERRORS.get(code, (502, "구글 지도 조회에 실패했어요. 잠시 후 다시 시도해 주세요"))
    return HTTPException(status, msg)


def _usage(used: int, limit: int) -> dict:
    return {"used": used, "limit": limit, "remaining": max(limit - used, 0) if limit < 999 else 999}


# ── 엔드포인트 ────────────────────────────────────────────────────────────────


@router.get("/{biz_id}/status")
async def consistency_status(biz_id: str, user=Depends(get_current_user)):
    supabase = get_client()
    biz = await _load_biz(supabase, biz_id, user["id"])
    plan, limit = await _plan_and_limit(supabase, user["id"])
    used = await _used_today(supabase, user["id"], "check") if limit > 0 else 0
    return {
        "allowed": limit > 0,
        "plan": plan,
        "google_linked": bool((biz.get("google_place_id") or "").strip()),
        **_usage(used, limit),
    }


@router.post("/{biz_id}/google-candidates")
async def google_candidates(biz_id: str, user=Depends(get_current_user)):
    supabase = get_client()
    biz = await _load_biz(supabase, biz_id, user["id"])
    _plan, limit = await _plan_and_limit(supabase, user["id"])
    _require_allowed(limit)

    async with _lock_for(user["id"]):
        if await _used_today(supabase, user["id"], "candidates") >= _CANDIDATE_DAILY_CAP:
            raise HTTPException(429, "오늘 구글 지도 후보 검색 횟수를 모두 사용했어요. 내일 다시 이용해 주세요")
        row_id = await _record(supabase, user["id"], biz_id, "candidates")

    query = f"{(biz.get('name') or '').strip()} {_region_query_prefix(biz.get('region') or '')}".strip()
    try:
        found = await places.search_candidates(query)
    except places.PlacesError as e:
        await _refund(supabase, user["id"], "candidates", row_id)
        raise _places_http_error(e.code)
    return {
        "candidates": [{"place_id": c["place_id"], "name": c["name"], "address": c["address"]} for c in found if c.get("place_id")],
        "attribution": "Google Maps",
    }


class LinkGoogleRequest(BaseModel):
    place_id: Optional[str] = None  # None/빈 문자열 = 연결 해제


@router.post("/{biz_id}/link-google")
async def link_google(biz_id: str, req: LinkGoogleRequest, user=Depends(get_current_user)):
    supabase = get_client()
    await _load_biz(supabase, biz_id, user["id"])
    _plan, limit = await _plan_and_limit(supabase, user["id"])
    _require_allowed(limit)

    pid = (req.place_id or "").strip()
    if pid and not places.is_valid_place_id(pid):
        raise HTTPException(400, "올바르지 않은 구글 지도 장소 ID입니다")
    try:
        await execute(
            supabase.table("businesses").update({"google_place_id": pid or None})
            .eq("id", biz_id).eq("user_id", user["id"])
        )
    except Exception as e:
        _logger.warning("[consistency] google_place_id 저장 실패 biz=%s: %s", biz_id, type(e).__name__)
        raise HTTPException(500, "저장하지 못했어요. 잠시 후 다시 시도해 주세요")
    return {"google_linked": bool(pid)}


@router.post("/{biz_id}/check")
async def run_check(biz_id: str, user=Depends(get_current_user)):
    supabase = get_client()
    biz = await _load_biz(supabase, biz_id, user["id"])
    _plan, limit = await _plan_and_limit(supabase, user["id"])
    _require_allowed(limit)

    async with _lock_for(user["id"]):
        used = await _used_today(supabase, user["id"], "check")
        if used >= limit:
            raise HTTPException(429, f"오늘 점검 횟수({limit}회)를 모두 사용했어요. 내일 다시 이용해 주세요")
        row_id = await _record(supabase, user["id"], biz_id, "check")
        used += 1

    result = await run_consistency_check(biz)
    states = [ch.get("state") for ch in result["channels"].values()]
    if states and all(s == "error" for s in states):
        # 모든 채널이 오류면 사용자 잘못이 아니므로 횟수를 돌려준다
        await _refund(supabase, user["id"], "check", row_id)
        used -= 1
    return {**result, "usage": _usage(used, limit)}
