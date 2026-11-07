"""스케줄러에 이미 지난 날짜의 일회성(date) 작업을 등록하지 않는다 (2026-11-08).

2026-06-01 AI탭 출시일 점검(date 트리거)이 시작할 때마다 등록돼, 재시작마다 "was missed by 157 days" 경고(이틀간 37건)를 남겼다.
경고가 매번 뜨면 정말 놓친 작업의 경고가 묻힌다. 월·목 정기 점검은 유지돼야 한다.
"""
import re
from datetime import datetime
from pathlib import Path

SRC = (Path(__file__).resolve().parents[1] / "scheduler" / "jobs.py").read_text(encoding="utf-8")


def test_no_one_shot_date_job_with_a_past_run_date():
    now = datetime.now()
    # scheduler.add_job(..., "date", run_date=datetime(Y, M, D, ...)) 형태의 고정 날짜를 모두 찾는다
    for m in re.finditer(r'"date"\s*,\s*run_date\s*=\s*datetime\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})', SRC):
        d = datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        assert d > now, f"이미 지난 일회성 작업이 등록돼 재시작마다 'missed' 경고를 남긴다: {m.group(0)}"


def test_dead_launch_check_is_gone_and_regular_cron_check_remains():
    assert 'id="ai_tab_june1_launch_check"' not in SRC             # 등록 코드(주석 제외)가 없다
    assert 'id="ai_tab_trigger_check"' in SRC                       # 월·목 09:00 정기 점검은 그대로
    assert re.search(r'ai_tab_trigger_check_job,\s*"cron",\s*day_of_week="mon,thu"', SRC)
