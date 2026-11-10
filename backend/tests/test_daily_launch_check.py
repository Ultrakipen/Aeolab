"""daily_launch_check.py: 읽기 전용·개인정보 비출력·조회 실패는 '확인 못 함'."""
import importlib.util
import os
from datetime import datetime, timedelta, timezone

PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts", "daily_launch_check.py")
SRC = open(PATH, encoding="utf-8").read()
KST = timezone(timedelta(hours=9))


def _mod():
    spec = importlib.util.spec_from_file_location("daily_launch_check", PATH)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def test_script_never_writes_or_touches_naver():
    for bad in ("sb.table(\"x\").insert", ".update({", ".delete()", ".upsert(", "playwright", "naver.com", "send_"):
        assert bad not in SRC, bad
    import re
    assert not re.search(r"\.table\([^)]*\)\s*\.(insert|update|delete|upsert)\(", SRC)
    assert "sys.path.insert" in SRC      # 위 검사가 이 줄을 오탐하지 않는지(정상 줄은 허용)


def test_no_personal_columns_selected():
    for bad in ("email", "phone", "key_hash", "select(\"*\")"):
        assert f'select("{bad}' not in SRC and f',{bad}' not in SRC, bad


def test_lookup_failure_is_not_reported_as_zero():
    import asyncio
    m = _mod()

    async def boom():
        raise RuntimeError("x")
    assert asyncio.run(m._count("l", boom)).startswith("확인 못 함")


def test_cookie_reminder_phases():
    m = _mod()
    assert "11-17부터 경고" in m.cookie_reminder(datetime(2026, 11, 10, tzinfo=KST))
    assert "교체 임박" in m.cookie_reminder(datetime(2026, 11, 18, tzinfo=KST))
    assert "지남" in m.cookie_reminder(datetime(2026, 11, 25, tzinfo=KST))


def test_subscriber_breakdown_separates_admin_and_unpaid():
    m = _mod()
    rows = [{"user_id": "admin", "status": "active"}, {"user_id": "a", "status": "active"}, {"user_id": "b", "status": "active"},
            {"user_id": "c", "status": "cancelled"}]
    b = m.subscriber_breakdown(rows, {"admin"}, {"a", "c"})
    assert b["활성 전체(스케줄러 트리거 기준)"] == 3 and b["관리자 제외"] == 2 and b["결제 기록 있는 외부"] == 1   # 해지(c)는 활성이 아니다


def test_milestone_gap_matches_scheduler_triggers():
    m = _mod()
    assert m.milestone_gap(0) == "다음 트리거 20명까지 20명" and m.milestone_gap(20) == "다음 트리거 50명까지 30명"
    assert "지남" in m.milestone_gap(100)
    jobs = open(os.path.join(os.path.dirname(PATH), "..", "scheduler", "jobs.py"), encoding="utf-8").read()
    for n in m.MILESTONES:
        assert f"count >= {n}" in jobs        # 점검의 20·50·100이 스케줄러 임계값과 같다


# ── 네이버 사용량·차단 사건·환불/갱신 구간 요약 (2026-11-10) — 형식은 서버에서 확인한 실제 행 ──
REAL_HISTORY_ROW = {"date": "2026-11-09", "used": 35, "batch_used": 33,
                    "by_source": {"naver_scanner.check_mention": 1, "naver_ai_tab_scanner.scan": 4, "naver_keyword_rank.pc": 13}}


def test_usage_summary_uses_real_row_shape_and_flags_small_sample():
    m = _mod()
    out = m.summarize_usage([REAL_HISTORY_ROW, {"date": "x", "used": 15}], 600)
    assert "합계 50페이지" in out and "하루 최대 35페이지" in out and "6%" in out and "참고용" in out
    assert m.summarize_usage([], 600) == "이력 없음" and "상한 미상" in m.summarize_usage([REAL_HISTORY_ROW], 0)


def test_usage_summary_takes_only_the_latest_days():
    m = _mod()
    rows = [{"used": 100}] * 5 + [{"used": 1}] * 7
    assert "최근 7일 합계 7페이지" in m.summarize_usage(rows, 600)


def test_block_summary_distinguishes_recover_only_from_real_blocks():
    m = _mod()
    assert m.summarize_blocks([]) == "0건"
    assert m.summarize_blocks([{"surface": "place", "event": "recover"}]).startswith("회복 기록만")      # 서버의 실제 기록(10-28)
    assert m.summarize_blocks([{"surface": "search", "event": "block"}, {"surface": "place", "event": "recover"}]).startswith("⚠ 차단")


def test_lifecycle_summary_counts_refund_window_and_upcoming_renewals_excluding_admin():
    m = _mod()
    now = datetime(2026, 11, 10, 12, 0, tzinfo=timezone.utc)
    iso = lambda d: d.strftime("%Y-%m-%dT%H:%M:%S+00:00")
    rows = [
        {"user_id": "a", "status": "active", "start_at": iso(now - timedelta(days=2)), "end_at": iso(now + timedelta(days=28))},   # 환불 구간 안
        {"user_id": "b", "status": "active", "start_at": iso(now - timedelta(days=25)), "end_at": iso(now + timedelta(days=3))},   # 갱신 임박
        {"user_id": "adm", "status": "active", "start_at": iso(now - timedelta(days=1)), "end_at": iso(now + timedelta(days=2))},  # 관리자 제외
        {"user_id": "c", "status": "cancelled", "start_at": iso(now - timedelta(days=1)), "end_at": iso(now + timedelta(days=1))},  # 해지 제외
        {"user_id": "d", "status": "active", "start_at": "garbage", "end_at": None},                                              # 형식 오류는 건너뜀
    ]
    out = m.summarize_lifecycle(rows, {"adm"}, now)
    assert "환불 구간 안 1건" in out and "갱신 예정 1건" in out and "외부 활성 구독 3건" in out
    assert "가장 이른 11-13" in out        # b: 11-10 + 3일


def test_cap_default_matches_the_quota_code():
    src = open(os.path.join(os.path.dirname(PATH), "..", "services", "ai_scanner", "__init__.py"), encoding="utf-8").read()
    assert 'os.getenv("NAVER_PLAYWRIGHT_DAILY_CAP", "600")' in src and 'os.getenv("NAVER_PLAYWRIGHT_DAILY_CAP", "600")' in SRC


def test_key_summary_does_not_count_released_or_expired_keys_as_live():
    """11-10 시험 키 6건을 해제한 뒤에도 점검이 '6건'이라 했다 — 효력 있는 키와 해제·만료 키를 나눠야 한다."""
    m = _mod()
    now = datetime(2026, 11, 10, tzinfo=timezone.utc)
    rows = [{"purpose": "discount", "released_at": "2026-11-10T08:00:00+00:00", "expires_at": "2027-11-10T00:00:00+00:00"},
            {"purpose": "trial", "released_at": None, "expires_at": "2027-11-10T00:00:00+00:00"},
            {"purpose": "trial", "released_at": None, "expires_at": "2026-11-01T00:00:00+00:00"}]
    assert m.summarize_keys(rows, now) == "효력 있음 1건 {'trial': 1} / 해제·만료 2건"
    assert m.summarize_keys([], now) == "효력 있음 0건 {} / 해제·만료 0건"
