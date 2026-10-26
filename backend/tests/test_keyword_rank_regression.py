"""키워드 순위 측정 회귀 테스트 (2026-10-26).

사고: naver_keyword_rank가 `local.json`을 넘겨 search_request가 ValueError →
모든 키워드가 error+None으로 저장되고, 화면은 "미노출"로 표시했다.
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.naver_api_hub import search_request
from services import naver_keyword_rank as kr
from services.score_engine import calc_keyword_search_rank_score


def test_place_api_kind_is_valid(monkeypatch):
    """장소 순위 API가 search_request가 받아들이는 kind로 호출되는지."""
    seen = {}

    async def fake_get(kind, params):
        seen["kind"] = kind
        search_request(kind)  # 유효하지 않으면 ValueError
        return {"items": [{"title": "<b>어니언</b> 성수", "link": "https://x/38561949"}]}

    monkeypatch.setattr(kr, "_naver_open_api_get", fake_get)
    rank = asyncio.run(kr._measure_place_api("성수 카페", "어니언 성수", "38561949"))
    assert seen["kind"] == "local"
    assert rank == 1


def test_score_ignores_error_rows():
    """측정 실패 키워드는 0점으로 평균을 깎지 않는다."""
    ranks = {
        "a": {"pc_rank": 1, "mobile_rank": None, "place_rank": None},
        "b": {"pc_rank": None, "mobile_rank": None, "place_rank": None, "error": "ValueError"},
    }
    score, measured = calc_keyword_search_rank_score({"keyword_ranks": ranks})
    assert measured is True
    assert score == 100.0


def test_score_all_errors_is_unmeasured():
    ranks = {"a": {"pc_rank": None, "error": "ValueError"}}
    assert calc_keyword_search_rank_score({"keyword_ranks": ranks}) == (0.0, False)


class _FakePage:
    def __init__(self, cards):
        self.cards = cards

    async def wait_for_timeout(self, ms):
        return None

    async def evaluate(self, js):
        return self.cards


def test_card_rank_uses_card_order_not_html_presence():
    """ID가 카드 목록에 없으면 미노출(None) — HTML에 ID가 있다는 이유로 1위로 부풀리지 않는다."""
    cards = [{"id": "111111", "text": "다른 가게"}, {"id": "222222", "text": "내 가게"}]
    assert asyncio.run(kr._place_card_rank(_FakePage(cards), "내가게", "222222")) == 2
    assert asyncio.run(kr._place_card_rank(_FakePage(cards), "내가게", "999999")) is None
    # ID 없는 사업장은 카드 글자의 이름으로 찾는다
    assert asyncio.run(kr._place_card_rank(_FakePage(cards), "내가게", None)) == 2


# ── 미측정 순위 점수 제외·재정규화 (2026-10-26) ──────────────────────────
from services.score_engine import _renormalized_track1
from services.gap_analyzer import _is_unmeasured_dimension

_W = {
    "keyword_search_rank": 0.25, "review_quality": 0.15, "smart_place_completeness": 0.15,
    "blog_crank": 0.10, "local_map_score": 0.10, "ai_briefing_score": 0.25,
}
_ITEMS = {
    "keyword_search_rank": 0.0, "review_quality": 60.0, "smart_place_completeness": 40.0,
    "blog_crank": 20.0, "local_map_score": 50.0, "ai_briefing_score": 80.0,
}


def test_renormalize_no_exclusion_equals_weighted_sum():
    expected = sum(_ITEMS[k] * _W[k] for k in _W)
    assert abs(_renormalized_track1(_ITEMS, _W, set()) - expected) < 1e-9


def test_renormalize_excluding_ai_matches_legacy_formula():
    """기존 AI 브리핑 제외식 sum(나머지)/(1-w_ai)와 동일해야 한다(회귀 방지)."""
    legacy = sum(_ITEMS[k] * _W[k] for k in _W if k != "ai_briefing_score") / (1 - _W["ai_briefing_score"])
    assert abs(_renormalized_track1(_ITEMS, _W, {"ai_briefing_score"}) - legacy) < 1e-9


def test_renormalize_excluding_rank_does_not_penalize_unmeasured():
    with_zero = _renormalized_track1(_ITEMS, _W, set())
    excluded = _renormalized_track1(_ITEMS, _W, {"keyword_search_rank"})
    assert excluded > with_zero
    # 나머지 항목이 전부 100점이면 순위 제외 시 정확히 100점
    full = {k: 100.0 for k in _ITEMS}
    full["keyword_search_rank"] = 0.0
    assert abs(_renormalized_track1(full, _W, {"keyword_search_rank"}) - 100.0) < 1e-9


def test_renormalize_all_excluded_is_zero():
    assert _renormalized_track1(_ITEMS, _W, set(_W)) == 0.0


def test_gap_skips_unmeasured_rank_only():
    assert _is_unmeasured_dimension("keyword_search_rank", {}) is True
    assert _is_unmeasured_dimension("keyword_search_rank", {"keyword_search_rank": 0.0}) is True
    assert _is_unmeasured_dimension("keyword_search_rank", {"keyword_search_rank": 60.0}) is False
    assert _is_unmeasured_dimension("review_quality", {}) is False


def test_recheck_skipped_when_quota_nearly_exhausted(monkeypatch):
    """일일 상한 임박 시 선택적 재확인(새로고침·대기)은 건너뛰고 필수 측정만 한다."""
    monkeypatch.setattr(kr, "naver_playwright_quota_usage", lambda: (210, 250))  # 84% ≥ 80%
    before = kr._recheck_stats["skipped"]
    assert asyncio.run(kr._place_card_rank(_FakePage([]), "내가게", "222222")) is None
    assert kr._recheck_stats["skipped"] == before + 1


def test_recheck_runs_when_quota_has_room(monkeypatch):
    monkeypatch.setattr(kr, "naver_playwright_quota_usage", lambda: (10, 250))
    before = kr._recheck_stats["rechecks"]
    asyncio.run(kr._place_card_rank(_FakePage([]), "내가게", "222222"))
    assert kr._recheck_stats["rechecks"] == before + 1


def test_score_ignores_underscore_meta_keys():
    """`_context` 메타 키가 0점 키워드로 세어져 평균을 깎거나 '측정됨'으로 만들면 안 된다."""
    ranks = {
        "a": {"pc_rank": 1, "mobile_rank": 1, "place_rank": 1},
        "_context": {"scanned_at": "x", "errors": []},
    }
    assert calc_keyword_search_rank_score({"keyword_ranks": ranks}) == (100.0, True)
    assert calc_keyword_search_rank_score({"keyword_ranks": {"_context": {"scanned_at": "x"}}}) == (0.0, False)


# ── 정기 순위 잡: 대량 실패 알림, 변동 알림의 측정 실패 처리 (2026-10-27) ──
def test_rank_job_alerts_on_mass_failure(monkeypatch):
    import scheduler.jobs as jobs
    import db.supabase_client as dbc
    import services.email_sender as es

    class R:
        def __init__(self, data):
            self.data = data

    async def fake_exec(q):
        return R(getattr(q, "_fake", []))

    class Q:
        def __init__(self, data): self._fake = data
        def select(self, *a, **k): return self
        def eq(self, *a, **k): return self
        def in_(self, *a, **k): return self

    class C:
        def table(self, name):
            return Q([{"user_id": "u1", "plan": "pro", "status": "active"}] if name == "subscriptions"
                     else [{"id": "b1", "user_id": "u1", "name": "n", "keywords": ["a"], "naver_place_id": "1", "region": "창원"},
                           {"id": "b2", "user_id": "u1", "name": "m", "keywords": ["b"], "naver_place_id": "2", "region": "창원"}])

    sent = []

    async def fake_alert(subject, message):
        sent.append(subject)
        return True

    async def failing(biz):
        return False

    async def no_sleep(*a, **k):
        return None

    monkeypatch.setattr(dbc, "get_client", lambda: C())
    monkeypatch.setattr(dbc, "execute", fake_exec)
    monkeypatch.setattr(es, "send_operator_alert", fake_alert)
    monkeypatch.setattr(jobs, "_measure_keyword_rank_for_biz", failing)
    monkeypatch.setattr(jobs.asyncio, "sleep", no_sleep)
    asyncio.run(jobs._run_keyword_rank_for_plans(["pro"]))
    assert sent == ["키워드 순위 측정 다수 실패"]


def test_keyword_change_notification_skips_failed_rows(monkeypatch):
    import scheduler.jobs as jobs
    # 이전 3위 → 이번 측정 실패(error): 99(미노출)로 오인해 'TOP10 이탈' 알림을 만들면 안 된다
    prev = {"성수 카페": {"pc_rank": 3, "mobile_rank": 3, "place_rank": 3}}
    curr = {"성수 카페": {"pc_rank": None, "mobile_rank": None, "place_rank": None, "error": "ValueError"}}
    touched = []

    import db.supabase_client as dbc

    def boom():
        touched.append(1)  # 알림 대상 조회까지 갔다면 변화로 판정된 것
        raise RuntimeError("should not reach profile lookup")

    monkeypatch.setattr(dbc, "get_client", boom)
    asyncio.run(jobs._maybe_notify_keyword_change({"user_id": "u", "name": "n"}, prev, curr))
    assert touched == []


def test_rank_canary_parse_and_alert(monkeypatch):
    import scheduler.jobs as jobs
    import services.email_sender as es
    import services.naver_keyword_rank as krmod

    assert jobs._parse_rank_canaries("어니언 성수|38561949; 이상한항목 ;가게|abc;B|12") == [("어니언 성수", "38561949"), ("B", "12")]
    assert jobs._parse_rank_canaries("") == []

    sent = []

    async def fake_alert(subject, message):
        sent.append(subject)
        return True

    async def no_sleep(*a, **k):
        return None

    monkeypatch.setenv("RANK_CANARY", "어니언 성수|38561949")
    monkeypatch.setattr(es, "send_operator_alert", fake_alert)
    monkeypatch.setattr(jobs.asyncio, "sleep", no_sleep)

    async def good(keywords, biz_name, place_id=None, region=None):
        return {keywords[0]: {"pc_rank": 1, "mobile_rank": 1, "place_rank": 1}}

    async def bad(keywords, biz_name, place_id=None, region=None):
        return {keywords[0]: {"pc_rank": None, "mobile_rank": 1, "place_rank": 1}}

    monkeypatch.setattr(krmod, "measure_keywords", good)
    asyncio.run(jobs.rank_canary_job())
    assert sent == []          # 정상이면 알림 없음

    monkeypatch.setattr(krmod, "measure_keywords", bad)
    asyncio.run(jobs.rank_canary_job())
    assert sent == ["키워드 순위 측정 점검 실패"]   # 재시도 후에도 어긋나면 알림


def test_guide_latest_reports_recent_generation_failure(monkeypatch):
    """가이드 생성이 실패하면 /latest가 404(생성 중처럼 보임)가 아니라 503+코드로 알린다."""
    import time as _t
    from fastapi import HTTPException
    import routers.guide as g

    class R:
        data = []

    async def fake_exec(q):
        return R()

    class Q:
        def select(self, *a, **k): return self
        def eq(self, *a, **k): return self
        def in_(self, *a, **k): return self
        def order(self, *a, **k): return self
        def limit(self, *a, **k): return self

    class C:
        def table(self, name): return Q()

    async def ok_owner(*a, **k): return None

    monkeypatch.setattr(g, "get_client", lambda: C())
    monkeypatch.setattr(g, "execute", fake_exec)
    monkeypatch.setattr(g, "_verify_biz_ownership", ok_owner)

    g._guide_generation_failures.clear()
    try:
        asyncio.run(g.get_latest_guide("b1", scan_id="s1", user={"id": "u"}))
        assert False, "404 expected"
    except HTTPException as e:
        assert e.status_code == 404

    g._guide_generation_failures["b1"] = _t.time()
    try:
        asyncio.run(g.get_latest_guide("b1", scan_id="s1", user={"id": "u"}))
        assert False, "503 expected"
    except HTTPException as e:
        assert e.status_code == 503 and e.detail["code"] == "GUIDE_GENERATION_FAILED"

    g._guide_generation_failures["b1"] = _t.time() - 3600   # 오래된 실패는 무시
    try:
        asyncio.run(g.get_latest_guide("b1", scan_id="s1", user={"id": "u"}))
        assert False, "404 expected"
    except HTTPException as e:
        assert e.status_code == 404


# ── 한쪽 AI 측정 실패는 0점이 아니라 다른 쪽만으로 평가 (2026-10-27) ──
def test_multi_ai_exposure_ignores_failed_side():
    from services.score_engine import calc_multi_ai_exposure as f
    chat = {"exposure_freq": 25, "sample_size": 50}                       # 50%
    gem_ok = {"exposure_freq": 25, "sample_size": 50}
    gem_fail = {"error": "quota"}
    gem_mass = {"exposure_freq": 0, "sample_size": 5, "failed_count": 95}  # 100회 중 95회 실패
    gem_zero = {"exposure_freq": 0, "sample_size": 0, "failed_count": 100}

    both = f({"gemini": gem_ok, "chatgpt": chat})
    assert both == 50.0
    # Gemini가 실패했으면 ChatGPT 50%만으로 50점 (예전엔 25점으로 깎였다)
    for g in (gem_fail, gem_mass, gem_zero):
        assert f({"gemini": g, "chatgpt": chat}) == 50.0, g
    # 반대로 ChatGPT가 실패하면 Gemini만으로
    assert f({"gemini": gem_ok, "chatgpt": {"error": "insufficient_quota"}}) == 50.0
    # 둘 다 실패면 0점(기존 동작)
    assert f({"gemini": gem_fail, "chatgpt": {"error": "x"}}) == 0.0
    # 정상 표본이 작을 뿐(10회 중 성공 10)이면 실패로 보지 않는다
    assert f({"gemini": {"exposure_freq": 5, "sample_size": 10, "failed_count": 0}, "chatgpt": chat}) == 50.0
    # Gemini를 아예 안 돌린 스캔(빈 dict)은 기존 동작 유지(실패로 보지 않음)
    assert f({"gemini": {}, "chatgpt": chat}) == round(22.5 * 100 / 90, 2)
