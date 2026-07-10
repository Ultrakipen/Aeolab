"""운영 알림(operator alert · slack alert) 영구 저장 공용 헬퍼.

send_operator_alert(email_sender.py)·send_slack_alert(alert.py) 둘 다 지금까지
fire-and-forget였다 — 이메일/Slack으로 보내고 끝, DB에 남기지 않아 "지난주에
무슨 알림이 왔었지"를 조회할 방법이 없었다(admin_service_oversight_design_v1.0.md §3-A-F).

두 발신 함수 각각의 시작 지점에서 이 함수를 호출해 system_alerts에 남긴다.
같은 이벤트가 이메일+슬랙 양쪽으로 나가면 source가 다른 2행이 남는데, 이는
중복이 아니라 "어느 채널이 실제로 발신을 시도했는지"를 보여주는 유의미한 정보다.
"""

import logging

from db.supabase_client import get_client, execute

_logger = logging.getLogger("aeolab")


async def record_alert(subject: str, message: str, level: str = "warning", source: str = "unknown") -> None:
    """system_alerts에 알림 이력 기록. 실패해도 원래 알림 발송 흐름을 막지 않는다."""
    try:
        supabase = get_client()
        await execute(
            supabase.table("system_alerts").insert({
                "subject": subject,
                "message": message,
                "level": level,
                "source": source,
            })
        )
    except Exception as e:
        _logger.warning(f"[system_alert_log] 알림 이력 저장 실패 (원 알림 발송에는 영향 없음): {e}")
