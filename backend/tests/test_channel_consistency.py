"""채널 정보 일관성 점검 테스트 (2026-10-30).

데이터 주의: Places 약관은 place_id 외 응답 내용의 저장을 금지하므로 실제 응답 본문을 커밋하지 않는다.
아래 값은 2026-10-29 실제 응답에서 관찰한 **구조**(전화 필드 누락, "…점" 접미사, 채널별 주소 표기 차이,
SNS 웹사이트)를 따르는 가공 데이터다.
"""
import asyncio
import os
import sys
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routers import place_consistency as router_mod  # noqa: E402
from services import channel_consistency as cc  # noqa: E402
from services import google_places_client as gp  # noqa: E402


# ── 전화 ─────────────────────────────────────────────────────────────────────
def test_norm_phone_formats():
    assert cc.norm_phone("070-1234-5678") == "07012345678"
    assert cc.norm_phone("+82 70-1234-5678") == "07012345678"
    assert cc.norm_phone("+82-10-9876-5432") == "01098765432"
    assert cc.norm_phone("") == ""
    assert cc.norm_phone("12-34") == ""


def test_phone_missing_on_channel_is_unknown_not_mismatch():
    # 구글에 전화가 등록되지 않은 가게는 응답에서 필드가 빠진다 → 불일치로 세면 안 된다
    r = cc.compare_phone("070-1234-5678", None)
    assert r["status"] == "unknown"


def test_phone_unsupported_channel_is_unknown():
    r = cc.compare_phone("070-1234-5678", "", channel_supports=False)
    assert r["status"] == "unknown" and "알려주지" in r["note"]


def test_phone_match_and_mismatch():
    assert cc.compare_phone("070-1234-5678", "+82 70 1234 5678")["status"] == "match"
    assert cc.compare_phone("070-1234-5678", "070-1234-9999")["status"] == "mismatch"


def test_phone_expected_empty_is_unknown():
    assert cc.compare_phone("", "070-1234-5678")["status"] == "unknown"


# ── 주소 ─────────────────────────────────────────────────────────────────────
_GOOGLE = "대한민국 서울특별시 성동구 테스트로9길 8"
_NAVER = "서울특별시 성동구 테스트로9길 8 1, 2층"
_KAKAO = "서울 성동구 테스트로9길 8"


def test_three_channel_address_formats_all_match_each_other():
    for a in (_GOOGLE, _NAVER, _KAKAO):
        for b in (_GOOGLE, _NAVER, _KAKAO):
            assert cc.compare_address(a, b)["status"] == "match", (a, b)


def test_address_number_road_district_differences():
    assert cc.compare_address(_KAKAO, "서울 성동구 테스트로9길 9")["status"] == "mismatch"
    assert cc.compare_address(_KAKAO, "서울 성동구 다른로9길 8")["status"] == "mismatch"
    assert cc.compare_address(_KAKAO, "서울 광진구 테스트로9길 8")["status"] == "mismatch"


def test_address_unparseable_or_empty_is_unknown():
    assert cc.compare_address(_KAKAO, "성수동 근처")["status"] == "unknown"
    assert cc.compare_address("", _KAKAO)["status"] == "unknown"
    assert cc.compare_address(_KAKAO, "")["status"] == "unknown"


# ── 웹사이트 ─────────────────────────────────────────────────────────────────
def test_website_variants_match():
    assert cc.compare_website("https://www.example.co.kr/", "http://m.example.co.kr/menu")["status"] == "match"
    assert cc.compare_website("example.com", "https://www.example.com")["status"] == "match"


def test_website_sns_instead_of_official_is_mismatch_with_note():
    r = cc.compare_website("https://example.com", "http://www.instagram.com/cafe.test/")
    assert r["status"] == "mismatch" and "SNS" in r["note"]


def test_website_same_and_different_instagram_accounts():
    assert cc.compare_website("https://instagram.com/cafe.test", "http://www.instagram.com/cafe.test/")["status"] == "match"
    assert cc.compare_website("https://instagram.com/cafe.a", "https://instagram.com/cafe.b")["status"] == "mismatch"


def test_website_empty_sides_are_unknown():
    assert cc.compare_website("", "https://example.com")["status"] == "unknown"
    assert cc.compare_website("https://example.com", None)["status"] == "unknown"


# ── 이름 ─────────────────────────────────────────────────────────────────────
def test_name_branch_suffix_matches_but_lookalike_does_not():
    assert cc.compare_name("어니언 테스트", "어니언 테스트점")["status"] == "match"
    assert cc.compare_name("카페모모", "카페모모카")["status"] == "mismatch"


def test_name_empty_is_unknown():
    assert cc.compare_name("", "x")["status"] == "unknown"
    assert cc.compare_name("가게", None)["status"] == "unknown"


# ── 지점 선택 (프랜차이즈 포함) ──────────────────────────────────────────────────
def _items():
    return [
        {"id": "1", "name": "테스트커피 성수점", "address": "서울 성동구 테스트로 1", "phone": ""},
        {"id": "2", "name": "테스트커피 왕십리점", "address": "서울 성동구 시험로 2", "phone": ""},
        {"id": "3", "name": "테스트커피 강남점", "address": "서울 강남구 시험로 3", "phone": ""},
    ]


def test_same_brand_same_district_is_ambiguous_without_id():
    state, item = cc.select_match("테스트커피", "성동구", _items(), "", "id")
    assert state == "ambiguous" and item is None


def test_stored_place_id_picks_the_branch():
    state, item = cc.select_match("테스트커피", "성동구", _items(), "2", "id")
    assert state == "found" and item["id"] == "2"


def test_district_filters_other_branches():
    state, item = cc.select_match("테스트커피", "강남구", _items(), "", "id")
    assert state == "found" and item["id"] == "3"


def test_not_found_when_no_name_match():
    state, _ = cc.select_match("전혀다른가게", "성동구", _items(), "", "id")
    assert state == "not_found"


# ── 구글 클라이언트 ──────────────────────────────────────────────────────────
def test_place_id_validation_blocks_path_tricks():
    assert gp.is_valid_place_id("ChIJabcDEF123_-xyz")
    for bad in ("../etc/passwd", "a/b/c/d/e/f/g/h/i/j", "short", "has space 1234567", "", None, 123):
        assert not gp.is_valid_place_id(bad), bad


def test_field_masks_never_request_expensive_fields():
    for mask in (gp.DETAIL_FIELD_MASK, gp.CANDIDATE_FIELD_MASK):
        low = mask.lower()
        assert "review" not in low and "photo" not in low and "opening" not in low


def test_normalize_missing_phone_is_none():
    d = gp._normalize({"id": "ChIJabcDEF123", "displayName": {"text": "가게"}, "rating": 4.2, "userRatingCount": 10})
    assert d["phone"] is None and d["website"] is None and d["name"] == "가게" and d["rating_count"] == 10


def test_http_error_mapping():
    assert gp.map_http_error(403) == "forbidden"
    assert gp.map_http_error(401) == "forbidden"
    assert gp.map_http_error(429) == "rate_limited"
    assert gp.map_http_error(404) == "not_found"
    assert gp.map_http_error(500) == "http_500"


def test_no_key_means_not_configured_without_network(monkeypatch):
    monkeypatch.delenv("GOOGLE_PLACES_API_KEY", raising=False)
    with pytest.raises(gp.PlacesError) as ei:
        asyncio.run(gp.get_place_details("ChIJabcDEF123_-xyz"))
    assert ei.value.code == "not_configured"


def test_invalid_place_id_rejected_before_network(monkeypatch):
    monkeypatch.setenv("GOOGLE_PLACES_API_KEY", "SECRET-KEY-VALUE")
    with pytest.raises(gp.PlacesError) as ei:
        asyncio.run(gp.get_place_details("../x"))
    assert ei.value.code == "invalid_place_id"


class _Resp:
    def __init__(self, status):
        self.status = status

    async def json(self, content_type=None):
        return {}

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False


class _Session:
    def __init__(self, status):
        self._status = status

    def request(self, *a, **k):
        return _Resp(self._status)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False


def test_error_never_leaks_key(monkeypatch, caplog):
    secret = "SECRET-KEY-VALUE-123"
    monkeypatch.setenv("GOOGLE_PLACES_API_KEY", secret)
    monkeypatch.setattr(gp.aiohttp, "ClientSession", lambda *a, **k: _Session(403))
    with caplog.at_level("DEBUG"):
        with pytest.raises(gp.PlacesError) as ei:
            asyncio.run(gp.get_place_details("ChIJabcDEF123_-xyz"))
    assert ei.value.code == "forbidden"
    assert secret not in str(ei.value) and secret not in caplog.text


# ── 오케스트레이션 ───────────────────────────────────────────────────────────
def _ok_channel(status="match"):
    return {"state": "found", "fields": {"name": {"status": status}, "address": {"status": "match"}, "phone": {"status": "unknown"}}}


def test_one_channel_exception_does_not_block_others(monkeypatch):
    async def ok(*a, **k):
        return _ok_channel("mismatch")

    async def boom(*a, **k):
        raise RuntimeError("x")

    monkeypatch.setattr(cc, "_check_kakao", ok)
    monkeypatch.setattr(cc, "_check_naver", boom)
    monkeypatch.setattr(cc, "_check_google", ok)
    r = asyncio.run(cc.run_consistency_check({"name": "가게", "address": "", "phone": "", "website_url": ""}))
    assert r["channels"]["naver"] == {"state": "error", "error": "internal"}
    assert r["channels"]["kakao"]["state"] == "found" and r["channels"]["google"]["state"] == "found"
    # 정상 채널 2개 × (이름 불일치 1, 주소 일치 1, 전화 확인 못함 1); 예외 난 네이버는 집계에서 빠진다
    assert r["summary"] == {"match": 2, "mismatch": 2, "unknown": 2}


# ── 라우터: 한도·환불·저장 범위 ─────────────────────────────────────────────────
class _Q:
    def __init__(self, db, name):
        self.db, self.name, self.op, self.payload, self.filters = db, name, None, None, []

    def select(self, *a, **k):
        self.op = "select"
        return self

    def insert(self, payload):
        self.op, self.payload = "insert", payload
        return self

    def update(self, payload):
        self.op, self.payload = "update", payload
        return self

    def delete(self):
        self.op = "delete"
        return self

    def eq(self, k, v):
        self.filters.append((k, v))
        return self

    def gte(self, k, v):
        return self

    def limit(self, n):
        return self


class _DB:
    def __init__(self):
        self.rows, self.inserts, self.updates, self._n = [], [], [], 1

    def table(self, name):
        return _Q(self, name)


async def _fake_execute(q):
    db = q.db
    if q.name == "consistency_checks":
        f = dict(q.filters)
        if q.op == "insert":
            row = {"id": str(db._n), **q.payload}
            db._n += 1
            db.rows.append(row)
            db.inserts.append(q.payload)
            await asyncio.sleep(0)
            return SimpleNamespace(data=[row], count=None)
        if q.op == "select":
            # 실제 DB처럼 읽은 시점의 값을 먼저 확정하고 응답이 늦게 온다 → 락이 없으면 동시 요청이 모두 0을 읽는다
            n = sum(1 for r in db.rows if r["user_id"] == f["user_id"] and r["kind"] == f["kind"])
            await asyncio.sleep(0)
            await asyncio.sleep(0)
            return SimpleNamespace(data=[], count=n)
        if q.op == "delete":
            db.rows = [r for r in db.rows if r["id"] != f["id"]]
            return SimpleNamespace(data=[], count=None)
    if q.name == "businesses" and q.op == "update":
        db.updates.append(q.payload)
    return SimpleNamespace(data=[], count=0)


@pytest.fixture
def env(monkeypatch):
    db = _DB()
    router_mod._mem_counts.clear()
    router_mod._locks.clear()
    biz = {"id": "b1", "user_id": "u1", "name": "가게", "region": "서울 성동구", "address": "", "phone": "", "website_url": "", "google_place_id": ""}

    async def load_biz(*a, **k):
        return biz

    state = {"plan": ("basic", 2), "result": {"channels": {"kakao": {"state": "found"}}, "summary": {}, "expected": {}, "checked_at": "t"}}

    async def plan_limit(*a, **k):
        return state["plan"]

    async def fake_run(b):
        await asyncio.sleep(0)
        return state["result"]

    monkeypatch.setattr(router_mod, "get_client", lambda: db)
    monkeypatch.setattr(router_mod, "execute", _fake_execute)
    monkeypatch.setattr(router_mod, "_load_biz", load_biz)
    monkeypatch.setattr(router_mod, "_plan_and_limit", plan_limit)
    monkeypatch.setattr(router_mod, "run_consistency_check", fake_run)
    return SimpleNamespace(db=db, state=state)


USER = {"id": "u1"}


def test_daily_limit_blocks_third_check(env):
    async def main():
        await router_mod.run_check("b1", user=USER)
        await router_mod.run_check("b1", user=USER)
        with pytest.raises(HTTPException) as ei:
            await router_mod.run_check("b1", user=USER)
        return ei.value.status_code

    assert asyncio.run(main()) == 429


def test_concurrent_requests_cannot_exceed_limit(env):
    async def main():
        res = await asyncio.gather(*[router_mod.run_check("b1", user=USER) for _ in range(6)], return_exceptions=True)
        return sum(1 for r in res if isinstance(r, dict)), sum(1 for r in res if isinstance(r, HTTPException))

    ok, blocked = asyncio.run(main())
    assert (ok, blocked) == (2, 4)


def test_free_plan_is_forbidden(env):
    env.state["plan"] = ("free", 0)
    with pytest.raises(HTTPException) as ei:
        asyncio.run(router_mod.run_check("b1", user=USER))
    assert ei.value.status_code == 403


def test_all_channels_error_refunds_usage(env):
    env.state["result"] = {"channels": {"kakao": {"state": "error"}, "naver": {"state": "error"}, "google": {"state": "error"}}, "summary": {}, "expected": {}, "checked_at": "t"}

    async def main():
        for _ in range(4):  # 한도(2)보다 많이 호출해도 환불되어 막히지 않는다
            r = await router_mod.run_check("b1", user=USER)
        return r["usage"]

    usage = asyncio.run(main())
    assert usage["used"] == 0 and len(env.db.rows) == 0


def test_only_usage_metadata_is_stored(env):
    env.state["result"] = {"channels": {"google": {"state": "found", "observed_name": "SENTINEL-NAME", "fields": {}}}, "summary": {}, "expected": {}, "checked_at": "t"}
    asyncio.run(router_mod.run_check("b1", user=USER))
    assert env.db.inserts, "사용 기록이 저장되어야 한다"
    for payload in env.db.inserts:
        assert set(payload) == {"user_id", "business_id", "kind"}
        assert "SENTINEL" not in str(payload)


def test_link_google_validates_and_saves(env):
    with pytest.raises(HTTPException) as ei:
        asyncio.run(router_mod.link_google("b1", router_mod.LinkGoogleRequest(place_id="../x"), user=USER))
    assert ei.value.status_code == 400 and env.db.updates == []
    r = asyncio.run(router_mod.link_google("b1", router_mod.LinkGoogleRequest(place_id="ChIJabcDEF123_-xyz"), user=USER))
    assert r["google_linked"] is True and env.db.updates == [{"google_place_id": "ChIJabcDEF123_-xyz"}]
    r = asyncio.run(router_mod.link_google("b1", router_mod.LinkGoogleRequest(place_id=""), user=USER))
    assert r["google_linked"] is False and env.db.updates[-1] == {"google_place_id": None}
