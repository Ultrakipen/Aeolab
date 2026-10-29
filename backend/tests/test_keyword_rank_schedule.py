"""키워드 순위 잡 일정 고정 (2026-10-28).

유료 상위 플랜(Pro·창업·Biz)의 순위 측정은 매일이 아니라 월·수·금이다 — 네이버 검색 화면 접속의 최대 항목이고
순위는 느리게 변한다. 매일로 되돌리면 용량 모델의 상한 초과 시점이 앞당겨지므로 일정을 테스트로 고정한다.
실제 스케줄러를 만들지 않고 jobs.py 소스의 add_job 등록부를 읽는다(네트워크·DB 접속 없음).
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

_SRC = open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scheduler", "jobs.py"),
            encoding="utf-8").read()


def _registration(job_id: str) -> str:
    m = re.search(r"scheduler\.add_job\(\s*[^)]*?id=\"%s\"" % re.escape(job_id), _SRC, re.S)
    assert m, f"{job_id} 등록부를 찾지 못했다"
    return m.group(0)


def test_pro_rank_job_runs_mon_wed_fri_only():
    reg = _registration("keyword_rank_pro_daily")
    assert 'day_of_week="mon,wed,fri"' in reg, reg
    assert "hour=4, minute=30" in reg


def test_basic_rank_job_runs_daily_but_measures_each_biz_once_a_week():
    """2026-10-29: Basic 순위는 월요일 한 번에 몰리던 것을 매일 실행 + 가게별 요일(keyword_rank_day)로 나눴다."""
    reg = _registration("keyword_rank_basic_weekly")
    assert "day_of_week" not in reg, reg          # 매일 등록
    assert "async def keyword_rank_basic_weekly_job" in _SRC
    body = _SRC.split("async def keyword_rank_basic_weekly_job", 1)[1].split("@_naver_batch_job", 1)[0]
    assert "only_today_slot=True" in body


def test_rank_day_gives_each_biz_exactly_one_day_and_spreads_evenly():
    import uuid
    from services.scan_scheduling import keyword_rank_day
    ids = [str(uuid.UUID(int=(i + 1) * 104729)) for i in range(700)]
    days = [keyword_rank_day(i) for i in ids]
    assert all(0 <= d <= 6 for d in days)
    assert all(keyword_rank_day(i) == keyword_rank_day(i) for i in ids)   # 재시작해도 같은 요일
    counts = [days.count(d) for d in range(7)]
    assert max(counts) <= 130 and min(counts) >= 70, counts               # 한 요일 쏠림 방지(평균 100)


def test_rank_day_independent_of_scan_slot():
    """경쟁사 동기화·스캔 슬롯과 같은 요일에 몰리지 않는다(소금값 분리)."""
    import uuid
    from services.scan_scheduling import keyword_rank_day, scan_slot
    ids = [str(uuid.UUID(int=(i + 1) * 104729)) for i in range(700)]
    same = sum(1 for i in ids if keyword_rank_day(i) == scan_slot(i))
    assert same < 700 * 0.3, same                 # 완전 동일 해시면 100%


def test_load_model_matches_schedule():
    """용량 모델의 순위 요일이 잡 일정과 같아야 한다(월·수·금 = 0·2·4)."""
    model = open(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                              "scripts", "naver_load_model.py"), encoding="utf-8").read()
    assert "wd in (0, 2, 4)" in model
    assert "wd == keyword_rank_day(biz_id)" in model   # Basic 순위 요일이 잡과 같은 함수를 쓴다
