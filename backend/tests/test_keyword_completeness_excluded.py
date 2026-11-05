"""키워드 충족도 게이지(/guide/{id}/keyword-completeness)는 사장님이 '제외'한 키워드를 추천·분모에서 뺀다.

2026-11-05: 마사지샵에서 '스웨디시'를 제외했는데도 이 엔드포인트가 excluded_keywords를 읽지 않아 게이지에 계속 추천됐다.
"""
import asyncio
from types import SimpleNamespace

import middleware.plan_gate as pg
import routers.guide as guide


def _run(monkeypatch, biz_row):
    async def fake_execute(q, *a, **k):
        return SimpleNamespace(data=biz_row)

    async def fake_plan(uid, supabase):
        return "pro"

    async def ok(*a, **k):
        return None

    class _Q:
        def __getattr__(self, name):
            return lambda *a, **k: self

    class _SB:
        def table(self, name):
            return _Q()

    monkeypatch.setattr(guide, "get_client", lambda: _SB())
    monkeypatch.setattr(guide, "execute", fake_execute)
    monkeypatch.setattr(guide, "_verify_biz_ownership", ok)
    monkeypatch.setattr(pg, "get_user_plan", fake_plan)
    return asyncio.run(guide.get_keyword_completeness("b1", {"id": "u1"}))


def _all_missing(out):
    return [k for c in out["categories"] for k in c["missing"]]


def test_excluded_keyword_is_not_recommended(monkeypatch):
    base = {"category": "massage", "keywords": ["상남동마사지"], "excluded_keywords": [], "blog_analysis_json": None}
    assert "스웨디시" in _all_missing(_run(monkeypatch, dict(base)))  # 전제: 제외 전에는 추천됨
    out = _run(monkeypatch, dict(base, excluded_keywords=["스웨디시"]))
    assert "스웨디시" not in _all_missing(out)
    assert "스웨디시" not in out["top_missing"]


def test_exclusion_ignores_spacing_and_case_and_none_values(monkeypatch):
    base = {"category": "massage", "keywords": [], "blog_analysis_json": None}
    out = _run(monkeypatch, dict(base, excluded_keywords=[" 스웨 디시 ", None, 3, ""]))
    assert "스웨디시" not in _all_missing(out)
    out2 = _run(monkeypatch, dict(base, excluded_keywords=None))  # NULL 컬럼도 안전
    assert "스웨디시" in _all_missing(out2)


def test_excluded_keyword_leaves_the_denominator(monkeypatch):
    # 제외하면 '부족'으로 세지 않는다 — 분모에서도 빠져 충족률이 부당하게 낮아지지 않는다
    base = {"category": "massage", "keywords": [], "blog_analysis_json": None}
    before = sum(len(c["missing"]) + len(c["covered"]) for c in _run(monkeypatch, dict(base, excluded_keywords=[]))["categories"])
    after = sum(len(c["missing"]) + len(c["covered"]) for c in _run(monkeypatch, dict(base, excluded_keywords=["스웨디시"]))["categories"])
    assert after == before - 1
