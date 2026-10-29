"""상한 카운터 영속화·배치 예약 용량·일별 이력 테스트 (2026-10-27)."""
import asyncio
import json
import os
import sys
from datetime import date, timedelta

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import services.ai_scanner as sc  # noqa: E402


@pytest.fixture
def q(monkeypatch):
    today = date.today().isoformat()
    monkeypatch.setattr(sc, "_NAVER_PLAYWRIGHT_DAILY_CAP", 10)
    monkeypatch.setattr(sc, "_NAVER_BATCH_RATIO", 0.7)
    monkeypatch.setattr(sc, "_naver_pw_quota_date", today)
    monkeypatch.setattr(sc, "_naver_pw_quota_count", 0)
    monkeypatch.setattr(sc, "_naver_pw_quota_batch_count", 0)
    monkeypatch.setattr(sc, "_naver_pw_quota_alert_sent_date", today)   # 알림 경로 생략
    monkeypatch.setattr(sc, "_naver_pw_batch_deny_logged_date", "")
    sc._naver_pw_quota_by_source.clear()
    sc._naver_pw_quota_warn_sent.clear()
    return sc


def _restart(monkeypatch):
    """프로세스 재시작을 흉내: 메모리 값을 초기화하고 파일에서 복원."""
    monkeypatch.setattr(sc, "_naver_pw_quota_date", "")
    monkeypatch.setattr(sc, "_naver_pw_quota_count", 0)
    monkeypatch.setattr(sc, "_naver_pw_quota_batch_count", 0)
    sc._naver_pw_quota_by_source.clear()
    sc._load_quota_state()


def test_counter_survives_restart(q, monkeypatch):
    assert q.check_naver_playwright_quota("place", cost=5) is True
    assert q.check_naver_playwright_quota("rank", cost=2) is True
    _restart(monkeypatch)
    assert q._naver_pw_quota_count == 7                       # 재시작해도 0으로 돌아가지 않는다
    assert q._naver_pw_quota_by_source == {"place": 5, "rank": 2}
    assert q.check_naver_playwright_quota("x", cost=3) is True
    assert q.check_naver_playwright_quota("x", cost=1) is False   # 상한(10)까지 이어서 센다


def test_state_from_another_day_is_ignored(q, tmp_path):
    p = sc._quota_state_path()
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    with open(p, "w", encoding="utf-8") as f:
        json.dump({"date": yesterday, "count": 9, "batch_count": 5, "by_source": {"a": 9}}, f)
    sc._naver_pw_quota_count = 0
    sc._load_quota_state()
    assert sc._naver_pw_quota_count == 0


def test_corrupt_state_file_does_not_break_quota(q):
    with open(sc._quota_state_path(), "w", encoding="utf-8") as f:
        f.write("{broken")
    sc._load_quota_state()                                     # 예외 없이 무시
    assert q.check_naver_playwright_quota("x") is True


def test_batch_job_is_limited_to_the_batch_ratio_and_leaves_room_for_users(q):
    async def job():
        results = [q.check_naver_playwright_quota("batch", cost=1) for _ in range(10)]
        return results

    results = asyncio.run(q.naver_batch_job(job)())
    assert results.count(True) == 7 and results[7:] == [False, False, False]   # 상한 10의 70% = 7
    # 사용자(비배치) 요청은 남은 몫을 쓸 수 있다
    assert [q.check_naver_playwright_quota("user", cost=1) for _ in range(4)] == [True, True, True, False]
    assert q._naver_pw_quota_count == 10


def test_batch_flag_is_reset_after_job_and_propagates_to_subtasks(q):
    seen = {}

    async def sub():
        seen["inside_sub"] = q.is_naver_batch()

    async def job():
        await asyncio.gather(sub())
        seen["inside"] = q.is_naver_batch()

    asyncio.run(q.naver_batch_job(job)())
    assert seen == {"inside_sub": True, "inside": True}
    assert q.is_naver_batch() is False


def test_batch_usage_is_tracked_separately_in_snapshot(q):
    async def job():
        q.check_naver_playwright_quota("b", cost=3)

    asyncio.run(q.naver_batch_job(job)())
    q.check_naver_playwright_quota("u", cost=2)
    snap = q.naver_playwright_quota_snapshot()
    assert snap["used"] == 5 and snap["batch_used"] == 3 and snap["batch_cap"] == 7


def test_daily_history_line_is_written_at_date_rollover(q, monkeypatch):
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    monkeypatch.setattr(sc, "_naver_pw_quota_date", yesterday)
    monkeypatch.setattr(sc, "_naver_pw_quota_count", 8)
    monkeypatch.setattr(sc, "_naver_pw_quota_batch_count", 5)
    sc._naver_pw_quota_by_source.clear()
    sc._naver_pw_quota_by_source.update({"naver_place_stats.check": 5, "naver_keyword_rank.pc": 3})
    assert q.check_naver_playwright_quota("new_day") is True    # 날짜가 바뀌며 어제 이력이 남는다
    with open(sc._quota_history_path(), "r", encoding="utf-8") as f:
        row = json.loads(f.readline())
    assert row == {"date": yesterday, "used": 8, "batch_used": 5,
                   "by_source": {"naver_place_stats.check": 5, "naver_keyword_rank.pc": 3}}
    assert q._naver_pw_quota_count == 1                         # 새 날은 0부터


def test_restart_on_a_new_day_keeps_yesterday_in_history_once(q, tmp_path):
    """하루를 넘겨 재시작해도 어제 사용량이 이력에 한 줄 남는다 — 이전에는 서버 이력 파일이 비어 있었다(배포가 잦아 자정을 넘기는 프로세스가 없음)."""
    from datetime import date, timedelta
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    with open(sc._quota_state_path(), "w", encoding="utf-8") as f:
        json.dump({"date": yesterday, "count": 59, "batch_count": 57, "by_source": {"a": 59}}, f)
    sc._load_quota_state()
    sc._load_quota_state()                                     # 아무 접속 없이 한 번 더 재시작해도 중복 기록 없음
    rows = sc.naver_quota_history(30)
    assert [(r["date"], r["used"], r["batch_used"]) for r in rows] == [(yesterday, 59, 57)]
    assert sc._naver_pw_quota_count == 0 and sc._naver_pw_quota_date == date.today().isoformat()


def test_restart_same_day_does_not_write_history(q):
    sc.check_naver_playwright_quota("x", 2)
    sc._naver_pw_quota_count = 0
    sc._load_quota_state()
    assert sc._naver_pw_quota_count == 2 and sc.naver_quota_history(30) == []
