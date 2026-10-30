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
    # 야간 스캔과 같은 자격 기준(active·유예·해지했어도 만료 전) — status가 active인 사용자만 보면 유예·해지 후 만료 전 사용자가 '대상 아님'으로 보인다(2026-10-31)
    from services.scan_scheduling import entitled_user_ids
    sub_rows = (await execute(sb.table("subscriptions").select("user_id,status,end_at"))).data or []
    entitled = entitled_user_ids(sub_rows)
    active_paid = [b for b in biz.values() if b["user_id"] in entitled]
    targets = [b for b in active_paid if b["user_id"] not in admins]          # daily_scan_all은 관리자 계정을 제외한다
    missing = [b["name"][:12] for b in targets if b["id"] not in scanned]
    excluded = [b["name"][:12] for b in active_paid if b["user_id"] in admins]
    print(f"  야간 스캔 대상(관리자 제외) {len(targets)}곳 중 이번 창 스캔 {len(scanned)}곳 | 스캔 없음: {missing or '없음'} | 관리자 계정이라 제외: {excluded or '없음'}")

    print("\n[A2] AI 측정 상세 — Gemini·ChatGPT 표본 수와 측정 방식(비유도 recommend_v1인지), 실패·미완 표본")
    for bid, r in scanned.items():
        g, c = r.get("gemini_result") or {}, r.get("chatgpt_result") or {}
        fmt = lambda x: (f"probe={x.get('probe')} 표본={x.get('sample_size')}/{x.get('requested_size')} 실패={x.get('failed_count')} "
                         f"노출={x.get('exposure_freq')} 오류={x.get('error')}") if x else "(없음)"
        print(f"  {name(bid):<12} Gemini {fmt(g)}")
        print(f"  {'':<12} ChatGPT {fmt(c)}")
        gn = g.get("sample_size") if g else None
        if isinstance(gn, (int, float)) and gn < 30:
            print(f"  {'':<12} ⚠ Gemini 표본이 {gn}개로 적다 — 무료 등급 한도(일 500회·분당 약 15회) 소진 가능. 점수에는 실패 표본이 제외되고, 10개 미만+실패 10건 이상이면 항목 자체가 제외된다")

    print("\n[A3] 질의 노출(query_exposure) — 유도형 추가 호출을 중단했으므로 'recommend' 키만 있어야 한다 (scan_analytics 최신 full 행)")
    try:
        qa = (await execute(sb.table("scan_analytics").select("scanned_at,query_exposure").eq("scan_type", "full").order("scanned_at", desc=True).limit(3))).data or []
        for a in qa:
            print(f"  {kst(a.get('scanned_at',''))}  키={sorted((a.get('query_exposure') or {}).keys())}")
        if not qa:
            print("  (full 행 없음)")
    except Exception as e:
        print(f"  조회 실패(테이블·컬럼 확인): {e}")

    print("\n[A4] 서버 로그 표지 — 이번 창 이후 경쟁사 급등 감지 실패·Traceback (pm2 out/err 로그의 마지막 부분)")
    # pm2 로그 경로는 `pm2 jlist`의 pm_out_log_path 기준 /var/log/pm2/ 이다(예전 ~/.pm2/logs 는 옛 기록 — 이 경로를 봐서 매일 나던 실패를 놓친 적이 있다).
    # 로그는 자정마다 `backend-out__<날짜>_00-00-00.log`로 회전하므로 최근 회전 파일 2개와 현재 파일을 함께 본다.
    import glob
    log_files = sorted(glob.glob("/var/log/pm2/backend-out__*.log"))[-2:] + ["/var/log/pm2/backend-out.log"]
    log_files += sorted(glob.glob("/var/log/pm2/backend-error__*.log"))[-1:] + ["/var/log/pm2/backend-error.log"]

    def _since_window(line):
        # 로그의 timestamp는 UTC(naive ISO). 점검 창 시작 이후의 줄만 센다(옛 기록이 섞이지 않게)
        i = line.find('"timestamp": "')
        return i >= 0 and line[i + 14:i + 33] >= s_iso[:19]

    for fn in log_files:
        if not os.path.exists(fn):
            print(f"  {fn}: 없음"); continue
        with open(fn, "rb") as fh:
            fh.seek(0, 2); size = fh.tell(); fh.seek(max(0, size - 6_000_000)); tail = fh.read().decode("utf-8", "ignore")
        recent_lines = [l for l in tail.splitlines() if _since_window(l)]
        spike = [l for l in recent_lines if "competitor_spike] 실패" in l]
        tb = [l for l in tail.splitlines() if "Traceback" in l]      # Traceback 줄에는 timestamp가 없어 파일 끝 6MB 전체 기준
        print(f"  {os.path.basename(fn)}: 창 이후 competitor_spike 실패 {len(spike)}건 | Traceback {len(tb)}건")
        for l in spike[-1:]:
            print("    ", l[:200])

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
