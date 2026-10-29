# Supabase 문의 이메일 초안 (정중한 버전, 2026-10-29) — 발송 전 초안

> 사용 시점: Pro 전환 후 Email support로 보낼 때(또는 문의 가능한 채널이 생겼을 때). 괄호 `<>` 항목은 발송 직전에 사용자가 채운다. 비밀값은 쓰지 않는다.
> 수치는 2026-10-29 측정값이고 근거는 `docs/supabase_diagnostic_queries_2026_10_29.txt`와 같은 폴더의 그래프 이미지다.
> Pro 전환 후라면 "Environment"의 플랜·컴퓨트 줄을 현재 상태로 고치고, 전환 전 기준값은 그대로 두어 전후를 비교할 수 있게 한다.

---

**Subject:** Request for guidance: brief simultaneous stalls (~1–1.7 s) across Auth, REST and our health endpoint — project `<project ref>`

Dear Supabase Support Team,

I hope you are well. I am the developer of a small SaaS service in Korea, and I would be grateful for your guidance on an intermittent latency pattern we have been observing. I have tried to rule out our own side first and would like to share what we found.

**Environment**
- Project: `<project ref>` (region: Northeast Asia, Seoul)
- Plan / compute: `<Free / Nano>` as of 2026-10-29 (`<update if changed>`)
- Clients: a FastAPI backend and a Next.js app on a VPS in Korea; we also tested from a laptop on a home connection in Korea

**What we observed**
Every few minutes, requests that reach Supabase pause for roughly 1 to 1.7 seconds, mostly around seconds :44–:48 of the minute. In one session we saw it in 3 of 7 observed minutes, so it is intermittent rather than every minute. The pause appeared at the same moment on:
- `GET /auth/v1/user`
- PostgREST requests (with both the service key and a user JWT)
- our own backend `/health` endpoint, which does not touch the database

**Why we believe it is not on our side**
We probed once per second for six minutes from the VPS and from a laptop on a different network at the same time. All 8 pauses seen from the VPS coincided (within 2 seconds) with a pause seen from the laptop. Our scheduler has no job with an interval shorter than 10 minutes, `pg_cron` and `pg_net` are not installed, and our server cron runs only a few backups per day.

**What the database metrics show**
We reviewed the available metrics and nothing appears to be under pressure:
- CPU: over 24 hours, idle stays at roughly 78% or higher at its lowest, apart from one IOwait spike (about 60%) around 17:20 KST that was not within the window of the pauses we measured.
- Disk: about 4 IOPS and roughly 52 KB/s; cache hit ratio 100.00%; 17 of 60 connections in use; database size about 67 MB.
- `pg_stat_statements`: our main PostgREST query averages 5.9 ms. The slowest statements are internal metadata queries (for example `pg_timezone_names`, mean about 0.9 s).

**Our questions**
1. Could something at the platform level (for example the API gateway, the Auth service, the pooler, or resource sharing on a shared-CPU instance) cause a short pause that affects several services at once?
2. Is there any CPU throttling on shared-CPU instances that might not appear in the CPU usage graph?
3. Is there a log or metric that would let us see such pauses? The Reports we can access have one-hour or two-minute granularity.
4. If we change compute size, would you expect this behaviour to change? We would like to understand this before making any change.

I would be happy to share the timestamped probe output from both machines, or any other information that would help. Thank you very much for your time and assistance.

Kind regards,
`<Your name>`
AEOlab — https://aeolab.co.kr
`<contact email>`
