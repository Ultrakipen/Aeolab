"""네이버 접속 정기 잡의 대량 동시 실패 알림 검증 (2026-11-01, 작업 T-3 / 문서 W-1).

핵심: ①한 곳의 일시 실패로는 울리지 않는다 ②여러 곳이 같이 실패하면 사유와 함께 한 번 울린다 ③'측정 못 함'의 기준은 화면·점수가 쓰는
score_engine.naver_result_unmeasured와 같다 ④알림 실패가 잡을 깨뜨리지 않는다 ⑤실제 잡이 이 알림을 호출한다.
"""
import asyncio
import os
import sys
from datetime import date

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import naver_batch_health as nbh  # noqa: E402
from services.score_engine import naver_result_unmeasured  # noqa: E402


# ── 판정 규칙 ────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("ok,failed,expect_alert", [
    (0, 0, False),      # 대상 없음
    (0, 1, False),      # 한 곳뿐 — 일시 오류와 구분 불가
    (2, 1, False),      # 한 곳 실패
    (1, 2, True),       # 3곳 중 2곳(67%)
    (2, 2, True),       # 50% 경계 포함
    (3, 2, False),      # 40%
    (0, 2, True),       # 전부 실패
    (10, 5, False),     # 33%
    (4, 6, True),
])
def test_threshold(ok, failed, expect_alert):
    assert (nbh.evaluate_mass_failure("잡", ok, failed) is not None) is expect_alert


def test_message_contains_job_counts_reasons_and_guidance():
    subject, msg = nbh.evaluate_mass_failure(
        "야간 스캔", 1, 3, {"page_load_failed": 2, "captcha": 1}, "플레이스 정상 / 검색 열림(남은 30분)")
    assert "야간 스캔" in subject
    assert "4곳 중 3곳(75%)" in msg
    assert "page_load_failed 2건" in msg and "captcha 1건" in msg
    assert msg.index("page_load_failed") < msg.index("captcha")      # 많은 사유가 먼저
    assert "검색 열림(남은 30분)" in msg
    assert "서버에서 네이버 점검 함수를 연속 호출하지 말고" in msg       # 지침 8번: 확인은 로컬 1페이지
    assert "0점·미노출이 아니라" in msg


def test_env_thresholds(monkeypatch):
    monkeypatch.setenv("NAVER_BATCH_FAIL_ALERT_MIN", "3")
    assert nbh.evaluate_mass_failure("잡", 0, 2) is None
    assert nbh.evaluate_mass_failure("잡", 0, 3) is not None
    monkeypatch.setenv("NAVER_BATCH_FAIL_ALERT_RATIO", "0.9")
    assert nbh.evaluate_mass_failure("잡", 1, 5) is None
    # 잘못된 값은 기본값으로
    monkeypatch.setenv("NAVER_BATCH_FAIL_ALERT_RATIO", "abc")
    monkeypatch.setenv("NAVER_BATCH_FAIL_ALERT_MIN", "0")
    assert nbh.evaluate_mass_failure("잡", 1, 2) is not None
    assert nbh.evaluate_mass_failure("잡", 0, 1) is None


# ── 스캔 결과 분류: 화면·점수의 '측정 못 함' 기준과 같다 ──────────────────────────
_CASES = [
    ({"captcha_detected": True}, "captcha"),
    ({"error": "page_load_failed"}, "page_load_failed"),
    ({"error": "briefing_unrecognized"}, "briefing_unrecognized"),
    ({"error": "naver_search_cooldown", "quota_skipped": True}, "naver_search_cooldown"),   # error가 quota_skipped보다 구체적
    ({"quota_skipped": True}, "quota_skipped"),
    ({"captcha_detected": True, "error": "x"}, "captcha"),
    ({"mentioned": False, "in_briefing": False}, None),           # 측정했고 노출이 없다 = 정상 측정
    ({"mentioned": True, "rank": 2}, None),
    ({}, None),
    (None, None),
    ("garbage", None),
]


@pytest.mark.parametrize("res,reason", _CASES)
def test_failure_reason(res, reason):
    assert nbh.naver_failure_reason(res) == reason


@pytest.mark.parametrize("res,_", _CASES)
def test_reason_agrees_with_score_engine_definition(res, _):
    """알림이 '실패'라고 세는 것 = 화면·점수가 '측정 못 함'으로 보는 것 (두 정의가 어긋나면 안 된다)."""
    assert (nbh.naver_failure_reason(res) is not None) == naver_result_unmeasured(res)


def test_tally_scan_result():
    reasons: dict = {}
    assert nbh.tally_scan_result({"mentioned": False}, reasons) is True and reasons == {}
    assert nbh.tally_scan_result({"error": "page_load_failed"}, reasons) is False
    assert nbh.tally_scan_result({"error": "page_load_failed"}, reasons) is False
    assert nbh.tally_scan_result({"captcha_detected": True}, reasons) is False
    assert reasons == {"page_load_failed": 2, "captcha": 1}


def test_count_reason_truncates_and_defaults():
    r: dict = {}
    nbh.count_reason(r, "x" * 100)
    nbh.count_reason(r, None)
    assert list(r) == ["x" * 40, "unknown"]


# ── 발송 ─────────────────────────────────────────────────────────────────────
def _capture(monkeypatch):
    import services.email_sender as es
    sent = []

    async def fake_alert(subject, message):
        sent.append((subject, message))
        return True

    monkeypatch.setattr(es, "send_operator_alert", fake_alert)
    return sent


def test_alert_sent_once_for_mass_failure_and_not_for_single(monkeypatch):
    sent = _capture(monkeypatch)
    assert asyncio.run(nbh.alert_if_mass_failure("잡A", 1, 1, {"timeout": 1})) is False
    assert sent == []
    assert asyncio.run(nbh.alert_if_mass_failure("잡A", 1, 3, {"timeout": 3})) is True
    assert len(sent) == 1 and "잡A" in sent[0][0] and "timeout 3건" in sent[0][1]
    assert "플레이스 정상" in sent[0][1]            # 회로 상태가 메시지에 들어간다(테스트에서는 둘 다 닫힘)


def test_breaker_open_is_reported_not_suppressed(monkeypatch):
    sent = _capture(monkeypatch)
    from services import naver_access_guard as g
    g.report_search_block("t", now=__import__("time").time())          # 검색 회로 열기
    asyncio.run(nbh.alert_if_mass_failure("잡B", 0, 3, {"captcha": 3}))
    assert len(sent) == 1 and "검색 열림" in sent[0][1]


def test_send_failure_never_raises(monkeypatch):
    import services.email_sender as es

    async def boom(subject, message):
        raise RuntimeError("smtp down")

    monkeypatch.setattr(es, "send_operator_alert", boom)
    assert asyncio.run(nbh.alert_if_mass_failure("잡C", 0, 5, {"x": 5})) is False


# ── 실제 잡이 이 알림을 부른다 (동작) ───────────────────────────────────────────
def _run_stats_job(monkeypatch, outcomes):
    """weekly_my_place_stats_job을 가짜 DB·가짜 수집 함수로 실행. outcomes: 사업장별 {'error': ...} 또는 {}."""
    import db.supabase_client as dbc
    import scheduler.jobs as jobs
    import services.naver_place_stats as nps
    import services.scan_scheduling as ss

    sent = _capture(monkeypatch)
    biz = [{"id": f"b{i}", "name": f"가게{i}", "naver_place_id": str(1000 + i), "user_id": "u1"} for i in range(len(outcomes))]
    calls = {"n": 0}

    async def fake_db_all(build):
        calls["n"] += 1
        if calls["n"] == 1:
            return jobs._AllRows(biz)
        return jobs._AllRows([{"user_id": "u1", "status": "active", "end_at": None}])

    outcome_by_id = {b["id"]: o for b, o in zip(biz, outcomes)}

    async def fake_sync(biz_id, place_id):
        o = outcome_by_id[biz_id]
        if o == "raise":
            raise RuntimeError("boom")
        return o

    async def no_sleep(*a, **k):
        return None

    monkeypatch.setattr(dbc, "get_client", lambda: object())
    monkeypatch.setattr(jobs, "_db_all", fake_db_all)
    monkeypatch.setattr(nps, "sync_naver_place_stats", fake_sync)
    monkeypatch.setattr(ss, "place_stats_day", lambda _id: date.today().weekday())
    monkeypatch.setattr(jobs.asyncio, "sleep", no_sleep)
    asyncio.run(jobs.weekly_my_place_stats_job())
    return sent


def test_stats_job_alerts_when_most_places_fail(monkeypatch):
    sent = _run_stats_job(monkeypatch, [{"error": "timeout"}, {"error": "timeout"}, {"review_count": 5}])
    assert len(sent) == 1
    assert "내 가게 통계" in sent[0][0] and "3곳 중 2곳(67%)" in sent[0][1] and "timeout 2건" in sent[0][1]


def test_stats_job_counts_exceptions(monkeypatch):
    sent = _run_stats_job(monkeypatch, ["raise", "raise", {"review_count": 1}, {"review_count": 2}])
    assert len(sent) == 1 and "exception 2건" in sent[0][1]


def test_stats_job_silent_when_healthy_or_single_failure(monkeypatch):
    assert _run_stats_job(monkeypatch, [{"review_count": 1}, {"review_count": 2}, {"review_count": 3}]) == []
    assert _run_stats_job(monkeypatch, [{"error": "timeout"}, {"review_count": 2}, {"review_count": 3}]) == []


# ── 나머지 잡·야간 스캔이 호출을 유지하는지 (구조) ──────────────────────────────────
def _src(name: str) -> str:
    import inspect
    import scheduler.jobs as jobs
    fn = getattr(jobs, name)
    return inspect.getsource(getattr(fn, "__wrapped__", fn))


@pytest.mark.parametrize("job,label", [
    ("daily_scan_all", "야간 스캔(daily_scan_all)"),
    ("competitor_place_sync_job", "경쟁사 플레이스 동기화(competitor_place_sync_job)"),
    ("enrich_competitor_details_job", "경쟁사 상세 보강(enrich_competitor_details_job)"),
    ("weekly_my_place_stats_job", "내 가게 통계 수집(weekly_my_place_stats_job)"),
    ("weekly_competitor_sync_job", "경쟁사 주간 동기화(weekly_competitor_sync_job)"),
])
def test_every_naver_batch_job_calls_the_alert(job, label):
    src = _src(job)
    assert f'alert_if_mass_failure("{label}"' in src


def test_nightly_scan_tallies_before_captcha_branch_and_alerts_after_loop():
    src = _src("daily_scan_all")
    assert src.index("tally_scan_result(_naver_result, _nb_reasons)") < src.index('if _naver_result.get("captcha_detected")')
    # 알림은 사업장 루프가 끝난 뒤(finally의 30초 대기 다음)에 한 번
    assert src.index("await asyncio.sleep(30)") < src.index("alert_if_mass_failure(")
    assert src.count("alert_if_mass_failure(") == 1
