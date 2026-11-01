"""Gemini를 쓰는 주간 보조 잡은 야간 스캔(02:00)과 겹치지 않아야 한다 — 2026-11-01 일요일 야간 스캔 Gemini 표본 55/100 사고 재발 방지."""
import re

SRC = open("scheduler/jobs.py", encoding="utf-8").read()


def _hour_of(job_name: str) -> int:
    m = re.search(job_name + r",\s*\"cron\",[^)]*?hour=(\d+)", SRC, re.S)
    assert m, f"{job_name} 스케줄을 찾지 못함"
    return int(m.group(1))


def test_enrich_excerpts_not_at_nightly_scan_hour():
    scan_hour = _hour_of("daily_scan_all")
    assert scan_hour == 2
    enrich = _hour_of("_enrich_competitor_excerpts")
    # 야간 스캔은 02:00부터 사업장 수에 따라 길어지므로 최소 2시간 이상 떨어뜨린다
    assert enrich - scan_hour >= 2
