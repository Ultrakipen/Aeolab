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


# ── 단계별 대응표 (2026-10-29) ────────────────────────────────────────────
def test_playbook_steps_grow_with_usage_and_none_before_70pct():
    from services.naver_capacity import next_steps
    assert next_steps(69.9) == []
    n70, n90, n100, n200 = (len(next_steps(x)) for x in (70, 90, 100, 200))
    assert 0 < n70 < n90 < n100 < n200


def test_playbook_product_changes_require_user_decision():
    """공개 약속·플랜 한도·법적 민감 항목은 decide=True여야 한다 — 알림이 '자동 실행'처럼 읽히면 안 된다."""
    from services.naver_capacity import PLAYBOOK
    for s in PLAYBOOK:
        text = s["step"]
        if any(k in text for k in ("슬롯 분산", "프록시", "서버·프록시", "대기자", "AI탭 끔", "플랜별")):
            assert s["decide"] is True, text
    assert any(s["decide"] is False and "NAVER_AI_TAB_MAX_QUERIES" in s["step"] for s in PLAYBOOK)


def test_alert_body_lists_next_steps_and_marks_decisions():
    body = _JOBS.split("async def naver_capacity_check_job", 1)[1].split("\nasync def ", 1)[0]
    assert 'snap.get("next_steps"' in body and "[사용자 결정 필요]" in body


def test_lever_report_is_monotone_and_marks_assumptions():
    """절감책을 누적할수록 부하가 줄어야 하고, 미구현 가정·사용자 결정 단계가 구분돼 있어야 한다."""
    import importlib.util
    p = os.path.join(os.path.dirname(_ROOT), "scripts", "naver_load_model.py")
    spec = importlib.util.spec_from_file_location("naver_load_model", p)
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    before = (m.AI_TAB_PER_FULL, m.RANK_PER_KEYWORD, m.COMPETITOR_REFRESH_WEEKS)
    rows = m.lever_report(300)
    assert (m.AI_TAB_PER_FULL, m.RANK_PER_KEYWORD, m.COMPETITOR_REFRESH_WEEKS) == before   # 모듈 상태를 되돌린다
    peaks = [r["batch_peak"] for r in rows]
    assert all(a >= b for a, b in zip(peaks, peaks[1:])), peaks
    assert {r["kind"] for r in rows} == {"", "결정", "조건부", "가정"}
    assert rows[-1]["batch_peak"] < rows[0]["batch_peak"] * 0.3
