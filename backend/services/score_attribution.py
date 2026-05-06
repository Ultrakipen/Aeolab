"""
점수 귀인(Score Attribution) 서비스
business_action_log + score_history 연결 → "이 행동이 점수에 얼마나 기여했는가" 설명
AI 호출 없이 템플릿 기반 텍스트 생성
"""
import logging
from datetime import datetime, timedelta, timezone

_logger = logging.getLogger("aeolab")

# dimension 한글 레이블
_DIMENSION_LABELS_KO: dict[str, str] = {
    "keyword_gap_score":        "키워드 커버리지",
    "review_quality":           "리뷰 품질",
    "smart_place_completeness": "스마트플레이스 완성도",
    "naver_exposure_confirmed": "네이버 AI 브리핑 노출",
    "kakao_completeness":       "카카오맵 완성도",
    "multi_ai_exposure":        "멀티 AI 노출",
    "schema_seo":               "AI 인식 정보(Schema)",
    "online_mentions":          "온라인 언급",
    "google_presence":          "Google AI 노출",
}

# Track 1 (네이버) 가중치
_NAVER_WEIGHTS: dict[str, float] = {
    "keyword_gap_score":        0.35,
    "review_quality":           0.25,
    "smart_place_completeness": 0.15,
    "naver_exposure_confirmed": 0.15,
    "kakao_completeness":       0.10,
}

# Track 2 (글로벌) 가중치
_GLOBAL_WEIGHTS: dict[str, float] = {
    "multi_ai_exposure": 0.40,
    "schema_seo":        0.30,
    "online_mentions":   0.20,
    "google_presence":   0.10,
}


def _parse_dt(val: str | None) -> datetime | None:
    if not val:
        return None
    try:
        return datetime.fromisoformat(val.replace("Z", "+00:00"))
    except Exception:
        return None


def _find_score_around(
    history: list[dict],
    action_date: datetime,
    before: bool,
    window_days: int = 7,
) -> dict | None:
    """action_date 기준 before=True면 이전, False면 이후 가장 가까운 score_history 반환"""
    best = None
    best_delta = timedelta(days=window_days + 1)

    for row in history:
        dt = _parse_dt(row.get("score_date") or row.get("created_at"))
        if dt is None:
            continue
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)

        if before:
            diff = action_date - dt
            if timedelta(0) <= diff < best_delta:
                best_delta = diff
                best = row
        else:
            diff = dt - action_date
            if timedelta(0) < diff < best_delta:
                best_delta = diff
                best = row

    return best


def _compute_dimension_changes(
    bd_before: dict,
    bd_after: dict,
    naver_w: float,
    global_w: float,
) -> list[dict]:
    """breakdown 차이에서 기여도 큰 dimension 상위 3개 반환"""
    results = []

    for key, weight in _NAVER_WEIGHTS.items():
        b = float(bd_before.get(key) or 0)
        a = float(bd_after.get(key) or 0)
        d = a - b
        if abs(d) < 1.0:
            continue
        contribution = round(d * weight * naver_w, 2)
        results.append({
            "dimension": key,
            "label": _DIMENSION_LABELS_KO.get(key, key),
            "before": round(b, 1),
            "after": round(a, 1),
            "delta": round(d, 1),
            "weighted_contribution": contribution,
        })

    for key, weight in _GLOBAL_WEIGHTS.items():
        b = float(bd_before.get(key) or 0)
        a = float(bd_after.get(key) or 0)
        d = a - b
        if abs(d) < 1.0:
            continue
        contribution = round(d * weight * global_w, 2)
        results.append({
            "dimension": key,
            "label": _DIMENSION_LABELS_KO.get(key, key),
            "before": round(b, 1),
            "after": round(a, 1),
            "delta": round(d, 1),
            "weighted_contribution": contribution,
        })

    results.sort(key=lambda x: abs(x["weighted_contribution"]), reverse=True)
    return results[:3]


def _make_attribution_text(
    action_label: str,
    score_before: float,
    score_after: float,
    delta: float,
    dim_changes: list[dict],
) -> str:
    if delta > 0.5:
        main = dim_changes[0]["label"] if dim_changes else None
        base = f"'{action_label}' 후 점수가 {score_before:.1f}→{score_after:.1f}점(+{delta:.1f}점) 올랐습니다."
        return f"{base} {main} 향상이 주요 원인입니다." if main else base
    elif delta < -0.5:
        return (
            f"'{action_label}' 후 점수가 {score_before:.1f}→{score_after:.1f}점"
            f"({delta:.1f}점) 내려갔습니다. 경쟁사 변화 또는 측정 오차일 수 있습니다."
        )
    return (
        f"'{action_label}' 후 점수 변화({delta:+.1f}점)가 아직 미반영 상태입니다."
        " 재스캔을 실행하면 최신 효과를 확인할 수 있습니다."
    )


def compute_attributions(
    action_logs: list[dict],
    score_history: list[dict],
    naver_weight: float,
    global_weight: float,
) -> list[dict]:
    """
    action_logs + score_history → 행동별 귀인 계산 (AI 호출 없음)

    action_logs: business_action_log rows (action_date, action_type, action_label, score_before, score_after)
    score_history: score_history rows (score_date/created_at, unified_score, score_breakdown)
    """
    # score_history datetime 파싱 (반복 방지)
    _parsed_history = []
    for row in score_history:
        dt = _parse_dt(row.get("score_date") or row.get("created_at"))
        if dt and dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        _parsed_history.append({**row, "_dt": dt})

    results = []
    total_gain = 0.0
    period_scores = [
        float(r.get("unified_score") or 0)
        for r in _parsed_history if r.get("unified_score") is not None
    ]

    for log in action_logs:
        action_date_str = log.get("action_date") or log.get("created_at")
        action_dt = _parse_dt(action_date_str)
        if action_dt is None:
            continue
        if action_dt.tzinfo is None:
            action_dt = action_dt.replace(tzinfo=timezone.utc)

        # score_before: log에 있으면 사용, 없으면 history에서 조회
        score_before = log.get("score_before")
        if score_before is None:
            row_before = _find_score_around(_parsed_history, action_dt, before=True)
            score_before = float(row_before.get("unified_score") or 0) if row_before else None

        # score_after: log에 있으면 사용, 없으면 history에서 조회
        score_after = log.get("score_after")
        if score_after is None:
            row_after = _find_score_around(_parsed_history, action_dt, before=False)
            score_after = float(row_after.get("unified_score") or 0) if row_after else None

        if score_before is None or score_after is None:
            continue

        delta = round(score_after - score_before, 1)

        # breakdown 비교 (score_history에서 action_date 전후)
        bd_before: dict = {}
        bd_after: dict = {}
        row_b = _find_score_around(_parsed_history, action_dt, before=True)
        row_a = _find_score_around(_parsed_history, action_dt, before=False)
        if row_b:
            bd_before = row_b.get("score_breakdown") or {}
        if row_a:
            bd_after = row_a.get("score_breakdown") or {}

        dim_changes = _compute_dimension_changes(bd_before, bd_after, naver_weight, global_weight)

        action_label = log.get("action_label") or log.get("action_type") or "행동"
        attr_text = _make_attribution_text(action_label, score_before, score_after, delta, dim_changes)

        if delta > 0:
            total_gain += delta

        results.append({
            "action_date": action_date_str,
            "action_type": log.get("action_type", ""),
            "action_label": action_label,
            "score_before": round(score_before, 1),
            "score_after": round(score_after, 1),
            "delta": delta,
            "dimension_changes": dim_changes,
            "attribution_text": attr_text,
        })

    return {
        "attributions": results,
        "total_attributed_gain": round(total_gain, 1),
        "top_effective_action": (
            max(results, key=lambda x: x["delta"])["action_label"]
            if results else None
        ),
        "period_start_score": round(min(period_scores), 1) if period_scores else 0,
        "period_end_score": round(max(period_scores), 1) if period_scores else 0,
    }
