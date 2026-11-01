"""score_history에는 created_at 컬럼이 없다(날짜는 score_date) — 2026-11-01 월간 리포트가 이 컬럼을 조회해 매달 실패하던 결함의 재발 방지."""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent


def test_no_score_history_query_uses_created_at():
    bad = []
    for p in ROOT.rglob("*.py"):
        rel = p.relative_to(ROOT).as_posix()
        # 서버에 남은 추적·임포트되지 않는 옛 복사본(services/ai_scanner_deploy_tmp)은 실행되지 않으므로 제외
        if rel.startswith(("tests/", "venv/", "node_modules/")) or "_deploy_tmp" in rel:
            continue
        s = p.read_text(encoding="utf-8", errors="ignore")
        for m in re.finditer(r'table\("score_history"\)', s):
            seg = s[m.start():m.start() + 450].split(".execute()")[0]
            if "created_at" in seg:
                bad.append(f"{rel}:{s[:m.start()].count(chr(10)) + 1}")
    assert not bad, f"score_history에 없는 created_at 사용: {bad}"


def test_gap_card_lowest_ignores_non_numeric_breakdown_values():
    src = (ROOT / "scheduler" / "jobs.py").read_text(encoding="utf-8")
    assert "_num_items" in src and "isinstance(v, (int, float))" in src
    # 같은 계산을 재현: 문자열·None이 섞여도 TypeError 없이 숫자 항목의 최솟값
    breakdown = {"a": 12.5, "b": "n/a", "c": None, "d": 3, "e": True}
    items = [(k, v) for k, v in breakdown.items() if isinstance(v, (int, float)) and not isinstance(v, bool)]
    assert min(items, key=lambda x: x[1])[0] == "d"
