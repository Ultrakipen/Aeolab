"""
같은 날 재스캔 오귀속 회귀 테스트 — report.py get_history 의 seen_dates dedup 로직.

Pro+ 플랜은 하루 여러 번 수동 재스캔이 가능하고, scan_results 에 같은 날 여러 행이
생긴다. score_history 는 (business_id, score_date) 유일값이므로 '그 날의 rank_in_category'
는 딱 하나다.

버그 재발 패턴(2026-08-09~10 반복 발견): 같은 날 여러 스캔이 전부 동일한 rank_in_category /
weekly_change / sample_size 를 표시 → 성장 리포트에서 "재스캔할 때마다 순위가 바뀐 것처럼"
오표시됨.

올바른 동작: scanned_at desc 정렬 기준 날짜별 첫 번째 행(최신 스캔)에만 score_history
메타를 붙이고, 같은 날짜의 나머지 행에는 rank_in_category 를 설정하지 않는다.

이 테스트는 report.py get_history 함수를 직접 호출해 위 동작을 검증한다.
"""
import asyncio
import pytest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

# backend/ 루트에서 실행 (cd backend && python -m pytest)
from routers.report import get_history


def _run(coro):
    return asyncio.run(coro)


# ── 테스트용 scan_results: 같은 날 두 번 스캔 (desc 정렬, 최신이 첫 번째) ──────────────
# UTC 2026-08-25T02:30+00:00 → KST 11:30 → score_date "2026-08-25"
# UTC 2026-08-25T01:30+00:00 → KST 10:30 → score_date "2026-08-25"  (같은 날!)
_SCAN_ROWS = [
    {
        "scanned_at": "2026-08-25T02:30:00+00:00",   # 더 최신 (desc 정렬 첫 번째)
        "total_score": 72,
        "track1_score": 60,
        "track2_score": 80,
        "unified_score": 68,
        "exposure_freq": None,
        "competitor_scores": {},
        "score_breakdown": {},
    },
    {
        "scanned_at": "2026-08-25T01:30:00+00:00",   # 더 이른 시각 (desc 정렬 두 번째)
        "total_score": 70,
        "track1_score": 58,
        "track2_score": 78,
        "unified_score": 66,
        "exposure_freq": None,
        "competitor_scores": {},
        "score_breakdown": {},
    },
]

# score_history: 2026-08-25 기준 rank_in_category = 3
_SH_ROWS = [
    {
        "score_date": "2026-08-25",
        "rank_in_category": 3,
        "total_in_category": 10,
        "weekly_change": 5,
        "sample_size": 100,
    }
]


def _make_result(data):
    return SimpleNamespace(data=data)


def test_same_day_dedup_latest_gets_rank():
    """
    같은 날 2개 스캔이 있을 때 scanned_at 최신 행(index 0)에만 rank_in_category 가
    붙어야 하고, 더 이른 행(index 1)에는 rank_in_category 가 없어야 한다.
    """
    scan_result = _make_result(list(_SCAN_ROWS))   # 복사해 원본 훼손 방지
    sh_result = _make_result(list(_SH_ROWS))

    mock_execute = AsyncMock(side_effect=[scan_result, sh_result])
    mock_supabase = MagicMock()

    with (
        patch("routers.report.get_client", return_value=mock_supabase),
        patch("routers.report.execute", new=mock_execute),
        patch(
            "routers.report._verify_biz_ownership",
            new=AsyncMock(return_value=None),
        ),
        patch(
            "middleware.plan_gate.get_user_plan",
            new=AsyncMock(return_value="basic"),
        ),
    ):
        rows = _run(get_history(biz_id="biz1", user={"id": "user1"}))

    assert len(rows) == 2, f"rows 수={len(rows)}, 예상=2"

    # 날짜 변환 확인 (두 행 모두 KST 기준 "2026-08-25" 로 변환돼야 함)
    dates = [r.get("score_date") for r in rows]
    assert all(d == "2026-08-25" for d in dates), (
        f"score_date 변환 실패: {dates}"
    )

    # 핵심 검증 ① 최신 행(index 0)에는 rank_in_category = 3 이 있어야 한다
    latest = rows[0]
    assert latest.get("rank_in_category") == 3, (
        f"최신 행에 rank_in_category 가 없거나 잘못됨: {latest.get('rank_in_category')!r}"
    )
    assert latest.get("weekly_change") == 5
    assert latest.get("sample_size") == 100

    # 핵심 검증 ② 이른 행(index 1)에는 rank_in_category 가 없어야 한다 (dedup)
    earlier = rows[1]
    assert "rank_in_category" not in earlier, (
        "같은 날 두 번째(더 이른) 행에 rank_in_category 가 설정됐습니다. "
        "seen_dates dedup 로직이 동작하지 않습니다."
    )
    assert "weekly_change" not in earlier, (
        "같은 날 두 번째 행에 weekly_change 가 설정됐습니다."
    )


def test_different_days_each_gets_rank():
    """날짜가 다른 두 스캔이면 각각 독립적으로 rank_in_category 를 받아야 한다."""
    scan_rows_2days = [
        {
            "scanned_at": "2026-08-25T02:30:00+00:00",  # KST 11:30 → "2026-08-25"
            "total_score": 72, "track1_score": 60, "track2_score": 80,
            "unified_score": 68, "exposure_freq": None,
            "competitor_scores": {}, "score_breakdown": {},
        },
        {
            "scanned_at": "2026-08-24T02:30:00+00:00",  # KST 11:30 → "2026-08-24"
            "total_score": 70, "track1_score": 58, "track2_score": 78,
            "unified_score": 66, "exposure_freq": None,
            "competitor_scores": {}, "score_breakdown": {},
        },
    ]
    sh_rows_2days = [
        {"score_date": "2026-08-25", "rank_in_category": 3, "total_in_category": 10,
         "weekly_change": 5, "sample_size": 100},
        {"score_date": "2026-08-24", "rank_in_category": 4, "total_in_category": 10,
         "weekly_change": -1, "sample_size": 100},
    ]

    scan_result = _make_result(scan_rows_2days)
    sh_result = _make_result(sh_rows_2days)

    mock_execute = AsyncMock(side_effect=[scan_result, sh_result])
    mock_supabase = MagicMock()

    with (
        patch("routers.report.get_client", return_value=mock_supabase),
        patch("routers.report.execute", new=mock_execute),
        patch(
            "routers.report._verify_biz_ownership",
            new=AsyncMock(return_value=None),
        ),
        patch(
            "middleware.plan_gate.get_user_plan",
            new=AsyncMock(return_value="basic"),
        ),
    ):
        rows = _run(get_history(biz_id="biz1", user={"id": "user1"}))

    assert len(rows) == 2
    assert rows[0].get("rank_in_category") == 3, "2026-08-25 rank=3 이어야 함"
    assert rows[1].get("rank_in_category") == 4, "2026-08-24 rank=4 이어야 함"
