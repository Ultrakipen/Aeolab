"""계층별 동시성 측정 (2026-10-29): Supabase Auth / 백엔드(인증 없음) / 백엔드(인증+플랜+소유권+데이터)를 따로 잰다.
임시 계정은 반드시 삭제한다. 대상은 서버 내부 포트라 Cloudflare를 거치지 않는다.

사용(운영 서버에서): cd /var/www/aeolab/backend && source ../venv/bin/activate && python /var/www/aeolab/scripts/supabase_layer_probe.py <라벨> 10 20 40
Supabase 업그레이드 전후처럼 같은 조건으로 두 번 돌려 비교한다. 서버 .env의 키를 읽을 뿐 출력하지 않는다. 운영 도메인이 아니라 내부 포트(127.0.0.1)를 친다.
"""
import asyncio, json, os, re, secrets, statistics, sys, time
import aiohttp
from dotenv import dotenv_values

LABEL = sys.argv[1] if len(sys.argv) > 1 else "probe"
LEVELS = [int(x) for x in sys.argv[2:]] or [10, 20, 40]
be = dotenv_values("/var/www/aeolab/backend/.env"); fe = dotenv_values("/var/www/aeolab/frontend/.env.local")
SB = be["SUPABASE_URL"].rstrip("/"); SERVICE = be["SUPABASE_SERVICE_ROLE_KEY"]; ANON = fe["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
EMAIL = f"qa-probe-{time.strftime('%Y%m%d%H%M%S')}@aeolab.internal"; PASSWORD = secrets.token_urlsafe(24)
API = "http://127.0.0.1:8000"


async def timed(http, url, headers):
    t = time.monotonic()
    try:
        async with http.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=120)) as r:
            await r.read(); return r.status, time.monotonic() - t
    except Exception as e:
        return type(e).__name__, time.monotonic() - t


async def level(http, name, url, headers, n):
    res = await asyncio.gather(*[timed(http, url, headers) for _ in range(n)])
    ok = sorted(t for s, t in res if s == 200); bad = sorted({str(s) for s, _ in res if s != 200})
    p = lambda q: ok[min(len(ok) - 1, int(len(ok) * q))] if ok else float("nan")
    print(f"[{LABEL}] {name:<28} 동시 {n:>3}  성공 {len(ok):>3}/{n:<3} p50 {p(.5)*1000:7.0f}ms  p95 {p(.95)*1000:7.0f}ms  최대 {max(t for _, t in res)*1000:7.0f}ms  비성공 {bad[:3]}", flush=True)


async def main():
    sh = {"apikey": SERVICE, "Authorization": f"Bearer {SERVICE}", "Content-Type": "application/json"}
    user_id = None
    conn = aiohttp.TCPConnector(limit=0)
    async with aiohttp.ClientSession(connector=conn) as http:
        try:
            async with http.post(f"{SB}/auth/v1/admin/users", headers=sh, json={"email": EMAIL, "password": PASSWORD, "email_confirm": True}) as r:
                user_id = (await r.json())["id"]
            async with http.post(f"{SB}/rest/v1/businesses", headers={**sh, "Prefer": "return=representation"},
                                 json={"user_id": user_id, "name": "프로브카페", "category": "cafe", "region": "서울 강남구", "is_active": True}) as r:
                biz_id = (await r.json())[0]["id"]
            async with http.post(f"{SB}/auth/v1/token?grant_type=password", headers={"apikey": ANON, "Content-Type": "application/json"},
                                 json={"email": EMAIL, "password": PASSWORD}) as r:
                token = (await r.json())["access_token"]
            auth = {"apikey": ANON, "Authorization": f"Bearer {token}"}
            bearer = {"Authorization": f"Bearer {token}"}
            for n in LEVELS:
                await level(http, "A Supabase Auth /user", f"{SB}/auth/v1/user", auth, n)
                await asyncio.sleep(3)
                await level(http, "B 백엔드 /health(DB 없음)", f"{API}/health", {}, n)
                await asyncio.sleep(3)
                await level(http, "C 백엔드 benchmark(무인증)", f"{API}/api/report/benchmark/cafe/%EC%84%9C%EC%9A%B8%20%EA%B0%95%EB%82%A8%EA%B5%AC", {}, n)
                await asyncio.sleep(3)
                await level(http, "D 백엔드 action-log(인증)", f"{API}/api/report/action-log/{biz_id}", bearer, n)
                await asyncio.sleep(3)
                await level(http, "E 백엔드 gap(인증)", f"{API}/api/report/gap/{biz_id}", bearer, n)
                await asyncio.sleep(5)
        finally:
            try:
                if user_id:
                    for tbl in ("profiles", "businesses"):
                        async with http.delete(f"{SB}/rest/v1/{tbl}?user_id=eq.{user_id}", headers=sh): pass
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
                print(f"[{LABEL}] !!! 정리 오류 {type(e).__name__}: {e} user_id={user_id}", flush=True)


asyncio.run(main())
