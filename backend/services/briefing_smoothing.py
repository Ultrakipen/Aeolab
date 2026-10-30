"""네이버 AI 브리핑 노출 점수의 최근 스캔 평활화 (2026-10-30).

문제: `ai_briefing_score`(Track1, ACTIVE 25%·LIKELY 15%)는 스캔 1회의 브리핑·AI탭 노출 여부(참/거짓) 한 번으로 정해진다.
네이버 AI 노출 자체가 날마다 깜빡이기 때문에(실측: 힐링하우스 10-22~10-29 브리핑 점수가 0→0→0→60→100→0→60) Track1 점수와 성장 단계가
하루 단위로 크게 흔들렸다(같은 기간 21.9→48.6→62.4→41.0→55.1, 전체 점수 이력의 18%가 단계 경계를 넘나듦).

방법: 이번 스캔 점수와 **직전 측정 성공 스캔 최대 2건**(14일 이내)의 점수를 평균한다 — 표본 1개를 3개로 늘리는 것과 같다.
- 이전 스캔이 없거나 실패(캡차·오류)·14일 초과면 이번 값 그대로(기존 동작과 동일).
- 이번 스캔이 측정 실패면 이 항목은 기존대로 제외되므로 평활화하지 않는다.
- 시뮬레이션·리포트 재계산처럼 이전 스캔 정보(`_prior_naver`)를 넘기지 않는 호출은 영향이 없다.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

_logger = logging.getLogger("aeolab")

PRIOR_N = 2
WINDOW_DAYS = 14


def smooth(current: float, prior_scores: list[float]) -> tuple[float, int]:
    """(평균 점수, 사용한 스캔 수). 이전 값이 없으면 (current, 1)."""
    vals = [float(current)] + [float(v) for v in prior_scores]
    return (sum(vals) / len(vals), len(vals))


async def attach_prior_naver(scan_result: dict, business_id: str | None) -> None:
    """scan_result["_prior_naver"]에 최근 측정 성공 스캔(최대 PRIOR_N건)의 네이버 결과를 붙인다. 실패해도 점수 계산은 계속된다."""
    if not business_id or not isinstance(scan_result, dict):
        return
    try:
        from db.supabase_client import get_client, execute
        from services.score_engine import _is_naver_unmeasured
        res = await execute(
            get_client().table("scan_results")
            .select("scanned_at, naver_result, naver_ai_tab_visible")
            .eq("business_id", business_id)
            .not_.is_("naver_result", "null")
            .order("scanned_at", desc=True)
            .limit(8)
        )
        cutoff = datetime.now(timezone.utc) - timedelta(days=WINDOW_DAYS)
        priors: list[dict] = []
        for r in (res.data if res else None) or []:
            nr = r.get("naver_result")
            if not isinstance(nr, dict) or not nr:
                continue
            try:
                when = datetime.fromisoformat(str(r.get("scanned_at")).replace("Z", "+00:00"))
                if when.tzinfo is None:
                    when = when.replace(tzinfo=timezone.utc)
            except (ValueError, TypeError):
                continue
            if when < cutoff:
                break   # 최신순이라 이후는 모두 더 오래됨
            if _is_naver_unmeasured({"naver_result": nr}):
                continue   # 측정 실패 스캔은 표본이 아니다
            priors.append({"naver_result": nr, "naver_ai_tab_visible": r.get("naver_ai_tab_visible")})
            if len(priors) >= PRIOR_N:
                break
        if priors:
            scan_result["_prior_naver"] = priors
    except Exception as e:  # noqa: BLE001 — 평활화 실패가 점수 계산을 막으면 안 된다
        _logger.warning("[briefing_smoothing] 이전 스캔 조회 실패(평활화 없이 진행) biz=%s: %s", business_id, e)
