"""네이버 플레이스 '소식' 탭 본문에서 최근 게시물 여부를 판정하는 공용 파서.

2026-10-27 오탐 수정 (docs/improvement_item_catalog_v1.0.md D1).
기존 판정은 본문 **전체**에 정규식을 걸었다. 그래서
  - 글 본문 안의 문장("아직 장미 소식이 없어…")이 "소식 없음" 문구로 잡혀 글이 34개 있는 가게도 "없음"이 됐고,
  - 글 본문 안의 "행사 1시간 전부터", "6개월 전부터" 같은 표현이 "방금/N시간 전" 게시 시각으로 잡혀
    오래된 글만 있는 가게도 "최근 소식 있음"이 될 수 있었다.

게시 시각은 목록에서 **그 줄에 단독으로** 나온다(`2026.10.20.` 다음 줄 `2026년 10월 20일`). 그래서 줄 단위
전체 일치만 게시 시각으로 읽는다. 본문 문장 속 표현은 읽지 않는다.

판정 결과(state):
  recent     : 90일 이내 게시 시각이 있음
  old        : 게시 시각은 있으나 모두 90일을 넘음
  none       : 게시 시각이 없고 "등록된 소식이 없습니다" 같은 안내 문구가 단독 줄로 있음
  no_tab     : /feed 가 다른 탭(홈)으로 이동됨 — 소식 탭이 없는 가게
  unmeasured : 게시 시각도 안내 문구도 읽지 못함(로딩 미완료·구조 변경 등) — 어느 쪽으로도 말하지 않는다
"""
from __future__ import annotations

import re
from datetime import date, datetime, timezone
from typing import Optional

RECENT_POST_DAYS = 90

_ABS_LINE = re.compile(r"^(20\d{2})[./\-]\s?(\d{1,2})[./\-]\s?(\d{1,2})\.?$")
_REL_LINE = re.compile(r"^(\d+)\s*(분|시간|일|개월|년)\s*전$")
_JUST_NOW_LINE = re.compile(r"^방금(\s*전)?$")
_NONE_LINE = re.compile(r"^(등록된\s*)?(소식|게시물)(이|가)\s*없습니다\.?$")


def analyze_feed_posts(
    feed_body: Optional[str],
    page_url: Optional[str] = None,
    now: Optional[datetime] = None,
) -> dict:
    """소식 탭 본문을 분석해 {"state", "latest_date"(YYYY-MM-DD|None), "latest_age_days"(int|None)} 반환."""
    if page_url is not None and "/feed" not in page_url:
        return {"state": "no_tab", "latest_date": None, "latest_age_days": None}
    if not feed_body or not feed_body.strip():
        return {"state": "unmeasured", "latest_date": None, "latest_age_days": None}

    today: date = (now or datetime.now(timezone.utc)).date()
    ages: list[int] = []
    latest_abs: Optional[date] = None
    saw_none_message = False

    for raw in feed_body.splitlines():
        line = raw.strip()
        if not line:
            continue
        m = _ABS_LINE.match(line)
        if m:
            try:
                d = date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
            except ValueError:
                continue
            if d > today:  # 미래 날짜는 게시 시각이 아니다
                continue
            ages.append((today - d).days)
            if latest_abs is None or d > latest_abs:
                latest_abs = d
            continue
        if _JUST_NOW_LINE.match(line):
            ages.append(0)
            continue
        m = _REL_LINE.match(line)
        if m:
            n, unit = int(m.group(1)), m.group(2)
            ages.append(
                0 if unit in ("분", "시간")
                else n if unit == "일"
                else n * 30 if unit == "개월"
                else n * 365
            )
            continue
        if _NONE_LINE.match(line):
            saw_none_message = True

    if ages:
        youngest = min(ages)
        state = "recent" if youngest <= RECENT_POST_DAYS else "old"
        return {
            "state": state,
            "latest_date": latest_abs.isoformat() if latest_abs else None,
            "latest_age_days": youngest,
        }
    if saw_none_message:
        return {"state": "none", "latest_date": None, "latest_age_days": None}
    return {"state": "unmeasured", "latest_date": None, "latest_age_days": None}


def to_has_recent_post(analysis: dict) -> Optional[bool]:
    """state → has_recent_post. 측정 불가(unmeasured)는 None(어느 쪽으로도 단정하지 않는다)."""
    state = analysis.get("state")
    if state == "recent":
        return True
    if state in ("old", "none", "no_tab"):
        return False
    return None
