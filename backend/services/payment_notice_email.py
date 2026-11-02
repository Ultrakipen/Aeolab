"""정기결제 실패·정지 안내 이메일 (2026-11-02, 알림톡 병행).

알림톡(AEOLAB_PAYFAIL_01·SUSPEND_01)은 전화번호가 있고 도달할 때만 간다 — 10월 내내 성공 0건이었다가 10-31에 고쳐졌고 제3자 번호 도달은 미확인이다.
갱신 결제가 실패했다는 사실을 놓치면 유예 3일 뒤 조용히 정지되므로, 같은 안내를 이메일로도 보낸다(전화번호 없는 고객 포함).

보내는 시점은 두 번뿐이다(`subscription_lifecycle_job`): ① 갱신 결제 실패로 유예에 들어간 날 ② 유예가 끝나 정지된 날.
유예 중 매일 재시도가 실패해도 보내지 않는다. 첫 결제 실패·카드 변경 실패는 화면에서 바로 안내되므로 대상이 아니다.

문구는 실제 동작과 같아야 한다(코드 근거):
- 유예 중에도 서비스를 이용할 수 있고(`entitled_user_ids`가 grace_period 포함), 갱신 잡이 매일 01:00에 새로 저장된 카드로 재시도한다.
- 유예 마지막 날(grace_until) 01:00 시도에서 실패하면 정지된다(`grace_until <= 오늘`).
- 정지 상태에서 카드를 바꾸면 즉시 재결제해 성공하면 서비스가 재개된다(`settings.update_card`).
"""
import asyncio
import html
import logging

logger = logging.getLogger("aeolab")

SUPPORT_EMAIL = "support@aeolab.co.kr"
SETTINGS_URL = "https://aeolab.co.kr/settings"


def build_notice(kind: str, grace_until: str | None = None) -> tuple[str, list[str]]:
    """(제목, 문단 목록). kind는 'grace'(유예 진입) 또는 'suspended'(정지). 개인정보·금액·플랜은 담지 않는다."""
    if kind == "grace":
        if not grace_until:
            raise ValueError("grace 안내에는 유예 종료일이 필요하다")
        return (
            "[AEOlab] 구독 갱신 결제에 실패했습니다",
            [
                "안녕하세요, AEOlab입니다.",
                "구독 갱신 결제가 실패했습니다. 카드 한도·잔액이나 카드 유효기간을 확인해 주세요.",
                f"{grace_until}까지 매일 새벽 자동으로 다시 결제를 시도하며, 그동안 서비스는 계속 이용하실 수 있습니다. "
                f"마지막 시도({grace_until} 새벽)에도 결제되지 않으면 서비스가 일시 정지됩니다.",
                "카드를 바꾸시려면 설정에서 결제 수단을 변경해 주세요. 변경한 카드로 다음 시도 때 결제됩니다.",
            ],
        )
    if kind == "suspended":
        return (
            "[AEOlab] 구독이 일시 정지되었습니다",
            [
                "안녕하세요, AEOlab입니다.",
                "유예 기간 안에 갱신 결제가 확인되지 않아 서비스가 일시 정지되었습니다.",
                "설정에서 결제 수단을 변경하시면 바로 결제가 다시 시도되고, 결제가 되면 서비스가 재개됩니다.",
            ],
        )
    raise ValueError(f"지원하지 않는 안내 종류: {kind}")


def render_html(subject: str, paragraphs: list[str]) -> str:
    """다른 안내 메일과 같은 서식(폭 560px·맑은 고딕·문단 간격). 값은 이스케이프한다."""
    title = html.escape(subject.replace("[AEOlab] ", "", 1))
    body = "".join(
        f'<p style="margin:0 0 14px;font-size:15px;line-height:1.75;color:#1e293b;word-break:keep-all">{html.escape(p)}</p>'
        for p in paragraphs
    )
    link = (
        f'<p style="margin:18px 0 14px;font-size:15px"><a href="{SETTINGS_URL}" style="color:#1d4ed8;font-weight:600">결제 수단 변경하기 →</a></p>'
        f'<p style="margin:0 0 14px;font-size:15px;line-height:1.75;color:#1e293b">문의: '
        f'<a href="mailto:{SUPPORT_EMAIL}" style="color:#1d4ed8">{SUPPORT_EMAIL}</a></p>'
    )
    return (
        "<div style=\"font-family:'Apple SD Gothic Neo',Malgun Gothic,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1e293b\">"
        '<div style="font-size:13px;font-weight:700;color:#2563eb;letter-spacing:.02em;margin-bottom:6px">AEOlab</div>'
        f'<h1 style="margin:0 0 20px;font-size:20px;line-height:1.4;color:#0f172a;word-break:keep-all">{title}</h1>'
        + body + link
        + '<div style="margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12.5px;line-height:1.6;color:#64748b;word-break:keep-all">'
        "서비스 운영 안내 메일입니다. 이 주소(noreply)는 발신 전용이라 회신이 전달되지 않습니다.</div></div>"
    )


async def _lookup_email(user_id: str) -> str | None:
    from db.supabase_client import get_client

    sb = get_client()
    res = await asyncio.to_thread(sb.auth.admin.get_user_by_id, user_id)
    user = getattr(res, "user", res)
    return getattr(user, "email", None)


async def send_payment_notice_email(user_id: str, kind: str, grace_until: str | None = None) -> bool:
    """안내 메일 1통. 성공하면 True. 어떤 실패도 예외로 새지 않는다(결제 처리 흐름을 막으면 안 된다) — 로그만 남긴다."""
    try:
        subject, paragraphs = build_notice(kind, grace_until)
        email = await _lookup_email(user_id)
        if not email:
            logger.warning(f"[payment_notice_email] 이메일 없음 — 발송 건너뜀 (user={str(user_id)[:8]}, kind={kind})")
            return False
        from services.email_sender import send_email

        ok = await send_email(email, subject, render_html(subject, paragraphs))
        if not ok:
            logger.warning(f"[payment_notice_email] 발송 실패 (user={str(user_id)[:8]}, kind={kind})")
        return bool(ok)
    except Exception as e:
        logger.warning(f"[payment_notice_email] 예외 (user={str(user_id)[:8]}, kind={kind}): {e}")
        return False
