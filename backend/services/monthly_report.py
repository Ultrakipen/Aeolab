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
        .select("total_score, score_date")
        .not_.is_("total_score", "null")  # 순위 측정만 기록한 행(total_score NULL)은 비교 대상 아님
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
        .select("total_score, score_date")
        .not_.is_("total_score", "null")  # 순위 측정만 기록한 행(total_score NULL)은 비교 대상 아님
        .eq("business_id", business_id)
        .gte("score_date", first_day)
        .lte("score_date", last_day)
        .order("score_date", desc=True)
        .limit(1)
        .execute()
        .data or []
    )
    # None = '비교할 수 없다'. 예전에는 0.0이라 기록이 없거나 한 건뿐인 달도 "변동 없음"이라는 거짓 단정이 나갔다.
    # 비교하려면 날짜가 다른 두 점수가 있어야 하고, 두 끝 스캔 모두 네이버 측정이 성공했어야 한다
    # (측정 빠진 날은 항목이 제외·재정규화돼 척도가 다르다 — services/change_signal_guard). 확인하지 못해도 비교하지 않는다.
    score_change = None
    if first_score_row and last_score_row and first_score_row[0].get("score_date") != last_score_row[0].get("score_date"):
        from services.change_signal_guard import window_comparison_unmeasured
        _unmeasured = await window_comparison_unmeasured(
            supabase, business_id, first_day + "T00:00:00", until_iso=next_month_first + "T00:00:00",
        )
        if _unmeasured is False:
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
                    .select("phone, kakao_scan_notify")
                    .eq("user_id", user_id)
                    .maybe_single()
                    .execute()
                    .data
                )
                phone = (profile or {}).get("phone")
                if not phone:
                    skipped_count += 1
                    continue
                # 사용자가 설정에서 알림을 끈 경우는 보내지 않는다 — 같은 알림을 보내는 monthly_report_notify와 다른 알림 잡들은 이미 이 설정을 따랐는데
                # 이 잡만 번호만 있으면 보냈다. 명시적 True가 아니면 보내지 않는다(미설정 NULL은 꺼짐 — 옵트인, 2026-11-02 통일).
                if (profile or {}).get("kakao_scan_notify") is not True:
                    skipped_count += 1
                    continue

                # 이미 이번 달 리포트 발송했으면 스킵 (중복 방지)
                month_start_ts = today.replace(day=1).isoformat() + "T00:00:00"
                already_sent = (
                    supabase.table("notifications")
                    .select("id", count="exact")
                    .eq("user_id", user_id)
                    .eq("type", "monthly_report")
                    .eq("status", "sent")      # 전달 실패(failed) 기록은 '보냈다'가 아니다 — monthly_report_notify의 중복 방지와 같은 기준
                    .gte("created_at", month_start_ts)
                    .execute()
                )
                if (already_sent.count or 0) > 0:
                    skipped_count += 1
                    continue

                # 이전 달 성과 집계
                stats = await collect_monthly_stats(supabase, biz_id, prev_year, prev_month)

                # 카카오 알림 발송
                delivered = await notifier.send_monthly_report(
                    phone=phone,
                    biz_name=biz_name,
                    score_change=stats["score_change"],
                    scan_count=stats["scan_count"],
                    citation_count=stats["citation_count"],
                    month_str=month_str,
                )

                # 발송 이력 저장 — 실제로 전달된 경우에만 'sent'로 기록한다(지침 9). 이 기록이 '이미 이번 달에 보냈다'는 중복 방지의 근거이므로
                # 실패를 sent로 남기면 재시도(monthly_report_notify)도 막힌다.
                supabase.table("notifications").insert({
                    "user_id": user_id,
                    "type": "monthly_report",
                    "content": {
                        "biz_name": biz_name,
                        "month": month_str,
                        **stats,
                    },
                    "channel": "kakao",
                    "status": "sent" if delivered else "failed",
                }).execute()

                if not delivered:
                    skipped_count += 1
                    logger.warning(f"monthly_report 전달 실패(기록은 failed): {biz_name}")
                    continue
                sent_count += 1
                _sc = stats["score_change"]
                logger.info(f"monthly_report sent: {biz_name} ({month_str}월 score_change={'비교 불가' if _sc is None else format(_sc, '+.1f')})")

            except Exception as e:
                logger.warning(f"monthly_report failed for biz={biz.get('id')}: {e}")

        logger.info(f"send_monthly_growth_report done: sent={sent_count}, skipped={skipped_count}")

    except Exception as e:
        logger.error(f"send_monthly_growth_report_to_all failed: {e}")
