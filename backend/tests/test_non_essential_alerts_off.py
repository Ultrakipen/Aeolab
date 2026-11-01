"""사용자에게 꼭 필요하지 않은 알림톡을 끈 상태 유지 (2026-11-01 사용자 결정 반영).

- 소식 14일 미작성: last_post_at이 사용자 입력이라 '모름'을 '안 올림'으로 말할 수 있고 템플릿 목적도 다르다 → 기본 꺼짐
- 가입 7일차: '추천 행동 확인' 한 줄뿐인 참여 유도 → 카카오 발송 제거(재스캔·앱 내 알림 기록은 유지)
"""
import re

SRC = open("scheduler/jobs.py", encoding="utf-8").read()


def test_inactive_post_alert_is_registered_only_when_enabled():
    m = re.search(r"if os\.getenv\(\"INACTIVE_POST_ALERT_ENABLED\", \"false\"\)\.lower\(\) == \"true\":\s*\n\s*scheduler\.add_job\(\s*\n\s*inactive_post_alert_job", SRC)
    assert m, "소식 미작성 잡은 환경변수 스위치 안에서만 등록되어야 한다"
    # 스위치 밖에 무조건 등록하는 줄이 없어야 한다
    assert len(re.findall(r"inactive_post_alert_job,\s*\"cron\"", SRC)) == 1


def test_day7_job_no_longer_sends_kakao_but_keeps_rescan_and_inapp_record():
    i = SRC.index("async def new_user_day7_rescan_job")
    body = SRC[i:SRC.index("\nasync def ", i + 10)]
    assert "send_action_items" not in body
    assert "_notifier" not in body
    assert "await _quick(scan_id, req)" in body          # 재스캔 유지
    assert '"type": "day7_action"' in body               # 앱 내 알림 기록 유지
