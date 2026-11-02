"""CLAUDE.md의 AI 모델·단가 표가 코드와 어긋나지 않게 막는다 (2026-11-02).

11-01에 ChatGPT 모델을 gpt-4.1-mini→gpt-6-luna로, 서버 Gemini를 gemini-3.1-flash-lite(무료 등급)로 바꿨는데 기술 스택 표·스캐너 표·비용 표는 옛 모델을 그대로 말하고 있었다.
같은 문서를 읽고 판단하는 사람(과 AI)이 틀린 단가·모델로 비용·측정 방식을 가늠하게 되므로, 코드가 가진 값(기본 모델·단가표)과 문서 표를 대조한다.
CLAUDE.md는 저장소 루트에 있다 — 서버에서 이 시험을 돌리기 전에 서버의 CLAUDE.md도 최신이어야 한다.
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOC = open(os.path.join(os.path.dirname(ROOT), "CLAUDE.md"), encoding="utf-8").read()


def _row(prefix: str) -> str:
    rows = [ln for ln in DOC.splitlines() if ln.startswith(prefix)]
    assert len(rows) == 1, (prefix, len(rows))
    return rows[0]


def test_stack_table_names_the_models_the_code_actually_defaults_to():
    from services.ai_scanner.chatgpt_scanner import CHATGPT_MODEL
    row = _row("| AI 스캔(측정)")
    assert CHATGPT_MODEL in row                                                         # 코드 기본 ChatGPT 모델
    assert "gemini-3.1-flash-lite" in row and "무료 등급" in row                        # 서버가 쓰는 Gemini(환경변수) — 코드 기본값과 다르다는 것도 문서가 밝힌다
    assert "gpt-4.1-mini" not in row and "Basic 자동 50/50 분할" not in row             # 옛 값·옛 서술


def test_generation_row_lists_the_real_claude_models_and_says_they_do_not_score():
    from services import ai_usage_logger
    row = _row("| AI 가이드·생성")
    assert "claude-sonnet-4-6" in row and "claude-haiku-4-5-20251001" in row
    assert ("claude", "claude-sonnet-4-6") in ai_usage_logger._PRICES_PER_1M_USD and ("claude", "claude-haiku-4-5-20251001") in ai_usage_logger._PRICES_PER_1M_USD
    assert "점수에는 관여하지 않는다" in row


def test_scanner_table_uses_current_model_names():
    assert re.search(r"^\| ChatGPT `gpt-6-luna`", DOC, re.M) and re.search(r"^\| Gemini \(`GEMINI_MODEL`", DOC, re.M)
    assert "| Gemini 2.5 Flash |" not in DOC and "| ChatGPT gpt-4.1-mini |" not in DOC


def test_cost_table_unit_prices_match_the_codes_price_table():
    from services import ai_usage_logger
    from services.ai_scanner.chatgpt_scanner import CHATGPT_MODEL
    prices = ai_usage_logger._PRICES_PER_1M_USD
    p = prices[("chatgpt", CHATGPT_MODEL)]
    row = _row("| OpenAI `gpt-6-luna`")
    assert f"${p['in']:.2f}/1M in" in row and f"${p['out']:.2f}/1M out" in row            # 문서 단가 = 코드 단가표
    s, h = prices[("claude", "claude-sonnet-4-6")], prices[("claude", "claude-haiku-4-5-20251001")]
    crow = _row("| Claude Sonnet 4.6 / Haiku 4.5")
    for want in (f"${s['in']:g}/1M in", f"${s['out']:g}/1M out", f"${h['in']:g}/1M in", f"${h['out']:g}/1M out"):
        assert want in crow, want


def test_the_free_tier_gemini_is_documented_as_having_no_price_entry():
    """단가표에 없는 모델은 비용이 None으로 기록된다 — 그 사실을 문서가 말하고, 코드의 단가표에도 실제로 없어야 한다(생기면 문서를 고칠 것)."""
    from services import ai_usage_logger
    assert not any(model == "gemini-3.1-flash-lite" for (_, model) in ai_usage_logger._PRICES_PER_1M_USD)
    assert "단가표에 없어 `ai_usage_log` 비용 None" in _row("| Gemini `gemini-3.1-flash-lite`")
