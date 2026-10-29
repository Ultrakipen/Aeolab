# Supabase 문의 글 초안 (2026-10-29) — 게시 전 초안, 사용자 승인 후에만 게시

> 게시 위치: Free 플랜은 Community support만 제공된다(공식 가격 페이지). GitHub Discussions 또는 Discord 권장. Email support는 Pro부터이며,
> Free에서 직접 티켓이 가능한지는 **미확인**. 프로젝트 ref는 게시 직전에 사용자가 직접 채운다(비밀값은 쓰지 않는다).
> 아래 수치는 2026-10-29 측정값이며 근거 파일은 `docs/supabase_diagnostic_queries_2026_10_29.txt`와 같은 폴더의 그래프 이미지.

---

**Title:** Periodic ~1–1.7 s stalls hit Auth, PostgREST and a DB-free health check at the same time (Nano, Seoul) — DB metrics look idle

**Environment**
- Free plan, Compute **Nano**, region Northeast Asia (Seoul, `ap-northeast-2`), project ref: `<fill in>`
- Clients: a FastAPI backend and a Next.js app on a VPS in Korea, plus a laptop on a home connection in Korea

**What we see**
Roughly once every few minutes, every request that touches Supabase stalls for about 1–1.7 s at the same moment, mostly around seconds :44–:48 of the minute.
We observed it in 3 of 7 observed minutes in one session, so it is intermittent, not every minute.
The stall appears simultaneously on:
- `GET /auth/v1/user`
- PostgREST queries (service key and user JWT)
- our own backend `/health` endpoint that does not touch the database (probed from the same VPS)

**Where we think it is (measured)**
We probed once per second from the VPS and from a laptop at the same time for 6 minutes. All 8 stalls seen from the VPS overlapped (within 2 s) with a stall seen from the laptop.
Because two different networks stall together, we believe it is not our server or our network path.
Our own scheduler has no job shorter than a 10-minute interval, there is no `pg_cron`/`pg_net` in `pg_extension`, and server cron only runs a few backups per day.

**Database side looks idle**
- CPU: 24 h and 3 h dashboard graphs show Idle ≥ ~72–78% at worst; one IOwait spike (~60%) around 17:20 KST, not in the window where we saw the stalls.
- Disk IOPS: about 4 (max line ~3K on the chart); throughput ~52 KB/s.
- Cache hit ratio 100.00% (`blks_hit` ~222M vs `blks_read` 1,821), 17/60 connections.
- `pg_stat_statements`: our PostgREST `scan_results` query averages 5.9 ms (max 4.5 s once). The slowest statements are Supabase-internal metadata queries (e.g. `pg_timezone_names` mean ~0.9 s, max 7.4 s).
- Database size is small (~67 MB).

**Questions**
1. Is there anything at the platform level (gateway/Kong, Auth service, pooler, shared-host contention on Nano) that could cause a ~1–1.7 s pause for all services at once?
2. Does the Nano "shared CPU" have any throttling that would not show up in the CPU usage graph?
3. Would moving to Micro change this behaviour, or is it the same shared class? We want to know before paying for a change.
4. Is there a log or metric we can look at to see these pauses (we only see 1-hour/2-minute granularity in Reports)?

Thanks — happy to share the probe script output (timestamps of stalls from both machines).

---

## 보낼 때 확인할 것 (사용자)
- 프로젝트 ref 채우기, 필요하면 위 측정 문구를 줄이기.
- 영문은 초안이다. 숫자는 대화에서 측정한 값만 넣었고, 추정(원인)은 질문 형태로만 썼다.
- 게시 전 내용이 공개된다는 점을 고려(캐시·색인될 수 있음 — 삭제해도 남을 수 있다).
