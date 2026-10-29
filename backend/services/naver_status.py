"""사용자에게 보여 줄 네이버 확인 상태 (2026-10-29).

네이버 접속은 차단 보호(회로 차단기·속도 제한·일일 상한) 때문에 한동안 멈출 수 있다. 이때 사용자는 점수가 왜 안 바뀌는지,
언제 다시 확인되는지 알 길이 없었다("잠시 후 다시"뿐). 이 모듈은 이미 서버가 알고 있는 상태(쿨다운 남은 시간 등)를
**내부 수치 없이** 사용자 문구로 바꿔 준다 — 한도·횟수·차단 단계 같은 운영 정보는 내보내지 않는다.

상태:
  ok         정상 — 화면에 아무것도 보이지 않는다.
  delayed    쿨다운 중이거나 오늘 확인 한도에 닿았다 — 재개 예상 시점을 알려 준다(예상이며 달라질 수 있다).
  recovering 쿨다운은 끝났고 다음 측정에서 정상 여부를 확인하는 중 — 곧 재개된다.
"""
from __future__ import annotations

import math
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

_KST = timezone(timedelta(hours=9))

# 모든 지연 상태에 공통으로 붙는 안내 — 사용자가 알아야 할 것: 값이 사라지지 않는다 / 글로벌 AI 측정은 정상.
KEEP_NOTE = "그동안 네이버 항목은 마지막으로 확인한 값이 유지되거나 '확인 전'으로 표시돼요. ChatGPT·Gemini 등 AI 검색 측정은 그대로 진행돼요."


def eta_label(seconds: int) -> str:
    """남은 초 → 사용자 문구. 10분 단위(1시간 이하)·1시간 단위 반올림으로 정확한 시각처럼 보이지 않게 한다."""
    if seconds <= 0:
        return "곧"
    minutes = math.ceil(seconds / 60)
    if minutes <= 60:
        return f"약 {max(10, math.ceil(minutes / 10) * 10)}분 뒤"
    return f"약 {max(1, math.floor(minutes / 60 + 0.5))}시간 뒤"


def _seconds_until_next_midnight_kst(now_ts: float) -> int:
    now = datetime.fromtimestamp(now_ts, tz=_KST)
    nxt = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return int((nxt - now).total_seconds())


def user_status(now: Optional[float] = None) -> dict:
    """현재 네이버 확인 상태. 가드 상태는 읽기만 하며 어떤 접속도 일으키지 않는다."""
    from services.naver_access_guard import snapshot, search_snapshot
    from services.ai_scanner import naver_playwright_quota_usage

    t = now if now is not None else time.time()
    place, search = snapshot(t), search_snapshot(t)
    cooldown = max(int(place.get("remaining_sec") or 0), int(search.get("remaining_sec") or 0))
    recovering = cooldown <= 0 and (int(place.get("strikes") or 0) > 0 or int(search.get("strikes") or 0) > 0)
    used, cap = naver_playwright_quota_usage()
    cap_hit = cap > 0 and used >= cap

    if cooldown > 0:
        label = eta_label(cooldown)
        return {"state": "delayed", "reason": "cooldown", "resume_in_sec": cooldown, "eta_label": label,
                "message": f"네이버 확인이 지연되고 있어요. {label} 다시 확인돼요.", "detail": KEEP_NOTE}
    if cap_hit:
        secs = _seconds_until_next_midnight_kst(t)
        return {"state": "delayed", "reason": "daily_limit", "resume_in_sec": secs, "eta_label": "내일",
                "message": "오늘은 네이버 확인 요청이 많아 일부 항목이 내일 확인돼요.", "detail": KEEP_NOTE}
    if recovering:
        return {"state": "recovering", "reason": "recovering", "resume_in_sec": None, "eta_label": "곧",
                "message": "네이버 확인을 다시 시작하는 중이에요. 다음 측정 때 새 값으로 갱신돼요.", "detail": KEEP_NOTE}
    return {"state": "ok", "reason": None, "resume_in_sec": None, "eta_label": None, "message": "", "detail": ""}
