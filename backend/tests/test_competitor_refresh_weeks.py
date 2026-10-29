"""경쟁사 갱신 주기 레버 COMPETITOR_REFRESH_WEEKS (2026-10-29) — 기본 2주는 현재 값과 정확히 같아야 한다."""
import pytest

import services.competitor_place_crawler as cc
import services.scan_scheduling as ss


def test_default_is_two_weeks_and_matches_current_constants():
    assert ss.refresh_params(2) == (13.5 * 86400, 13.0)
    assert ss.COMPETITOR_REFRESH_TTL_SEC == 13.5 * 86400 and ss.COMPETITOR_PACE_DAYS == 13.0


@pytest.mark.parametrize("raw,expected", [("2", 2), ("3", 3), ("4", 4), (" 4 ", 4), ("", 2), ("1", 2), ("5", 2), ("abc", 2), ("0", 2)])
def test_weeks_parsing_falls_back_to_two_for_anything_unsupported(monkeypatch, raw, expected):
    monkeypatch.setenv("COMPETITOR_REFRESH_WEEKS", raw)
    assert ss.competitor_refresh_weeks() == expected


def test_unset_means_two_weeks(monkeypatch):
    monkeypatch.delenv("COMPETITOR_REFRESH_WEEKS", raising=False)
    assert ss.competitor_refresh_weeks() == 2


def test_longer_periods_keep_ttl_just_under_the_period():
    for w in (3, 4):
        ttl, pace = ss.refresh_params(w)
        assert (w * 7 - 1) * 86400 < ttl < w * 7 * 86400        # N주째 아침에 하루씩 밀리지 않는다
        assert pace == w * 7 - 1 and pace * 86400 < ttl         # pacing은 TTL보다 짧아 TTL 안에 한 바퀴를 돈다


def test_crawler_ttl_follows_the_single_source_unless_overridden(monkeypatch):
    monkeypatch.delenv("COMPETITOR_PLACE_CACHE_TTL_SEC", raising=False)
    assert cc._place_cache_ttl() == ss.COMPETITOR_REFRESH_TTL_SEC
    monkeypatch.setenv("COMPETITOR_PLACE_CACHE_TTL_SEC", "3600")
    assert cc._place_cache_ttl() == 3600.0                        # 직접 지정이 우선
    monkeypatch.setenv("COMPETITOR_PLACE_CACHE_TTL_SEC", "oops")
    assert cc._place_cache_ttl() == ss.COMPETITOR_REFRESH_TTL_SEC  # 잘못된 값은 단일 출처로 되돌린다


def test_interactive_paths_stay_shorter_than_any_refresh_period():
    """방금 등록한 경쟁사·창업 리포트가 쓰는 짧은 기한은 주기를 늘려도 그대로다."""
    for w in (2, 3, 4):
        assert cc.INTERACTIVE_MAX_AGE_SEC < ss.refresh_params(w)[0]
