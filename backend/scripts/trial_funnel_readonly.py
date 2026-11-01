"""체험→가입 퍼널 읽기 전용 분석 (T-11, 2026-11-02). DB 읽기만 한다 — 쓰기·외부 호출 없음.

서버에서: cd /var/www/aeolab/backend && set -a && . ./.env 2>/dev/null && set +a && PYTHONPATH=. python scripts/trial_funnel_readonly.py
IP 해시는 앞 6자만 출력한다.
"""
import os
import sys
from collections import Counter

from db.supabase_client import get_client as get_supabase

HEAVY = int(os.getenv("TRIAL_COUNT_MAX_RUNS_PER_IP", "3"))


def main():
    sb = get_supabase()
    rows, start = [], 0
    while True:
        r = sb.table("trial_scans").select(
            "id,ip_hash,email,claim_email,claimed_at,converted_user_id,imported_business_id,scanned_at,followup_sent_1"
        ).order("id").range(start, start + 999).execute()
        got = r.data or []
        rows += got
        if len(got) < 1000:
            break
        start += 1000

    n = len(rows)
    per_ip = Counter(x.get("ip_hash") for x in rows)
    heavy_ips = {ip for ip, c in per_ip.items() if c > HEAVY}
    organic = [x for x in rows if x.get("ip_hash") not in heavy_ips]
    print(f"체험 전체 {n}건, 고유 IP {len(per_ip)}개, 다량(>{HEAVY}회) IP {len(heavy_ips)}개가 {sum(per_ip[i] for i in heavy_ips)}건")
    print(f"다량 IP 제외 {len(organic)}건 / 고유 IP {len(set(x.get('ip_hash') for x in organic))}")
    for ip, c in per_ip.most_common(4):
        print(f"  상위 IP {str(ip)[:6]}: {c}건")

    def cnt(label, pred, base):
        print(f"{label}: 전체 {sum(1 for x in rows if pred(x))} / 다량IP 제외 {sum(1 for x in base if pred(x))}")

    cnt("이메일 입력", lambda x: bool(x.get("email")), organic)
    cnt("claim_email 있음", lambda x: bool(x.get("claim_email")), organic)
    cnt("claimed_at 있음", lambda x: bool(x.get("claimed_at")), organic)
    cnt("가입 연결(converted_user_id)", lambda x: bool(x.get("converted_user_id")), organic)
    cnt("사업장 가져오기(imported_business_id)", lambda x: bool(x.get("imported_business_id")), organic)
    cnt("팔로업1 발송", lambda x: bool(x.get("followup_sent_1")), organic)

    week = Counter(str(x.get("scanned_at"))[:10] for x in organic)
    print("최근 날짜별(다량 IP 제외):", sorted(week.items())[-10:])
    sys.stdout.flush()
    os._exit(0)


if __name__ == "__main__":
    main()
