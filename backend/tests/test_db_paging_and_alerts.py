"""서버 최대 행 수(1,000) 우회 — 페이징 도우미와 일일 호출량 경보 테스트 (2026-10-30).

실측: 서버는 `.limit(20000)`을 요청해도 1,000행만 돌려준다. 행을 읽어 세던 `ai_daily_usage_alert_job`은 임계값 3,000에 도달할 수 없었다.
"""
import asyncio
import inspect

import pytest

from services import db_paging as dp

PAGE = dp.PAGE


class _Res:
    def __init__(self, data=None, count=None):
        self.data, self.count = data, count


class _Q:
    """range()만 지원하는 가짜 쿼리 — 서버처럼 한 번에 PAGE행까지만 돌려준다."""

    def __init__(self, total, log):
        self.total, self.log, self.rng = total, log, None

    def range(self, a, b):
        self.rng = (a, b)
        return self


@pytest.fixture
def paged(monkeypatch):
    import db.supabase_client as sc
    log = []

    async def fake_execute(q):
        a, b = q.rng
        log.append((a, b))
        n = max(0, min(q.total, b + 1) - a)
        return _Res([{"i": a + k} for k in range(min(n, PAGE))])

    monkeypatch.setattr(sc, "execute", fake_execute)
    return log


def test_reads_every_row_across_pages(paged):
    rows, truncated = asyncio.run(dp.fetch_all_rows(lambda: _Q(2500, paged)))
    assert len(rows) == 2500 and truncated is False
    assert [r["i"] for r in rows] == list(range(2500))          # 겹치거나 빠지지 않는다
    assert paged == [(0, 999), (1000, 1999), (2000, 2999)]


def test_exact_multiple_of_page_terminates(paged):
    rows, truncated = asyncio.run(dp.fetch_all_rows(lambda: _Q(2000, paged)))
    assert len(rows) == 2000 and truncated is False             # 마지막 빈 페이지에서 끝난다


def test_empty_and_small_results(paged):
    assert asyncio.run(dp.fetch_all_rows(lambda: _Q(0, paged))) == ([], False)
    rows, _ = asyncio.run(dp.fetch_all_rows(lambda: _Q(7, paged)))
    assert len(rows) == 7


def test_max_rows_cap_is_reported_as_truncated(paged):
    rows, truncated = asyncio.run(dp.fetch_all_rows(lambda: _Q(10_000, paged), max_rows=2500))
    assert len(rows) == 2500 and truncated is True               # 잘렸음을 숨기지 않는다


# ── 일일 호출량 경보 ──
class _CQ:
    def __init__(self, kind, store):
        self.kind, self.store = kind, store
        self.provider = None

    def __getattr__(self, name):
        def chain(*a, **k):
            if name == "eq":
                self.provider = a[1]
            if name == "like":
                self.kind = "failed"
            return self
        return chain


class _SB:
    def __init__(self, counts):
        self.counts = counts      # {provider: (total, failed)}

    def table(self, name):
        return _CQ("total", self.counts)


def _run_alert(monkeypatch, counts, threshold_gemini=3000):
    from scheduler import jobs
    sent = []

    async def fake_db(q):
        total, failed = counts.get(q.provider, (0, 0))
        return _Res(count=(failed if q.kind == "failed" else total))

    async def fake_alert(subject, body):
        sent.append(subject)

    import db.supabase_client as sc
    import services.email_sender as es
    monkeypatch.setattr(jobs, "_db", fake_db)
    monkeypatch.setattr(sc, "get_client", lambda: _SB(counts))
    monkeypatch.setattr(es, "send_operator_alert", fake_alert)
    monkeypatch.setitem(jobs._AI_DAILY_WARN_THRESHOLDS, "gemini", threshold_gemini)
    asyncio.run(jobs.ai_daily_usage_alert_job())
    return sent


def test_daily_alert_fires_above_the_server_row_cap(monkeypatch):
    """예전 구현은 행을 최대 1,000개만 읽어 임계값 3,000에 도달할 수 없었다 — 서버 집계라면 11,500회가 그대로 잡힌다."""
    sent = _run_alert(monkeypatch, {"gemini": (11_500, 900)})
    assert any("gemini" in s for s in sent)


def test_daily_alert_silent_below_threshold(monkeypatch):
    assert _run_alert(monkeypatch, {"gemini": (2_999, 0), "chatgpt": (10, 0), "claude": (3, 0)}) == []


def test_daily_alert_reads_counts_not_rows():
    from scheduler import jobs
    src = inspect.getsource(jobs.ai_daily_usage_alert_job)
    assert 'count="exact"' in src and ".limit(20000)" not in src


def test_other_ai_usage_reads_use_paging():
    from routers import admin
    from services import ai_capacity
    a = inspect.getsource(admin.get_ai_cost)
    assert "fetch_all_rows" in a or "_fetch_all(" in a
    assert ".limit(10000)" not in a and ".limit(20000)" not in a
    assert "fetch_all_rows" in inspect.getsource(ai_capacity.gemini_usage_snapshot)


def test_no_limit_above_server_row_cap_remains():
    """서버는 .limit()과 무관하게 1,000행까지만 돌려준다 — 그보다 큰 .limit()은 조용히 잘리므로 페이징(fetch_all_rows)이나 count 집계를 써야 한다."""
    import pathlib
    import re
    root = pathlib.Path(__file__).resolve().parent.parent
    pat = re.compile(r"\.limit\((\d[\d_]*)\)")
    bad = []
    for sub in ("routers", "services", "scheduler", "middleware"):
        for p in (root / sub).rglob("*.py"):
            if p.name == "db_paging.py" or "_deploy_tmp" in p.parts[-2]:   # 서버의 추적되지 않는 옛 폴더(임포트 안 됨)
                continue
            for n, line in enumerate(p.read_text(encoding="utf-8").splitlines(), 1):
                m = pat.search(line)
                if m and int(m.group(1).replace("_", "")) > 1000 and not line.lstrip().startswith("#"):
                    bad.append(f"{p.relative_to(root)}:{n}")
    assert not bad, bad


# ── in_() 목록 분할 (2026-10-31) ──
def test_chunked_splits_without_losing_items():
    parts = list(dp.chunked(range(10), 4))
    assert parts == [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9]]
    assert list(dp.chunked([], 4)) == []


def test_fetch_all_in_chunks_reads_each_chunk_and_pages(monkeypatch):
    import db.supabase_client as sc
    seen = []

    class _InQ:
        def __init__(self, ids):
            self.ids, self.rng = ids, None

        def range(self, a, b):
            self.rng = (a, b)
            return self

    async def fake_execute(q):
        seen.append((tuple(q.ids), q.rng))
        a, b = q.rng
        total = len(q.ids) * 700            # 조각당 700행 — 두 페이지가 필요하지 않게 조각 하나가 1,000행 미만
        n = max(0, min(total, b + 1) - a)
        return _Res([{"id": i} for i in range(n)])

    monkeypatch.setattr(sc, "execute", fake_execute)
    ids = [f"u{i}" for i in range(7)]
    rows, trunc = asyncio.run(dp.fetch_all_in_chunks(lambda part: _InQ(part), ids, chunk=3))
    assert trunc is False
    assert {s[0] for s in seen} >= {("u0", "u1", "u2"), ("u3", "u4", "u5"), ("u6",)}   # 모든 id가 조회됐다
    assert len(rows) == 7 * 700                                                         # 조각마다 1,000행을 넘는 경우도 페이징으로 모두 읽는다


def test_fetch_all_in_chunks_empty_ids_makes_no_query(monkeypatch):
    import db.supabase_client as sc

    async def boom(q):
        raise AssertionError("빈 목록은 조회하지 않는다")

    monkeypatch.setattr(sc, "execute", boom)
    assert asyncio.run(dp.fetch_all_in_chunks(lambda part: None, [])) == ([], False)



# ── 변수·표현식 .limit() 감사 (2026-10-31) ──
# 숫자 리터럴만 막던 위 테스트를 `.limit(DB_SCAN_CAP)`·`.limit(limit_rows)`·`.limit(len(x) * 3)`이 피해 갔다. 변수·표현식을 쓴 `.limit()`은
# 값이 1,000을 넘을 수 있는지 사람이 확인해 아래 허용 목록에 사유와 함께 올려야 한다(새로 생기면 이 테스트가 실패한다).
_VARIABLE_LIMIT_ALLOWED = {
    ("routers/admin.py", "limit"): "관리자 조회 — 요청 상한 le=500(감사 로그·시스템 알림·결제·창업 리포트), 스캔 로그는 관리자 전용 기본 50",
    ("routers/competitor.py", "len(biz_ids) * 2"): "후보 사업장 최대 20곳 x 2",
    ("routers/faq.py", "limit"): "Query le=20",
    ("routers/report.py", "comp_limit"): "플랜별 경쟁사 한도(5~10)",
    ("routers/report.py", "len(biz_ids) * 2"): "벤치마크 표본 200곳 x 2",
    ("routers/report.py", "len(comp_ids) * 2"): "경쟁사 최대 10곳 x 2",
    ("routers/report.py", "limit_rows"): "미리보기 90행 상한(history_days 최대 90으로 묶음)",
}


def _limit_args(line):
    """한 줄의 `.limit(...)` 인자 문자열을 괄호 균형을 맞춰 모두 뽑는다."""
    out, i = [], 0
    while True:
        i = line.find(".limit(", i)
        if i < 0:
            return out
        j = i + len(".limit(")
        k, depth = j, 1
        while k < len(line) and depth:
            depth += (line[k] == "(") - (line[k] == ")")
            k += 1
        out.append(line[j:k - 1].strip())
        i = k


def test_variable_limits_are_reviewed_and_allowlisted():
    import pathlib
    import re
    root = pathlib.Path(__file__).resolve().parent.parent
    found, unknown = set(), []
    for sub in ("routers", "services", "scheduler", "middleware"):
        for p in (root / sub).rglob("*.py"):
            if p.name == "db_paging.py" or "_deploy_tmp" in p.parts[-2]:
                continue
            for n, line in enumerate(p.read_text(encoding="utf-8").splitlines(), 1):
                if line.lstrip().startswith("#"):
                    continue
                for arg in _limit_args(line):
                    if not arg or re.fullmatch(r"[\d_]+", arg):
                        continue                       # 숫자 리터럴은 위 테스트가 본다
                    key = (str(p.relative_to(root)).replace("\\", "/"), arg)
                    found.add(key)
                    if key not in _VARIABLE_LIMIT_ALLOWED:
                        unknown.append(f"{key[0]}:{n} .limit({arg})")
    assert not unknown, (
        "변수·표현식 .limit()은 1,000행을 넘을 수 있는지 확인해 페이징(fetch_all_rows/fetch_all_in_chunks)을 쓰거나 "
        f"이 테스트의 허용 목록에 사유와 함께 추가하세요: {unknown}"
    )
    stale = set(_VARIABLE_LIMIT_ALLOWED) - found
    assert not stale, f"허용 목록에 있지만 코드에 없는 항목(정리하세요): {sorted(stale)}"


# 아직 `_db()`로 읽는 곳(변수명 -> 사유) — 잘려도 결과가 같거나 날짜·플랜 조건으로 좁혀져 1,000행에 닿지 않는 곳(2026-10-31 점검).
_KNOWN_UNBOUNDED_JOBS_READS = {
    "_exp_res": "7일 뒤 만료되는 구독만(날짜 조건)",
    "_expired_res": "만료일이 지났지만 아직 처리되지 않은 구독만",
    "_grace_res": "결제 실패 유예 중인 구독만",
    "_price_up_res": "할인 종료 3일 전 구독만(날짜 조건)",
    "result": "하루 동안 가입한 무료 구독만(날짜 조건)",
    "_res": "죽은 코드(weekly_competitor_sync_job — 스케줄러에 등록되지 않음)",
    "_subs_res": "backend_scaling_trigger_check_job — 구독자 수를 임계값(50)과만 비교해 1,000에서 잘려도 결과가 같음",
    "subs_res": "가입 후속 알림 — 하루 가입자(.limit(500)) 안에서 user_id로 좁힌 구독만",
}


def test_unreviewed_unbounded_reads_in_scheduled_jobs_are_not_added_silently():
    """사용자 수에 비례하는 테이블(subscriptions·competitors)을 jobs.py에서 `_db()`로 직접 읽으면 1,000행에서 조용히 잘린다 — `_db_all`/`_db_all_in`을 쓴다."""
    import pathlib
    import re
    root = pathlib.Path(__file__).resolve().parent.parent
    lines = (root / "scheduler" / "jobs.py").read_text(encoding="utf-8").splitlines()
    offenders = []
    for i, l in enumerate(lines):
        m0 = re.search(r"(\w+) = await (_db|_exec)\($", l)
        if not m0:
            continue
        indent = re.match(r"^(\s*)", l).group(1)
        j = i + 1
        while j < len(lines) and lines[j].rstrip() != indent + ")":
            j += 1
        block = "\n".join(lines[i:j + 1])
        if not re.search(r'\.table\("(subscriptions|competitors)"\)', block):
            continue
        if any(x in block for x in (".update(", ".insert(", ".upsert(", ".delete(")):
            continue
        if re.search(r"\.(single|maybe_single)\(\)|\.limit\(\d+\)|count=", block):
            continue
        if re.search(r'\.eq\("(business_id|user_id|id)",', block):
            continue                                  # 한 사업장·한 사용자의 행 — 플랜 한도 안
        offenders.append(m0.group(1))
    unknown = sorted(set(offenders) - set(_KNOWN_UNBOUNDED_JOBS_READS))
    assert not unknown, f"구독자·경쟁사 전체 조회는 _db_all/_db_all_in을 쓰거나 이 목록에 사유와 함께 추가하세요: {unknown}"
    stale = sorted(set(_KNOWN_UNBOUNDED_JOBS_READS) - set(offenders))
    assert not stale, f"목록에 있지만 코드에 없는 항목(정리하세요): {stale}"
