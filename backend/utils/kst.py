"""시간대 보조 — DB(TIMESTAMPTZ)에는 항상 시간대가 있는 값을 쓰고, '날짜'가 필요한 곳에서만 한국 날짜로 바꾼다.

2026-10-29: 구독 start_at을 시간대 없는 서버 시각(KST)으로 저장해 DB가 UTC로 해석 → 실제보다 9시간 뒤로 기록되던 결함의 수정.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))


def utc_now_iso() -> str:
    """시간대가 붙은 현재 시각(UTC) — TIMESTAMPTZ 컬럼에 저장할 때 쓴다."""
    return datetime.now(timezone.utc).isoformat()


def kst_date_from_iso(raw) -> date:
    """DB에서 읽은 시각 문자열을 한국 기준 날짜로. 시간대가 없으면 UTC로 본다(DB는 TIMESTAMPTZ를 +00:00으로 돌려준다)."""
    dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(KST).date()
