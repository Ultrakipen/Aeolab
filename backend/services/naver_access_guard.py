"""네이버 플레이스 접속 보호 — 차단 감지 시 자동 중단(회로 차단기) + 요청 간 무작위 대기 (2026-10-27).

배경: 2026-10-27 19:03경 서버 IP(프록시 없이 직접 접속)가 네이버 플레이스에서
"과도한 접근 요청으로 서비스 이용이 제한되었습니다" 화면을 받았다. 기존에는 차단 화면을 감지해도 그 호출의 측정값만
버리고 다음 요청을 계속 보내, 차단 상태에서 요청을 쌓아 제한을 연장할 수 있었다.

동작
  - 플레이스 접속 함수가 차단 화면을 감지하면 `report_place_block()` → 회로가 열려 일정 시간 모든 플레이스 접속을
    즉시 건너뛴다(`naver_place_cooldown` 오류, 네이버 요청 없음).
  - 쿨다운이 끝나면 **한 번만** 시험 접속(half-open). 성공하면 닫고, 또 차단이면 쿨다운을 두 배로 늘린다
    (3시간 → 6시간 → 12시간 → 24시간 상한).
  - 상태는 파일에 저장해 서버 재시작·배포로 초기화되지 않게 한다(오늘 서버를 여러 번 재시작해도 상한 카운터가 0으로
    돌아갔던 문제 방지).
  - `place_pace()`: 플레이스 접속 사이에 무작위 대기를 넣어 일정한 간격의 기계적 패턴을 피한다.

범위: 플레이스 도메인(m.place.naver.com / pcmap) 접속만. 검색 화면(AI 브리핑·AI탭)은 이 차단이 같이 적용되는지
확인되지 않아 건드리지 않는다.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import random
import time
from typing import Optional

_logger = logging.getLogger("aeolab")

COOLDOWN_STEPS_MIN = (180, 360, 720, 1440)  # 연속 차단 때마다 3h → 6h → 12h → 24h(상한). 제안값, 실측 근거 없음.
_PROBE_STALE_SEC = 300                       # 시험 접속이 5분 넘게 끝나지 않으면 다시 허용
COOLDOWN_ERROR = "naver_place_cooldown"

_state: dict = {"strikes": 0, "open_until": 0.0, "probing_since": 0.0, "last_block_at": 0.0, "last_source": ""}
_loaded = False


def _state_path() -> str:
    default = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".naver_place_breaker.json")
    return os.getenv("NAVER_PLACE_BREAKER_FILE", default)


def _load() -> None:
    global _loaded
    if _loaded:
        return
    _loaded = True
    try:
        with open(_state_path(), "r", encoding="utf-8") as f:
            data = json.load(f)
        for k in _state:
            if k in data:
                _state[k] = data[k]
    except FileNotFoundError:
        pass
    except Exception as e:  # 손상된 파일은 무시하고 닫힌 상태로 시작(차단을 못 막는 쪽이 아니라 접속을 막는 쪽 실패는 피한다)
        _logger.warning("[naver_guard] 상태 파일 읽기 실패(무시): %s", e)


def _save() -> None:
    try:
        tmp = _state_path() + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(_state, f)
        os.replace(tmp, _state_path())
    except Exception as e:
        _logger.warning("[naver_guard] 상태 파일 저장 실패(메모리 상태는 유지): %s", e)


def reset_for_tests() -> None:
    """테스트용 — 메모리 상태를 초기화하고 파일을 다시 읽게 한다."""
    global _loaded
    _loaded = False
    _state.update({"strikes": 0, "open_until": 0.0, "probing_since": 0.0, "last_block_at": 0.0, "last_source": ""})


def begin_place_access(source: str, now: Optional[float] = None) -> tuple[bool, Optional[str]]:
    """플레이스 접속 직전에 호출. (허용 여부, 거부 시 오류 코드). 거부되면 네이버 요청을 보내면 안 된다."""
    _load()
    t = now if now is not None else time.time()
    if _state["open_until"] and t < _state["open_until"]:
        return False, COOLDOWN_ERROR
    if _state["strikes"] > 0:  # 쿨다운은 끝났지만 아직 회복 확인 전 — half-open: 한 번에 하나만 시험 접속
        probing = _state["probing_since"]
        if probing and (t - probing) < _PROBE_STALE_SEC:
            return False, COOLDOWN_ERROR
        _state["probing_since"] = t
        _save()
        _logger.warning("[naver_guard] 쿨다운 종료 — 시험 접속 1회 허용 (source=%s)", source)
    return True, None


def report_place_ok() -> None:
    """차단이 아닌 정상 화면을 읽었을 때 호출 — 회복 확인."""
    _load()
    if _state["strikes"] or _state["open_until"] or _state["probing_since"]:
        _logger.warning("[naver_guard] 플레이스 접속 회복 확인 — 회로 닫음")
        _state.update({"strikes": 0, "open_until": 0.0, "probing_since": 0.0})
        _save()
        tighten_rate(time.time())   # 회복 직후 48시간은 속도 기준을 절반으로


def report_place_block(source: str, now: Optional[float] = None) -> int:
    """차단 화면을 감지했을 때 호출 — 회로를 열고 쿨다운 분(minute)을 반환."""
    _load()
    t = now if now is not None else time.time()
    # 이미 열린 상태에서 같은 시점에 들어온 중복 보고는 단계를 올리지 않는다(진행 중이던 다른 호출의 늦은 보고)
    if _state["open_until"] and t < _state["open_until"]:
        return int((_state["open_until"] - t) // 60)
    strikes = int(_state["strikes"]) + 1
    minutes = COOLDOWN_STEPS_MIN[min(strikes - 1, len(COOLDOWN_STEPS_MIN) - 1)]
    _rate_clear_on_block(t)
    _state.update({
        "strikes": strikes,
        "open_until": t + minutes * 60,
        "probing_since": 0.0,
        "last_block_at": t,
        "last_source": source,
    })
    _save()
    _logger.error(
        "[naver_guard] 네이버 플레이스 차단 화면 감지 — 접속 %d분 중단 (연속 %d회, source=%s)", minutes, strikes, source
    )
    _alert_operator(source, strikes, minutes)
    return minutes


def _alert_operator(source: str, strikes: int, minutes: int) -> None:
    async def _send() -> None:
        try:
            from services.email_sender import send_operator_alert
            await send_operator_alert(
                "네이버 플레이스 접속 제한 감지 — 자동 중단",
                f"서버 IP가 네이버 플레이스에서 접속 제한 화면을 받았습니다(source={source}). "
                f"플레이스 접속을 {minutes}분간 자동 중단합니다(연속 {strikes}회). "
                "중단 중에는 측정이 '확인 전'으로 표시되고 직전 성공 결과가 날짜와 함께 보입니다.",
            )
        except Exception as e:
            _logger.warning("[naver_guard] 운영자 알림 발송 실패: %s", e)

    coro = _send()
    try:
        asyncio.get_running_loop().create_task(coro)
    except RuntimeError:
        coro.close()  # 이벤트 루프 밖(동기 호출·테스트) — 알림만 생략


def snapshot(now: Optional[float] = None) -> dict:
    """현재 상태(관리자 화면·점검용)."""
    _load()
    t = now if now is not None else time.time()
    remaining = max(0, int(_state["open_until"] - t)) if _state["open_until"] else 0
    return {**_state, "open": remaining > 0, "remaining_sec": remaining}


async def place_pace(lo: float = 0.8, hi: float = 2.5) -> None:
    """플레이스 접속 호출 사이의 무작위 대기 — 일정한 간격의 기계적 패턴을 피한다."""
    await asyncio.sleep(random.uniform(lo, hi))


# ───────────────────────────────────────────────────────────────────────────
# 속도 기준(사전 예방) — 슬라이딩 윈도우 (2026-10-27)
#
# 위 회로 차단기는 차단을 "당한 뒤" 멈추는 장치다. 이 절은 차단을 "당하기 전에" 속도를 제한하는 기준이다.
# 네이버는 임계값을 공개하지 않는다. 확인된 사실은 하나뿐이다: 2026-10-27 서버에서 플레이스 약 65~70페이지를
# 짧은 시간(수 분 안)에 연속 요청했을 때 "과도한 접근 요청" 화면이 나왔다(정확한 시간·임계는 미측정).
# 아래 기본값은 그 사건보다 충분히 느리게 잡은 **보수적 제안값**이며 실측으로 검증된 안전선이 아니다.
# 환경변수로 조정하고, 차단이 다시 나면 자동으로 절반으로 조인다.
#
#   윈도우      기본 최대 페이지   평균 속도
#   1분         12                 12/분 (한 번의 경쟁사 크롤 cost 10이 1분에 1번)
#   10분        30                 3/분
#   1시간       120                2/분
#
# 동작: 호출 직전에 `await reserve_place_pages(cost)`로 "빈 자리가 나는 시각"을 예약하고 그때까지 기다린다.
# 예약은 시각 순서로만 쌓이므로(이전 예약보다 앞서지 않음) 동시에 여러 호출이 와도 한도를 넘지 않는다.
# 기다릴 시간이 한도를 넘으면(사용자 요청 15초, 정기 잡 30분) 네이버 요청 없이 `naver_rate_limited`로 거절한다.
# ───────────────────────────────────────────────────────────────────────────
RATE_LIMITED_ERROR = "naver_rate_limited"
_DEFAULT_WINDOWS = ((60, 12), (600, 30), (3600, 120))   # (윈도우 초, 최대 페이지) — 제안값
_TIGHTEN_HOURS = 48          # 차단에서 회복한 뒤 이 시간 동안 한도를 절반으로
_USER_MAX_WAIT_SEC = 15.0
_BATCH_MAX_WAIT_SEC = 1800.0

_rate: dict = {"entries": [], "tight_until": 0.0}   # entries: [[시각, 페이지 수], ...] 시각 오름차순
_rate_loaded = False
_rate_lock: Optional[asyncio.Lock] = None


def _rate_path() -> str:
    default = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".naver_rate_window.json")
    return os.getenv("NAVER_RATE_WINDOW_FILE", default)


def rate_limits(now: Optional[float] = None) -> tuple[tuple[int, int], ...]:
    """현재 적용 중인 (윈도우 초, 최대 페이지). 환경변수 NAVER_RATE_PER_MIN / _10MIN / _HOUR로 조정."""
    t = now if now is not None else time.time()
    env = (("NAVER_RATE_PER_MIN", 0), ("NAVER_RATE_PER_10MIN", 1), ("NAVER_RATE_PER_HOUR", 2))
    vals = [list(w) for w in _DEFAULT_WINDOWS]
    for name, i in env:
        try:
            v = int(os.getenv(name, ""))
            if v > 0:
                vals[i][1] = v
        except ValueError:
            pass
    tight = 0.5 if (_rate_state_loaded_tight() > t) else 1.0
    return tuple((w, max(1, int(m * tight))) for w, m in vals)


def _rate_state_loaded_tight() -> float:
    _rate_load()
    return float(_rate["tight_until"])


def _rate_load() -> None:
    global _rate_loaded
    if _rate_loaded:
        return
    _rate_loaded = True
    try:
        with open(_rate_path(), "r", encoding="utf-8") as f:
            data = json.load(f)
        _rate["entries"] = [[float(a), int(b)] for a, b in data.get("entries", [])]
        _rate["tight_until"] = float(data.get("tight_until", 0.0))
    except FileNotFoundError:
        pass
    except Exception as e:
        _logger.warning("[naver_guard] 속도 기록 파일 읽기 실패(무시): %s", e)


def _rate_save() -> None:
    try:
        tmp = _rate_path() + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(_rate, f)
        os.replace(tmp, _rate_path())
    except Exception as e:
        _logger.warning("[naver_guard] 속도 기록 파일 저장 실패(메모리 상태는 유지): %s", e)


def _prune(now: float) -> None:
    horizon = now - max(w for w, _ in _DEFAULT_WINDOWS)
    _rate["entries"] = [e for e in _rate["entries"] if e[0] > horizon]


def _earliest_slot(cost: int, now: float) -> float:
    """cost 페이지를 넣어도 모든 윈도우 한도를 넘지 않는 가장 이른 시각(이전 예약보다 앞서지 않음)."""
    entries = _rate["entries"]
    limits = rate_limits(now)
    start = max(now, entries[-1][0] if entries else now)
    # 후보: 지금 또는 어떤 기록이 윈도우 밖으로 빠지는 순간
    cands = {start}
    for ts, _ in entries:
        for w, _m in limits:
            if ts + w > start:
                cands.add(ts + w + 0.001)
    for t in sorted(cands):
        ok = True
        for w, m in limits:
            used = sum(c for ts, c in entries if t - w < ts <= t)
            if used + min(cost, m) > m:
                ok = False
                break
        if ok:
            return t
    return max(cands)   # 도달 불가(한도가 cost보다 작아도 min(cost,m)로 보정되므로 사실상 없음)


def record_external(cost: int, now: Optional[float] = None) -> None:
    """검색 화면(브리핑·AI탭·순위) 접속처럼 이 제한기를 거치지 않는 네이버 접속을 기록만 한다(대기 없음).
    같은 IP의 총 요청량이 플레이스 접속 허용량에서 차감되게 하려는 것이다."""
    _rate_load()
    t = now if now is not None else time.time()
    _prune(t)
    _rate["entries"].append([t, max(1, int(cost))])
    _rate["entries"].sort(key=lambda e: e[0])
    _rate_save()


async def reserve_place_pages(cost: int, source: str = "", *, batch: Optional[bool] = None,
                              now: Optional[float] = None, sleep: bool = True) -> tuple[bool, Optional[str], float]:
    """플레이스 접속 직전에 호출 — 속도 기준에 맞는 시각까지 기다린다. (허용, 오류코드, 기다린 초) 반환.

    허용되지 않으면 네이버 요청을 보내면 안 된다. Playwright 세마포어를 잡기 **전에** 호출해야 한다
    (기다리는 동안 다른 네이버 작업이 막히지 않게)."""
    global _rate_lock
    _rate_load()
    if _rate_lock is None:
        _rate_lock = asyncio.Lock()
    if batch is None:
        try:
            from services.ai_scanner import is_naver_batch
            batch = bool(is_naver_batch())
        except Exception:
            batch = False
    max_wait = _BATCH_MAX_WAIT_SEC if batch else _USER_MAX_WAIT_SEC
    async with _rate_lock:
        t0 = now if now is not None else time.time()
        _prune(t0)
        t = _earliest_slot(max(1, int(cost)), t0)
        wait = max(0.0, t - t0)
        if wait > max_wait:
            _logger.warning("[naver_guard] 속도 기준 초과 — %.0f초 대기 필요(허용 %.0f초), 접속 거절 (source=%s, batch=%s)",
                            wait, max_wait, source, batch)
            return False, RATE_LIMITED_ERROR, 0.0
        _rate["entries"].append([t, max(1, int(cost))])
        _rate_save()
    if wait > 0 and sleep:
        if wait >= 30:
            _logger.info("[naver_guard] 속도 기준에 맞추려 %.0f초 대기 (source=%s, cost=%s)", wait, source, cost)
        await asyncio.sleep(wait)
    return True, None, wait


def tighten_rate(now: Optional[float] = None) -> None:
    """차단에서 회복한 직후 호출 — 일정 시간 한도를 절반으로."""
    _rate_load()
    t = now if now is not None else time.time()
    _rate["tight_until"] = t + _TIGHTEN_HOURS * 3600
    _rate_save()


def rate_snapshot(now: Optional[float] = None) -> dict:
    _rate_load()
    t = now if now is not None else time.time()
    out = []
    for w, m in rate_limits(t):
        used = sum(c for ts, c in _rate["entries"] if t - w < ts <= t)
        out.append({"window_sec": w, "max": m, "used": used})
    return {"windows": out, "tightened": _rate["tight_until"] > t, "tight_until": _rate["tight_until"]}


def reset_rate_for_tests() -> None:
    global _rate_loaded, _rate_lock
    _rate_loaded = False
    _rate_lock = None
    _rate.update({"entries": [], "tight_until": 0.0})


def _rate_clear_on_block(now: float) -> None:
    """차단을 당했다면 그때까지의 속도 기록으로는 안전선을 판단할 수 없다 — 기록은 두고 조임만 건다."""
    _rate_load()
    _rate["tight_until"] = now + _TIGHTEN_HOURS * 3600
    _rate_save()
