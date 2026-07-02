"""프록시 대역폭 자체 추적 — Webshare API 키 없이 근사치로 소진 위험 조기 경보.

2026-07-02 프록시 대역폭 소진(402 Payment Required) 사고 재발 방지용.
Playwright 응답 바이트를 스캐너 쪽에서 합산해 system_status 테이블에 월 단위로 누적하고,
PROXY_MONTHLY_BUDGET_MB의 80% 도달 시 관리자 이메일 1회 발송한다.

한계: 프록시가 실제로 통과시킨 바이트(TLS 오버헤드 등 포함)와 Playwright가 관측한
응답 바디 바이트는 정확히 일치하지 않는다 — 근사치이며, 실제 계정 잔여 대역폭은
Webshare 대시보드가 정답이다. 이 트래커는 "위험 조기 감지"용이지 정산용이 아니다.
"""
import logging
import os
from datetime import datetime, timezone

_logger = logging.getLogger("aeolab")

_KEY = "proxy_bandwidth_used_mb"


def _current_period() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


async def record_usage_mb(mb: float) -> None:
    """이번 스캔에서 사용한 대역폭(MB)을 이번 달 누적치에 더하고, 80% 도달 시 알림."""
    if mb <= 0:
        return
    try:
        from db.supabase_client import get_client
        supabase = get_client()
        res = supabase.table("system_status").select("value, message, description").eq("key", _KEY).execute()
        row = (res.data or [{}])[0] if (res and res.data) else {}

        period = _current_period()
        stored_period = row.get("message") or ""
        already_alerted = (row.get("description") or "") == f"alerted_80_{period}"

        prev_mb = float(row.get("value") or 0) if stored_period == period else 0.0
        new_mb = prev_mb + mb

        budget_mb = float(os.getenv("PROXY_MONTHLY_BUDGET_MB", "3072"))  # 기본 3GB
        crossed_80 = (not already_alerted) and budget_mb > 0 and new_mb >= budget_mb * 0.8

        supabase.table("system_status").upsert({
            "key": _KEY,
            "value": f"{new_mb:.1f}",
            "message": period,
            "description": f"alerted_80_{period}" if (crossed_80 or already_alerted) else "",
            "updated_by": "bandwidth_tracker",
        }).execute()

        if crossed_80:
            _logger.warning(
                "[bandwidth_tracker] 프록시 대역폭 80%% 도달 — %.1fMB / %.1fMB (%s)",
                new_mb, budget_mb, period,
            )
            await _alert_admin(new_mb, budget_mb, period)
    except Exception as e:
        _logger.debug(f"[bandwidth_tracker] 기록 실패 (무시): {e}")


async def _alert_admin(used_mb: float, budget_mb: float, period: str) -> None:
    resend_key = os.getenv("RESEND_API_KEY", "")
    from_email = os.getenv("FROM_EMAIL", "noreply@aeolab.co.kr")
    admin_emails = [e.strip() for e in os.getenv("ADMIN_EMAILS", "contact@aeolab.co.kr").split(",") if e.strip()]

    from utils.alert import send_slack_alert
    await send_slack_alert(
        "프록시 대역폭 80% 도달",
        f"{period} 누적 {used_mb:.0f}MB / {budget_mb:.0f}MB — 소진 시 네이버 스캔 전면 중단됩니다. Webshare 대시보드에서 충전 필요.",
        level="warning",
    )

    if not resend_key or not admin_emails:
        return
    try:
        import resend as _resend
        _resend.api_key = resend_key
        _resend.Emails.send({
            "from": f"AEOlab <{from_email}>",
            "to": admin_emails,
            "subject": f"[AEOlab] 프록시 대역폭 80% 도달 — {period}",
            "html": (
                f"<p>이번 달({period}) 프록시(Webshare) 사용량이 예산의 80%를 넘었습니다.</p>"
                f"<p><b>누적:</b> {used_mb:.0f}MB / {budget_mb:.0f}MB</p>"
                f"<p>소진되면 네이버 AI브리핑·AI탭 스캔이 전면 중단됩니다(402 오류).</p>"
                f"<p>Webshare 대시보드에서 잔여 대역폭 확인 후 충전해주세요.</p>"
            ),
        })
        _logger.info("[bandwidth_tracker] 관리자 이메일 발송 완료 — %s", period)
    except Exception as e:
        _logger.warning(f"[bandwidth_tracker] 관리자 이메일 발송 실패: {e}")
