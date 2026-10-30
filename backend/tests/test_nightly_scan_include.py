"""야간 스캔의 관리자 사업장 제외 + 검증용 포함 옵션 테스트 — 2026-10-30."""
import inspect

from services.scan_scheduling import exclude_admin_businesses

BIZ = [
    {"id": "b1", "user_id": "admin"},
    {"id": "b2", "user_id": "admin"},
    {"id": "b3", "user_id": "user1"},
]


def test_default_excludes_all_admin_businesses():
    out = exclude_admin_businesses(BIZ, {"admin"})
    assert [b["id"] for b in out] == ["b3"]


def test_include_list_keeps_only_named_admin_businesses():
    out = exclude_admin_businesses(BIZ, {"admin"}, {"b2"})
    assert [b["id"] for b in out] == ["b2", "b3"]


def test_include_list_does_not_affect_non_admin():
    out = exclude_admin_businesses(BIZ, {"admin"}, {"zzz"})
    assert [b["id"] for b in out] == ["b3"]


def test_no_admin_ids_keeps_everything():
    assert len(exclude_admin_businesses(BIZ, set())) == 3


def test_daily_scan_all_uses_helper():
    from scheduler import jobs
    src = inspect.getsource(jobs.daily_scan_all)
    assert "exclude_admin_businesses(" in src and "NIGHTLY_SCAN_INCLUDE_BIZ_IDS" in src
