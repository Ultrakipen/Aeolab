import httpx
import os
import logging
from datetime import datetime

logger = logging.getLogger("aeolab")


async def send_slack_alert(title: str, message: str, level: str = "warning"):
    """크리티컬 오류 발생 시 슬랙 웹훅으로 즉시 알림"""
    webhook_url = os.getenv("SLACK_WEBHOOK_URL")
    if not webhook_url:
        logger.debug(f"Slack alert skipped (no webhook URL): [{level}] {title}")
        return

    # SLACK_WEBHOOK_URL이 실제로 설정돼 발신을 시도하는 경우만 기록 — 미설정 시엔
    # 위에서 이미 return했으므로 "slack 채널로 실제 시도한 알림"만 system_alerts에 남는다.
    from utils.system_alert_log import record_alert
    await record_alert(title, message, level=level, source="slack")

    color = {"error": "#FF0000", "warning": "#FFA500", "info": "#36A64F"}.get(level, "#808080")
    payload = {
        "attachments": [
            {
                "color": color,
                "title": f"[AEOlab] {title}",
                "text": message,
                "footer": "AEOlab Monitor",
                "ts": str(int(datetime.now().timestamp())),
            }
        ]
    }
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post(webhook_url, json=payload)
        if r.status_code >= 400:
            logger.error(f"Slack alert 발송 실패 {r.status_code}: {r.text[:200]}")
    except Exception as e:
        logger.error(f"Failed to send Slack alert: {e}")
