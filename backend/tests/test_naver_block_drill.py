"""네이버 차단 모의 훈련 (2026-11-02, 작업 T-5). 네이버에 접속하지 않는다 — 회로 상태 파일·가짜 DB·가짜 브라우저만 쓴다.

훈련으로 확인하는 것
 1) 차단 중 점수는 0점이 아니라 '제외 후 재정규화'다 (실제 점수 함수로 측정 성공 / 쿨다운 / 측정 후 미노출을 비교).
 2) 그 재정규화 점수는 측정 성공일과 같은 척도가 아니므로 '하락/개선/등급 변화/역전/단계 상승'으로 기록·알리면 안 된다.
    (발견: 같은 가게 시험에서 측정 성공 64.5 ↔ 쿨다운 54.6. 점수 변화 알림 3점·타임라인 기록 5점 임계를 모두 넘었다.)
 3) 검색 회로가 열려 있으면 순위 측정은 페이지 이동·새로고침을 한 번도 하지 않고 키워드마다 '측정 실패'로 끝난다.
"""
import asyncio
import inspect
import os
import sys
import time

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import change_signal_guard as csg  # noqa: E402
from services import naver_access_guard as g  # noqa: E402
from services.score_engine import calculate_score  # noqa: E402


# ── 1) 판정 ──────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("flags,expected", [
    ([False, False], True),       # 오늘·직전 모두 측정 성공
    ([False], True),              # 첫 스캔(비교 대상 없음)
    ([True, False], False),       # 오늘 측정 못 함
    ([False, True], False),       # 직전이 측정 못 함 — 차단이 풀린 다음 날의 반대 방향 가짜 변화
    ([True, True], False),
    ([], True),                   # 행이 없으면 비교할 것도 없다(호출부가 prev를 따로 요구)
    (None, False),                # 조회 실패 — 확인 못 한 변화는 알리지 않는다
])
def test_comparable_scans(flags, expected):
    assert csg.comparable_scans(flags) is expected


# ── 가짜 DB ──────────────────────────────────────────────────────────────────
class _R:
    def __init__(self, data):
        self.data = data


class _Q:
    """supabase 쿼리 체인 흉내 — 어떤 메서드든 자기 자신을 돌려주고, 호출 기록을 남긴다."""

    def __init__(self, table):
        self.table_name = table
        self.calls = []

    def __getattr__(self, name):
        if name == "not_":
            self.calls.append("not_")
            return self
        return lambda *a, **k: (self.calls.append((name, a)) or self)


class _SB:
    def __init__(self):
        self.last = {}

    def table(self, name):
        q = _Q(name)
        self.last[name] = q
        return q


def _patch_db(monkeypatch, data_by_table, guard_query_fails=False):
    """jobs._db(알림 잡 본체의 조회)와 db.supabase_client.execute(change_signal_guard의 조회)를 따로 가짜로 바꾼다.
    guard_query_fails=True면 가드의 조회만 실패한다 — 본체의 다른 조회까지 실패시키면 가드가 아닌 곳이 먼저 깨진다."""
    import db.supabase_client as dbc
    import scheduler.jobs as jobs

    async def fake_exec(q):
        return _R(data_by_table.get(q.table_name, []))

    async def guard_exec(q):
        if guard_query_fails:
            raise RuntimeError("db down")
        return await fake_exec(q)

    monkeypatch.setattr(dbc, "execute", guard_exec)
    monkeypatch.setattr(jobs, "_db", fake_exec)
    return fake_exec


_OK = {"mentioned": False, "in_briefing": False}                       # 측정했고 노출이 없었다 = 정상 측정
_BLOCKED = {"error": "naver_search_cooldown", "quota_skipped": True}    # 차단 쿨다운 중 측정 못 함


def test_recent_flags_filters_to_scored_scans_and_reads_two(monkeypatch):
    _patch_db(monkeypatch, {"scan_results": [{"naver_result": _OK}, {"naver_result": _BLOCKED}]})
    sb = _SB()
    assert asyncio.run(csg.recent_naver_unmeasured_flags(sb, "b1")) == [False, True]
    names = [c[0] if isinstance(c, tuple) else c for c in sb.last["scan_results"].calls]
    assert "not_" in names and "limit" in names                         # 순위 전용 행(track1_score 없음)을 거르고 2건만 읽는다
    assert ("limit", (2,)) in sb.last["scan_results"].calls
    assert ("is_", ("track1_score", "null")) in sb.last["scan_results"].calls


def test_recent_flags_failure_returns_none(monkeypatch):
    _patch_db(monkeypatch, {}, guard_query_fails=True)
    assert asyncio.run(csg.recent_naver_unmeasured_flags(_SB(), "b1")) is None


def test_recent_flags_missing_naver_result_counts_as_measured(monkeypatch):
    _patch_db(monkeypatch, {"scan_results": [{"naver_result": None}, {"naver_result": {}}]})
    assert asyncio.run(csg.recent_naver_unmeasured_flags(_SB(), "b1")) == [False, False]


# ── 2) 점수 변화 알림 경로 (동작) ─────────────────────────────────────────────────
class _Notifier:
    def __init__(self):
        self.score_changes = []

    async def send_score_change(self, *a, **k):
        self.score_changes.append(a)

    def __getattr__(self, name):                 # 다른 알림은 이 훈련의 대상이 아니다
        async def _noop(*a, **k):
            return None
        return _noop


_uploads: list = []         # 갭 카드 업로드 시도 기록(가짜) — 실제 Storage 호출은 없다
# 알림은 옵트인(2026-11-02 통일: NULL은 꺼짐) — 켠 사용자로 둬야 '차단된 날 억제' 시험이 알림 설정 때문이 아니라 차단 가드 때문에 통과한다
_USER = {"businesses": [{"id": "b1", "name": "테스트식당"}], "profiles": {"phone": "01000000000", "kakao_scan_notify": True, "kakao_competitor_notify": True}}
_HISTORY = [
    {"total_score": 54.6, "score_date": "2026-11-02", "rank_in_category": 3},
    {"total_score": 64.5, "score_date": "2026-10-30", "rank_in_category": 2},
]


def _run_notify(monkeypatch, scan_flags):
    import scheduler.jobs as jobs
    # scan_flags=None → 가드의 조회만 실패하는 경우(본체는 정상)
    scans = [{"naver_result": r, "competitor_scores": None, "total_score": 0, "score_breakdown": {}} for r in (scan_flags or [_OK, _OK])]
    data = {"score_history": _HISTORY, "scan_results": scans}
    _patch_db(monkeypatch, data, guard_query_fails=scan_flags is None)
    # 알림 함수 5단계가 갭 카드를 만들어 Supabase Storage에 올린다 — 환경변수가 로드된 서버에서 테스트가 돌면 운영 Storage에
    # 가짜 사업장(b1) 파일이 올라가므로 반드시 막는다(로컬은 키가 없어 우연히 실패했을 뿐이다).
    import services.gap_card as gap_card

    async def _no_upload(*a, **k):
        _uploads.append(1)
        return None

    monkeypatch.setattr(gap_card, "generate_and_upload_gap_card", _no_upload)
    # 5단계는 전달할 수 있을 때(자유 문구 발송이 켜진 때)만 갭 카드를 만든다(2026-11-02) — 이 하네스가 5단계까지 닿는지 확인하는 아래 단언을 유지하려면 켜 둔다.
    # 업로드는 위 가짜라 실제 Storage 호출은 없다.
    import services.kakao_notify as _kn_flag
    monkeypatch.setattr(_kn_flag, "_FREE_TEXT_ENABLED", True)
    _uploads.clear()
    n = _Notifier()
    asyncio.run(jobs._send_kakao_notifications(_SB(), n, _USER))
    assert _uploads, "5단계가 가짜 업로드까지 도달해야 한다(도달하지 않으면 이 가짜가 아무것도 막지 못하는 것)"
    return n.score_changes


def test_score_change_alert_sent_when_both_scans_measured(monkeypatch):
    assert len(_run_notify(monkeypatch, [_OK, _OK])) == 1


def test_score_change_alert_suppressed_when_tonight_blocked(monkeypatch):
    assert _run_notify(monkeypatch, [_BLOCKED, _OK]) == []


def test_score_change_alert_suppressed_when_previous_scan_was_blocked(monkeypatch):
    """차단이 풀린 다음 날 — 낮았던 직전 점수와의 비교는 가짜 '개선'이다."""
    assert _run_notify(monkeypatch, [_OK, _BLOCKED]) == []


def test_score_change_alert_suppressed_when_check_fails(monkeypatch):
    assert _run_notify(monkeypatch, None) == []


# ── 3) 야간 루프의 5개 신호가 가드를 거친다 (구조) ─────────────────────────────────
def _nightly_src():
    import scheduler.jobs as jobs
    fn = jobs.daily_scan_all
    return inspect.getsource(getattr(fn, "__wrapped__", fn))


def test_nightly_loop_gates_every_change_signal():
    s = _nightly_src()
    assert s.count("_cmp_ok = _tonight_measured and comparable_scans(") == 1
    # ① 주간 변화(스캔 완료 알림의 추세·등급 변화 메모 입력)
    assert "if _cmp_ok and prev_history and prev_history[0].get(\"score_date\") != today_str:" in s
    # ② 스캔 완료 알림
    assert "if _scan_notify_ok and not _is_naver_retry and _cmp_ok:" in s
    # ③ 성장 단계 상승 알림
    i = s.index("if not _cmp_ok:\n                                _hysteresis_blocked = True")
    assert i < s.index("await _KN().send_growth_stage_upgrade(")
    # ④ 타임라인 하락/개선 기록
    assert "if _cmp_ok:     # 네이버 측정이 빠진 스캔이 끼면 점수 차이는 변화가 아니다\n                        await _auto_log_score_change(" in s
    # ⑤ 경쟁사 역전 기록·알림 (오늘 점수만 문제)
    assert "if competitor_scores and _tonight_measured:" in s


def test_nightly_guard_is_computed_before_it_is_used():
    s = _nightly_src()
    first_use = min(s.index(t) for t in ("if _cmp_ok and prev_history", "and _cmp_ok:\n", "if _cmp_ok:     #", "and _tonight_measured:\n"))
    assert s.index("_cmp_ok = False") < first_use
    # 판정이 실패해도(예외) 기본값은 '비교 불가'다 — 확인 못 하면 알리지 않는다
    assert "_tonight_measured = False\n                _cmp_ok = False" in s


# ── 4) 점수: 차단은 0점이 아니라 제외 후 재정규화 (실제 점수 함수) ───────────────────────
_BIZ = {"category": "restaurant", "is_smart_place": True, "has_recent_post": True, "has_intro": True,
        "naver_intro_draft": "Q. a\nA. b\nQ. c\nA. d", "naver_place_id": "123", "review_count": 800, "avg_rating": 4.5,
        "receipt_review_count": 400, "visitor_review_count": 400, "keywords": ["성수 맛집"], "region": "서울 성동구"}
_ND = {"is_smart_place": True, "my_rank": 2, "blog_mentions": 40, "blog_checked": True}


def _scan(naver, ranks):
    return {
        "gemini": {"mentioned": True, "exposure_freq": 0.2, "sample_size": 50},
        "chatgpt": {"mentioned": False, "exposure_freq": 0.0, "sample_size": 50},
        "google": {"in_ai_overview": False},
        "kakao": {"is_on_kakao": True},
        "keyword_ranks": {"성수 맛집": ranks},
        "naver": naver,
    }


def test_blocked_night_is_renormalized_not_zero_and_not_the_same_scale():
    measured = calculate_score(_scan({"mentioned": True, "in_briefing": True, "rank": 1},
                                     {"pc_rank": 3, "mobile_rank": 2, "place_rank": 2}), _BIZ, naver_data=_ND)
    blocked = calculate_score(_scan(_BLOCKED, {"pc_rank": None, "mobile_rank": None, "place_rank": None, "error": "naver_search_cooldown"}),
                              _BIZ, naver_data=_ND)
    measured_zero = calculate_score(_scan(_OK, {"pc_rank": None, "mobile_rank": None, "place_rank": None}), _BIZ, naver_data=_ND)
    # 차단은 '측정 후 미노출 0점'보다 높다 = 0점 처리되지 않았다(지침 8·9)
    assert blocked["track1_score"] > measured_zero["track1_score"]
    assert blocked["total_score"] > 0
    # 그리고 측정 성공일과 같은 척도가 아니다 — 이 차이가 변화 기록·알림 가드가 필요한 이유다
    assert abs(blocked["total_score"] - measured["total_score"]) > 1.0


# ── 5) 검색 회로를 열고 순위 측정을 돌려도 네이버 요청이 0건 ─────────────────────────────
class _Tripwire:
    """페이지 이동·새로고침 등 네트워크를 쓰는 호출이 오면 실패하는 가짜 브라우저."""

    touched = []

    def __getattr__(self, name):
        if name in ("goto", "reload", "request", "route", "set_content"):
            async def _boom(*a, **k):
                _Tripwire.touched.append(name)
                raise AssertionError(f"차단 중 네이버 요청 시도: {name}")
            return _boom

        async def _f(*a, **k):
            return _Tripwire()
        return _f


class _PW:
    def __init__(self):
        self.chromium = self

    async def launch(self, **k):
        return _Tripwire()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False


def test_open_search_circuit_means_zero_page_requests_and_failed_rows(monkeypatch):
    from services import naver_keyword_rank as kr
    _Tripwire.touched = []
    kr.reset_card_cache_for_tests()
    g.report_search_block("drill", now=time.time())
    assert g.search_snapshot()["open"] is True

    monkeypatch.setattr(kr, "async_playwright", lambda: _PW())
    monkeypatch.setattr(kr, "check_naver_playwright_quota", lambda *a, **k: True)
    out = asyncio.run(kr._run_with_browser(["키워드1", "키워드2"], "가게", "123", ""))

    assert _Tripwire.touched == []
    for kw in ("키워드1", "키워드2"):
        assert out[kw]["error"] == g.SEARCH_COOLDOWN_ERROR
        assert out[kw]["pc_rank"] is None and out[kw]["mobile_rank"] is None and out[kw]["place_rank"] is None
    # 이 행들은 점수에서 '0점 미노출'이 아니라 미측정이다
    from services.score_engine import calc_keyword_search_rank_score
    assert calc_keyword_search_rank_score({"keyword_ranks": out}) == (0.0, False)
