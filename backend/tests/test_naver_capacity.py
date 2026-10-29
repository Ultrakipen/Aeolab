"""네이버 접속 용량 단계 판정 + 잡 등록 (2026-10-29)."""
import os
import re

from services.naver_capacity import capacity_level, capacity_limit

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_JOBS = open(os.path.join(_ROOT, "scheduler", "jobs.py"), encoding="utf-8").read()


def test_levels():
    assert capacity_level(34, 50) is None
    assert capacity_level(35, 50) == "70%"
    assert capacity_level(44, 50) == "70%"
    assert capacity_level(45, 50) == "90%"
    assert capacity_level(49, 50) == "90%"
    assert capacity_level(50, 50) == "100%"
    assert capacity_level(80, 50) == "100%"
    assert capacity_level(0, 50) is None
    assert capacity_level(10, 0) is None


def test_limit_default_and_bad_env(monkeypatch):
    monkeypatch.delenv("NAVER_CAPACITY_BUSINESSES", raising=False)
    assert capacity_limit() == 50
    monkeypatch.setenv("NAVER_CAPACITY_BUSINESSES", "abc")
    assert capacity_limit() == 50
    monkeypatch.setenv("NAVER_CAPACITY_BUSINESSES", "-3")
    assert capacity_limit() == 50
    monkeypatch.setenv("NAVER_CAPACITY_BUSINESSES", "80")
    assert capacity_limit() == 80


def test_job_registered_and_does_not_block_payments():
    assert re.search(r'naver_capacity_check_job, "cron", hour=9, minute=40,\s*id="naver_capacity_check"', _JOBS)
    body = _JOBS.split("async def naver_capacity_check_job", 1)[1].split("\nasync def ", 1)[0]
    assert "send_operator_alert" in body
    assert "raise HTTPException" not in body      # 알림만 — 결제·가입 차단 없음
