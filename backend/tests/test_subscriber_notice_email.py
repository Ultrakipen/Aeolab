"""구독자 안내 이메일 스크립트 (2026-11-02) — 기본이 드라이런이고, 자리표시자·수신자·중복·확인 수 안전장치가 작동하는지."""
import importlib.util
import os
from datetime import datetime, timedelta, timezone

import pytest

_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts", "subscriber_notice_email.py")
_spec = importlib.util.spec_from_file_location("subscriber_notice_email", _PATH)
mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mod)

FUTURE = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()
PAST = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()
VALUES = {"시작일": "11월 5일", "날짜": "11월 4일", "연장일": "12월 10일"}


def test_render_fills_every_placeholder_and_never_leaves_braces():
    for stage in (2, 3, 4):
        subject, text, page = mod.render(stage, VALUES)
        assert "{" not in text and "}" not in text and "{" not in subject
        assert "support@aeolab.co.kr" in text and "<br>" in page
    assert "11월 5일" in mod.render(2, VALUES)[1] and "12월 10일" in mod.render(4, VALUES)[1]


def test_render_refuses_empty_value_instead_of_sending_a_raw_placeholder():
    with pytest.raises(ValueError, match="시작일"):
        mod.render(2, {**VALUES, "시작일": "  "})
    with pytest.raises(ValueError, match="연장일"):
        mod.render(4, {**VALUES, "연장일": ""})
    with pytest.raises(ValueError):
        mod.render(1, VALUES)                                                   # 1단계는 공지사항이라 이메일 문안이 없다


def test_stage3_adds_refund_choice_and_stage2_does_not_promise_it():
    assert "환불" in mod.render(3, VALUES)[1]
    assert "환불" not in mod.render(2, VALUES)[1]


def test_values_are_html_escaped():
    _, _, page = mod.render(2, {**VALUES, "시작일": "<b>x</b>"})
    assert "<b>x</b>" not in page and "&lt;b&gt;x&lt;/b&gt;" in page


def test_text_does_not_guess_a_cause_or_promise_a_recovery_time():
    for stage in (2, 3):
        text = mod.render(stage, VALUES)[1]
        assert "차단" not in text and "곧" not in text and "내일 중" not in text
        assert "추정해서 말씀드리지 않겠습니다" in text


def test_recipients_are_entitled_subscribers_without_admins():
    rows = [
        {"user_id": "a", "status": "active", "end_at": None},
        {"user_id": "b", "status": "cancelled", "end_at": FUTURE},   # 해지했어도 만료일 전이면 서비스 유지
        {"user_id": "c", "status": "cancelled", "end_at": PAST},     # 만료
        {"user_id": "d", "status": "expired", "end_at": PAST},
        {"user_id": "adm", "status": "active", "end_at": None},
    ]
    assert mod.select_recipients(rows, admin_ids=["adm"]) == ["a", "b"]
    assert mod.select_recipients(rows, admin_ids=["adm"], include_admins=True) == ["a", "adm", "b"]


def test_pending_emails_skips_sent_duplicates_and_invalid():
    sent = {mod.email_hash("Done@x.com")}
    out = mod.pending_emails(["done@x.com", "a@x.com", "A@X.com", "", "nope", " b@x.com "], sent)
    assert out == ["a@x.com", "b@x.com"]


def test_mask_email_never_prints_full_address():
    assert mod.mask_email("hongkildong@naver.com") == "ho***@naver.com"
    assert mod.mask_email("bad") == "***"


def _patch(monkeypatch, tmp_path, emails):
    monkeypatch.setattr(mod, "_fetch_recipient_emails", lambda inc: (list(emails), len(emails)))
    monkeypatch.setattr(mod, "_log_path", lambda c: str(tmp_path / f"{c}.jsonl"))
    calls = []

    async def fake_send(to, subject, html):
        calls.append(to)
        return True

    import services.email_sender as es
    monkeypatch.setattr(es, "send_email", fake_send)
    return calls


ARGS = ["--stage", "2", "--campaign", "t1", "--start-date", "11월 5일", "--last-date", "11월 4일"]


def test_default_is_dry_run_and_sends_nothing(monkeypatch, tmp_path, capsys):
    calls = _patch(monkeypatch, tmp_path, ["a@x.com", "b@x.com"])
    assert mod.main(ARGS) == 0
    out = capsys.readouterr().out
    assert "드라이런" in out and "a***@x.com" in out and "a@x.com" not in out   # 주소는 마스킹
    assert calls == [] and not list(tmp_path.iterdir())                           # 발송도 기록도 없음


def test_dry_run_with_confirm_flag_still_sends_nothing(monkeypatch, tmp_path):
    calls = _patch(monkeypatch, tmp_path, ["a@x.com"])
    assert mod.main(ARGS + ["--confirm", "1"]) == 0                              # --send 없이는 확인 수를 줘도 발송하지 않는다
    assert calls == []


def test_missing_text_value_aborts_before_reading_recipients(monkeypatch, tmp_path):
    def boom(inc):
        raise AssertionError("수신자 조회까지 가면 안 된다")
    monkeypatch.setattr(mod, "_fetch_recipient_emails", boom)
    assert mod.main(["--stage", "2", "--campaign", "t1", "--start-date", "11월 5일"]) == 2


def test_send_requires_matching_confirm_count(monkeypatch, tmp_path):
    calls = _patch(monkeypatch, tmp_path, ["a@x.com", "b@x.com"])
    assert mod.main(ARGS + ["--send"]) == 2                                      # confirm 없음
    assert mod.main(ARGS + ["--send", "--confirm", "5"]) == 2                    # 수 불일치
    assert calls == []


def test_send_with_confirm_sends_records_and_second_run_skips_already_sent(monkeypatch, tmp_path):
    calls = _patch(monkeypatch, tmp_path, ["a@x.com", "b@x.com"])
    monkeypatch.setattr(mod.asyncio, "sleep", lambda s: _noop())
    assert mod.main(ARGS + ["--send", "--confirm", "2"]) == 0
    assert calls == ["a@x.com", "b@x.com"]
    assert mod.main(ARGS + ["--send", "--confirm", "0"]) == 0                    # 이미 보냈으니 대상 0 → 보내지 않음
    assert calls == ["a@x.com", "b@x.com"]
    log = (tmp_path / "t1.jsonl").read_text(encoding="utf-8")
    assert "a@x.com" not in log and "b@x.com" not in log                         # 기록에는 해시만


async def _noop():
    return None


def test_failed_send_is_reported_and_not_recorded(monkeypatch, tmp_path):
    _patch(monkeypatch, tmp_path, ["a@x.com"])
    import services.email_sender as es

    async def fail(to, s, h):
        return False
    monkeypatch.setattr(es, "send_email", fail)
    monkeypatch.setattr(mod.asyncio, "sleep", lambda s: _noop())
    assert mod.main(ARGS + ["--send", "--confirm", "1"]) == 1
    assert mod.load_sent_hashes("t1") == set()                                   # 실패는 보낸 것으로 기록하지 않아 다시 시도 가능


def test_only_option_sends_to_one_address_without_touching_campaign_log(monkeypatch, tmp_path):
    calls = _patch(monkeypatch, tmp_path, ["a@x.com", "b@x.com"])
    monkeypatch.setattr(mod.asyncio, "sleep", lambda s: _noop())
    assert mod.main(ARGS + ["--only", "me@x.com", "--send", "--confirm", "1"]) == 0
    assert calls == ["me@x.com"] and mod.load_sent_hashes("t1") == set()
