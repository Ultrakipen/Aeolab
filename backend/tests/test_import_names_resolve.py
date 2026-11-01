"""함수 안에서 늦게 하는 `from services.x import name`이 실제로 존재하는 이름인지 전수 검사.

2026-11-01: jobs.py의 월간 성장 카드가 존재하지 않는 `_FONT_BOLD`를 import해 매달 실패했다(같은 검사로 QR 카드 엔드포인트·이메일 폴백·키워드 폴백도 발견).
함수 안 import는 모듈 로드 때 실행되지 않아 서버가 정상 기동하고 테스트도 통과하기 때문에, 해당 잡이 도는 날에야 드러난다.

모듈을 실제로 import하지 않고 소스를 정적으로 읽는다 — 다른 테스트가 sys.modules에 가짜 모듈을 넣어 두면 실행 순서에 따라 결과가 달라지기 때문이다.
"""
import ast
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SKIP_DIRS = ("tests/", "venv/", "node_modules/")


def _module_file(module: str):
    parts = module.split(".")
    base = ROOT.joinpath(*parts)
    if base.with_suffix(".py").exists():
        return base.with_suffix(".py")
    if (base / "__init__.py").exists():
        return base / "__init__.py"
    return None


def _top_level_names(path: pathlib.Path):
    """모듈 최상위(if/try 안 포함)에 정의되는 이름. 동적 정의(`__getattr__`, import *)가 있으면 None(검사 제외)."""
    tree = ast.parse(path.read_text(encoding="utf-8", errors="ignore"))
    names = set()

    def visit(body):
        for n in body:
            if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                names.add(n.name)
            elif isinstance(n, ast.Assign):
                for t in n.targets:
                    for x in ast.walk(t):
                        if isinstance(x, ast.Name):
                            names.add(x.id)
            elif isinstance(n, (ast.AnnAssign, ast.AugAssign)):
                if isinstance(n.target, ast.Name):
                    names.add(n.target.id)
            elif isinstance(n, ast.Import):
                for a in n.names:
                    names.add((a.asname or a.name).split(".")[0])
            elif isinstance(n, ast.ImportFrom):
                for a in n.names:
                    names.add(a.asname or a.name)
            elif isinstance(n, (ast.For, ast.AsyncFor, ast.While)):
                visit(n.body + n.orelse)
            elif isinstance(n, (ast.If, ast.With, ast.AsyncWith)):
                visit(n.body + getattr(n, "orelse", []))
            elif isinstance(n, ast.Try):
                visit(n.body + n.orelse + n.finalbody)
                for h in n.handlers:
                    visit(h.body)

    visit(tree.body)
    if "__getattr__" in names or "*" in names:
        return None
    return names


def find_unresolved():
    cache = {}
    bad = []
    for p in ROOT.rglob("*.py"):
        rel = p.relative_to(ROOT).as_posix()
        if rel.startswith(SKIP_DIRS) or "_deploy_tmp" in rel or "/venv/" in rel:
            continue
        try:
            tree = ast.parse(p.read_text(encoding="utf-8", errors="ignore"))
        except SyntaxError:
            continue
        for node in ast.walk(tree):
            if not isinstance(node, ast.ImportFrom) or node.level != 0 or not node.module:
                continue
            target = _module_file(node.module)
            if target is None:
                continue  # 서드파티·표준 라이브러리 또는 로컬이 아님
            if target not in cache:
                cache[target] = _top_level_names(target)
            names = cache[target]
            if names is None:
                continue
            for alias in node.names:
                if alias.name == "*" or alias.name in names:
                    continue
                if _module_file(f"{node.module}.{alias.name}") is not None:  # `from routers import share` 같은 하위 모듈
                    continue
                bad.append(f"{rel}:{node.lineno} from {node.module} import {alias.name}")
    return bad


def test_all_local_from_imports_resolve():
    bad = find_unresolved()
    assert not bad, "존재하지 않는 이름 import:\n" + "\n".join(bad)


def test_checker_detects_a_missing_name(tmp_path, monkeypatch):
    """검사기 자체의 변이 확인 — 없는 이름을 import하는 파일이 있으면 실제로 잡아내야 한다."""
    fake_pkg = ROOT / "services" / "_tmp_probe_pkg_mod.py"
    fake_user = ROOT / "services" / "_tmp_probe_user.py"
    try:
        fake_pkg.write_text("def real_name():\n    return 1\n", encoding="utf-8")
        fake_user.write_text(
            "def f():\n    from services._tmp_probe_pkg_mod import real_name, ghost_name\n", encoding="utf-8"
        )
        bad = find_unresolved()
        assert any("ghost_name" in b for b in bad)
        assert not any("real_name" in b for b in bad)
    finally:
        fake_pkg.unlink(missing_ok=True)
        fake_user.unlink(missing_ok=True)
