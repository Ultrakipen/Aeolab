"""키워드 순위 잡 일정 고정 (2026-10-28).

유료 상위 플랜(Pro·창업·Biz)의 순위 측정은 매일이 아니라 월·수·금이다 — 네이버 검색 화면 접속의 최대 항목이고
순위는 느리게 변한다. 매일로 되돌리면 용량 모델의 상한 초과 시점이 앞당겨지므로 일정을 테스트로 고정한다.
실제 스케줄러를 만들지 않고 jobs.py 소스의 add_job 등록부를 읽는다(네트워크·DB 접속 없음).
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

_SRC = open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scheduler", "jobs.py"),
            encoding="utf-8").read()


def _registration(job_id: str) -> str:
    m = re.search(r"scheduler\.add_job\(\s*[^)]*?id=\"%s\"" % re.escape(job_id), _SRC, re.S)
    assert m, f"{job_id} 등록부를 찾지 못했다"
    return m.group(0)


def test_pro_rank_job_runs_daily_but_measures_each_biz_three_times_a_week():
    """2026-10-29: 월·수·금 일괄 → 매일 실행 + 가게별 3요일(keyword_rank_days). 가게당 주 3회는 이전과 같다."""
    reg = _registration("keyword_rank_pro_daily")
    assert "day_of_week" not in reg, reg
    assert "hour=4, minute=30" in reg
    body = _SRC.split("async def keyword_rank_pro_daily_job", 1)[1].split("def _parse_rank_canaries", 1)[0]
    assert "only_today_slot=True" in body


def test_rank_days_weekly_counts_unchanged_and_spread():
    """Basic 주 1회·그 외 주 3회(간격 2·2·3일). 하루 부하가 월·수·금 100%에서 3/7로 줄어야 한다."""
    import uuid
    from services.scan_scheduling import keyword_rank_days
    ids = [str(uuid.UUID(int=(i + 1) * 104729)) for i in range(700)]
    for i in ids[:50]:
        assert len(keyword_rank_days("basic", i)) == 1
        d = sorted(keyword_rank_days("pro", i))
        assert len(d) == 3
        gaps = sorted(((d[(k + 1) % 3] - d[k]) % 7) for k in range(3))
        assert gaps == [2, 2, 3], (d, gaps)
    for plan in ("pro", "startup", "biz", "enterprise"):
        per_day = [sum(1 for i in ids if wd in keyword_rank_days(plan, i)) for wd in range(7)]
        assert max(per_day) <= 700 * 3 / 7 * 1.25, per_day      # 하루 최대가 전체의 약 43%(월·수·금 일괄이면 100%)
        assert min(per_day) >= 700 * 3 / 7 * 0.75, per_day


def test_basic_rank_job_runs_daily_but_measures_each_biz_once_a_week():
    """2026-10-29: Basic 순위는 월요일 한 번에 몰리던 것을 매일 실행 + 가게별 요일(keyword_rank_day)로 나눴다."""
    reg = _registration("keyword_rank_basic_weekly")
    assert "day_of_week" not in reg, reg          # 매일 등록
    assert "async def keyword_rank_basic_weekly_job" in _SRC
    body = _SRC.split("async def keyword_rank_basic_weekly_job", 1)[1].split("@_naver_batch_job", 1)[0]
    assert "only_today_slot=True" in body


def test_rank_day_gives_each_biz_exactly_one_day_and_spreads_evenly():
    import uuid
    from services.scan_scheduling import keyword_rank_day
    ids = [str(uuid.UUID(int=(i + 1) * 104729)) for i in range(700)]
    days = [keyword_rank_day(i) for i in ids]
    assert all(0 <= d <= 6 for d in days)
    assert all(keyword_rank_day(i) == keyword_rank_day(i) for i in ids)   # 재시작해도 같은 요일
    counts = [days.count(d) for d in range(7)]
    assert max(counts) <= 130 and min(counts) >= 70, counts               # 한 요일 쏠림 방지(평균 100)


def test_rank_day_independent_of_scan_slot():
    """경쟁사 동기화·스캔 슬롯과 같은 요일에 몰리지 않는다(소금값 분리)."""
    import uuid
    from services.scan_scheduling import keyword_rank_day, scan_slot
    ids = [str(uuid.UUID(int=(i + 1) * 104729)) for i in range(700)]
    same = sum(1 for i in ids if keyword_rank_day(i) == scan_slot(i))
    assert same < 700 * 0.3, same                 # 완전 동일 해시면 100%


def test_load_model_matches_schedule():
    """용량 모델의 순위 요일이 잡 일정과 같은 함수여야 한다."""
    model = open(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                              "scripts", "naver_load_model.py"), encoding="utf-8").read()
    assert "wd in keyword_rank_days(plan, biz_id)" in model   # 모델 순위 요일이 잡과 같은 함수를 쓴다


def test_runner_measures_pro_three_times_and_basic_once_per_week(monkeypatch):
    """실제 실행기를 가짜 DB로 일주일 돌려 가게별 측정 횟수를 센다 — 플랜별 요일 선택이 빠지면 실패한다."""
    import asyncio
    import datetime as _dt
    import db.supabase_client as sc
    from scheduler import jobs

    class _Res:
        def __init__(self, data): self.data = data

    subs = [{"user_id": "u_pro", "plan": "pro", "status": "active"}, {"user_id": "u_basic", "plan": "basic", "status": "active"}]
    bizs = [{"id": "11111111-aaaa", "user_id": "u_pro", "name": "p", "naver_place_id": "1", "keywords": ["k"], "region": "r"},
            {"id": "22222222-bbbb", "user_id": "u_basic", "name": "b", "naver_place_id": "2", "keywords": ["k"], "region": "r"}]

    class _Q:
        def __init__(self, table): self.table = table
        def select(self, *_): return self
        def eq(self, *_): return self
        def in_(self, *_): return self

    class _DB:
        def table(self, name): return _Q(name)

    async def fake_execute(q): return _Res(subs if q.table == "subscriptions" else bizs)

    measured: list[tuple[int, str]] = []
    current = {"d": None}

    async def fake_measure(biz):
        measured.append((current["d"].weekday(), biz["id"]))
        return True

    async def no_sleep(_s): return None

    class _FakeDate(_dt.date):
        @classmethod
        def today(cls): return current["d"]

    monkeypatch.setattr(sc, "get_client", lambda: _DB())
    monkeypatch.setattr(sc, "execute", fake_execute)
    monkeypatch.setattr(jobs, "_measure_keyword_rank_for_biz", fake_measure)
    monkeypatch.setattr(jobs.asyncio, "sleep", no_sleep)
    monkeypatch.setattr(jobs, "date", _FakeDate)

    monday = _FakeDate(2026, 11, 2)
    for i in range(7):
        current["d"] = _FakeDate.fromordinal(monday.toordinal() + i)
        asyncio.run(jobs._run_keyword_rank_for_plans(["pro", "basic"], only_today_slot=True))

    pro_days = [d for d, bid in measured if bid.startswith("1111")]
    basic_days = [d for d, bid in measured if bid.startswith("2222")]
    assert len(pro_days) == 3 and len(basic_days) == 1, (pro_days, basic_days)
    assert len(set(pro_days)) == 3                    # 같은 날 중복 측정 없음
