"""Trial Conversion Funnel — 무료 체험 → 회원 전환 (v3.6, 2026-04-24)

비로그인 사용자가 trial 결과 페이지에서 이메일을 남기면:
  1. Supabase Auth admin generate_link로 매직 링크 생성 (signup or magiclink)
  2. redirectTo에 trial_id를 포함해 회원가입 → 본인 계정에 trial 흡수 가능
  3. send_trial_claim_link로 진단 요약 + 링크 메일 발송
  4. trial_scans.claimed_at, claim_email 기록 → 깔때기 KPI 계측
"""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Optional

from db.supabase_client import execute, get_client
from services.email_sender import send_trial_claim_link

logger = logging.getLogger("aeolab")

_BASE_URL = os.getenv("FRONTEND_URL", "https://aeolab.co.kr").rstrip("/")


async def _generate_magic_link(email: str, trial_id: str) -> Optional[str]:
    """Supabase Auth admin API로 가입/로그인 링크 생성.

    1) signup 링크를 먼저 시도 (신규 이메일이면 가입 플로우)
    2) "User already registered" 류 오류면 magiclink로 폴백 (기존 회원 로그인)
    실패 시 None 반환 (호출 측에서 fallback URL 사용).
    """
    supabase = get_client()
    redirect_to = f"{_BASE_URL}/auth/callback?trial_id={trial_id}"

    def _try(link_type: str) -> Optional[str]:
        try:
            resp = supabase.auth.admin.generate_link(
                {
                    "type": link_type,           # "signup" | "magiclink"
                    "email": email,
                    "options": {"redirect_to": redirect_to},
                }
            )
            # supabase-py 2.x 응답은 객체/딕셔너리 혼재 — 둘 다 안전하게 추출
            props = (
                getattr(resp, "properties", None)
                or getattr(getattr(resp, "data", None), "properties", None)
                or (resp.get("properties") if isinstance(resp, dict) else None)
            )
            if props is None:
                return None
            action_link = (
                getattr(props, "action_link", None)
                if not isinstance(props, dict)
                else props.get("action_link")
            )
            return action_link
        except Exception as e:  # noqa: BLE001
            msg = str(e).lower()
            if "registered" in msg or "already" in msg or "exists" in msg:
                return None  # 호출 측에서 magiclink로 재시도
            logger.warning(
                f"[trial_conversion] generate_link({link_type}) failed: {e}"
            )
            return None

    link = await asyncio.to_thread(_try, "signup")
    if link:
        return link
    link = await asyncio.to_thread(_try, "magiclink")
    return link


async def claim_trial(
    trial_id: str,
    email: str,
    phone: Optional[str] = None,
    opt_in: bool = False,
) -> None:
    """trial_id 결과를 이메일 소유자에게 매직 링크로 보내고 claimed 기록.

    Raises:
        ValueError: trial_id가 존재하지 않을 때 (라우터가 404로 변환)
    """
    supabase = get_client()

    # 1) trial_scans 조회 (요약 정보 + 멱등 처리)
    res = await execute(
        supabase.table("trial_scans")
        .select(
            "id, business_name, category, region, total_score, "
            "unified_score, grade, claimed_at"
        )
        .eq("id", trial_id)
        .maybe_single()
    )
    if not (res and res.data):
        raise ValueError("trial_not_found")

    trial = res.data
    if trial.get("claimed_at"):
        # 이미 claim 처리됨 — 라우터에서 200 + 안내 처리
        logger.info(f"[trial_conversion] already claimed: trial_id={trial_id}")
        return

    # 2) 매직 링크 생성 (실패해도 fallback 링크로 계속 진행)
    magic_link = await _generate_magic_link(email, trial_id)
    if not magic_link:
        magic_link = (
            f"{_BASE_URL}/signup?trial_id={trial_id}&email="
            + email.replace("@", "%40")
        )
        logger.info(
            f"[trial_conversion] using fallback signup link for {email[:3]}***"
        )

    # 3) 진단 요약 — 메일 본문에서 사용
    score_val = trial.get("unified_score") or trial.get("total_score") or 0
    summary = {
        "business_name": trial.get("business_name") or "내 가게",
        "category": trial.get("category") or "",
        "region": trial.get("region") or "",
        "score": float(score_val) if score_val is not None else 0.0,
        "grade": trial.get("grade") or "",
    }

    # 4) 메일 발송 (실패해도 claimed_at은 기록 — 사용자가 재요청 가능하도록 logs로 추적)
    try:
        await send_trial_claim_link(email, magic_link, summary)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[trial_conversion] send_trial_claim_link failed: {e}")

    # 5) DB에 claimed 기록
    update_payload = {
        "claimed_at": "now()",  # supabase는 문자열 'now()' 비허용 — 아래에서 ISO로 변환
        "claim_email": email,
    }
    # supabase-py는 'now()' literal을 지원하지 않으므로 UTC ISO로 명시
    from datetime import datetime, timezone

    update_payload["claimed_at"] = datetime.now(timezone.utc).isoformat()

    try:
        await execute(
            supabase.table("trial_scans")
            .update(update_payload)
            .eq("id", trial_id)
            .is_("claimed_at", "null")  # race condition 방지 (멱등)
        )
    except Exception as e:  # noqa: BLE001
        logger.warning(
            f"[trial_conversion] claimed_at update failed (trial_id={trial_id}): {e}"
        )

    logger.info(
        f"[trial_conversion] claim ok: trial_id={trial_id} email={email[:3]}***"
    )


async def attach_trial_to_user(trial_id: str, user_id: str) -> str:
    """가입 완료 후 인증된 사용자가 자기 trial_id를 본인 계정에 흡수.

    Returns:
        "attached"          — 이번 호출로 본인에 매핑됨
        "already_owned"     — 이미 본인 소유 (멱등)

    Raises:
        ValueError("not_found")    — trial_id 없음 (라우터가 404)
        ValueError("conflict")     — 이미 다른 사용자에게 매핑됨 (라우터가 409)
    """
    supabase = get_client()
    res = await execute(
        supabase.table("trial_scans")
        .select("id, converted_user_id")
        .eq("id", trial_id)
        .maybe_single()
    )
    if not (res and res.data):
        raise ValueError("not_found")

    cur = res.data.get("converted_user_id")
    if cur and str(cur) == str(user_id):
        return "already_owned"
    if cur and str(cur) != str(user_id):
        raise ValueError("conflict")

    await execute(
        supabase.table("trial_scans")
        .update({"converted_user_id": user_id})
        .eq("id", trial_id)
        .is_("converted_user_id", "null")  # 원자적 — 동시성 보호
    )
    logger.info(
        f"[trial_conversion] attach ok: trial_id={trial_id} user_id={user_id}"
    )
    return "attached"
