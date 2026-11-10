"""자동 측정 '매일/내일' 단정과 횟수 표기가 실제 스케줄과 맞는지 (2026-11-10).

실제 스케줄(코드): 풀스캔 Basic 주 2회·창업 주 1회·Pro 주 3회(+경량)·Biz 매일, 키워드 순위 Basic 주 1회·그 외 주 3회(Biz 포함).
NAVER_SCAN_SLOT_SPREAD가 켜진 서버에서는 요일이 사업장마다 달라 "내일/매일/월요일"로 말하면 틀린다.
수정 전: 경쟁사 추가 안내 "내일 새벽 자동 측정", 갭 카드·분석 이력 "매일 새벽 2시", 체험 결과 "매일 변화 추적",
랜딩 키워드 순위 "주 1회~매일"(실제 최대 주 3회), 랜딩 "주 2~3회"(창업 주 1회 누락), 첫 측정 이메일 "곧 실행됩니다".
"""
import os

from services import scan_scheduling as ss

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _read(*parts):
    with open(os.path.join(ROOT, *parts), encoding="utf-8") as f:
        return f.read()


CASES = [
    # (파일, 있으면 안 되는 문구, 있어야 하는 문구)
    (("frontend", "components", "dashboard", "Action7DayChart.tsx"), "매일 새벽 자동 측정", "자동 측정이 실행될 때마다"),
    (("frontend", "app", "(dashboard)", "competitors", "CompetitorsClient.tsx"), "<strong>내일 새벽</strong>", "다음 자동 측정"),
    (("frontend", "app", "(dashboard)", "dashboard", "ScanTrigger.tsx"), "'새벽 2시에 자동 측정이 실행됩니다'", "요일은 요금제에 따라 달라요"),
    (("frontend", "components", "trial", "FactEvidenceSection.tsx"), "+ 매일 변화 추적", "주 1~3회(Biz는 매일)"),
    (("frontend", "components", "dashboard", "GapAnalysisCard.tsx"), "매일 새벽 2시 자동 측정", "다음 자동 측정(새벽 2시)"),
    (("frontend", "components", "landing", "HowAeolabIntegrated.tsx"), "주 2~3회(Biz는 매일)", "주 1~3회(Biz는 매일)"),
    (("frontend", "app", "page.tsx"), "주 1회~매일 업데이트", "주 1회~3회 업데이트"),
    (("backend", "services", "email_sender.py"), "첫 AI 스캔이 곧 실행됩니다", "정해진 요일의 새벽 2시"),
]


def test_each_false_claim_is_gone_and_the_accurate_one_is_there():
    for parts, bad, good in CASES:
        src = _read(*parts)
        assert bad not in src, f"{'/'.join(parts)}: 틀린 문구가 남아 있다 — {bad}"
        assert good in src, f"{'/'.join(parts)}: 정정 문구가 없다 — {good}"


def test_keyword_rank_never_runs_more_than_three_times_a_week_so_never_daily():
    """랜딩의 순위 업데이트 문구가 '매일'이면 안 되는 근거 — 어떤 플랜도 주 3회를 넘지 않는다."""
    for plan in ("basic", "startup", "pro", "biz", "enterprise"):
        for i in range(30):
            assert len(ss.keyword_rank_days(plan, f"biz-{i}")) <= 3, plan


def test_full_scan_counts_match_the_plan_promises():
    legacy = {p: len(ss.legacy_full_scan_days(p)) for p in ("startup", "basic", "pro", "biz")}
    assert legacy == {"startup": 1, "basic": 2, "pro": 3, "biz": 7}
    for p, n in (("startup", 1), ("basic", 2), ("pro", 3)):
        for i in range(30):
            assert len(ss.scheduled_full_scan_days(p, f"biz-{i}")) == n, p


def test_no_user_facing_daily_claim_remains_for_non_biz_plans_in_dashboard_helpers():
    """nextScanLabel: Biz만 '매일'/'내일', 나머지는 횟수만(요일 단정 없음)."""
    src = _read("frontend", "app", "(dashboard)", "dashboard", "sections", "pageHelpers.ts")
    for plan in ("startup", "pro", "basic"):
        line = next(l for l in src.splitlines() if f'p === "{plan}"' in l and "label" in l)
        assert "매일" not in line and "내일" not in line and "월요일" not in line, line
