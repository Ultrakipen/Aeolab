"""경쟁사 AI 노출을 비유도 표본 목록에서 판정하는 기능 테스트 — 2026-10-30.

과거: 경쟁사 이름을 질문에 넣어 따로 물음(유도형 — 환각으로 "추천됨"이 부풀 수 있음).
지금: 사업장 스캔의 비유도 추천 표본(place_counts)에서 이름을 대조한다.
"""
import asyncio
import inspect
import os

os.environ.setdefault("GEMINI_API_KEY", "test-key-not-used")
os.environ.setdefault("OPENAI_API_KEY", "test-key-not-used")

import pytest  # noqa: E402

from services import competitor_ai_exposure as cae  # noqa: E402
from services.ai_scanner.chatgpt_scanner import ChatGPTScanner  # noqa: E402
from services.ai_scanner.gemini_scanner import GeminiScanner  # noqa: E402
from services.competitor_place_crawler import compute_competitor_score  # noqa: E402


def _probe(counts, n=50, truncated=False):
    return {"probe": "recommend_v1", "sample_size": n, "place_counts": [{"name": k, "count": v} for k, v in counts.items()],
            "place_counts_truncated": truncated}


# ── place_counts 생성(두 스캐너 공통) ──
@pytest.mark.parametrize("cls", [ChatGPTScanner, GeminiScanner])
def test_place_counts_count_a_name_once_per_sample(monkeypatch, cls):
    sc = cls()

    async def fake_once(q):
        return {"places": ["카페모모", "A", "A", "내가게"], "_measured": True}   # A가 한 목록에 두 번

    async def no_sleep(*a, **k):
        return None

    monkeypatch.setattr(sc, "_recommend_once", fake_once)
    monkeypatch.setattr(asyncio, "sleep", no_sleep)
    r = asyncio.run(sc.sample_recommend("q", "내가게", n=3))
    pc = {p["name"]: p["count"] for p in r["place_counts"]}
    assert pc["A"] == 3 and pc["카페모모"] == 3          # 표본당 1회 — 3표본이면 3, 6이 아니다
    assert "내가게" not in pc                             # 내 가게는 경쟁 후보 집계에서 제외
    assert r["place_counts_truncated"] is False
    assert {p["name"]: p["count"] for p in r["top_places"]}["A"] == 6   # 기존 top_places는 그대로(등장 횟수)


@pytest.mark.parametrize("cls", [ChatGPTScanner, GeminiScanner])
def test_place_counts_cap_sets_truncated(monkeypatch, cls):
    import services.ai_scanner.chatgpt_scanner as cg
    import services.ai_scanner.gemini_scanner as gm
    monkeypatch.setattr(cg, "PLACE_COUNTS_CAP", 3)
    monkeypatch.setattr(gm, "PLACE_COUNTS_CAP", 3)
    sc = cls()
    seq = iter([["a", "b", "c", "d", "e"]])

    async def fake_once(q):
        return {"places": next(seq), "_measured": True}

    async def no_sleep(*a, **k):
        return None

    monkeypatch.setattr(sc, "_recommend_once", fake_once)
    monkeypatch.setattr(asyncio, "sleep", no_sleep)
    r = asyncio.run(sc.sample_recommend("q", "내가게", n=1))
    assert len(r["place_counts"]) == 3 and r["place_counts_truncated"] is True


# ── competitor_exposure ──
def test_branch_name_matches_but_prefix_substring_does_not():
    g = _probe({"카페모모": 7, "카페모모카": 40})
    assert cae.competitor_exposure("카페모모 성수점", g, None)["count"] == 7   # 지점 표기만 다르면 같은 가게
    only_other = _probe({"카페모모카": 40})
    assert cae.competitor_exposure("카페모모", only_other, None)["count"] == 0  # "카페모모카"는 다른 가게


def test_prefers_gemini_then_falls_back_to_chatgpt():
    g = _probe({"A": 5}, n=50)
    c = _probe({"A": 9}, n=40)
    assert cae.competitor_exposure("A", g, c)["source"] == "gemini"
    g_failed = {**g, "sample_size": 0}
    r = cae.competitor_exposure("A", g_failed, c)
    assert r["source"] == "chatgpt" and r["count"] == 9 and r["sample_size"] == 40


def test_no_usable_sample_is_unmeasured_not_zero():
    r = cae.competitor_exposure("A", None, None)
    assert r["_measured"] is False and r["error"] == "no_recommend_sample"


def test_legacy_result_without_place_counts_is_unmeasured():
    legacy = {"probe": "recommend_v1", "sample_size": 50, "exposure_freq": 3}   # 이 방식 도입 전 스캔
    assert cae.competitor_exposure("A", legacy, None)["_measured"] is False
    guided = {"sample_size": 50, "place_counts": []}                              # 유도형(probe 표시 없음)은 쓰지 않는다
    assert cae.competitor_exposure("A", guided, None)["_measured"] is False


def test_truncated_list_without_the_name_is_unmeasured_but_found_name_is_measured():
    g = _probe({"B": 9}, truncated=True)
    assert cae.competitor_exposure("A", g, None)["_measured"] is False
    assert cae.competitor_exposure("B", g, None)["_measured"] is True


def test_zero_when_measured_and_absent():
    r = cae.competitor_exposure("A", _probe({"B": 9}), None)
    assert r["_measured"] is True and r["mentioned"] is False and r["count"] == 0 and r["exposure_freq"] == 0.0


def test_count_never_exceeds_sample_size_and_scale_is_zero_to_ten():
    r = cae.competitor_exposure("A", _probe({"A": 80}, n=50), None)
    assert r["count"] == 50 and r["exposure_freq"] == 10.0
    assert cae.competitor_exposure("A", _probe({"A": 5}, n=50), None)["exposure_freq"] == 1.0


def test_score_scale_stays_within_previous_band():
    """freq_bonus(min(20, freq*2))를 쓰는 기존 공식과 척도가 어긋나지 않는다 — 미언급 0, 언급 40~60."""
    comp = {}
    s0, _ = compute_competitor_score(comp, False, 0.0, "")
    s_low, b_low = compute_competitor_score(comp, True, 0.2, "")
    s_hi, b_hi = compute_competitor_score(comp, True, 10.0, "")
    assert b_low["multi_ai_exposure"] == 40.4 and b_hi["multi_ai_exposure"] == 60.0
    assert s0 == 0.0 and s_low < s_hi


# ── 호출 구조 ──
def test_competitor_flows_no_longer_ask_by_name():
    from routers import competitor, scan
    from scheduler import jobs
    sources = {
        "scan._enrich_scan_background": inspect.getsource(scan._enrich_scan_background),
        "jobs.daily_scan_all": inspect.getsource(jobs.daily_scan_all),
        "competitor._scan_new_competitor": inspect.getsource(competitor._scan_new_competitor),
    }
    for name, src in sources.items():
        assert "competitor_exposure(" in src, name
        assert "single_check_with_competitors" not in src, name
    assert "single_check(query, c[\"name\"])" not in sources["jobs.daily_scan_all"]
    # 기본 체험의 백그라운드 풀스캔(run_basic_trial)도 같은 방식
    full_src = inspect.getsource(scan)
    assert full_src.count("single_check_with_competitors") == 0


def test_excerpt_enrichment_skips_new_method_entries():
    from scheduler import jobs
    assert 'not data.get("ai_basis")' in inspect.getsource(jobs._enrich_competitor_excerpts)


# ── 신규 경쟁사 등록: 최근 스캔에 목록이 없으면 0으로 저장하지 않고 건너뛴다 ──
class _Q:
    def __init__(self, store, name):
        self.store, self.name, self.data = store, name, None
        self.updates = None

    def __getattr__(self, attr):
        def chain(*a, **k):
            if attr == "update":
                self.store.setdefault("updates", []).append(a[0])
            return self
        return chain


class _SB:
    def __init__(self, tables):
        self.tables, self.store = tables, {}

    def table(self, name):
        q = _Q(self.store, name)
        q.data = self.tables.get(name)
        return q


def _run_scan_new(monkeypatch, scan_row):
    from routers import competitor
    sb = _SB({
        "businesses": {"name": "내가게", "category": "restaurant", "region": "창원"},
        "scan_results": scan_row,
        "competitors": {},
    })

    async def fake_execute(q):
        return q

    monkeypatch.setattr(competitor, "execute", fake_execute)
    asyncio.run(competitor._scan_new_competitor("c1", "경쟁식당", "b1", sb))
    return sb.store.get("updates")


def test_new_competitor_skips_when_latest_scan_has_no_list(monkeypatch):
    legacy_scan = {"id": "s1", "competitor_scores": {}, "gemini_result": {"probe": "recommend_v1", "sample_size": 50}, "chatgpt_result": None}
    assert _run_scan_new(monkeypatch, legacy_scan) is None   # 갱신 없음 — 0점으로 기록하지 않는다


def test_new_competitor_written_with_counts_when_list_exists(monkeypatch):
    scan_row = {"id": "s1", "competitor_scores": {}, "chatgpt_result": None,
                "gemini_result": _probe({"경쟁식당": 12}, n=50)}
    ups = _run_scan_new(monkeypatch, scan_row)
    entry = ups[0]["competitor_scores"]["c1"]
    assert entry["ai_count"] == 12 and entry["ai_sample_size"] == 50 and entry["ai_basis"] == "recommend_v1"
    assert entry["mentioned"] is True and entry["excerpt"] == ""


# ── 저장 압축(compact_for_storage) ──
def test_compact_keeps_top_and_flags_truncated_without_touching_original():
    big = _probe({f"가게{i:03d}": 100 - i for i in range(120)}, n=100)
    out = cae.compact_for_storage(big)
    assert len(out["place_counts"]) == cae.STORED_PLACE_COUNTS and out["place_counts_truncated"] is True
    assert out["place_counts"][0]["name"] == "가게000"            # 상위(등장 많은 순)를 남긴다
    assert len(big["place_counts"]) == 120 and big["place_counts_truncated"] is False   # 원본은 그대로 — 이어서 경쟁사 대조에 쓴다


def test_compact_leaves_small_lists_none_and_legacy_results_alone():
    small = _probe({"A": 3})
    assert cae.compact_for_storage(small) is small
    assert cae.compact_for_storage(None) is None
    legacy = {"probe": "recommend_v1", "sample_size": 50}
    assert cae.compact_for_storage(legacy) is legacy


def test_full_list_measures_a_rare_competitor_but_stored_list_does_not_claim_zero():
    names = {f"가게{i:03d}": 100 - i for i in range(120)}
    names["희귀경쟁사"] = 1
    full = _probe(names, n=100)
    assert cae.competitor_exposure("희귀경쟁사", full, None)["count"] == 1                     # 스캔 직후(전체 목록)에는 잡힌다
    stored = cae.compact_for_storage(full)
    r = cae.competitor_exposure("희귀경쟁사", stored, None)
    assert r["_measured"] is False and r["error"] == "place_counts_truncated"                    # 저장본에서는 0으로 확정하지 않는다


def test_every_persistence_site_goes_through_compaction():
    """새 스캔 결과(result/results/ai_result의 gemini·chatgpt)를 저장·응답에 싣는 모든 지점이 압축을 거친다."""
    import pathlib
    import re
    root = pathlib.Path(__file__).resolve().parents[1]
    found = 0
    for rel in ("routers/scan.py", "scheduler/jobs.py"):
        src = (root / rel).read_text(encoding="utf-8")
        for m in re.finditer(r'"(?:gemini|chatgpt)_result":\s*([^\n]+)', src):
            val = m.group(1)
            if ', {}' in val or not re.search(r'(?:ai_result|results?)\.get\("(?:gemini|chatgpt)"', val):
                continue   # 읽기 전용(이전 스캔 전달·_check_first_exposure 입력)·체험 증거 데이터 등 새 표본 목록을 싣지 않는 값
            found += 1
            assert "compact_for_storage(" in val, (rel, val[:80])
    assert found >= 7   # 지점 수가 줄면(패턴이 어긋나면) 검사가 비어 통과하는 것을 막는다


# ── 측정 방식 전환 구간의 알림 억제 ──
def test_basis_changed_detects_legacy_vs_new_and_ignores_same_basis():
    legacy = {"score": 47.0, "mentioned": True}
    new = {"score": 12.0, "mentioned": False, "ai_basis": "recommend_v1"}
    assert cae.basis_changed(new, legacy) is True and cae.basis_changed(legacy, new) is True
    assert cae.basis_changed(legacy, {"score": 40.0}) is False
    assert cae.basis_changed(new, {**new, "score": 30.0}) is False
    assert cae.basis_changed(None, None) is False


def test_competitor_change_alerts_skip_basis_transition():
    import inspect
    from scheduler import jobs
    src = inspect.getsource(jobs)
    assert src.count("basis_changed(") >= 2   # 점수 변화 알림(≥5)과 급등 알림(≥15) 두 곳 모두


def test_transition_scan_would_have_triggered_alert_without_guard():
    """방식만 바뀌어도 점수가 5점 넘게 움직인다는 것을 실제 공식으로 보인다(가드가 필요한 이유)."""
    comp = {"detail_synced_at": "2026-10-29", "naver_review_count": 10, "naver_avg_rating": 4.5,
            "has_intro": True, "has_menu": True, "has_recent_post": True, "blog_mention_count": 4}
    legacy_score, _ = compute_competitor_score(comp, True, 1, "x" * 120)   # 이름을 직접 물었을 때 "언급됨"(발췌문 길이 100자 초과)
    new_score, _ = compute_competitor_score(comp, False, 0.0, "")          # 같은 경쟁사가 표본 목록에는 없음
    assert abs(legacy_score - new_score) >= 5
