"""네이버 차단 감지가 그날 스캔 전체를 멈추지 않는다 (2026-10-29).

예전에는 캡차 연속 2회에 야간 스캔 루프를 break해, 남은 사업장의 글로벌 AI 스캔·점수·알림이 통째로 빠졌고
현재 사업장의 이미 끝난 AI 스캔 결과도 저장되지 않았다. 지금은 검색 화면 쿨다운이 네이버 접속을 막아 주므로
알림만 한 번 보내고 스캔은 이어간다.
"""
import inspect
import re

import scheduler.jobs as jobs


def _captcha_block() -> str:
    src = inspect.getsource(jobs.daily_scan_all)
    i = src.index("_naver_captcha_count += 1")
    j = src.index("_naver_captcha_count = 0  # 정상 응답 시 카운터 리셋")
    return src[i:j]


def test_captcha_streak_does_not_break_the_scan_loop():
    block = _captcha_block()
    assert not re.search(r"^\s*break\s*$", block, re.M), "차단 감지로 루프를 끊으면 남은 사업장의 스캔 전체가 빠진다"
    assert "send_slack_alert" in block                       # 운영자 알림은 유지
    assert "== 2" in block                                   # 같은 차단에 알림이 반복되지 않는다(연속 N회마다가 아니라 한 번)


def test_cooldown_makes_naver_measurement_a_no_network_unmeasured_result():
    """break를 없애도 안전한 이유 — 쿨다운 중 네이버 측정은 요청 없이 '측정 불가'로 끝난다(미노출 아님)."""
    from services.ai_scanner.naver_scanner import NaverAIBriefingScanner as S
    from services.score_engine import _is_naver_unmeasured
    r = S._search_cooldown_result("성수 카페")
    assert r["error"] == "naver_search_cooldown" and r["mentioned"] is False
    assert _is_naver_unmeasured({"naver": r}) is True        # 점수에서 제외 후 재정규화, 0점 아님


def test_scanner_opens_cooldown_on_captcha_and_checks_it_before_any_request():
    import services.ai_scanner.naver_scanner as ns
    src = inspect.getsource(ns)
    assert 'report_search_block("naver_scanner._check_single_page")' in src
    check = inspect.getsource(ns.NaverAIBriefingScanner.check_mention)
    assert check.index("begin_search_access") < check.index("async_playwright")      # 접속 전에 쿨다운 검사
