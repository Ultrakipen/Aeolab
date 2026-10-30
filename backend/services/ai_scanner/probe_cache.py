"""비유도 추천 프로브 결과 공유 캐시 (2026-10-30, 기본 꺼짐).

비유도 프로브는 질의에 사업장명이 없다("창원 한식 추천"). 같은 질의는 어느 가게가 물어도 AI에게 같은 질문이므로
추천 목록(places) 표본을 TTL 동안 공유하고 사업장마다 이름만 대조하면 호출량이 구독자 수가 아니라
(지역·업종·키워드) 조합 수에 비례한다. 켜기: 서버 .env `AI_PROBE_CACHE_TTL_SEC=21600` 후 백엔드 재시작(0=끔, 기본).

주의: 같은 질의를 TTL 안에 다시 측정하면 같은 표본이 재사용된다(AI의 학습 지식은 몇 시간 안에 변하지 않는다).
성공한 표본만 저장하고 실패(_measured=False)는 저장하지 않는다. 프로세스 메모리라 재시작하면 비워진다.
"""
from __future__ import annotations

import os
import time

_MAX_QUERIES = 500
_store: dict[tuple[str, str], tuple[float, list[dict]]] = {}
_stats = {"hit_samples": 0, "miss_samples": 0}


def ttl_sec() -> float:
    try:
        return max(0.0, float(os.getenv("AI_PROBE_CACHE_TTL_SEC", "0")))
    except ValueError:
        return 0.0


def enabled() -> bool:
    return ttl_sec() > 0


def _evict(now: float) -> None:
    ttl = ttl_sec()
    for k in [k for k, (ts, _) in _store.items() if now - ts > ttl]:
        _store.pop(k, None)
    if len(_store) > _MAX_QUERIES:
        for k, _ in sorted(_store.items(), key=lambda kv: kv[1][0])[: len(_store) - _MAX_QUERIES]:
            _store.pop(k, None)


def plan(key: str, query_list: list[str], n: int) -> tuple[list[dict], list[str]]:
    """질의별 필요 횟수(n을 균등 분배)를 캐시로 채우고, 새로 호출해야 하는 질의 목록을 돌려준다.

    반환: (캐시에서 꺼낸 성공 결과들, 호출해야 할 질의 목록 — 한 질의가 필요한 횟수만큼 반복).
    꺼진 상태에서는 ([], 기존과 같은 균등 분배 목록)이라 동작이 기존과 같다.
    """
    base, rem = divmod(n, len(query_list))
    cached: list[dict] = []
    todo: list[str] = []
    now = time.monotonic()
    use = enabled()
    if use:
        _evict(now)
    for i, q in enumerate(query_list):
        need = base + (1 if i < rem else 0)
        got: list[dict] = []
        if use:
            entry = _store.get((key, q.strip()))
            if entry:
                got = [{**r, "places": list(r.get("places") or [])} for r in entry[1][:need]]
        cached.extend(got)
        todo.extend([q] * (need - len(got)))
        if use:
            _stats["hit_samples"] += len(got)
            _stats["miss_samples"] += need - len(got)
    return cached, todo


def store(key: str, query: str, result: dict) -> None:
    """성공한 표본 1건을 저장한다(꺼진 상태·실패 표본은 무시)."""
    if not enabled() or not result.get("_measured", True):
        return
    now = time.monotonic()
    k = (key, query.strip())
    entry = _store.get(k)
    if entry is None or now - entry[0] > ttl_sec():
        entry = (now, [])
        _store[k] = entry
    entry[1].append({"places": list(result.get("places") or []), "_measured": True})


def snapshot() -> dict:
    total = _stats["hit_samples"] + _stats["miss_samples"]
    return {
        "enabled": enabled(),
        "ttl_sec": ttl_sec(),
        "entries": len(_store),
        "hit_samples": _stats["hit_samples"],
        "miss_samples": _stats["miss_samples"],
        "hit_rate": round(_stats["hit_samples"] / total, 3) if total else None,
    }


def reset() -> None:
    _store.clear()
    _stats["hit_samples"] = 0
    _stats["miss_samples"] = 0
