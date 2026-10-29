"""경쟁사 수동 새로고침 보호 (2026-10-29): 경쟁사별 1시간 + 사용자별 1시간 15회·10분 3회, 네이버 쪽 거절은 503."""
import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from routers import competitor as comp_router
import utils.cache as _cache

NOW = datetime(2026, 10, 29, 12, 0, tzinfo=timezone.utc)


# ── 순수 함수 ────────────────────────────────────────────────────────────
@pytest.mark.parametrize("last,expected", [
    (None, None),
    ("", None),
    ("not-a-date", None),
    ((NOW - timedelta(minutes=5)).isoformat(), 5),
    ((NOW - timedelta(minutes=59, seconds=30)).isoformat(), 59),
    ((NOW - timedelta(minutes=60)).isoformat(), None),      # 정확히 1시간은 새로 읽는다
    ((NOW - timedelta(days=3)).isoformat(), None),
    ((NOW + timedelta(minutes=2)).isoformat(), 0),           # 시계 차이
    ((NOW - timedelta(minutes=10)).replace(tzinfo=None).isoformat(), 10),   # 시간대 없는 값은 UTC로 본다
    ((NOW - timedelta(minutes=10)).isoformat().replace("+00:00", "Z"), 10),
])
def test_recent_minutes(last, expected):
    assert comp_router.manual_sync_recent_minutes(last, NOW) == expected


def test_quota_caps_per_user_and_isolates_users(monkeypatch):
    monkeypatch.setattr(comp_router, "_MANUAL_SYNC_BURST_CAP", 10_000)      # 1시간 한도만 검증
    uid = "u-quota-1"
    _cache.delete(f"comp_manual_sync:{uid}")
    cap = comp_router._MANUAL_SYNC_USER_CAP
    assert all(comp_router.manual_sync_take_quota(uid) for _ in range(cap))
    assert comp_router.manual_sync_take_quota(uid) is False
    assert comp_router.manual_sync_take_quota("someone-else") is True       # 다른 사용자는 영향 없음


def test_quota_window_is_fixed_not_sliding(monkeypatch):
    """창은 첫 요청부터 1시간 고정이다. 마지막 요청이 창 끝 근처여도 그 시각으로 연장되면 안 된다."""
    monkeypatch.setattr(comp_router, "_MANUAL_SYNC_BURST_CAP", 10_000)      # 1시간 한도만 검증
    uid = "u-quota-2"
    _cache.delete(f"comp_manual_sync:{uid}")
    t = [1000.0]
    monkeypatch.setattr(comp_router.time, "monotonic", lambda: t[0])
    monkeypatch.setattr(_cache.time, "monotonic", lambda: t[0])
    cap = comp_router._MANUAL_SYNC_USER_CAP
    for _ in range(cap - 1):
        assert comp_router.manual_sync_take_quota(uid)          # t=1000에 14번 (창 시작 = 1000)
    t[0] = 4000.0                                               # 창 시작 후 3000초 — 아직 같은 창
    assert comp_router.manual_sync_take_quota(uid)              # 15번째
    assert comp_router.manual_sync_take_quota(uid) is False     # 한도
    t[0] = 4700.0                                               # 첫 요청에서 3700초 — 새 창(마지막 요청에서는 700초)
    assert comp_router.manual_sync_take_quota(uid) is True      # 슬라이딩이면 아직 막혀 있다


# ── 엔드포인트 행동 ───────────────────────────────────────────────────────
class _Res:
    def __init__(self, data): self.data = data


class _Q:
    def __init__(self, table, rows): self.table, self.rows, self.payload = table, rows, None
    def select(self, *_): return self
    def eq(self, *_): return self
    def maybe_single(self): return self
    def update(self, payload): self.payload = payload; return self


class _DB:
    def __init__(self, rows): self.rows = rows
    def table(self, name): return _Q(name, self.rows)


def _call(monkeypatch, *, last_synced, user_id="u-ep", place_id="123", admin=False, sync_result=None):
    comp = {"id": "c1", "name": "경쟁", "address": "a", "naver_place_id": place_id, "business_id": "b1",
            "naver_place_last_synced_at": last_synced}
    rows = {"competitors": comp, "businesses": {"user_id": user_id, "region": "창원"}}

    async def fake_execute(q): return _Res(q.rows[q.table])

    calls = []

    async def fake_sync(competitor_id, naver_place_id, supabase, region="", registered_name="", max_age_sec=None):
        calls.append(competitor_id)
        return sync_result if sync_result is not None else {"review_count": 5, "avg_rating": 4.0}

    import services.competitor_place_crawler as cpc
    monkeypatch.setattr(comp_router, "get_client", lambda: _DB(rows))
    monkeypatch.setattr(comp_router, "execute", fake_execute)
    monkeypatch.setattr(cpc, "sync_competitor_place", fake_sync)
    monkeypatch.setattr(comp_router, "_ADMIN_USER_IDS", {user_id} if admin else set())
    out = asyncio.run(comp_router.sync_competitor_place_endpoint("c1", user={"id": user_id}))
    return out, calls


def test_recent_competitor_skips_crawl_and_does_not_use_quota(monkeypatch):
    uid = "u-ep-recent"
    _cache.delete(f"comp_manual_sync:{uid}")
    recent = (datetime.now(timezone.utc) - timedelta(minutes=7)).isoformat()
    out, calls = _call(monkeypatch, last_synced=recent, user_id=uid)
    assert calls == [] and out["refreshed"] is False and out["reason"] == "recent" and out["minutes_ago"] in (6, 7)
    assert _cache.get(f"comp_manual_sync:{uid}") is None            # 접속이 없는 요청은 상한을 쓰지 않는다


def test_stale_competitor_crawls_and_counts_quota(monkeypatch):
    uid = "u-ep-stale"
    _cache.delete(f"comp_manual_sync:{uid}")
    old = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
    out, calls = _call(monkeypatch, last_synced=old, user_id=uid)
    assert calls == ["c1"] and out["refreshed"] is True
    assert _cache.get(f"comp_manual_sync:{uid}")[0] == 1


def test_over_cap_returns_429_without_crawling(monkeypatch):
    monkeypatch.setattr(comp_router, "_MANUAL_SYNC_BURST_CAP", 10_000)
    uid = "u-ep-cap"
    _cache.delete(f"comp_manual_sync:{uid}")
    for _ in range(comp_router._MANUAL_SYNC_USER_CAP):
        assert comp_router.manual_sync_take_quota(uid)
    with pytest.raises(HTTPException) as e:
        _call(monkeypatch, last_synced=None, user_id=uid)
    assert e.value.status_code == 429 and "1시간" in e.value.detail


def test_admin_is_exempt_from_cap(monkeypatch):
    monkeypatch.setattr(comp_router, "_MANUAL_SYNC_BURST_CAP", 10_000)
    uid = "u-ep-admin"
    _cache.delete(f"comp_manual_sync:{uid}")
    for _ in range(comp_router._MANUAL_SYNC_USER_CAP):
        comp_router.manual_sync_take_quota(uid)
    out, calls = _call(monkeypatch, last_synced=None, user_id=uid, admin=True)
    assert calls == ["c1"] and out["refreshed"] is True


# ── 10분 한도(몰아 누르기 방지) ───────────────────────────────────────────
def _fresh(uid):
    _cache.delete(f"comp_manual_sync:{uid}")
    _cache.delete(f"comp_manual_sync_burst:{uid}")


def test_burst_cap_blocks_next_click_within_ten_minutes_then_recovers(monkeypatch):
    uid = "u-burst-1"
    _fresh(uid)
    t = [1000.0]
    monkeypatch.setattr(comp_router.time, "monotonic", lambda: t[0])
    monkeypatch.setattr(_cache.time, "monotonic", lambda: t[0])
    assert comp_router._MANUAL_SYNC_BURST_CAP == 2
    assert all(comp_router.manual_sync_take_quota(uid) for _ in range(comp_router._MANUAL_SYNC_BURST_CAP))
    assert comp_router.manual_sync_take_quota(uid) is False        # 1시간 한도(15)는 남았는데도 막힌다
    t[0] = 1000.0 + 601
    assert comp_router.manual_sync_take_quota(uid) is True          # 10분이 지나면 다시 가능


def test_blocked_attempt_does_not_consume_either_window(monkeypatch):
    uid = "u-burst-2"
    _fresh(uid)
    for _ in range(comp_router._MANUAL_SYNC_BURST_CAP):
        comp_router.manual_sync_take_quota(uid)
    for _ in range(5):
        assert comp_router.manual_sync_take_quota(uid) is False
    assert _cache.get(f"comp_manual_sync:{uid}")[0] == comp_router._MANUAL_SYNC_BURST_CAP            # 거절된 시도는 1시간 횟수에 더해지지 않는다


def test_refund_returns_both_counts_and_never_goes_negative():
    uid = "u-refund"
    _fresh(uid)
    comp_router.manual_sync_refund(uid)                              # 쓴 적 없음 — 오류 없이 무시
    comp_router.manual_sync_take_quota(uid)
    comp_router.manual_sync_refund(uid)
    assert _cache.get(f"comp_manual_sync:{uid}")[0] == 0 and _cache.get(f"comp_manual_sync_burst:{uid}")[0] == 0


# ── 네이버 쪽 거절은 503 + 한도 환급 ──────────────────────────────────────
@pytest.mark.parametrize("err", ["naver_rate_limited", "naver_place_cooldown", "quota_exceeded"])
def test_no_access_errors_return_503_and_refund_quota(monkeypatch, err):
    uid = f"u-busy-{err}"
    _fresh(uid)
    with pytest.raises(HTTPException) as e:
        _call(monkeypatch, last_synced=None, user_id=uid, sync_result={"error": err})
    assert e.value.status_code == 503 and "저장된 값은 그대로" in e.value.detail
    assert err not in e.value.detail                                  # 내부 오류 코드를 사용자에게 보이지 않는다
    assert _cache.get(f"comp_manual_sync:{uid}")[0] == 0               # 접속하지 못했으니 한도를 돌려준다


def test_ip_blocked_returns_503_but_keeps_quota_used(monkeypatch):
    uid = "u-busy-blocked"
    _fresh(uid)
    with pytest.raises(HTTPException) as e:
        _call(monkeypatch, last_synced=None, user_id=uid, sync_result={"error": "ip_blocked"})
    assert e.value.status_code == 503
    assert _cache.get(f"comp_manual_sync:{uid}")[0] == 1               # 접속은 실제로 있었다


def test_other_errors_stay_500(monkeypatch):
    uid = "u-err-500"
    _fresh(uid)
    with pytest.raises(HTTPException) as e:
        _call(monkeypatch, last_synced=None, user_id=uid, sync_result={"error": "timeout"})
    assert e.value.status_code == 500
