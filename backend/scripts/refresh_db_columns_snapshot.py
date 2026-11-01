"""운영 DB의 테이블·컬럼 스냅샷을 만든다 (2026-11-01).

`tests/test_db_columns_exist.py`가 코드가 조회하는 컬럼이 실제로 있는지 오프라인으로 검사할 때 쓰는 정답 목록이다.
출처는 PostgREST OpenAPI(`GET {SUPABASE_URL}/rest/v1/`)의 definitions — 실제로 API가 노출하는 테이블·뷰와 컬럼이다.

사용: (서버 또는 .env가 있는 곳에서)  cd backend && set -a && . ./.env && set +a && python scripts/refresh_db_columns_snapshot.py
마이그레이션(컬럼 추가)을 SQL Editor에서 실행한 뒤에는 이 스크립트를 다시 돌려 tests/fixtures/db_columns.json을 갱신하고 커밋한다.
키 값은 출력·저장하지 않는다.
"""
import json
import os
import pathlib
import sys

import httpx

url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not url or not key:
    sys.exit("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다")

r = httpx.get(url.rstrip("/") + "/rest/v1/", headers={"apikey": key, "Authorization": f"Bearer {key}"}, timeout=30)
r.raise_for_status()
defs = r.json().get("definitions") or {}
snapshot = {t: sorted((d.get("properties") or {}).keys()) for t, d in sorted(defs.items())}
out = pathlib.Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "db_columns.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(snapshot, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
print(f"tables={len(snapshot)} columns={sum(len(v) for v in snapshot.values())} -> {out}")
