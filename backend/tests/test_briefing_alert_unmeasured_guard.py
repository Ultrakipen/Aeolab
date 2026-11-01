"""브리핑 변화 알림은 측정 실패한 스캔을 '이탈'로 알리지 않는다 (지침 8: error≠false)."""


def test_guard_present_before_change_detection():
    src = open("scheduler/jobs.py", encoding="utf-8").read()
    i = src.index("async def check_briefing_alert_job")
    body = src[i:i + 9000]
    g = body.index("naver_result_unmeasured as _nru")
    c = body.index("if today_mentioned == prev_mentioned")
    assert g < c, "측정 실패 가드는 변화 비교보다 먼저 있어야 한다"
    assert "_nru(today_naver) or _nru(prev_naver)" in body


def test_unmeasured_results_are_recognised():
    from services.score_engine import naver_result_unmeasured as nru
    assert nru({"captcha_detected": True, "mentioned_in_briefing": False})
    assert nru({"error": "naver_search_cooldown"})
    assert nru({"quota_skipped": True})
    assert not nru({"mentioned_in_briefing": False})   # 정상 측정 후 미노출은 그대로 미노출
