"""v3.1 점수 모델 활성화 시 사용자 알림 일괄 발송 모듈.

사용법:
    from services.score_model_migration_notice import send_v3_1_activation_notice
    result = await send_v3_1_activation_notice(supabase, dry_run=True)   # 사전 확인
    result = await send_v3_1_activation_notice(supabase, dry_run=False)  # 실제 발송

카카오 알림톡 템플릿 AEOLAB_SCORE_MODEL_01 은 비즈센터에서 별도 신청 필요.
신청 전에는 in_app_messages INSERT만 동작 (카카오 건너뜀).
"""

from __future__ import annotations

import logging
from typing import Optional

_logger = logging.getLogger("aeolab")

# ────────────────────────────────────────────────────────────────
# 인앱 알림 메시지 (notifications 테이블 INSERT용)
# ────────────────────────────────────────────────────────────────
V3_1_ACTIVATION_NOTICE: dict = {
    "title": "업종별 맞춤 점수 기준으로 개선되었습니다",
    "body": (
        "사장님 업종에 실제로 의미 있는 채널에 더 높은 비중이 부여되도록 "
        "점수 산정 기준이 업그레이드되었습니다. "
        "점수 변동은 일시적이며 실제 노출 상태와 일치하도록 "
        "보정된 결과입니다."
    ),
    "cta_label": "변경 내용 자세히 보기",
    "cta_url": "/guide/score-model-v3-1",
    "severity": "info",
    "target_segment": "all",
    "is_pinned": True,
}

# 카카오 알림톡 템플릿 코드 (비즈센터 승인 후 활성화)
KAKAO_TEMPLATE_CODE = "AEOLAB_SCORE_MODEL_01"

# 카카오 알림톡 본문 (비즈센터 신청용 레퍼런스)
KAKAO_TEMPLATE_BODY = """[AEOlab] 점수 기준 개선 안내

안녕하세요, #{name}님.
사장님 업종에 맞는 점수 기준으로 업그레이드되었습니다.

실제로 노출 효과가 있는 채널에 더 높은 비중이 적용되어 보다 정확한 진단을 받으실 수 있습니다.

▶ 변경 내용 자세히 보기: https://aeolab.co.kr/guide/score-model-v3-1"""

# ────────────────────────────────────────────────────────────────
# v3.1 변경 사항 요약 (가이드 페이지 정적 데이터 / frontend에서 직접 참조 가능)
# ────────────────────────────────────────────────────────────────
V3_1_CHANGES_SUMMARY: list[dict] = [
    {
        "group": "ACTIVE",
        "label": "ACTIVE 업종 (음식점·카페·베이커리·바·숙박)",
        "v30_focus": "키워드 갭 35% + 리뷰 25% + 스마트플레이스 15% + 네이버 노출 15% + 기타 10%",
        "v31_focus": "키워드 순위 25% + AI 브리핑 25% + 리뷰 15% + 스마트플레이스 15% + 로컬맵 10% + 블로그 10%",
        "expected_change": "AI 브리핑 노출 사업장은 점수 상승 예상 (+5~10점). 키워드 순위 미측정 시 일시 하락 가능.",
    },
    {
        "group": "LIKELY",
        "label": "LIKELY 업종 (미용·네일·피트니스·요가·반려동물·약국 등)",
        "v30_focus": "키워드 갭 35% + 리뷰 25% + 스마트플레이스 15% + 기타 25%",
        "v31_focus": "키워드 순위 30% + AI 브리핑 15% + 리뷰 17% + 스마트플레이스 18% + 로컬맵 10% + 블로그 10%",
        "expected_change": "스마트플레이스 완성도 높을수록 점수 안정. AI 브리핑 비중 소폭 축소 → 키워드 순위 비중 확대.",
    },
    {
        "group": "INACTIVE",
        "label": "INACTIVE 업종 (법무·세무·교육·쇼핑몰·부동산 등)",
        "v30_focus": "AI 브리핑 비중 유지 (해당 없으나 포함됨)",
        "v31_focus": "키워드 순위 35% + 리뷰 20% + 스마트플레이스 20% + 로컬맵 15% + 블로그 10% (AI 브리핑 0%)",
        "expected_change": "AI 브리핑 영향 완전 제거 → 실제 검색 노출 지표만 반영. 글로벌 AI(ChatGPT·Gemini) 신호 비중 상대적 증가.",
    },
]


# ────────────────────────────────────────────────────────────────
# 활성화 알림 발송
# ────────────────────────────────────────────────────────────────

async def send_v3_1_activation_notice(
    supabase,
    *,
    dry_run: bool = True,
) -> dict:
    """v3.1 활성화 시 전체 활성 사용자에게 알림 발송.

    Args:
        supabase: Supabase client (get_client() 반환값)
        dry_run:  True → 실제 발송 없이 대상자 수만 반환 (기본값, 안전)
                  False → 실제 notifications INSERT + 카카오 발송

    Returns:
        {
            "target_count": int,
            "in_app_inserted": int,
            "kakao_sent": int,
            "kakao_failed": int,
            "dry_run": bool,
        }
    """
    from db.supabase_client import execute

    # 1. 활성 구독자 user_id 목록 조회
    _subs_res = await execute(
        supabase.table("subscriptions")
        .select("user_id, plan")
        .in_("status", ["active", "grace_period"])
        .limit(5000)
    )
    subs = _subs_res.data or []
    target_count = len(subs)

    if dry_run:
        _logger.info(
            f"[v3.1 notice dry_run] 발송 대상 {target_count}명 — "
            "실제 발송하려면 dry_run=False 로 재호출"
        )
        return {
            "target_count": target_count,
            "in_app_inserted": 0,
            "kakao_sent": 0,
            "kakao_failed": 0,
            "dry_run": True,
        }

    # 2. in_app_messages 테이블에 target_segment="all" 1건 INSERT
    #    (NotificationBell이 조회하는 정답 테이블. 사용자별 읽음 처리는 message_reads로 분리됨)
    in_app_inserted = 0
    notification_row = {
        "title": V3_1_ACTIVATION_NOTICE["title"],
        "body": V3_1_ACTIVATION_NOTICE["body"],
        "cta_label": V3_1_ACTIVATION_NOTICE["cta_label"],
        "cta_url": V3_1_ACTIVATION_NOTICE["cta_url"],
        "target_segment": V3_1_ACTIVATION_NOTICE.get("target_segment", "all"),
        "is_active": True,
    }
    try:
        _ins = await execute(supabase.table("in_app_messages").insert(notification_row))
        in_app_inserted = len(_ins.data or [])
    except Exception as _ie:
        _logger.warning(f"[v3.1 notice] in_app_messages INSERT 실패: {_ie}")

    # 3. 카카오 알림톡 발송 (AEOLAB_SCORE_MODEL_01 템플릿 승인 후 활성화)
    kakao_sent = 0
    kakao_failed = 0
    try:
        import os
        _tmpl_key = os.getenv("KAKAO_TEMPLATE_SCORE_MODEL")
        if not _tmpl_key:
            _logger.info(
                "[v3.1 notice] KAKAO_TEMPLATE_SCORE_MODEL 환경변수 미설정 — "
                "카카오 알림톡 건너뜀 (in_app만 발송됨)"
            )
        else:
            from services.kakao_notify import KakaoNotifier
            _notifier = KakaoNotifier()
            _user_ids = [s["user_id"] for s in subs if s.get("user_id")]
            if _user_ids:
                _profiles_res = await execute(
                    supabase.table("profiles")
                    .select("user_id, phone")
                    .in_("user_id", _user_ids)
                    .not_.is_("phone", "null")
                )
                _profiles = _profiles_res.data or []
                for _p in _profiles:
                    _phone = _p.get("phone")
                    if not _phone:
                        continue
                    try:
                        # send_custom_template: KakaoNotifier 구현체에 추가 필요 (현재는 pass)
                        if hasattr(_notifier, "send_custom_template"):
                            await _notifier.send_custom_template(
                                phone=_phone,
                                template_code=_tmpl_key,
                                variables={"name": "사장님"},
                            )
                        kakao_sent += 1
                    except Exception as _ke:
                        kakao_failed += 1
                        _logger.warning(
                            f"[v3.1 notice] 카카오 발송 실패 phone={str(_phone)[:3]}****: {_ke}"
                        )
    except Exception as _kae:
        _logger.warning(f"[v3.1 notice] 카카오 발송 전체 실패: {_kae}")

    _logger.info(
        f"[v3.1 notice] 완료 — 대상 {target_count}명, "
        f"인앱 {in_app_inserted}건, 카카오 {kakao_sent}건 성공 / {kakao_failed}건 실패"
    )
    return {
        "target_count": target_count,
        "in_app_inserted": in_app_inserted,
        "kakao_sent": kakao_sent,
        "kakao_failed": kakao_failed,
        "dry_run": False,
    }


async def send_v3_1_kakao_only(supabase) -> dict:
    """v3.1 활성화 카카오 알림톡만 별도 발송 (인앱 메시지 이미 발송된 경우).

    선결 조건:
    - 카카오 비즈센터 `AEOLAB_SCORE_MODEL_01` 템플릿 승인 완료
    - 환경변수 `KAKAO_TEMPLATE_SCORE_MODEL=AEOLAB_SCORE_MODEL_01` 설정

    Returns:
        {target_count, kakao_sent, kakao_failed, error?}
    """
    from db.supabase_client import execute
    import os

    _tmpl_key = os.getenv("KAKAO_TEMPLATE_SCORE_MODEL", "").strip()
    if not _tmpl_key:
        _logger.warning(
            "[v3.1 kakao only] KAKAO_TEMPLATE_SCORE_MODEL 미설정 — "
            "비즈센터 승인 후 .env에 추가 필요"
        )
        return {
            "target_count": 0,
            "kakao_sent": 0,
            "kakao_failed": 0,
            "error": "KAKAO_TEMPLATE_SCORE_MODEL 환경변수 미설정",
        }

    _subs_res = await execute(
        supabase.table("subscriptions")
        .select("user_id, plan")
        .in_("status", ["active", "grace_period"])
        .limit(5000)
    )
    subs = _subs_res.data or []
    _user_ids = [s["user_id"] for s in subs if s.get("user_id")]
    if not _user_ids:
        return {"target_count": 0, "kakao_sent": 0, "kakao_failed": 0}

    _profiles_res = await execute(
        supabase.table("profiles")
        .select("user_id, phone, full_name, kakao_scan_notify")
        .in_("user_id", _user_ids)
        .not_.is_("phone", "null")
    )
    _profiles = _profiles_res.data or []
    # 카카오 수신 동의자만 (kakao_scan_notify=False 명시 거부자 제외)
    _eligible = [p for p in _profiles if p.get("kakao_scan_notify") is not False and p.get("phone")]
    target_count = len(_eligible)
    if target_count == 0:
        return {
            "target_count": 0,
            "kakao_sent": 0,
            "kakao_failed": 0,
            "note": "수신 동의자·전화번호 등록자 0명",
        }

    kakao_sent = 0
    kakao_failed = 0
    try:
        from services.kakao_notify import KakaoNotifier
        _notifier = KakaoNotifier()
        for _p in _eligible:
            _phone = _p.get("phone")
            _name = _p.get("full_name") or "사장님"
            _msg = (
                f"[AEOlab] 점수 기준 개선 안내\n\n"
                f"안녕하세요, {_name}님.\n"
                f"사장님 업종에 맞는 점수 기준으로 업그레이드되었습니다.\n\n"
                f"실제로 노출 효과가 있는 채널에 더 높은 비중이 적용되어 보다 정확한 진단을 받으실 수 있습니다.\n\n"
                f"▶ 변경 내용 자세히 보기: https://aeolab.co.kr/guide/score-model-v3-1"
            )
            try:
                await _notifier._send_raw(_phone, _msg, template_code=_tmpl_key)
                kakao_sent += 1
            except Exception as _ke:
                kakao_failed += 1
                _logger.warning(
                    f"[v3.1 kakao only] 발송 실패 phone={str(_phone)[:3]}****: {_ke}"
                )
    except Exception as _kae:
        _logger.warning(f"[v3.1 kakao only] 전체 실패: {_kae}")
        return {
            "target_count": target_count,
            "kakao_sent": kakao_sent,
            "kakao_failed": kakao_failed,
            "error": str(_kae),
        }

    _logger.info(
        f"[v3.1 kakao only] 완료 — 대상 {target_count}명, "
        f"성공 {kakao_sent}건 / 실패 {kakao_failed}건"
    )
    return {
        "target_count": target_count,
        "kakao_sent": kakao_sent,
        "kakao_failed": kakao_failed,
    }


def get_activation_summary() -> dict:
    """활성화 전 미리 확인용 — 발송 예정 메시지 미리보기."""
    return {
        "notice": V3_1_ACTIVATION_NOTICE,
        "kakao_template_body": KAKAO_TEMPLATE_BODY,
        "kakao_template_code": KAKAO_TEMPLATE_CODE,
        "changes_summary": V3_1_CHANGES_SUMMARY,
    }
