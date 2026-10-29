"""블로그 언급 조회 실패는 "블로그 0건"이 아니라 "모름" (2026-10-29, error ≠ false).

naver_visibility는 조회 실패 시 blog_mentions=0을 돌려주던 탓에, 인기 가게도 블로그 API가 한 번 실패하면
Track1 blog_crank(10%)·Track2 online_mentions(20%)가 최하점으로 들어갔다. 이제 blog_checked=False로 표시하고
점수는 그 항목을 제외한 나머지 가중치로 재정규화한다. 표시 키가 없는 기존 데이터는 이전과 동일하게 계산한다.
"""
import asyncio

import pytest

import services.naver_visibility as nv
from services import score_engine as se

_BIZ = {"name": "테스트식당", "category": "restaurant", "review_count": 300, "avg_rating": 4.5,
        "has_intro": True, "has_recent_post": True, "naver_place_id": "1"}
_SCAN = {"naver": {"mentioned": True, "in_briefing": False}, "naver_result": {"mentioned": True}}


def _nd(**kw):
    base = {"my_rank": 2, "naver_place_rank": 2, "is_smart_place": True, "blog_mentions": 0, "top_blogs": []}
    base.update(kw)
    return base


def _t1(fn, nd):
    return fn(_SCAN, _BIZ, nd, None, "restaurant")


# ── 점수: Track1 ─────────────────────────────────────────────────────────
@pytest.mark.parametrize("fn", [se.calc_track1_score_v3_1, se.calc_track1_score_v3_2])
def test_failed_blog_lookup_is_excluded_not_zeroed(fn):
    failed, d_failed = _t1(fn, _nd(blog_checked=False))
    real_zero, d_zero = _t1(fn, _nd(blog_checked=True))
    assert "blog_crank" in d_failed["excluded"]
    assert "blog_crank" not in d_zero["excluded"]
    assert failed > real_zero          # 실패를 0점으로 세지 않으니 실측 0건보다 낮아질 수 없다


@pytest.mark.parametrize("fn", [se.calc_track1_score_v3_1, se.calc_track1_score_v3_2])
def test_missing_flag_keeps_previous_behavior(fn):
    legacy, d_legacy = _t1(fn, _nd())
    checked, _ = _t1(fn, _nd(blog_checked=True))
    assert legacy == checked and "blog_crank" not in d_legacy["excluded"]


@pytest.mark.parametrize("fn", [se.calc_track1_score_v3_1, se.calc_track1_score_v3_2])
def test_measured_blog_count_still_counts(fn):
    many, _ = _t1(fn, _nd(blog_checked=True, blog_mentions=150, top_blogs=[{"title": "테스트식당 후기", "description": ""}]))
    none, _ = _t1(fn, _nd(blog_checked=True))
    assert many > none                 # 실측 블로그가 많으면 여전히 점수에 반영


# ── 점수: Track2 ─────────────────────────────────────────────────────────
_G_OK = {"google": {"captcha_detected": False, "mentioned": True, "in_ai_overview": True}}


def _t2(nd, scan=None):
    return se.calc_track2_score({**_SCAN, **(scan or _G_OK)}, _BIZ, nd)


def test_track2_excludes_online_mentions_on_failure():
    w = se.GLOBAL_TRACK_WEIGHTS
    scan = {**_SCAN, **_G_OK}
    ai, sch, goo = se.calc_multi_ai_exposure(scan), se.calc_schema_seo(scan, _BIZ), se.calc_google_presence(scan)
    expected = (ai * w["multi_ai_exposure"] + sch * w["schema_seo"] + goo * w["google_presence"]) / (1 - w["online_mentions"])
    assert _t2(_nd(blog_checked=False)) == round(expected, 1)


def test_track2_unchanged_when_flag_absent_or_true():
    w = se.GLOBAL_TRACK_WEIGHTS
    scan = {**_SCAN, **_G_OK}
    full = (se.calc_multi_ai_exposure(scan) * w["multi_ai_exposure"] + se.calc_schema_seo(scan, _BIZ) * w["schema_seo"]
            + se.calc_online_mentions(_nd()) * w["online_mentions"] + se.calc_google_presence(scan) * w["google_presence"])
    assert _t2(_nd()) == round(full, 1) == _t2(_nd(blog_checked=True))


def test_track2_google_unmeasured_path_unchanged():
    """기존 구글 측정 불가 경로(나머지 3개를 0.90으로 재배분)는 그대로여야 한다."""
    w = se.GLOBAL_TRACK_WEIGHTS
    scan = {**_SCAN, "google": {"captcha_detected": True}}
    expected = (se.calc_multi_ai_exposure(scan) * w["multi_ai_exposure"] + se.calc_schema_seo(scan, _BIZ) * w["schema_seo"]
                + se.calc_online_mentions(_nd()) * w["online_mentions"]) / (1 - w["google_presence"])
    assert _t2(_nd(), scan) == round(expected, 1)


def test_track2_both_unmeasured_uses_remaining_two():
    w = se.GLOBAL_TRACK_WEIGHTS
    scan = {**_SCAN, "google": {"captcha_detected": True}}
    expected = (se.calc_multi_ai_exposure(scan) * w["multi_ai_exposure"] + se.calc_schema_seo(scan, _BIZ) * w["schema_seo"]) \
        / (w["multi_ai_exposure"] + w["schema_seo"])
    assert _t2(_nd(blog_checked=False), scan) == round(expected, 1)


# ── 조회: naver_visibility가 실패를 표시한다 ────────────────────────────────
def _patch_visibility(monkeypatch, verified):
    import services.blog_mention_verifier as bmv

    async def fake_get(kind, params):
        return {}

    async def fake_verified(*_a, **_k):
        return verified

    monkeypatch.setattr(nv, "_get", fake_get)
    monkeypatch.setattr(bmv, "fetch_verified_blog", fake_verified)


def test_visibility_marks_failed_blog_lookup(monkeypatch):
    _patch_visibility(monkeypatch, None)
    r = asyncio.run(nv.get_naver_visibility("테스트식당", "맛집", "성동구"))
    assert r["blog_checked"] is False and r["blog_mentions"] == 0


def test_visibility_marks_successful_lookup_even_when_zero(monkeypatch):
    _patch_visibility(monkeypatch, {"count": 0, "api_total": 0, "kw_counts": {}, "capped": False})
    r = asyncio.run(nv.get_naver_visibility("테스트식당", "맛집", "성동구"))
    assert r["blog_checked"] is True and r["blog_mentions"] == 0     # 실측 0건은 실패와 다르다


def test_multi_checked_if_any_keyword_succeeded(monkeypatch):
    async def fake_single(name, kw, region):
        ok = kw == "b"
        return {"my_rank": None, "blog_mentions": 7 if ok else 0, "blog_checked": ok, "search_query": kw}

    async def no_sleep(_s):
        return None

    monkeypatch.setattr(nv, "get_naver_visibility", fake_single)
    monkeypatch.setattr(asyncio, "sleep", no_sleep)
    r = asyncio.run(nv.get_naver_visibility_multi("x", ["a", "b"], "성동구"))
    assert r["blog_checked"] is True and r["blog_mentions"] == 7


def test_multi_checked_even_when_best_ranked_keyword_failed(monkeypatch):
    """순위가 잡혀 best로 뽑힌 키워드의 블로그 조회는 실패했고 다른 키워드는 성공한 경우 — 병합 코드가 있어야 True가 된다."""
    async def fake_single(name, kw, region):
        if kw == "a":
            return {"my_rank": 1, "blog_mentions": 0, "blog_checked": False, "search_query": kw}
        return {"my_rank": None, "blog_mentions": 9, "blog_checked": True, "search_query": kw}

    async def no_sleep(_s):
        return None

    monkeypatch.setattr(nv, "get_naver_visibility", fake_single)
    monkeypatch.setattr(asyncio, "sleep", no_sleep)
    r = asyncio.run(nv.get_naver_visibility_multi("x", ["a", "b"], "성동구"))
    assert r["my_rank"] == 1 and r["blog_mentions"] == 9 and r["blog_checked"] is True


def test_multi_unchecked_if_all_keywords_failed(monkeypatch):
    async def fake_single(name, kw, region):
        return {"my_rank": None, "blog_mentions": 0, "blog_checked": False, "search_query": kw}

    async def no_sleep(_s):
        return None

    monkeypatch.setattr(nv, "get_naver_visibility", fake_single)
    monkeypatch.setattr(asyncio, "sleep", no_sleep)
    r = asyncio.run(nv.get_naver_visibility_multi("x", ["a", "b"], "성동구"))
    assert r["blog_checked"] is False


# ── 병합: 수동 스캔·정기 스캔 공용 build_naver_data ──────────────────────────
def test_build_naver_data_marks_failed_visibility_as_unknown_blog():
    for bad in (None, {}, Exception("boom"), "x"):
        d = nv.build_naver_data(bad, {"mentioned": True})
        assert d["blog_checked"] is False and d["mentioned"] is True


def test_build_naver_data_keeps_visibility_when_ok():
    d = nv.build_naver_data({"my_rank": 3, "blog_mentions": 40, "blog_checked": True}, {"mentioned": True, "rank": 2})
    assert d["my_rank"] == 3 and d["blog_mentions"] == 40 and d["blog_checked"] is True and d["rank"] == 2


@pytest.mark.parametrize("scan", [
    {"captcha_detected": True},
    {"quota_skipped": True},
    {"error": "page_load_failed"},
    {"error": "briefing_unrecognized"},
])
def test_build_naver_data_does_not_overwrite_with_failed_scan(scan):
    """측정 실패한 스캐너 결과가 mentioned/in_briefing/rank를 '미노출'로 덮어쓰면 안 된다."""
    d = nv.build_naver_data({"my_rank": 3, "blog_checked": True}, {**scan, "mentioned": False, "in_briefing": False, "rank": 9})
    assert "mentioned" not in d and "in_briefing" not in d and "rank" not in d
    assert d["my_rank"] == 3


def test_scheduled_scan_passes_naver_data_to_scoring():
    """정기 스캔이 가시성 결과를 채점에 넘기는지 — 빠지면 블로그 항목이 다시 항상 최하점이 된다."""
    import re
    src = open("scheduler/jobs.py", encoding="utf-8").read()
    assert re.search(r"calculate_score\(_sched_combined_result,\s*biz,\s*naver_data=_sched_naver_data", src)
    assert "get_naver_visibility_multi(biz[\"name\"]" in src and "build_naver_data(_sched_naver_vis" in src


def test_manual_stream_scan_uses_shared_merge():
    src = open("routers/scan.py", encoding="utf-8").read()
    assert "naver_data = build_naver_data(naver_visibility, naver_scanner_result)" in src




def test_every_manual_scan_path_marks_failed_visibility():
    """체험·빠른 스캔·풀스캔도 가시성 조회 실패를 표시 없는 빈 dict로 채점에 넘기면 안 된다.

    (스트림 경로는 build_naver_data를 거쳐 항상 표시가 붙으므로 위 테스트로 확인한다.)
    """
    src = open("routers/scan.py", encoding="utf-8").read()
    assert 'naver_data=naver_data or {"blog_checked": False},   # 가시성 조회 실패' in src      # 무료 체험
    assert 'naver_data = {"blog_checked": False}' in src                                          # 빠른 스캔 예외
    assert 'calculate_score(combined_result, biz or {}, naver_data=naver_data or {"blog_checked": False})' in src
    assert 'naver_visibility_full if isinstance(naver_visibility_full, dict) and naver_visibility_full else {"blog_checked": False}' in src   # 풀스캔
