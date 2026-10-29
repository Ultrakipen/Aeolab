"""AI탭 질의 수 설정 (2026-10-29) — 기본값은 기존 동작(4)이고, 환경변수로만 줄어든다."""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.ai_scanner import naver_ai_tab_scanner as tab  # noqa: E402

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def test_default_is_four_so_nothing_changes_until_configured(monkeypatch):
    monkeypatch.delenv("NAVER_AI_TAB_MAX_QUERIES", raising=False)
    assert tab.ai_tab_max_queries() == 4


@pytest.mark.parametrize("raw,expected", [("2", 2), ("1", 1), ("4", 4), ("9", 4), ("0", 4), ("-3", 4), ("abc", 4), ("", 4)])
def test_values_are_clamped_and_invalid_falls_back_to_default(monkeypatch, raw, expected):
    monkeypatch.setenv("NAVER_AI_TAB_MAX_QUERIES", raw)
    assert tab.ai_tab_max_queries() == expected


def test_both_scan_paths_use_the_setting():
    """스캔 본체와 배치 함수가 하드코딩 4가 아니라 설정을 읽는다 — 되돌리면 설정이 조용히 무시된다."""
    multi = open(os.path.join(_ROOT, "services", "ai_scanner", "multi_scanner.py"), encoding="utf-8").read()
    batch = open(os.path.join(_ROOT, "services", "ai_scanner", "naver_ai_tab_scanner.py"), encoding="utf-8").read()
    assert "_queries[:_naver_ai_tab.ai_tab_max_queries()]" in multi
    assert "queries[:ai_tab_max_queries()]" in batch
    assert "_queries[:4]:" not in multi
