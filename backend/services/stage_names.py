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


def prev_scored_before_baseline(prev_score_date: Optional[str], baseline: Optional[str]) -> bool:
    """이전 점수 기록이 채점 방식 변경 이전(기준일 전)에 계산된 것인지 — 그렇다면 단계 상승 알림을 보내지 않는다.

    2026-10-29: 정기 스캔이 블로그 언급을 채점에 넣기 시작하면서(점수 보정) 모든 사업장의 단계가 "실제 성장 없이" 한 번
    오른다. 이를 `AEOLAB_GROWTH_01`(성장 단계 상승 안내)로 보내면 거짓 성장 알림이 된다. 환경변수
    `GROWTH_ALERT_BASELINE_DATE`(YYYY-MM-DD)보다 이른 기록과의 비교만 건너뛰고, 보정 후 첫 스캔이 기록되면
    그 다음부터는 자동으로 알림이 재개된다(정리 작업 불필요). 기준일이 비었거나 형식이 틀리면 막지 않는다.
    """
    b = (baseline or "").strip()
    d = (prev_score_date or "").strip()[:10]
    if len(b) != 10 or len(d) != 10:
        return False
    return d < b      # ISO 날짜 문자열은 사전순 비교가 날짜순과 같다


# 단계 상승 알림 히스테리시스 — 경계 근처에서 점수가 흔들려도 같은 상승 알림이 반복되지 않게 한다(2026-10-29).
STAGE_UPGRADE_MARGIN = 3.0          # 새 단계의 하한을 이만큼 넘어야 "올랐다"고 알린다
STAGE_UPGRADE_LOOKBACK_DAYS = 28    # 이 기간에 이미 그 단계에 도달한 적이 있으면 재도달은 알리지 않는다
_STAGE_LOWER_BOUND: dict[str, float] = {"survival": 0.0, "stability": 30.0, "growth": 55.0, "dominance": 75.0}


def upgrade_alert_allowed(
    curr_code: Optional[str],
    curr_track1: Optional[float],
    recent_track1: "list[Optional[float]]",
    margin: float = STAGE_UPGRADE_MARGIN,
) -> bool:
    """단계 상승 알림(AEOLAB_GROWTH_01)을 보내도 되는지 — 경계에서 흔들리는 점수의 반복 알림을 막는다.

    `AEOLAB_GROWTH_01`은 "상승이 확인될 경우" 보내는 알림이라, 55점 경계에서 54.8↔55.2를 오가면 매번 "개선 중으로
    올랐어요"가 나가 신뢰를 깎는다. 두 조건을 모두 만족할 때만 보낸다.
      ① 현재 점수가 새 단계의 하한을 `margin`점 이상 넘었다(방금 간신히 넘은 것이 아니다).
      ② 최근 `STAGE_UPGRADE_LOOKBACK_DAYS`일 점수 기록 중 ①과 같은 기준(하한+마진)을 넘은 적이 없다 — 이미 알린 단계의 재도달이 아니다.
    알 수 없는 단계·점수는 보내지 않는다(확인 못 한 상승은 알리지 않는다).
    """
    lower = _STAGE_LOWER_BOUND.get(curr_code or "")
    if lower is None or curr_track1 is None:
        return False
    if curr_track1 < lower + margin:
        return False
    # 기록이 하한을 간신히 넘은 정도(마진 미만)였다면 그때는 알림이 나가지 않았으므로 '이미 알린 단계'가 아니다
    return not any(isinstance(s, (int, float)) and s >= lower + margin for s in (recent_track1 or []))


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


# 이번 점수가 전체 가중치의 이 비율 미만으로만 계산됐으면(나머지는 '확인 전'으로 제외) 단계 변화는 실제 성장이 아니라
# 측정 공백일 수 있다 → 성장 단계 상승 알림을 보내지 않는다. 근거 없는 제안값(2026-10-30, K 점검) — 실데이터로 보정할 것.
STAGE_ALERT_MIN_COVERAGE = 0.4


def coverage_allows_stage_alert(coverage) -> bool:
    """coverage(0~1)를 알 수 없으면(키 없음·구버전 기록) 기존 동작대로 허용한다. 40% 미만일 때만 막는다."""
    if isinstance(coverage, bool) or not isinstance(coverage, (int, float)):
        return True
    return coverage >= STAGE_ALERT_MIN_COVERAGE
