"""야간 처리 시간 보고 (2026-10-29) — 읽기 전용. 네이버에 접속하지 않고 DB의 스캔 저장 시각만 읽는다.

사용(서버): /var/www/aeolab/venv/bin/python scripts/nightly_duration_report.py [--days 21]

날짜별로 그날 저장된 스캔 수, 첫·마지막 저장 시각, 그 사이 시간(분)을 보여 준다. 사업장 수가 늘 때
야간 배치(02:00 시작)가 아침 사용 시간대까지 이어지는지 보는 용도다.

한계: 스캔 *저장* 시각만 보므로 실제 시작 시각은 모른다(첫 스캔 저장 = 시작 + 첫 스캔 소요). 사용자가 낮에
직접 돌린 스캔도 같은 표에 들어가므로 02:00~08:00(한국) 저장분만 야간으로 센다. 로그에 시작·종료 줄이
생기면 그쪽이 더 정확하다.
"""
from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))

KST = timezone(timedelta(hours=9))
NIGHT_START_HOUR, NIGHT_END_HOUR = 2, 8     # 한국 시간 02:00~08:00 저장분


def summarize(rows: list[dict]) -> list[dict]:
    """scanned_at 목록 → 날짜별 {date, count, first, last, span_min}. 야간(02~08시 KST) 저장분만."""
    by_day: dict = defaultdict(list)
    for r in rows:
        raw = r.get("scanned_at")
        if not raw:
            continue
        t = datetime.fromisoformat(str(raw).replace("Z", "+00:00")).astimezone(KST)
        if NIGHT_START_HOUR <= t.hour < NIGHT_END_HOUR:
            by_day[t.date()].append(t)
    out = []
    for d in sorted(by_day):
        ts = sorted(by_day[d])
        out.append({"date": d, "count": len(ts), "first": ts[0], "last": ts[-1],
                    "span_min": round((ts[-1] - ts[0]).total_seconds() / 60, 1)})
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=21)
    a = ap.parse_args()
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend", ".env"))
    from db.supabase_client import get_client

    since = (datetime.now(timezone.utc) - timedelta(days=a.days)).isoformat()
    res = get_client().table("scan_results").select("scanned_at").gte("scanned_at", since).order("scanned_at").limit(5000).execute()
    rows = (res.data if res and res.data else [])
    days = summarize(rows)
    print(f"최근 {a.days}일 야간(02~08시) 저장 스캔 — 조회 {len(rows)}건(상한 5000)")
    if not days:
        print("야간에 저장된 스캔이 없습니다.")
        return
    print(f"{'날짜':<12}{'스캔 수':>7}  {'첫 저장':<6} {'마지막':<6} {'걸린 시간(분)':>12}")
    for d in days:
        print(f"{d['date']!s:<12}{d['count']:>7}  {d['first']:%H:%M}  {d['last']:%H:%M}  {d['span_min']:>12}")
    worst = max(days, key=lambda x: x["span_min"])
    print(f"\n가장 긴 날: {worst['date']} {worst['span_min']}분 (마지막 저장 {worst['last']:%H:%M}). "
          f"스캔 수가 적은 날은 시간이 짧아 비교에 쓰지 말 것.")


if __name__ == "__main__":
    main()
