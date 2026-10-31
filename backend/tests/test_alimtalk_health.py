"""알림톡 발송 성공률 점검 판정 (2026-11-01) — 성공 0건이 몰랐던 채 이어진 일(10-31)의 재발 방지."""
import asyncio
import re
from types import SimpleNamespace

from services.alimtalk_health import assess_delivery


def test_all_failed_is_flagged_but_tiny_samples_are_not():
    assert assess_delivery(sent=0, failed=3) is not None
    assert assess_delivery(sent=0, failed=2) is None          # 표본이 너무 작으면 알리지 않는다
    assert assess_delivery(sent=0, failed=0) is None          # 시도 자체가 없으면 정상(발송 대상이 없는 날)


def test_half_failed_with_enough_attempts_is_flagged():
    assert assess_delivery(sent=3, failed=3) is not None
    assert assess_delivery(sent=5, failed=2) is None
    assert assess_delivery(sent=2, failed=2) is None           # 시도 6건 미만


def test_job_registered_and_does_not_count_skipped(monkeypatch):
    src = open("scheduler/jobs.py", encoding="utf-8").read()
    assert re.search(r"alimtalk_delivery_check_job,\s*\"cron\",\s*hour=10", src)
    import scheduler.jobs as jobs
    import db.supabase_client as sc
    import services.email_sender as es

    sent_mails = []

    async def fake_alert(subject, message):
        sent_mails.append(subject)
        return True

    async def fake_all(build_query):
        # 건너뜀 20건은 세지 않는다 — 성공 0·실패 2(표본 부족)이므로 경고가 없어야 한다
        return SimpleNamespace(data=[{"status": "skipped"}] * 20 + [{"status": "failed"}] * 2)

    monkeypatch.setattr(sc, "get_client", lambda: None)
    monkeypatch.setattr(jobs, "_db_all", fake_all)
    monkeypatch.setattr(es, "send_operator_alert", fake_alert)
    asyncio.run(jobs.alimtalk_delivery_check_job())
    assert sent_mails == []
