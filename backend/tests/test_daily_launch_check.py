"""daily_launch_check.py: 읽기 전용·개인정보 비출력·조회 실패는 '확인 못 함'."""
import importlib.util
import os
from datetime import datetime, timedelta, timezone

PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts", "daily_launch_check.py")
SRC = open(PATH, encoding="utf-8").read()
KST = timezone(timedelta(hours=9))


def _mod():
    spec = importlib.util.spec_from_file_location("daily_launch_check", PATH)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def test_script_never_writes_or_touches_naver():
    for bad in ("sb.table(\"x\").insert", ".update({", ".delete()", ".upsert(", "playwright", "naver.com", "send_"):
        assert bad not in SRC, bad
    import re
    assert not re.search(r"\.table\([^)]*\)\s*\.(insert|update|delete|upsert)\(", SRC)
    assert "sys.path.insert" in SRC      # 위 검사가 이 줄을 오탐하지 않는지(정상 줄은 허용)


def test_no_personal_columns_selected():
    for bad in ("email", "phone", "key_hash", "select(\"*\")"):
        assert f'select("{bad}' not in SRC and f',{bad}' not in SRC, bad


def test_lookup_failure_is_not_reported_as_zero():
    import asyncio
    m = _mod()

    async def boom():
        raise RuntimeError("x")
    assert asyncio.run(m._count("l", boom)).startswith("확인 못 함")


def test_cookie_reminder_phases():
    m = _mod()
    assert "11-17부터 경고" in m.cookie_reminder(datetime(2026, 11, 10, tzinfo=KST))
    assert "교체 임박" in m.cookie_reminder(datetime(2026, 11, 18, tzinfo=KST))
    assert "지남" in m.cookie_reminder(datetime(2026, 11, 25, tzinfo=KST))


def test_subscriber_breakdown_separates_admin_and_unpaid():
    m = _mod()
    rows = [{"user_id": "admin", "status": "active"}, {"user_id": "a", "status": "active"}, {"user_id": "b", "status": "active"},
            {"user_id": "c", "status": "cancelled"}]
    b = m.subscriber_breakdown(rows, {"admin"}, {"a", "c"})
    assert b["활성 전체(스케줄러 트리거 기준)"] == 3 and b["관리자 제외"] == 2 and b["결제 기록 있는 외부"] == 1   # 해지(c)는 활성이 아니다


def test_milestone_gap_matches_scheduler_triggers():
    m = _mod()
    assert m.milestone_gap(0) == "다음 트리거 20명까지 20명" and m.milestone_gap(20) == "다음 트리거 50명까지 30명"
    assert "지남" in m.milestone_gap(100)
    jobs = open(os.path.join(os.path.dirname(PATH), "..", "scheduler", "jobs.py"), encoding="utf-8").read()
    for n in m.MILESTONES:
        assert f"count >= {n}" in jobs        # 점검의 20·50·100이 스케줄러 임계값과 같다
