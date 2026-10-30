"""Playwright 전역 세마포어(동시 1개) 획득 — 사용자가 기다리는 요청은 대기 상한, 정기 배치는 양보 (2026-10-30).

문제: 스마트플레이스 확인·플레이스 통계·경쟁사 크롤은 `async with 세마포어`로 **시간 제한 없이** 기다렸다. 신규 가입자의 첫 측정처럼 사용자가 기다리는
요청이 정기 잡 뒤에 줄을 서면 nginx 120초 한도(504)까지 멈춘다.

방법:
- 사용자가 기다리는 요청(`mark_interactive()`로 표시)은 PLAYWRIGHT_QUEUE_TIMEOUT_SEC(기본 15초)만 기다리고, 넘으면 `asyncio.TimeoutError`를 던진다 — 다섯 호출
  지점 모두 이 예외를 "timeout 오류(측정 안 됨)"로 처리하므로 0점·미노출로 저장되지 않는다(error ≠ false).
- 정기 배치는 기존처럼 무제한 대기하되, 사용자 요청이 줄을 서 있으면 최대 BATCH_YIELD_MAX_SEC(기본 20초) 동안 양보한 뒤 줄을 선다(우선순위 흉내 — asyncio 세마포어는 도착 순서).
"""
from __future__ import annotations

import asyncio
import contextvars
import os
from contextlib import asynccontextmanager

_INTERACTIVE: contextvars.ContextVar[bool] = contextvars.ContextVar("pw_interactive", default=False)
_waiting_interactive = 0
BATCH_YIELD_MAX_SEC = float(os.getenv("PLAYWRIGHT_BATCH_YIELD_MAX_SEC", "20"))


def mark_interactive() -> None:
    """현재 요청(태스크)을 '사용자가 기다리는 중'으로 표시한다. 이 요청이 만드는 하위 태스크에도 전파된다."""
    _INTERACTIVE.set(True)


def is_interactive() -> bool:
    return _INTERACTIVE.get()


def waiting_interactive() -> int:
    return _waiting_interactive


def _queue_timeout() -> float:
    from services.ai_scanner.multi_scanner import PLAYWRIGHT_QUEUE_TIMEOUT_SEC
    return PLAYWRIGHT_QUEUE_TIMEOUT_SEC


@asynccontextmanager
async def playwright_slot(sem: asyncio.Semaphore):
    """`async with playwright_slot(_get_playwright_sem()):` — 기존 `async with 세마포어`와 같은 자리에 쓴다."""
    global _waiting_interactive
    if is_interactive():
        _waiting_interactive += 1
        try:
            await asyncio.wait_for(sem.acquire(), timeout=_queue_timeout())
        finally:
            _waiting_interactive -= 1
    else:
        waited = 0.0
        while _waiting_interactive > 0 and waited < BATCH_YIELD_MAX_SEC:   # 사용자 요청이 기다리는 동안 뒤에 온 배치는 양보
            await asyncio.sleep(0.5)
            waited += 0.5
        await sem.acquire()
    try:
        yield
    finally:
        sem.release()
