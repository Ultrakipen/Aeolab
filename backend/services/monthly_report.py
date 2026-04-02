"""
월간 성장 리포트 서비스
매월 1일 오전 9시 실행 — 이전 달 성과 집계 후 카카오 알림 발송
"""
import logging
from datetime import date, timedelta
from calendar import monthrange

logger = logging.getLogger("aeolab")


async def collect_monthly_stats(supabase, business_id: str, year: int, month: int) -> dict:
    """이전 달 성과 집계: 점수 변화 / 스캔 횟수 / AI 인용 횟수 반환."""
    # 대상 월의 첫날·마지막날
    first_day = date(year, month, 1).isoformat()
    last_day = date(year, month, monthrange(year, month)[1]).isoformat()
    next_month_first = (date(year, month, monthrange(year, month)[1]) + timedelta(days=1)).isoformat()

    # 점수 변화: 해당 월 첫 번째 vs 마지막 날 score_history
    first_score_row = (
        supabase.table("score_history")
        .select("total_score")
        .eq("business_id", business_id)
        .gte("score_date", first_day)
        .lte("score_date", last_day)
        .order("score_date", desc=False)
        .limit(1)
        .execute()
        .data or []
    )
    last_score_row = (
        supabase.table("score_history")
        .select("total_score")
        .eq("business_id", business_id)
        .gte("score_date", first_day)
        .lte("score_date", last_day)
        .order("score_date", desc=True)
        .limit(1)
        .execute()
        .data or []
    )
    score_change = 0.0
    if first_score_row and last_score_row:
        score_change = round(
            float(last_score_row[0]["total_score"]) - float(first_score_row[0]["total_score"]), 1
        )

    # 스캔 횟수: scan_results에서 해당 월 스캔 수
    scan_count_result = (
        supabase.table("scan_results")
        .select("id", count="exact")
        .eq("business_id", business_id)
        .gte("scanned_at", first_day + "T00:00:00")
        .lt("scanned_at", next_month_first + "T00:00:00")
        .execute()
    )
    scan_count = scan_count_result.count or 0

    # AI 인용 횟수: ai_citations에서 해당 월 언급 건수
    citation_count_result = (
        supabase.table("ai_citations")
        .select("id", count="exact")
        .eq("business_id", business_id)
        .eq("mentioned", True)
        .gte("created_at", first_day + "T00:00:00")
        .lt("created_at", next_month_first + "T00:00:00")
        .execute()
    )
    citation_count = citation_count_result.count or 0

    return {
        "score_change": score_change,
        "scan_count": scan_count,
        "citation_count": citation_count,
    }


async def send_monthly_growth_report_to_all():
    """활성 구독자 전체 월간 성장 리포트 발송 (매월 1일 오전 9시).

    이전 달 성과(점수 변화 / 스캔 횟수 / AI 인용)를 집계해 카카오 알림 발송.
    phone 미설정 사용자는 건너뜀. 발송 이력은 notifications 테이블에 저장.
    """
    from db.supabase_client import get_client
    from services.kakao_notify import KakaoNotifier

    try:
        supabase = get_client()
        notifier = KakaoNotifier()

        today = date.today()
        # 이전 달 계산
        if today.month == 1:
            prev_year, prev_month = today.year - 1, 12
        else:
            prev_year, prev_month = today.year, today.month - 1
        month_str = str(prev_month)

        # 활성 구독자 사업장 조회
        subs = (
            supabase.table("subscriptions")
            .select("user_id, plan")
            .eq("status", "active")
            .execute()
            .data or []
        )
        user_ids = list({s["user_id"] for s in subs})
        if not user_ids:
            logger.info("send_monthly_growth_report: 활성 구독자 없음")
            return

        businesses = (
            supabase.table("businesses")
            .select("id, name, user_id")
            .in_("user_id", user_ids)
            .eq("is_active", True)
            .execute()
            .data or []
        )

        sent_count = 0
        skipped_count = 0

        for biz in businesses:
            try:
                biz_id = biz["id"]
                biz_name = biz["name"]
                user_id = biz["user_id"]

                # 전화번호 조회
                profile = (
                    supabase.table("profiles")
                    .select("phone")
                    .eq("id", user_id)
                    .maybe_single()
                    .execute()
                    .data
                )
                phone = (profile or {}).get("phone")
                if not phone:
                    skipped_count += 1
                    continue

                # 이미 이번 달 리포트 발송했으면 스킵 (중복 방지)
                month_start_ts = today.replace(day=1).isoformat() + "T00:00:00"
                already_sent = (
                    supabase.table("notifications")
                    .select("id", count="exact")
                    .eq("user_id", user_id)
                    .eq("type", "monthly_report")
                    .gte("created_at", month_start_ts)
                    .execute()
                )
                if (already_sent.count or 0) > 0:
                    skipped_count += 1
                    continue

                # 이전 달 성과 집계
                stats = await collect_monthly_stats(supabase, biz_id, prev_year, prev_month)

                # 카카오 알림 발송
                await notifier.send_monthly_report(
                    phone=phone,
                    biz_name=biz_name,
                    score_change=stats["score_change"],
                    scan_count=stats["scan_count"],
                    citation_count=stats["citation_count"],
                    month_str=month_str,
                )

                # 발송 이력 저장
                supabase.table("notifications").insert({
                    "user_id": user_id,
                    "type": "monthly_report",
                    "content": {
                        "biz_name": biz_name,
                        "month": month_str,
                        **stats,
                    },
                    "channel": "kakao",
                    "status": "sent",
                }).execute()

                sent_count += 1
                logger.info(f"monthly_report sent: {biz_name} ({month_str}월 score_change={stats['score_change']:+.1f})")

            except Exception as e:
                logger.warning(f"monthly_report failed for biz={biz.get('id')}: {e}")

        logger.info(f"send_monthly_growth_report done: sent={sent_count}, skipped={skipped_count}")

    except Exception as e:
        logger.error(f"send_monthly_growth_report_to_all failed: {e}")
