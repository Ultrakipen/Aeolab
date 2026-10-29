"""사용자 요청 접속 계측 (2026-10-29) — 기록 전용이며 한도·차단 판단에 관여하지 않는다."""
import importlib
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


@pytest.fixture()
def meter(tmp_path, monkeypatch):
    monkeypatch.setenv("NAVER_USAGE_METER_FILE", str(tmp_path / "m.json"))
    import services.naver_usage_meter as m
    m = importlib.reload(m)
    return m


def test_counts_pages_and_scans_and_distinct_businesses(meter):
    meter.record_user_pages("naver_place_stats.fetch", 2)
    meter.record_user_pages("naver_place_stats.fetch", 2)
    meter.record_user_pages("naver_ai_tab.scan")
    meter.note_user_scan("stream", "biz-1")
    meter.note_user_scan("stream", "biz-1")      # 같은 가게가 두 번 눌러도 서로 다른 사업장은 1곳
    meter.note_user_scan("trial")                # 비로그인 체험은 사업장 id가 없다
    s = meter.snapshot()
    assert s["user_pages"] == 5 and s["user_by_source"]["naver_place_stats.fetch"] == 4
    assert s["scans_by_kind"] == {"stream": 2, "trial": 1} and s["scan_bizs"] == 1


def test_state_survives_restart_and_day_rollover_writes_history(meter, monkeypatch, tmp_path):
    meter.record_user_pages("x", 3)
    meter.note_user_scan("full", "b1")
    meter2 = importlib.reload(meter)               # 재시작 — 오늘 것이면 이어서 센다
    assert meter2.snapshot()["user_pages"] == 3
    # 자정이 지난 뒤 첫 기록: 어제 치가 이력으로 가고 오늘은 0부터
    class _D(meter2.date):
        @classmethod
        def today(cls):
            return cls.fromisoformat("2099-01-02")
    monkeypatch.setattr(meter2, "date", _D)
    meter2.record_user_pages("y", 1)
    hist = meter2.history()
    assert len(hist) == 1 and hist[0]["user_pages"] == 3 and hist[0]["scans_by_kind"] == {"full": 1} and hist[0]["scan_bizs"] == 1
    assert meter2.snapshot()["user_pages"] == 1 and meter2.snapshot()["date"] == "2099-01-02"


def test_restart_after_midnight_does_not_lose_yesterday(meter, tmp_path):
    p = tmp_path / "m.json"
    p.write_text(json.dumps({"date": "2000-01-01", "user_pages": 7, "user_by_source": {"a": 7},
                             "scans_by_kind": {"stream": 2}, "scan_bizs": ["b1", "b2"]}), encoding="utf-8")
    m = importlib.reload(meter)
    assert [r["date"] for r in m.history()] == ["2000-01-01"] and m.history()[0]["scan_bizs"] == 2
    assert m.snapshot()["user_pages"] == 0


def test_corrupt_state_file_is_ignored(meter, tmp_path):
    (tmp_path / "m.json").write_text("{ not json", encoding="utf-8")
    m = importlib.reload(meter)
    m.record_user_pages("z")                       # 예외 없이 동작
    assert m.snapshot()["user_pages"] == 1


def test_summary_returns_none_not_zero_when_no_sample(meter):
    s = meter.summarize([], [], 0)
    assert s["user_share_pct"] is None and s["manual_scans_per_day"] is None and s["manual_scans_per_biz_per_day"] is None


def test_summary_user_share_and_per_biz_rate(meter):
    quota = [{"date": "2026-11-01", "used": 100, "batch_used": 70}, {"date": "2026-11-02", "used": 100, "batch_used": 90}]
    scans = [{"date": "2026-11-01", "scans_by_kind": {"stream": 3}}, {"date": "2026-11-02", "scans_by_kind": {"stream": 1}}]
    s = meter.summarize(quota, scans, 10)
    assert s["user_share_pct"] == 20.0                       # (30+10)/200
    assert s["manual_scans_per_day"] == 2.0 and s["manual_scans_per_biz_per_day"] == 0.2
    assert s["model_assumed_per_biz_per_day"] == 0.2


def test_hooks_are_in_place_and_never_gate_access():
    """수동 스캔 4곳과 한도 기록이 계측을 호출한다 — 호출이 빠지면 데이터가 조용히 비게 된다."""
    scan = open(os.path.join(_ROOT, "routers", "scan.py"), encoding="utf-8").read()
    for kind in ('note_user_scan("stream", biz_id)', 'note_user_scan("full", req.business_id)',
                 'note_user_scan("basic_trial", biz_id)', 'note_user_scan("trial")'):
        assert scan.count(kind) == 1, kind
    quota = open(os.path.join(_ROOT, "services", "ai_scanner", "__init__.py"), encoding="utf-8").read()
    body = quota.split("def check_naver_playwright_quota", 1)[1].split("\ndef ", 1)[0]
    assert "if not _naver_batch_var.get():" in body and "record_user_pages(_src, cost)" in body
    # 계측 호출은 한도 판정(return False) 이후에 있고 예외를 삼킨다
    assert body.index("record_user_pages") > body.index("return False")
    assert "except Exception as _um_e" in body
    admin = open(os.path.join(_ROOT, "routers", "admin.py"), encoding="utf-8").read()
    assert '"usage": usage' in admin


def test_quota_function_feeds_meter_for_user_requests_only(meter, tmp_path, monkeypatch):
    """사용자 요청 접속은 계측에 잡히고 정기 잡(배치)은 잡히지 않는다 — 실제 한도 함수를 호출해 확인."""
    import asyncio
    import services.ai_scanner as sc
    monkeypatch.setenv("NAVER_QUOTA_STATE_FILE", str(tmp_path / "q.json"))
    monkeypatch.setattr(sc, "_naver_pw_quota_date", "")
    monkeypatch.setattr(sc, "_naver_pw_quota_count", 0)
    monkeypatch.setattr(sc, "_naver_pw_quota_batch_count", 0)
    sc._naver_pw_quota_by_source.clear()
    # meter 모듈은 fixture가 reload한 객체 — sc가 import하는 것과 같은 모듈 객체여야 한다
    import services.naver_usage_meter as live
    assert live is meter

    assert sc.check_naver_playwright_quota("user.src", 3) is True
    assert meter.snapshot()["user_pages"] == 3 and meter.snapshot()["user_by_source"] == {"user.src": 3}

    async def _batch():
        return sc.check_naver_playwright_quota("batch.src", 2)

    @sc.naver_batch_job
    async def job():
        return await _batch()

    assert asyncio.run(job()) is True
    assert meter.snapshot()["user_pages"] == 3                # 배치 접속 2페이지는 사용자 몫에 들어가지 않는다
    assert sc._naver_pw_quota_count == 5 and sc._naver_pw_quota_batch_count == 2   # 기존 한도 기록은 그대로


def test_meter_failure_never_blocks_access(meter, tmp_path, monkeypatch):
    import services.ai_scanner as sc
    monkeypatch.setenv("NAVER_QUOTA_STATE_FILE", str(tmp_path / "q2.json"))
    monkeypatch.setattr(sc, "_naver_pw_quota_date", "")
    monkeypatch.setattr(sc, "_naver_pw_quota_count", 0)
    monkeypatch.setattr(sc, "_naver_pw_quota_batch_count", 0)
    sc._naver_pw_quota_by_source.clear()

    def boom(*a, **k):
        raise RuntimeError("meter down")
    monkeypatch.setattr(meter, "record_user_pages", boom)
    assert sc.check_naver_playwright_quota("user.src", 1) is True      # 계측이 죽어도 접속 허용 판단은 그대로
