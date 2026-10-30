"""Gemini 하루 호출량 대비 한도 점검 (2026-10-30).

한도는 현재 사용 중인 등급·모델의 값이다(무료 gemini-3.1-flash-lite 하루 500회, 2026-10-30 Google Cloud 한도 화면 확인).
유료 결제 후에는 서버 .env `GEMINI_DAILY_LIMIT`을 새 한도로 바꾼다. 구독자가 아닌 **호출 수**를 기준으로 하는 이유:
호출량은 사업장 수·요금제·질의 겹침에 따라 달라 구독자 수로 환산하면 틀린다.

집계는 `ai_usage_log`의 최근 24시간(롤링)이다. Google의 일 한도는 달력 기준이라 롤링 24시간은 그 값 이상이므로
알림이 늦게 가는 일은 없다(과하게 알릴 수는 있다). Gemini 스캐너의 모든 호출 지점은 사용량을 기록한다(2026-10-30 확인). 같은 API 키를 쓰는 다른 서비스가 있으면 그 호출은 여기에 없다. 결제는 막지 않고 운영자에게 알리기만 한다.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

DEFAULT_GEMINI_DAILY_LIMIT = 500
LEVELS = ((1.0, "100%"), (0.9, "90%"), (0.7, "70%"))

# 단계별 대응 — decide=True는 공개 약속·비용·결제가 걸려 사용자 결정 없이 실행하지 않는다.
PLAYBOOK = (
    {"from_pct": 70,
     "step": "질의 결과 공유 캐시를 켠다 (서버 .env AI_PROBE_CACHE_TTL_SEC=21600 후 백엔드 재시작)",
     "effect": "같은 지역·업종·키워드 질의는 한 번만 호출하고 사업장마다 이름만 대조 — 호출량이 겹침 비율만큼 감소 "
               "(실제 적중률은 /admin/naver-access의 ai_capacity.probe_cache.hit_rate로 확인)",
     "decide": False},
    {"from_pct": 90,
     "step": "Gemini 유료 결제를 연결하고 .env의 GEMINI_DAILY_LIMIT·GEMINI_MIN_INTERVAL을 새 한도에 맞춘다 "
             "(유료 구독자 발생 시 결제한다는 계획)",
     "effect": "한도·분당 속도 제한이 올라가고 입력이 제품 개선에 쓰이지 않음(약관). 유료 한도·단가는 결제 후 AI Studio에서 확인 후 단가표에 추가",
     "decide": True},
    {"from_pct": 100,
     "step": "초과분은 429로 '측정 안 됨'이 되어 점수에서 제외된다(0점 아님). 표본 수 축소(100→50)는 공개 문구 확인 후 결정한다",
     "effect": "한도 안으로 복귀 — 단 표본이 줄면 신뢰구간이 넓어짐", "decide": True},
)


def next_steps(used_pct: float) -> list[dict]:
    return [s for s in PLAYBOOK if used_pct >= s["from_pct"]]


def gemini_daily_limit() -> int:
    try:
        v = int(os.getenv("GEMINI_DAILY_LIMIT", str(DEFAULT_GEMINI_DAILY_LIMIT)))
        return v if v > 0 else DEFAULT_GEMINI_DAILY_LIMIT
    except ValueError:
        return DEFAULT_GEMINI_DAILY_LIMIT


def usage_level(used: int, limit: int) -> str | None:
    if limit <= 0:
        return None
    for ratio, name in LEVELS:
        if used >= limit * ratio:
            return name
    return None


def split_counts(rows: list[dict]) -> tuple[int, int]:
    """(성공 호출, 실패 기록) — 실패는 purpose에 ':FAILED'가 붙는다(gemini_scanner._log_failure)."""
    failed = sum(1 for r in rows if ":FAILED" in (r.get("purpose") or ""))
    return len(rows) - failed, failed


async def gemini_usage_snapshot(supabase=None) -> dict:
    from db.supabase_client import get_client, execute
    from services.ai_scanner import probe_cache
    supabase = supabase or get_client()
    since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    res = await execute(
        supabase.table("ai_usage_log").select("purpose")
        .eq("provider", "gemini").gte("created_at", since).limit(5000)
    )
    rows = (res.data if res else None) or []
    ok, failed = split_counts(rows)
    attempts = ok + failed   # 보수적으로 시도 전체를 한도 소진으로 본다(실패 중 429는 한도에 안 들어갈 수 있다)
    limit = gemini_daily_limit()
    pct = round(attempts / limit * 100, 1)
    return {
        "window": "최근 24시간(롤링)",
        "calls_ok": ok,
        "calls_failed": failed,
        "limit": limit,
        "used_pct": pct,
        "level": usage_level(attempts, limit),
        "truncated": len(rows) >= 5000,
        "next_steps": next_steps(pct),
        "probe_cache": probe_cache.snapshot(),
        "basis": "ai_usage_log에 기록된 Gemini 호출(스캐너 전 지점 + 블로그 주제 생성). 한도는 GEMINI_DAILY_LIMIT",
    }
