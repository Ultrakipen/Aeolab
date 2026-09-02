import httpx
import os
import logging
from datetime import date

logger = logging.getLogger("aeolab")


# ── 점수 → 텍스트 등급 변환 헬퍼 ────────────────────────────────────────────
def _grade(score: float) -> str:
    """점수를 사용자 친화적 등급 텍스트로 변환."""
    if score >= 80: return "우수"
    if score >= 60: return "양호"
    if score >= 40: return "보통"
    return "개선 필요"


def _grade_label(score: float, rank: int = 0) -> str:
    """등급 + 순위 조합 레이블. rank=0이면 등급만."""
    g = _grade(score)
    if rank > 0:
        return f"{g} · 업종 {rank}위"
    return g


def _grade_change(prev: float, curr: float) -> str:
    """등급 변화 방향 텍스트."""
    pg, cg = _grade(prev), _grade(curr)
    if pg != cg and curr > prev:
        return f"↑ {pg} → {cg} 한 단계 성장!"
    if curr > prev:
        return f"↑ {cg} 등급 내 상승"
    if curr < prev:
        return f"↓ {pg} 등급 하락 — 점검 권장"
    return "→ 변동 없음"

# ── 카카오 알림톡 실패 시 이메일 fallback (AEOLAB_SCORE_01 우선 적용) ─────────
# 카카오 템플릿 코드 → 이메일 제목/본문 매핑
# 본문 템플릿 변수: {user_name}, {score_before}, {score_after}, {biz_name}
EMAIL_TEMPLATES: dict[str, dict] = {
    "AEOLAB_SCORE_01": {
        "subject": "[AEOlab] {biz_name} 점수 변화 알림",
        "body_template": (
            "<div style='font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1e293b;'>"
            "<h2 style='color:#1d4ed8;margin-bottom:8px;'>{biz_name} AI 노출 점수 변화</h2>"
            "<p style='font-size:16px;'>상태가 <strong>{score_before}</strong> → "
            "<strong style='color:#16a34a;'>{score_after}</strong>(으)로 변동했습니다.</p>"
            "<p style='font-size:13px;color:#64748b;'>자세한 내용은 대시보드에서 확인하세요.<br>"
            "<a href='https://aeolab.co.kr/dashboard'>https://aeolab.co.kr/dashboard</a></p>"
            "<hr style='border:none;border-top:1px solid #e2e8f0;margin:20px 0;'>"
            "<p style='font-size:11px;color:#94a3b8;'>카카오 알림톡 발송 실패로 이메일로 대체 발송됩니다.<br>"
            "AEOlab · contact@aeolab.co.kr</p>"
            "</div>"
        ),
    },
}


async def _email_fallback(
    user_id: str,
    template_code: str,
    payload: dict,
) -> None:
    """카카오 알림톡 발송 실패 시 이메일로 대체 발송.

    현재 AEOLAB_SCORE_01 템플릿만 지원. 나머지 4종은 다음 스프린트.
    실패 시 logger.warning만 남기고 호출자에 예외 전파하지 않음.
    """
    tmpl = EMAIL_TEMPLATES.get(template_code)
    if not tmpl:
        logger.debug("[email_fallback] template %s 미지원 — fallback 건너뜀", template_code)
        return

    # profiles 테이블에서 이메일 조회
    try:
        from db.supabase_client import get_client
        supabase = get_client()
        prof = supabase.table("profiles").select("email").eq("user_id", user_id).maybe_single().execute()
        to_email = (prof.data or {}).get("email") if (prof and prof.data) else None
        if not to_email:
            # profiles.email 없으면 auth.users 조회 (supabase admin API)
            try:
                from db.supabase_client import get_service_client
                service_sb = get_service_client()
                user_info = service_sb.auth.admin.get_user_by_id(user_id)
                to_email = (user_info.user.email if user_info and user_info.user else None)
            except Exception as _auth_e:
                logger.warning("[email_fallback] auth.users 이메일 조회 실패: %s", _auth_e)
    except Exception as db_e:
        logger.warning("[email_fallback] profiles 이메일 조회 실패: %s", db_e)
        return

    if not to_email:
        logger.warning("[email_fallback] user_id=%s 이메일 없음 — fallback 불가", user_id)
        return

    # 이메일 제목·본문 렌더링
    biz_name = payload.get("#{사업장명}", "")
    score_before = payload.get("#{이전점수}", "")
    score_after = payload.get("#{현재점수}", "")
    subject = tmpl["subject"].format(biz_name=biz_name)
    html_body = tmpl["body_template"].format(
        biz_name=biz_name,
        score_before=score_before,
        score_after=score_after,
        user_name=biz_name,
    )

    # 이메일 발송 (email_sender.send_email 사용)
    try:
        from services.email_sender import send_email, _mask_email
        sent = await send_email(to=to_email, subject=subject, html=html_body)
        if sent:
            logger.info(
                "[email_fallback] 발송 완료: to=%s template=%s",
                _mask_email(to_email), template_code,
            )
            # notifications 테이블에 email_fallback 채널로 기록
            try:
                supabase.table("notifications").insert({
                    "user_id": user_id,
                    "type": "score_change",
                    "content": {"template": template_code, **payload},
                    "channel": "email_fallback",
                    "status": "sent",
                }).execute()
            except Exception as log_e:
                logger.debug("[email_fallback] notifications 기록 실패: %s", log_e)
        else:
            logger.warning("[email_fallback] 발송 실패: to=%s template=%s", _mask_email(to_email), template_code)
    except Exception as send_e:
        logger.warning("[email_fallback] send_email 예외: %s", send_e)


TEMPLATES = {
    "score_change":         "AEOLAB_SCORE_01",
    "ai_citation":          "AEOLAB_CITE_01",
    "competitor":           "AEOLAB_COMP_01",
    "market_news":          "AEOLAB_NEWS_01",
    "action_items":         "AEOLAB_ACTION_01",
    "competitor_overtake":  "AEOLAB_COMP_02",
    "scan_complete":        "AEOLAB_SCAN_01",
    "low_rating_alert":     "AEOLAB_ALERT_01",
    "monthly_report":       "AEOLAB_MONTHLY_01",
    "growth_stage_up":      "AEOLAB_GROWTH_01",
    "notice":               "AEOLAB_NOTICE_01",
    # v3.1 키워드 변동 알림 (service_unification_v1.0.md §4.5)
    # 비즈센터 신청·승인 후 환경변수 KAKAO_TEMPLATE_KEYWORD_CHANGE 설정 필요. 미설정 시 "" → graceful skip
    "keyword_change":       os.getenv("KAKAO_TEMPLATE_KEYWORD_CHANGE", ""),
}


class KakaoNotifier:
    _BASE_TMPL = "https://kakaotalk-bizmessage.api.nhncloudservice.com/alimtalk/v2.3/appkeys/{appkey}"

    @property
    def BASE(self):
        return self._BASE_TMPL.format(appkey=os.getenv("KAKAO_APP_KEY", ""))

    async def send_score_change(
        self, phone: str, biz_name: str, prev: float, curr: float, prev_r: int, curr_r: int,
        user_id: str | None = None,
    ):
        """점수 변화 알림. 점수 수치 대신 등급+순위 텍스트로 발송."""
        await self._send(
            phone,
            "score_change",
            {
                "#{사업장명}": biz_name,
                "#{이전점수}": _grade_label(prev, prev_r),
                "#{현재점수}": _grade_label(curr, curr_r),
                "#{변화}": _grade_change(prev, curr),
                "#{이전순위}": str(prev_r) if prev_r else "-",
                "#{현재순위}": str(curr_r) if curr_r else "-",
            },
            user_id=user_id,
        )

    async def send_keyword_change(
        self, phone: str, biz_name: str, keyword: str, prev_rank: int, curr_rank: int
    ):
        """키워드 순위 변동 알림 (AEOLAB_KW_01).
        prev/curr_rank: 99=미노출, 그 외 1-based 순위.
        KAKAO_TEMPLATE_KEYWORD_CHANGE 미설정 시 graceful skip (비즈센터 승인 전).
        """
        template_code = TEMPLATES.get("keyword_change", "")
        if not template_code:
            logger.debug("[keyword_change] graceful skip — KAKAO_TEMPLATE_KEYWORD_CHANGE 미설정")
            return
        def _fmt(r: int) -> str:
            return "미노출" if r >= 99 else f"{r}위"
        delta = prev_rank - curr_rank  # 양수=상승
        sign = "↑" if delta > 0 else ("↓" if delta < 0 else "→")
        await self._send(
            phone,
            "keyword_change",  # 템플릿 키 (실제 ID는 _send 내부 매핑)
            {
                "#{사업장명}": biz_name,
                "#{키워드}": keyword[:20],
                "#{이전순위}": _fmt(prev_rank),
                "#{현재순위}": _fmt(curr_rank),
                "#{변화}": f"{sign}{abs(delta)}" if delta else "변동 없음",
            },
        )

    async def send_ai_citation(
        self, phone: str, biz_name: str, platform: str, query: str, excerpt: str
    ):
        await self._send(
            phone,
            "ai_citation",
            {
                "#{사업장명}": biz_name,
                "#{AI플랫폼}": platform,
                "#{검색어}": query,
                "#{인용내용}": excerpt[:50],
                "#{확인일시}": date.today().strftime("%Y-%m-%d"),
            },
        )

    async def send_competitor_change(self, phone: str, biz_name: str, comp_name: str, rank_change: int):
        await self._send(
            phone,
            "competitor",
            {
                "#{사업장명}": biz_name,
                "#{경쟁사명}": comp_name,
                "#{순위변화}": str(rank_change),
                "#{확인일시}": date.today().strftime("%Y-%m-%d"),
            },
        )

    async def send_action_items(self, phone: str, biz_name: str, items: list):
        items_text = "\n".join(f"• {item}" for item in items[:3])
        await self._send(
            phone,
            "action_items",
            {
                "#{사업장명}": biz_name,
                "#{할일목록}": items_text,
                "#{기준일}": date.today().strftime("%Y-%m-%d"),
            },
        )

    async def send_post_remind(self, phone: str, biz_name: str, days: int = 14):
        """소식 N일 미작성 알림 (action_items 템플릿 재활용).

        AI 브리핑 적시성(Timeliness) 점수 유지 환기 — 14일 미작성 시 발송.
        """
        await self.send_action_items(
            phone,
            biz_name,
            [
                f"스마트플레이스 소식이 {days}일 동안 미작성입니다",
                "AI 브리핑 적시성 점수 유지를 위해 이번 주 1건 등록 권장",
                "메뉴 변경·이벤트·시즌 추천 중 하나로 작성하세요",
            ],
        )

    async def send_market_news(self, phone: str, biz_name: str, category: str, news: str):
        await self._send(
            phone,
            "market_news",
            {
                "#{사업장명}": biz_name,
                "#{업종}": category,
                "#{시장동향}": news[:100],
            },
        )

    async def send_expire_warning(self, phone: str, plan: str, days_left: int):
        """구독 만료 D-7 알림"""
        await self._send_raw(
            phone,
            f"[AEOlab] {plan.upper()} 구독이 {days_left}일 후 만료됩니다.\n"
            f"자동 갱신이 설정된 경우 카드에서 결제됩니다.",
            template_code="AEOLAB_NOTICE_01",
        )

    async def send_payment_failed(self, phone: str):
        """자동결제 실패 알림"""
        await self._send_raw(
            phone,
            "[AEOlab] 구독 갱신 결제에 실패했습니다.\n"
            "3일 이내 결제 수단을 확인해주세요. 미결제 시 서비스가 정지됩니다.",
            template_code="AEOLAB_NOTICE_01",
        )

    async def send_suspended(self, phone: str):
        """구독 정지 알림"""
        await self._send_raw(
            phone,
            "[AEOlab] 미결제로 인해 서비스가 정지되었습니다.\n"
            "aeolab.co.kr 에서 결제를 완료하면 즉시 재개됩니다.",
            template_code="AEOLAB_NOTICE_01",
        )

    async def send_payment_recovered(self, phone: str):
        """유예 기간 중 자동결제 재시도 성공 알림"""
        await self._send_raw(
            phone,
            "[AEOlab] 결제가 정상 처리되어 구독이 계속 유지됩니다.\n"
            "이용해 주셔서 감사합니다.",
            template_code="AEOLAB_NOTICE_01",
        )

    async def send_notice(self, phone: str, message: str):
        """관리자 공지 발송"""
        await self._send_raw(phone, f"[AEOlab 공지]\n{message}", template_code="AEOLAB_NOTICE_01")

    async def send_price_increase_notice(self, phone: str, regular_price: int):
        """첫 달 50% 할인 종료 D-3 사전고지 (legal_compliance_and_infra_resilience_audit_v1.0.md B축 P1).

        전자상거래법 시행령 — 정기결제 대금 증액 시 그 증액 시점 임박 시 별도 고지 의무.
        가입 시점 1회 안내(PayButton.tsx)만으로는 이 요건을 충족하는지 해석이 갈려
        실무 관행에 따라 증액 3일 전 별도 알림을 추가한다.
        """
        await self._send_raw(
            phone,
            f"[AEOlab] 3일 후부터 정상가 월 {regular_price:,}원으로 자동 결제됩니다.\n"
            f"첫 달 50% 할인 기간이 종료됩니다. 해지를 원하시면 설정 페이지에서 미리 처리해주세요.",
            template_code="AEOLAB_NOTICE_01",
        )

    async def send_subscription_cancelled(self, phone: str, refunded: bool, refund_amount: int | None = None):
        """구독 해지 완료 알림 (7일 이내 자동환불 여부에 따라 문구 분기)"""
        if refunded:
            amount_str = f"{refund_amount:,}원" if refund_amount else "결제하신 금액"
            message = (
                "[AEOlab] 구독 해지 및 전액 환불이 완료되었습니다.\n"
                f"환불 금액: {amount_str}\n"
                "영업일 기준 3~5일 내 결제하신 수단으로 환불됩니다."
            )
        else:
            message = (
                "[AEOlab] 구독 해지가 완료되었습니다.\n"
                "현재 결제 기간 만료일까지 서비스를 계속 이용하실 수 있습니다."
            )
        await self._send_raw(phone, message, template_code="AEOLAB_NOTICE_01")

    async def send_competitor_overtake(
        self, phone: str, biz_name: str, comp_name: str,
        my_score: float, comp_score: float, gap: float,
    ):
        """경쟁사 역전 알림 (템플릿 코드: AEOLAB_COMP_02)"""
        gap_note = "근소한 차이로" if gap < 10 else "큰 격차로"
        message = (
            f"[AEOlab] {biz_name}\n\n"
            f"해당 메시지는 고객님께서 가입하신 AEOlab AI 노출 모니터링의 경쟁사 비교 알림으로, "
            f"경쟁사가 AI 검색 노출에서 앞선 것이 확인될 경우 발송됩니다.\n\n"
            f"경쟁사 '{comp_name}'이(가) AI 검색에서 앞섰습니다!\n\n"
            f"내 등급: {_grade(my_score)}\n"
            f"{comp_name}: {_grade(comp_score)} ({gap_note} 앞서고 있어요)\n\n"
            f"지금 바로 개선 가이드를 확인하고 역전하세요.\n"
            f"https://aeolab.co.kr/guide"
        )
        await self._send_raw(phone, message, template_code="AEOLAB_COMP_02")

    async def send_scan_complete(
        self, phone: str, biz_name: str, score: float, grade: str,
        weekly_change: float, top_platform: str, top_improvement: str,
    ):
        """스캔 완료 즉시 알림 (템플릿 코드: AEOLAB_SCAN_01)"""
        curr_grade = _grade(score)
        change_emoji = "📈" if weekly_change > 0 else "📉" if weekly_change < 0 else "➡️"
        grade_change_note = (
            f"({grade} → {curr_grade})" if grade and grade != curr_grade else ""
        )
        message = (
            f"[AEOlab] {biz_name} AI 스캔 완료\n\n"
            f"해당 메시지는 고객님께서 설정에서 켜신 스캔 완료 알림으로, AI 검색 노출 스캔이 완료될 경우 발송됩니다.\n\n"
            f"📊 AI 노출 등급: {curr_grade} {grade_change_note}\n"
            f"{change_emoji} 지난주 대비: {_grade_change(score - weekly_change, score)}\n"
            f"✅ {top_platform}에서 가장 많이 언급됨\n"
            f"💡 {top_improvement}\n\n"
            f"aeolab.co.kr 에서 자세한 결과 확인"
        )
        await self._send_raw(phone, message, template_code="AEOLAB_SCAN_01")

    async def send_gap_card_url(self, phone: str, biz_name: str, card_url: str):
        """주간 갭 카드 PNG URL 알림 — 카카오톡 공유 유도"""
        message = (
            f"[AEOlab] {biz_name} 이번 주 경쟁 현황\n\n"
            f"📊 AI 경쟁 순위 카드가 생성되었습니다.\n\n"
            f"▼ 카드 보기 (카카오톡으로 공유 가능)\n"
            f"{card_url}\n\n"
            f"같은 상권 사장님들과 공유해보세요."
        )
        await self._send_raw(phone, message, template_code="AEOLAB_NOTICE_01")

    async def send_low_rating_alert(
        self, phone: str, biz_name: str, rating: int, review_excerpt: str, review_url: str = ""
    ):
        """별점 2점 이하 리뷰 긴급 알림 (템플릿 코드: AEOLAB_ALERT_01)"""
        app_key = os.getenv("KAKAO_APP_KEY", "")
        if not app_key:
            masked = f"{phone[:3]}****{phone[-2:]}" if len(phone) >= 5 else "***"
            logger.warning(f"send_low_rating_alert skipped (KAKAO_APP_KEY 미설정): {masked}")
            return
        excerpt_short = review_excerpt[:50] if review_excerpt else "(내용 없음)"
        link = review_url or "https://smartplace.naver.com"
        message = (
            f"[AEOlab] {biz_name}\n\n"
            f"별점 {rating}점 리뷰가 등록됐습니다.\n\n"
            f"내용: {excerpt_short}\n\n"
            f"빠른 답변으로 신뢰를 지키세요.\n"
            f"스마트플레이스에서 답변하기 → {link}"
        )
        await self._send_raw(phone, message, template_code="AEOLAB_ALERT_01")

    async def send_monthly_report(
        self, phone: str, biz_name: str, score_change: float,
        scan_count: int, citation_count: int, month_str: str,
    ):
        """월간 성장 리포트 알림 (템플릿 코드: AEOLAB_MONTHLY_01)"""
        app_key = os.getenv("KAKAO_APP_KEY", "")
        if not app_key:
            masked = f"{phone[:3]}****{phone[-2:]}" if len(phone) >= 5 else "***"
            logger.warning(f"send_monthly_report skipped (KAKAO_APP_KEY 미설정): {masked}")
            return
        if score_change > 5:
            trend = "뚜렷한 상승세"
        elif score_change > 0:
            trend = "소폭 상승"
        elif score_change == 0:
            trend = "변동 없음"
        elif score_change > -5:
            trend = "소폭 하락"
        else:
            trend = "하락 — 점검 필요"
        message = (
            f"[AEOlab] {month_str}월 성장 리포트\n"
            f"사업장: {biz_name}\n\n"
            f"📊 AI 가시성 변화: {trend}\n"
            f"🔍 스캔 횟수: {scan_count}회\n"
            f"💬 AI 인용: {citation_count}건\n\n"
            f"전체 리포트 보기 →\n"
            f"https://aeolab.co.kr/dashboard"
        )
        await self._send_raw(phone, message, template_code="AEOLAB_MONTHLY_01")

    async def send_delivery_received(
        self, order_id: str, user_phone: str, package_name: str, business_name: str
    ) -> None:
        """대행 서비스 접수 완료 알림 (KAKAO_TEMPLATE_DELIVERY_01).

        결제 확인 후 status → paid 전환 시점에 호출.
        환경변수 KAKAO_TEMPLATE_DELIVERY_01 미설정 시 graceful skip.
        """
        template = os.getenv("KAKAO_TEMPLATE_DELIVERY_01", "")
        if not template:
            _logger.debug("[delivery] send_delivery_received skip — KAKAO_TEMPLATE_DELIVERY_01 미설정")
            return
        app_key = os.getenv("KAKAO_APP_KEY", "")
        if not app_key:
            masked = f"{user_phone[:3]}****{user_phone[-2:]}" if len(user_phone) >= 5 else "***"
            _logger.debug(f"[delivery] send_delivery_received skip — KAKAO_APP_KEY 미설정 ({masked})")
            return
        await self._send_delivery_template(
            phone=user_phone,
            template_code=template,
            params={
                "#{주문번호}": str(order_id)[:20],
                "#{패키지명}": package_name,
                "#{사업장명}": business_name,
            },
            log_tag="delivery_received",
        )

    async def send_delivery_in_progress(
        self,
        order_id: str,
        user_phone: str,
        package_name: str,
        business_name: str,
        expected_days: int = 3,
    ) -> None:
        """대행 서비스 작업 시작 알림 (KAKAO_TEMPLATE_DELIVERY_02).

        관리자가 status → in_progress 전환 시 호출.
        환경변수 KAKAO_TEMPLATE_DELIVERY_02 미설정 시 graceful skip.
        """
        template = os.getenv("KAKAO_TEMPLATE_DELIVERY_02", "")
        if not template:
            _logger.debug("[delivery] send_delivery_in_progress skip — KAKAO_TEMPLATE_DELIVERY_02 미설정")
            return
        app_key = os.getenv("KAKAO_APP_KEY", "")
        if not app_key:
            masked = f"{user_phone[:3]}****{user_phone[-2:]}" if len(user_phone) >= 5 else "***"
            _logger.debug(f"[delivery] send_delivery_in_progress skip — KAKAO_APP_KEY 미설정 ({masked})")
            return
        await self._send_delivery_template(
            phone=user_phone,
            template_code=template,
            params={
                "#{주문번호}": str(order_id)[:20],
                "#{패키지명}": package_name,
                "#{사업장명}": business_name,
                "#{예상일수}": str(expected_days),
            },
            log_tag="delivery_in_progress",
        )

    async def send_delivery_completed(
        self, order_id: str, user_phone: str, package_name: str, business_name: str
    ) -> None:
        """대행 서비스 완료 알림 (KAKAO_TEMPLATE_DELIVERY_03).

        관리자가 status → completed 전환 시 호출.
        환경변수 KAKAO_TEMPLATE_DELIVERY_03 미설정 시 graceful skip.
        """
        template = os.getenv("KAKAO_TEMPLATE_DELIVERY_03", "")
        if not template:
            _logger.debug("[delivery] send_delivery_completed skip — KAKAO_TEMPLATE_DELIVERY_03 미설정")
            return
        app_key = os.getenv("KAKAO_APP_KEY", "")
        if not app_key:
            masked = f"{user_phone[:3]}****{user_phone[-2:]}" if len(user_phone) >= 5 else "***"
            _logger.debug(f"[delivery] send_delivery_completed skip — KAKAO_APP_KEY 미설정 ({masked})")
            return
        await self._send_delivery_template(
            phone=user_phone,
            template_code=template,
            params={
                "#{주문번호}": str(order_id)[:20],
                "#{패키지명}": package_name,
                "#{사업장명}": business_name,
            },
            log_tag="delivery_completed",
        )

    async def send_delivery_rescan(
        self,
        order_id: str,
        user_phone: str,
        business_name: str,
        score_before: float,
        score_after: float,
    ) -> None:
        """대행 완료 후 재스캔 결과 알림 (KAKAO_TEMPLATE_DELIVERY_04).

        작업 완료 후 재스캔 점수가 기록된 시점에 호출.
        환경변수 KAKAO_TEMPLATE_DELIVERY_04 미설정 시 graceful skip.
        """
        template = os.getenv("KAKAO_TEMPLATE_DELIVERY_04", "")
        if not template:
            _logger.debug("[delivery] send_delivery_rescan skip — KAKAO_TEMPLATE_DELIVERY_04 미설정")
            return
        app_key = os.getenv("KAKAO_APP_KEY", "")
        if not app_key:
            masked = f"{user_phone[:3]}****{user_phone[-2:]}" if len(user_phone) >= 5 else "***"
            _logger.debug(f"[delivery] send_delivery_rescan skip — KAKAO_APP_KEY 미설정 ({masked})")
            return
        await self._send_delivery_template(
            phone=user_phone,
            template_code=template,
            params={
                "#{주문번호}": str(order_id)[:20],
                "#{사업장명}": business_name,
                "#{등급변화}": _grade_change(score_before, score_after),
            },
            log_tag="delivery_rescan",
        )

    async def _send_delivery_template(
        self,
        phone: str,
        template_code: str,
        params: dict,
        log_tag: str = "delivery",
    ) -> None:
        """대행 서비스 알림톡 발송 내부 공통 헬퍼.

        _send()와 달리 TEMPLATES dict를 사용하지 않고 template_code를 직접 받음.
        실패 시 _logger.warning 기록 후 silently return (호출자 응답에 영향 없음).
        """
        masked = f"{phone[:3]}****{phone[-2:]}" if len(phone) >= 5 else "***"
        status = "sent"
        try:
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.post(
                    f"{self.BASE}/messages",
                    headers={"X-Secret-Key": os.getenv("KAKAO_SECRET_KEY", "")},
                    json={
                        "senderKey": os.getenv("KAKAO_SENDER_KEY", ""),
                        "templateCode": template_code,
                        "recipientList": [
                            {"recipientNo": phone, "templateParameter": params}
                        ],
                    },
                )
            body_ok = True
            if r.status_code < 400:
                try:
                    body_ok = r.json().get("header", {}).get("isSuccessful", True)
                except Exception:
                    body_ok = True
            if r.status_code >= 400 or not body_ok:
                status = "failed"
                logger.warning(
                    f"[{log_tag}] 알림톡 발송 실패 {r.status_code} "
                    f"({masked}, template={template_code}): {r.text[:200]}"
                )
            else:
                logger.info(f"[{log_tag}] 알림톡 발송 완료 → {masked}")
        except Exception as e:
            status = "failed"
            logger.warning(f"[{log_tag}] 알림톡 발송 오류 ({masked}): {e}")
        finally:
            self._log_notification(
                None,
                log_tag,
                {"phone": masked, **{k: v for k, v in params.items() if "전화" not in k}},
                status,
            )

    async def send_text(self, phone: str, message: str):
        """단문 텍스트 알림 발송 (SMS fallback)"""
        await self._send_raw(phone, message, template_code="AEOLAB_NOTICE_01")


    async def send_first_exposure(
        self,
        phone: str,
        biz_name: str,
        platform: str = "네이버 AI 브리핑",
    ) -> bool:
        """처음으로 AI에 노출됐을 때 알림 — AEOLAB_CITE_01 재활용"""
        try:
            await self._send(
                phone,
                "ai_citation",
                {
                    "#{사업장명}": biz_name,
                    "#{AI플랫폼}": platform,
                    "#{검색어}": "AI 검색",
                    "#{인용내용}": "처음으로 AI 검색에 노출됐습니다. 스마트플레이스 최적화 효과!",
                },
            )
            return True
        except Exception as e:
            masked = f"{phone[:3]}****{phone[-2:]}" if len(phone) >= 5 else "***"
            logger.warning(f"send_first_exposure 실패 ({masked}): {e}")
            return False

    async def send_growth_stage_upgrade(
        self, phone: str, biz_name: str, prev_stage: str, curr_stage: str, this_week_action: str = ""
    ):
        """성장 단계 업그레이드 알림 (템플릿 코드: AEOLAB_GROWTH_01)

        prev_stage/curr_stage: 호출측(jobs.py)에서 이미 한글 레이블(생존기/안정기/성장기/지배기)로 전달됨.
        this_week_action: 이번 주 추천 액션(gap_analyzer._build_growth_stage 반환값) — 숫자 아님.
        """
        await self._send(
            phone,
            "growth_stage_up",
            {
                "#{사업장명}": biz_name,
                "#{이전단계}": prev_stage,
                "#{현재단계}": curr_stage,
                "#{이번주추천}": this_week_action or "대시보드에서 맞춤 개선 가이드를 확인해보세요.",
            },
        )

    async def _send_raw(self, phone: str, text: str, template_code: str = "AEOLAB_NOTICE_01"):
        """알림톡 자유 메시지 발송 (SMS fallback 포함)

        NHN Cloud 알림톡 API v2.3: resendType=SMS로 템플릿 미승인 시에도 SMS 대체 발송.
        KAKAO_APP_KEY 미설정 시 skipped 처리 (graceful degradation).
        """
        app_key = os.getenv("KAKAO_APP_KEY", "")
        if not app_key:
            masked = f"{phone[:3]}****{phone[-2:]}" if len(phone) >= 5 else "***"
            logger.warning(f"_send_raw skipped: KAKAO_APP_KEY 미설정 ({masked})")
            self._log_notification(None, "notice", {"text": text[:200]}, "skipped")
            return
        masked = f"{phone[:3]}****{phone[-2:]}" if len(phone) >= 5 else "***"
        status = "sent"
        try:
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.post(
                    f"{self.BASE}/messages",
                    headers={"X-Secret-Key": os.getenv("KAKAO_SECRET_KEY", "")},
                    json={
                        "senderKey": os.getenv("KAKAO_SENDER_KEY", ""),
                        "templateCode": template_code,
                        "recipientList": [{
                            "recipientNo": phone,
                            "content": text,
                            "resendType": "SMS",
                            "resendContent": text[:80],
                        }],
                    },
                )
            body_ok = True
            if r.status_code < 400:
                try:
                    body_ok = r.json().get("header", {}).get("isSuccessful", True)
                except Exception:
                    body_ok = True
            if r.status_code >= 400 or not body_ok:
                status = "failed"
                logger.warning(f"Kakao _send_raw failed {r.status_code}: {r.text[:200]}")
            else:
                logger.info(f"Kakao notify -> {masked}: {text[:50]}...")
        except Exception as e:
            status = "failed"
            logger.warning(f"Kakao _send_raw error: {e}")
        finally:
            self._log_notification(None, "notice", {"phone": masked, "text": text[:200]}, status)

    async def _send(self, phone: str, ttype: str, params: dict, user_id: str | None = None):
        """알림톡 발송. AEOLAB_SCORE_01 실패 시 이메일 fallback 자동 실행.

        Args:
            user_id: 이메일 fallback에 필요한 사용자 ID (None이면 fallback 불가).
        """
        app_key = os.getenv("KAKAO_APP_KEY", "")
        if not app_key:
            masked = f"{phone[:3]}****{phone[-2:]}" if len(phone) >= 5 else "***"
            logger.warning(f"_send skipped: KAKAO_APP_KEY 미설정 ({masked}, ttype={ttype})")
            self._log_notification(None, ttype, {"phone": masked, **params}, "skipped")
            # KAKAO_APP_KEY 미설정 시에도 score_change는 이메일 fallback 시도
            if ttype == "score_change" and user_id:
                template_code = TEMPLATES.get(ttype, "")
                if template_code:
                    await _email_fallback(user_id, template_code, params)
            return None
        status = "sent"
        kakao_failed = False
        try:
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.post(
                    f"{self.BASE}/messages",
                    headers={"X-Secret-Key": os.getenv("KAKAO_SECRET_KEY", "")},
                    json={
                        "senderKey": os.getenv("KAKAO_SENDER_KEY", ""),
                        "templateCode": TEMPLATES[ttype],
                        "recipientList": [
                            {"recipientNo": phone, "templateParameter": params}
                        ],
                    },
                )
            body_ok = True
            if r.status_code < 400:
                try:
                    body_ok = r.json().get("header", {}).get("isSuccessful", True)
                except Exception:
                    body_ok = True
            if r.status_code >= 400 or not body_ok:
                status = "failed"
                kakao_failed = True
                logger.warning(f"Kakao _send failed {r.status_code} ({ttype}): {r.text[:200]}")
                # AEOLAB_SCORE_01 발송 실패 시 이메일 fallback
                if ttype == "score_change" and user_id:
                    template_code = TEMPLATES.get(ttype, "")
                    if template_code:
                        await _email_fallback(user_id, template_code, params)
            else:
                masked = f"{phone[:3]}****{phone[-2:]}" if len(phone) >= 5 else "***"
                logger.info(f"Kakao notify ({ttype}) -> {masked}")
            return r
        except Exception as e:
            status = "failed"
            kakao_failed = True
            logger.warning(f"Kakao send failed ({ttype}): {e}")
            # 예외 발생 시에도 score_change 이메일 fallback
            if ttype == "score_change" and user_id:
                try:
                    template_code = TEMPLATES.get(ttype, "")
                    if template_code:
                        await _email_fallback(user_id, template_code, params)
                except Exception as fb_e:
                    logger.warning("[email_fallback] fallback 예외: %s", fb_e)
            raise
        finally:
            self._log_notification(None, ttype, {"phone": phone[:4] + "****", **params}, status)

    async def send_weekly_score_report(
        self,
        phone: str,
        business_name: str,
        current_score: float,
        prev_score: float,
        top_action: str,
    ) -> bool:
        """주간 성적표 알림 (카카오 알림톡 또는 콘솔 로그)

        매주 월요일 오전 9시 scheduler에서 호출.
        KAKAO_APP_KEY 미설정 시 로그만 남기고 True 반환 (graceful degradation).
        """
        curr_grade = _grade(current_score)
        prev_grade = _grade(prev_score)
        grade_note = f"{prev_grade} → {curr_grade}" if curr_grade != prev_grade else curr_grade
        direction = "▲" if current_score > prev_score else ("▼" if current_score < prev_score else "→")

        message = (
            f"[AEOlab 주간 성적표]\n"
            f"{business_name}\n\n"
            f"해당 메시지는 고객님께서 가입하신 AEOlab AI 노출 모니터링 서비스의 주간 성적표 알림으로, 매주 정기 발송됩니다.\n\n"
            f"이번 주 AI 노출 등급: {grade_note} {direction}\n\n"
            f"이번 주 할 일:\n{top_action}\n\n"
            f"자세한 분석 보기 → https://aeolab.co.kr/dashboard"
        )

        app_key = os.getenv("KAKAO_APP_KEY", "")
        masked = f"{phone[:3]}****{phone[-2:]}" if len(phone) >= 5 else "***"

        if not app_key:
            logger.info(
                "[weekly_report] %s %s → %s점 (%s%s): %s",
                masked, business_name, int(current_score), direction, abs_diff, top_action[:30],
            )
            return True

        try:
            await self._send_raw(phone, message, template_code="AEOLAB_SCORE_01")
            return True
        except Exception as e:
            logger.warning("send_weekly_score_report 실패 (%s): %s", masked, e)
            return False

    async def send_v31_migration(self, phone: str, biz_name: str) -> bool:
        """v3.1 점수 모델 전환 안내 알림톡 (SCORE_MODEL_VERSION=v3_1 토글 ON 시 1회).

        신규 카카오 알림톡 템플릿 승인 전까지 AEOLAB_NOTICE_01 공지 템플릿을 재사용.
        KAKAO_APP_KEY 미설정 시 로그만 남기고 True 반환 (graceful degradation).
        """
        app_key = os.getenv("KAKAO_APP_KEY", "")
        masked = f"{phone[:3]}****{phone[-2:]}" if len(phone) >= 5 else "***"
        message = (
            f"[AEOlab] {biz_name}\n\n"
            f"AI 가시성 점수 모델이 v3.1로 업데이트되었습니다.\n\n"
            f"변경점: 키워드 순위 항목이 추가되어 점수 계산이 더 정밀해졌습니다.\n\n"
            f"키워드 3개 이상 등록 시 다음 측정부터 자동 반영됩니다.\n"
            f"대시보드에서 키워드를 확인하세요.\n\n"
            f"aeolab.co.kr/dashboard"
        )
        if not app_key:
            logger.info("[v31_migration] %s %s: 카카오 미설정 — 로그만 기록", masked, biz_name)
            return True
        try:
            await self._send_raw(phone, message, template_code="AEOLAB_NOTICE_01")
            return True
        except Exception as e:
            logger.warning("send_v31_migration 실패 (%s): %s", masked, e)
            return False

    def _log_notification(self, user_id, ntype: str, content: dict, status: str):
        """notifications 테이블에 발송 이력 기록 (daemon thread로 non-blocking)

        동기 함수이지만 daemon thread에서 DB 호출을 실행하여 async 컨텍스트 블로킹 방지.
        """
        try:
            import threading

            def _do():
                try:
                    from db.supabase_client import get_client
                    supabase = get_client()
                    supabase.table("notifications").insert({
                        "user_id": user_id,
                        "type": ntype,
                        "content": content,
                        "channel": "kakao",
                        "status": status,
                    }).execute()
                except Exception as inner_e:
                    logger.debug(f"Notification log thread failed: {inner_e}")

            threading.Thread(target=_do, daemon=True).start()
        except Exception as e:
            logger.debug(f"Notification log failed: {e}")
