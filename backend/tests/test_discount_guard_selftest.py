"""재가입 방어 자체 검증 스크립트(scripts/discount_guard_selftest.py)의 시험 (2026-11-10).

스크립트가 실제 테이블에서 돌기 전에, 같은 시나리오가 메모리 가짜 DB에서 전부 통과하는지, 그리고 방어가 망가지면(해제·일치·만료 판정이
빠지면) 스크립트가 실패를 알려 주는지(자체 검증이 항상 통과하는 껍데기가 아닌지) 확인한다.
"""
import asyncio
import importlib.util
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))     # tests 폴더의 다른 시험 모듈(가짜 DB 재사용)을 가져오기 위해

from services import discount_guard as dg  # noqa: E402
from test_discount_guard import env  # noqa: E402,F401  (가짜 DB·환경 고정 장치 재사용)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _selftest():
    spec = importlib.util.spec_from_file_location("discount_guard_selftest", os.path.join(ROOT, "scripts", "discount_guard_selftest.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _run():
    return asyncio.run(_selftest().run_selftest(dg))


def test_selftest_passes_all_checks_on_a_working_guard(env):
    results = _run()
    failed = [n for n, ok in results if not ok]
    assert not failed, failed
    assert len(results) >= 10                      # 껍데기가 아니다 — 시나리오를 실제로 돌린다
    assert env.keys == []                          # 만든 행은 모두 지웠다
    assert dg._user_businesses.__name__ == "_user_businesses"   # 가짜 사업장 조회를 원래대로 되돌렸다


def test_selftest_fails_when_release_is_broken(env, monkeypatch):
    async def broken_release(*a, **k):
        return 0

    monkeypatch.setattr(dg, "release", broken_release)
    failed = [n for n, ok in _run() if not ok]
    assert any("해제" in n for n in failed), failed


def test_selftest_fails_when_the_rejoin_is_not_detected(env, monkeypatch):
    async def never(*a, **k):
        return None

    monkeypatch.setattr(dg, "prior_use_conflict", never)
    failed = [n for n, ok in _run() if not ok]
    assert any("재가입" in n for n in failed) and any("되살아" in n for n in failed), failed


def test_selftest_fails_when_expiry_is_ignored(env, monkeypatch):
    real = dg.prior_use_conflict

    async def ignores_expiry(purpose, uid, email):
        # 만료를 무시하는 척: 만료 직후에도 일치로 본다
        r = await real(purpose, uid, email)
        return r or (dg.KEY_NAVER if uid == "selftest-B" else None)

    monkeypatch.setattr(dg, "prior_use_conflict", ignores_expiry)
    failed = [n for n, ok in _run() if not ok]
    assert any("만료" in n for n in failed) or any("일치하지 않음" in n for n in failed), failed


def test_selftest_cleans_up_even_when_a_step_raises(env, monkeypatch):
    calls = {"n": 0}
    real = dg.prior_use_conflict

    async def boom_second(purpose, uid, email):
        calls["n"] += 1
        if calls["n"] == 2:
            raise RuntimeError("db hiccup")
        return await real(purpose, uid, email)

    monkeypatch.setattr(dg, "prior_use_conflict", boom_second)
    with pytest.raises(RuntimeError):
        _run()
    assert env.keys == []                          # 예외가 나도 시험 행은 남지 않는다


def test_script_is_dry_run_by_default_and_never_prints_values():
    src = open(os.path.join(ROOT, "scripts", "discount_guard_selftest.py"), encoding="utf-8").read()
    assert 'action="store_true"' in src
    assert src.index("if not apply:") < src.index("await run_selftest(dg)")       # 드라이런이면 검증(쓰기)을 돌리기 전에 끝난다
    assert "purge_expired" not in src.split("async def _main")[0].split('"""', 2)[2]       # 전체 만료 삭제는 부르지 않는다(주석 제외 본문)
    for line in src.splitlines():
        if line.strip().startswith("print(") and ("{pid}" in line or "{email" in line or "key_hash" in line):
            raise AssertionError("값·해시를 출력하면 안 된다: " + line.strip())
