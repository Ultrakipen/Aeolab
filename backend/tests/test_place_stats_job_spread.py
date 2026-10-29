"""내 가게 플레이스 통계 잡: 가게별 요일 분산 + 배치 몫 + 차단 시 중단 (2026-10-29).

과거: 일요일 03:00에 전원 일괄, @naver_batch_job 없음, 차단돼도 다음 가게로 계속 진행.
"""
import os
import re
import uuid

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_SRC = open(os.path.join(_ROOT, "scheduler", "jobs.py"), encoding="utf-8").read()


def _job_src() -> str:
    head = _SRC.split("async def weekly_my_place_stats_job", 1)[1]
    return head.split("\nasync def ", 1)[0]


def test_registered_daily_not_sunday_only():
    m = re.search(r"scheduler\.add_job\(\s*weekly_my_place_stats_job[^)]*?id=\"weekly_my_place_stats\"", _SRC, re.S)
    assert m, "등록부를 찾지 못했다"
    assert "day_of_week" not in m.group(0), m.group(0)


def test_job_is_naver_batch_job():
    idx = _SRC.index("async def weekly_my_place_stats_job")
    assert _SRC[:idx].rstrip().endswith("@_naver_batch_job")


def test_job_filters_by_per_biz_day_and_stops_on_block():
    body = _job_src()
    assert "place_stats_day(" in body
    assert 'break' in body and "naver_place_cooldown" in body and "ip_blocked" in body


def test_day_is_stable_even_and_independent_of_rank_day():
    from services.scan_scheduling import keyword_rank_day, place_stats_day
    ids = [str(uuid.UUID(int=(i + 1) * 104729)) for i in range(700)]
    days = [place_stats_day(i) for i in ids]
    assert all(0 <= d <= 6 for d in days)
    counts = [days.count(d) for d in range(7)]
    assert max(counts) <= 130 and min(counts) >= 70, counts
    same = sum(1 for i in ids if place_stats_day(i) == keyword_rank_day(i))
    assert same < 700 * 0.3, same        # 순위 요일과 같은 날에 몰리지 않는다


def test_load_model_uses_same_function():
    model = open(os.path.join(os.path.dirname(_ROOT), "scripts", "naver_load_model.py"), encoding="utf-8").read()
    assert "wd == place_stats_day(biz_id)" in model
