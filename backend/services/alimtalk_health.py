"""알림톡 발송 성공률 점검 판정 (2026-11-01).

2026-10-31 점검에서 알림톡이 전체 이력 성공 0건·실패 97건이었는데 아무도 몰랐다(발송 실패는 로그 경고뿐). 같은 일이 조용히 다시 생기지 않도록
최근 24시간 카카오 알림 기록의 성공·실패를 세어 이상이면 운영자에게 알린다. 건너뜀(skipped: 번호 없음·해지/만료 차단·템플릿 없음)은 실패가 아니므로 세지 않는다.
"""
from __future__ import annotations


def assess_delivery(sent: int, failed: int) -> str | None:
    """이상하면 사유 문장, 정상이면 None."""
    attempts = sent + failed
    if failed >= 3 and sent == 0:
        return f"최근 24시간 알림톡 {attempts}건 시도 중 성공 0건(전부 실패)"
    if attempts >= 6 and failed / attempts >= 0.5:
        return f"최근 24시간 알림톡 {attempts}건 시도 중 {failed}건 실패({round(failed / attempts * 100)}%)"
    return None
