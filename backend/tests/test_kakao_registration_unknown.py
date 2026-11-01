"""카카오맵 등록 여부: 확인하지 못한 것(API 키 없음·HTTP 오류·타임아웃)은 '미등록'이 아니라 '확인 못 함'이다 (2026-11-01).

읽기 전용이라던 라우트 점검(외부 연결 차단)이 GET /api/kakao/check로 businesses.kakao_registered를 False로 덮어쓴 일로 발견했다.
카카오 API 실패를 False로 저장하는 결함은 원래 있었다 — 사용자가 카카오 체크리스트를 저장하는 POST 경로도 같았다. 지침 9: 측정 못 한 것은 0이 아니라 '확인 전'.
"""
import asyncio

import pytest

import routers.kakao as rk
import services.kakao_checker as kc


# ── 가짜 aiohttp ───────────────────────────────────────────────────
class _Resp:
    def __init__(self, status, data):
        self.status, self._data = status, data

    async def json(self):
        return self._data

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False


class _Session:
    def __init__(self, behavior):
        self.behavior = behavior

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    def get(self, *a, **k):
        if isinstance(self.behavior, Exception):
            raise self.behavior
        return _Resp(*self.behavior)


def _patch_http(monkeypatch, behavior):
    monkeypatch.setenv("KAKAO_REST_API_KEY", "dummy")
    monkeypatch.setattr(kc.aiohttp, "ClientSession", lambda *a, **k: _Session(behavior))


def test_unreachable_or_error_is_unknown_not_unregistered(monkeypatch):
    for behavior in (
        asyncio.TimeoutError(),
        ConnectionError("blocked"),
        (500, {}),
        (429, {}),
        (401, {}),
    ):
        _patch_http(monkeypatch, behavior)
        assert asyncio.run(kc.check_kakao_registration_or_none("하라식당", "창원시")) is None, behavior


def test_missing_api_key_is_unknown(monkeypatch):
    monkeypatch.delenv("KAKAO_REST_API_KEY", raising=False)
    assert asyncio.run(kc.check_kakao_registration_or_none("하라식당", "창원시")) is None


def test_real_answers_are_still_true_or_false(monkeypatch):
    _patch_http(monkeypatch, (200, {"documents": [{"place_name": "하라식당 본점"}]}))
    assert asyncio.run(kc.check_kakao_registration_or_none("하라식당", "창원시")) is True
    _patch_http(monkeypatch, (200, {"documents": [{"place_name": "다른 가게"}]}))
    assert asyncio.run(kc.check_kakao_registration_or_none("하라식당", "창원시")) is False   # 확인했고 없음 = 진짜 False
    _patch_http(monkeypatch, (200, {"documents": []}))
    assert asyncio.run(kc.check_kakao_registration_or_none("하라식당", "창원시")) is False


# ── 라우트: 저장 여부 ──────────────────────────────────────────────
class _FakeTable:
    def __init__(self, log):
        self.log = log

    def update(self, row):
        self.log.append(row)
        return self

    def eq(self, *a, **k):
        return self

    def execute(self):
        return None


class _FakeSB:
    def __init__(self):
        self.updates = []

    def table(self, name):
        assert name == "businesses"
        return _FakeTable(self.updates)


def _setup_route(monkeypatch, biz):
    sb = _FakeSB()
    monkeypatch.setattr(rk, "get_client", lambda: sb)
    monkeypatch.setattr(rk, "_verify_biz_ownership", lambda biz_id, user_id, supabase: biz)
    return sb


BIZ = {"id": "b1", "name": "하라식당 본점", "region": "창원시", "kakao_registered": True, "kakao_checklist": {}, "kakao_score": 50}


def test_check_route_does_not_overwrite_when_unknown(monkeypatch):
    sb = _setup_route(monkeypatch, dict(BIZ))

    async def unknown(*a, **k):
        return None

    monkeypatch.setattr(rk, "check_kakao_registration_or_none", unknown)
    out = asyncio.run(rk.check_kakao_registration_endpoint("b1", {"id": "u1"}))
    assert sb.updates == [], "확인하지 못했는데 저장된 등록 여부를 덮어썼다"
    assert out["is_registered"] is None and out["checked"] is False


@pytest.mark.parametrize("answer", [True, False])
def test_check_route_saves_real_answers(monkeypatch, answer):
    sb = _setup_route(monkeypatch, dict(BIZ))

    async def real(*a, **k):
        return answer

    monkeypatch.setattr(rk, "check_kakao_registration_or_none", real)
    out = asyncio.run(rk.check_kakao_registration_endpoint("b1", {"id": "u1"}))
    assert sb.updates == [{"kakao_registered": answer}]
    assert out["is_registered"] is answer and out["checked"] is True


def test_checklist_save_keeps_registered_flag_when_api_unknown_and_scores_with_previous_value(monkeypatch):
    sb = _setup_route(monkeypatch, dict(BIZ))
    _patch_http(monkeypatch, ConnectionError("blocked"))     # 실제 build 함수가 확인 못 함(None)을 돌려주게 한다
    out = asyncio.run(rk.save_kakao_checklist("b1", rk.KakaoChecklistRequest(has_hours=True), {"id": "u1"}))
    assert len(sb.updates) == 1
    assert "kakao_registered" not in sb.updates[0], "확인 못 했는데 kakao_registered를 덮어썼다"
    # 점수는 직전 저장값(True)으로 계산된다 — 등록 25점 포함
    flat = sb.updates[0]["kakao_checklist"]
    assert flat["is_registered"] is True and sb.updates[0]["kakao_score"] >= 25


def test_checklist_save_stores_real_api_answer(monkeypatch):
    sb = _setup_route(monkeypatch, dict(BIZ))
    _patch_http(monkeypatch, (200, {"documents": [{"place_name": "다른 가게"}]}))    # 확인했고 없음
    asyncio.run(rk.save_kakao_checklist("b1", rk.KakaoChecklistRequest(), {"id": "u1"}))
    assert sb.updates[0]["kakao_registered"] is False


def test_routes_never_default_unknown_to_false():
    src = open("routers/kakao.py", encoding="utf-8").read()
    assert 'get("is_registered_auto", False)' not in src
    assert "check_kakao_registration(" not in src.replace("check_kakao_registration_or_none(", "").replace("def check_kakao_registration_endpoint(", "")
