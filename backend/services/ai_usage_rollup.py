"""`ai_usage_log` 일별 롤업과 보관 정책 (2026-10-30).

문제: 호출마다 한 줄이라 사업장 300곳이면 하루 약 2.3만 줄(연 800만 줄)이 쌓이고, 관리자 `/ai-cost`는 최대 90일치를 행 10,000개로 잘라 읽어
(300곳이면 하루치도 안 됨) 조용히 과소집계한다.

방법: 하루가 끝난 뒤(매일 05:20 KST 잡) 그날의 행을 (일·프로바이더·모델·목적)별로 합쳐 `ai_usage_daily`에 저장(멱등 upsert)하고,
**롤업과 원본 건수가 일치한 날만** 보관 기간(기본 35일)이 지난 원본을 지운다. 비용·호출 추이는 롤업으로 영구 조회한다.

안전 규칙:
- `ai_usage_daily` 테이블이 없으면(SQL 미실행) 아무것도 지우지 않는다 — 읽기 쪽도 기존 원본 조회로 폴백한다.
- 삭제는 롤업 호출 수 합계 == 원본 건수일 때만(어긋나면 그날을 다시 롤업해 재확인, 그래도 다르면 건너뜀·경고).
- 한 번 실행에서 롤업(백필)·삭제할 날짜 수를 제한해 DB 부하를 억제한다. 한도 점검(`ai_capacity`, 최근 24시간)은 원본을 쓰므로 영향 없다.
- 날짜 경계는 KST다(`created_at`은 UTC로 저장됨).
"""
from __future__ import annotations

import logging
import os
from datetime import date, datetime, timedelta, timezone

_logger = logging.getLogger("aeolab")

KST = timezone(timedelta(hours=9))
PAGE = 1000                       # PostgREST 한 번에 읽는 행 수
MAX_BACKFILL_DAYS_PER_RUN = 10    # 한 번에 새로 롤업하는 날짜 수 상한
MAX_PURGE_DAYS_PER_RUN = 7        # 한 번에 원본을 지우는 날짜 수 상한


class RollupUnavailable(Exception):
    """`ai_usage_daily` 테이블이 없다(SQL 미실행)."""


def retention_days() -> int:
    """원본 보관 일수(기본 35, 0이면 삭제하지 않고 롤업만)."""
    try:
        return max(0, int(os.getenv("AI_USAGE_LOG_RETENTION_DAYS", "35")))
    except ValueError:
        return 35


def kst_today() -> date:
    return datetime.now(KST).date()


def kst_day_of(ts: str) -> date:
    when = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    return when.astimezone(KST).date()


def day_bounds_utc(day: date) -> tuple[str, str]:
    start = datetime(day.year, day.month, day.day, tzinfo=KST).astimezone(timezone.utc)
    return start.isoformat(), (start + timedelta(days=1)).isoformat()


def base_purpose(purpose: str) -> tuple[str, bool]:
    """('scan_check:FAILED:Timeout') → ('scan_check', True). 성공 기록은 (purpose, False)."""
    p = purpose or "unknown"
    if ":FAILED" in p:
        return p.split(":FAILED", 1)[0], True
    return p, False


def aggregate(rows: list[dict]) -> dict[tuple, dict]:
    """원본 행을 (KST 일, provider, model, 목적)별로 합친다(순수 함수). 실패 기록은 calls_failed로 센다."""
    out: dict[tuple, dict] = {}
    for r in rows:
        try:
            day = kst_day_of(r["created_at"])
        except (KeyError, ValueError, TypeError):
            continue
        purpose, failed = base_purpose(r.get("purpose") or "")
        key = (day, r.get("provider") or "unknown", r.get("model") or "unknown", purpose)
        g = out.setdefault(key, {"calls_ok": 0, "calls_failed": 0, "tokens_in": 0, "tokens_out": 0, "cost_krw": 0.0})
        g["calls_failed" if failed else "calls_ok"] += 1
        g["tokens_in"] += int(r.get("tokens_in") or 0)
        g["tokens_out"] += int(r.get("tokens_out") or 0)
        g["cost_krw"] = round(g["cost_krw"] + float(r.get("estimated_cost_krw") or 0.0), 4)
    return out


def _is_missing_table(e: Exception) -> bool:
    msg = str(e).lower()
    return "ai_usage_daily" in msg and ("does not exist" in msg or "could not find" in msg or "pgrst205" in msg or "42p01" in msg)


async def _read_day_rows(supabase, day: date) -> list[dict]:
    from db.supabase_client import execute
    start, end = day_bounds_utc(day)
    rows: list[dict] = []
    offset = 0
    while True:
        res = await execute(
            supabase.table("ai_usage_log")
            .select("provider, model, purpose, tokens_in, tokens_out, estimated_cost_krw, created_at")
            .gte("created_at", start).lt("created_at", end)
            .order("created_at").order("id")
            .range(offset, offset + PAGE - 1)
        )
        chunk = (res.data if res else None) or []
        rows += chunk
        if len(chunk) < PAGE:
            return rows
        offset += PAGE


async def rollup_day(supabase, day: date) -> int:
    """그날의 원본을 롤업 테이블에 저장(멱등)하고 읽은 원본 행 수를 돌려준다. 테이블이 없으면 RollupUnavailable."""
    from db.supabase_client import execute
    rows = await _read_day_rows(supabase, day)
    groups = aggregate(rows)
    payload = [
        {"day": k[0].isoformat(), "provider": k[1], "model": k[2], "purpose": k[3], **v}
        for k, v in groups.items() if k[0] == day
    ]
    if not payload:
        return len(rows)
    try:
        await execute(supabase.table("ai_usage_daily").upsert(payload, on_conflict="day,provider,model,purpose"))
    except Exception as e:  # noqa: BLE001
        if _is_missing_table(e):
            raise RollupUnavailable(str(e)) from e
        raise
    return len(rows)


async def _rolled_total(supabase, day: date) -> int:
    from db.supabase_client import execute
    res = await execute(supabase.table("ai_usage_daily").select("calls_ok, calls_failed").eq("day", day.isoformat()))
    return sum(int(r.get("calls_ok") or 0) + int(r.get("calls_failed") or 0) for r in ((res.data if res else None) or []))


async def _raw_count(supabase, day: date) -> int:
    from db.supabase_client import execute
    start, end = day_bounds_utc(day)
    res = await execute(
        supabase.table("ai_usage_log").select("id", count="exact").gte("created_at", start).lt("created_at", end).limit(1)
    )
    return int(res.count or 0) if res else 0


async def _delete_day(supabase, day: date) -> None:
    """그날의 원본을 한 시간 창씩 지운다(한 번에 너무 많은 줄을 지우지 않도록)."""
    from db.supabase_client import execute
    start = datetime.fromisoformat(day_bounds_utc(day)[0])
    for h in range(24):
        lo, hi = start + timedelta(hours=h), start + timedelta(hours=h + 1)
        await execute(supabase.table("ai_usage_log").delete().gte("created_at", lo.isoformat()).lt("created_at", hi.isoformat()))


async def _oldest_raw_day(supabase) -> date | None:
    from db.supabase_client import execute
    res = await execute(supabase.table("ai_usage_log").select("created_at").order("created_at").limit(1))
    rows = (res.data if res else None) or []
    return kst_day_of(rows[0]["created_at"]) if rows else None


async def run_rollup_and_purge(supabase, today: date | None = None, retention: int | None = None) -> dict:
    """매일 잡 본체. 반환: 처리 요약(로그·테스트용)."""
    today = today or kst_today()
    keep = retention_days() if retention is None else retention
    summary = {"rolled_days": 0, "purged_days": 0, "skipped_mismatch": 0, "unavailable": False}
    oldest = await _oldest_raw_day(supabase)
    if oldest is None:
        return summary
    try:
        # 1) 롤업: 어제부터 거슬러 올라가며 아직 롤업이 없는 날(+어제·그제는 항상 다시)을 처리 — 상한 있음
        yesterday = today - timedelta(days=1)
        day, new_days = yesterday, 0
        while day >= oldest:
            always = day >= today - timedelta(days=2)
            if always or await _rolled_total(supabase, day) == 0:
                if not always and new_days >= MAX_BACKFILL_DAYS_PER_RUN:
                    break
                await rollup_day(supabase, day)
                summary["rolled_days"] += 1
                new_days += 0 if always else 1
            day -= timedelta(days=1)
        # 2) 삭제: 보관 기간이 지났고 롤업과 원본 건수가 일치하는 날만
        if keep > 0:
            cutoff = today - timedelta(days=keep)
            d, purged = oldest, 0
            while d < cutoff and purged < MAX_PURGE_DAYS_PER_RUN:
                raw = await _raw_count(supabase, d)
                if raw:
                    if await _rolled_total(supabase, d) != raw:
                        await rollup_day(supabase, d)
                    if await _rolled_total(supabase, d) == raw:
                        await _delete_day(supabase, d)
                        purged += 1
                        summary["purged_days"] += 1
                    else:
                        summary["skipped_mismatch"] += 1
                        _logger.warning("[ai_usage_rollup] %s 롤업·원본 건수 불일치 — 삭제하지 않음", d)
                d += timedelta(days=1)
    except RollupUnavailable:
        summary["unavailable"] = True
        _logger.info("[ai_usage_rollup] ai_usage_daily 테이블이 없어 롤업·삭제를 건너뜀(SQL 미실행) — scripts/supabase_schema.sql 참조")
    return summary


# ── 읽기: 관리자 비용 집계 ────────────────────────────────────────────────

def combine_cost_sources(rollup_rows: list[dict], raw_rows: list[dict], rolled_days: set[date]) -> list[dict]:
    """롤업된 날은 롤업 값을, 롤업이 없는 날은 원본을 합쳐 (provider, model, purpose)별 집계를 만든다(이중 집계 없음).

    각 항목: provider, model, purpose, calls(성공+실패 시도 전체), failed_calls, tokens_in, tokens_out, cost_krw.
    """
    by: dict[tuple, dict] = {}

    def add(provider, model, purpose, ok, failed, t_in, t_out, cost):
        g = by.setdefault((provider, model, purpose), {"provider": provider, "model": model, "purpose": purpose,
                                                      "calls": 0, "failed_calls": 0, "tokens_in": 0, "tokens_out": 0, "cost_krw": 0.0})
        g["calls"] += ok + failed
        g["failed_calls"] += failed
        g["tokens_in"] += t_in
        g["tokens_out"] += t_out
        g["cost_krw"] = round(g["cost_krw"] + cost, 4)

    for r in rollup_rows:
        add(r.get("provider") or "unknown", r.get("model") or "unknown", r.get("purpose") or "unknown",
            int(r.get("calls_ok") or 0), int(r.get("calls_failed") or 0), int(r.get("tokens_in") or 0),
            int(r.get("tokens_out") or 0), float(r.get("cost_krw") or 0.0))
    for key, v in aggregate([r for r in raw_rows if _safe_day(r) not in rolled_days]).items():
        add(key[1], key[2], key[3], v["calls_ok"], v["calls_failed"], v["tokens_in"], v["tokens_out"], v["cost_krw"])
    return sorted(by.values(), key=lambda x: x["cost_krw"], reverse=True)


def _safe_day(r: dict):
    try:
        return kst_day_of(r["created_at"])
    except (KeyError, ValueError, TypeError):
        return None
