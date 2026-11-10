"""무료 체험 한도는 검증된 사용자 기준이어야 한다 (2026-11-10).

수정 전: 'Authorization: Bearer ...' 로 시작하기만 하면 검증 없이 헤더 해시가 한도 키 → 값만 바꾸면 한도 무한, IP 제한도 건너뜀.
"""
import asyncio

import pytest
from fastapi import HTTPException

import utils.cache as cache
from routers import scan


class FakeReq:
    def __init__(self, auth=None, ip="203.0.113.7"):
        self.headers = {"X-Real-IP": ip}
        if auth:
            self.headers["Authorization"] = auth
        self.client = None


@pytest.fixture(autouse=True)
def _env(monkeypatch):
    monkeypatch.setattr(scan, "_DEV_TRIAL_UNLIMITED", False)
    monkeypatch.setattr(scan, "_is_admin_request", lambda r: False)
    store = {}
    monkeypatch.setattr(cache, "get", lambda k: store.get(k))
    monkeypatch.setattr(cache, "set", lambda k, v, ttl=None, **kw: store.__setitem__(k, v))
    return store


def _call(req):
    return asyncio.run(scan._enforce_trial_limit(req))


def _valid_tokens(monkeypatch, mapping):
    async def fake_user(authorization=None):
        uid = mapping.get(authorization)
        if not uid:
            raise HTTPException(status_code=401, detail="bad token")
        return {"id": uid, "email": "x@x"}
    monkeypatch.setattr(scan, "get_current_user", fake_user)


def test_forged_bearer_values_do_not_reset_the_limit(monkeypatch):
    _valid_tokens(monkeypatch, {})
    # 같은 IP에서 값을 바꿔 가며 보낸 위조 토큰: 비로그인과 같은 IP 3회 한도에 걸려야 한다
    for i in range(3):
        _call(FakeReq(auth=f"Bearer forged{i}"))
    with pytest.raises(HTTPException) as e:
        _call(FakeReq(auth="Bearer forged999"))
    assert e.value.status_code == 429


def test_valid_user_gets_five_per_day_keyed_by_user_not_by_token(monkeypatch):
    _valid_tokens(monkeypatch, {f"Bearer t{i}": "user-1" for i in range(10)})
    for i in range(5):
        _call(FakeReq(auth=f"Bearer t{i}"))      # 토큰이 갱신돼 값이 달라져도 같은 사용자
    with pytest.raises(HTTPException) as e:
        _call(FakeReq(auth="Bearer t9"))
    assert e.value.status_code == 429


def test_two_valid_users_have_separate_counters(monkeypatch):
    _valid_tokens(monkeypatch, {"Bearer a": "user-a", "Bearer b": "user-b"})
    for _ in range(5):
        _call(FakeReq(auth="Bearer a"))
    _call(FakeReq(auth="Bearer b"))               # 다른 사용자는 영향 없음


def test_anonymous_still_limited_by_ip(monkeypatch):
    _valid_tokens(monkeypatch, {})
    for _ in range(3):
        _call(FakeReq())
    with pytest.raises(HTTPException):
        _call(FakeReq())


def test_verification_outage_falls_back_to_stricter_ip_limit(monkeypatch):
    async def boom(authorization=None):
        raise RuntimeError("supabase down")
    monkeypatch.setattr(scan, "get_current_user", boom)
    for _ in range(3):
        _call(FakeReq(auth="Bearer whatever"))
    with pytest.raises(HTTPException):
        _call(FakeReq(auth="Bearer whatever"))


def test_admin_request_is_not_limited(monkeypatch):
    monkeypatch.setattr(scan, "_is_admin_request", lambda r: True)
    for _ in range(10):
        _call(FakeReq())
