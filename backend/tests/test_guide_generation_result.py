"""가이드 생성 성공·실패가 호출처에 정직하게 전달된다 (2026-11-05).

사고: _generate_and_save는 실패를 삼키고 아무것도 돌려주지 않아, 가이드가 저장되지 않았는데도 호출처가 "Auto guide generated"를 기록했다
(2026-11-04 가입 후 체험: photo_count None 비교 오류 뒤에도 성공 로그). 이제 성공 True·실패 False를 돌려주고 호출처가 그대로 기록한다.
"""
import asyncio
import logging
import os
import sys
from types import SimpleNamespace

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import routers.guide as guide_router  # noqa: E402
import routers.scan as scan_router  # noqa: E402
from models.schemas import GuideRequest  # noqa: E402


class _Chain:
    """supabase.table(...).select(...).eq(...).single() 같은 체인을 아무 호출이나 받아 넘기는 더미."""

    def __getattr__(self, name):
        return lambda *a, **k: self


def _req():
    return GuideRequest(business_id="biz-1", scan_id="scan-1")


def test_generate_and_save_returns_false_and_records_failure_when_the_db_is_unavailable(monkeypatch):
    def _boom():
        raise RuntimeError("db down")

    monkeypatch.setattr(guide_router, "get_client", _boom)
    guide_router._guide_generation_failures.pop("biz-1", None)
    assert asyncio.run(guide_router._generate_and_save(_req())) is False
    assert "biz-1" in guide_router._guide_generation_failures      # UI가 '생성 실패'를 알 수 있게 기록


def test_generate_and_save_returns_false_when_business_or_scan_is_missing(monkeypatch):
    async def _no_rows(q):
        return SimpleNamespace(data=None)

    monkeypatch.setattr(guide_router, "get_client", lambda: _Chain())
    monkeypatch.setattr(guide_router, "execute", _no_rows)
    assert asyncio.run(guide_router._generate_and_save(_req())) is False


def test_auto_guide_logs_not_generated_when_generation_failed(monkeypatch, caplog):
    async def _fail(req):
        return False

    async def _none_today(q):
        return SimpleNamespace(count=0, data=[])

    monkeypatch.setattr(guide_router, "_generate_and_save", _fail)
    monkeypatch.setattr(scan_router, "get_client", lambda: _Chain())
    monkeypatch.setattr(scan_router, "execute", _none_today)
    with caplog.at_level(logging.INFO, logger="aeolab"):
        asyncio.run(scan_router._auto_generate_guide("biz-1", "scan-1"))
    text = caplog.text
    assert "Auto guide NOT generated" in text
    assert "Auto guide generated" not in text


def test_auto_guide_logs_generated_only_on_success(monkeypatch, caplog):
    async def _ok(req):
        return True

    async def _none_today(q):
        return SimpleNamespace(count=0, data=[])

    monkeypatch.setattr(guide_router, "_generate_and_save", _ok)
    monkeypatch.setattr(scan_router, "get_client", lambda: _Chain())
    monkeypatch.setattr(scan_router, "execute", _none_today)
    with caplog.at_level(logging.INFO, logger="aeolab"):
        asyncio.run(scan_router._auto_generate_guide("biz-1", "scan-1"))
    assert "Auto guide generated" in caplog.text and "NOT generated" not in caplog.text


def test_success_path_returns_true_after_the_insert():
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "routers", "guide.py")
    src = open(path, encoding="utf-8").read()
    i = src.index('await execute(supabase.table("guides").insert(base_payload))')
    assert "return True" in src[i:i + 200]
