"""야간 스캔 점검 — ChatGPT 모델 교체(gpt-6-luna, 2026-11-01) 이후 첫 정기 스캔 확인용 (읽기 전용, DB 쓰기·외부 호출 없음).

사용(서버): cd backend && set -a && . ./.env && set +a && PYTHONPATH=. python scripts/check_nightly_after_model_switch.py [UTC-시작시각 ISO, 기본 최근 6시간]
출력: 사업장별 최신 스캔의 ChatGPT 모델·표본·노출률·유효 관측 수, 직전 스캔과의 변화, Gemini 표본, 네이버 오류,
      사용량 기록(실패 비율), 스캔 직후 발송된 알림. 사업장 이름은 앞 8자만 출력한다.
"""
import collections
import datetime
import os
import sys

from db.supabase_client import get_client


def main(since_iso: str | None):
    c = get_client()
    now = datetime.datetime.now(datetime.timezone.utc)
    since = since_iso or (now - datetime.timedelta(hours=6)).isoformat()
    print("기준 시각(UTC) 이후:", since[:19])

    scans = c.table("scan_results").select("business_id,scanned_at,chatgpt_result,gemini_result,naver_result,total_score,track1_score,track2_score").gte("scanned_at", since).order("scanned_at", desc=True).limit(200).execute().data or []
    latest = {}
    for s in scans:
        latest.setdefault(s["business_id"], s)
    print("기준 이후 스캔한 사업장:", len(latest), "곳 / 스캔 행", len(scans))
    if not latest:
        print("→ 아직 정기 스캔 기록이 없다(스캔 시각 02:00 KST = 17:00 UTC 이전이거나 실패).")
    names = {b["id"]: b["name"] for b in (c.table("businesses").select("id,name").in_("id", list(latest)).execute().data or [])} if latest else {}
    for bid, s in latest.items():
        g, ch, nv = s.get("gemini_result") or {}, s.get("chatgpt_result") or {}, s.get("naver_result") or {}
        prev = (c.table("scan_results").select("scanned_at,chatgpt_result,total_score").eq("business_id", bid).lt("scanned_at", since).order("scanned_at", desc=True).limit(1).execute().data or [None])[0]
        pc = (prev or {}).get("chatgpt_result") or {}
        nflag = "오류:" + str(nv.get("error"))[:20] if nv.get("error") else ("차단/캡차" if nv.get("captcha_detected") else "정상")
        print(f"- {names.get(bid, '?')[:8]} {str(s['scanned_at'])[:16]}")
        print(f"    ChatGPT 모델={ch.get('model')} 표본 {ch.get('sample_size')}/{ch.get('requested_size')} 유효관측={ch.get('effective_n')} 노출률={ch.get('exposure_rate')}"
              f"  | 직전 모델={pc.get('model') or ('gpt-4.1-mini' if pc.get('probe') == 'recommend_v1' else None)} 노출률={pc.get('exposure_rate')} 표본={pc.get('sample_size')}")
        print(f"    Gemini 표본 {g.get('sample_size')}/{g.get('requested_size')} | 네이버 {nflag} | 총점 {s.get('total_score')} (직전 {(prev or {}).get('total_score')})")

    rows = c.table("ai_usage_log").select("provider,model,purpose,tokens_out").gte("created_at", since).limit(1000).execute().data or []
    agg = collections.defaultdict(lambda: [0, 0])
    for r in rows:
        key = (r["provider"], r["model"])
        agg[key][0] += 1
        if ":FAILED:" in (r["purpose"] or ""):
            agg[key][1] += 1
    print("\nAI 호출(기준 이후, 1000행 상한 표본) 모델별 [호출, 실패]:", {f"{k[0]}/{k[1]}": v for k, v in agg.items()})

    notes = c.table("notifications").select("type,status,sent_at").gte("sent_at", since).order("sent_at", desc=True).limit(60).execute().data or []
    print("기준 이후 알림:", dict(collections.Counter((n["type"], n["status"]) for n in notes)))
    sys.stdout.flush()


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
    os._exit(0)
