"""코드가 조회·필터·정렬·저장하는 컬럼이 실제 DB에 있는지 오프라인으로 검사한다 (2026-11-01).

2026-11-01 하루에 같은 종류의 사고가 세 번 나왔다 — `competitors.kakao_place_id`(businesses에만 있음), `score_history.created_at`(score_date),
`scan_results.created_at`(scanned_at). 없는 컬럼을 쓰면 PostgREST가 42703/PGRST204로 거절하고 해당 기능은 조용히 실패한다.

정답은 `tests/fixtures/db_columns.json`(운영 DB의 PostgREST OpenAPI 스냅샷, `scripts/refresh_db_columns_snapshot.py`로 갱신)이다.
마이그레이션으로 컬럼을 추가한 뒤에는 스냅샷을 다시 만들어 커밋해야 새 컬럼을 쓰는 코드가 통과한다.

검사 범위: `X.table("이름")`에서 시작하는 **직접 체인**의 select/eq/order/in_/or_ 등 첫 인자와 insert/update/upsert의 dict 리터럴 키.
변수에 담았다가 이어 붙이는 체인, `table(변수)`, dict 변수는 보지 못한다(과소 탐지, 오탐 방지를 위해 모르면 건너뛴다).
"""
import ast
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SNAPSHOT = ROOT / "tests" / "fixtures" / "db_columns.json"

# 첫 인자가 컬럼 이름인 필터·정렬 메서드
COLUMN_ARG_METHODS = {
    "eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is_", "in_", "contains", "contained_by",
    "order", "filter", "not_in", "overlaps", "range_gt", "range_gte", "range_lt", "range_lte", "text_search",
}
WRITE_METHODS = {"insert", "update", "upsert"}

# 알려진 예외: (파일 상대경로, 테이블, 컬럼) -> 이유. 비어 있어야 정상 — 추가하려면 실제 DB에 컬럼이 없는데도 안전한 이유를 적는다.
KNOWN_EXCEPTIONS: dict[tuple[str, str, str], str] = {}


# ── 추출기 ──────────────────────────────────────────────────────────

def _split_top_level(s: str) -> list[str]:
    out, depth, cur = [], 0, []
    for ch in s:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            out.append("".join(cur))
            cur = []
        else:
            cur.append(ch)
    out.append("".join(cur))
    return out


def _clean_column(token: str) -> str | None:
    """select/필터 토큰에서 실제 컬럼 이름만. 컬럼이 아니면 None."""
    t = token.strip()
    if not t or t == "*" or "(" in t:          # 빈 값·전체·임베드(관계) — 건너뜀
        return None
    t = re.split(r"::", t)[0]                   # 캐스트
    if ":" in t:                                # 별칭 `alias:col`
        t = t.split(":", 1)[1]
    t = re.split(r"->", t)[0]                   # JSON 경로 `col->>key`
    t = t.strip()
    return t if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", t) else None


def parse_select(s: str) -> list[str]:
    cols = []
    for tok in _split_top_level(s):
        c = _clean_column(tok)
        if c:
            cols.append(c)
    return cols


def parse_or(s: str) -> list[str]:
    """or_("a.lt.x,b.is.null") → [a, b]. and()/or() 중첩이 있으면 그 조건은 건너뛴다."""
    cols = []
    for cond in _split_top_level(s):
        cond = cond.strip()
        if "(" in cond or "." not in cond:
            continue
        c = _clean_column(cond.split(".", 1)[0])
        if c:
            cols.append(c)
    return cols


def _table_of_chain(node):
    """체인 아래로 내려가 `.table("이름")`을 찾는다. 못 찾거나 이름이 리터럴이 아니면 None."""
    cur = node
    while True:
        if isinstance(cur, ast.Call):
            f = cur.func
            if isinstance(f, ast.Attribute) and f.attr == "table":
                if cur.args and isinstance(cur.args[0], ast.Constant) and isinstance(cur.args[0].value, str):
                    return cur.args[0].value
                return None
            cur = f.value if isinstance(f, ast.Attribute) else None
        elif isinstance(cur, ast.Attribute):
            cur = cur.value
        else:
            return None
        if cur is None:
            return None


def _dict_keys(node) -> list[str]:
    nodes = node.elts if isinstance(node, (ast.List, ast.Tuple)) else [node]
    keys = []
    for n in nodes:
        if isinstance(n, ast.Dict):
            for k in n.keys:
                if isinstance(k, ast.Constant) and isinstance(k.value, str):
                    keys.append(k.value)
    return keys


def collect_refs(source: str):
    """[(줄, 테이블, 컬럼, 종류)]"""
    refs = []
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return refs
    for node in ast.walk(tree):
        if not (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)):
            continue
        method = node.func.attr
        if method not in COLUMN_ARG_METHODS and method not in WRITE_METHODS and method not in ("select", "or_"):
            continue
        table = _table_of_chain(node.func.value)
        if not table or not node.args:
            continue
        a0 = node.args[0]
        if method == "select" and isinstance(a0, ast.Constant) and isinstance(a0.value, str):
            refs += [(node.lineno, table, c, "select") for c in parse_select(a0.value)]
        elif method == "or_" and isinstance(a0, ast.Constant) and isinstance(a0.value, str):
            refs += [(node.lineno, table, c, "or_") for c in parse_or(a0.value)]
        elif method in COLUMN_ARG_METHODS and isinstance(a0, ast.Constant) and isinstance(a0.value, str):
            c = _clean_column(a0.value.split(".")[0] if method == "order" else a0.value)
            if c:
                refs.append((node.lineno, table, c, method))
        elif method in WRITE_METHODS:
            refs += [(node.lineno, table, k, method) for k in _dict_keys(a0)]
    return refs


def _backend_files():
    for p in ROOT.rglob("*.py"):
        rel = p.relative_to(ROOT).as_posix()
        if rel.startswith(("tests/", "venv/", "node_modules/")) or "_deploy_tmp" in rel or "/venv/" in rel:
            continue
        if p.name.startswith("_patch"):          # 일회성 패치 스크립트
            continue
        yield p, rel


def find_violations(snapshot: dict):
    bad = []
    for p, rel in _backend_files():
        for line, table, col, kind in collect_refs(p.read_text(encoding="utf-8", errors="ignore")):
            if (rel, table, col) in KNOWN_EXCEPTIONS:
                continue
            if table not in snapshot:
                bad.append(f"{rel}:{line} 테이블 '{table}'이 DB에 없다 ({kind} {col})")
            elif col not in snapshot[table]:
                bad.append(f"{rel}:{line} {table}.{col} 컬럼이 DB에 없다 ({kind})")
    return sorted(set(bad))


# ── 추출기 단위 테스트(오탐 방지: 파서가 틀리면 이 검사 전체가 무의미) ──────────

def _refs(src):
    return {(t, c, k) for _l, t, c, k in collect_refs(src)}


def test_extractor_handles_the_chain_shapes_used_in_this_codebase():
    src = '''
async def f(sb):
    await _db(sb.table("scan_results").select("id, scanned_at, gemini_result").eq("business_id", b).not_.is_("keyword_ranks", "null").order("scanned_at", desc=True).limit(1))
    await execute(get_client().table("competitors").select("id, name, ai:ai_count, meta->>k, cnt::text, rel(a, b)").in_("id", ids).gte("created_at", d))
    sb.table("businesses").update({"kakao_registered": True, "name": n}).eq("id", i).execute()
    sb.table("notifications").insert({"user_id": u, "type": "x"}).execute()
    sb.table("score_history").select("*").or_("last_post_at.lt.x,last_post_at.is.null,and(a.eq.1,b.eq.2)").execute()
    sb.table(dynamic_name).select("zzz").execute()
    q = sb.table("x"); q.select("yyy")
'''
    got = _refs(src)
    assert ("scan_results", "id", "select") in got and ("scan_results", "gemini_result", "select") in got
    assert ("scan_results", "keyword_ranks", "is_") in got and ("scan_results", "scanned_at", "order") in got
    assert ("competitors", "ai_count", "select") in got          # 별칭은 뒤쪽 실제 컬럼
    assert ("competitors", "meta", "select") in got and ("competitors", "cnt", "select") in got
    assert not any(c in ("rel", "a", "b") for _t, c, _k in got if _t == "competitors")   # 임베드는 건너뜀
    assert ("competitors", "created_at", "gte") in got and ("competitors", "id", "in_") in got
    assert ("businesses", "kakao_registered", "update") in got and ("businesses", "name", "update") in got
    assert ("notifications", "user_id", "insert") in got
    assert ("score_history", "last_post_at", "or_") in got
    assert not any(c in ("a", "b") for _t, c, _k in got if _t == "score_history")        # and(...) 중첩은 건너뜀
    assert not any(c in ("zzz", "yyy") for _t, c, _k in got)                              # 동적 테이블·변수 체인은 건너뜀


def test_select_star_and_empty_are_not_columns():
    assert parse_select("*") == [] and parse_select(" , ") == []
    assert parse_select("id, name,\n  created_at") == ["id", "name", "created_at"]


def test_checker_flags_a_missing_column_and_missing_table():
    snap = {"competitors": ["id", "name"]}
    refs = collect_refs('sb.table("competitors").select("id, kakao_place_id").execute()\nsb.table("ghost").select("id")')
    assert any(c == "kakao_place_id" for _l, t, c, _k in refs if t == "competitors")
    # find_violations는 파일을 읽으므로 같은 판정을 직접 재현
    flagged = [(t, c) for _l, t, c, _k in refs if t not in snap or c not in snap[t]]
    assert ("competitors", "kakao_place_id") in flagged and ("ghost", "id") in flagged
    assert ("competitors", "id") not in flagged


# ── 본 검사 ───────────────────────────────────────────────────────

def test_snapshot_matches_the_known_incidents():
    snap = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    assert "kakao_place_id" not in snap["competitors"] and "kakao_place_id" in snap["businesses"]
    assert "created_at" not in snap["score_history"] and "score_date" in snap["score_history"]
    assert "created_at" not in snap["scan_results"] and "scanned_at" in snap["scan_results"]


def test_every_referenced_column_exists_in_the_database():
    snap = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    bad = find_violations(snap)
    assert not bad, (
        "코드가 DB에 없는 테이블·컬럼을 쓴다(실제 호출하면 42703/PGRST204로 실패). 컬럼을 추가하는 마이그레이션이면 "
        "SQL 실행 후 scripts/refresh_db_columns_snapshot.py로 스냅샷을 갱신하고, 아니면 코드를 고친다:\n" + "\n".join(bad)
    )
