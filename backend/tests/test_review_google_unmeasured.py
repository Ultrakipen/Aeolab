"""리뷰·구글 미측정을 "0점"으로 세지 않는지 검증 (2026-10-27).

배경: 무료 체험은 리뷰 수·평점을 수집하지 않고 구글 AI 개요도 측정하지 않는데,
- review_quality(가중 15~20%)가 0점으로 평균에 들어가고
- google_presence(가중 20%)가 "측정된 0점"으로 들어가 체험 254건 전부 같은 방향으로 낮게 저장됐다.
None(수집 안 함)과 0(실측 0건)을 구분해 미수집만 제외 후 재정규화한다.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.score_engine import (  # noqa: E402
    _is_google_unmeasured,
    _is_review_unmeasured,
    calc_track1_score_v3_1,
    calc_track1_score_v3_2,
    calc_track2_score,
)


def test_review_none_is_unmeasured():
    assert _is_review_unmeasured({}) is True
    assert _is_review_unmeasured({"review_count": None}) is True


def test_review_zero_is_measured():
    # 리뷰 0건은 실측 값 — 제외하면 안 된다
    assert _is_review_unmeasured({"review_count": 0}) is False
    assert _is_review_unmeasured({"review_count": None, "avg_rating": 4.5}) is False
    assert _is_review_unmeasured({"review_count": None, "receipt_review_count": 3}) is False


def test_registered_business_without_place_id_and_default_zero_is_unmeasured():
    """등록 사업장의 DB 기본값 0(DEFAULT 0, 생성 시 `or 0`)은 측정이 아니다 — 플레이스 ID가 없으면 수집할 길이 없다."""
    zero = {"review_count": 0, "avg_rating": 0, "receipt_review_count": 0, "visitor_review_count": 0}
    assert _is_review_unmeasured({**zero, "naver_place_id": None}) is True
    assert _is_review_unmeasured({**zero, "naver_place_id": ""}) is True
    assert _is_review_unmeasured({**zero, "naver_place_id": "  "}) is True


def test_registered_business_with_place_id_or_any_value_keeps_zero_as_measured():
    zero = {"review_count": 0, "avg_rating": 0, "receipt_review_count": 0, "visitor_review_count": 0}
    assert _is_review_unmeasured({**zero, "naver_place_id": "38561949"}) is False       # ID가 있으면 스캔이 수집한다 — 0은 실측
    assert _is_review_unmeasured({**zero, "naver_place_id": None, "review_count": 12}) is False   # 사용자가 직접 입력
    assert _is_review_unmeasured({**zero, "naver_place_id": None, "avg_rating": 4.2}) is False
    assert _is_review_unmeasured({**zero, "naver_place_id": None, "visitor_review_count": 3}) is False
    assert _is_review_unmeasured({"review_count": 0}) is False                           # 키가 없는 dict는 기존 동작 유지


def test_track1_default_zero_without_place_id_is_excluded_not_zero_scored():
    for fn in (calc_track1_score_v3_1, calc_track1_score_v3_2):
        zero = {"review_count": 0, "avg_rating": 0, "receipt_review_count": 0, "visitor_review_count": 0}
        s_noid, d_noid = _t1(fn, {**zero, "naver_place_id": None})
        s_id, d_id = _t1(fn, {**zero, "naver_place_id": "123"})
        assert "review_quality" in d_noid["excluded"] and d_noid["items"]["review_quality"]["measured"] is False
        assert "review_quality" not in d_id["excluded"]
        assert s_noid > s_id                       # ID 없는 기본값 0이 실측 0건보다 불리하면 안 된다


def test_google_empty_result_is_unmeasured():
    assert _is_google_unmeasured({}) is True
    assert _is_google_unmeasured({"google": {}}) is True
    assert _is_google_unmeasured({"google": {"captcha_detected": True}}) is True
    assert _is_google_unmeasured({"google": {"error": "x"}}) is True


def test_google_measured_not_mentioned_is_not_unmeasured():
    # 실측했는데 미노출 — 0점으로 세는 게 맞다
    assert _is_google_unmeasured({"google": {"mentioned": False}}) is False


def test_track2_google_not_run_is_renormalized():
    nd = {"blog_mentions": 100}
    not_run = calc_track2_score({}, {}, nd)
    measured_zero = calc_track2_score({"google": {"mentioned": False}}, {}, nd)
    assert not_run > measured_zero


_NAVER = {"is_smart_place": True, "my_rank": 1}


def _t1(fn, biz):
    return fn({}, {"category": "restaurant", **biz}, _NAVER, None, "restaurant")


def test_track1_review_unmeasured_excluded_both_versions():
    for fn in (calc_track1_score_v3_1, calc_track1_score_v3_2):
        score_none, d_none = _t1(fn, {})
        score_zero, d_zero = _t1(fn, {"review_count": 0})
        assert "review_quality" in d_none["excluded"]
        assert d_none["items"]["review_quality"]["measured"] is False
        assert "review_quality" not in d_zero["excluded"]
        assert d_zero["items"]["review_quality"]["measured"] is True
        # 미수집은 실측 0건보다 불리하지 않다
        assert score_none > score_zero


def test_track1_review_measured_matches_old_behavior():
    # 구독자 경로(review_count가 정수)는 계산이 바뀌지 않는다
    score, d = _t1(calc_track1_score_v3_1, {"review_count": 80, "avg_rating": 4.5})
    assert "review_quality" not in d["excluded"]


def test_share_card_category_avg_needs_min_sample():
    """공유 카드 업종 평균은 report.py /benchmark와 같이 5건 미만이면 None (비교 줄 생략)."""
    import asyncio
    from unittest.mock import patch

    import importlib

    # 다른 테스트가 services.share_card를 가짜 모듈로 등록해 두는 경우가 있어, 가져오는 동안만 진짜 모듈을 쓴다
    with patch.dict(sys.modules):
        _m = sys.modules.get("services.share_card")
        if _m is not None and getattr(_m, "__file__", None) is None:
            sys.modules.pop("services.share_card")
        sys.modules.pop("routers.share", None)
        share = importlib.import_module("routers.share")

    class _Res:
        def __init__(self, n):
            self.data = [{"total_score": 10.0 + i} for i in range(n)]

    class _Q:
        def __init__(self, n):
            self.n = n

        # supabase 체인의 `.not_.is_(...)`는 속성 접근 뒤 호출이라 not_은 호출 가능 값이 아니라 self여야 한다
        not_ = property(lambda self: self)

        def __getattr__(self, _):
            return lambda *a, **k: self

    class _SB:
        def __init__(self, n):
            self.n = n

        def table(self, _):
            return _Q(self.n)

    async def _run(n):
        async def _exec(_q):
            return _Res(n)

        with patch.object(share, "execute", _exec):
            return await share._resolve_category_avg(_SB(n), "cafe", "서울 성동구")

    assert asyncio.run(_run(4)) is None
    assert asyncio.run(_run(5)) is not None
