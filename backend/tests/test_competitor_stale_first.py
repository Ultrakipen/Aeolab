"""경쟁사 크롤 '오래된 순서 + 하루 예산' 선택과 속도 제한 사용자 몫 확보 (2026-10-28).

요일 슬롯(md5 % 7)의 한계(사업장 20곳이면 최대일이 균등 대비 약 1.8배, 사업장이 바뀌면 배정이 바뀌어 한 주를 건너뛸 수 있음)를
없애는 방식이 실제로 (1) 건너뛰지 않고 (2) 하루 예산을 지키며 (3) 사업장이 늘고 줄어도 유지되는지 날짜별로 시뮬레이션해 확인한다.
"""
import os
import sys
import uuid
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import naver_access_guard as g  # noqa: E402
from services import scan_scheduling as ss  # noqa: E402

TTL = 6.5 * 86400
T0 = datetime(2026, 11, 2, 3, 30, tzinfo=timezone.utc)


def _it(i, last, pages=30):
    return {"id": i, "last": last, "pages": pages}


# ── 선택 규칙 ─────────────────────────────────────────────────────────────
def test_oldest_first_and_unobserved_first():
    items = [_it("a", T0 - timedelta(days=8)), _it("b", None), _it("c", T0 - timedelta(days=10))]
    assert ss.select_stale_first(items, T0, TTL, 1000, date(2026, 11, 2), pace_days=None) == ["b", "c", "a"]


def test_not_yet_stale_is_skipped():
    items = [_it("fresh", T0 - timedelta(days=2)), _it("edge", T0 - timedelta(days=6.4)), _it("due", T0 - timedelta(days=6.6))]
    assert ss.select_stale_first(items, T0, TTL, 1000, date(2026, 11, 2), pace_days=None) == ["due"]


def test_budget_cut_keeps_strict_oldest_first_and_never_skips_ahead():
    items = [_it("old_big", T0 - timedelta(days=9), 100), _it("mid_small", T0 - timedelta(days=8), 10), _it("new_small", T0 - timedelta(days=7), 10)]
    # 예산 105: old_big(100) 포함 후 mid_small(10)은 넘으므로 중단 — 작은 것을 건너뛰고 뒤 것을 먼저 하지 않는다
    assert ss.select_stale_first(items, T0, TTL, 105, date(2026, 11, 2), pace_days=None) == ["old_big"]


def test_oldest_is_always_included_even_if_over_budget():
    items = [_it("huge", T0 - timedelta(days=9), 500)]
    assert ss.select_stale_first(items, T0, TTL, 50, date(2026, 11, 2), pace_days=None) == ["huge"]


def test_zero_or_negative_budget_selects_nothing():
    items = [_it("a", None)]
    assert ss.select_stale_first(items, T0, TTL, 0, date(2026, 11, 2)) == []
    assert ss.select_stale_first(items, T0, TTL, -5, date(2026, 11, 2)) == []


def test_ties_are_deterministic_within_a_day_and_vary_across_days():
    items = [_it(str(i), T0 - timedelta(days=8)) for i in range(20)]
    a = ss.select_stale_first(items, T0, TTL, 1000, date(2026, 11, 2), pace_days=None)
    assert a == ss.select_stale_first(items, T0, TTL, 1000, date(2026, 11, 2), pace_days=None)
    assert a != ss.select_stale_first(items, T0, TTL, 1000, date(2026, 11, 3), pace_days=None)


# ── 입력 가공 ─────────────────────────────────────────────────────────────
def test_parse_ts_handles_z_naive_empty_and_garbage():
    assert ss.parse_ts(None) is None and ss.parse_ts("") is None and ss.parse_ts("not a date") is None
    assert ss.parse_ts("2026-11-02T03:30:00Z") == datetime(2026, 11, 2, 3, 30, tzinfo=timezone.utc)
    assert ss.parse_ts("2026-11-02T03:30:00").tzinfo is not None


def test_build_items_uses_oldest_observation_and_unobserved_wins():
    rows = [
        {"business_id": "b1", "naver_place_last_synced_at": "2026-10-20T00:00:00+00:00"},
        {"business_id": "b1", "naver_place_last_synced_at": "2026-10-30T00:00:00+00:00"},
        {"business_id": "b2", "naver_place_last_synced_at": "2026-10-30T00:00:00+00:00"},
        {"business_id": "b2", "naver_place_last_synced_at": None},
    ]
    items = {i["id"]: i for i in ss.build_stale_items(rows, T0)}
    assert items["b1"]["last"] == datetime(2026, 10, 20, tzinfo=timezone.utc) and items["b1"]["pages"] == 2 * ss.COMPETITOR_PAGE_COST
    assert items["b2"]["last"] is None            # 한 곳이라도 관측이 없으면 가장 우선


def test_cache_still_valid_guards_enrich_from_new_crawls():
    assert ss.cache_still_valid(T0 - timedelta(days=2), T0, TTL) is True
    assert ss.cache_still_valid(T0 - timedelta(days=6.4), T0, TTL) is False   # TTL 직전은 건너뜀
    assert ss.cache_still_valid(None, T0, TTL) is False


# ── 시뮬레이션: 건너뛰지 않고, 예산을 지키고, 사업장이 바뀌어도 유지 ─────────────────
def _simulate(n_biz, days, budget, comps=3, churn=False, seed="a"):
    """매일 선택 → 선택된 사업장은 관측 시각 갱신. 반환: (일별 처리 페이지, 사업장별 동기화 날짜 목록)."""
    def _id(k):                                                   # 결정적 ID — 무작위 UUID면 테스트가 흔들린다
        return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{seed}-{k}"))

    counter = [0]

    def _next_id():
        counter[0] += 1
        return _id(counter[0])

    state = {_next_id(): None for _ in range(n_biz)}              # biz -> 마지막 관측(없음)
    synced: dict = {b: [] for b in state}
    daily = []
    for d in range(days):
        now = T0 + timedelta(days=d)
        if churn and d == 20:                                    # 20일째에 5곳 추가, 3곳 삭제
            for _ in range(5):
                b = _next_id()
                state[b] = None
                synced[b] = []
            for b in list(state)[:3]:
                state.pop(b)
        rows = [{"business_id": b, "naver_place_last_synced_at": (v.isoformat() if v else None)}
                for b, v in state.items() for _ in range(comps)]
        picked = ss.select_stale_first(ss.build_stale_items(rows, now), now, TTL, budget, now.date())
        for b in picked:
            state[b] = now
            synced[b].append(d)
        daily.append(len(picked) * comps * ss.COMPETITOR_PAGE_COST)
    return daily, synced


def _max_gap(synced):
    return max(max((y - x for x, y in zip(ds, ds[1:])), default=0) for ds in synced.values())


def test_simulation_20_businesses_never_skip_and_stay_in_budget():
    budget = 252                                                  # 상한 600 x 배치 0.7 x 경쟁사 0.6
    daily, synced = _simulate(20, 90, budget)
    assert all(synced.values()), "한 번도 동기화되지 않은 사업장이 있다"
    assert _max_gap(synced) <= 8                                  # 캐시 TTL 6.5일 + 하루 처리 지연 이내
    assert max(daily) <= budget + 30                              # 맨 앞 1곳은 예산을 넘겨도 포함(최대 1곳 초과)


def test_simulation_load_is_smoother_than_fixed_tuesday_and_hash_slots():
    daily, _ = _simulate(20, 60, 252)
    steady = daily[14:]                                           # 처음 며칠(예산만큼 처리하며 엇갈리는 구간) 이후
    fixed_tuesday_peak = 20 * 3 * ss.COMPETITOR_PAGE_COST         # 전원 같은 날 = 600
    assert max(steady) < fixed_tuesday_peak * 0.5
    # pacing 한도(600/6 = 100) + 마지막 한 곳(30) 이내 — 해시 슬롯 시뮬레이션의 평균 최대일(20곳 5.3곳 = 159페이지)보다 낮다
    assert max(steady) <= 100 + 30
    assert max(steady) < 5.3 * 3 * ss.COMPETITOR_PAGE_COST


def test_simulation_churn_does_not_cause_skipped_week():
    _, synced = _simulate(20, 90, 252, churn=True)
    assert _max_gap(synced) <= 8


def test_simulation_small_population_with_churn_keeps_weekly_cadence():
    # 회귀: pacing 한도를 엄격하게 자르면 한도(50)가 한 곳 크기(30)의 1.67배라 한 곳씩만 들어가 간격이 13일까지 벌어졌다
    # 사업장 5곳이 한꺼번에 추가되면 관측 없는 새 곳이 먼저라 기존 곳이 며칠 밀린다 — 핵심은 한 주(14일)를 건너뛰지 않는 것
    for n in (3, 8, 20):
        for seed in ("a", "b", "c", "d"):
            _, synced = _simulate(n, 90, 252, churn=True, seed=seed)
            assert _max_gap(synced) <= 10, f"N={n} seed={seed}"


def test_pace_days_none_restores_plain_budget_selection():
    items = [_it(str(i), T0 - timedelta(days=9 + i), 30) for i in range(10)]
    assert len(ss.select_stale_first(items, T0, TTL, 1000, date(2026, 11, 2), pace_days=None)) == 10
    assert len(ss.select_stale_first(items, T0, TTL, 1000, date(2026, 11, 2))) < 10     # 기본은 pacing 으로 나눈다


def test_simulation_budget_shortage_degrades_gracefully_not_starves():
    # 예산이 부족한 큰 규모(100곳, 예산 252) — 모두 7일에 못 돌지만 가장 오래된 순서라 한 곳도 굶지 않고 순환한다
    _, synced = _simulate(100, 120, 252)
    assert all(synced.values())
    assert _max_gap(synced) <= 100 * 3 * 10 / 252 + 3             # 한 바퀴 = 총 페이지 / 일일 예산(+여유)


# ── 속도 제한: 정기 잡이 윈도우를 다 채워도 사용자 요청 몫이 남는다 ───────────────────
def _fill(pages_per_call, calls, start):
    for i in range(calls):
        g._rate["entries"].append([start + i, pages_per_call])


def test_batch_cannot_use_the_users_share_of_the_window():
    g.reset_rate_for_tests()
    g._rate_load()
    now = 1_000_000.0
    _fill(10, 8, now - 3000)             # 최근 1시간 80페이지 사용
    # 배치(0.7 -> 1시간 84): 10페이지 더 넣으면 90 > 84 이므로 기다려야 한다
    assert g._earliest_slot(10, now, 0.7) > now
    # 사용자(1.0 -> 120): 같은 상태에서 90 <= 120 이므로 즉시
    assert g._earliest_slot(10, now, 1.0) == now


def test_scale_one_matches_previous_behavior():
    g.reset_rate_for_tests()
    g._rate_load()
    now = 2_000_000.0
    _fill(10, 12, now - 3000)            # 120페이지로 가득 참
    assert g._earliest_slot(10, now) > now
    assert g._earliest_slot(10, now, 1.0) == g._earliest_slot(10, now)


def test_batch_ratio_default_matches_cap_ratio_and_is_clamped(monkeypatch):
    monkeypatch.delenv("NAVER_BATCH_RATE_RATIO", raising=False)
    monkeypatch.setenv("NAVER_BATCH_CAP_RATIO", "0.7")
    assert g.batch_rate_ratio() == 0.7
    monkeypatch.setenv("NAVER_BATCH_RATE_RATIO", "5")
    assert g.batch_rate_ratio() == 1.0
    monkeypatch.setenv("NAVER_BATCH_RATE_RATIO", "abc")
    assert g.batch_rate_ratio() == 0.7


def test_flags_default_off(monkeypatch):
    monkeypatch.delenv("NAVER_COMPETITOR_STALE_FIRST", raising=False)
    assert ss.competitor_stale_first_enabled() is False
    monkeypatch.setenv("NAVER_COMPETITOR_STALE_FIRST", "true")
    assert ss.competitor_stale_first_enabled() is True
