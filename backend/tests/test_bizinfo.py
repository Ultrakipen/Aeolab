"""기업마당 지원사업·행사 스냅샷: 실제 응답 샘플(2026-11-16 서버에서 받은 응답에서 발췌)로 변환·공개 응답·수집기 안전장치를 확인한다."""
import asyncio
import json
import sys
from datetime import date, datetime, timezone
from pathlib import Path

import pytest

from services import bizinfo as bz

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "bizinfo_sample.json").read_text(encoding="utf-8"))
TODAY = date(2026, 11, 16)
NOW = datetime(2026, 11, 16, 3, 0, tzinfo=timezone.utc)


@pytest.fixture(autouse=True)
def _tmp_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("BIZINFO_SNAPSHOT_DIR", str(tmp_path))
    bz._mem.clear()
    yield
    bz._mem.clear()


def _load_collect_module():
    import importlib.util

    p = Path(__file__).resolve().parent.parent / "scripts" / "bizinfo_collect.py"
    spec = importlib.util.spec_from_file_location("bizinfo_collect_under_test", p)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# ── 변환 ──────────────────────────────────────────────────────────────────────

def test_real_sample_keeps_only_sbiz_related_and_rebuilds_links():
    out = [bz.normalize_support(i) for i in FIXTURE["support"]]
    kept = [o for o in out if o]
    # 샘플 8건 중 지원대상이 '소상공인'인 4건만 남고, 소상공인 언급이 없는 중소기업·창업벤처 공고 4건은 빠진다
    assert len(kept) == 4 and all(o["sbiz_target"] and o["target"] == "소상공인" for o in kept)
    for o in kept:
        # 링크는 응답의 URL 필드가 아니라 공고 ID로 만든다(첨부 다운로드 토큰 같은 만료 값이 새지 않게)
        assert o["url"] == f"https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId={o['id']}"
        assert "downloadToken" not in json.dumps(o, ensure_ascii=False)
        assert "<" not in o["summary"] and len(o["summary"]) <= 151


def test_period_dates_and_text_periods_are_kept_honestly():
    kept = [o for o in (bz.normalize_support(i) for i in FIXTURE["support"]) if o]
    by_raw = {o["period_raw"]: o for o in kept}
    dated = by_raw["2026-11-12 ~ 2026-11-19"]
    assert (dated["start"], dated["end"]) == ("2026-11-12", "2026-11-19")
    for text in ("예산 소진시까지", "상시 접수"):
        o = by_raw[text]
        assert o["start"] is None and o["end"] is None  # 날짜를 지어내지 않는다
        assert o["period_raw"] == text  # 원문 그대로 보여 줄 수 있게 보존


def test_non_sbiz_target_is_kept_only_when_sbiz_is_mentioned_and_flag_is_false():
    base = dict(FIXTURE["support"][4])  # 지원대상 중소기업, 소상공인 언급 없음
    assert bz.normalize_support(base) is None
    base["pblancNm"] = "[경기] 2026년 소상공인 경영안정 지원"
    got = bz.normalize_support(base)
    assert got is not None and got["sbiz_target"] is False and got["target"] == "중소기업"  # 지원대상은 원문 그대로


def test_bad_id_or_missing_title_is_dropped():
    src = dict(FIXTURE["support"][0])
    assert bz.normalize_support({**src, "pblancId": "../../etc"}) is None
    assert bz.normalize_support({**src, "pblancId": ""}) is None
    assert bz.normalize_support({**src, "pblancNm": "  "}) is None


@pytest.mark.parametrize(
    "text,expect",
    [
        ("2026-11-09 ~ 2026-11-23", ("2026-11-09", "2026-11-23")),
        ("20261109 ~ 20261123", ("2026-11-09", "2026-11-23")),
        ("20261340 ~ 20261350", None),  # 존재하지 않는 날짜
        ("예산 소진시까지", None),
        ("", None),
        (None, None),
    ],
)
def test_parse_range(text, expect):
    assert bz.parse_range(text) == expect


def test_strip_html_and_truncation():
    assert bz.strip_html("<p>가&nbsp;나</p><p><br></p><p>다 &amp; 라</p>") == "가 나 다 & 라"
    long = bz.strip_html("<p>" + "가" * 400 + "</p>", limit=150)
    assert len(long) == 151 and long.endswith("…")
    assert bz.strip_html(None) == ""


def test_events_drop_ended_keep_always_and_rebuild_links():
    evs = FIXTURE["events"]
    out = [bz.normalize_event(e, TODAY) for e in evs]
    assert all(out)  # 샘플은 모두 진행 예정·상시
    ongoing = next(o for o in out if o["period_raw"] == "상시")
    assert ongoing["start"] is None and ongoing["end"] is None
    for o in out:
        assert o["url"].startswith("https://www.bizinfo.go.kr/web/")
    ended = bz.normalize_event(evs[0], date(2026, 12, 1))  # 11-20 에 끝난 행사 → 12-01 기준 제외
    assert ended is None
    evil = bz.normalize_event({**evs[0], "orginlUrlAdres": "javascript:alert(1)"}, TODAY)
    assert evil["origin_url"] == ""  # http(s) 가 아니면 링크를 만들지 않는다


def test_event_period_ends_today_is_still_listed():
    ev = {**FIXTURE["events"][0], "eventBeginEndDe": "20261116 ~ 20261116"}
    assert bz.normalize_event(ev, TODAY) is not None  # 오늘 끝나는 행사는 오늘까지 보인다


# ── 스냅샷·공개 응답 ───────────────────────────────────────────────────────────

def test_build_save_load_roundtrip_and_counts():
    snap = bz.build_snapshot(FIXTURE["support"], FIXTURE["events"], NOW)
    assert snap["support"]["source_total"] == 8 and len(snap["support"]["items"]) == 4
    assert snap["events"]["source_total"] == 4 and len(snap["events"]["items"]) == 4
    bz.save_snapshot(snap)
    got = bz.load_snapshot()
    assert got == snap
    view = bz.public_view()
    assert view["available"] is True and view["generated_at"] == "2026-11-16T03:00:00+00:00"


def test_no_snapshot_is_unavailable_not_empty_list():
    assert bz.public_view() == {"available": False}  # 0건처럼 보이는 응답을 만들지 않는다


def test_corrupt_snapshot_is_unavailable_not_crash():
    p = bz.snapshot_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text("{not json", encoding="utf-8")
    assert bz.public_view() == {"available": False}


def test_reload_after_file_change():
    bz.save_snapshot(bz.build_snapshot(FIXTURE["support"], [], NOW))
    assert len(bz.public_view()["support"]["items"]) == 4
    bz.save_snapshot(bz.build_snapshot(FIXTURE["support"][:1], [], NOW))
    assert len(bz.public_view()["support"]["items"]) == 1


def test_router_returns_snapshot_and_has_no_external_calls(monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from routers import bizinfo as router_mod

    app = FastAPI()
    app.include_router(router_mod.router, prefix="/api/bizinfo")
    c = TestClient(app)
    assert c.get("/api/bizinfo").json() == {"available": False}
    bz.save_snapshot(bz.build_snapshot(FIXTURE["support"], FIXTURE["events"], NOW))
    r = c.get("/api/bizinfo").json()
    assert r["available"] is True and len(r["support"]["items"]) == 4


# ── 수집기 안전장치 ────────────────────────────────────────────────────────────

def _run_collect(mod, monkeypatch, argv=()):
    # main() 이 서버 .env 를 읽어 환경변수를 채우므로(서버에는 실제 키가 있다) 시험에서는 읽지 않게 막는다
    monkeypatch.setattr("dotenv.load_dotenv", lambda *a, **k: False)
    monkeypatch.setattr(sys, "argv", ["bizinfo_collect.py", *argv])
    return asyncio.run(mod.main())


def _many_rows(n):
    base = FIXTURE["support"][0]
    return [{**base, "pblancId": f"PBLN_{100000 + i}"} for i in range(n)]


def test_collect_saves_and_keeps_old_events_when_event_call_fails(monkeypatch):
    mod = _load_collect_module()
    monkeypatch.setenv("BIZINFO_API_KEY", "k1")
    monkeypatch.setenv("BIZINFO_EVENT_API_KEY", "k2")
    bz.save_snapshot(bz.build_snapshot(_many_rows(60), FIXTURE["events"], NOW))  # 이전 스냅샷(행사 4건)

    async def fake_fetch(url, key, timeout_s=90):
        if "Event" in url:
            raise mod.FetchError("HTTP 500")
        return _many_rows(70)

    monkeypatch.setattr(mod, "fetch_rows", fake_fetch)
    assert _run_collect(mod, monkeypatch) == 0
    snap = bz.load_snapshot()
    assert len(snap["support"]["items"]) == 70  # 지원사업은 새로 갱신
    assert len(snap["events"]["items"]) == 4  # 행사는 실패했으니 이전 목록 유지


def test_collect_support_failure_never_overwrites_old_snapshot(monkeypatch):
    mod = _load_collect_module()
    monkeypatch.setenv("BIZINFO_API_KEY", "k1")
    monkeypatch.setenv("BIZINFO_EVENT_API_KEY", "k2")
    bz.save_snapshot(bz.build_snapshot(_many_rows(60), [], NOW))

    async def fake_fetch(url, key, timeout_s=90):
        raise mod.FetchError("HTTP 503")

    monkeypatch.setattr(mod, "fetch_rows", fake_fetch)
    assert _run_collect(mod, monkeypatch) == 2
    assert len(bz.load_snapshot()["support"]["items"]) == 60


def test_collect_refuses_tiny_or_shrunken_responses_unless_forced(monkeypatch):
    mod = _load_collect_module()
    monkeypatch.setenv("BIZINFO_API_KEY", "k1")
    monkeypatch.delenv("BIZINFO_EVENT_API_KEY", raising=False)
    bz.save_snapshot(bz.build_snapshot(_many_rows(100), [], NOW))

    rows = {"v": _many_rows(10)}  # 원본 10건 — 응답 이상(MIN 미만)

    async def fake_fetch(url, key, timeout_s=90):
        return rows["v"]

    monkeypatch.setattr(mod, "fetch_rows", fake_fetch)
    assert _run_collect(mod, monkeypatch) == 3
    assert len(bz.load_snapshot()["support"]["items"]) == 100  # 그대로

    rows["v"] = _many_rows(60)  # 원본은 충분하지만 소상공인 관련이 100→60(절반 이상이라 허용)
    assert _run_collect(mod, monkeypatch) == 0 and len(bz.load_snapshot()["support"]["items"]) == 60

    rows["v"] = _many_rows(55)
    bz.save_snapshot(bz.build_snapshot(_many_rows(200), [], NOW))  # 이전 200 → 55 는 절반 아래
    assert _run_collect(mod, monkeypatch) == 3
    assert _run_collect(mod, monkeypatch, ["--force"]) == 0 and len(bz.load_snapshot()["support"]["items"]) == 55


def test_collect_dry_run_does_not_write(monkeypatch):
    mod = _load_collect_module()
    monkeypatch.setenv("BIZINFO_API_KEY", "k1")
    monkeypatch.delenv("BIZINFO_EVENT_API_KEY", raising=False)

    async def fake_fetch(url, key, timeout_s=90):
        return _many_rows(80)

    monkeypatch.setattr(mod, "fetch_rows", fake_fetch)
    assert _run_collect(mod, monkeypatch, ["--dry-run"]) == 0
    assert bz.load_snapshot() is None


def test_error_messages_never_contain_the_key():
    mod = _load_collect_module()
    assert mod._redact("Cannot connect to https://x?crtfcKey=SECRETKEY&dataType=json", "SECRETKEY") == (
        "Cannot connect to https://x?crtfcKey=***&dataType=json"
    )


def test_missing_key_is_reported_not_crash(monkeypatch, capsys):
    mod = _load_collect_module()
    monkeypatch.delenv("BIZINFO_API_KEY", raising=False)
    assert _run_collect(mod, monkeypatch) == 2
    assert "BIZINFO_API_KEY" in capsys.readouterr().out
