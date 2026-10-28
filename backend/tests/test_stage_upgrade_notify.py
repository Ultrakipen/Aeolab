"""성장 단계 알림톡(AEOLAB_GROWTH_01)은 "상승이 확인될 경우"만 보낸다 (2026-10-28).

승인된 템플릿 본문: "AI 검색 노출 성장 단계가 상승한 것이 확인될 경우 발송됩니다 / 성장 단계 업그레이드 안내".
호출부(jobs.py)는 `prev.stage != curr.stage`만 봐서 단계가 **내려가도** "업그레이드 안내"를 보냈다.
"""
import itertools
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.stage_names import STAGE_NAME, STAGE_ORDER, _UPPER_BOUNDS, is_stage_upgrade  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def test_only_a_higher_stage_is_an_upgrade_for_every_pair():
    for a, b in itertools.product(STAGE_ORDER, STAGE_ORDER):
        expected = STAGE_ORDER.index(b) > STAGE_ORDER.index(a)
        assert is_stage_upgrade(a, b) is expected, (a, b)
    # 하락·유지는 업그레이드가 아니다
    assert is_stage_upgrade("growth", "stability") is False
    assert is_stage_upgrade("dominance", "survival") is False
    assert is_stage_upgrade("stability", "stability") is False
    assert is_stage_upgrade("stability", "growth") is True


def test_unknown_or_missing_codes_are_not_upgrades():
    for a, b in ((None, "growth"), ("growth", None), ("x", "growth"), ("growth", "x"), ("", ""), (None, None)):
        assert is_stage_upgrade(a, b) is False, (a, b)


def test_stage_order_matches_the_score_bands_and_names():
    """순서표가 점수 구간 순서·이름표와 어긋나면 '상승' 판정이 틀어진다."""
    assert list(STAGE_ORDER) == [code for _, code in _UPPER_BOUNDS] + ["dominance"]
    assert set(STAGE_ORDER) == set(STAGE_NAME)


def test_notification_call_site_is_gated_by_is_stage_upgrade():
    """send_growth_stage_upgrade의 호출처는 jobs.py 한 곳이며, 바로 앞 조건에 is_stage_upgrade가 있어야 한다(방향 검사 누락 재발 방지)."""
    calls = []
    for dirpath, _dirs, files in os.walk(ROOT):
        # 서버에는 추적되지 않는 옛 임시 폴더(services/ai_scanner_deploy_tmp, 2026-08-08, 임포트되지 않음)가 있다 — 실행되지 않는 사본은 제외
        if any(skip in dirpath for skip in ("venv", "__pycache__", "tests", ".git", "node_modules", "_tmp", "_bak", "backup")):
            continue
        for fn in files:
            if fn.endswith(".py"):
                src = open(os.path.join(dirpath, fn), encoding="utf-8").read()
                for m in re.finditer(r"\.send_growth_stage_upgrade\(", src):
                    calls.append((fn, src[max(0, m.start() - 900): m.start()]))
    assert len(calls) == 1, [c[0] for c in calls]     # 호출처가 늘면 이 테스트로 새 호출처도 검토하게 한다
    fn, before = calls[0]
    assert fn == "jobs.py"
    # 인자 순서까지 고정한다 — (이전, 현재)가 뒤집히면 하락에만 "업그레이드 안내"가 나간다
    assert re.search(
        r"if\s+_scan_notify_ok\s+and\s+is_stage_upgrade\(\s*prev_stage\.stage\s*,\s*current_stage\.stage\s*\)\s*:", before
    ), "단계 상승 판정(이전→현재 순서) 없이 업그레이드 알림을 보내면 안 된다"
