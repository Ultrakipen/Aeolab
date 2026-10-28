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


def test_basic_rank_job_stays_weekly_monday():
    assert 'day_of_week="mon"' in _registration("keyword_rank_basic_weekly")


def test_load_model_matches_schedule():
    """용량 모델의 순위 요일이 잡 일정과 같아야 한다(월·수·금 = 0·2·4)."""
    model = open(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                              "scripts", "naver_load_model.py"), encoding="utf-8").read()
    assert "wd in (0, 2, 4)" in model
