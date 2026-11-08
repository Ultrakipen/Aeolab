"""점수 변화 알림(SCORE_02)의 발송 문턱이 화면 규칙(stage_names.HEADLINE_BAND_MIN_DELTA)과 같은 값인지 고정한다 (2026-11-08).

알림은 '등급이 바뀌었고 점수 차이가 3점 이상'일 때만 간다(jobs.py 점수 변화 알림 블록의 `>= 3` + send_score_change의 등급 비교).
화면의 headline_direction과 같은 규칙이라 경계 부근에서 0.5점 차이로 등급이 오르내려도 알림이 가지 않는다. 한쪽 값만 바뀌면 어긋나므로 잠근다.
"""
import pathlib
import re

from services.stage_names import HEADLINE_BAND_MIN_DELTA

JOBS = pathlib.Path(__file__).resolve().parent.parent / "scheduler" / "jobs.py"


def test_score_change_alert_threshold_equals_screen_band_delta():
    text = JOBS.read_text(encoding="utf-8")
    m = re.search(r'abs\(curr_h\["total_score"\] - prev_h\["total_score"\]\) >= (\d+(?:\.\d+)?)', text)
    assert m, "점수 변화 알림의 문턱 식을 찾지 못했다(코드가 바뀌었다면 이 테스트도 같이 고칠 것)"
    assert float(m.group(1)) == HEADLINE_BAND_MIN_DELTA


def test_score_02_requires_a_grade_change():
    import inspect
    from services.kakao_notify import KakaoNotifier
    src = inspect.getsource(KakaoNotifier.send_score_change)
    assert "_grade(prev) == _grade(curr)" in src and "return False" in src
