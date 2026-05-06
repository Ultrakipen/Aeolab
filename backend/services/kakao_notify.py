import httpx
import os
import logging

logger = logging.getLogger("aeolab")

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
    # 사용자 직접 비즈센터 신청 후 환경변수 KAKAO_TEMPLATE_KEYWORD_CHANGE로 override 가능
    "keyword_change":       os.getenv("KAKAO_TEMPLATE_KEYWORD_CHANGE", "AEOLAB_KW_01"),
}


class KakaoNotifier:
    _BASE_TMPL = "https://kakaotalk-bizmessage.api.nhncloudservice.com/alimtalk/v2.3/appkeys/{appkey}"

    @property
    def BASE(self):
        return self._BASE_TMPL.format(appkey=os.getenv("KAKAO_APP_KEY", ""))

    async def send_score_change(
        self, phone: str, biz_name: str, prev: float, curr: float, prev_r: int, curr_r: int
    ):
        sign = "↑" if curr > prev else "↓"
        await self._send(
            phone,
            "score_change",
            {
                "#{사업장명}": biz_name,
                "#{이전점수}": str(prev),
                "#{현재점수}": str(curr),
                "#{변화}": f"{sign}{abs(curr - prev):.1f}",
                "#{이전순위}": str(prev_r),
                "#{현재순위}": str(curr_r),
            },
        )

    async def send_keyword_change(
        self, phone: str, biz_name: str, keyword: str, prev_rank: int, curr_rank: int
    ):
        """키워드 순위 변동 알림 (AEOLAB_KW_01).
        prev/curr_rank: 99=미노출, 그 외 1-based 순위.
        템플릿 신청·승인 후 KAKAO_TEMPLATE_KEYWORD_CHANGE 환경변수로 활성화.
        """
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
            },
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

    async def send_notice(self, phone: str, message: str):
        """관리자 공지 발송"""
        await self._send_raw(phone, f"[AEOlab 공지]\n{message}", template_code="AEOLAB_NOTICE_01")

    async def send_competitor_overtake(
        self, phone: str, biz_name: str, comp_name: str,
        my_score: float, comp_score: float, gap: float,
    ):
        """경쟁사 역전 알림 (템플릿 코드: AEOLAB_COMP_02)"""
        message = (
            f"[AEOlab] {biz_name}\n\n"
            f"경쟁사 '{comp_name}'이(가) AI 검색 점수에서 앞섰습니다!\n\n"
            f"내 점수: {int(my_score)}점\n"
            f"{comp_name}: {int(comp_score)}점 (차이: +{int(gap)}점)\n\n"
            f"지금 바로 개선 가이드를 확인하고 점수를 역전하세요."
        )
        await self._send_raw(phone, message, template_code="AEOLAB_COMP_02")

    async def send_scan_complete(
        self, phone: str, biz_name: str, score: float, grade: str,
        weekly_change: float, top_platform: str, top_improvement: str,
    ):
        """스캔 완료 즉시 알림 (템플릿 코드: AEOLAB_SCAN_01)"""
        change_sign = "+" if weekly_change > 0 else ""
        change_emoji = "📈" if weekly_change > 0 else "📉" if weekly_change < 0 else "➡️"
        message = (
            f"[AEOlab] {biz_name} AI 스캔 완료\n\n"
            f"📊 현재 점수: {int(score)}점 ({grade}등급)\n"
            f"{change_emoji} 지난주 대비: {change_sign}{weekly_change:.1f}점\n"
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
        self, phone: str, biz_name: str, rating: int, review_excerpt: str
    ):
        """별점 2점 이하 리뷰 긴급 알림 (템플릿 코드: AEOLAB_ALERT_01)"""
        app_key = os.getenv("KAKAO_APP_KEY", "")
        if not app_key:
            masked = f"{phone[:3]}****{phone[-2:]}" if len(phone) >= 5 else "***"
            logger.warning(f"send_low_rating_alert skipped (KAKAO_APP_KEY 미설정): {masked}")
            return
        excerpt_short = review_excerpt[:50] if review_excerpt else "(내용 없음)"
        message = (
            f"[AEOlab] {biz_name}\n\n"
            f"별점 {rating}점 리뷰가 등록됐습니다.\n\n"
            f"내용: {excerpt_short}\n\n"
            f"빠른 답변으로 신뢰를 지키세요.\n"
            f"스마트플레이스에서 답변하기 →"
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
        change_sign = "+" if score_change >= 0 else ""
        message = (
            f"[AEOlab] {month_str}월 성장 리포트\n"
            f"사업장: {biz_name}\n\n"
            f"📊 AI 가시성 점수: {change_sign}{score_change:.1f}점\n"
            f"🔍 스캔 횟수: {scan_count}회\n"
            f"💬 AI 인용: {citation_count}건\n\n"
            f"전체 리포트 보기 →\n"
            f"https://aeolab.co.kr/dashboard"
        )
        await self._send_raw(phone, message, template_code="AEOLAB_MONTHLY_01")

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
        self, phone: str, biz_name: str, prev_stage: str, curr_stage: str, track1_score: float
    ):
        """성장 단계 업그레이드 알림 — AEOLAB_SCORE_01 템플릿 재활용"""
        stage_labels = {
            "survival": "생존기", "stable": "안정기",
            "growth": "성장기", "dominance": "지배기",
        }
        prev_label = stage_labels.get(prev_stage, prev_stage)
        curr_label = stage_labels.get(curr_stage, curr_stage)
        await self._send(
            phone,
            "score_change",
            {
                "#{사업장명}": biz_name,
                "#{이전점수}": prev_label,
                "#{현재점수}": curr_label,
                "#{변화}": f"↑ {prev_label} → {curr_label} 단계 상승!",
                "#{이전순위}": "-",
                "#{현재순위}": str(int(track1_score)),
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
            if r.status_code >= 400:
                status = "failed"
                logger.warning(f"Kakao _send_raw failed {r.status_code}: {r.text[:200]}")
            else:
                logger.info(f"Kakao notify -> {masked}: {text[:50]}...")
        except Exception as e:
            status = "failed"
            logger.warning(f"Kakao _send_raw error: {e}")
        finally:
            self._log_notification(None, "notice", {"phone": masked, "text": text[:200]}, status)

    async def _send(self, phone: str, ttype: str, params: dict):
        app_key = os.getenv("KAKAO_APP_KEY", "")
        if not app_key:
            masked = f"{phone[:3]}****{phone[-2:]}" if len(phone) >= 5 else "***"
            logger.warning(f"_send skipped: KAKAO_APP_KEY 미설정 ({masked}, ttype={ttype})")
            self._log_notification(None, ttype, {"phone": masked, **params}, "skipped")
            return None
        status = "sent"
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
            if r.status_code >= 400:
                status = "failed"
                logger.warning(f"Kakao _send failed {r.status_code} ({ttype}): {r.text[:200]}")
            else:
                masked = f"{phone[:3]}****{phone[-2:]}" if len(phone) >= 5 else "***"
                logger.info(f"Kakao notify ({ttype}) -> {masked}")
            return r
        except Exception as e:
            status = "failed"
            logger.warning(f"Kakao send failed ({ttype}): {e}")
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
        diff = round(current_score - prev_score, 1)
        direction = "▲" if diff > 0 else ("▼" if diff < 0 else "→")
        abs_diff = abs(diff)

        message = (
            f"[AEOlab 주간 성적표]\n"
            f"{business_name}\n\n"
            f"이번 주 AI 노출 점수: {int(current_score)}점 ({direction}{abs_diff})\n\n"
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
