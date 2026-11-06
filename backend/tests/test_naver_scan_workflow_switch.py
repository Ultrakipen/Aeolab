"""GitHub 야간 네이버 스캔에 긴급 중단 스위치가 있다 (2026-11-07).

서버의 킬스위치 파일은 서버 밖(GitHub 서버)에서 도는 이 잡을 멈추지 못한다. 저장소 변수 NAVER_SCAN_DISABLED=true로 잡 전체를 건너뛴다.
변수가 없으면 기존처럼 실행돼야 한다(기본 동작 유지).
"""
from pathlib import Path

import pytest

# PyYAML은 requirements.txt에 직접 없고 간접 의존성이다 — CI에 없어도 배포 전 테스트 단계를 막지 않게 건너뛴다.
yaml = pytest.importorskip("yaml")

WF = Path(__file__).resolve().parents[2] / ".github" / "workflows" / "naver_scan.yml"


def _wf():
    return yaml.safe_load(WF.read_text(encoding="utf-8"))


def test_workflow_parses_and_keeps_schedule_and_manual_dispatch():
    wf = _wf()
    on = wf.get("on") or wf.get(True)          # PyYAML은 키 on을 True로 읽는다
    assert on["schedule"][0]["cron"] == "0 16 * * *"
    assert "workflow_dispatch" in on


def test_job_is_skipped_only_when_disable_variable_is_true():
    cond = _wf()["jobs"]["naver-scan"]["if"]
    assert "vars.NAVER_SCAN_DISABLED" in cond
    assert "!= 'true'" in cond                  # 변수 없음(빈 값) → 조건 참 → 지금처럼 실행


def test_prescan_step_still_runs_the_script():
    steps = _wf()["jobs"]["naver-scan"]["steps"]
    assert any("github_naver_scan.py" in (s.get("run") or "") for s in steps)
