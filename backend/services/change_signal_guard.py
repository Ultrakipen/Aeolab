"""네이버 측정이 빠진 스캔의 점수를 '변화'로 기록·알리지 않기 위한 비교 가능 판정 (2026-11-02, 차단 모의 훈련 T-5에서 발견).

문제: 네이버 측정이 실패한 밤(차단·캡차·일일 상한·화면 변경)의 점수는 해당 항목을 0점이 아니라 제외하고 재정규화한다(올바른 처리).
그러나 그 점수는 측정에 성공한 밤의 점수와 같은 척도가 아니다 — 같은 가게를 채점한 시험에서 측정 성공 64.5 ↔ 쿨다운 54.6(−9.9점).
이 값을 직전 점수와 단순 비교하면 '하락/개선' 기록, 점수 변화 알림, 스캔 완료 알림의 등급 변화 메모, 성장 단계 상승 알림이 가짜로 나가고,
차단이 풀린 다음 날에는 반대 방향의 가짜 변화가 또 나간다(평활화·coverage 가드는 이 경우를 막지 못했다: 이번 스캔이 측정 실패면 평활화하지 않고,
네이버 2항목이 빠져도 coverage가 0.5라 40% 기준을 통과한다).

규칙: 비교하는 두 스캔(오늘·직전, 또는 점수 이력의 최근 두 행에 해당하는 최근 두 스캔)이 모두 네이버 측정에 성공했을 때만 '변화'로 다룬다.
확인하지 못하면(조회 실패) 변화로 알리지 않는다 — 잘못된 알림이 빠진 알림보다 신뢰를 더 깎는다(성장 단계 알림의 기존 원칙과 같다).
저장하는 점수 자체는 바꾸지 않는다(정직한 재정규화 값 그대로, 화면은 isNaverUnmeasured로 이미 보류 표시).
"""
import logging
from typing import Optional

_logger = logging.getLogger("aeolab")


def comparable_scans(flags) -> bool:
    """flags: 최근 스캔들의 '네이버 측정 못 함' 여부 목록. None(조회 실패)이거나 하나라도 True면 비교할 수 없다."""
    if flags is None:
        return False
    return not any(flags)


async def recent_naver_unmeasured_flags(supabase, business_id: str) -> Optional[list]:
    """점수가 나온 최근 스캔 2건(최신순: 오늘/직전)의 네이버 '측정 못 함' 여부. 조회에 실패하면 None.

    limit는 서버 1,000행 상한 규칙(변수 limit 금지, tests/test_db_paging_and_alerts)에 따라 리터럴 2다 — 비교 대상은 항상 두 스캔뿐이다.

    순위만 기록한 행(track1_score 없음, naver_result 비어 있음)은 세지 않는다 — 세면 실제 스캔 대신 그 행이 비교 대상 자리를 차지한다.
    """
    try:
        from db.supabase_client import execute
        from services.score_engine import naver_result_unmeasured
        res = await execute(
            supabase.table("scan_results")
            .select("naver_result, scanned_at")
            .eq("business_id", business_id)
            .not_.is_("track1_score", "null")
            .order("scanned_at", desc=True)
            .limit(2)
        )
        rows = (res.data if res else None)
        if rows is None:
            return None
        return [naver_result_unmeasured(r.get("naver_result")) for r in rows]
    except Exception as e:
        _logger.warning("[change_signal_guard] 최근 스캔 조회 실패(변화 알림 생략) biz=%s: %s", business_id, e)
        return None
