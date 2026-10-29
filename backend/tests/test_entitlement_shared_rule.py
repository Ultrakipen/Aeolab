"""네이버·AI 스캔 비용이 드는 정기 잡은 같은 구독 자격 기준을 쓴다 (2026-10-29).

해지해도 만료일(end_at)까지 서비스를 유지한다는 안내(설정 화면)·get_user_plan과 달리, 야간 스캔은 active·grace_period만,
순위 잡·내 가게 통계 잡은 active만 처리해 해지 후 만료 전 사용자가 갱신에서 빠지고 있었다.
"""
import inspect
from datetime import datetime, timedelta, timezone

import scheduler.jobs as jobs
from services import scan_scheduling as ss

NOW = datetime.now(timezone.utc)
FUT = (NOW + timedelta(days=5)).isoformat()
PAST = (NOW - timedelta(days=5)).isoformat()


def test_sub_rows_keep_plan_fields_and_drop_lapsed():
    rows = [
        {"user_id": "a", "plan": "pro", "status": "active", "end_at": None},
        {"user_id": "b", "plan": "basic", "status": "cancelled", "end_at": FUT},
        {"user_id": "c", "plan": "basic", "status": "cancelled", "end_at": PAST},
        {"user_id": "d", "plan": "biz", "status": "grace_period", "end_at": None},
    ]
    kept = ss.entitled_sub_rows(rows)
    assert [r["user_id"] for r in kept] == ["a", "b", "d"]
    assert kept[1]["plan"] == "basic"                      # 플랜별 스캔 전략에 쓰이므로 행이 그대로 유지돼야 한다
    assert ss.entitled_sub_rows(None) == []


JOBS = ["daily_scan_all", "weekly_my_place_stats_job", "_run_keyword_rank_for_plans"]


def test_three_cost_jobs_use_the_shared_rule_and_include_cancelled_in_period():
    for name in JOBS:
        src = inspect.getsource(getattr(jobs, name))
        assert "entitled_sub_rows" in src, f"{name}: 공통 자격 기준을 쓰지 않는다"
        assert '"cancelled"' in src and "end_at" in src, f"{name}: 해지 후 만료 전 사용자를 조회하지 않는다"
        # 구독 조회가 active만 보는 옛 방식으로 돌아가지 않았는지
        sub_block = src[src.index('table("subscriptions")'):][:260]
        assert '.eq("status", "active")' not in sub_block, f"{name}: active만 조회한다"
