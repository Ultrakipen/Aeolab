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
    from services import naver_access_guard as _g
    from services import competitor_place_crawler as _cc
    _cc.reset_cache_for_tests()
    _g.reset_rate_for_tests()
    yield
    _g.reset_rate_for_tests()
    _cc.reset_cache_for_tests()
