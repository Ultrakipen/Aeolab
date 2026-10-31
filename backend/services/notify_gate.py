"""해지·만료 사용자에게 알림톡을 보내지 않기 위한 수신 차단 판정 (2026-10-31, 사용자 결정).

대상: 구독 이력이 있는데 지금은 서비스 자격이 없는 사용자(만료일이 지난 해지·정지·그 밖의 상태). 자격 기준은 야간 스캔·경쟁사 크롤과 같은
`scan_scheduling.entitled_user_ids`(해지해도 만료일까지는 서비스를 받으므로 알림도 받는다). 구독 이력이 아예 없는 가입자(체험 사용자)는
이 규칙의 대상이 아니다 — 체험 후 안내 알림은 별개의 결정이다.

알림 발송 함수들은 전화번호만 받으므로, 사용자 id가 아니라 **전화번호** 기준으로 판정한다. 같은 번호가 자격 있는 계정에도 등록돼 있으면
(관리자 계정 둘 등) 보내도록 둔다. 구독 상태 안내(해지 완료·만료 예정·결제 실패·정지·재개·증액 고지)는 이 차단을 받지 않는다(`gated=False`).

조회가 실패하면 보내지 않는다: 해지 사용자에게 잘못 보내는 쪽이 알림 하나를 건너뛰는 쪽보다 나쁘다(정기 잡은 다음 주기에 다시 시도).
"""
from __future__ import annotations

import logging
import os
import re
import time

logger = logging.getLogger("aeolab")

_TTL_SEC = 600
_cache: dict = {"at": 0.0, "phones": None}


def _digits(phone) -> str:
    return re.sub(r"\D", "", str(phone or ""))


async def _compute_blocked_phones() -> set[str]:
    from db.supabase_client import get_client
    from services.db_paging import fetch_all_in_chunks, fetch_all_rows
    from services.scan_scheduling import entitled_user_ids

    db = get_client()
    subs, _ = await fetch_all_rows(lambda: db.table("subscriptions").select("user_id, status, end_at").order("id"), max_rows=100_000)
    admin_ids = [u.strip() for u in os.getenv("ADMIN_USER_IDS", "").split(",") if u.strip()]
    entitled = entitled_user_ids(subs, admin_ids=admin_ids)
    lapsed = {str(r["user_id"]) for r in subs if r.get("user_id")} - entitled
    if not lapsed:
        return set()
    blocked_rows, _ = await fetch_all_in_chunks(
        lambda part: db.table("profiles").select("user_id, phone").in_("user_id", part).order("user_id"), sorted(lapsed))
    blocked = {_digits(r.get("phone")) for r in blocked_rows if r.get("phone")}
    if entitled:
        ok_rows, _ = await fetch_all_in_chunks(
            lambda part: db.table("profiles").select("user_id, phone").in_("user_id", part).order("user_id"), sorted(entitled))
        blocked -= {_digits(r.get("phone")) for r in ok_rows if r.get("phone")}
    blocked.discard("")
    return blocked


async def is_blocked(phone) -> bool:
    """이 번호가 서비스 기간이 끝난 계정의 것이어서 알림을 보내면 안 되는가. 조회 실패 시 True(보내지 않음)."""
    if os.getenv("NOTIFY_SUBSCRIPTION_GATE", "true").strip().lower() in ("0", "false", "no", "off"):
        return False
    now = time.monotonic()
    phones = _cache["phones"]
    if phones is None or now - _cache["at"] > _TTL_SEC:
        try:
            phones = await _compute_blocked_phones()
            _cache.update(at=now, phones=phones)
        except Exception as e:
            logger.warning("[notify_gate] 차단 목록 조회 실패 — 이번 발송은 건너뜀: %s", e)
            return True
    d = _digits(phone)
    if d.startswith("82"):
        d = "0" + d[2:]
    return d in phones
