"""사전 스캔 재사용 시 서버의 중복 네이버 브리핑 접속 생략 테스트 (2026-10-27, 설계 문서 §3 B).

스캐너를 스텁으로 바꿔 skip_naver가 실제로 네이버 접속(check_mention)을 하지 않는지, 기본 경로는 그대로인지 확인한다.
"""
import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import services.ai_scanner.multi_scanner as ms  # noqa: E402


class _Spy:
    def __init__(self):
        self.calls = []


def _scanner(spy):
    class _LLM:
        async def sample_n(self, *a, **k):
            return {"platform": "gemini", "exposure_freq": 1, "sample_size": 100}

        async def sample_50(self, *a, **k):
            return {"platform": "gemini", "exposure_freq": 1, "sample_size": 50}

        async def sample_recommend(self, *a, **k):
            return {"platform": "chatgpt", "exposure_freq": 2, "sample_size": 100}

    class _Naver:
        async def check_mention(self, q, t):
            spy.calls.append("naver")
            return {"platform": "naver", "mentioned": True}

    class _Google:
        async def check_mention(self, q, t):
            spy.calls.append("google")
            return {"platform": "google", "mentioned": False}

    m = ms.MultiAIScanner.__new__(ms.MultiAIScanner)
    m.mode = "full"
    m.gemini, m.chatgpt, m.naver, m.google = _LLM(), _LLM(), _Naver(), _Google()
    return m


@pytest.fixture(autouse=True)
def _no_real_sleep(monkeypatch):
    real_sleep = asyncio.sleep

    async def fast(_sec, *a, **k):
        await real_sleep(0)

    monkeypatch.setattr(ms.asyncio, "sleep", fast)
    monkeypatch.delenv("NAVER_AI_TAB_ENABLED", raising=False)
    monkeypatch.delenv("NAVER_MULTICH_ENABLED", raising=False)


def test_scan_all_default_still_calls_naver():
    spy = _Spy()
    res = asyncio.run(_scanner(spy).scan_all(["성수 카페 추천"], "어니언 성수"))
    assert "naver" in spy.calls and "google" in spy.calls
    assert res["naver"]["mentioned"] is True


def test_scan_all_skip_naver_makes_no_naver_request():
    spy = _Spy()
    res = asyncio.run(_scanner(spy).scan_all(["성수 카페 추천"], "어니언 성수", skip_naver=True))
    assert "naver" not in spy.calls                 # 네이버 접속 없음
    assert "google" in spy.calls                    # 다른 채널은 그대로
    assert "naver" not in res and "google" in res and "gemini" in res and "chatgpt" in res


def test_scan_basic_default_calls_naver_and_skip_does_not():
    spy = _Spy()
    asyncio.run(_scanner(spy).scan_basic(["성수 카페 추천"], "어니언 성수"))
    assert "naver" in spy.calls

    spy2 = _Spy()
    res = asyncio.run(_scanner(spy2).scan_basic(["성수 카페 추천"], "어니언 성수", skip_naver=True))
    assert "naver" not in spy2.calls
    assert res["naver"] is None                     # 호출자(daily_scan_all)가 사전 스캔 결과로 채운다


def test_prescan_usable_rule():
    """실제 판정 함수(services/naver_prescan.py)를 검증한다 — 야간 스캔과 수동 스캔이 같은 함수를 쓴다."""
    from services.naver_prescan import prescan_usable as usable

    assert usable({"mentioned": True, "in_briefing": False}) is True
    assert usable({"mentioned": False}) is True      # 정상 측정에서 '노출 안 됨'은 쓸 수 있는 결과다
    assert usable({}) is False                       # 결과 없음 → 서버가 직접 측정
    assert usable(None) is False
    assert usable({"captcha_detected": True}) is False
    assert usable({"error": "page_load_failed"}) is False
    assert usable({"quota_skipped": True}) is False


def test_scan_quick_default_calls_naver_and_skip_does_not():
    class _Chat:
        async def sample_5(self, q, t):
            return {"platform": "chatgpt", "mentioned": True}

    spy = _Spy()
    m = _scanner(spy)
    m.chatgpt = _Chat()
    res = asyncio.run(m.scan_quick("성수 카페 추천", "어니언 성수"))
    assert "naver" in spy.calls and res["naver"]["mentioned"] is True

    spy2 = _Spy()
    m2 = _scanner(spy2)
    m2.chatgpt = _Chat()
    res2 = asyncio.run(m2.scan_quick("성수 카페 추천", "어니언 성수", skip_naver=True))
    assert "naver" not in spy2.calls                 # 네이버 접속 없음
    assert "naver" not in res2 and res2["chatgpt"]["mentioned"] is True   # 다른 채널은 그대로


def test_manual_scan_paths_and_nightly_use_the_shared_rule():
    """수동 스캔 두 경로(quick·full)와 야간 스캔이 모두 같은 판정으로 서버 접속을 생략한다 — 한 곳이라도 빠지면 접속이 중복된다."""
    root = os.path.join(os.path.dirname(__file__), "..")
    scan = open(os.path.join(root, "routers", "scan.py"), encoding="utf-8").read()
    jobs = open(os.path.join(root, "scheduler", "jobs.py"), encoding="utf-8").read()
    assert "scanner.scan_quick(query, req.business_name, skip_naver=_prescan_usable(_prescan_naver_q))" in scan
    assert "skip_naver=_prescan_usable(_prescan_naver_f)" in scan
    assert "_skip_naver_brief = prescan_usable(_prescan_naver)" in jobs
    assert 'result["naver"] = _prescan_naver_f' in scan and 'result["naver"] = _prescan_naver_q' in scan   # 결과 채우기는 그대로
