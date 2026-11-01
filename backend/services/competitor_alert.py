"""경쟁사 변화 알림(COMP_01) 발송 대상 선택 규칙 (2026-11-01).

이전에는 경쟁사 점수가 직전 스캔보다 5점 이상 달라지면 보냈고, `순위변화` 변수에 순위가 아닌 점수 증감 숫자를 넣었다.
서버 실측에서 3일 간격으로 +27/−27처럼 크게 흔들린 점수가 있어(측정 방식·표본 차이 가능) 작은 변화는 실제 변화인지 구분할 수 없다.
그래서 "경쟁사의 등급 구간이 바뀌었고 변화폭이 충분하며 같은 측정 방식으로 두 번 모두 측정된 경우"만 알린다.
점수 숫자는 사용자에게 보여 주지 않는다(텍스트만).
"""
from __future__ import annotations

MIN_DELTA = 10.0          # 내 판단으로 정한 값 — 실사용자 데이터가 쌓이면 조정(미확인)
WEEKLY_CAP_DAYS = 7       # 사업장당 이 기간에 1회 이하
ALERT_TYPE = "competitor_alert"


def _is_number(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def pick_competitor_change(curr_scores: dict | None, prev_scores: dict | None) -> tuple[str, str] | None:
    """(경쟁사명, "AI 노출 상승"|"AI 노출 하락") 또는 None. 조건을 만족하는 변화 중 폭이 가장 큰 것 하나."""
    from services.competitor_ai_exposure import basis_changed
    from services.stage_names import stage_code_for_score

    best: tuple[float, str, str] | None = None
    for comp_id, curr in (curr_scores or {}).items():
        prev = (prev_scores or {}).get(comp_id)
        if not isinstance(curr, dict) or not isinstance(prev, dict):
            continue
        if basis_changed(curr, prev):
            continue  # 측정 방식이 바뀐 구간의 차이는 경쟁사의 실제 변화가 아니다
        cs, ps = curr.get("score"), prev.get("score")
        if not (_is_number(cs) and _is_number(ps)):
            continue  # 값이 없는 것은 0점이 아니라 '확인 전' — 0으로 바꿔 하락으로 알리지 않는다
        delta = cs - ps
        if abs(delta) < MIN_DELTA:
            continue
        if stage_code_for_score(cs) == stage_code_for_score(ps):
            continue  # 같은 등급 구간 안의 움직임은 알리지 않는다
        name = (curr.get("name") or "").strip() or "경쟁사"
        text = "AI 노출 상승" if delta > 0 else "AI 노출 하락"
        if best is None or abs(delta) > best[0]:
            best = (abs(delta), name, text)
    return (best[1], best[2]) if best else None
