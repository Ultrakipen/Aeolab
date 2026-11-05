"""사장님이 '제외'한 키워드는 소개글 초안의 연관(LSI) 키워드에서 빠진다.

2026-11-05: 설정 화면은 "제외한 키워드는 모든 분석에서 빠집니다"라고 약속하지만 소개글 생성은 업종 풀 앞 8개를
제외와 무관하게 프롬프트에 넣었다(마사지 풀 첫 항목이 '스웨디시'). 소개글은 사장님이 그대로 게시하는 텍스트다.
"""
import asyncio
import pathlib
import re
from types import SimpleNamespace

import pytest

import services.guide_generator as gg
from services.keyword_taxonomy import drop_excluded, get_all_keywords_flat

ROOT = pathlib.Path(__file__).resolve().parents[1]


# ── drop_excluded ───────────────────────────────────────────────────────────────
def test_drop_excluded_ignores_spacing_case_and_bad_values():
    assert drop_excluded(["스웨디시", "타이마사지", "Deep Tissue"], [" 스웨 디시 ", None, 3, "", "deeptissue"]) == ["타이마사지"]


def test_drop_excluded_keeps_order_and_is_noop_without_exclusions():
    kws = ["b", "a", "c"]
    assert drop_excluded(kws, None) == kws
    assert drop_excluded(kws, []) == kws
    assert drop_excluded(kws, ["a"]) == ["b", "c"]
    assert drop_excluded(None, ["a"]) == []


# ── generate_naver_intro 프롬프트 ───────────────────────────────────────────────
def _lsi_line(monkeypatch, **kw):
    seen = {}

    async def fake_create(**k):
        seen["prompt"] = k["messages"][0]["content"]
        return SimpleNamespace(content=[SimpleNamespace(text="소개글 [2026년 11월 기준]")],
                               usage=SimpleNamespace(input_tokens=1, output_tokens=1))

    monkeypatch.setattr(gg, "_create_message_with_retry", fake_create)
    monkeypatch.setattr(gg, "log_ai_usage", lambda *a, **k: None)
    asyncio.run(gg.generate_naver_intro("테스트마사지", "마사지", "창원", ["아로마마사지"], category="massage", **kw))
    line = next(l for l in seen["prompt"].splitlines() if "LSI 연관 키워드" in l)
    return line.split(":", 1)[1].strip()


def test_excluded_keyword_is_not_sent_to_the_intro_prompt(monkeypatch):
    base = _lsi_line(monkeypatch)
    assert "스웨디시" in base  # 전제: 제외가 없으면 업종 풀 1순위로 들어간다
    out = _lsi_line(monkeypatch, excluded_keywords=["스웨디시"])
    assert "스웨디시" not in out


def test_lsi_count_is_kept_by_filling_with_next_candidates(monkeypatch):
    out = _lsi_line(monkeypatch, excluded_keywords=["스웨디시"])
    assert len([k for k in out.split(",") if k.strip()]) == 8
    assert drop_excluded(get_all_keywords_flat("massage"), ["스웨디시"])[0] in out


def test_explicit_lsi_list_is_filtered_too(monkeypatch):
    out = _lsi_line(monkeypatch, lsi_keywords=["스웨디시", "타이마사지"], excluded_keywords=["스웨디시"])
    assert out == "타이마사지"


def test_no_exclusion_leaves_prompt_unchanged(monkeypatch):
    a = _lsi_line(monkeypatch)
    b = _lsi_line(monkeypatch, excluded_keywords=[])
    c = _lsi_line(monkeypatch, excluded_keywords=None)
    assert a == b == c


# ── 라우터 연결(구조) ───────────────────────────────────────────────────────────
BIZ = (ROOT / "routers" / "business.py").read_text(encoding="utf-8")


def test_intro_route_reads_and_passes_excluded_keywords():
    assert re.search(r'_intro_biz_cols = "[^"]*excluded_keywords', BIZ)
    assert BIZ.count('excluded_keywords=biz.get("excluded_keywords")') == 2  # 최초 생성 + D.I.A. 재생성
    assert 'drop_excluded(get_all_keywords_flat(biz.get("category", "other")), biz.get("excluded_keywords"))[:8]' in BIZ
