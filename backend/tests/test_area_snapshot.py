"""/area 스냅샷: 목록 일관성·공개 응답 규칙(0이 아닌 '집계 전', 가게 이름 비노출)·라우터 검증."""
import json

import pytest

from services import area_snapshot as snap
from services.area_data import CATEGORIES, CLOSURE_REUSE_FROM, CLOSURE_SCOPE_LABEL, REGIONS
from services.localdata_api import ENDPOINT_MAP
from services.sbiz_api import SBIZ_CATEGORY_CODES


@pytest.fixture(autouse=True)
def _tmp_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("AREA_SNAPSHOT_DIR", str(tmp_path))
    snap._mem.clear()
    snap._available_cache = None
    yield
    snap._mem.clear()
    snap._available_cache = None


def test_official_region_file_integrity():
    # 공식 시군구 목록(2026-11-15 수집)이 깨지지 않았는지 — 개수·시도·슬러그 형식·조회 이름
    assert len(REGIONS) == 256
    assert len({r["sido"] for r in REGIONS.values()}) == 16
    for slug, r in REGIONS.items():
        assert " " not in slug and "/" not in slug and "." not in slug, slug
        assert r["query"].strip() and r["label"].strip()
    assert "서울-강남구" in REGIONS and REGIONS["서울-강남구"]["query"] == "서울특별시 강남구"
    assert "경기-고양시-덕양구" in REGIONS
    assert "세종" in REGIONS and REGIONS["세종"]["query"] == "세종특별자치시"  # 시도=시군구 중복 표기 방지
    # 2026 개편이 반영된 공식 목록이라는 근거(손으로 적은 목록으로는 없는 이름)
    assert any(r["sido"] == "전남광주" for r in REGIONS.values())


def test_sbiz_scope_labels_cover_categories():
    from services.area_data import SBIZ_SCOPE_LABEL

    assert set(SBIZ_SCOPE_LABEL) == set(CATEGORIES)


def _load_collect_module():
    import importlib.util
    from pathlib import Path

    p = Path(__file__).resolve().parent.parent / "scripts" / "area_collect.py"
    spec = importlib.util.spec_from_file_location("area_collect_under_test", p)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod.SLEEP_BETWEEN_CALLS = 0
    mod.CLOSURE_RETRY_SLEEPS = (0, 0)  # 재시도 간격도 0으로(시험이 수 분 기다리지 않게)
    mod.SBIZ_RETRY_SLEEPS = (0, 0)
    return mod


def _patch_sources(monkeypatch, *, geocode=True, sbiz=None, closure=None, calls=None):
    import services.localdata_api as ld
    import services.sbiz_api as sb

    async def fake_geo(q):
        return (127.0, 37.5, 3000, "good") if geocode else None

    async def fake_sbiz(cat, q):
        return sbiz(cat) if callable(sbiz) else sbiz

    async def fake_closure(cat, q):
        if calls is not None:
            calls.append(cat)
        return closure(cat) if callable(closure) else closure

    monkeypatch.setattr(sb, "_geocode_region", fake_geo)
    monkeypatch.setattr(sb, "get_sbiz_market_count", fake_sbiz)
    monkeypatch.setattr(ld, "get_closure_rate", fake_closure)


_OK_SBIZ = {"available": True, "total_count": 10, "density_per_km2": 1.0, "radius_m": 3000,
            "confidence": "good", "partial_failure": False, "stdr_ym": "202609",
            "samples": [{"name": "OO가게", "address": "서울"}]}
_OK_CLOSURE = {"available": True, "closure_rate": 40.0, "active_count": 6, "closed_count": 4,
               "national_avg": None, "comparison": None}


def test_collect_does_not_store_business_names_and_reuses_closure_datasets(monkeypatch):
    import asyncio

    mod = _load_collect_module()
    calls: list[str] = []
    _patch_sources(monkeypatch, sbiz=_OK_SBIZ, closure=_OK_CLOSURE, calls=calls)
    result = asyncio.run(mod._collect_region("서울-강남구", "서울특별시 강남구", None))
    assert "OO가게" not in json.dumps(result, ensure_ascii=False)  # 가게 이름은 저장하지 않는다
    assert all("samples" not in (c["sbiz"] or {}) for c in result["categories"].values())
    # 같은 인허가 데이터셋(미용업·휴게음식점)은 한 번만 조회 — 네일·피부관리·제과점은 호출하지 않는다
    assert not ({"nail", "skincare", "bakery"} & set(calls))
    assert sorted(calls) == sorted(["restaurant", "cafe", "bar", "accommodation", "beauty", "pharmacy", "optics", "billiards"])
    # 재사용한 값은 같은 데이터셋이므로 동일해야 한다
    cats = result["categories"]
    assert cats["nail"]["closure"] == cats["beauty"]["closure"] == cats["skincare"]["closure"]
    assert cats["bakery"]["closure"] == cats["cafe"]["closure"]


def test_collect_keeps_old_value_on_transient_failure_but_records_real_no_data(monkeypatch):
    import asyncio

    mod = _load_collect_module()
    old = {"categories": {"cafe": {"sbiz": {"available": True, "total_count": 77},
                                    "closure": {"available": True, "closure_rate": 10.0}}}}
    # 일시 실패(api_timeout) + sbiz 호출 실패(None) → 기존에 받아 둔 값을 지우지 않는다
    _patch_sources(monkeypatch, sbiz=None, closure={"available": False, "reason": "api_timeout"})
    r = asyncio.run(mod._collect_region("서울-강남구", "서울특별시 강남구", old))
    assert r["categories"]["cafe"]["closure"] == old["categories"]["cafe"]["closure"]
    assert r["categories"]["cafe"]["sbiz"] == old["categories"]["cafe"]["sbiz"]
    assert r["categories"]["restaurant"]["closure"] is None  # 기존 값도 없으면 0이 아니라 없음
    # 확인된 '데이터 없음'은 실패와 달리 그대로 기록한다
    _patch_sources(monkeypatch, sbiz=_OK_SBIZ, closure={"available": False, "reason": "no_data"})
    r2 = asyncio.run(mod._collect_region("서울-강남구", "서울특별시 강남구", old))
    assert r2["categories"]["cafe"]["closure"]["reason"] == "no_data"


def test_collect_skips_region_when_name_cannot_be_geocoded(monkeypatch):
    import asyncio

    mod = _load_collect_module()
    calls: list[str] = []
    _patch_sources(monkeypatch, geocode=False, sbiz=_OK_SBIZ, closure=_OK_CLOSURE, calls=calls)
    assert asyncio.run(mod._collect_region("서울-강남구", "없는 주소", None)) is None
    assert calls == []  # 확인 안 된 지역에는 인허가 호출도 하지 않는다


def test_lists_are_consistent_with_data_sources():
    # 열어 둔 업종은 두 데이터 소스가 모두 지원해야 한다(한쪽만 되는 업종을 실수로 넣지 않게)
    for cat in CATEGORIES:
        assert cat in SBIZ_CATEGORY_CODES, cat
        assert cat in ENDPOINT_MAP, cat
        assert cat in CLOSURE_SCOPE_LABEL, cat
    for dst, src in CLOSURE_REUSE_FROM.items():
        # 재사용은 같은 인허가 데이터셋일 때만 — 값이 다른 업종을 묶으면 허위가 된다
        assert ENDPOINT_MAP[dst] == ENDPOINT_MAP[src]
        assert dst in CATEGORIES and src in CATEGORIES
    # 의미 불일치 가능성 때문에 1차에서 뺀 업종이 들어오지 않았는지
    assert not ({"pet", "massage", "fitness"} & set(CATEGORIES))
    assert len(REGIONS) == len({r["slug"] for r in REGIONS.values()})


def test_unsupported_and_not_collected_are_not_zero():
    assert snap.get_area("없는지역", "cafe")["reason"] == "unsupported"
    assert snap.get_area("서울-강남구", "yoga")["reason"] == "unsupported"
    r = snap.get_area("서울-강남구", "cafe")
    assert r["available"] is False and r["reason"] == "not_collected"
    assert "sbiz" not in r and "closure" not in r  # 0·빈 값으로 채우지 않는다


def _write(slug, cats):
    snap.save_region(slug, {"region": slug, "generated_at": "2026-11-15T00:00:00+00:00", "categories": cats})


def test_public_response_hides_business_names_and_labels_scope():
    _write("서울-강남구", {"nail": {
        "collected_at": "2026-11-15T00:00:00+00:00",
        "sbiz": {"available": True, "total_count": 120, "density_per_km2": 4.2, "radius_m": 3000,
                 "confidence": "good", "partial_failure": False, "stdr_ym": "202609",
                 "samples": [{"name": "OO네일", "address": "서울"}]},
        "closure": {"available": True, "closure_rate": 55.5, "active_count": 10, "closed_count": 12,
                    "national_avg": None, "comparison": None},
    }})
    r = snap.get_area("서울-강남구", "nail")
    assert r["available"] is True
    assert "OO네일" not in json.dumps(r, ensure_ascii=False)  # 개별 가게는 공개하지 않는다
    assert r["closure"]["scope_label"] == CLOSURE_SCOPE_LABEL["nail"]
    assert r["sbiz"]["stdr_ym"] == "202609"


def test_one_source_missing_still_available_other_is_none():
    _write("서울-강남구", {"cafe": {
        "collected_at": "x",
        "sbiz": {"available": False},
        "closure": {"available": True, "closure_rate": 50.0, "active_count": 1, "closed_count": 1},
    }})
    r = snap.get_area("서울-강남구", "cafe")
    assert r["available"] is True and r["sbiz"] is None and r["closure"]["closure_rate"] == 50.0


def test_both_unavailable_is_no_data():
    _write("서울-강남구", {"cafe": {"collected_at": "x", "sbiz": None, "closure": {"available": False}}})
    assert snap.get_area("서울-강남구", "cafe")["reason"] == "no_data"


def test_reload_after_file_change():
    _write("서울-강남구", {"cafe": {"collected_at": "x", "sbiz": None,
                                    "closure": {"available": True, "closure_rate": 10.0}}})
    assert snap.get_area("서울-강남구", "cafe")["closure"]["closure_rate"] == 10.0
    _write("서울-강남구", {"cafe": {"collected_at": "x", "sbiz": None,
                                    "closure": {"available": True, "closure_rate": 20.0}}})
    assert snap.get_area("서울-강남구", "cafe")["closure"]["closure_rate"] == 20.0


def test_corrupt_file_is_not_collected_not_crash(tmp_path):
    (tmp_path / "서울-강남구.json").write_text("{깨진", encoding="utf-8")
    assert snap.get_area("서울-강남구", "cafe")["reason"] == "not_collected"


def test_available_lists_only_collected_pairs():
    assert snap.list_available() == []  # 아무것도 수집 전 — 사이트맵에 빈 페이지를 넣지 않는다
    _write("서울-강남구", {
        "cafe": {"collected_at": "x", "sbiz": None, "closure": {"available": True, "closure_rate": 10.0}},
        "nail": {"collected_at": "x", "sbiz": None, "closure": {"available": False}},
    })
    assert snap.list_available() == [{"region": "서울-강남구", "category": "cafe"}]


def test_router_rejects_unknown_and_path_tricks():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from routers import area

    app = FastAPI()
    app.include_router(area.router, prefix="/api/area")
    c = TestClient(app)
    assert c.get("/api/area/서울-강남구/cafe").status_code == 200
    assert c.get("/api/area/서울-강남구/yoga").status_code == 404
    assert c.get("/api/area/..%2F..%2Fetc/cafe").status_code == 404
    meta = c.get("/api/area/meta").json()
    assert len(meta["regions"]) == len(REGIONS) and len(meta["categories"]) == len(CATEGORIES)
    assert {"slug", "label", "sido", "sigungu"} <= set(meta["regions"][0])
    assert c.get("/api/area/available").json() == {"items": []}


def _fake_result(usable: bool):
    entry = {"sbiz": {"available": True, "total_count": 1} if usable else None, "closure": None}
    return {"region": "x", "generated_at": "t", "categories": {"cafe": entry, "nail": dict(entry)}}


def test_run_batch_stops_after_consecutive_unusable_regions_and_saves_only_usable():
    import asyncio

    mod = _load_collect_module()
    saved = []
    seen = []

    async def collect(slug):
        seen.append(slug)
        return _fake_result(usable=slug in ("a", "b"))

    summary = asyncio.run(mod.run_batch(["a", "x1", "b", "x2", "x3", "x4", "never"], collect, lambda s, r: saved.append(s)))
    # a 저장, x1 값 없음(1), b 저장(연속 실패 초기화), x2·x3·x4 연속 3곳 값 없음 → 중단, never 는 호출되지 않음
    assert saved == ["a", "b"]
    assert summary == {"done": 2, "skipped": 0, "unusable": 4, "stopped": True}
    assert "never" not in seen and seen[-1] == "x4"


def test_run_batch_name_check_failures_do_not_trip_the_breaker():
    import asyncio

    mod = _load_collect_module()
    saved = []

    async def collect(slug):
        return None if slug.startswith("bad") else _fake_result(usable=True)

    summary = asyncio.run(mod.run_batch(["bad1", "bad2", "bad3", "bad4", "ok"], collect, lambda s, r: saved.append(s)))
    assert saved == ["ok"]  # 지역 이름 확인 실패는 '건너뜀' — 연속 실패(키·한도 의심)로 세지 않는다
    assert summary == {"done": 1, "skipped": 4, "unusable": 0, "stopped": False}


def test_collect_retries_transient_failures_then_succeeds(monkeypatch):
    import asyncio

    mod = _load_collect_module()
    seen = {"restaurant": 0}

    def closure(cat):
        if cat == "restaurant":
            seen["restaurant"] += 1
            if seen["restaurant"] < 3:  # 처음 두 번은 504 같은 일시 실패, 세 번째에 성공
                return {"available": False, "reason": "api_timeout"}
        return _OK_CLOSURE

    _patch_sources(monkeypatch, sbiz=_OK_SBIZ, closure=closure)
    r = asyncio.run(mod._collect_region("서울-강남구", "서울특별시 강남구", None))
    assert seen["restaurant"] == 3
    assert r["categories"]["restaurant"]["closure"]["available"] is True


def test_collect_gives_up_after_retries_and_marks_region_incomplete(monkeypatch):
    import asyncio

    mod = _load_collect_module()
    calls = {"restaurant": 0}

    def closure(cat):
        if cat == "restaurant":
            calls["restaurant"] += 1
            return {"available": False, "reason": "api_timeout"}
        return _OK_CLOSURE

    _patch_sources(monkeypatch, sbiz=_OK_SBIZ, closure=closure)
    r = asyncio.run(mod._collect_region("서울-강남구", "서울특별시 강남구", None))
    assert calls["restaurant"] == 3  # 1 + 재시도 2회, 그 이상 두드리지 않는다
    assert r["categories"]["restaurant"]["closure"] is None  # 0이 아니라 '없음'
    assert mod._is_incomplete(r) is True


def test_collect_retries_sbiz_none_results(monkeypatch):
    import asyncio

    mod = _load_collect_module()
    n = {"c": 0}

    def sbiz(cat):
        if cat == "cafe":
            n["c"] += 1
            return None if n["c"] < 2 else _OK_SBIZ
        return _OK_SBIZ

    _patch_sources(monkeypatch, sbiz=sbiz, closure=_OK_CLOSURE)
    r = asyncio.run(mod._collect_region("서울-강남구", "서울특별시 강남구", None))
    assert n["c"] == 2 and r["categories"]["cafe"]["sbiz"]["available"] is True


def test_freshness_complete_vs_incomplete_regions():
    from datetime import datetime, timedelta, timezone

    mod = _load_collect_module()

    def snap(age, incomplete):
        ts = (datetime.now(timezone.utc) - age).isoformat(timespec="seconds")
        cats = {c: {"sbiz": {"available": True}, "closure": {"available": False, "reason": "no_data"}} for c in CATEGORIES}
        if incomplete:
            cats["cafe"]["closure"] = None  # 폐업률 수집 실패(한 번도 성공 못 함)
        return {"generated_at": ts, "categories": cats}

    # 확인된 '데이터 없음'(no_data)은 불완전이 아니다 → 25일 동안 최근 수집으로 본다
    assert mod._is_fresh(snap(timedelta(days=10), False)) is True
    assert mod._is_fresh(snap(timedelta(days=26), False)) is False
    # 값이 빠진 지역은 20시간이 지나면 다음 실행에서 다시 시도, 그 전에는 건드리지 않는다
    assert mod._is_fresh(snap(timedelta(hours=1), True)) is True
    assert mod._is_fresh(snap(timedelta(hours=21), True)) is False
    assert mod._is_fresh(None) is False and mod._is_fresh({"categories": {}}) is False
