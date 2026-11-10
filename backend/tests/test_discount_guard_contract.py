"""재가입 방어 — 프런트↔백엔드 계약과 운영 도구 안전장치 (2026-11-10)."""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FE = os.path.join(ROOT, "frontend")
BE = os.path.join(ROOT, "backend")


def _read(*parts):
    with open(os.path.join(*parts), encoding="utf-8") as f:
        return f.read()


def test_frontend_eligibility_path_matches_backend_route():
    api = _read(FE, "lib", "api.ts")
    m = re.search(r"getDiscountEligibility[\s\S]*?\$\{BACKEND_URL\}(/api/[A-Za-z0-9_/\-]+)", api)
    assert m, "lib/api.ts 에 getDiscountEligibility 경로가 없다"
    path = m.group(1)
    main = _read(BE, "main.py")
    prefix = re.search(r'include_router\(webhook\.router,\s*prefix="([^"]+)"', main).group(1)
    webhook = _read(BE, "routers", "webhook.py")
    route = re.search(r'@router\.get\("([^"]*discount-eligibility)"\)', webhook)
    assert route, "백엔드에 discount-eligibility 라우트가 없다"
    assert prefix + route.group(1) == path


def test_pay_button_asks_server_and_only_downgrades_on_explicit_false():
    src = _read(FE, "app", "(public)", "pricing", "PayButton.tsx")
    assert "getDiscountEligibility" in src
    assert "r.eligible === false" in src                   # null(모름)·오류는 할인가 표시를 바꾸지 않는다
    assert "discountDeniedByServer" in src


def test_release_script_is_dry_run_by_default_and_never_prints_the_value():
    src = _read(BE, "scripts", "discount_key_release.py")
    assert 'action="store_true"' in src
    assert src.index("if not args.apply") < src.index("dg.release(")
    for line in src.splitlines():
        if line.strip().startswith("print(") and "{args.value}" in line:
            raise AssertionError("원문 값을 출력하면 안 된다: " + line.strip())


def test_guard_defaults_off_in_code():
    src = _read(BE, "services", "discount_guard.py")
    assert 'os.getenv("DISCOUNT_KEY_GUARD_ENABLED", "false")' in src


def test_schema_sql_documents_the_table_and_snapshot_has_it():
    sql = _read(ROOT, "scripts", "supabase_schema.sql")
    assert "CREATE TABLE IF NOT EXISTS discount_used_keys" in sql
    assert "UNIQUE (purpose, key_type, key_hash)" in sql
    import json
    snap = json.loads(_read(BE, "tests", "fixtures", "db_columns.json"))
    cols = set(snap["discount_used_keys"])
    for c in ("purpose", "key_type", "key_hash", "expires_at", "released_at"):
        assert c in cols
