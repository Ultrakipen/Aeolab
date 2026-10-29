"""네이버 검색 API 종류 이름 구조 검사 (2026-10-29).

2026-09-02 API Hub 전환으로 `search_request`가 허용 목록 밖의 종류에 ValueError를 내게 되었는데, 순위 측정이
"local.json"을 넘기고 있었다. 예외가 측정 오류로 삼켜져 순위가 10-26까지 약 54일간 조용히 실패했다(실행해 보기 전엔 알 수 없는
종류 오타). 이 검사는 코드에 적힌 종류 문자열이 전부 허용 목록 안인지를 실행 없이 확인한다.
"""
import ast
import pathlib

from services.naver_api_hub import _SEARCH_KINDS

ROOT = pathlib.Path(__file__).resolve().parent.parent
# 종류를 첫 인자로 받는 함수: search_request(kind) / naver_visibility._get(kind, params) / naver_keyword_rank._naver_open_api_get(kind, params)
KIND_FUNCS = {"search_request", "_get", "_naver_open_api_get"}


def _kind_literals(source: str):
    for node in ast.walk(ast.parse(source)):
        if not isinstance(node, ast.Call) or not node.args:
            continue
        fn = node.func
        name = fn.id if isinstance(fn, ast.Name) else fn.attr if isinstance(fn, ast.Attribute) else None
        first = node.args[0]
        if name in KIND_FUNCS and isinstance(first, ast.Constant) and isinstance(first.value, str):
            yield name, first.value, node.lineno


def _scan_tree():
    for path in ROOT.rglob("*.py"):
        rel = path.relative_to(ROOT).as_posix()
        if rel.startswith(("tests/", "venv/", ".venv/")) or "site-packages" in rel:
            continue
        try:
            src = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        if not any(f in src for f in KIND_FUNCS):
            continue
        for name, kind, line in _kind_literals(src):
            yield rel, name, kind, line


def test_every_literal_search_kind_is_allowed():
    found = list(_scan_tree())
    assert found, "검사 대상 호출을 하나도 찾지 못했다 — 검사가 비어 있으면 안 된다"
    bad = [(r, n, k, ln) for r, n, k, ln in found if k not in _SEARCH_KINDS and n == "search_request"]
    # _get 같은 이름은 다른 모듈의 같은 이름 함수일 수 있어, 네이버 검색 종류처럼 보이는 문자열(영문 소문자·점)만 의심한다
    bad += [(r, n, k, ln) for r, n, k, ln in found
            if n != "search_request" and k not in _SEARCH_KINDS and (k.endswith(".json") or k in {"cafe", "kin.json", "local.json"})]
    assert not bad, f"허용 목록({sorted(_SEARCH_KINDS)}) 밖의 검색 종류: {bad}"


def test_checker_detects_the_historical_bug():
    """검사 자체의 변이 확인 — 예전 사고 형태(local.json)를 실제로 잡아내는지."""
    hits = list(_kind_literals('x = search_request("local.json")\ny = _get("blog", {})'))
    assert ("search_request", "local.json", 1) in hits
    assert "local.json" not in _SEARCH_KINDS
