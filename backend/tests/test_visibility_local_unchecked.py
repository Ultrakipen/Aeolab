"""지역검색 API 조회 실패를 '스마트플레이스 미등록'으로 돌려주지 않는지 검증 (2026-11-01, 작업 T-7).

배경: naver_visibility._get은 실패(키 오류·429·타임아웃)하면 {}를 돌려주고, 예전에는 이것이 is_smart_place=False로
이어져 체험 이메일에 "미등록 (필수)"가 찍히고 trial_scans에 False가 저장됐다. blog에는 blog_checked가 있었지만 local에는 없었다.
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import services.blog_mention_verifier as bmv  # noqa: E402
import services.naver_visibility as nv  # noqa: E402

_REGISTERED = {"items": [{"title": "<b>테스트식당</b>", "roadAddress": "서울 성동구 성수동", "category": "음식점>한식", "link": "https://x"}]}
_OTHER = {"items": [{"title": "다른가게", "roadAddress": "서울 성동구 성수동", "category": "음식점>한식", "link": "https://y"}]}


def _patch(monkeypatch, local_factory):
    async def fake_get(kind, params):
        return local_factory(kind, params) if kind == "local" else {}

    async def fake_verified(*_a, **_k):
        return {"count": 0, "api_total": 0, "kw_counts": {}, "capped": False}

    monkeypatch.setattr(nv, "_get", fake_get)
    monkeypatch.setattr(bmv, "fetch_verified_blog", fake_verified)


def _vis():
    return asyncio.run(nv.get_naver_visibility("테스트식당", "맛집", "서울 성동구"))


def test_api_failure_is_unknown_not_unregistered(monkeypatch):
    _patch(monkeypatch, lambda k, p: {})            # _get의 실패 반환값
    r = _vis()
    assert r["is_smart_place"] is None and r["local_checked"] is False
    assert r["my_rank"] is None


def test_checked_and_absent_is_false(monkeypatch):
    _patch(monkeypatch, lambda k, p: _OTHER)
    r = _vis()
    assert r["is_smart_place"] is False and r["local_checked"] is True     # 조회했고 없다 = 측정된 사실


def test_empty_result_list_is_still_a_successful_lookup(monkeypatch):
    _patch(monkeypatch, lambda k, p: {"items": []})
    r = _vis()
    assert r["is_smart_place"] is False and r["local_checked"] is True


def test_found_is_true(monkeypatch):
    _patch(monkeypatch, lambda k, p: _REGISTERED)
    r = _vis()
    assert r["is_smart_place"] is True and r["my_rank"] == 1 and r["local_checked"] is True


def test_main_query_failed_but_fallback_found_registration(monkeypatch):
    calls = {"n": 0}

    def local(kind, params):
        calls["n"] += 1
        return {} if calls["n"] <= 2 else _REGISTERED     # 메인 두 번(sim/comment)은 실패, 폴백에서 확인

    _patch(monkeypatch, local)
    r = _vis()
    assert r["is_smart_place"] is True and r["local_checked"] is True


def test_multi_uses_any_keyword_that_confirmed_registration(monkeypatch):
    async def fake_single(name, kw, region):
        if kw == "a":
            return {"my_rank": None, "blog_mentions": 5, "blog_checked": True, "search_query": "a",
                    "is_smart_place": None, "local_checked": False}      # best로 뽑힐 키워드가 조회 실패
        return {"my_rank": None, "blog_mentions": 1, "blog_checked": True, "search_query": "b",
                "is_smart_place": True, "local_checked": True}

    monkeypatch.setattr(nv, "get_naver_visibility", fake_single)
    r = asyncio.run(nv.get_naver_visibility_multi("x", ["a", "b"], "성동구"))
    assert r["is_smart_place"] is True and r["local_checked"] is True


def test_multi_all_unchecked_stays_unknown(monkeypatch):
    async def fake_single(name, kw, region):
        return {"my_rank": None, "blog_mentions": 0, "blog_checked": True, "search_query": kw,
                "is_smart_place": None, "local_checked": False}

    monkeypatch.setattr(nv, "get_naver_visibility", fake_single)
    r = asyncio.run(nv.get_naver_visibility_multi("x", ["a", "b"], "성동구"))
    assert r["is_smart_place"] is None and r["local_checked"] is False


def test_unknown_registration_does_not_inflate_or_crash_scoring():
    """None은 점수 쪽에서 False와 같게 취급돼 기존 계산이 그대로다(소비처가 truthiness만 본다)."""
    from services.score_engine import calc_smart_place_completeness
    base = {"is_smart_place": False, "my_rank": None}
    unknown = {"is_smart_place": None, "my_rank": None}
    assert calc_smart_place_completeness(unknown, {}) == calc_smart_place_completeness(base, {})
