"""대시보드 동시 접속 부하테스트 (2026-10-29). 임시 계정/사업장을 만들고 반드시 삭제한다.

사용: python loadtest_dashboard.py <label> [levels...]
- 대상은 서버 내부 포트(127.0.0.1:3000)라 Cloudflare·nginx를 거치지 않는다(운영 도메인 보호 규칙을 건드리지 않음).
- 계정 비밀번호는 매번 무작위로 만들고 출력하지 않는다.

사용(운영 서버에서): cd /var/www/aeolab/backend && source ../venv/bin/activate && python /var/www/aeolab/scripts/dashboard_loadtest.py <라벨> 5 10 20
임시 계정·사업장을 만들고 끝나면 삭제·검증한다(실패하면 user_id를 출력하니 수동 삭제). 같은 인원에서도 2~13초로 흔들려 단일 비교는 신뢰하지 말 것(2026-10-29 측정).
"""
import asyncio, base64, json, os, re, secrets, statistics, subprocess, sys, time, uuid
import aiohttp
from dotenv import dotenv_values

LABEL = sys.argv[1] if len(sys.argv) > 1 else "run"
LEVELS = [int(x) for x in sys.argv[2:]] or [5, 10, 20, 30, 40, 50]

be = dotenv_values("/var/www/aeolab/backend/.env")
fe = dotenv_values("/var/www/aeolab/frontend/.env.local")
SB = be["SUPABASE_URL"].rstrip("/")
SERVICE = be["SUPABASE_SERVICE_ROLE_KEY"]
ANON = fe["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
REF = re.match(r"https://([^.]+)\.", SB).group(1)
TARGET = "http://127.0.0.1:3000/dashboard"
EMAIL = f"qa-loadtest-{time.strftime('%Y%m%d%H%M%S')}@aeolab.internal"
PASSWORD = secrets.token_urlsafe(24)
BIZ_NAME = "부하테스트카페"
LOG = "/var/log/pm2/frontend-out.log"


def b64url(s: str) -> str:
    return base64.urlsafe_b64encode(s.encode()).decode().rstrip("=")


def slow_lines() -> list:
    try:
        return [l for l in open(LOG, encoding="utf-8", errors="ignore") if "[dash-slow]" in l]
    except Exception:
        return []


async def main():
    sh = {"apikey": SERVICE, "Authorization": f"Bearer {SERVICE}", "Content-Type": "application/json"}
    user_id = biz_id = None
    results = {}
    async with aiohttp.ClientSession() as http:
        try:
            async with http.post(f"{SB}/auth/v1/admin/users", headers=sh,
                                 json={"email": EMAIL, "password": PASSWORD, "email_confirm": True}) as r:
                u = await r.json(); assert r.status in (200, 201), f"user create {r.status}"
                user_id = u["id"]
            async with http.post(f"{SB}/rest/v1/businesses", headers={**sh, "Prefer": "return=representation"},
                                 json={"user_id": user_id, "name": BIZ_NAME, "category": "cafe", "region": "서울 강남구", "is_active": True}) as r:
                b = await r.json(); assert r.status in (200, 201), f"biz create {r.status} {str(b)[:120]}"
                biz_id = b[0]["id"]
            async with http.post(f"{SB}/auth/v1/token?grant_type=password", headers={"apikey": ANON, "Content-Type": "application/json"},
                                 json={"email": EMAIL, "password": PASSWORD}) as r:
                sess = await r.json(); assert r.status == 200, f"login {r.status}"
            raw = "base64-" + b64url(json.dumps(sess, separators=(",", ":")))
            name = f"sb-{REF}-auth-token"
            cookies = {name: raw} if len(raw) <= 3180 else {f"{name}.{i}": raw[i * 3180:(i + 1) * 3180] for i in range((len(raw) + 3179) // 3180)}
            cookie_hdr = "; ".join(f"{k}={v}" for k, v in cookies.items())
            hdr = {"Cookie": cookie_hdr, "Host": "aeolab.co.kr", "User-Agent": "aeolab-loadtest/1.0"}

            # 인증된 렌더링인지 확인
            async with http.get(TARGET, headers=hdr, allow_redirects=False, timeout=aiohttp.ClientTimeout(total=60)) as r:
                body = await r.text()
                ok = r.status == 200 and BIZ_NAME in body
                print(f"[{LABEL}] 인증 렌더링 확인: status={r.status} 사업장명 포함={BIZ_NAME in body}", flush=True)
                if not ok:
                    raise SystemExit("authenticated render check failed")

            before = len(slow_lines())

            async def one(i):
                t = time.monotonic()
                try:
                    async with http.get(TARGET, headers=hdr, allow_redirects=False, timeout=aiohttp.ClientTimeout(total=120)) as r:
                        await r.read()
                        return r.status, time.monotonic() - t
                except Exception as e:
                    return type(e).__name__, time.monotonic() - t

            for n in LEVELS:
                res = await asyncio.gather(*[one(i) for i in range(n)])
                ts = sorted(t for s, t in res if s == 200)
                ok_n = len(ts)
                def pct(p): return ts[min(len(ts) - 1, int(len(ts) * p))] if ts else float("nan")
                top = subprocess.run("ps -eo pcpu,comm --sort=-pcpu | head -3 | tr '\\n' ';'", shell=True, capture_output=True, text=True).stdout
                results[n] = dict(ok=ok_n, n=n, p50=pct(0.5), p95=pct(0.95), max=max((t for _, t in res), default=0))
                print(f"[{LABEL}] 동시 {n:>3}명  성공 {ok_n}/{n}  p50 {pct(0.5):6.2f}s  p95 {pct(0.95):6.2f}s  최대 {results[n]['max']:6.2f}s  | cpu {top.strip()}", flush=True)
                if ok_n == 0 or (ts and pct(0.5) > 40):
                    print(f"[{LABEL}] 응답이 무너져 여기서 멈춥니다", flush=True)
                    break
                await asyncio.sleep(8)

            new = slow_lines()[before:]
            stages = {}
            for l in new:
                try:
                    d = json.loads(l.split("[dash-slow]", 1)[1].strip())
                except Exception:
                    continue
                for k, v in d.items():
                    stages.setdefault(k, []).append(v)
            if stages:
                print(f"[{LABEL}] [dash-slow] {len(new)}건 단계별 평균(ms): " +
                      ", ".join(f"{k}={statistics.mean(v):.0f}" for k, v in sorted(stages.items())), flush=True)
        finally:
            # 정리 — 실패해도 반드시 시도하고 결과를 검증한다
            try:
                if user_id:
                    for tbl, col in (("profiles", "user_id"), ("businesses", "user_id")):
                        async with http.delete(f"{SB}/rest/v1/{tbl}?{col}=eq.{user_id}", headers=sh) as r:
                            pass
                    async with http.delete(f"{SB}/auth/v1/admin/users/{user_id}", headers=sh) as r:
                        print(f"[{LABEL}] 정리: 계정 삭제 status={r.status}", flush=True)
                    left = []
                    for tbl in ("businesses", "profiles"):
                        async with http.get(f"{SB}/rest/v1/{tbl}?user_id=eq.{user_id}&select=*", headers=sh) as r:
                            left.append((tbl, len(await r.json())))
                    async with http.get(f"{SB}/auth/v1/admin/users/{user_id}", headers=sh) as r:
                        left.append(("auth_user_status", r.status))
                    print(f"[{LABEL}] 정리 검증(남은 행): {left}", flush=True)
            except Exception as e:
                print(f"[{LABEL}] !!! 정리 중 오류: {type(e).__name__}: {e} — 수동 확인 필요 user_id={user_id}", flush=True)


asyncio.run(main())
