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
            await c.post(webhook_url, json=payload)
    except Exception as e:
        logger.error(f"Failed to send Slack alert: {e}")
