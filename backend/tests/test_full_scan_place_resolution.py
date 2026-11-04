"""가입 후 1회 체험(_run_full_scan)이 플레이스 ID를 확정하려면 사업장 주소가 필요하다 (2026-11-04 라이브 검증에서 발견).

사고: _run_full_scan의 businesses 조회 컬럼에 address가 없어 resolve_naver_place가 주소 없이 불렸고, 이름이 정확히 한 곳과 일치해도
status="unverified"(주소를 비교할 수 없어 확정하지 않음)가 되어 ID가 저장되지 않았다. 그 결과 소개글·소식·리뷰·키워드 순위 점검이 통째로 건너뛰어졌고
유명 가게(어니언 성수)도 리뷰 0·소개글 없음으로 보여 "스마트플레이스 등록이 가장 먼저" 같은 가이드가 나왔다.
(야간 스캔 jobs.py는 select("*")라 영향 없었다.)
"""
import asyncio
import os
import re
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ADDR = "서울특별시 성동구 아차산로9길 8 1, 2층"
PAGE_WITH_ADDR = "어니언 성수\n주소\n서울 성동구 아차산로9길 8 1, 2층\n지도"


def _scan_source() -> str:
    with open(os.path.join(ROOT, "routers", "scan.py"), encoding="utf-8") as f:
        return f.read()


def test_run_full_scan_business_select_includes_address():
    src = _scan_source()
    start = src.index("async def _run_full_scan")
    m = re.search(r'\.select\("([^"]+)"\)', src[start:])
    assert m, "_run_full_scan의 businesses select를 찾지 못했다"
    cols = [c.strip() for c in m.group(1).split(",")]
    assert "address" in cols, "address가 없으면 플레이스 ID가 확정되지 않아 점검이 통째로 건너뛰어진다"
    # ensure_naver_place_id가 읽는 컬럼이 모두 있어야 한다
    for needed in ("id", "name", "region", "address", "naver_place_id", "naver_place_url"):
        assert needed in cols, needed


@pytest.fixture
def rv(monkeypatch):
    import services.naver_place_resolver as m
    import services.ai_scanner as ai

    monkeypatch.setattr(ai, "check_naver_playwright_quota", lambda *a, **k: True)
    if hasattr(m._cache, "clear"):
        m._cache.clear()

    async def _cards(query):
        return [{"id": "38561949", "text": "어니언 성수"}]

    async def _page(pid):
        return PAGE_WITH_ADDR

    monkeypatch.setattr(m, "_collect_cards", _cards)
    monkeypatch.setattr(m, "_fetch_place_page_text", _page)
    return m


def test_unique_name_with_address_is_confirmed(rv):
    r = asyncio.run(rv.resolve_naver_place("어니언 성수", "서울 성동구", ADDR))
    assert r["status"] == "unique" and r["naver_place_id"] == "38561949"


def test_unique_name_without_address_is_not_confirmed(rv):
    """주소가 없으면 확정하지 않는 것이 올바른 동작이다(다른 지점을 고르는 오탐 방지) — 그래서 호출처가 주소를 넘겨야 한다."""
    r = asyncio.run(rv.resolve_naver_place("어니언 성수", "서울 성동구", ""))
    assert r["status"] == "unverified" and r["naver_place_id"] is None


def test_ensure_naver_place_id_passes_the_address_to_the_resolver(rv, monkeypatch):
    import db.supabase_client as dbc

    seen = {}

    async def _resolve(name, region="", address=""):
        seen["address"] = address
        return {"status": "unique", "naver_place_id": "38561949", "naver_place_url": "u", "matched_name": name, "candidates": []}

    async def _exec(q):
        return None

    class _T:
        def update(self, *a, **k):
            return self

        def eq(self, *a, **k):
            return self

    class _C:
        def table(self, *_):
            return _T()

    monkeypatch.setattr(rv, "resolve_naver_place", _resolve)
    monkeypatch.setattr(dbc, "get_client", lambda: _C())
    monkeypatch.setattr(dbc, "execute", _exec)
    biz = {"id": "b1", "name": "어니언 성수", "region": "서울 성동구", "address": ADDR}
    assert asyncio.run(rv.ensure_naver_place_id(biz)) == "38561949"
    assert seen["address"] == ADDR
