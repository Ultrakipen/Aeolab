"""
backend/services/area_snapshot.py

/area 공개 페이지가 읽는 "미리 계산된 값" 저장소 — 지역별 JSON 파일 1개(업종 전체 포함).

- 방문자 요청은 이 파일만 읽는다(외부 API·Supabase 호출 없음). 파일은 수집 스크립트가 채운다.
- 파일 경로는 AREA_SNAPSHOT_DIR 환경변수(기본 backend/data/area_snapshots). git 추적 제외 — 배포(reset --hard)로
  지워지지 않는다.
- 읽기는 프로세스 안에서 mtime 기준으로 캐시한다(파일이 바뀌면 다음 요청에서 다시 읽음).
"""
from __future__ import annotations

import json
import logging
import os
import tempfile
from pathlib import Path
from typing import Optional

import time

from services.area_data import CATEGORIES, CLOSURE_SCOPE_LABEL, REGIONS, SBIZ_SCOPE_LABEL, is_valid

_logger = logging.getLogger("aeolab.area_snapshot")

_DEFAULT_DIR = Path(__file__).resolve().parent.parent / "data" / "area_snapshots"
_mem: dict[str, tuple[float, dict]] = {}


def snapshot_dir() -> Path:
    return Path(os.getenv("AREA_SNAPSHOT_DIR") or _DEFAULT_DIR)


def _path(region_slug: str) -> Path:
    # 슬러그는 REGIONS 키로만 만들어지므로 경로 이동 문자가 들어올 수 없다(호출부가 검증).
    return snapshot_dir() / f"{region_slug}.json"


def load_region(region_slug: str) -> Optional[dict]:
    if region_slug not in REGIONS:
        return None
    p = _path(region_slug)
    try:
        mtime = p.stat().st_mtime
    except OSError:
        return None
    hit = _mem.get(region_slug)
    if hit and hit[0] == mtime:
        return hit[1]
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        _logger.warning("area_snapshot_read_fail %s: %s", region_slug, e)
        return None
    _mem[region_slug] = (mtime, data)
    return data


def save_region(region_slug: str, data: dict) -> None:
    """임시 파일에 쓴 뒤 교체한다(읽는 도중 반쯤 쓰인 파일이 보이지 않게)."""
    global _available_cache
    d = snapshot_dir()
    d.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(d), prefix=f".{region_slug}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
        os.replace(tmp, _path(region_slug))
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise
    _mem.pop(region_slug, None)
    _available_cache = None


def get_area(region_slug: str, category: str) -> dict:
    """공개 응답. 외부 호출 없음. 값이 없으면 0이 아니라 available=False(집계 전)."""
    base = {
        "region_slug": region_slug,
        "category": category,
    }
    if not is_valid(region_slug, category):
        return {**base, "available": False, "reason": "unsupported"}
    base["region_label"] = REGIONS[region_slug]["label"]
    base["category_label"] = CATEGORIES[category]

    snap = load_region(region_slug)
    entry = ((snap or {}).get("categories") or {}).get(category)
    if not entry:
        return {**base, "available": False, "reason": "not_collected"}

    sbiz = entry.get("sbiz")
    closure = entry.get("closure")
    sbiz_ok = bool(sbiz and sbiz.get("available"))
    closure_ok = bool(closure and closure.get("available"))
    if not (sbiz_ok or closure_ok):
        return {**base, "available": False, "reason": "no_data"}

    out = {**base, "available": True, "collected_at": entry.get("collected_at")}
    # 개별 가게 이름(samples)은 공개하지 않는다 — 집계 수치만.
    out["sbiz"] = (
        {
            "total_count": sbiz.get("total_count"),
            "density_per_km2": sbiz.get("density_per_km2"),
            "radius_m": sbiz.get("radius_m"),
            "confidence": sbiz.get("confidence"),
            "partial_failure": bool(sbiz.get("partial_failure")),
            "stdr_ym": sbiz.get("stdr_ym"),
            "scope_label": SBIZ_SCOPE_LABEL.get(category, ""),
        }
        if sbiz_ok
        else None
    )
    out["closure"] = (
        {
            "closure_rate": closure.get("closure_rate"),
            "active_count": closure.get("active_count"),
            "closed_count": closure.get("closed_count"),
            "national_avg": closure.get("national_avg"),
            "comparison": closure.get("comparison"),
            "scope_label": CLOSURE_SCOPE_LABEL.get(category, ""),
        }
        if closure_ok
        else None
    )
    return out


_AVAILABLE_TTL = 300  # 초 — 공개 엔드포인트가 반복 호출돼도 2,800여 조합을 매번 다시 훑지 않게
_available_cache: tuple[float, list[dict]] | None = None


def list_available() -> list[dict]:
    """값이 실제로 있는 (지역, 업종) 조합 — 사이트맵용. 파일만 읽는다(지역당 mtime 캐시 + 5분 결과 캐시)."""
    global _available_cache
    now = time.monotonic()
    if _available_cache and now - _available_cache[0] < _AVAILABLE_TTL:
        return _available_cache[1]
    out: list[dict] = []
    for slug in REGIONS:
        if load_region(slug) is None:
            continue  # 파일이 없는 지역은 업종까지 훑지 않는다
        for cat in CATEGORIES:
            if get_area(slug, cat).get("available"):
                out.append({"region": slug, "category": cat})
    _available_cache = (now, out)
    return out


def coverage() -> dict:
    """수집 현황(운영 점검용) — 지역 수·수집된 지역 수·가장 오래된 수집 시각."""
    collected, oldest = 0, None
    for slug in REGIONS:
        snap = load_region(slug)
        if snap is None:
            continue
        collected += 1
        ts = snap.get("generated_at")
        if ts and (oldest is None or ts < oldest):
            oldest = ts
    return {"regions_total": len(REGIONS), "regions_collected": collected, "oldest_generated_at": oldest}


def list_regions() -> list[dict]:
    return [
        {"slug": r["slug"], "label": r["label"], "sido": r["sido"], "sigungu": r["sigungu"]}
        for r in REGIONS.values()
    ]


def list_categories() -> list[dict]:
    return [{"value": k, "label": v} for k, v in CATEGORIES.items()]
