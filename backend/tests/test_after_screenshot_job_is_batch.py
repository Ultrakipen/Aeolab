"""정기 잡이 네이버에 접속하면 @naver_batch_job(배치 몫)이어야 한다 — after_screenshot_job (2026-11-10).

수정 전에는 이 잡만 배치 표시가 없어 사용자 요청 몫을 쓰고 배치 속도 비율을 피해 갔다.
(rank_canary_job은 일부러 제외: 자체 상한 판정이 있고, 배치 몫 거절이 '측정 이상' 거짓 경보가 될 수 있다.)
"""
from scheduler import jobs


def test_after_screenshot_job_is_marked_batch():
    assert hasattr(jobs.after_screenshot_job, "__wrapped__"), "functools.wraps 로 감싼 naver_batch_job 이어야 한다"
