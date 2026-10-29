"""사용자 요청이 만드는 네이버 접속량 계측 (2026-10-29).

용량 모델의 가장 큰 미지수는 "사용자가 직접 누른 스캔·새로고침이 전체 접속에서 차지하는 몫"이다(모델은 사업장당 하루
0.2회라고 가정했을 뿐 근거가 없다). 기존 한도 기록(ai_scanner/__init__.py)은 정기 잡 합계(batch_used)만 따로 알 뿐
사용자 몫이 어떤 동작에서 나오는지, 하루 수동 스캔이 몇 번인지는 알 수 없었다. 이 모듈이 그것을 센다.

- 접속 한도·차단 판단에는 관여하지 않는다(기록만). 기록 실패는 호출자를 막지 않는다.
- 계정·IP·이메일은 저장하지 않는다. 사업장 id(UUID)는 '서로 다른 사업장 수'를 세기 위해 오늘 치만 상태 파일에 둔다.
- 자정에 하루 한 줄(JSON)을 이력 파일에 남긴다. 구독자 데이터가 쌓이면 /admin/naver-access의 usage로 모델 가정을 교체한다.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import date

_logger = logging.getLogger("aeolab")

MODEL_ASSUMED_SCANS_PER_BIZ_PER_DAY = 0.2   # scripts/naver_load_model.py USER_SCANS_PER_BIZ_PER_DAY (근거 없는 가정)

_state: dict = {"date": "", "user_pages": 0, "user_by_source": {}, "scans_by_kind": {}, "scan_bizs": []}


def _state_path() -> str:
    default = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".naver_usage_meter.json")
    return os.getenv("NAVER_USAGE_METER_FILE", default)


def _history_path() -> str:
    return _state_path().replace(".json", "_history.jsonl")


def _empty(day: str) -> dict:
    return {"date": day, "user_pages": 0, "user_by_source": {}, "scans_by_kind": {}, "scan_bizs": []}


def _has_data(st: dict) -> bool:
    return bool(st.get("user_pages") or st.get("scans_by_kind"))


def _append_history(st: dict) -> None:
    if not st.get("date") or not _has_data(st):
        return
    try:
        with open(_history_path(), "a", encoding="utf-8") as f:
            f.write(json.dumps({
                "date": st["date"], "user_pages": st["user_pages"],
                "user_by_source": st["user_by_source"], "scans_by_kind": st["scans_by_kind"],
                "scan_bizs": len(st["scan_bizs"]),
            }, ensure_ascii=False) + "\n")
    except Exception as e:
        _logger.warning("[usage_meter] 일별 이력 기록 실패(무시): %s", e)


def _save() -> None:
    try:
        tmp = _state_path() + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(_state, f)
        os.replace(tmp, _state_path())
    except Exception as e:
        _logger.warning("[usage_meter] 상태 저장 실패(메모리 값은 유지): %s", e)


def _roll(today: str) -> None:
    """날짜가 바뀌었으면 어제 치를 이력에 남기고 새로 시작한다."""
    global _state
    if _state.get("date") == today:
        return
    _append_history(_state)
    _state = _empty(today)


def load() -> None:
    """모듈 시작 때 저장된 상태를 복원한다. 오늘 것이 아니면 이력에 남기고 새로 시작한다(재시작이 자정을 넘긴 경우)."""
    global _state
    try:
        with open(_state_path(), "r", encoding="utf-8") as f:
            data = json.load(f)
        _state = {**_empty(data.get("date", "")), **{k: data[k] for k in _empty("") if k in data}}
        _roll(date.today().isoformat())
    except FileNotFoundError:
        _state = _empty(date.today().isoformat())
    except Exception as e:
        _logger.warning("[usage_meter] 상태 읽기 실패(무시, 0부터 시작): %s", e)
        _state = _empty(date.today().isoformat())


def record_user_pages(source: str, cost: int = 1) -> None:
    """정기 잡이 아닌(사용자 요청) 네이버 페이지 로드를 센다. 한도 판단 뒤에 호출되며 실패해도 접속에 영향이 없다."""
    try:
        _roll(date.today().isoformat())
        c = max(1, int(cost))
        _state["user_pages"] += c
        src = source or "unknown"
        _state["user_by_source"][src] = _state["user_by_source"].get(src, 0) + c
        _save()
    except Exception as e:
        _logger.debug("[usage_meter] 페이지 기록 실패(무시): %s", e)


def note_user_scan(kind: str, biz_id: "str | None" = None) -> None:
    """사용자가 직접 시작한 스캔 1회를 센다. kind: stream(대시보드 '지금 측정') / full / basic_trial / trial."""
    try:
        _roll(date.today().isoformat())
        _state["scans_by_kind"][kind] = _state["scans_by_kind"].get(kind, 0) + 1
        if biz_id and str(biz_id) not in _state["scan_bizs"]:
            _state["scan_bizs"].append(str(biz_id))
        _save()
    except Exception as e:
        _logger.debug("[usage_meter] 스캔 기록 실패(무시): %s", e)


def snapshot() -> dict:
    _roll(date.today().isoformat())
    return {
        "date": _state["date"], "user_pages": _state["user_pages"],
        "user_by_source": dict(sorted(_state["user_by_source"].items(), key=lambda kv: -kv[1])),
        "scans_by_kind": dict(_state["scans_by_kind"]), "scan_bizs": len(_state["scan_bizs"]),
    }


def history(limit: int = 30) -> list:
    rows: list = []
    try:
        with open(_history_path(), "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        rows.append(json.loads(line))
                    except ValueError:
                        continue
    except FileNotFoundError:
        return []
    except Exception as e:
        _logger.warning("[usage_meter] 이력 읽기 실패: %s", e)
        return []
    return rows[-max(1, int(limit)):]


def summarize(quota_rows: list, meter_rows: list, active_businesses: int) -> dict:
    """한도 이력(used·batch_used)과 이 모듈의 이력을 날짜로 합쳐 모델 가정과 비교한다.

    사용자 몫 = used − batch_used (정기 잡이 아닌 모든 접속: 수동 스캔·새로고침·체험 등).
    표본이 하루도 없으면 값 대신 None을 돌려준다(0으로 보이지 않게)."""
    days = {r["date"]: {"used": int(r.get("used") or 0), "batch": int(r.get("batch_used") or 0)} for r in quota_rows if r.get("date")}
    scans = {r["date"]: r for r in meter_rows if r.get("date")}
    total_used = sum(d["used"] for d in days.values())
    total_user = sum(max(0, d["used"] - d["batch"]) for d in days.values())
    scan_days = [r for r in scans.values()]
    total_scans = sum(sum((r.get("scans_by_kind") or {}).values()) for r in scan_days)
    n_days = len(set(days) | set(scans))
    per_day = round(total_scans / n_days, 2) if n_days else None
    per_biz = round(total_scans / n_days / active_businesses, 3) if (n_days and active_businesses > 0) else None
    return {
        "days_observed": n_days,
        "user_share_pct": round(total_user / total_used * 100, 1) if total_used else None,
        "manual_scans_per_day": per_day,
        "manual_scans_per_biz_per_day": per_biz,
        "model_assumed_per_biz_per_day": MODEL_ASSUMED_SCANS_PER_BIZ_PER_DAY,
        "basis": "표본이 쌓일수록 정확해진다 — 구독자가 거의 없을 때의 값은 모델 가정을 바꿀 근거가 못 된다",
    }


load()
