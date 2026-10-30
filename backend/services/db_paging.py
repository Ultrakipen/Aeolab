"""Supabase(PostgREST) 서버 최대 행 수(1,000) 우회용 페이징 도우미 (2026-10-30).

서버는 요청한 `.limit()`이 얼마든 **한 번에 1,000행까지만** 돌려준다(실측: limit 1000/5000/20000 → 모두 1000행). `.limit(20000)`처럼 쓴 코드는
1,000행에서 조용히 잘려 과소집계된다(예: `ai_daily_usage_alert_job`은 임계값 3,000에 영원히 도달하지 못했다). 큰 범위는 `.range()`로 나눠 읽는다.
"""
from __future__ import annotations

PAGE = 1000


async def fetch_all_rows(build_query, max_rows: int = 200_000) -> tuple[list[dict], bool]:
    """`build_query()`가 돌려주는 쿼리(정렬 포함 — 페이지가 겹치거나 빠지지 않도록 호출자가 `.order()`를 붙인다)를 1,000행씩 모두 읽는다.

    반환: (행 목록, 상한에 걸려 잘렸는가). 쿼리 빌더는 호출마다 새로 만들어야 하므로 팩토리(람다)를 받는다.
    """
    from db.supabase_client import execute
    rows: list[dict] = []
    offset = 0
    while offset < max_rows:
        res = await execute(build_query().range(offset, offset + PAGE - 1))
        chunk = (res.data if res else None) or []
        rows += chunk
        if len(chunk) < PAGE:
            return rows, False
        offset += PAGE
    return rows[:max_rows], True
