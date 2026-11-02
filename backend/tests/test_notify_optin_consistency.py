"""알림 설정(kakao_scan_notify·kakao_competitor_notify) 해석이 모든 정기 알림에서 같아야 한다 (2026-11-02).

규칙: 명시적 True일 때만 보낸다 — 미설정(NULL)은 꺼짐(옵트인). 신규 가입 기본값(스키마 trigger)이 false이므로 같은 방향이다.
이전에는 잡마다 `is not False`(NULL=켜짐)와 `.get(..., False)`(NULL=꺼짐)가 섞여 있었다. 운영 DB에는 NULL 행이 없어 영향은 없었지만,
NULL이 생기면(수동 SQL·컬럼 추가 후 백필 누락) 어떤 알림은 가고 어떤 알림은 안 가는 불일치가 난다.
"""
import os
import re

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCAN_DIRS = ("scheduler", "services", "routers")
# 한 번 보낸 과거 일회성 안내 — 반복 알림이 아니고 이미 발송이 끝나 바꾸지 않는다
HISTORICAL_ONE_TIME = {os.path.join("services", "score_model_migration_notice.py")}

NULL_ON = re.compile(r"kakao_(?:scan|competitor)_notify[^\n]*(?:is not False|is False|!= False|== False)")


def _is_stray_copy(rel: str) -> bool:
    """서버에 남은 추적·임포트되지 않는 옛 복사본(services/ai_scanner_deploy_tmp, 2026-08-08)은 실행되지 않으므로 제외 — 다른 시험들과 같은 관례."""
    return "_deploy_tmp" in rel.replace("\\", "/")


def _sources():
    for d in SCAN_DIRS:
        for root, _, files in os.walk(os.path.join(BACKEND, d)):
            for name in files:
                if name.endswith(".py"):
                    path = os.path.join(root, name)
                    rel = os.path.relpath(path, BACKEND)
                    if rel in HISTORICAL_ONE_TIME or _is_stray_copy(rel):
                        continue
                    yield rel, open(path, encoding="utf-8").read()


def test_stray_server_copies_are_skipped_but_real_code_is_not():
    assert _is_stray_copy(os.path.join("services", "ai_scanner_deploy_tmp", "jobs.py"))
    assert not _is_stray_copy(os.path.join("scheduler", "jobs.py")) and not _is_stray_copy(os.path.join("services", "ai_scanner", "gemini_scanner.py"))
    assert any(rel.replace("\\", "/") == "scheduler/jobs.py" for rel, _ in _sources())   # 제외 규칙이 진짜 코드를 가리지 않는다


def test_no_recurring_notification_treats_null_as_on():
    offenders = [(rel, i + 1, line.strip()[:120]) for rel, src in _sources() for i, line in enumerate(src.splitlines()) if NULL_ON.search(line)]
    assert offenders == [], offenders


def test_the_pattern_actually_catches_the_old_styles():
    for old in ('x.get("kakao_scan_notify") is not False', 'if profile.get("kakao_scan_notify") is False:',
                'if not phone or profile.get("kakao_competitor_notify") is False:'):
        assert NULL_ON.search(old), old
    for ok in ('x.get("kakao_scan_notify") is True', 'if profile.get("kakao_scan_notify") is not True:'):
        assert not NULL_ON.search(ok), ok


def test_signup_default_is_still_off():
    """옵트인 해석은 신규 가입 기본값이 false일 때만 일관된다 — 스키마의 기본값 변경이 되돌려지면 알려 준다."""
    sql = open(os.path.join(os.path.dirname(BACKEND), "scripts", "supabase_schema.sql"), encoding="utf-8").read()
    assert re.search(r"ALTER COLUMN kakao_scan_notify\s+SET DEFAULT false", sql)
    assert re.search(r"ALTER COLUMN kakao_competitor_notify SET DEFAULT false", sql)
