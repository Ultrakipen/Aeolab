"""Read-only smoke test of GET /api routes on the server (2026-11-01).

Usage (server): cd backend && set -a && . ./.env && set +a && PYTHONPATH=. python scripts/route_smoke_readonly.py [business-name]
Default business: the one owned by the account used on 2026-11-01. Run it after changing routes; 5xx/EXC lines are real bugs.
Never add routes that call AI / Playwright / Naver here: those are blocked on purpose (see guard below).

Safety: all outbound network except the DB host is blocked (name resolution fails and the attempt is recorded),
Playwright and Gemini calls are patched to raise, the scheduler is not started (TestClient without `with`).
Goal: find routes that crash with our own bugs (ImportError, NameError, TypeError, header encoding ...).
"""
import os
import re
import socket
import sys
import threading
import traceback

os.environ["SENTRY_DSN"] = ""
os.environ["NEXT_PUBLIC_SENTRY_DSN"] = ""
import logging  # noqa: E402
logging.disable(logging.INFO)

# ---- network guard -------------------------------------------------------
ALLOWED = ("supabase.co", "localhost", "127.0.0.1", "::1")
blocked = {}          # host -> set(routes)
current = {"path": ""}
_real_getaddrinfo = socket.getaddrinfo


def guarded_getaddrinfo(host, *a, **k):
    h = str(host or "")
    if any(x in h for x in ALLOWED) or h == "":
        return _real_getaddrinfo(host, *a, **k)
    blocked.setdefault(h, set()).add(current["path"])
    raise socket.gaierror(-2, "blocked by smoke test")


socket.getaddrinfo = guarded_getaddrinfo

# playwright must never launch a browser
import playwright.async_api as _pa  # noqa: E402


def _no_playwright(*a, **k):
    blocked.setdefault("playwright", set()).add(current["path"])
    raise RuntimeError("playwright blocked by smoke test")


_pa.async_playwright = _no_playwright
try:
    import playwright.sync_api as _ps
    _ps.sync_playwright = _no_playwright
except Exception:
    pass

# gemini (grpc) must never call out
try:
    import google.generativeai as _g

    def _no_gemini(self, *a, **k):
        blocked.setdefault("gemini", set()).add(current["path"])
        raise ConnectionError("gemini blocked by smoke test")

    _g.GenerativeModel.generate_content = _no_gemini
    _g.GenerativeModel.generate_content_async = _no_gemini
except Exception:
    pass

# ---- app -------------------------------------------------------------------
from db.supabase_client import get_client  # noqa: E402
import main  # noqa: E402
from middleware.plan_gate import get_current_user  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

c = get_client()
DEFAULT_BIZ_ID = "fccf289b-169d-4543-b827-68fb7d2604ba"
if len(sys.argv) > 1:
    biz = c.table("businesses").select("id,user_id,category,region,name").eq("name", sys.argv[1]).execute().data[0]
else:
    biz = c.table("businesses").select("id,user_id,category,region,name").eq("id", DEFAULT_BIZ_ID).execute().data[0]
user = c.auth.admin.get_user_by_id(biz["user_id"]).user
main.app.dependency_overrides[get_current_user] = lambda: {"id": biz["user_id"], "email": user.email}
# admin routes are guarded by an X-Admin-Key shared secret (utils.admin_auth.verify_admin). We replace the dependency instead of reading the secret.
from utils.admin_auth import verify_admin  # noqa: E402
main.app.dependency_overrides[verify_admin] = lambda: None
client = TestClient(main.app)

comp = c.table("competitors").select("id").eq("business_id", biz["id"]).limit(1).execute().data
scan = c.table("scan_results").select("id").eq("business_id", biz["id"]).order("scanned_at", desc=True).limit(1).execute().data
notice = c.table("notices").select("id").limit(1).execute().data if True else []
vals = {
    "biz_id": biz["id"], "business_id": biz["id"], "category": biz["category"],
    "region": (biz["region"] or "").split()[0] if biz["region"] else "x",
    "competitor_id": comp[0]["id"] if comp else None,
    "scan_id": scan[0]["id"] if scan else None,
    "notice_id": notice[0]["id"] if notice else None,
}

# never touch: scanning / naver place access / streaming
SKIP = ("/api/scan/stream", "/api/businesses/resolve-place", "/api/share/image", "/api/report/ai-search-screenshots",
        "/api/report/blog-screenshots", "/api/admin/email-preview")

results = []
routes = []
for r in main.app.routes:
    if "GET" in (getattr(r, "methods", None) or set()) and getattr(r, "path", "").startswith("/api"):
        routes.append(r.path)
routes = sorted(set(routes))


def call(path):
    out = {}

    def run():
        try:
            resp = client.get(path)
            out["status"] = resp.status_code
            out["ctype"] = resp.headers.get("content-type", "")[:30]
            if resp.status_code >= 500:
                out["body"] = resp.text[:160]
        except Exception as e:  # server exception propagated by TestClient
            tb = traceback.extract_tb(e.__traceback__)
            frames = [f"{os.path.basename(f.filename)}:{f.lineno}" for f in tb if "/var/www/aeolab/backend" in f.filename][-2:]
            out["status"] = "EXC"
            out["exc"] = f"{type(e).__name__}: {str(e)[:140]}"
            out["frames"] = frames

    t = threading.Thread(target=run, daemon=True)
    t.start()
    t.join(40)
    if t.is_alive():
        return {"status": "TIMEOUT"}
    return out


skipped = []
for tmpl in routes:
    if any(tmpl.startswith(s) for s in SKIP):
        skipped.append((tmpl, "excluded"))
        continue
    params = re.findall(r"\{(\w+)", tmpl)
    path = tmpl
    missing = None
    for p in params:
        v = vals.get(p)
        if v is None:
            missing = p
            break
        path = re.sub(r"\{" + p + r"[^}]*\}", str(v), path, count=1)
    if missing:
        skipped.append((tmpl, f"no value for {missing}"))
        continue
    current["path"] = tmpl
    res = call(path)
    res["route"] = tmpl
    results.append(res)

# ---- report -----------------------------------------------------------------
from collections import Counter
cnt = Counter(str(r["status"]) if isinstance(r["status"], str) else ("2xx" if r["status"] < 300 else "3xx" if r["status"] < 400 else str(r["status"])) for r in results)
print("TOTAL called", len(results), "skipped", len(skipped))
print("STATUS", dict(cnt))
print("---- 5xx / exceptions / timeouts")
for r in results:
    st = r["status"]
    if st in ("EXC", "TIMEOUT") or (isinstance(st, int) and st >= 500):
        print(r["route"], st, r.get("exc", r.get("body", "")), r.get("frames", ""))
print("---- 403/404 routes (not reached beyond the gate)")
print(sorted(r["route"] + " " + str(r["status"]) for r in results if r["status"] in (403, 404)))
print("---- external hosts attempted (blocked)")
for h, rs in sorted(blocked.items()):
    print(h, "<-", sorted(rs)[:4], "..." if len(rs) > 4 else "")
print("---- skipped")
print([f"{p} ({why})" for p, why in skipped][:30])
sys.stdout.flush()
os._exit(0)
