"""성장 단계 상승 알림 히스테리시스 (2026-10-29) — 경계에서 흔들리는 점수가 같은 상승 알림을 반복하지 않게 한다."""
import inspect

import pytest

from services.stage_names import (
    STAGE_UPGRADE_LOOKBACK_DAYS,
    STAGE_UPGRADE_MARGIN,
    _STAGE_LOWER_BOUND,
    _UPPER_BOUNDS,
    stage_code_for_score,
    upgrade_alert_allowed,
)


def test_lower_bounds_match_the_score_bands():
    """하한표가 점수 구간(_UPPER_BOUNDS)과 어긋나면 알림 판단이 틀어진다."""
    uppers = {code: up for up, code in _UPPER_BOUNDS}
    assert _STAGE_LOWER_BOUND["stability"] == uppers["survival"]
    assert _STAGE_LOWER_BOUND["growth"] == uppers["stability"]
    assert _STAGE_LOWER_BOUND["dominance"] == uppers["growth"]
    for code, low in _STAGE_LOWER_BOUND.items():
        assert stage_code_for_score(low) == code      # 하한 점수 자체가 그 단계다


def test_barely_crossing_the_boundary_does_not_alert():
    assert upgrade_alert_allowed("growth", 55.2, [40.0]) is False
    assert upgrade_alert_allowed("growth", 55.0 + STAGE_UPGRADE_MARGIN - 0.1, [40.0]) is False


def test_clear_first_time_crossing_alerts():
    assert upgrade_alert_allowed("growth", 55.0 + STAGE_UPGRADE_MARGIN, [40.0, 48.0]) is True
    assert upgrade_alert_allowed("dominance", 80.0, [60.0]) is True
    assert upgrade_alert_allowed("stability", 40.0, []) is True       # 기록이 없어도(첫 스캔 직후) 선명히 넘었으면 알린다


def test_re_crossing_a_recently_reached_stage_does_not_alert():
    """55.2까지 올랐다가 54.5로 내려왔다가 다시 58이 된 경우 — 이미 도달했던 단계라 같은 알림을 또 보내지 않는다."""
    assert upgrade_alert_allowed("growth", 58.0, [58.5, 54.5]) is False      # 선명히 올랐다가(알림이 나갔을 점수) 내려왔다 다시 오름
    assert upgrade_alert_allowed("growth", 60.0, [59.0, 50.0]) is False


def test_barely_reached_history_does_not_block_a_later_clear_upgrade():
    """55.2까지 간신히 올랐을 때는 알림이 나가지 않았다 — 나중에 58로 선명히 오르면 그때는 알려야 한다."""
    assert upgrade_alert_allowed("growth", 58.0, [55.2, 54.5]) is True
    assert upgrade_alert_allowed("growth", 58.0, [56.0]) is True


def test_older_or_lower_history_does_not_block():
    assert upgrade_alert_allowed("growth", 58.0, [54.9, 50.0, 30.0]) is True      # 하한 미만이었던 기록만 있다


def test_missing_or_unknown_inputs_never_alert():
    assert upgrade_alert_allowed(None, 80.0, []) is False
    assert upgrade_alert_allowed("unknown", 80.0, []) is False
    assert upgrade_alert_allowed("growth", None, []) is False


def test_none_values_in_history_are_ignored():
    assert upgrade_alert_allowed("growth", 60.0, [None, 40.0, None]) is True
    assert upgrade_alert_allowed("growth", 60.0, None) is True


def test_boundary_flicker_sequence_alerts_at_most_once():
    """54.8→55.2→54.8→55.3→58 을 이어서 흘렸을 때 알림은 선명하게 넘은 한 번뿐이다."""
    history: list = []
    alerts = 0
    prev = 54.8
    for score in (55.2, 54.8, 55.3, 54.9, 58.0, 54.0, 59.0):
        up = stage_code_for_score(score) == "growth" and stage_code_for_score(prev) != "growth"
        if up and upgrade_alert_allowed("growth", score, history):
            alerts += 1
        history.append(score)
        prev = score
    assert alerts == 1        # 58.0 에서 한 번(그 전의 55.2/55.3은 마진 미달, 그 뒤 59.0은 이미 알린 단계의 재도달)


def test_daily_scan_wires_hysteresis_into_the_send_condition():
    import scheduler.jobs as jobs
    src = inspect.getsource(jobs.daily_scan_all)
    assert "upgrade_alert_allowed(current_stage.stage" in src
    assert "if _scan_notify_ok and not _rescored and not _hysteresis_blocked and is_stage_upgrade(" in src
    assert f"{STAGE_UPGRADE_LOOKBACK_DAYS}" in str(STAGE_UPGRADE_LOOKBACK_DAYS)
    # 확인하지 못했을 때는 보내지 않는 쪽(fail-closed)이어야 한다
    assert "except Exception as _hy_e:" in src and "_hysteresis_blocked = True" in src
