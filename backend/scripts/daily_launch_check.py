"""소프트 런치 기간 하루 1회 읽기 전용 점검 (2026-11-10).

사용(서버): cd /var/www/aeolab/backend && PYTHONPATH=. /var/www/aeolab/venv/bin/python scripts/daily_launch_check.py

DB 읽기만 한다 — 네이버 접속·쓰기·알림 발송 없음. 개인 식별 정보(이메일·번호·해시)는 출력하지 않고 건수만 낸다.
조회가 실패한 항목은 '정상'이 아니라 '확인 못 함'으로 표시한다(error ≠ 0건). pm2 로그는 따로 본다.
"""
import asyncio
import os
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone

_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _BACKEND)

KST = timezone(timedelta(hours=9))
NID_SES_REPLACE_BY = datetime(2026, 11, 24, tzinfo=KST)     # 2026-11-10 서버 확인: 10-25 발급 + 30일 주기
NID_SES_WARN_FROM = datetime(2026, 11, 17, tzinfo=KST)


def cookie_reminder(now: datetime) -> str:
    left = (NID_SES_REPLACE_BY - now).days
    if now >= NID_SES_REPLACE_BY:
        return f"NID_SES 교체 시한(11-24) 지남 — 사용자가 즉시 교체 (직접 확인 필요)"
    if now >= NID_SES_WARN_FROM:
        return f"NID_SES 교체 임박: {left}일 남음 (사용자 작업)"
    return f"NID_SES 교체까지 {left}일(11-24 전후, 사용자 작업 — 11-17부터 경고)"


MILESTONES = (20, 50, 100)   # scheduler/jobs.py _check_data_wiring_readiness_job 의 구독자 수 트리거와 같은 값


def subscriber_breakdown(rows, admin_ids, paid_user_ids):
    """활성 구독 행을 (전체, 관리자·내부 제외, 실제 결제 기록 있음)으로 나눈다.

    스케줄러 트리거는 status='active' 행을 전부 세므로(관리자·시험 계정 포함) 외부 구독자 수보다 크게 나온다.
    '결제 기록 있음'은 payment_events에 성공한 결제가 있는 사용자만 센다(탈퇴한 사용자는 구독 행이 없어 제외됨).
    """
    active = [r for r in rows if r.get("status") == "active"]
    non_admin = [r for r in active if r.get("user_id") not in admin_ids]
    paid = [r for r in non_admin if r.get("user_id") in paid_user_ids]
    return {"활성 전체(스케줄러 트리거 기준)": len(active), "관리자 제외": len(non_admin), "결제 기록 있는 외부": len(paid)}


def milestone_gap(count: int) -> str:
    nxt = next((m for m in MILESTONES if count < m), None)
    return f"다음 트리거 {nxt}명까지 {nxt - count}명" if nxt else "모든 트리거(20·50·100명) 지남"


async def _count(label, fn):
    try:
        return await fn()
    except Exception as e:  # 조회 실패는 '0건'이 아니다
        return f"확인 못 함({type(e).__name__})"


async def main() -> int:
    from dotenv import load_dotenv

    load_dotenv(os.path.join(_BACKEND, ".env"))
    from db.supabase_client import get_client, execute

    now = datetime.now(KST)
    since = (now - timedelta(hours=24)).astimezone(timezone.utc).isoformat()
    sb = get_client()
    print(f"== 일일 런치 점검 {now:%Y-%m-%d %H:%M} KST (읽기 전용) ==")
    print(f"- {cookie_reminder(now)}")

    async def subs():
        rows = (await execute(sb.table("subscriptions").select("user_id,status"))).data or []
        paid = {r["user_id"] for r in (await execute(sb.table("payment_events").select("user_id").eq("status", "success"))).data or [] if r.get("user_id")}
        admins = {u.strip() for u in os.getenv("ADMIN_USER_IDS", "").split(",") if u.strip()}
        b = subscriber_breakdown(rows, admins, paid)
        by_status = dict(Counter(r.get("status") for r in rows))
        return f"{b} / 상태별 {by_status} / 외부 결제 기준 {milestone_gap(b['결제 기록 있는 외부'])} (스케줄러는 활성 전체 {b['활성 전체(스케줄러 트리거 기준)']}명으로 판단)"

    async def scans():
        rows = (await execute(sb.table("scan_results").select("business_id").gte("scanned_at", since))).data or []
        return f"{len(rows)}건 / 사업장 {len({r['business_id'] for r in rows})}곳"

    async def alerts():
        rows = (await execute(sb.table("system_alerts").select("subject,source").gte("created_at", since))).data or []
        c = Counter((r.get("source") or "?") for r in rows)
        return f"{len(rows)}건 {dict(c)}" if rows else "0건"

    async def notes():
        rows = (await execute(sb.table("notifications").select("type,status").gte("sent_at", since))).data or []
        c = Counter(f"{r.get('type')}:{r.get('status')}" for r in rows)
        return f"{len(rows)}건 {dict(c)}" if rows else "0건"

    async def pay():
        rows = (await execute(sb.table("payment_events").select("event_type").gte("created_at", since))).data or []
        c = Counter(r.get("event_type") for r in rows)
        return f"{len(rows)}건 {dict(c)}" if rows else "0건"

    async def trials():
        rows = (await execute(sb.table("trial_scans").select("id").gte("scanned_at", since))).data or []
        return f"{len(rows)}건"

    async def keys():
        rows = (await execute(sb.table("discount_used_keys").select("purpose"))).data or []
        return f"{len(rows)}건 {dict(Counter(r.get('purpose') for r in rows))}"

    for label, fn in (("구독 상태", subs), ("최근 24h 스캔 저장", scans), ("최근 24h 운영 알림(system_alerts)", alerts),
                      ("최근 24h 알림톡 기록", notes), ("최근 24h 결제 이벤트", pay), ("최근 24h 무료 체험", trials),
                      ("재가입 방어 보관 키(건수만)", keys)):
        print(f"- {label}: {await _count(label, fn)}")
    print(f"- 가드 설정: DISCOUNT_KEY_GUARD_ENABLED={os.getenv('DISCOUNT_KEY_GUARD_ENABLED', '(미설정=꺼짐)')}")
    print("- 별도 확인: pm2 logs aeolab-backend --err --lines 60 --nostream (0건이 정상), /health")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
