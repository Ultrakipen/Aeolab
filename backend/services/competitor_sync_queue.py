"""경쟁사 네이버 데이터 최초 채우기 — 서버 백그라운드 큐 (2026-10-29).

이전에는 브라우저 탭이 경쟁사를 하나씩 `sync-place`로 불렀다. 새로고침 한도(10분 2회)에 걸리면 탭이 남은 시간을 세며
기다렸고, 탭을 닫으면 그 자리에서 멈췄다(5곳이면 최대 20분 동안 탭을 열어 둬야 했다). 이제 서버가 같은 요청을 순서대로
처리하므로 탭을 닫아도 이어진다.

새 네이버 접속 경로가 아니다 — 경쟁사마다 기존 수동 새로고침 함수(`sync_fn`)를 그대로 부르므로 사용자별 한도·공유
캐시·회로 차단기·속도 제한·일일 상한이 모두 그대로 적용된다. 한도에 걸리면 서버가 알려 준 대기 시간만큼 쉬었다 같은
경쟁사부터 이어가고, 네이버 쪽 사정(503)이면 남은 경쟁사에 요청을 보내지 않고 멈춘다(저장된 값은 그대로).

상태는 프로세스 메모리에만 있다(`--workers 1`). 서버를 재시작하면 진행 중이던 큐는 사라지고 화면은 처음 상태로 돌아가며,
남은 경쟁사는 다시 눌러 채우거나 정기 갱신이 채운다.
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Awaitable, Callable, Optional

from fastapi import HTTPException

_logger = logging.getLogger("aeolab")

MAX_TARGETS = 20            # 한 번에 담을 경쟁사 수 상한 (플랜 한도보다 넉넉하다)
MAX_WAITS = 3               # 한도(429)로 쉬는 횟수 — 이후에도 막히면 멈추고 남은 곳은 정기 갱신에 맡긴다
MAX_WAIT_SEC = 1200
DEFAULT_WAIT_SEC = 600
PAUSE_BETWEEN_SEC = 2       # 경쟁사 사이 간격
MAX_ACTIVE_QUEUES = 5       # 동시에 도는 큐 수 (네이버 접속은 어차피 Playwright 세마포어가 한 번에 하나로 줄 세운다)
KEEP_FINISHED_SEC = 1800    # 끝난 큐의 결과를 화면이 읽어 갈 수 있게 남기는 시간

SyncFn = Callable[[str, dict], Awaitable[dict]]

_queues: dict[str, dict] = {}            # business_id -> 상태
_tasks: set[asyncio.Task] = set()        # 실행 중인 작업이 회수되지 않게 참조를 잡아 둔다


def _purge(now: float) -> None:
    for biz_id in [b for b, q in _queues.items() if q["finished_at"] and now - q["finished_at"] > KEEP_FINISHED_SEC]:
        _queues.pop(biz_id, None)


def _active(q: dict) -> bool:
    return q["state"] in ("running", "waiting")


def public_status(user_id: str, biz_id: str, now: Optional[float] = None) -> dict:
    """화면에 내려 줄 상태. 다른 사용자의 큐는 보이지 않는다(없는 것과 같다)."""
    t = now if now is not None else time.time()
    _purge(t)
    q = _queues.get(biz_id)
    if not q or q["user_id"] != user_id:
        return {"state": "idle"}
    wait_sec = max(0, int(q["wait_until"] - t)) if q["state"] == "waiting" else 0
    return {
        "state": q["state"],                    # running | waiting | done | paused
        "total": q["total"],
        "done": q["done"],
        "failed": q["failed"],
        "remaining": max(0, q["total"] - q["done"]),
        "wait_sec": wait_sec,
        "message": q["message"],
    }


async def _run(q: dict, ids: list[str], sync_fn: SyncFn, sleep: Callable[[float], Awaitable[None]]) -> None:
    user = {"id": q["user_id"]}
    waits = 0
    i = 0
    try:
        while i < len(ids):
            cid = ids[i]
            try:
                await sync_fn(cid, user)            # 갱신됨/방금 확인한 값 모두 '처리됨'
            except HTTPException as e:
                if e.status_code == 429 and waits < MAX_WAITS:
                    try:
                        ra = int((e.headers or {}).get("Retry-After", ""))
                    except (TypeError, ValueError):
                        ra = 0
                    wait = min(ra, MAX_WAIT_SEC) if ra > 0 else DEFAULT_WAIT_SEC
                    waits += 1
                    q["state"], q["wait_until"] = "waiting", time.time() + wait
                    await sleep(wait)
                    q["state"] = "running"
                    continue                        # 같은 경쟁사부터 다시
                if e.status_code in (429, 503):
                    # 한도를 거듭 넘었거나 네이버 쪽 사정 — 남은 경쟁사에 요청을 계속 보내지 않는다
                    q["state"], q["message"] = "paused", str(e.detail)
                    return
                if e.status_code == 404:            # 그 사이 삭제된 경쟁사
                    q["total"] = max(0, q["total"] - 1)
                    ids = ids[:i] + ids[i + 1:]
                    continue
                q["failed"] += 1                    # 422(플레이스 못 찾음)·403·500 등 — 다음 경쟁사로
            except Exception as e:
                _logger.warning(f"[competitor-sync-queue] biz={q['biz_id']} comp={cid} 처리 실패: {type(e).__name__}: {e}")
                q["failed"] += 1
            i += 1
            q["done"] = i
            if i < len(ids):
                await sleep(PAUSE_BETWEEN_SEC)
        q["state"] = "done"
    except asyncio.CancelledError:
        q["state"], q["message"] = "paused", "서버가 다시 시작되어 중단됐어요. 남은 경쟁사는 다시 눌러 채울 수 있어요."
        raise
    except Exception as e:                          # 큐가 '진행 중'으로 영원히 남지 않게
        _logger.warning(f"[competitor-sync-queue] biz={q['biz_id']} 비정상 종료: {type(e).__name__}: {e}")
        q["state"], q["message"] = "paused", "처리 중 문제가 생겨 멈췄어요. 잠시 후 다시 시도해 주세요."
    finally:
        q["finished_at"] = time.time()


def start(user_id: str, biz_id: str, competitor_ids: list[str], sync_fn: SyncFn,
          sleep: Callable[[float], Awaitable[None]] = asyncio.sleep) -> dict:
    """큐를 시작한다. 이미 이 사용자의 큐가 돌고 있으면 새로 만들지 않고 현재 상태를 돌려준다.

    반환: {"started": bool, "reason": None|"already_running"|"user_busy"|"too_many"|"nothing", **public_status}
    """
    now = time.time()
    _purge(now)
    ids = list(dict.fromkeys(competitor_ids))[:MAX_TARGETS]
    if not ids:
        return {"started": False, "reason": "nothing", **public_status(user_id, biz_id, now)}
    # 한도(10분 2회·1시간 15회)는 사용자 단위라 같은 사용자의 큐가 둘이면 서로 한도를 다툰다 — 사용자당 하나만
    for b, q in _queues.items():
        if q["user_id"] == user_id and _active(q):
            reason = "already_running" if b == biz_id else "user_busy"
            return {"started": False, "reason": reason, **public_status(user_id, b, now)}
    if sum(1 for q in _queues.values() if _active(q)) >= MAX_ACTIVE_QUEUES:
        return {"started": False, "reason": "too_many", "state": "idle"}
    q = {"user_id": user_id, "biz_id": biz_id, "state": "running", "total": len(ids), "done": 0, "failed": 0,
         "wait_until": 0.0, "message": "", "finished_at": None}
    _queues[biz_id] = q
    task = asyncio.get_running_loop().create_task(_run(q, ids, sync_fn, sleep))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
    return {"started": True, "reason": None, **public_status(user_id, biz_id, now)}
