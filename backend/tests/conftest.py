"""테스트 공통 설정 — 실제 운영 상태 파일을 건드리지 않게 격리 (2026-10-27).

네이버 접속 보호 모듈은 상태를 파일에 저장한다(재시작해도 이어지도록).
  - 상한 카운터: backend/.naver_quota_state.json (+ _history.jsonl)
  - 플레이스 접속 회로 차단기: backend/.naver_place_breaker.json
서버에서 pytest를 돌릴 때 테스트용 값(상한 10 등)이 **실제 운영 카운터·차단 상태를 덮어쓰지 않도록**
모든 테스트가 임시 경로를 쓰게 한다.
"""
import pytest


@pytest.fixture(autouse=True)
def _isolate_naver_state_files(tmp_path, monkeypatch):
    monkeypatch.setenv("NAVER_QUOTA_STATE_FILE", str(tmp_path / "quota_state.json"))
    monkeypatch.setenv("NAVER_PLACE_BREAKER_FILE", str(tmp_path / "place_breaker.json"))
    monkeypatch.setenv("NAVER_RATE_WINDOW_FILE", str(tmp_path / "rate_window.json"))
    monkeypatch.setenv("COMPETITOR_PLACE_CACHE_FILE", str(tmp_path / "competitor_cache.json"))
    monkeypatch.setenv("NAVER_SEARCH_BREAKER_FILE", str(tmp_path / "search_breaker.json"))
    from services import naver_access_guard as _g
    from services import competitor_place_crawler as _cc
    _cc.reset_cache_for_tests()
    _g.reset_rate_for_tests()
    _g.reset_search_for_tests()
    _g.reset_for_tests()
    yield
    _g.reset_rate_for_tests()
    _g.reset_search_for_tests()
    _cc.reset_cache_for_tests()


@pytest.fixture(autouse=True)
def _never_upload_gap_card_to_real_storage(monkeypatch):
    """알림 함수(jobs._send_kakao_notifications) 5단계는 갭 카드 PNG를 만들어 Supabase Storage(before-after 버킷)에 올린다.
    서버처럼 환경변수가 로드된 곳에서 테스트가 돌면 가짜 사업장 ID로 운영 Storage에 파일이 생기므로 모든 테스트에서 업로드를 막는다
    (2026-11-02: 서버 Storage를 읽기 전용으로 확인해 지금까지 올라간 파일은 없었다 — 우연히 안 올라갔을 뿐 막는 장치는 없었다).
    """
    import services.gap_card as _gc

    async def _stub(*a, **k):
        return None

    monkeypatch.setattr(_gc, "generate_and_upload_gap_card", _stub)


@pytest.fixture(autouse=True)
def _isolate_naver_kill_switch(tmp_path, monkeypatch):
    """킬스위치(서버의 .naver_kill_switch 파일·NAVER_ACCESS_KILL_SWITCH 환경변수)가 실제로 켜진 긴급 상황에서도 테스트가 그 영향을 받지 않게 한다.
    격리하지 않으면 킬스위치를 켠 채 배포 스크립트의 서버 테스트가 돌 때 '접속이 허용돼야 하는' 테스트가 전부 실패해 긴급 수정 배포가 막힌다."""
    monkeypatch.setenv("NAVER_KILL_SWITCH_FILE", str(tmp_path / "no_kill_switch"))
    monkeypatch.delenv("NAVER_ACCESS_KILL_SWITCH", raising=False)
