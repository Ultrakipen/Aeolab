"""쓰기 라우트 드라이런 점검 (2026-11-01 spike) — 실제 DB에는 아무것도 쓰지 않는다.

방식: 서버 앱을 TestClient로 호출하되
 - DB 호스트로 가는 non-GET 요청은 **전송하지 않고 가로채서** 대상 테이블·컬럼을 tests/fixtures/db_columns.json과 대조한 뒤 가짜 성공 응답을 돌려준다
   (PostgREST /rest/v1/ 만. Auth·Storage·rpc 등 그 밖의 쓰기는 막고 기록만 한다)
 - 읽기는 실제 DB로 간다(라우트가 소유권·존재 확인을 하므로)
 - 외부 연결(네이버·카카오·AI·결제 등)·Playwright·Gemini는 차단
 - 인증은 get_current_user 의존성만 대체
요청 본문은 OpenAPI 스키마의 필수 필드만으로 자동 생성한다.

한계(알고 쓸 것): 가짜 응답이라 UNIQUE/NOT NULL/FK/RLS 같은 DB 제약은 검증하지 못한다. 가로채기가 우회되는 경로(httpx 밖의 HTTP 라이브러리)가 있으면
실제로 쓰일 수 있으므로, 실행 전후 테이블 행 수를 비교해 누수가 없는지 출력한다. 파괴적 라우트(계정·사업장 삭제, 결제, 관리자 일괄 발송)는 목록에 넣지 않는다.

사용(서버): cd backend && set -a && . ./.env && set +a && PYTHONPATH=. python scripts/route_write_dryrun.py
"""
import json
import logging
import os
import pathlib
import re
import socket
import sys
import threading
import traceback

os.environ["SENTRY_DSN"] = ""
os.environ["NEXT_PUBLIC_SENTRY_DSN"] = ""
logging.disable(logging.CRITICAL)

ALLOWED_HOSTS = ("supabase.co", "localhost", "127.0.0.1", "::1")
blocked_hosts = {}
current = {"route": ""}
_real_gai = socket.getaddrinfo


def _gai(host, *a, **k):
    h = str(host or "")
    if h == "" or any(x in h for x in ALLOWED_HOSTS):
        return _real_gai(host, *a, **k)
    blocked_hosts.setdefault(h, set()).add(current["route"])
    raise socket.gaierror(-2, "blocked by dry-run")


socket.getaddrinfo = _gai

import playwright.async_api as _pa  # noqa: E402


def _no_pw(*a, **k):
    raise RuntimeError("playwright blocked by dry-run")


_pa.async_playwright = _no_pw
try:
    import google.generativeai as _g

    def _no_gemini(self, *a, **k):
        raise ConnectionError("gemini blocked by dry-run")

    _g.GenerativeModel.generate_content = _no_gemini
    _g.GenerativeModel.generate_content_async = _no_gemini
except Exception:
    pass

import httpx  # noqa: E402

# backend 폴더에서 실행하는 것을 전제로 현재 폴더 기준 경로(스크립트 위치에 의존하지 않는다)
SNAP = json.loads(pathlib.Path(os.environ.get("DB_COLUMNS_SNAPSHOT", "tests/fixtures/db_columns.json")).read_text(encoding="utf-8"))
write_log = []      # (route, METHOD, table, [keys])
schema_problems = []
blocked_writes = {}  # "METHOD path" -> routes


def _is_db(request):
    return "supabase.co" in str(request.url.host)


def _fake_response(request):
    path = request.url.path
    m = re.match(r"^/rest/v1/([A-Za-z0-9_]+)$", path)
    if not m:
        blocked_writes.setdefault(f"{request.method} {path}", set()).add(current["route"])
        raise RuntimeError("non-REST DB write blocked by dry-run")
    table = m.group(1)
    try:
        body = json.loads(request.content.decode("utf-8")) if request.content else None
    except Exception:
        body = None
    rows = body if isinstance(body, list) else ([body] if isinstance(body, dict) else [])
    keys = sorted({k for r in rows if isinstance(r, dict) for k in r})
    write_log.append((current["route"], request.method, table, keys))
    if table not in SNAP:
        schema_problems.append(f"{current['route']}: table '{table}' not in DB ({request.method})")
    else:
        for k in keys:
            if k not in SNAP[table]:
                schema_problems.append(f"{current['route']}: {table}.{k} not in DB ({request.method})")
    if request.method == "DELETE":
        data = []
    else:
        data = [{"id": "00000000-0000-0000-0000-000000000000", **(r if isinstance(r, dict) else {})} for r in (rows or [{}])]
    return httpx.Response(201 if request.method == "POST" else 200, json=data, request=request)


_orig_send = httpx.Client.send
_orig_asend = httpx.AsyncClient.send


def _send(self, request, *a, **k):
    if _is_db(request) and request.method not in ("GET", "HEAD"):
        return _fake_response(request)
    return _orig_send(self, request, *a, **k)


async def _asend(self, request, *a, **k):
    if _is_db(request) and request.method not in ("GET", "HEAD"):
        return _fake_response(request)
    return await _orig_asend(self, request, *a, **k)


httpx.Client.send = _send
httpx.AsyncClient.send = _asend

from db.supabase_client import get_client  # noqa: E402
import main  # noqa: E402
from middleware.plan_gate import get_current_user  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

c = get_client()
BIZ_NAME = sys.argv[1] if len(sys.argv) > 1 else "하라식당 본점"
biz = c.table("businesses").select("id,user_id,category,region,name").eq("name", BIZ_NAME).execute().data[0]
user = c.auth.admin.get_user_by_id(biz["user_id"]).user
main.app.dependency_overrides[get_current_user] = lambda: {"id": biz["user_id"], "email": user.email}
client = TestClient(main.app)

comp = c.table("competitors").select("id").eq("business_id", biz["id"]).limit(1).execute().data
guide = c.table("guides").select("id").eq("business_id", biz["id"]).limit(1).execute().data
VALS = {
    "biz_id": biz["id"], "business_id": biz["id"], "competitor_id": comp[0]["id"] if comp else None,
    "guide_id": guide[0]["id"] if guide else None, "keyword": "dryrun", "faq_index": "0",
}

# 파괴적·결제·관리자·외부 부작용이 큰 라우트는 넣지 않는다(허용 목록 방식).
ALLOW = [
    ("POST", "/api/businesses/{biz_id}/keywords/custom"),
    ("DELETE", "/api/businesses/{biz_id}/keywords/custom/{keyword}"),
    ("POST", "/api/businesses/{biz_id}/keywords/exclude"),
    ("DELETE", "/api/businesses/{biz_id}/keywords/exclude/{keyword}"),
    ("DELETE", "/api/competitors/{competitor_id}"),
    ("PATCH", "/api/competitors/{competitor_id}"),
    ("POST", "/api/feedback"),
    ("POST", "/api/kakao/checklist/{biz_id}"),
    ("POST", "/api/report/action-log/{biz_id}"),
    ("POST", "/api/report/ai-tab-checklist-confirm/{biz_id}"),
    ("PATCH", "/api/guide/{guide_id}/checklist"),
    ("DELETE", "/api/guide/{biz_id}/smartplace-faq/{faq_index}"),
    ("POST", "/api/status/capacity/waitlist"),
    ("PATCH", "/api/settings/me"),
    ("POST", "/api/board"),
    ("POST", "/api/v1/keys"),
]

spec = main.app.openapi()
comps = spec.get("components", {}).get("schemas", {})


def _resolve(s):
    while isinstance(s, dict) and "$ref" in s:
        s = comps[s["$ref"].split("/")[-1]]
    return s


def _gen(s, depth=0):
    s = _resolve(s)
    if not isinstance(s, dict) or depth > 4:
        return None
    for key in ("anyOf", "oneOf"):
        if key in s:
            opts = [o for o in s[key] if _resolve(o).get("type") != "null"]
            return _gen(opts[0], depth + 1) if opts else None
    if "enum" in s:
        return s["enum"][0]
    if "const" in s:
        return s["const"]
    t = s.get("type")
    if t == "string":
        if s.get("format") == "email":
            return "dryrun@example.com"
        if s.get("format") == "date":
            return "2026-11-01"
        if s.get("format") == "date-time":
            return "2026-11-01T00:00:00Z"
        v = "dryrun test"
        return (v * 20)[: max(s.get("minLength", 1), min(len(v), s.get("maxLength", 50)))] if s.get("minLength", 0) > len(v) else v[: s.get("maxLength", 50)]
    if t == "integer":
        return int(s.get("minimum", 1))
    if t == "number":
        return float(s.get("minimum", 1))
    if t == "boolean":
        return False
    if t == "array":
        return [_gen(s.get("items", {}), depth + 1)] if s.get("minItems", 0) else []
    if t == "object" or "properties" in s:
        req = s.get("required", [])
        return {k: _gen(v, depth + 1) for k, v in s.get("properties", {}).items() if k in req}
    return None


def body_for(method, path):
    op = spec["paths"].get(path, {}).get(method.lower(), {})
    sch = op.get("requestBody", {}).get("content", {}).get("application/json", {}).get("schema")
    return _gen(sch) if sch else None


def count_tables(tables):
    out = {}
    for t in sorted(tables):
        try:
            r = c.table(t).select("id", count="exact").limit(1).execute()
            out[t] = r.count
        except Exception:
            out[t] = None
    return out


# 전후 행 수 비교 대상: 가로채기 전에 알 수 없으므로 쓰기 후보 테이블을 넉넉히
WATCH = ["businesses", "competitors", "guides", "notifications", "business_action_log", "feedback", "waitlist", "profiles", "api_keys",
         "board_posts", "in_app_messages", "scan_results", "ai_usage_log", "subscriptions", "team_members", "support_tickets"]
before = count_tables([t for t in WATCH if t in SNAP])

results = []
for method, tmpl in ALLOW:
    params = re.findall(r"\{(\w+)", tmpl)
    path = tmpl
    miss = None
    for p in params:
        v = VALS.get(p)
        if v is None:
            miss = p
            break
        path = re.sub(r"\{" + p + r"[^}]*\}", str(v), path, count=1)
    if miss:
        results.append((method, tmpl, "SKIP", f"no value for {miss}"))
        continue
    current["route"] = f"{method} {tmpl}"
    body = body_for(method, tmpl)
    out = {}

    def run():
        try:
            kw = {"json": body} if body is not None else {}
            r = client.request(method, path, **kw)
            out["status"] = r.status_code
            if r.status_code >= 500:
                out["body"] = r.text[:140]
        except Exception as e:  # noqa: BLE001
            tb = traceback.extract_tb(e.__traceback__)
            out["status"] = "EXC"
            out["exc"] = f"{type(e).__name__}: {str(e)[:110]} @ " + ",".join(f"{os.path.basename(f.filename)}:{f.lineno}" for f in tb if "aeolab/backend" in f.filename)[-90:]

    t = threading.Thread(target=run, daemon=True)
    t.start()
    t.join(40)
    results.append((method, tmpl, out.get("status", "TIMEOUT"), out.get("exc") or out.get("body") or ""))

after = count_tables([t for t in WATCH if t in SNAP])


def P(*a):
    print(*a)


P("ROUTES", len(results))
for m, t, st, info in results:
    P("RES", m, t, st, info[:150])
P("WRITES_INTERCEPTED", len(write_log))
for r, m, t, k in write_log:
    P("W", r, "->", m, t, k)
P("SCHEMA_PROBLEMS", schema_problems)
P("NON_REST_WRITES_BLOCKED", {k: sorted(v) for k, v in blocked_writes.items()})
P("BLOCKED_HOSTS", {h: sorted(r)[:3] for h, r in blocked_hosts.items()})
P("ROWCOUNT_LEAK", {t: (before[t], after[t]) for t in before if before[t] != after[t]} or "none")
sys.stdout.flush()
os._exit(0)
