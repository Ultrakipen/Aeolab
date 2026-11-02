"""구독 이용 기간 연장(장애 보상) — 기본은 드라이런(아무것도 바꾸지 않음) (2026-11-02).

안내 메일(`subscriber_notice_email.py`)이 "이용 기간을 3일 연장해 드립니다"라고 약속하므로, 메일을 받는 사람(`entitled_user_ids`)에게 실제로 적용하는 도구다.
정기결제 일정은 크렙이 아니라 우리 잡이 `subscriptions.end_at`으로 정한다(`subscription_lifecycle_job`, 매일 01:00: active이고 end_at<=오늘이면 빌링키 청구 후
end_at=오늘+30). 그래서 end_at에 일수를 더하면 만료일과 다음 청구일이 함께 밀린다 — 결제 시스템 쪽 변경은 없다. 근거·한계는 docs/naver_outage_customer_communication_2026_11_02.md.

행 상태별 처리(메일 수신자와 같은 기준 — 약속한 사람은 전부 적용하거나 사유를 보여 준다)
- active              : end_at += N일. first_month_discount_until이 오늘 이후면 같이 += N일(정상가 전환 D-3 사전고지가 청구 6일 전에 나가지 않게).
- cancelled(만료일 전): end_at += N일. 해지 행은 청구 대상이 아니라 결제 영향 없음(서비스 유지 기간만 늘어남).
- grace_period        : grace_until += N일(유예 중 잡은 end_at이 아니라 grace_until로 정지를 판단한다).
- end_at/grace_until 없음, 관리자, 그 밖의 상태: 건너뜀(사유 표시).

안전 장치
- 기본은 드라이런. 적용은 `--apply --confirm <변경될 행 수>` 둘 다 필요, 수가 다르면 중단.
- 같은 `--campaign`에 이미 적용한 사용자는 건너뜀(중복 적용 방지). 기록 파일 `.subscription_extend_<캠페인>.jsonl`에 변경 전·후 값을 남겨 되돌릴 수 있다(--rollback).
- 낙관적 잠금: 변경 전 값이 그대로일 때만 갱신한다(그 사이 갱신 잡이 돌아 값이 바뀌었으면 건너뛰고 알림).
- 갱신 잡(01:00) 전후 시간대에는 적용하지 않는다(00:50~01:30, 같은 날 end_at 처리·7일 전 안내 중복과 겹침 방지). --allow-job-window로만 우회.
- 사용자 id는 앞 8자만 출력한다.

사용(서버): cd /var/www/aeolab/backend && /var/www/aeolab/venv/bin/python scripts/subscription_extend_days.py --campaign naver-2026-11
"""
import argparse
import hashlib
import json
import os
import re
import sys
from datetime import date, datetime, timedelta, timezone

_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _BACKEND)

EXTENSION_DAYS = 3  # 안내 메일 문안(subscriber_notice_email.EXTENSION_DAYS)과 같아야 한다 — 테스트가 일치를 강제한다
JOB_WINDOW = ((0, 50), (1, 30))  # 갱신 잡 전후 — 이 시간대에는 적용하지 않는다


def _load_env() -> None:
    try:
        from dotenv import load_dotenv

        load_dotenv(os.path.join(_BACKEND, ".env"))
    except ImportError:
        pass


def _d(value) -> date | None:
    """DB 값(날짜 또는 시각 문자열)을 날짜로. 못 읽으면 None."""
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def in_job_window(now: datetime | None = None) -> bool:
    now = now or datetime.now()
    hm = (now.hour, now.minute)
    return JOB_WINDOW[0] <= hm <= JOB_WINDOW[1]


def plan_changes(rows: list[dict], admin_ids=(), today: date | None = None, days: int = EXTENSION_DAYS):
    """(적용할 변경 목록, 건너뜀 목록[(id앞8자, 사유)]). 순수 함수 — DB를 건드리지 않는다.

    대상은 `scan_scheduling.entitled_user_ids`(= 안내 메일 수신자) 중 관리자를 뺀 사용자다."""
    from services.scan_scheduling import entitled_user_ids

    today = today or date.today()
    admins = {str(a) for a in admin_ids if a}
    entitled = entitled_user_ids(rows) - admins
    changes, skipped = [], []
    for r in rows:
        uid = str(r.get("user_id") or "")
        if uid not in entitled:
            continue
        status, tag = r.get("status"), uid[:8]
        if status in ("active", "cancelled"):
            end = _d(r.get("end_at"))
            if end is None:
                skipped.append((tag, f"{status}: 만료일(end_at) 없음 — 연장할 기준이 없음"))
                continue
            new = {"end_at": str(end + timedelta(days=days))}
            old = {"end_at": str(r.get("end_at"))}
            disc = _d(r.get("first_month_discount_until"))
            if status == "active" and disc is not None and disc >= today:
                new["first_month_discount_until"] = str(disc + timedelta(days=days))
                old["first_month_discount_until"] = str(r.get("first_month_discount_until"))
            changes.append({"id": r["id"], "uid": uid, "status": status, "old": old, "new": new})
        elif status == "grace_period":
            gu = _d(r.get("grace_until"))
            if gu is None:
                skipped.append((tag, "grace_period: 유예 종료일(grace_until) 없음"))
                continue
            changes.append({"id": r["id"], "uid": uid, "status": status,
                            "old": {"grace_until": str(r.get("grace_until"))},
                            "new": {"grace_until": str(gu + timedelta(days=days))}})
        else:
            skipped.append((tag, f"{status}: 연장 대상 상태 아님"))
    return changes, skipped


def uid_hash(uid: str) -> str:
    return hashlib.sha256(str(uid).encode("utf-8")).hexdigest()[:16]


def _log_path(campaign: str) -> str:
    return os.path.join(_BACKEND, f".subscription_extend_{re.sub(r'[^A-Za-z0-9_.-]', '_', campaign)}.jsonl")


def load_ledger(campaign: str) -> list[dict]:
    path = _log_path(campaign)
    if not os.path.exists(path):
        return []
    out = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            try:
                out.append(json.loads(line))
            except ValueError:
                continue
    return out


def append_ledger(campaign: str, entry: dict) -> None:
    with open(_log_path(campaign), "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def _update_if_unchanged(sb, table_id, old: dict, new: dict) -> bool:
    """변경 전 값이 그대로일 때만 갱신(낙관적 잠금). 갱신된 행이 있으면 True."""
    q = sb.table("subscriptions").update(new).eq("id", table_id)
    for k, v in old.items():
        q = q.eq(k, v)
    res = q.execute()
    return bool(getattr(res, "data", None))


def _fetch_rows(sb) -> list[dict]:
    rows, start = [], 0
    while True:  # 1,000행 상한 페이징
        page = (sb.table("subscriptions")
                .select("id,user_id,status,end_at,grace_until,first_month_discount_until")
                .order("id").range(start, start + 999).execute().data or [])
        rows += page
        if len(page) < 1000:
            return rows
        start += 1000


def apply_changes(sb, campaign: str, changes: list[dict]) -> tuple[int, list[str]]:
    ok, failed = 0, []
    for c in changes:
        if _update_if_unchanged(sb, c["id"], c["old"], c["new"]):
            append_ledger(campaign, {"h": uid_hash(c["uid"]), "id": c["id"], "status": c["status"], "old": c["old"], "new": c["new"],
                                     "at": datetime.now(timezone.utc).isoformat()})
            ok += 1
        else:
            failed.append(c["uid"][:8])
    return ok, failed


def rollback(sb, campaign: str) -> tuple[int, list[str]]:
    """기록에 남은 변경을 되돌린다 — 현재 값이 우리가 적용한 값 그대로일 때만(그 뒤 갱신 잡이 값을 바꿨다면 건드리지 않는다)."""
    ok, failed = 0, []
    for e in reversed(load_ledger(campaign)):
        if e.get("rolled_back"):
            continue
        if _update_if_unchanged(sb, e["id"], e["new"], e["old"]):
            ok += 1
            append_ledger(campaign, {"rolled_back": True, "id": e["id"], "h": e["h"], "at": datetime.now(timezone.utc).isoformat()})
        else:
            failed.append(str(e["id"])[:8])
    return ok, failed


def already_applied(campaign: str) -> set[str]:
    """이 캠페인에서 적용했고 되돌리지 않은 사용자(해시)."""
    done, undone = set(), set()
    for e in load_ledger(campaign):
        (undone if e.get("rolled_back") else done).add(e["h"])
    return done - undone


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="구독 이용 기간 연장 (기본 드라이런)")
    p.add_argument("--campaign", required=True, help="중복 적용 방지용 이름. 같은 사고는 같은 이름, 다른 사고(또 3일 연장)는 다른 이름")
    p.add_argument("--days", type=int, default=EXTENSION_DAYS)
    p.add_argument("--apply", action="store_true")
    p.add_argument("--confirm", type=int, default=-1, help="--apply 시 변경될 행 수를 한 번 더 입력")
    p.add_argument("--rollback", action="store_true", help="이 캠페인의 적용을 되돌림(--apply 필요)")
    p.add_argument("--allow-job-window", action="store_true", help="01:00 갱신 잡 전후 시간대에도 적용")
    a = p.parse_args(argv)

    from db.supabase_client import get_client

    sb = get_client()
    if a.rollback:
        if not a.apply:
            n = len([e for e in load_ledger(a.campaign) if not e.get("rolled_back")])
            print(f"드라이런: 되돌릴 기록 {n}건(실제로 되돌리려면 --rollback --apply)")
            return 0
        ok, failed = rollback(sb, a.campaign)
        print(f"되돌림 {ok}건 · 건너뜀(그 사이 값이 바뀜) {len(failed)}건 {failed}")
        return 0 if not failed else 1

    admin_ids = [u.strip() for u in os.getenv("ADMIN_USER_IDS", "").split(",") if u.strip()]
    changes, skipped = plan_changes(_fetch_rows(sb), admin_ids, days=a.days)
    done = already_applied(a.campaign)
    todo = [c for c in changes if uid_hash(c["uid"]) not in done]

    print(f"== {'적용' if a.apply else '드라이런(바꾸지 않음)'} · 캠페인 {a.campaign} · +{a.days}일 ==")
    print(f"대상 {len(changes)}건 · 이미 적용 {len(changes) - len(todo)}건 · 이번 변경 {len(todo)}건 · 건너뜀 {len(skipped)}건")
    for c in todo:
        print(f"  {c['uid'][:8]} [{c['status']}] " + ", ".join(f"{k}: {c['old'][k][:10]} → {c['new'][k]}" for k in c["new"]))
    for tag, why in skipped:
        print(f"  건너뜀 {tag}: {why}")
    if skipped:
        print("  ! 건너뛴 사용자도 안내 메일 수신자일 수 있다 — 메일을 보내기 전에 이 목록을 확인할 것.")
    if not a.apply:
        print("드라이런이라 아무것도 바꾸지 않았습니다. 적용하려면 --apply --confirm", len(todo))
        return 0
    if not todo:
        print("변경할 행이 없습니다.")
        return 0
    if a.confirm != len(todo):
        print(f"중단: --confirm 값({a.confirm})이 변경될 행 수({len(todo)})와 다릅니다.")
        return 2
    if in_job_window() and not a.allow_job_window:
        print("중단: 01:00 구독 갱신 잡 전후(00:50~01:30)에는 적용하지 않습니다. 다른 시간에 다시 실행하세요.")
        return 2
    ok, failed = apply_changes(sb, a.campaign, todo)
    print(f"적용 {ok}건 · 실패(그 사이 값이 바뀜) {len(failed)}건 {failed}")
    return 0 if not failed else 1


if __name__ == "__main__":
    _load_env()
    sys.exit(main())
