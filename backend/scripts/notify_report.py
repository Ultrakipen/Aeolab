"""알림 발송 현황 요약 — 읽기 전용 (2026-11-02).

최근 N일(기본 7)의 notifications를 읽어 상태별·종류별 발송/실패/건너뜀, 건너뜀 사유별 건수, 주간 상한 원장(periodic_sent) 종류별 건수와 고유 번호 수,
발송 간격 기록(cadence_*) 종류별 건수를 보여 준다. 번호·사업장명·본문은 읽거나 출력하지 않는다(content에서는 reason·ttype·phone_hash 존재 여부만 쓴다).
사용(서버): cd /var/www/aeolab/backend && /var/www/aeolab/venv/bin/python scripts/notify_report.py [일수]
"""
import asyncio
import os
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def summarize(rows: list[dict]) -> dict:
    """행 목록을 집계한다. 주간 상한 원장·간격 기록은 사용자에게 간 알림이 아니라 내부 기록이라 발송 집계에서 뺀다."""
    by_status: Counter = Counter()
    by_type_status: Counter = Counter()
    skip_reason: Counter = Counter()
    ledger: Counter = Counter()
    cadence: Counter = Counter()
    hashes: set = set()
    for r in rows:
        t = r.get("type") or ""
        st = r.get("status") or ""
        c = r.get("content") if isinstance(r.get("content"), dict) else {}
        if t == "periodic_sent":
            ledger[c.get("ttype") or "?"] += 1
            if c.get("phone_hash"):
                hashes.add(c["phone_hash"])
            continue
        if t.startswith("cadence_"):
            cadence[t[len("cadence_"):]] += 1
            continue
        by_status[st] += 1
        by_type_status[(t, st)] += 1
        if st == "skipped":
            skip_reason[(t, c.get("reason") or "(사유 없음)")] += 1
    return {
        "by_status": dict(by_status), "by_type_status": dict(by_type_status), "skip_reason": dict(skip_reason),
        "ledger_by_ttype": dict(ledger), "ledger_numbers": len(hashes), "cadence_by_kind": dict(cadence),
    }


def render(s: dict, days: int) -> str:
    lines = [f"알림 발송 현황 — 최근 {days}일 (읽기 전용)", ""]
    st = s["by_status"]
    lines.append("상태별: " + ", ".join(f"{k} {v}" for k, v in sorted(st.items(), key=lambda kv: -kv[1])) if st else "상태별: 기록 없음")
    lines += ["", "종류·상태별:"]
    for (t, stt), n in sorted(s["by_type_status"].items(), key=lambda kv: (-kv[1], kv[0])):
        lines.append(f"  {n:4d}  {t} [{stt}]")
    lines += ["", "건너뜀 사유별:"]
    if s["skip_reason"]:
        for (t, why), n in sorted(s["skip_reason"].items(), key=lambda kv: (-kv[1], kv[0])):
            lines.append(f"  {n:4d}  {t} — {why}")
    else:
        lines.append("  없음")
    lines += ["", f"주간 상한 원장(periodic_sent): 고유 번호 {s['ledger_numbers']}개"]
    for t, n in sorted(s["ledger_by_ttype"].items(), key=lambda kv: -kv[1]):
        lines.append(f"  {n:4d}  {t}")
    lines += ["", "발송 간격 기록(cadence_*):"]
    if s["cadence_by_kind"]:
        for k, n in sorted(s["cadence_by_kind"].items(), key=lambda kv: -kv[1]):
            lines.append(f"  {n:4d}  {k}")
    else:
        lines.append("  없음")
    return "\n".join(lines)


async def _fetch(days: int) -> list[dict]:
    from db.supabase_client import get_client, execute
    sb = get_client()
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    rows: list[dict] = []
    page = 0
    while True:
        res = await execute(
            sb.table("notifications").select("type, status, content, created_at")
            .gte("created_at", since).order("created_at").range(page * 1000, page * 1000 + 999)
        )
        part = res.data or []
        rows += part
        if len(part) < 1000:
            return rows
        page += 1


def main() -> None:
    days = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 7
    env = "/var/www/aeolab/backend/.env"
    if os.path.exists(env):
        from dotenv import load_dotenv
        load_dotenv(env)
    print(render(summarize(asyncio.run(_fetch(days))), days))


if __name__ == "__main__":
    main()
