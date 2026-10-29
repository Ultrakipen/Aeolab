"""토큰 검증 캐시 + single-flight (2026-10-29)."""
import asyncio
import base64
import json
import time

import pytest
from fastapi import HTTPException

import middleware.plan_gate as pg


def _jwt(exp_in=3600, sub="u1"):
    def b(d): return base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip("=")
    return f"{b({'alg':'none'})}.{b({'sub': sub, 'exp': time.time() + exp_in})}.sig"


class _Resp:
    def __init__(self, uid): self.user = type("U", (), {"id": uid, "email": f"{uid}@x.y"})()


class _Auth:
    def __init__(self, delay=0.0, fail=False):
        self.calls = 0
        self.delay, self.fail = delay, fail

    def get_user(self, token):                        # 동기 호출(실제와 같음 — asyncio.to_thread로 실행된다)
        self.calls += 1
        if self.delay:
            time.sleep(self.delay)
        if self.fail:
            return None
        return _Resp("uid-" + str(abs(hash(token)) % 10**8))


@pytest.fixture
def auth(monkeypatch):
    pg.reset_auth_cache_for_tests()
    a = _Auth()
    monkeypatch.setattr(pg, "get_client", lambda: type("C", (), {"auth": a})())
    yield a
    pg.reset_auth_cache_for_tests()


def _call(token):
    return asyncio.run(pg.get_current_user(f"Bearer {token}"))


def test_second_call_with_same_token_skips_supabase(auth):
    t = _jwt()
    u1, u2 = _call(t), _call(t)
    assert u1 == u2 and auth.calls == 1


def test_different_tokens_are_verified_separately(auth):
    a, b = _jwt(sub="a"), _jwt(sub="b")
    ua, ub = _call(a), _call(b)
    assert ua["id"] != ub["id"] and auth.calls == 2


def test_concurrent_requests_share_one_verification(auth):
    auth.delay = 0.15
    t = _jwt()

    async def run():
        return await asyncio.gather(*[pg.get_current_user(f"Bearer {t}") for _ in range(8)])

    res = asyncio.run(run())
    assert auth.calls == 1 and all(r == res[0] for r in res)          # 8개 동시 요청 → 검증 1회


def test_failures_are_not_cached(auth):
    auth.fail = True
    t = _jwt()
    with pytest.raises(HTTPException) as e:
        _call(t)
    assert e.value.status_code == 401
    auth.fail = False
    assert _call(t)["id"].startswith("uid-") and auth.calls == 2      # 실패가 기억되지 않고 다시 검증한다


def test_concurrent_waiters_get_the_same_401_and_nothing_is_cached(auth):
    auth.fail, auth.delay = True, 0.1
    t = _jwt()

    async def run():
        return await asyncio.gather(*[pg.get_current_user(f"Bearer {t}") for _ in range(4)], return_exceptions=True)

    res = asyncio.run(run())
    assert all(isinstance(r, HTTPException) and r.status_code == 401 for r in res) and auth.calls == 1
    assert pg._auth_cache == {} and pg._auth_inflight == {}


def test_cache_expires_after_ttl(auth, monkeypatch):
    t = _jwt()
    now = [1000.0]
    monkeypatch.setattr(pg.time, "monotonic", lambda: now[0])
    _call(t)
    now[0] += pg._AUTH_CACHE_TTL - 1
    _call(t)
    assert auth.calls == 1
    now[0] += 2
    _call(t)
    assert auth.calls == 2                                            # 60초가 지나면 다시 Supabase에 확인한다


def test_cache_never_outlives_the_token_itself(auth, monkeypatch):
    t = _jwt(exp_in=5)                                                # 5초 뒤 만료되는 토큰
    now = [1000.0]
    monkeypatch.setattr(pg.time, "monotonic", lambda: now[0])
    _call(t)
    entry = next(iter(pg._auth_cache.values()))
    assert entry[0] - 1000.0 <= 5.5                                   # 60초가 아니라 토큰 만료(5초)까지만


def test_unreadable_token_still_works_with_default_ttl(auth):
    t = "not-a-jwt-but-accepted-by-stub"
    _call(t); _call(t)
    assert auth.calls == 1


def test_missing_or_malformed_header_is_rejected_without_calling_supabase(auth):
    for hdr in (None, "", "Token abc", "bearer abc"):
        with pytest.raises(HTTPException) as e:
            asyncio.run(pg.get_current_user(hdr))
        assert e.value.status_code == 401
    assert auth.calls == 0


def test_cancelled_leader_does_not_cancel_waiters(auth):
    """먼저 검증을 시작한 요청이 취소돼도, 기다리던 요청은 직접 다시 검증해 정상 응답을 받는다."""
    auth.delay = 0.2
    t = _jwt()

    async def run():
        leader = asyncio.ensure_future(pg.get_current_user(f"Bearer {t}"))
        await asyncio.sleep(0.02)
        waiter = asyncio.ensure_future(pg.get_current_user(f"Bearer {t}"))
        await asyncio.sleep(0.02)
        leader.cancel()
        return await asyncio.gather(leader, waiter, return_exceptions=True)

    leader_res, waiter_res = asyncio.run(run())
    assert isinstance(leader_res, asyncio.CancelledError)
    assert isinstance(waiter_res, dict) and waiter_res["id"].startswith("uid-")


def test_cache_key_is_a_hash_not_the_raw_token(auth):
    t = _jwt()
    _call(t)
    assert t not in pg._auth_cache and all(len(k) == 64 for k in pg._auth_cache)
