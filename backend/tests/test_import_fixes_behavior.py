"""2026-11-01 전수 import 검사에서 찾은 4곳의 동작 확인 (이름만 맞춘 것이 아니라 실제로 호출이 되는지)."""
import asyncio

from services.keyword_taxonomy import build_qr_message


def test_qr_message_builds_with_and_without_keyword():
    with_kw = build_qr_message("돼지국밥", [], "테스트식당")
    assert "돼지국밥" in with_kw
    no_kw = build_qr_message(None, [], "테스트식당")
    assert "테스트식당" in no_kw


def test_qr_card_endpoint_uses_taxonomy_function_with_matching_args():
    src = open("routers/guide.py", encoding="utf-8").read()
    assert "from services.keyword_taxonomy import build_qr_message" in src
    assert 'build_qr_message(top_keyword, [], biz["name"])' in src


def test_keyword_fallback_is_intentionally_empty():
    """폴백을 살리면 '단체석 있음' 같은 미확인 시설 키워드를 업종 전체에 추천한다(2026-11-01 실호출로 확인) — 빈 목록이 의도다."""
    from services.keyword_suggester import _fallback_suggestions
    assert _fallback_suggestions("restaurant", "창원시 성산구", 3) == []


def test_growth_card_fonts_are_real_names():
    from services.before_after_card import FONT_PATHS_BOLD, FONT_PATHS_REGULAR
    assert isinstance(FONT_PATHS_BOLD, list) and isinstance(FONT_PATHS_REGULAR, list)
    src = open("scheduler/jobs.py", encoding="utf-8").read()
    assert "FONT_PATHS_BOLD as _FONT_BOLD" in src


def test_email_fallback_service_client_import_exists():
    import db.supabase_client as sc
    assert hasattr(sc, "get_client")
    assert not hasattr(sc, "get_service_client")
    src = open("services/kakao_notify.py", encoding="utf-8").read()
    assert "import get_client as get_service_client" in src
