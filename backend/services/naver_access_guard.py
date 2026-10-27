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


def report_place_block(source: str, now: Optional[float] = None) -> int:
    """차단 화면을 감지했을 때 호출 — 회로를 열고 쿨다운 분(minute)을 반환."""
    _load()
    t = now if now is not None else time.time()
    # 이미 열린 상태에서 같은 시점에 들어온 중복 보고는 단계를 올리지 않는다(진행 중이던 다른 호출의 늦은 보고)
    if _state["open_until"] and t < _state["open_until"]:
        return int((_state["open_until"] - t) // 60)
    strikes = int(_state["strikes"]) + 1
    minutes = COOLDOWN_STEPS_MIN[min(strikes - 1, len(COOLDOWN_STEPS_MIN) - 1)]
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
