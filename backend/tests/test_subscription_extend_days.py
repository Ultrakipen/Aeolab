"""구독 연장 스크립트 (2026-11-02) — 메일 수신자와 같은 대상·상태별 처리·중복 적용 방지·낙관적 잠금·되돌리기·갱신 잡 시간대 차단."""
import importlib.util
import os
from datetime import date, datetime, timedelta

import pytest

_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts")


def _load(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(_DIR, name + ".py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


ext = _load("subscription_extend_days")
mail = _load("subscriber_notice_email")

TODAY = date(2026, 11, 2)
FUT = "2026-12-01"
PAST = "2026-10-01"


def row(i, uid, status, end_at=FUT, grace_until=None, disc=None):
    return {"id": i, "user_id": uid, "status": status, "end_at": end_at, "grace_until": grace_until, "first_month_discount_until": disc}


@pytest.fixture(autouse=True)
def _frozen_clock(monkeypatch):
    """'해지했지만 아직 이용 기간이 남은 구독' 판정(plan_gate._end_at_in_future)의 시계를 테스트 기준일(TODAY)로 고정한다.

    2026-11-06 발견된 시한폭탄: 이 파일의 날짜 리터럴(2026-11-05·11-20·12-01 …)은 실제 날짜가 지나면 의미가 바뀐다.
    plan_changes(today=TODAY)로 오늘만 고정하고 entitled_user_ids는 실제 시계(UTC)를 썼기 때문에, 한국 시간 09시(UTC 날짜가 바뀌는 때)
    이후 'cancelled end_at=2026-11-05' 행이 자격을 잃어 IndexError로 실패했다(01시대 전체 실행은 통과 → 시간대에 따라 결과가 달랐다).
    같은 원리로 11-20·12-01에도 터질 예정이었다. 날짜만 있는 end_at은 그 날 하루를 포함하는 실제 규칙(≥ 오늘)을 그대로 따른다.
    """
    import middleware.plan_gate as pg

    def _in_future(end_at):
        if not end_at:
            return False
        try:
            return date.fromisoformat(str(end_at)[:10]) >= TODAY
        except ValueError:
            return False

    monkeypatch.setattr(pg, "_end_at_in_future", _in_future)


def test_extension_days_match_the_promise_in_the_email():
    assert ext.EXTENSION_DAYS == mail.EXTENSION_DAYS == 3
    assert f"{ext.EXTENSION_DAYS}일 연장" in mail.render(2, {"시작일": "a", "날짜": "b", "연장일": "c"})[1]


def test_targets_are_exactly_the_email_recipients_without_admins():
    rows = [row(1, "a", "active"), row(2, "b", "cancelled", FUT), row(3, "c", "cancelled", PAST), row(4, "d", "grace_period", None, "2026-11-04"),
            row(5, "e", "expired", PAST), row(6, "adm", "active"), row(7, "f", "suspended", FUT)]
    changes, _ = ext.plan_changes(rows, admin_ids=["adm"], today=TODAY)
    email_ids = set(mail.select_recipients(rows, admin_ids=["adm"]))
    # 메일을 받는 사람 = 연장 대상 + 건너뜀(사유 표시). 메일은 받았는데 연장도 안 되고 설명도 없는 사람이 없어야 한다.
    _, skipped = ext.plan_changes(rows, admin_ids=["adm"], today=TODAY)
    assert {c["uid"] for c in changes} | {t for t, _ in skipped} == email_ids
    assert {c["uid"] for c in changes} == {"a", "b", "d"}


def test_active_extends_end_at_and_future_discount_date_together():
    ch, _ = ext.plan_changes([row(1, "a", "active", "2026-11-20", disc="2026-11-26")], today=TODAY)
    assert ch[0]["new"] == {"end_at": "2026-11-23", "first_month_discount_until": "2026-11-29"}
    assert ch[0]["old"] == {"end_at": "2026-11-20", "first_month_discount_until": "2026-11-26"}


def test_past_discount_date_and_cancelled_rows_do_not_touch_discount():
    ch, _ = ext.plan_changes([row(1, "a", "active", "2026-11-20", disc="2026-10-01"), row(2, "b", "cancelled", "2026-11-20", disc="2026-11-26")], today=TODAY)
    assert all(set(c["new"]) == {"end_at"} for c in ch)


def test_cancelled_before_expiry_extends_service_only():
    ch, _ = ext.plan_changes([row(1, "b", "cancelled", "2026-11-05")], today=TODAY)
    assert ch[0]["new"] == {"end_at": "2026-11-08"} and ch[0]["status"] == "cancelled"


def test_grace_period_extends_grace_until_not_end_at():
    ch, _ = ext.plan_changes([row(1, "d", "grace_period", PAST, "2026-11-04")], today=TODAY)
    assert ch[0]["new"] == {"grace_until": "2026-11-07"}                         # 유예 중 잡은 end_at이 아니라 grace_until을 본다


def test_rows_without_a_date_are_skipped_with_a_reason_not_silently():
    ch, sk = ext.plan_changes([row(1, "a", "active", None), row(2, "d", "grace_period", None, None)], today=TODAY)
    assert ch == [] and len(sk) == 2 and all("없음" in why for _, why in sk)


def test_timestamp_end_at_is_read_as_a_date():
    ch, _ = ext.plan_changes([row(1, "a", "active", "2026-11-20T00:00:00+00:00")], today=TODAY)
    assert ch[0]["new"]["end_at"] == "2026-11-23"


class FakeSB:
    """subscriptions 테이블 하나만 흉내 — update().eq()... .execute()가 조건에 맞는 행만 바꾸고 바뀐 행을 돌려준다."""

    def __init__(self, rows):
        self.rows = rows

    def table(self, name):
        assert name == "subscriptions"
        return _Q(self)


class _Q:
    def __init__(self, sb):
        self.sb, self.payload, self.filters = sb, None, []

    def update(self, payload):
        self.payload = payload
        return self

    def eq(self, k, v):
        self.filters.append((k, v))
        return self

    def execute(self):
        hit = [r for r in self.sb.rows if all(str(r.get(k)) == str(v) for k, v in self.filters)]
        for r in hit:
            r.update(self.payload)
        return type("R", (), {"data": [dict(r) for r in hit]})()


@pytest.fixture
def ledger(monkeypatch, tmp_path):
    monkeypatch.setattr(ext, "_log_path", lambda c: str(tmp_path / f"{c}.jsonl"))
    return tmp_path


def test_apply_updates_rows_records_old_and_new_and_skips_second_run(ledger):
    sb = FakeSB([row(1, "a", "active", "2026-11-20", disc="2026-11-26")])
    ch, _ = ext.plan_changes(sb.rows, today=TODAY)
    ok, failed = ext.apply_changes(sb, "c1", ch)
    assert (ok, failed) == (1, []) and sb.rows[0]["end_at"] == "2026-11-23" and sb.rows[0]["first_month_discount_until"] == "2026-11-29"
    assert ext.already_applied("c1") == {ext.uid_hash("a")}
    log = (ledger / "c1.jsonl").read_text(encoding="utf-8")
    assert "2026-11-20" in log and "2026-11-23" in log and '"a"' not in log      # 변경 전·후는 남기고 사용자 id 원문은 남기지 않는다


def test_optimistic_lock_skips_rows_changed_in_the_meantime(ledger):
    sb = FakeSB([row(1, "a", "active", "2026-11-20")])
    ch, _ = ext.plan_changes(sb.rows, today=TODAY)
    sb.rows[0]["end_at"] = "2026-12-20"                                           # 그 사이 갱신 잡이 end_at을 바꿨다
    ok, failed = ext.apply_changes(sb, "c2", ch)
    assert ok == 0 and failed == ["a"] and sb.rows[0]["end_at"] == "2026-12-20"   # 덮어쓰지 않는다
    assert ext.load_ledger("c2") == []                                            # 적용하지 않았으니 기록도 없다


def test_rollback_restores_only_untouched_values(ledger):
    sb = FakeSB([row(1, "a", "active", "2026-11-20"), row(2, "b", "active", "2026-11-25")])
    ch, _ = ext.plan_changes(sb.rows, today=TODAY)
    ext.apply_changes(sb, "c3", ch)
    sb.rows[1]["end_at"] = "2026-12-25"                                           # b는 그 뒤 갱신됨
    ok, failed = ext.rollback(sb, "c3")
    assert ok == 1 and len(failed) == 1
    assert sb.rows[0]["end_at"] == "2026-11-20" and sb.rows[1]["end_at"] == "2026-12-25"
    assert ext.already_applied("c3") == {ext.uid_hash("b")}                       # 되돌린 a는 다시 적용 가능, 못 되돌린 b는 적용 상태 유지


def test_job_window_blocks_apply_around_the_renewal_job():
    assert ext.in_job_window(datetime(2026, 11, 3, 1, 0)) and ext.in_job_window(datetime(2026, 11, 3, 0, 50)) and ext.in_job_window(datetime(2026, 11, 3, 1, 30))
    assert not ext.in_job_window(datetime(2026, 11, 3, 0, 49)) and not ext.in_job_window(datetime(2026, 11, 3, 1, 31)) and not ext.in_job_window(datetime(2026, 11, 3, 14, 0))


def _main(monkeypatch, rows, args, now=None):
    sb = FakeSB(rows)
    import db.supabase_client as dbc
    monkeypatch.setattr(dbc, "get_client", lambda: sb)
    monkeypatch.setattr(ext, "_fetch_rows", lambda s: sb.rows)
    monkeypatch.setattr(ext, "date", type("D", (date,), {"today": staticmethod(lambda: TODAY)}))
    if now is not None:
        monkeypatch.setattr(ext, "in_job_window", lambda n=None: now)
    return sb, ext.main(args)


def test_default_is_dry_run_and_changes_nothing(monkeypatch, ledger, capsys):
    sb, rc = _main(monkeypatch, [row(1, "a", "active", "2026-11-20")], ["--campaign", "d1"])
    assert rc == 0 and sb.rows[0]["end_at"] == "2026-11-20" and not list(ledger.iterdir())
    assert "드라이런" in capsys.readouterr().out


def test_apply_needs_matching_confirm_and_outside_job_window(monkeypatch, ledger):
    rows = lambda: [row(1, "a", "active", "2026-11-20")]
    sb, rc = _main(monkeypatch, rows(), ["--campaign", "d2", "--apply"], now=False)
    assert rc == 2 and sb.rows[0]["end_at"] == "2026-11-20"                       # confirm 없음
    sb, rc = _main(monkeypatch, rows(), ["--campaign", "d2", "--apply", "--confirm", "9"], now=False)
    assert rc == 2 and sb.rows[0]["end_at"] == "2026-11-20"                       # 수 불일치
    sb, rc = _main(monkeypatch, rows(), ["--campaign", "d2", "--apply", "--confirm", "1"], now=True)
    assert rc == 2 and sb.rows[0]["end_at"] == "2026-11-20"                       # 갱신 잡 시간대
    sb, rc = _main(monkeypatch, rows(), ["--campaign", "d2", "--apply", "--confirm", "1"], now=False)
    assert rc == 0 and sb.rows[0]["end_at"] == "2026-11-23"


def test_second_run_in_same_campaign_changes_nothing(monkeypatch, ledger):
    rows = [row(1, "a", "active", "2026-11-20")]
    sb, _ = _main(monkeypatch, rows, ["--campaign", "d3", "--apply", "--confirm", "1"], now=False)
    assert sb.rows[0]["end_at"] == "2026-11-23"
    sb, rc = _main(monkeypatch, sb.rows, ["--campaign", "d3", "--apply", "--confirm", "0"], now=False)
    assert rc == 0 and sb.rows[0]["end_at"] == "2026-11-23"                       # 두 번째 실행은 또 3일을 더하지 않는다
