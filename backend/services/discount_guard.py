"""재가입 반복 이용 방어 — 첫 달 할인·가입 후 1회 무료 체험 (2026-11-10).

문제: 탈퇴하면 구독·사업장·프로필 행이 모두 지워져 "이미 이용했는가" 판정의 근거가 사라진다 → 탈퇴 후 재가입으로 첫 달 50% 할인과
Basic 무료 체험(네이버·AI 호출 비용이 드는 풀스캔)을 반복할 수 있었다. 설계·근거: docs/resubscribe_discount_abuse_prevention_design_2026_11_10.md

방식: 이용 시점에 사업장 식별값(네이버·카카오 플레이스 ID, 사업자등록번호)과 정규화한 이메일을 **원문 없이 HMAC 해시**로
`discount_used_keys`에 남기고, 새 가입이 같은 해시를 만나면 이미 이용한 것으로 본다. 해시는 서버 비밀값(pepper)이 있어야 만들 수 있다
(플레이스 ID는 공개 숫자라 단순 해시는 대입으로 역산된다).

**기본은 꺼짐(`DISCOUNT_KEY_GUARD_ENABLED`)이다.** 탈퇴 후에도 비식별 값을 보관하는 것이라 개인정보처리방침·탈퇴 화면 고지가 먼저 있어야
한다(현재 방침에는 부정 이용 방지 목적의 보관이 없다). 꺼져 있거나 비밀값이 없으면 모든 함수가 아무것도 읽거나 쓰지 않는다.

원칙:
  - 조회·기록이 실패하면 결제·체험을 막지 않는다(fail-open, 경고 로그) — 놓치는 비용은 작고, 막는 비용은 정상 고객의 결제·체험 실패다.
  - 오탐(사업 양도·대행 등록) 구제: `release()` / scripts/discount_key_release.py.
  - 원문(이메일·ID)은 저장·로그하지 않는다. 로그에는 키 종류만 남긴다.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from db.supabase_client import execute, get_client

_logger = logging.getLogger(__name__)

PURPOSE_DISCOUNT = "discount"
PURPOSE_TRIAL = "trial"
PURPOSES = (PURPOSE_DISCOUNT, PURPOSE_TRIAL)

KEY_NAVER = "naver_place"
KEY_KAKAO = "kakao_place"
KEY_BRN = "brn"
KEY_EMAIL = "email"
KEY_PHONE = "phone"      # 알림 수신 번호(profiles.phone)·사업장 전화(businesses.phone) — 국내 번호만

_GMAIL_DOMAINS = ("gmail.com", "googlemail.com")
_DEFAULT_RETENTION_DAYS = 365       # 제안값(근거 없음) — 사용자 결정 D-2. 환경변수 DISCOUNT_KEY_RETENTION_DAYS로 조정


def guard_enabled() -> bool:
    return (
        os.getenv("DISCOUNT_KEY_GUARD_ENABLED", "false").strip().lower() == "true"
        and bool(os.getenv("DISCOUNT_KEY_PEPPER", "").strip())
    )


def retention_days() -> int:
    try:
        d = int(os.getenv("DISCOUNT_KEY_RETENTION_DAYS", str(_DEFAULT_RETENTION_DAYS)).strip())
    except ValueError:
        return _DEFAULT_RETENTION_DAYS
    return max(30, min(1095, d))


# ── 정규화 ────────────────────────────────────────────────────────

def normalize_email(email: Optional[str]) -> Optional[str]:
    """소문자·공백 제거, `+별칭` 제거, gmail은 점 제거(점은 gmail에서만 무시됨). 알 수 없으면 None."""
    if not email or "@" not in str(email):
        return None
    local, _, domain = str(email).strip().lower().rpartition("@")
    local = local.split("+", 1)[0]
    domain = domain.strip()
    if domain in _GMAIL_DOMAINS:
        local = local.replace(".", "")
        domain = "gmail.com"
    if not local or not domain:
        return None
    return f"{local}@{domain}"


def normalize_phone(value) -> Optional[str]:
    """국내 전화번호 정규화: 숫자만, +82/82 → 0, 9~11자리만 인정. 대표번호(15xx·16xx·18xx, 8자리)·이상한 값은 None(키로 쓰지 않는다)."""
    if value is None:
        return None
    d = re.sub(r"\D", "", str(value))
    if d.startswith("82") and len(d) >= 10:
        d = "0" + d[2:]
    if not (9 <= len(d) <= 11) or not d.startswith("0") or len(set(d)) < 4:
        return None
    return d


def normalize_digits(value, min_len: int, max_len: int) -> Optional[str]:
    """숫자만 남기고 자릿수가 범위 안이면 반환. 아니면 None(모르면 키로 쓰지 않는다)."""
    if value is None:
        return None
    digits = re.sub(r"\D", "", str(value))
    return digits if min_len <= len(digits) <= max_len else None


def compute_keys(email: Optional[str], businesses: list[dict], profile_phone=None) -> list[tuple[str, str]]:
    """(키 종류, 정규화 값) 목록 — 중복 제거. 값이 없거나 형식이 맞지 않는 것은 건너뛴다."""
    keys: list[tuple[str, str]] = []
    e = normalize_email(email)
    if e:
        keys.append((KEY_EMAIL, e))
    ph = normalize_phone(profile_phone)
    if ph:
        keys.append((KEY_PHONE, ph))
    for b in businesses or []:
        bp = normalize_phone((b or {}).get("phone"))
        if bp:
            keys.append((KEY_PHONE, bp))
        for kind, col, lo, hi in (
            (KEY_NAVER, "naver_place_id", 5, 20),
            (KEY_KAKAO, "kakao_place_id", 5, 20),
            (KEY_BRN, "business_registration_no", 10, 10),
        ):
            v = normalize_digits((b or {}).get(col), lo, hi)
            if v:
                keys.append((kind, v))
    return list(dict.fromkeys(keys))


def key_hash(purpose: str, key_type: str, value: str) -> Optional[str]:
    """HMAC-SHA256(pepper, "목적:종류:값") 16진수. 비밀값이 없으면 None."""
    pepper = os.getenv("DISCOUNT_KEY_PEPPER", "").strip()
    if not pepper:
        return None
    msg = f"{purpose}:{key_type}:{value}".encode("utf-8")
    return hmac.new(pepper.encode("utf-8"), msg, hashlib.sha256).hexdigest()


def _hashes(purpose: str, keys: list[tuple[str, str]]) -> list[tuple[str, str]]:
    out = []
    for kind, val in keys:
        h = key_hash(purpose, kind, val)
        if h:
            out.append((kind, h))
    return out


# ── DB ────────────────────────────────────────────────────────────

async def _user_businesses(user_id: str) -> list[dict]:
    res = await execute(
        get_client().table("businesses")
        .select("naver_place_id, kakao_place_id, business_registration_no, phone")
        .eq("user_id", user_id)
        .eq("is_active", True)
    )
    return (res.data if res else None) or []


async def _user_phone(user_id: str) -> Optional[str]:
    """알림 수신 번호. 못 읽으면 None(다른 키는 계속 쓴다)."""
    try:
        res = await execute(get_client().table("profiles").select("phone").eq("user_id", user_id).limit(1))
        rows = (res.data if res else None) or []
        return rows[0].get("phone") if rows else None
    except Exception as e:
        _logger.warning("[discount_guard] 연락처 조회 실패 — 이 키만 건너뜀: %s", e)
        return None


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def prior_use_conflict(purpose: str, user_id: str, email: Optional[str]) -> Optional[str]:
    """이 사용자(이메일·사업장)가 이미 이 목적(할인/체험)을 이용한 적이 있으면 일치한 키 종류, 없거나 모르면 None.

    꺼져 있거나 조회가 실패하면 None(막지 않는다). 만료·관리자 해제된 키는 일치로 보지 않는다.
    """
    if purpose not in PURPOSES or not guard_enabled():
        return None
    try:
        keys = compute_keys(email, await _user_businesses(user_id), await _user_phone(user_id))
        hashed = _hashes(purpose, keys)
        if not hashed:
            return None
        res = await execute(
            get_client().table("discount_used_keys")
            .select("key_type, key_hash")
            .eq("purpose", purpose)
            .in_("key_hash", [h for _, h in hashed])
            .is_("released_at", "null")
            .gt("expires_at", _now().isoformat())
            .limit(5)
        )
        rows = (res.data if res else None) or []
        if rows:
            kind = rows[0].get("key_type") or "unknown"
            _logger.warning("[discount_guard] %s 재이용 감지 (키 종류=%s, user=%s)", purpose, kind, user_id)
            return kind
        return None
    except Exception as e:
        _logger.warning("[discount_guard] 조회 실패 — 막지 않고 진행: %s", e)
        return None


async def record_use(purpose: str, user_id: str, email: Optional[str]) -> int:
    """이용 사실을 해시로 기록(이미 있으면 기간을 갱신하고 해제를 되돌린다). 기록한 키 수를 반환. 실패해도 예외를 내지 않는다."""
    if purpose not in PURPOSES or not guard_enabled():
        return 0
    try:
        keys = compute_keys(email, await _user_businesses(user_id), await _user_phone(user_id))
        hashed = _hashes(purpose, keys)
        if not hashed:
            return 0
        now = _now()
        rows = [
            {
                "purpose": purpose,
                "key_type": kind,
                "key_hash": h,
                "used_at": now.isoformat(),
                "expires_at": (now + timedelta(days=retention_days())).isoformat(),
                "released_at": None,
                "released_by": None,
            }
            for kind, h in hashed
        ]
        await execute(get_client().table("discount_used_keys").upsert(rows, on_conflict="purpose,key_type,key_hash"))
        return len(rows)
    except Exception as e:
        _logger.warning("[discount_guard] 기록 실패 — 결제·체험은 계속: %s", e)
        return 0


async def purge_expired() -> int:
    """만료된 키를 삭제하고 건수를 반환(보관 기간이 지난 값을 남겨 두지 않는다)."""
    res = await execute(
        get_client().table("discount_used_keys").delete().lt("expires_at", _now().isoformat())
    )
    return len((res.data if res else None) or [])


async def release(purpose: str, key_type: str, value: str, released_by: str = "admin") -> int:
    """오탐 구제 — 값(원문)을 받아 같은 해시의 키를 해제한다. 해제한 행 수를 반환."""
    if purpose not in PURPOSES:
        raise ValueError("unknown purpose")
    if key_type == KEY_EMAIL:
        norm = normalize_email(value)
    elif key_type == KEY_PHONE:
        norm = normalize_phone(value)
    elif key_type in (KEY_NAVER, KEY_KAKAO):
        norm = normalize_digits(value, 5, 20)
    elif key_type == KEY_BRN:
        norm = normalize_digits(value, 10, 10)
    else:
        raise ValueError("unknown key_type")
    if not norm:
        return 0
    h = key_hash(purpose, key_type, norm)
    if not h:
        raise RuntimeError("DISCOUNT_KEY_PEPPER 미설정")
    res = await execute(
        get_client().table("discount_used_keys")
        .update({"released_at": _now().isoformat(), "released_by": released_by})
        .eq("purpose", purpose)
        .eq("key_type", key_type)
        .eq("key_hash", h)
    )
    return len((res.data if res else None) or [])
