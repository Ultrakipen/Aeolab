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
    # 2026-11-01: 인라인 `_num_items`를 공통 헬퍼(services/breakdown_utils)로 옮겼다 — 갭 카드도 헬퍼를 거쳐야 한다
    assert "numeric_breakdown_items as _num_bd" in src and "min(_num_bd(breakdown)" in src
    # 문자열·None·bool·목록이 섞여도 TypeError 없이 숫자 항목의 최솟값
    from services.breakdown_utils import numeric_breakdown_items
    breakdown = {"a": 12.5, "b": "n/a", "c": None, "d": 3, "e": True, "f": [1]}
    assert min(numeric_breakdown_items(breakdown), key=lambda x: x[1])[0] == "d"
