"""키워드 순위 수동 측정(POST /api/scan/keyword-rank)은 구독 기능이다 (2026-11-08).

랜딩은 "무료 진단은 1회, 구독하면 재측정"이라 안내하는데 이 라우터에는 요금제 검사가 없어 무료 계정이 반복 측정할 수 있었다.
- 무료 플랜: 403 PLAN_REQUIRED, 시간당 횟수(_keyword_rank_calls)를 소모하지 않고 측정 함수도 부르지 않는다.
- 유료 플랜: 게이트를 통과해 측정까지 간다.
"""
import asyncio
import types

import pytest
from fastapi import HTTPException

import routers.scan as scan


class _Res:
    def __init__(self, data):
        self.data = data


def _setup(monkeypatch, plan, calls):
    biz = {"id": "b1", "user_id": "u1", "name": "가게", "naver_place_id": None, "keywords": ["카페"], "region": "창원"}

    async def fake_execute(q, *a, **k):
        return _Res(biz)

    class _Q:
        def __getattr__(self, name):
            return lambda *a, **k: self

    class _SB:
        def table(self, name):
            return _Q()

    async def fake_plan(uid, sb):
        return plan

    async def fake_measure(**kwargs):
        calls.append(kwargs)
        raise RuntimeError("측정 함수에 도달")  # 게이트 통과 확인용 — 뒤 단계는 실행하지 않는다

    monkeypatch.setattr(scan, "get_client", lambda: _SB())
    monkeypatch.setattr(scan, "execute", fake_execute)
    monkeypatch.setattr(scan, "_get_user_plan", fake_plan)
    import services.naver_keyword_rank as nkr
    monkeypatch.setattr(nkr, "measure_keywords", fake_measure)
    scan._keyword_rank_calls.pop("u1", None)


def _run():
    req = scan.KeywordRankScanRequest(biz_id="b1")
    return asyncio.run(scan.keyword_rank_scan(req, user={"id": "u1"}))


def test_free_plan_is_blocked_before_any_naver_access(monkeypatch):
    calls = []
    _setup(monkeypatch, "free", calls)
    with pytest.raises(HTTPException) as e:
        _run()
    assert e.value.status_code == 403 and e.value.detail["code"] == "PLAN_REQUIRED"
    assert calls == []                                   # 네이버 측정 함수를 부르지 않았다
    assert scan._keyword_rank_calls.get("u1") in (None, [])   # 시간당 횟수도 소모하지 않았다


@pytest.mark.parametrize("plan", ["basic", "startup", "pro", "biz"])
def test_paid_plans_pass_the_gate(monkeypatch, plan):
    calls = []
    _setup(monkeypatch, plan, calls)
    with pytest.raises(RuntimeError):
        _run()
    assert len(calls) == 1
