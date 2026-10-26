"""AI 결제·크레딧 소진 감지 → 운영자 알림 (2026-10-26)."""
import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from services import billing_alert
from services.billing_alert import is_billing_error, note_billing_error

ANTHROPIC_MSG = (
    "Error code: 400 - {'type': 'error', 'error': {'type': 'invalid_request_error', 'message': "
    "'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.'}}"
)


@pytest.fixture(autouse=True)
def _reset_cooldown():
    billing_alert._last_sent.clear()
    yield
    billing_alert._last_sent.clear()


class TestDetection:
    def test_anthropic_credit_balance(self):
        assert is_billing_error("anthropic", Exception(ANTHROPIC_MSG)) is True

    @pytest.mark.parametrize("msg", ["Error code: 429 - insufficient_quota", "You exceeded your current quota, please check"])
    def test_openai_quota(self, msg):
        assert is_billing_error("openai", Exception(msg)) is True

    @pytest.mark.parametrize("provider,msg", [
        ("anthropic", "Error code: 429 rate limit"),
        ("anthropic", "Connection reset"),
        ("openai", "Request timed out"),
        ("unknown", ANTHROPIC_MSG),
    ])
    def test_other_errors_are_not_billing(self, provider, msg):
        assert is_billing_error(provider, Exception(msg)) is False


class TestNotify:
    def test_sends_once_within_cooldown(self):
        async def run():
            with patch("services.email_sender.send_operator_alert", new=AsyncMock(return_value=True)) as sender:
                first = note_billing_error("anthropic", Exception(ANTHROPIC_MSG))
                second = note_billing_error("anthropic", Exception(ANTHROPIC_MSG))
                await asyncio.sleep(0)  # 예약된 태스크 실행
                await asyncio.sleep(0)
                return first, second, sender.await_count
        first, second, calls = asyncio.run(run())
        assert (first, second, calls) == (True, False, 1)

    def test_providers_have_independent_cooldowns(self):
        async def run():
            with patch("services.email_sender.send_operator_alert", new=AsyncMock(return_value=True)) as sender:
                a = note_billing_error("anthropic", Exception(ANTHROPIC_MSG))
                b = note_billing_error("openai", Exception("insufficient_quota"))
                await asyncio.sleep(0)
                await asyncio.sleep(0)
                return a, b, sender.await_count
        assert asyncio.run(run()) == (True, True, 2)

    def test_never_raises_without_running_loop(self):
        # 이벤트 루프 밖에서 불려도 예외 없이 False
        assert note_billing_error("anthropic", Exception(ANTHROPIC_MSG)) is False

    def test_non_billing_error_does_not_send(self):
        async def run():
            with patch("services.email_sender.send_operator_alert", new=AsyncMock()) as sender:
                r = note_billing_error("anthropic", Exception("some other failure"))
                await asyncio.sleep(0)
                return r, sender.await_count
        assert asyncio.run(run()) == (False, 0)


class TestRetryWrapperKeepsBehavior:
    def test_billing_error_still_raised_and_noted(self):
        from services.anthropic_retry import create_message_with_retry

        class Boom(Exception):
            pass

        class FakeMessages:
            async def create(self, **kw):
                raise Boom(ANTHROPIC_MSG)

        class FakeClient:
            messages = FakeMessages()

        async def run():
            with patch("services.billing_alert.note_billing_error") as noted:
                with pytest.raises(Boom):
                    await create_message_with_retry(FakeClient(), model="x", max_tokens=1, messages=[])
                return noted.call_count
        assert asyncio.run(run()) == 1
