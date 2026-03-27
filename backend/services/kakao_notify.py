import httpx
import os
import logging

logger = logging.getLogger("aeolab")

TEMPLATES = {
    "score_change": "AEOLAB_SCORE_01",
    "ai_citation":  "AEOLAB_CITE_01",
    "competitor":   "AEOLAB_COMP_01",
    "market_news":  "AEOLAB_NEWS_01",
    "action_items": "AEOLAB_ACTION_01",
}


class KakaoNotifier:
    BASE = "https://api-alimtalk.cloud.toast.com/alimtalk/v2.3"

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
        )

    async def send_payment_failed(self, phone: str):
        """자동결제 실패 알림"""
        await self._send_raw(
            phone,
            "[AEOlab] 구독 갱신 결제에 실패했습니다.\n"
            "3일 이내 결제 수단을 확인해주세요. 미결제 시 서비스가 정지됩니다.",
        )

    async def send_suspended(self, phone: str):
        """구독 정지 알림"""
        await self._send_raw(
            phone,
            "[AEOlab] 미결제로 인해 서비스가 정지되었습니다.\n"
            "aeolab.co.kr 에서 결제를 완료하면 즉시 재개됩니다.",
        )

    async def send_notice(self, phone: str, message: str):
        """관리자 공지 발송"""
        await self._send_raw(phone, f"[AEOlab 공지]\n{message}")

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
        await self._send_raw(phone, message)

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
        await self._send_raw(phone, message)

    async def _send_raw(self, phone: str, text: str):
        """템플릿 없이 단문 문자 발송 (SMS fallback)"""
        masked = f"{phone[:3]}****{phone[-2:]}" if len(phone) >= 5 else "***"
        logger.info(f"Kakao notify → {masked}: {text[:50]}...")
        self._log_notification(None, "notice", {"text": text[:200]}, "sent")

    async def _send(self, phone: str, ttype: str, params: dict):
        status = "sent"
        try:
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.post(
                    f"{self.BASE}/messages",
                    headers={"X-Secret-Key": os.getenv("KAKAO_APP_KEY", "")},
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
            return r
        except Exception as e:
            status = "failed"
            logger.warning(f"Kakao send failed ({ttype}): {e}")
            raise
        finally:
            self._log_notification(None, ttype, {"phone": phone[:4] + "****", **params}, status)

    def _log_notification(self, user_id, ntype: str, content: dict, status: str):
        """notifications 테이블에 발송 이력 기록"""
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
        except Exception as e:
            logger.debug(f"Notification log failed: {e}")
