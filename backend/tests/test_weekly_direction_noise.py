"""주간 성적표 추세 화살표가 오차 범위의 점수 차이로 ▲/▼를 말하지 않는다 (2026-11-08).

화면(stage_names.headline_direction)은 큰 변화(10점 이상)나 등급 변경+3점 이상일 때만 방향을 말하는데,
알림톡은 점수가 0.1만 달라도 ▲/▼를 보냈다.
"""
from services.kakao_notify import _weekly_direction


def test_tiny_changes_are_flat():
    assert _weekly_direction(60.0, 60.1) == "→"
    assert _weekly_direction(60.0, 58.0) == "→"
    assert _weekly_direction(60.0, 60.0) == "→"


def test_big_changes_have_direction():
    assert _weekly_direction(50.0, 61.0) == "▲"
    assert _weekly_direction(70.0, 59.0) == "▼"


def test_band_change_needs_minimum_delta():
    assert _weekly_direction(54.0, 56.0) == "→"      # 경계(55)를 넘었지만 2점은 오차
    assert _weekly_direction(53.0, 57.0) == "▲"      # 경계를 넘고 4점
    assert _weekly_direction(57.0, 53.0) == "▼"


def test_weekly_report_uses_the_noise_safe_direction():
    import inspect
    from services.kakao_notify import KakaoNotifier
    src = inspect.getsource(KakaoNotifier.send_weekly_score_report)
    assert "_weekly_direction(prev_score, current_score)" in src
    assert '"▲" if current_score > prev_score' not in src


def test_weekly_direction_matches_the_screen_rule_over_a_grid():
    """알림 방향은 화면 규칙(stage_names.headline_direction)과 모든 점수 쌍에서 같아야 한다(근사가 어긋나는지 격자 대조)."""
    from services.stage_names import headline_direction, stage_code_for_score
    arrow = {"up": "▲", "down": "▼", "flat": "→"}
    for a in range(0, 101, 1):
        for b in range(0, 101, 1):
            exp = arrow[headline_direction(stage_code_for_score(a), stage_code_for_score(b), float(b - a))]
            assert _weekly_direction(float(a), float(b)) == exp, (a, b)


def test_within_grade_noise_is_not_called_a_change():
    from services.kakao_notify import _grade_change
    assert _grade_change(60.0, 60.1) == "큰 변동 없음"
    assert _grade_change(62.0, 59.0) == "큰 변동 없음"
