"""성장 단계 이름 단일 소스 (2026-10-28).

배경: 같은 점수 구간(30/55/75)을 세 벌 이상의 이름으로 부르고 있었다 —
  ① 히어로·공유 카드: "AI 검색 준비도 · 양호/개선 중/보강 단계/시작 전" (2026-10-27, 인기 가게 사례를 계기로 정함)
  ② score_engine·갭 카드·점수 안내: "지역 1등/빠른 성장/성장 중/시작 단계"
  ③ gap_analyzer·알림톡·이메일·가이드: "지배기/성장기/안정기/생존기"
"지역 1등"·"지배기(업계 최상위)"는 점수 구간일 뿐 실제 순위가 아닌데 순위처럼 읽히는 과장이고, "생존기"는 낮게 평가될 때
거부감을 준다. 점수가 재는 것(AI 검색 준비도)에 이름을 맞춘 ①로 통일한다.

내부 코드(survival/stability/growth/dominance)와 점수 구간은 바꾸지 않는다 — DB·계산·단계 변화 감지는 코드로 한다.
화면·알림에는 항상 이 모듈의 이름을 쓰고, DB에 저장된 옛 라벨 문구는 `normalize_stage_label`로 새 이름으로 바꿔 보인다.
프론트 대응 모듈: frontend/lib/scoreLabels.ts (STAGE_NAME). 둘은 tests/test_stage_names.py 가 같은지 검사한다.
"""
from __future__ import annotations

from typing import Optional

STAGE_NAME: dict[str, str] = {
    "survival": "시작 전",
    "stability": "보강 단계",
    "growth": "개선 중",
    "dominance": "양호",
}
READINESS_PREFIX = "AI 검색 준비도 · "

# (이 점수 미만이면 단계) — 마지막은 이상이면 dominance. score_engine._GROWTH_THRESHOLDS 와 같아야 한다.
_UPPER_BOUNDS = ((30, "survival"), (55, "stability"), (75, "growth"))

# 옛 라벨 → 코드. DB의 growth_stage_label·AI가 만든 옛 텍스트를 새 이름으로 바꿔 보이기 위한 것(새 화면에 쓰지 말 것).
LEGACY_STAGE_LABELS: dict[str, str] = {
    "시작 단계": "survival", "성장 중": "stability", "빠른 성장": "growth", "지역 1등": "dominance",
    "생존기": "survival", "안정기": "stability", "성장기": "growth", "지배기": "dominance", "선도기": "dominance",
    "성장 준비 중": "stability", "성장 진행 중": "growth", "안정 궤도": "dominance",
}


# 낮은 단계 → 높은 단계 순서. 단계 "상승" 판정의 단일 소스(알림톡 AEOLAB_GROWTH_01 은 "상승이 확인될 경우 발송"으로 승인됨).
STAGE_ORDER: tuple[str, ...] = ("survival", "stability", "growth", "dominance")


def is_stage_upgrade(prev_code: Optional[str], curr_code: Optional[str]) -> bool:
    """이전보다 **높은** 단계로 올라갔을 때만 True. 같은 단계·하락·알 수 없는 코드는 False.

    2026-10-28: 호출부가 `prev != curr`만 보고 "성장 단계 업그레이드 안내"를 보내 하락도 업그레이드로 알렸다.
    """
    if prev_code not in STAGE_ORDER or curr_code not in STAGE_ORDER:
        return False
    return STAGE_ORDER.index(curr_code) > STAGE_ORDER.index(prev_code)


def stage_code_for_score(score: Optional[float]) -> str:
    s = score or 0
    for upper, code in _UPPER_BOUNDS:
        if s < upper:
            return code
    return "dominance"


def stage_name(code: Optional[str]) -> str:
    return STAGE_NAME.get(code or "", "")


def stage_long_name(code: Optional[str]) -> str:
    n = stage_name(code)
    return f"{READINESS_PREFIX}{n}" if n else ""


def normalize_stage_label(label: Optional[str], code: Optional[str] = None) -> str:
    """화면에 보일 이름. 코드가 있으면 코드 기준(가장 믿을 수 있음), 없으면 옛 라벨을 새 이름으로, 그 외는 그대로."""
    if code in STAGE_NAME:
        return STAGE_NAME[code]
    if label in STAGE_NAME.values():
        return label or ""
    if label in LEGACY_STAGE_LABELS:
        return STAGE_NAME[LEGACY_STAGE_LABELS[label]]
    return label or ""
