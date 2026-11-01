"""네이버 접속 정기 잡의 '대량 동시 실패' 판정과 운영자 알림 (2026-11-01, 작업 T-3 / 문서 W-1).

왜 필요한가
- 차단 회로(naver_access_guard)의 운영자 메일은 '차단 화면으로 인식된 경우'에만 나간다. 화면 구조 변경, 인식하지 못한 차단 모양,
  공식 API 변경처럼 '인식되지 않는 실패'는 사업장마다 조용히 '확인 전'으로 처리돼(사용자에게는 안전하지만) 운영자는 모른다.
- 개별 실패가 아니라 '한 번의 잡 실행에서 여러 곳이 같이 실패'한 사건으로 묶어 알린다. 키워드 순위 잡(jobs._run_keyword_rank_for_plans)에는
  이미 같은 방식의 알림이 있었고, 야간 스캔·경쟁사 크롤·내 가게 통계 잡에는 없었다.

판정 규칙 (임계값은 제안값 — 실제 기준선은 구독자가 늘어난 뒤 로그로 보정, 환경변수로 조정)
- 실패 건수 ≥ NAVER_BATCH_FAIL_ALERT_MIN(기본 2) 이고 실패율 ≥ NAVER_BATCH_FAIL_ALERT_RATIO(기본 0.5) 일 때만 알린다.
- 실패가 한 곳뿐이면 알리지 않는다(일시 오류와 구분이 안 된다). 따라서 대상이 1곳뿐인 날은 이 알림이 울리지 않는다 —
  그 경우는 일일 점검 루틴(문서 §4.4)으로 본다.
- 차단 회로가 이미 열려 있어도 알림을 억누르지 않고 메시지에 상태를 적는다(회로가 열린 채 다른 원인이 겹쳐도 놓치지 않기 위해).
이 모듈은 네이버에 접속하지 않는다(DB·네트워크 호출 없음, 메일 발송만).
"""
import logging
import os
from typing import Optional

_logger = logging.getLogger("aeolab")

_DEFAULT_RATIO = 0.5
_DEFAULT_MIN_FAILED = 2


def _ratio() -> float:
    try:
        v = float(os.getenv("NAVER_BATCH_FAIL_ALERT_RATIO", str(_DEFAULT_RATIO)))
    except ValueError:
        return _DEFAULT_RATIO
    return v if 0 < v <= 1 else _DEFAULT_RATIO


def _min_failed() -> int:
    try:
        v = int(os.getenv("NAVER_BATCH_FAIL_ALERT_MIN", str(_DEFAULT_MIN_FAILED)))
    except ValueError:
        return _DEFAULT_MIN_FAILED
    return v if v >= 1 else _DEFAULT_MIN_FAILED


def naver_failure_reason(naver_result) -> Optional[str]:
    """스캔 결과의 naver 항목이 '측정되지 못했다'면 사유 문자열, 측정됐으면 None.

    '측정되지 못함'의 정의는 score_engine.naver_result_unmeasured(캡차·error·일일 상한 건너뜀)를 그대로 쓴다 —
    화면·점수가 '확인 전'으로 보는 기준과 알림 기준이 어긋나지 않게 하기 위해서다.
    """
    from services.score_engine import naver_result_unmeasured
    if not naver_result_unmeasured(naver_result):
        return None
    if naver_result.get("captcha_detected"):
        return "captcha"
    err = naver_result.get("error")
    if err:
        return str(err)[:60]
    return "quota_skipped"


def tally_scan_result(naver_result, reasons: dict) -> bool:
    """스캔 1건의 네이버 결과를 집계한다. 측정됐으면 True, 못 했으면 사유를 reasons에 더하고 False."""
    why = naver_failure_reason(naver_result)
    if why is None:
        return True
    count_reason(reasons, why)
    return False


def count_reason(reasons: dict, reason) -> None:
    """실패 사유 집계(키는 40자까지 — 예외 문구가 길어 키가 흩어지지 않게)."""
    key = (str(reason) if reason else "unknown")[:40]
    reasons[key] = reasons.get(key, 0) + 1


def evaluate_mass_failure(
    job: str, ok: int, failed: int, reasons: Optional[dict] = None, breaker_note: str = "",
) -> Optional[tuple[str, str]]:
    """대량 실패면 (제목, 본문), 아니면 None. 순수 함수."""
    ok, failed = max(int(ok or 0), 0), max(int(failed or 0), 0)
    total = ok + failed
    if total <= 0 or failed < _min_failed() or failed / total < _ratio():
        return None
    pct = round(failed / total * 100)
    breakdown = ""
    if reasons:
        items = sorted(reasons.items(), key=lambda kv: (-kv[1], kv[0]))[:6]
        breakdown = " 실패 사유: " + ", ".join(f"{k} {v}건" for k, v in items) + "."
    subject = f"네이버 측정 다수 실패 — {job}"
    message = (
        f"{job}에서 {total}곳 중 {failed}곳({pct}%)이 네이버 측정에 실패했습니다.{breakdown}"
        + (f" 접속 회로 상태: {breaker_note}." if breaker_note else "")
        + " 사용자 화면에는 0점·미노출이 아니라 '확인 전/측정 실패'로 표시되고 점수에는 반영되지 않습니다."
        " 여러 사업장이 한꺼번에 실패했다면 차단(인식되지 않은 모양 포함), 네이버 화면 구조 변경, 공식 API 변경, 일일 상한 도달 중 하나일 수 있습니다."
        " 서버에서 네이버 점검 함수를 연속 호출하지 말고(IP 차단 사고 2026-10-27), 로컬 PC에서 Playwright로 같은 검색을 1페이지만 열어 화면을 확인하세요."
        " (판정 규칙: 2곳 이상 실패이고 실패율 50% 이상 — 제안값)"
    )
    return subject, message


def _breaker_note() -> str:
    """플레이스·검색 화면 회로가 열려 있는지 한 줄로 — 실패 원인이 이미 알려진 차단인지 구분하는 단서."""
    try:
        from services.naver_access_guard import search_snapshot, snapshot
        parts = []
        for label, snap in (("플레이스", snapshot()), ("검색", search_snapshot())):
            rem = int(snap.get("remaining_sec") or 0)
            parts.append(f"{label} {'열림(남은 ' + str(rem // 60) + '분)' if rem > 0 else '정상'}")
        return " / ".join(parts)
    except Exception as e:
        _logger.debug("[naver_batch_health] 회로 상태 조회 실패: %s", e)
        return ""


async def alert_if_mass_failure(
    job: str, ok: int, failed: int, reasons: Optional[dict] = None,
) -> bool:
    """대량 실패면 운영자 메일을 보낸다. 어떤 경우에도 예외를 올리지 않는다(잡 본체를 깨뜨리지 않기 위해). 알렸으면 True."""
    try:
        verdict = evaluate_mass_failure(job, ok, failed, reasons, _breaker_note())
        if verdict is None:
            return False
        from services.email_sender import send_operator_alert
        await send_operator_alert(*verdict)
        _logger.warning("[naver_batch_health] 대량 실패 알림 발송: %s ok=%s failed=%s reasons=%s", job, ok, failed, reasons)
        return True
    except Exception as e:
        _logger.warning("[naver_batch_health] 대량 실패 알림 실패(무시) job=%s: %s", job, e)
        return False
