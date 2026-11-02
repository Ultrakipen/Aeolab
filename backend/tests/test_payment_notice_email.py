"""정기결제 실패·정지 안내 이메일 (2026-11-02) — 문구가 실제 동작과 같은지, 어떤 실패도 예외로 새지 않는지, 실제 메일이 나가지 않는지."""
import asyncio

import pytest

from services import payment_notice_email as pne


def test_grace_notice_states_the_real_retry_rule_and_where_to_change_the_card():
    subject, paras = pne.build_notice("grace", "2026-11-05")
    text = " ".join(paras)
    assert "갱신 결제에 실패" in subject
    assert "2026-11-05까지 매일 새벽" in text and "마지막 시도(2026-11-05 새벽)" in text   # 갱신 잡: 유예 마지막 날 01:00 시도에서 실패하면 정지
    assert "서비스는 계속 이용" in text and "일시 정지" in text
    assert "설정에서 결제 수단을 변경" in text and "다음 시도 때 결제" in text            # 유예 중 카드 변경은 다음 매일 재시도에 반영된다(즉시 결제 아님)


def test_suspended_notice_says_changing_the_card_retries_immediately():
    subject, paras = pne.build_notice("suspended")
    text = " ".join(paras)
    assert "일시 정지" in subject and "바로 결제가 다시 시도" in text and "서비스가 재개" in text   # settings.update_card: 정지 상태 카드 변경 → 즉시 재결제


def test_notices_do_not_carry_personal_data_amounts_or_overpromises():
    for kind, gu in (("grace", "2026-11-05"), ("suspended", None)):
        subject, paras = pne.build_notice(kind, gu)
        text = subject + " ".join(paras)
        assert "@" not in text and "원" not in text.replace("원인", "")                 # 이메일·금액·플랜을 싣지 않는다
        assert "환불" not in text and "보장" not in text


def test_invalid_kind_or_missing_grace_date_is_rejected_not_sent_with_a_blank():
    with pytest.raises(ValueError):
        pne.build_notice("grace", None)
    with pytest.raises(ValueError):
        pne.build_notice("refund")


def test_html_uses_standard_layout_escapes_values_and_links_to_settings():
    subject, paras = pne.build_notice("grace", "2026-11-05")
    page = pne.render_html(subject, paras + ["<script>x</script>"])
    assert "max-width:560px" in page and "<h1" in page and "[AEOlab]" not in page.split("</h1>")[0]
    assert 'href="https://aeolab.co.kr/settings"' in page and 'href="mailto:support@aeolab.co.kr"' in page
    assert "<script>" not in page and "&lt;script&gt;" in page
    assert "발신 전용" in page


def _wire(monkeypatch, email="user@example.com", send_ok=True, lookup_error=None):
    sent = []

    async def lookup(uid):
        if lookup_error:
            raise lookup_error
        return email

    async def send(to, subject, html):
        sent.append((to, subject, html))
        return send_ok
    monkeypatch.setattr(pne, "_lookup_email", lookup)
    import services.email_sender as es
    monkeypatch.setattr(es, "send_email", send)
    return sent


def test_send_goes_to_the_users_email_once(monkeypatch):
    sent = _wire(monkeypatch)
    assert asyncio.run(pne.send_payment_notice_email("u1", "grace", "2026-11-05")) is True
    assert len(sent) == 1 and sent[0][0] == "user@example.com" and "결제에 실패" in sent[0][1]


def test_user_without_email_is_skipped_quietly(monkeypatch):
    sent = _wire(monkeypatch, email=None)
    assert asyncio.run(pne.send_payment_notice_email("u1", "suspended")) is False and sent == []


@pytest.mark.parametrize("kw", [dict(lookup_error=RuntimeError("auth down")), dict(send_ok=False)])
def test_failures_never_raise(monkeypatch, kw):
    _wire(monkeypatch, **kw)
    assert asyncio.run(pne.send_payment_notice_email("u1", "grace", "2026-11-05")) is False


def test_bad_arguments_never_raise(monkeypatch):
    sent = _wire(monkeypatch)
    assert asyncio.run(pne.send_payment_notice_email("u1", "grace", None)) is False and sent == []   # 날짜 없이 '빈칸 있는 안내'를 보내지 않는다
