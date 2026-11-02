"""주기 리포트(주간 성적표·월간 리포트·월간 성장 카드·30/60/90일 성과 이메일)의 거짓 변화·거짓 '변동 없음'·중복·수신 설정 무시 (2026-11-02).

점검으로 확인된 결함(실제 코드 근거는 각 테스트 docstring):
 1) 비교하는 두 점수 중 하나가 네이버 측정이 빠진 스캔의 점수면 '등급 변화/추세/상승' 문구가 거짓이 된다 (같은 가게 시험 64.5 ↔ 54.6).
 2) 순위 전용 행(score_history의 점수 컬럼이 모두 NULL)을 `or 0.0`으로 읽으면 0점이 돼 거짓 하락/상승이 나간다.
 3) 비교할 기록이 없거나 한 건뿐인데 0.0으로 두어 "변동 없음"을 단정했다 / 28일 전 점수가 없는데 0.0으로 읽어 "시작 전 → …, 상승".
 4) 같은 MONTHLY_01을 보내는 두 잡이 서로를 보지 않아 같은 날 두 번 갔고, 한 잡은 수신 설정(kakao_scan_notify)을 무시했다.
 5) 발송 실패를 'sent'로 기록했다(지침 9).
"""
import asyncio
import os
import sys
from datetime import date, timedelta

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import change_signal_guard as csg  # noqa: E402

_OK = {"mentioned": False, "in_briefing": False}
_BLOCKED = {"error": "naver_search_cooldown", "quota_skipped": True}


# ── 공통 가짜 ────────────────────────────────────────────────────────────────
class _R:
    def __init__(self, data=None, count=0):
        self.data = data
        self.count = count


class _Q:
    """supabase 쿼리 체인 흉내: 호출 기록을 남기고, .execute()/await execute(q) 모두 `resolver`가 답한다."""
    resolver = None

    def __init__(self, table):
        self.table_name = table
        self.calls = []

    def __getattr__(self, name):
        if name == "not_":
            self.calls.append(("not_", ()))
            return self
        if name == "execute":
            return lambda: type(self).resolver(self)
        return lambda *a, **k: (self.calls.append((name, a)) or self)

    def has(self, name, *args):
        return (name, args) in self.calls

    def called(self, name):
        return [a for n, a in self.calls if n == name]


class _SB:
    def __init__(self):
        self.queries = []

    def table(self, name):
        q = _Q(name)
        self.queries.append(q)
        return q


class _Notifier:
    """KakaoNotifier 대역 — 주기 리포트 발송만 기록한다."""
    instances = []

    def __init__(self, delivered=True):
        self.delivered = delivered
        self.monthly = []
        self.weekly = []
        self.texts = []
        _Notifier.instances.append(self)

    async def send_monthly_report(self, **kw):
        self.monthly.append(kw)
        return self.delivered

    async def send_weekly_score_report(self, **kw):
        self.weekly.append(kw)
        return True

    async def send_text(self, **kw):
        self.texts.append(kw)
        return True

    def __getattr__(self, name):
        async def _noop(*a, **k):
            return None
        return _noop


@pytest.fixture(autouse=True)
def _kakao_key(monkeypatch):
    """send_monthly_report는 키가 없으면 _send 이전에 반환한다 — 이 파일의 테스트에만 키를 둔다(전역 os.environ을 건드리지 않는다)."""
    monkeypatch.setenv("KAKAO_APP_KEY", "test-key")


@pytest.fixture
def notifier(monkeypatch):
    import services.kakao_notify as kn
    _Notifier.instances = []
    monkeypatch.setattr(kn, "KakaoNotifier", lambda *a, **k: _Notifier())
    return _Notifier


def _patch_guard(monkeypatch, flags=None, window=False):
    """scan_results 최근 스캔 플래그(change_signal_guard.recent_naver_unmeasured_flags)와 기간 판정(window_comparison_unmeasured)을 대체."""
    async def fake_flags(supabase, business_id):
        return flags

    async def fake_window(supabase, business_id, since_iso, until_iso=None):
        fake_window.seen.append((since_iso, until_iso))
        return window

    fake_window.seen = []
    monkeypatch.setattr(csg, "recent_naver_unmeasured_flags", fake_flags)
    monkeypatch.setattr(csg, "window_comparison_unmeasured", fake_window)
    return fake_window


# ═══ A. 알림톡 월간 리포트 본문 ═════════════════════════════════════════════════
def _monthly_vars(score_change):
    from services.kakao_notify import KakaoNotifier
    n = KakaoNotifier()
    captured = {}

    async def fake_send(phone, kind, variables, *a, **k):
        captured.update(variables)

        class Resp:
            status_code = 200

            def json(self):
                return {"header": {"isSuccessful": True}}
        return Resp()

    n._send = fake_send
    ok = asyncio.run(n.send_monthly_report("01012345678", "가게", score_change, 12, 3, "11"))
    return captured, ok


@pytest.mark.parametrize("change,text", [
    (None, "비교 데이터 부족"),
    (0.0, "변동 없음"),         # 실제로 비교했고 같을 때만 '변동 없음'
    (7.0, "뚜렷한 상승세"), (2.0, "소폭 상승"), (-2.0, "소폭 하락"), (-9.0, "하락 — 점검 필요"),
])
def test_monthly_trend_text(change, text):
    v, ok = _monthly_vars(change)
    assert v["#{추세}"] == text and ok is True
    assert len(v["#{추세}"]) <= 14                       # 알림톡 변수 값 14자 한도


def test_monthly_report_returns_false_when_not_delivered():
    from services.kakao_notify import KakaoNotifier
    n = KakaoNotifier()

    async def fake_send(*a, **k):
        class Resp:
            status_code = 200

            def json(self):
                return {"header": {"isSuccessful": False}}
        return Resp()

    n._send = fake_send
    assert asyncio.run(n.send_monthly_report("010", "가게", 1.0, 1, 1, "11")) is False

    async def skipped(*a, **k):
        return None
    n._send = skipped
    assert asyncio.run(n.send_monthly_report("010", "가게", 1.0, 1, 1, "11")) is False


# ═══ B. collect_monthly_stats ═══════════════════════════════════════════════════
class _OQ(_Q):
    """order(..., desc=)를 기록하는 쿼리 — 첫 행/마지막 행 조회를 구분하기 위해 쓴다."""

    def order(self, col, desc=False, **k):
        self.desc = desc
        return self


class _OSB(_SB):
    def table(self, name):
        q = _OQ(name)
        self.queries.append(q)
        return q


def _stats(monkeypatch, first, last, window):
    from services import monthly_report as mr
    _patch_guard(monkeypatch, window=window)

    def resolver(q):
        if q.table_name == "score_history":
            row = last if getattr(q, "desc", False) else first
            return _R([row] if row else [])
        return _R([], count=4)

    _Q.resolver = staticmethod(resolver)
    return asyncio.run(mr.collect_monthly_stats(_OSB(), "b1", 2026, 10))


def test_stats_two_dates_and_measured_gives_a_number(monkeypatch):
    s = _stats(monkeypatch, {"total_score": 50.0, "score_date": "2026-10-02"}, {"total_score": 58.0, "score_date": "2026-10-30"}, False)
    assert s["score_change"] == 8.0 and s["scan_count"] == 4


def test_stats_single_score_is_not_no_change(monkeypatch):
    """기록이 한 건뿐이면 '변동 없음'(0.0)이 아니라 비교 불가(None)다."""
    row = {"total_score": 50.0, "score_date": "2026-10-02"}
    assert _stats(monkeypatch, row, row, False)["score_change"] is None


def test_stats_no_score_rows_is_none(monkeypatch):
    assert _stats(monkeypatch, None, None, False)["score_change"] is None


@pytest.mark.parametrize("window", [True, None])
def test_stats_unmeasured_or_unknown_span_is_none(monkeypatch, window):
    s = _stats(monkeypatch, {"total_score": 50.0, "score_date": "2026-10-02"}, {"total_score": 40.0, "score_date": "2026-10-30"}, window)
    assert s["score_change"] is None


def test_stats_window_ends_at_the_end_of_the_report_month(monkeypatch):
    from services import monthly_report as mr
    fw = _patch_guard(monkeypatch, window=False)

    class OQ(_Q):
        def order(self, col, desc=False, **k):
            self.desc = desc
            return self

    class Chain:
        def table(self_, name):
            return OQ(name)

    _Q.resolver = staticmethod(lambda q: _R([{"total_score": 50.0 if not getattr(q, "desc", False) else 60.0, "score_date": "2026-10-02" if not getattr(q, "desc", False) else "2026-10-30"}]
                                            if q.table_name == "score_history" else [], count=1))
    asyncio.run(mr.collect_monthly_stats(Chain(), "b1", 2026, 10))
    assert fw.seen == [("2026-10-01T00:00:00", "2026-11-01T00:00:00")]        # 새 달(11월)의 스캔이 양 끝으로 잡히지 않는다


# ═══ C. send_monthly_growth_report_to_all (09:00) ═══════════════════════════════
def _run_growth_report(monkeypatch, notifier, profile, already_sent=0, delivered=True, comparable=True):
    import db.supabase_client as dbc
    from services import monthly_report as mr
    _patch_guard(monkeypatch, window=False if comparable else True)
    sb = _SB()
    inserts = []

    class Q2(_Q):
        def insert(self, payload):
            inserts.append(payload)
            return self

        def maybe_single(self):
            self.single = True
            return self

        def order(self, col, desc=False, **k):
            self.desc = desc
            return self

    class SB2(_SB):
        def table(self, name):
            q = Q2(name)
            self.queries.append(q)
            return q

    sb = SB2()

    def resolver(q):
        if q.table_name == "subscriptions":
            return _R([{"user_id": "u1", "plan": "basic"}])
        if q.table_name == "businesses":
            return _R([{"id": "b1", "name": "가게", "user_id": "u1"}])
        if q.table_name == "profiles":
            return _R(profile)
        if q.table_name == "notifications":
            return _R([], count=already_sent)
        if q.table_name == "score_history":
            return _R([{"total_score": 60.0 if getattr(q, "desc", False) else 50.0,
                        "score_date": "2026-10-30" if getattr(q, "desc", False) else "2026-10-02"}])
        return _R([], count=2)

    _Q.resolver = staticmethod(resolver)
    monkeypatch.setattr(dbc, "get_client", lambda: sb)
    import services.kakao_notify as kn
    monkeypatch.setattr(kn, "KakaoNotifier", lambda *a, **k: notifier(delivered=delivered))
    asyncio.run(mr.send_monthly_growth_report_to_all())
    n = _Notifier.instances[-1] if _Notifier.instances else None
    return n, inserts, sb


def test_growth_report_respects_notification_opt_out(monkeypatch, notifier):
    n, inserts, _ = _run_growth_report(monkeypatch, notifier, {"phone": "01012345678", "kakao_scan_notify": False})
    assert n.monthly == [] and inserts == []


def test_growth_report_sends_when_opted_in_and_records_sent(monkeypatch, notifier):
    n, inserts, _ = _run_growth_report(monkeypatch, notifier, {"phone": "01012345678", "kakao_scan_notify": True})
    assert len(n.monthly) == 1 and n.monthly[0]["score_change"] == 10.0
    assert [i["status"] for i in inserts] == ["sent"]


def test_growth_report_unset_preference_does_not_send(monkeypatch, notifier):
    n, _, _ = _run_growth_report(monkeypatch, notifier, {"phone": "01012345678", "kakao_scan_notify": None})
    assert len(n.monthly) == 0                               # 알림은 옵트인(2026-11-02 통일): 명시적 True가 아니면 보내지 않는다 — 신규 가입 기본값도 false


def test_growth_report_failed_delivery_is_not_recorded_as_sent(monkeypatch, notifier):
    n, inserts, _ = _run_growth_report(monkeypatch, notifier, {"phone": "01012345678", "kakao_scan_notify": True}, delivered=False)
    assert [i["status"] for i in inserts] == ["failed"]


def test_growth_report_unmeasured_span_sends_without_a_trend(monkeypatch, notifier):
    n, _, _ = _run_growth_report(monkeypatch, notifier, {"phone": "01012345678", "kakao_scan_notify": True}, comparable=False)
    assert len(n.monthly) == 1 and n.monthly[0]["score_change"] is None


def test_growth_report_dedupe_counts_only_sent_rows(monkeypatch, notifier):
    _, _, sb = _run_growth_report(monkeypatch, notifier, {"phone": "01012345678", "kakao_scan_notify": True})
    q = [x for x in sb.queries if x.table_name == "notifications" and x.has("eq", "type", "monthly_report")][0]
    assert q.has("eq", "status", "sent")


# ═══ D. monthly_report_notify (09:10) ══════════════════════════════════════════
def _run_monthly_notify(monkeypatch, notifier, *, already=False, rows=None, window=False, prefs=True):
    import db.supabase_client as dbc
    import scheduler.jobs as jobs
    _patch_guard(monkeypatch, window=window)
    seen = {"queries": []}

    class Q2(_Q):
        def maybe_single(self):
            return self

        def order(self, col, desc=False, **k):
            self.desc = desc
            return self

    class SB2(_SB):
        def table(self, name):
            q = Q2(name)
            seen["queries"].append(q)
            return q

    rows = rows if rows is not None else [
        {"unified_score": 70.0, "total_score": 70.0, "score_date": "2026-11-01"},
        {"unified_score": 60.0, "total_score": 60.0, "score_date": "2026-09-05"},
    ]

    async def fake_db(q):
        t = q.table_name
        if t == "profiles":
            return _R({"phone": "01012345678", "kakao_scan_notify": prefs})
        if t == "businesses":
            return _R({"id": "b1", "name": "가게"})
        if t == "notifications":
            return _R([{"id": 1}] if already else [])
        if t == "score_history":
            return _R(rows, count=len(rows))
        return _R([], count=3)

    async def fake_db_all(build):
        return _R([{"user_id": "u1", "plan": "basic"}])

    monkeypatch.setattr(jobs, "_KAKAO_CONFIGURED", True)
    monkeypatch.setattr(jobs, "_db", fake_db)
    monkeypatch.setattr(jobs, "_db_all", fake_db_all)
    monkeypatch.setattr(dbc, "get_client", lambda: SB2())
    import services.kakao_notify as kn
    monkeypatch.setattr(kn, "KakaoNotifier", lambda *a, **k: notifier(delivered=True))
    asyncio.run(jobs.monthly_report_notify())
    return _Notifier.instances[-1], seen["queries"]


def test_monthly_notify_sends_a_number_when_comparable(monkeypatch, notifier):
    n, _ = _run_monthly_notify(monkeypatch, notifier)
    assert len(n.monthly) == 1 and n.monthly[0]["score_change"] == 10.0


def test_monthly_notify_skips_users_already_sent_by_the_9am_job(monkeypatch, notifier):
    n, qs = _run_monthly_notify(monkeypatch, notifier, already=True)
    assert n.monthly == []
    dq = [q for q in qs if q.table_name == "notifications"][0]
    assert dq.has("eq", "type", "monthly_report") and dq.has("eq", "status", "sent")


def test_monthly_notify_unmeasured_end_sends_without_a_trend_not_a_false_one(monkeypatch, notifier):
    n, _ = _run_monthly_notify(monkeypatch, notifier, window=True)
    assert len(n.monthly) == 1 and n.monthly[0]["score_change"] is None


def test_monthly_notify_unknown_span_also_sends_without_a_trend(monkeypatch, notifier):
    n, _ = _run_monthly_notify(monkeypatch, notifier, window=None)
    assert n.monthly[0]["score_change"] is None


def test_monthly_notify_ignores_rank_only_rows_in_the_query(monkeypatch, notifier):
    _, qs = _run_monthly_notify(monkeypatch, notifier)
    hq = [q for q in qs if q.table_name == "score_history"][0]
    assert hq.has("is_", "total_score", "null") and "not_" in [n for n, _ in hq.calls]


def test_monthly_notify_old_rows_without_unified_use_total_score(monkeypatch, notifier):
    rows = [{"unified_score": None, "total_score": 72.0, "score_date": "2026-11-01"},
            {"unified_score": None, "total_score": 60.0, "score_date": "2026-09-05"}]
    n, _ = _run_monthly_notify(monkeypatch, notifier, rows=rows)
    assert n.monthly[0]["score_change"] == 12.0              # NULL을 0.0으로 읽으면 72 − 0 = 72가 됐다


def test_monthly_notify_respects_opt_out(monkeypatch, notifier):
    n, _ = _run_monthly_notify(monkeypatch, notifier, prefs=False)
    assert n.monthly == []


# ═══ E. weekly_score_report_job ════════════════════════════════════════════════
def _run_weekly(monkeypatch, notifier, flags, rows=None):
    import db.supabase_client as dbc
    import scheduler.jobs as jobs
    import services.gap_analyzer as ga
    _patch_guard(monkeypatch, flags=flags)
    seen = []

    class Q2(_Q):
        def order(self, col, desc=False, **k):
            return self

    class SB2(_SB):
        def table(self, name):
            q = Q2(name)
            seen.append(q)
            return q

    rows = rows if rows is not None else [
        {"unified_score": 54.6, "total_score": 54.6, "score_date": "2026-11-02"},
        {"unified_score": 64.5, "total_score": 64.5, "score_date": "2026-10-30"},
    ]

    async def fake_exec(q):
        t = q.table_name
        if t == "profiles":
            return _R([{"phone": "01012345678"}])
        if t == "businesses":
            return _R([{"id": "b1", "name": "가게"}])
        if t == "score_history":
            return _R(rows)
        return _R([])

    async def fake_db_all(build):
        return _R([{"user_id": "u1", "plan": "basic"}])

    async def fake_gap(biz_id, sb):
        return None

    monkeypatch.setattr(dbc, "get_client", lambda: SB2())
    monkeypatch.setattr(dbc, "execute", fake_exec)
    monkeypatch.setattr(jobs, "_db_all", fake_db_all)
    monkeypatch.setattr(ga, "analyze_gap_from_db", fake_gap)
    import services.kakao_notify as kn
    monkeypatch.setattr(kn, "KakaoNotifier", lambda *a, **k: notifier(delivered=True))
    asyncio.run(jobs.weekly_score_report_job())
    return _Notifier.instances[-1], seen


def test_weekly_report_sent_when_both_scans_measured(monkeypatch, notifier):
    n, _ = _run_weekly(monkeypatch, notifier, flags=[False, False])
    assert len(n.weekly) == 1


@pytest.mark.parametrize("flags", [[True, False], [False, True], None])
def test_weekly_report_not_sent_when_a_scan_was_unmeasured_or_unknown(monkeypatch, notifier, flags):
    """측정 빠진 날의 점수 차이로 '등급 하락 ▼'을 보내지 않는다(확인 못 해도 보내지 않는다)."""
    n, _ = _run_weekly(monkeypatch, notifier, flags=flags)
    assert n.weekly == []


def test_weekly_report_query_excludes_rank_only_rows(monkeypatch, notifier):
    _, qs = _run_weekly(monkeypatch, notifier, flags=[False, False])
    hq = [q for q in qs if q.table_name == "score_history"][0]
    assert hq.has("is_", "total_score", "null") and "not_" in [n for n, _ in hq.calls]


# ═══ F. monthly_growth_card_job ════════════════════════════════════════════════
def _run_card(monkeypatch, notifier, window, first_row=None, last_row=None):
    import db.supabase_client as dbc
    import scheduler.jobs as jobs
    _patch_guard(monkeypatch, window=window)
    seen = []

    class Q2(_Q):
        def maybe_single(self):
            return self

        def order(self, col, desc=False, **k):
            self.desc = desc
            return self

    class SB2(_SB):
        def table(self, name):
            q = Q2(name)
            seen.append(q)
            return q                                   # storage 속성이 없다 — 업로드가 시도되면 AttributeError로 드러난다

    first_row = first_row if first_row is not None else {"total_score": 40.0, "score_date": "2026-11-02"}
    last_row = last_row if last_row is not None else {"total_score": 60.0, "score_date": "2026-11-29"}

    async def fake_db(q):
        t = q.table_name
        if t == "score_history":
            return _R([last_row] if getattr(q, "desc", False) else [first_row])
        if t == "profiles":
            return _R({"phone": "01012345678"})
        return _R([])

    async def fake_db_all(build):
        return _R([{"user_id": "u1"}])

    async def fake_db_all_in(build, ids):
        return _R([{"id": "b1", "name": "가게", "user_id": "u1", "category": "restaurant", "region": "서울"}])

    monkeypatch.setattr(dbc, "get_client", lambda: SB2())
    monkeypatch.setattr(jobs, "_db", fake_db)
    monkeypatch.setattr(jobs, "_db_all", fake_db_all)
    monkeypatch.setattr(jobs, "_db_all_in", fake_db_all_in)
    import services.kakao_notify as kn
    monkeypatch.setattr(kn, "KakaoNotifier", lambda *a, **k: notifier(delivered=True))
    asyncio.run(jobs.monthly_growth_card_job())
    return _Notifier.instances[-1], seen


def test_growth_card_made_when_both_ends_measured(monkeypatch, notifier):
    n, _ = _run_card(monkeypatch, notifier, window=False)
    assert len(n.texts) == 1 and "좋아졌습니다" in n.texts[0]["message"]


@pytest.mark.parametrize("window", [True, None])
def test_growth_card_not_made_when_an_end_was_unmeasured_or_unknown(monkeypatch, notifier, window):
    """'좋아졌어요!' 카드는 공유되는 이미지다 — 월초가 차단일이면 가짜 상승이다."""
    n, _ = _run_card(monkeypatch, notifier, window=window)
    assert n.texts == []


def test_growth_card_first_row_query_excludes_rank_only_rows(monkeypatch, notifier):
    _, qs = _run_card(monkeypatch, notifier, window=False)
    firsts = [q for q in qs if q.table_name == "score_history" and not getattr(q, "desc", False)]
    assert firsts and firsts[0].has("is_", "total_score", "null")


# ═══ G. 구조 ═══════════════════════════════════════════════════════════════════
def test_performance_email_requires_both_scores_and_a_comparable_span():
    import inspect
    import scheduler.jobs as jobs
    src = inspect.getsource(jobs.send_monthly_performance_reports)
    assert 'if not (score_now_r and score_now_r.data) or not (score_before_r and score_before_r.data):' in src
    assert "window_comparison_unmeasured(" in src
    assert src.index("window_comparison_unmeasured(") < src.index("score_now = _get_score(score_now_r)")
    assert '.select("unified_score, total_score, score_date")' in src          # 기준 행의 날짜를 읽어 비교 기간의 시작으로 쓴다


# ═══ H. send_monthly_performance_reports (실제 실행) ═══════════════════════════════
def _run_performance(monkeypatch, *, before_row, now_row, window=False):
    import db.supabase_client as dbc
    import scheduler.jobs as jobs
    import services.email_sender as es
    import supabase as supabase_pkg

    today = date.today()
    fw = _patch_guard(monkeypatch, window=window)
    sent = []

    class SB2(_SB):
        def table(self, name):
            q = _Q(name)
            self.queries.append(q)
            return q

    def resolver(q):
        t = q.table_name
        if t == "subscriptions":
            return _R([{"user_id": "u1", "plan": "basic", "start_at": (today - timedelta(days=30)).isoformat() + "T12:00:00+09:00"}])
        if t == "businesses":
            return _R([{"id": "b1", "name": "가게"}])
        if t == "score_history":
            row = before_row if q.called("lte") else now_row      # '28일 전' 조회만 lte를 쓴다
            return _R([row] if row else [])
        return _R([], count=2)

    _Q.resolver = staticmethod(resolver)

    class _Admin:
        def get_user_by_id(self, uid):
            class U:
                class user:
                    email = "owner@example.com"
            return U()

    class _FakeAdminClient:
        class auth:
            admin = _Admin()

    async def fake_send_email(to, subject, html, *a, **k):
        sent.append((to, subject, html))
        return True

    monkeypatch.setattr(dbc, "get_client", lambda: SB2())
    monkeypatch.setattr(supabase_pkg, "create_client", lambda *a, **k: _FakeAdminClient())
    monkeypatch.setattr(es, "send_email", fake_send_email)
    asyncio.run(jobs.send_monthly_performance_reports())
    return sent, fw


_NOW = {"unified_score": 64.5, "total_score": 64.5}
_BEFORE = {"unified_score": 40.0, "total_score": 40.0, "score_date": "2026-10-04"}


def test_performance_email_sent_with_real_comparison(monkeypatch):
    sent, fw = _run_performance(monkeypatch, before_row=_BEFORE, now_row=_NOW)
    assert len(sent) == 1 and "달라졌습니다" in sent[0][1] and "상승" in sent[0][2]
    assert fw.seen[0][0] == "2026-10-04"          # 비교 기간의 시작 = 기준이 된 28일 전 행의 날짜


def test_performance_email_not_sent_when_28_day_old_score_is_missing(monkeypatch):
    """28일 전 기록이 없을 때 0.0으로 읽으면 '시작 전 → …, 상승'이라는 거짓 비교 메일이 나갔다."""
    sent, _ = _run_performance(monkeypatch, before_row=None, now_row=_NOW)
    assert sent == []


def test_performance_email_not_sent_when_current_score_is_missing(monkeypatch):
    sent, _ = _run_performance(monkeypatch, before_row=_BEFORE, now_row=None)
    assert sent == []


@pytest.mark.parametrize("window", [True, None])
def test_performance_email_not_sent_when_an_end_was_unmeasured_or_unknown(monkeypatch, window):
    sent, _ = _run_performance(monkeypatch, before_row=_BEFORE, now_row=_NOW, window=window)
    assert sent == []


# ═══ I. 날짜별 판정(unmeasured_on_dates) ═══════════════════════════════════════════
def _on_dates(monkeypatch, per_date_rows, dates=("2026-11-02", "2026-10-26"), fail_at=None):
    import db.supabase_client as dbc
    calls = []

    class Q2(_Q):
        pass

    class SB2(_SB):
        def table(self, name):
            q = Q2(name)
            calls.append(q)
            return q

    async def fake(q):
        i = len(calls_done)
        calls_done.append(q)
        if fail_at is not None and i == fail_at:
            raise RuntimeError("db down")
        rows = per_date_rows[i] if i < len(per_date_rows) else []
        return _R(rows)

    calls_done = []
    monkeypatch.setattr(dbc, "execute", fake)
    r = asyncio.run(csg.unmeasured_on_dates(SB2(), "b1", list(dates)))
    return r, calls


def test_dates_all_measured(monkeypatch):
    r, calls = _on_dates(monkeypatch, [[{"naver_result": _OK}], [{"naver_result": _OK}, {"naver_result": _OK}]])
    assert r is False and len(calls) == 2


def test_dates_one_unmeasured_scan_that_day_is_enough(monkeypatch):
    r, _ = _on_dates(monkeypatch, [[{"naver_result": _OK}], [{"naver_result": _OK}, {"naver_result": _BLOCKED}]])
    assert r is True


def test_dates_stops_at_the_first_unmeasured_day(monkeypatch):
    r, calls = _on_dates(monkeypatch, [[{"naver_result": _BLOCKED}], [{"naver_result": _OK}]])
    assert r is True and len(calls) == 1


def test_dates_lookup_failure_is_none(monkeypatch):
    assert _on_dates(monkeypatch, [], fail_at=0)[0] is None
    assert _on_dates(monkeypatch, [[{"naver_result": _OK}]], fail_at=1)[0] is None


def test_dates_bad_date_is_none_not_a_crash(monkeypatch):
    assert _on_dates(monkeypatch, [[]], dates=("not-a-date",))[0] is None


def test_dates_window_is_one_kst_day_and_limit_is_a_literal(monkeypatch):
    _, calls = _on_dates(monkeypatch, [[{"naver_result": _OK}], [{"naver_result": _OK}]])
    q = calls[0]
    assert q.has("gte", "scanned_at", "2026-11-02T00:00:00+09:00")
    assert q.has("lt", "scanned_at", "2026-11-03T00:00:00+09:00")        # 야간 02:00 KST 스캔이 전날 UTC로 저장돼도 그 KST 날짜로 묶인다
    assert q.has("is_", "track1_score", "null") and q.has("limit", 10)


# ═══ J. 주간 다이제스트 메일 ═══════════════════════════════════════════════════════
def test_digest_html_states():
    import services.email_sender as es
    _, up = es._weekly_digest_html("가게", 60.0, 50.0, 1, ["a"])
    _, down = es._weekly_digest_html("가게", 40.0, 50.0, 1, ["a"])
    _, same = es._weekly_digest_html("가게", 50.0, 50.0, 1, ["a"])
    _, first = es._weekly_digest_html("가게", 50.0, None, 1, ["a"])
    _, hold = es._weekly_digest_html("가게", 40.0, 50.0, 1, ["a"], comparable=False)
    assert "▲ 개선됨" in up and "▼ 하락" in down and "변화 없음" in same and "첫 주 측정" in first
    assert "전주와 비교 보류" in hold
    assert "▼ 하락" not in hold and "▲ 개선됨" not in hold and "변화 없음" not in hold and "첫 주 측정" not in hold
    # 전주 기록이 없으면(첫 주) 비교 가능 여부와 무관하게 '첫 주 측정'
    assert "첫 주 측정" in es._weekly_digest_html("가게", 50.0, None, 1, ["a"], comparable=False)[1]


def _run_digest(monkeypatch, *, prev_present=True, unmeasured=False):
    import scheduler.jobs as jobs
    import services.db_paging as dbp
    import services.email_sender as es

    today = date.today()
    monday = today - timedelta(days=today.weekday())
    rows = [{"unified_score": 40.0, "score_date": monday.isoformat()}]
    if prev_present:
        rows.append({"unified_score": 64.5, "score_date": (monday - timedelta(days=7)).isoformat()})
    sent = []
    asked = []

    class Q2(_Q):
        def insert(self, payload):
            return self

    class SB2(_SB):
        def table(self, name):
            q = Q2(name)
            self.queries.append(q)
            return q

    async def fake_fetch(build, max_rows=None):
        return [{"user_id": "u1", "plan": "basic"}], False

    async def fake_db(q):
        t = q.table_name
        if t == "profiles":
            return _R([{"user_id": "u1", "email": "owner@example.com"}])
        if t == "businesses":
            return _R([{"id": "b1", "name": "가게", "keywords": ["성수 맛집"]}])
        if t == "score_history":
            return _R(rows)
        if t == "ai_citations":
            return _R([], count=3)
        return _R([])

    async def fake_unmeasured(supabase, biz_id, dates):
        asked.append(list(dates))
        return unmeasured

    async def fake_send_email(to, subject, html, *a, **k):
        sent.append(html)
        return True

    import db.supabase_client as dbc
    monkeypatch.setattr(dbc, "get_client", lambda: SB2())
    monkeypatch.setattr(dbp, "fetch_all_rows", fake_fetch)
    monkeypatch.setattr(jobs, "_db", fake_db)
    monkeypatch.setattr(csg, "unmeasured_on_dates", fake_unmeasured)
    monkeypatch.setattr(es, "RESEND_API_KEY", "x")
    monkeypatch.setattr(es, "send_email", fake_send_email)
    asyncio.run(jobs.weekly_digest_job())
    return sent, asked, monday


def test_digest_job_shows_a_real_decline_when_both_weeks_were_measured(monkeypatch):
    sent, asked, monday = _run_digest(monkeypatch, unmeasured=False)
    assert len(sent) == 1 and "▼ 하락" in sent[0]
    assert asked == [[monday.isoformat(), (monday - timedelta(days=7)).isoformat()]]    # 정확히 비교하는 두 점수의 날짜를 판정한다


@pytest.mark.parametrize("unmeasured", [True, None])
def test_digest_job_holds_the_comparison_when_a_week_was_unmeasured_or_unknown(monkeypatch, unmeasured):
    sent, _, _ = _run_digest(monkeypatch, unmeasured=unmeasured)
    assert len(sent) == 1 and "전주와 비교 보류" in sent[0] and "▼ 하락" not in sent[0]


def test_digest_job_first_week_needs_no_lookup(monkeypatch):
    sent, asked, _ = _run_digest(monkeypatch, prev_present=False)
    assert len(sent) == 1 and "첫 주 측정" in sent[0] and asked == []
