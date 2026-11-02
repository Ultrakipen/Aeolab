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


async def comparable_to_previous_scan(supabase, business_id: str, naver_result) -> bool:
    """수동 스캔처럼 **오늘 스캔이 아직 scan_results에 저장되기 전에** 부르는 비교 가능 판정.

    오늘 스캔의 네이버가 측정됐고(naver_result) 직전 점수 스캔의 네이버도 측정됐을 때만 True.
    조회 실패는 False — 어떤 경우에도 예외를 올리지 않는다(스캔 응답을 막지 않기 위해).
    (야간 스캔은 저장 뒤에 최근 2건을 읽는 recent_naver_unmeasured_flags를 쓴다 — 저장 시점이 달라 판정 함수를 나눴다.)
    """
    try:
        from services.naver_batch_health import naver_failure_reason
        if naver_failure_reason(naver_result) is not None:
            return False
        flags = await recent_naver_unmeasured_flags(supabase, business_id)
        if flags is None:
            return False
        return comparable_scans(flags[:1])      # 아직 저장 전이라 가장 최근 1건이 '직전'이다
    except Exception as e:
        _logger.warning("[change_signal_guard] 수동 스캔 비교 가능 판정 실패(변화 표시 생략) biz=%s: %s", business_id, e)
        return False


async def window_comparison_unmeasured(
    supabase, business_id: str, since_iso: str, until_iso: Optional[str] = None,
) -> Optional[bool]:
    """기간 [since_iso, until_iso 또는 지금)의 점수 변화를 말하기 전에 — 비교의 양 끝 스캔 중 하나라도 네이버 측정이 빠졌는가. 조회 실패는 None.

    양 끝 = 기간 안에서 점수가 나온 첫 스캔과 마지막 스캔. 기간 안에 한 건뿐이면 기준이 되는 기간 이전의 가장 최근 스캔도 포함한다.
    기간 안에 점수 스캔이 없으면 False(판정할 스캔이 없다). 재방문 배너("그동안 점수가 내려갔어요/개선됐어요")처럼 큰 문구에 쓴다.
    until_iso는 지난달 리포트처럼 끝이 '지금'이 아닌 비교에 쓴다 — 이 값이 없으면 새 달의 스캔이 양 끝으로 잡혀 엉뚱한 스캔을 판정한다.
    조회는 모두 limit 1이다(서버 1,000행 상한 규칙과 무관하게 안전).
    """
    try:
        from db.supabase_client import execute
        from services.score_engine import naver_result_unmeasured

        def base():
            return (
                supabase.table("scan_results")
                .select("naver_result, scanned_at")
                .eq("business_id", business_id)
                .not_.is_("track1_score", "null")
            )

        def windowed():
            q = base().gte("scanned_at", since_iso)
            return q.lt("scanned_at", until_iso) if until_iso else q

        first = await execute(windowed().order("scanned_at", desc=False).limit(1))
        last = await execute(windowed().order("scanned_at", desc=True).limit(1))
        f = (first.data if first else None) or []
        l = (last.data if last else None) or []
        if not f or not l:
            return False
        ends = [f[0], l[0]]
        if f[0].get("scanned_at") == l[0].get("scanned_at"):
            before = await execute(base().lt("scanned_at", since_iso).order("scanned_at", desc=True).limit(1))
            ends += ((before.data if before else None) or [])[:1]
        return any(naver_result_unmeasured(r.get("naver_result")) for r in ends)
    except Exception as e:
        _logger.warning("[change_signal_guard] 기간 비교 가능 판정 실패(변화 표시 생략) biz=%s: %s", business_id, e)
        return None


async def unmeasured_on_dates(supabase, business_id: str, dates) -> Optional[bool]:
    """score_history의 점수 행 날짜(한국 날짜)에 해당하는 스캔 중 네이버 측정이 빠진 것이 있는가. 조회 실패는 None.

    점수 이력 행 두 개를 비교하는 문구(주간 다이제스트의 ▲/▼ 등)가 정확히 그 두 날짜의 스캔을 판정하게 한다.
    하루에 스캔이 여러 번이면 하나라도 빠졌을 때 True(보수적). 조회는 날짜마다 limit 10이다(리터럴; 서버 1,000행 상한 규칙과 무관).
    """
    try:
        from datetime import date as _d, timedelta as _td
        from db.supabase_client import execute
        from services.score_engine import naver_result_unmeasured

        for ds in dates:
            day = _d.fromisoformat(str(ds)[:10])
            start = f"{day.isoformat()}T00:00:00+09:00"          # scanned_at은 UTC 저장 — 야간 02:00 KST 스캔이 전날 UTC로 들어가므로 KST 하루로 자른다
            end = f"{(day + _td(days=1)).isoformat()}T00:00:00+09:00"
            res = await execute(
                supabase.table("scan_results")
                .select("naver_result")
                .eq("business_id", business_id)
                .not_.is_("track1_score", "null")
                .gte("scanned_at", start)
                .lt("scanned_at", end)
                .limit(10)
            )
            rows = (res.data if res else None)
            if rows is None:
                return None
            if any(naver_result_unmeasured(r.get("naver_result")) for r in rows):
                return True
        return False
    except Exception as e:
        _logger.warning("[change_signal_guard] 날짜별 비교 가능 판정 실패(변화 표시 생략) biz=%s: %s", business_id, e)
        return None


_SCORE_ROW_COLUMNS = (
    "unified_score, total_score, "
    "nr_error:naver_result->>error, nr_captcha:naver_result->>captcha_detected, nr_quota:naver_result->>quota_skipped"
)


def score_of_row_if_measured(row) -> Optional[float]:
    """위 _SCORE_ROW_COLUMNS로 읽은 스캔 행의 점수. 그 스캔의 네이버 측정이 빠졌으면 None(전후 비교의 끝점으로 쓰지 않는다).

    unified_score가 없는 과거 행은 같은 값의 별칭인 total_score를 쓴다. 점수 자체가 없으면 None.
    """
    from services.score_engine import naver_unmeasured_from_json_fields
    if not isinstance(row, dict):
        return None
    if naver_unmeasured_from_json_fields(row.get("nr_error"), row.get("nr_captcha"), row.get("nr_quota")):
        return None
    val = row.get("unified_score")
    if val is None:
        val = row.get("total_score")
    try:
        return float(val) if val is not None else None
    except (TypeError, ValueError):
        return None


async def latest_measured_score(supabase, business_id: str) -> Optional[float]:
    """가장 최근 점수 스캔의 점수 — 그 스캔의 네이버 측정이 빠졌거나 조회에 실패하면 None.

    '행동 전/후', '대행 전/후' 점수를 저장할 때 쓴다. 측정 빠진 스캔의 점수는 항목이 제외·재정규화돼 다른 스캔과 척도가 달라(같은 가게 시험
    64.5 ↔ 54.6) 그 값을 끝점으로 저장하면 처방·대행의 효과가 거짓으로 보인다. None으로 두면 화면은 증감을 표시하지 않는다.
    일부러 '그 전의 정상 스캔'으로 거슬러 올라가지 않는다 — 오래된 점수를 '지금'의 전/후 끝점으로 쓰면 그것도 거짓이다.
    """
    try:
        from db.supabase_client import execute
        res = await execute(
            supabase.table("scan_results")
            .select(_SCORE_ROW_COLUMNS)
            .eq("business_id", business_id)
            .not_.is_("track1_score", "null")
            .order("scanned_at", desc=True)
            .limit(1)
        )
        rows = (res.data if res else None) or []
        return score_of_row_if_measured(rows[0]) if rows else None
    except Exception as e:
        _logger.warning("[change_signal_guard] 최근 점수 조회 실패(전/후 점수 비워 둠) biz=%s: %s", business_id, e)
        return None


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
