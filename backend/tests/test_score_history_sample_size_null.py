"""score_history.sample_size — Gemini를 측정하지 못한 스캔을 '50회 중 0회'로 기록하지 않는다 (2026-10-30, 컬럼은 NULL 허용 확인)."""
import pathlib


def test_score_history_sample_size_not_faked_as_50():
    src = (pathlib.Path(__file__).resolve().parent.parent / "routers" / "scan.py").read_text(encoding="utf-8")
    assert '"sample_size": (results.get("gemini") or {}).get("sample_size") or 50' not in src
    assert '"sample_size": (result.get("gemini") or {}).get("sample_size") or 50' not in src
    assert 'result.get("gemini", {}).get("sample_size") or 50' not in src
    assert src.count('.get("sample_size") or None') >= 3


def test_nightly_scan_history_row_records_sample_size():
    """야간 스캔(daily_scan_all)의 score_history 행에도 sample_size가 있어야 한다 — 없으면 측정된 행도 화면에 '확인 전'으로 나온다 (2026-10-31).

    소스 부분 문자열이 아니라 AST로 `_history_row` 딕셔너리의 키를 본다."""
    import ast

    src = (pathlib.Path(__file__).resolve().parent.parent / "scheduler" / "jobs.py").read_text(encoding="utf-8")
    tree = ast.parse(src)
    found = []
    for node in ast.walk(tree):
        target = None
        if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            target, value = node.target.id, node.value
        elif isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            target, value = node.targets[0].id, node.value
        if target == "_history_row" and isinstance(value, ast.Dict):
            found.append({k.value for k in value.keys if isinstance(k, ast.Constant)})
    assert found, "_history_row 딕셔너리를 찾지 못함(코드 구조가 바뀌었으면 이 테스트를 갱신)"
    assert all("sample_size" in keys for keys in found), found
    assert all("exposure_freq" in keys for keys in found)
