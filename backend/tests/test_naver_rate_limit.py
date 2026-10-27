"""플레이스 접속 속도 기준(슬라이딩 윈도우) 테스트 (2026-10-27)."""
import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services import naver_access_guard as g  # noqa: E402


def _reserve(cost, now, batch=True):
    return asyncio.run(g.reserve_place_pages(cost, "t", batch=batch, now=now, sleep=False))


def test_first_request_runs_immediately():
    ok, why, wait = _reserve(10, 1000.0)
    assert ok and why is None and wait == 0.0


def test_one_minute_window_delays_second_crawl():
    _reserve(10, 1000.0)
    ok, _, wait = _reserve(10, 1000.0)          # 1분 한도 12 → 10+10 불가
    assert ok and 59 < wait < 62                # 첫 기록이 윈도우 밖으로 빠진 직후


def test_ten_minute_window_caps_total_pages(monkeypatch):
    monkeypatch.setenv("NAVER_BATCH_RATE_RATIO", "1.0")   # 전체 윈도우 한도 기준(기본 0.7은 아래 별도 테스트)
    t = 1000.0
    waits = []
    for _ in range(6):                           # 6 × 10 = 60페이지를 같은 순간에 요청
        ok, _, w = _reserve(10, t)
        assert ok
        waits.append(w)
    # 10분 한도 30 → 3건은 10분 안, 4번째부터는 10분 뒤로 밀린다
    assert waits[2] < 600 and waits[3] > 590
    assert waits == sorted(waits)                # 예약은 시각 순서


def test_never_exceeds_any_window_limit(monkeypatch):
    monkeypatch.setenv("NAVER_BATCH_RATE_RATIO", "1.0")   # 전체 윈도우 한도 기준
    t0 = 5000.0
    times = []
    for _ in range(15):          # 75페이지 — 10분 한도 30 기준 약 25분 안에 소화되는 양
        ok, _, w = _reserve(5, t0)
        assert ok
        times.append(t0 + w)
    for w_sec, m in g.rate_limits(t0):
        for t in times:
            assert sum(5 for x in times if t - w_sec < x <= t) <= m


def test_user_request_is_refused_instead_of_waiting_long():
    _reserve(10, 1000.0)
    ok, why, _ = _reserve(10, 1000.0, batch=False)   # 사용자는 최대 15초만 기다린다 → 60초 필요하므로 거절
    assert not ok and why == g.RATE_LIMITED_ERROR
    # 거절된 요청은 기록되지 않는다
    assert sum(c for _, c in g._rate["entries"]) == 10


def test_batch_refused_when_wait_exceeds_limit():
    for _ in range(30):                           # 1시간 한도 120을 빠르게 채운다
        _reserve(12, 1000.0)
    ok, why, _ = _reserve(12, 1000.0)
    assert not ok and why == g.RATE_LIMITED_ERROR


def test_limits_halve_after_block_recovery(monkeypatch):
    base = dict((w, m) for w, m in g.rate_limits(1000.0))
    g.tighten_rate(1000.0)
    tight = dict((w, m) for w, m in g.rate_limits(1001.0))
    assert tight[60] == base[60] // 2 and tight[3600] == base[3600] // 2
    assert dict(g.rate_limits(1000.0 + 49 * 3600)) == base   # 48시간 뒤 원복


def test_block_report_tightens_limits():
    g.report_place_block("t", now=1000.0)
    assert g.rate_snapshot(1001.0)["tightened"] is True


def test_env_overrides_limits(monkeypatch):
    monkeypatch.setenv("NAVER_RATE_PER_MIN", "30")
    assert dict(g.rate_limits(1000.0))[60] == 30


def test_external_usage_counts_against_place_budget():
    g.record_external(10, now=1000.0)             # 브리핑·순위 등 검색 화면 접속
    ok, _, wait = _reserve(10, 1000.0)
    assert ok and wait > 59


def test_state_persists_across_reload():
    _reserve(10, 1000.0)
    g._rate_loaded = False
    g._rate["entries"] = []
    g._rate_load()
    assert sum(c for _, c in g._rate["entries"]) == 10


def test_quota_function_records_non_place_sources_only(monkeypatch):
    import services.ai_scanner as sc
    n0 = len(g._rate["entries"])
    sc.check_naver_playwright_quota("naver_scanner.check_mention", cost=2)
    assert len(g._rate["entries"]) == n0 + 1
    sc.check_naver_playwright_quota("naver_place_stats.fetch_stats", cost=2)   # 플레이스는 reserve가 기록
    assert len(g._rate["entries"]) == n0 + 1


def test_batch_default_leaves_room_for_users(monkeypatch):
    """기본(배치 0.7): 정기 잡은 10분 윈도우 30의 70%(21)만 쓴다 — 20페이지까지만 즉시, 3번째는 10분 뒤로 밀린다."""
    monkeypatch.delenv("NAVER_BATCH_RATE_RATIO", raising=False)
    monkeypatch.setenv("NAVER_BATCH_CAP_RATIO", "0.7")
    t = 1000.0
    waits = [_reserve(10, t)[2] for _ in range(3)]
    assert waits[1] < 600 and waits[2] > 590
    # 같은 사용량에서 사용자 몫이 남는지는 아래에서 직접 확인한다
    g.reset_rate_for_tests()
    g._rate_load()
    now = 9_000_000.0
    g._rate["entries"].extend([[now - 400, 10], [now - 300, 10]])    # 10분 안에 20페이지 사용 중(1분 윈도우는 비어 있음)
    assert g._earliest_slot(10, now, 0.7) > now          # 배치: 20+10 > 21 이므로 대기
    assert g._earliest_slot(10, now, 1.0) == now         # 사용자: 20+10 <= 30 이므로 즉시
