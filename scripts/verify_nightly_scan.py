"""야간 스캔(02:00)·순위 잡(04:30)·알림 결과 읽기 전용 점검 (2026-10-29).

사용(운영 서버에서): cd /var/www/aeolab/backend && source ../venv/bin/activate && python /var/www/aeolab/scripts/verify_nightly_scan.py [YYYY-MM-DD]
날짜는 점검할 '새벽'의 한국 날짜(기본: 오늘). 02:00 스캔은 그 날 01:30~06:00 사이를 본다.

DB 읽기만 한다 — 네이버 접속·쓰기·알림 발송이 없다. 로그(pm2 error.log 등)는 이 스크립트가 보지 않으니 따로 확인한다.
"""
import asyncio
import json
import os
import sys
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv

load_dotenv("/var/www/aeolab/backend/.env")
sys.path.insert(0, "/var/www/aeolab/backend")
from db.supabase_client import get_client, execute  # noqa: E402

KST = timezone(timedelta(hours=9))


def kst(ts: str) -> str:
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(KST).strftime("%m-%d %H:%M")
    except Exception:
        return str(ts)[:16]


async def main():
    day = sys.argv[1] if len(sys.argv) > 1 else datetime.now(KST).strftime("%Y-%m-%d")
    d0 = datetime.fromisoformat(day).replace(tzinfo=KST)
    w_start, w_end = d0 + timedelta(hours=1, minutes=30), d0 + timedelta(hours=6)
    s_iso, e_iso = w_start.astimezone(timezone.utc).isoformat(), w_end.astimezone(timezone.utc).isoformat()
    print(f"== 점검 창: {day} 01:30~06:00 KST ==")
    sb = get_client()

    biz = {b["id"]: b for b in (await execute(sb.table("businesses").select("id,name,user_id,is_active").eq("is_active", True))).data or []}
    subs = {s["user_id"]: (s["plan"], s["status"]) for s in (await execute(sb.table("subscriptions").select("user_id,plan,status"))).data or []}
    name = lambda bid: (biz.get(bid, {}).get("name") or bid[:8])[:12]

    print("\n[A] 야간 스캔 결과 (이번 창 스캔 vs 직전 스캔)")
    rows = (await execute(sb.table("scan_results").select("*").gte("scanned_at", s_iso).lt("scanned_at", e_iso).order("scanned_at"))).data or []
    scanned = {}
    for r in rows:
        if r.get("query_used") == "keyword_rank_only":
            continue
        scanned.setdefault(r["business_id"], r)
    for bid, r in scanned.items():
        prev = (await execute(sb.table("scan_results").select("scanned_at,unified_score,track1_score").eq("business_id", bid)
                              .lt("scanned_at", s_iso).order("scanned_at", desc=True).limit(1))).data or []
        p = prev[0] if prev else {}
        plan = subs.get(biz.get(bid, {}).get("user_id"), ("-", "-"))
        u, pu = r.get("unified_score"), p.get("unified_score")
        delta = f"{u - pu:+.1f}" if isinstance(u, (int, float)) and isinstance(pu, (int, float)) else "n/a"
        print(f"  {name(bid):<12} plan={plan[0]}/{plan[1]:<9} 스캔 {kst(r['scanned_at'])}  통합 {u} (직전 {pu} @ {kst(p.get('scanned_at',''))}, 변화 {delta})  track1 {r.get('track1_score')}")
    if not scanned:
        print("  (이번 창의 스캔 결과 없음 — 스캔이 돌지 않았거나 대상 요일이 아님. 아래 B·C로 사유 확인)")
    admins = {u.strip() for u in os.getenv("ADMIN_USER_IDS", "").split(",") if u.strip()}
    active_paid = [b for b in biz.values() if subs.get(b["user_id"], ("", ""))[1] == "active"]
    targets = [b for b in active_paid if b["user_id"] not in admins]          # daily_scan_all은 관리자 계정을 제외한다
    missing = [b["name"][:12] for b in targets if b["id"] not in scanned]
    excluded = [b["name"][:12] for b in active_paid if b["user_id"] in admins]
    print(f"  야간 스캔 대상(관리자 제외) {len(targets)}곳 중 이번 창 스캔 {len(scanned)}곳 | 스캔 없음: {missing or '없음'} | 관리자 계정이라 제외: {excluded or '없음'}")

    print("\n[B] 알림 발송 (이번 창, type별)")
    notes = (await execute(sb.table("notifications").select("user_id,type,status,sent_at").gte("sent_at", s_iso).lt("sent_at", e_iso))).data or []
    by = {}
    for n in notes:
        by.setdefault((n["type"], n["status"]), []).append(n)
    for (t, st), lst in sorted(by.items()):
        print(f"  {t:<24} {st:<8} {len(lst)}건")
    if not notes:
        print("  (알림 없음)")
    growth = [n for n in notes if "GROWTH" in str(n.get("type"))]
    owner = {b["user_id"]: b["name"] for b in biz.values()}
    print(f"  성장 단계 상승 알림(GROWTH): {len(growth)}건 대상 {[owner.get(n['user_id'], n['user_id'][:8]) for n in growth]}"
          f"  | 기대: 보정 기준일({os.getenv('GROWTH_ALERT_BASELINE_DATE')}) 이전 기록과의 비교는 억제 → 0건")

    print("\n[C] 운영 알림(system_alerts) — 이번 창부터 지금까지")
    sa = (await execute(sb.table("system_alerts").select("created_at,subject,source").gte("created_at", s_iso).order("created_at"))).data or []
    for a in sa[-15:]:
        print(f"  {kst(a['created_at'])} [{a.get('source')}] {str(a.get('subject'))[:60]}")
    if not sa:
        print("  (없음)")

    print("\n[D] 키워드 순위 최신 측정 (04:30 순위 잡 후 다시 실행해 확인)")
    for b in active_paid:
        r = (await execute(sb.table("scan_results").select("keyword_ranks").eq("business_id", b["id"]).not_.is_("keyword_ranks", "null")
                           .order("scanned_at", desc=True).limit(1))).data or []
        if not r:
            print(f"  {b['name'][:12]:<12} 순위 기록 없음"); continue
        vs = [v for k, v in r[0]["keyword_ranks"].items() if not k.startswith("_") and isinstance(v, dict)]
        stat = [("오류:" + str(v.get("error"))) if v.get("error") else ("노출" if any(isinstance(v.get(a), (int, float)) and v.get(a) > 0 for a in ("pc_rank", "mobile_rank", "place_rank")) else "미노출") for v in vs]
        last = max(((v.get("measured_at") or "")[:16] for v in vs), default="")
        print(f"  {b['name'][:12]:<12} 최근 측정 {kst(last) if last else '-'}  {stat}")

    print("\n[E] 접속 한도·사용량 이력 파일(23:58 일일 요약이 만든다)")
    for fn in (".naver_quota_state_history.jsonl", ".naver_usage_meter_history.jsonl"):
        p = os.path.join("/var/www/aeolab/backend", fn)
        if os.path.exists(p):
            lines = open(p, encoding="utf-8").read().strip().splitlines()
            print(f"  {fn}: {len(lines)}줄, 마지막 = {lines[-1][:200] if lines else '-'}")
        else:
            print(f"  {fn}: 없음")


asyncio.run(main())
