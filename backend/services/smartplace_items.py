"""사용자 "스마트플레이스 자동 점검"(POST /api/report/smartplace-check) 항목 구성 (2026-10-27).

docs/improvement_item_catalog_v1.0.md D2·D3.
기존에는 측정하지 못한 항목(사진 None, 근거 없는 메뉴 등)도 `passed=False`로 내려가 화면에 빨간 "개선 필요" 카드로
나갔고, 사진은 "0장 등록됨"이라는 사실이 아닌 값까지 실렸다. 이제 항목마다 `measured`를 두고, 측정하지 못한 항목은
`passed=None`으로 내려 화면이 "확인 전"으로 따로 보여주게 한다. 점수(`total_score`/`max_score`)는 측정된 항목만 센다.
"""
from __future__ import annotations

from typing import Callable, Optional


def _measured(raw: dict, key: str) -> bool:
    """`*_measured` 키가 없는 옛 저장 결과는 측정된 것으로 본다(하위 호환). 명시적 False만 미측정."""
    return raw.get(key, True) is not False


def build_check_items(raw: dict, sp_url: Callable[[str], Optional[str]], place_id: Optional[str]) -> dict:
    items: list[dict] = []

    # 소식
    m = _measured(raw, "recent_post_measured")
    has_post = bool(raw.get("has_recent_post"))
    detail = raw.get("recent_post_date") if m and has_post else None
    if m and not has_post and raw.get("recent_post_state") == "no_tab":
        detail = "소식 탭이 확인되지 않았습니다"
    items.append({
        "label": "최근 소식 업데이트",
        "passed": has_post if m else None,
        "measured": m,
        "score_impact": 25,
        "detail": detail,
        "action_url": sp_url("posts"),
    })

    # 소개글
    m_info = _measured(raw, "intro_measured")
    chars = raw.get("intro_char_count")
    items.append({
        "label": "소개글 작성",
        "passed": bool(raw.get("has_intro")) if m_info else None,
        "measured": m_info,
        "score_impact": 20,
        "detail": f"약 {chars}자" if (m_info and chars) else None,
        "action_url": sp_url("info"),
    })

    # 사진 — None은 "0장"이 아니라 측정 못 한 것
    photo = raw.get("photo_count")
    m_photo = photo is not None
    items.append({
        "label": "사진 5장 이상",
        "passed": (photo >= 5) if m_photo else None,
        "measured": m_photo,
        "score_impact": 10,
        "detail": f"{photo}장 등록됨" if m_photo else None,
        "action_url": sp_url("photo") if place_id else None,
    })

    # 메뉴·서비스 — 근거를 못 찾은 경우는 "없음"이 아니라 확인 안 됨
    m_menu = _measured(raw, "menu_measured")
    items.append({
        "label": "메뉴·서비스 등록",
        "passed": bool(raw.get("has_menu")) if m_menu else None,
        "measured": m_menu,
        "score_impact": 15,
        "detail": None,
        "action_url": sp_url("menu") if place_id else None,
    })

    # 영업시간 — 정보 탭을 읽은 경우에만 측정된 것
    items.append({
        "label": "영업시간 등록",
        "passed": bool(raw.get("has_hours")) if m_info else None,
        "measured": m_info,
        "score_impact": 5,
        "detail": None,
        "action_url": sp_url("info"),
    })

    total_score = sum(i["score_impact"] for i in items if i["measured"] and i["passed"])
    max_score = sum(i["score_impact"] for i in items if i["measured"])
    return {"items": items, "total_score": total_score, "max_score": max_score}
