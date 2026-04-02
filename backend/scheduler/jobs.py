import asyncio
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import date, timedelta

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler(timezone="Asia/Seoul")


def start_scheduler():
    scheduler.add_job(daily_scan_all, "cron", hour=2, minute=0, id="daily_scan")
    scheduler.add_job(
        weekly_kakao_notify, "cron", day_of_week="mon", hour=9, id="weekly_notify"
    )
    scheduler.add_job(
        daily_kakao_notify, "cron", hour=9, minute=10, id="daily_notify"
    )
    scheduler.add_job(
        subscription_lifecycle_job, "cron", hour=1, minute=0, id="subscription_lifecycle"
    )
    scheduler.add_job(
        after_screenshot_job, "cron", hour=8, minute=0, id="after_screenshot"
    )
    scheduler.add_job(
        monthly_market_news_job, "cron", day=1, hour=10, minute=0, id="monthly_market_news"
    )
    scheduler.add_job(
        check_competitor_overtake, "cron", hour=3, minute=0, id="competitor_overtake"
    )
    # 인메모리 캐시·SSE 토큰 주기 정리 (10분마다)
    scheduler.add_job(
        _cleanup_memory_stores, "interval", minutes=10, id="memory_cleanup"
    )
    # 경쟁사 리뷰 발췌문 저장 보조 (competitor_scores excerpt 업데이트, 일 1회 오전 4시)
    scheduler.add_job(
        _enrich_competitor_excerpts, "cron", hour=4, minute=0, id="competitor_excerpts"
    )
    # 신규 경쟁사 감지 (월요일 오전 4시)
    scheduler.add_job(
        detect_new_competitors, "cron", day_of_week="mon", hour=4, minute=30,
        id="detect_new_competitors"
    )
    # 리뷰 키워드 알림 (매일 오전 8시)
    scheduler.add_job(
        keyword_alert_job, "cron", hour=8, minute=0, id="keyword_alert"
    )
    # 무료 체험 팔로업 이메일 (매일 오전 10시)
    scheduler.add_job(
        trial_followup_job, "cron", hour=10, minute=0, id="trial_followup"
    )
    # 별점 2점 이하 리뷰 긴급 알림 (6시간마다)
    scheduler.add_job(
        check_low_rating_reviews, "cron", hour="*/6", minute=0, id="low_rating_check"
    )
    # 월간 성장 리포트 자동 발송 (매월 1일 오전 9시)
    scheduler.add_job(
        send_monthly_growth_report, "cron", day=1, hour=9, minute=0, id="monthly_growth_report"
    )
    # 주간 소식 초안 자동 생성 (매주 월요일 오전 9시)
    scheduler.add_job(
        weekly_post_draft_job, "cron", day_of_week="mon", hour=9, minute=0, id="weekly_post_draft"
    )
    # 월간 성장 카드 (매월 말일 오후 6시)
    scheduler.add_job(
        monthly_growth_card_job, "cron", day="last", hour=18, minute=0, id="monthly_growth_card"
    )
    scheduler.start()
    logger.info("Scheduler started")


async def _cleanup_memory_stores():
    """인메모리 TTL 캐시와 만료된 SSE 토큰 주기 정리"""
    try:
        from utils.cache import clear_expired as _clear_cache
        from routers.scan import cleanup_expired_stream_tokens
        n_cache = _clear_cache()
        n_tokens = cleanup_expired_stream_tokens()
        if n_cache or n_tokens:
            logger.debug(f"Memory cleanup: cache={n_cache}, tokens={n_tokens}")
    except Exception as e:
        logger.warning(f"Memory cleanup failed: {e}")


async def daily_scan_all():
    """활성 구독자 사업장 자동 AI 스캔 (새벽 2시)

    플랜별 스캔 전략:
    - basic       : Gemini(100회) + 네이버 매일 / 8개 AI 전체는 월요일만 (비용 절감)
    - pro         : 8개 AI 전체 주 3회(월·수·금) / 나머지 날은 basic 스캔
    - startup/biz/enterprise : 8개 AI 매일
    """
    from db.supabase_client import get_client
    from services.ai_scanner.multi_scanner import MultiAIScanner
    from services.score_engine import calculate_score

    try:
        supabase = get_client()
        today = date.today()
        is_monday = today.weekday() == 0
        is_pro_scan_day = today.weekday() in (0, 2, 4)  # 월·수·금

        businesses = (
            supabase.table("businesses")
            .select("*, subscriptions!inner(status, plan)")
            .eq("subscriptions.status", "active")
            .in_("subscriptions.plan", ["basic", "pro", "biz", "startup", "enterprise"])
            .execute()
            .data
        )

        basic_scanner = MultiAIScanner(mode="basic")
        full_scanner  = MultiAIScanner(mode="full")

        for i, biz in enumerate(businesses):
            try:
                plan = (biz.get("subscriptions") or {}).get("plan", "basic")
                keywords = biz.get("keywords") or []
                query = f"{biz['region']} {biz['category']} 추천"
                if keywords:
                    query = f"{biz['region']} {keywords[0]}"

                # 플랜별 스캐너 선택 (plan_gate.py auto_scan_mode 기준)
                # basic/startup: 평일 → 경량 스캔 / 월요일 → 풀스캔
                # pro:           월·수·금 → 풀스캔 / 나머지 → 경량 스캔
                # biz/enterprise: 매일 풀스캔
                # Perplexity: 비용 절감을 위해 월요일 풀스캔에서만 실행
                if plan in ("basic", "startup") and not is_monday:
                    result = await basic_scanner.scan_basic(query, biz["name"])
                elif plan == "pro" and not is_pro_scan_day:
                    result = await basic_scanner.scan_basic(query, biz["name"])
                elif is_monday:
                    result = await full_scanner.scan_all(query, biz["name"])
                else:
                    result = await full_scanner.scan_all_no_perplexity(query, biz["name"])

                score = calculate_score(result, biz)

                naver_channel = score.get("naver_channel_score")
                global_channel = score.get("global_channel_score")

                scan_row = supabase.table("scan_results").insert(
                    {
                        "business_id": biz["id"],
                        "query_used": query,
                        "gemini_result": result.get("gemini"),
                        "chatgpt_result": result.get("chatgpt"),
                        "perplexity_result": result.get("perplexity"),
                        "grok_result": result.get("grok"),
                        "naver_result": result.get("naver"),
                        "claude_result": result.get("claude"),
                        "google_result": result.get("google"),
                        "exposure_freq": result.get("gemini", {}).get("exposure_freq", 0),
                        "total_score": score["total_score"],
                        "unified_score": score.get("unified_score", score["total_score"]),
                        "track1_score": score.get("track1_score"),
                        "track2_score": score.get("track2_score"),
                        "keyword_coverage": score.get("keyword_coverage") or (score.get("breakdown", {}).get("keyword_gap_score", 0.0) / 100),
                        "score_breakdown": score["breakdown"],
                        "naver_channel_score": naver_channel,
                        "global_channel_score": global_channel,
                    }
                ).execute().data

                # score_history 기록 (30일 추세용)
                today_str = str(date.today())
                prev_history = (
                    supabase.table("score_history")
                    .select("total_score, track1_score")
                    .eq("business_id", biz["id"])
                    .order("score_date", desc=True)
                    .limit(1)
                    .execute()
                    .data
                )
                weekly_change = 0.0
                if prev_history:
                    weekly_change = round(score["total_score"] - prev_history[0]["total_score"], 2)
                supabase.table("score_history").upsert(
                    {
                        "business_id": biz["id"],
                        "score_date": today_str,
                        "total_score": score["total_score"],
                        "unified_score": score.get("unified_score", score["total_score"]),
                        "track1_score": score.get("track1_score"),
                        "track2_score": score.get("track2_score"),
                        "exposure_freq": result.get("gemini", {}).get("exposure_freq", 0),
                        "weekly_change": weekly_change,
                        "naver_channel_score": naver_channel,
                        "global_channel_score": global_channel,
                    },
                    on_conflict="business_id,score_date",
                ).execute()

                # GrowthStage 변화 감지 — 단계 업그레이드 시 로그 + 향후 카카오 알림 연동
                try:
                    from services.gap_analyzer import _build_growth_stage
                    current_stage = _build_growth_stage(score.get("track1_score") or score["total_score"])
                    if prev_history:
                        prev_stage = _build_growth_stage(prev_history[0].get("track1_score") or prev_history[0]["total_score"])
                        if prev_stage.stage != current_stage.stage:
                            logger.info(
                                f"[GrowthStage 변화] {biz['name']}: "
                                f"{prev_stage.stage_label} → {current_stage.stage_label} "
                                f"({prev_history[0]['total_score']:.1f}점 → {score['total_score']:.1f}점)"
                            )
                            # TODO: 카카오 알림톡 승인 후 활성화
                            # phone = (supabase.table("profiles").select("phone")
                            #          .eq("id", biz.get("user_id")).single().execute().data or {}).get("phone")
                            # if phone:
                            #     await notifier.send_growth_stage_upgrade(
                            #         phone, biz["name"],
                            #         prev_stage.stage_label, current_stage.stage_label,
                            #         current_stage.this_week_action,
                            #     )
                except Exception as _ge:
                    logger.warning(f"GrowthStage 감지 실패 (biz={biz.get('name')}): {_ge}")

            except Exception as e:
                logger.error(f"Scan failed for {biz['name']}: {e}")
            finally:
                # Playwright 인스턴스 완전 해제 대기 (OOM 방지)
                await asyncio.sleep(30)
                if i % 5 == 4:
                    # 5개마다 1분 휴식 (메모리 GC 유도)
                    await asyncio.sleep(60)

    except Exception as e:
        logger.error(f"daily_scan_all failed: {e}")


async def _send_kakao_notifications(supabase, notifier, user: dict) -> None:
    """사업장 1개에 대한 카카오 알림 전체 발송 (공통 로직).

    weekly_kakao_notify / daily_kakao_notify 양쪽에서 공유.
    """
    biz_list = user.get("businesses") or []
    if not biz_list:
        return
    biz = biz_list[0]
    biz_id = biz.get("id")
    biz_name = biz.get("name", "")
    phone = (user.get("profiles") or {}).get("phone")

    if not biz_id:
        return

    # 1. 점수 변화 알림
    history = (
        supabase.table("score_history")
        .select("total_score, score_date, rank_in_category")
        .eq("business_id", biz_id)
        .order("score_date", desc=True)
        .limit(2)
        .execute()
        .data
    )
    if len(history) >= 2 and phone:
        curr_h = history[0]
        prev_h = history[1]
        if abs(curr_h["total_score"] - prev_h["total_score"]) > 0:
            await notifier.send_score_change(
                phone, biz_name,
                prev_h["total_score"], curr_h["total_score"],
                prev_h.get("rank_in_category", 0),
                curr_h.get("rank_in_category", 0),
            )

    # 2. AI 인용 실증 알림 (최근 1일 신규 인용 첫 건)
    if phone:
        citations = (
            supabase.table("ai_citations")
            .select("platform, query, excerpt")
            .eq("business_id", biz_id)
            .eq("mentioned", True)
            .gte("created_at", str(date.today() - timedelta(days=1)))
            .limit(1)
            .execute()
            .data
        )
        if citations:
            c = citations[0]
            await notifier.send_ai_citation(
                phone, biz_name,
                c.get("platform", "AI"),
                c.get("query", ""),
                c.get("excerpt", ""),
            )

    # 3. 경쟁사 순위 변화 알림
    if phone:
        latest_scan = (
            supabase.table("scan_results")
            .select("competitor_scores, total_score")
            .eq("business_id", biz_id)
            .order("scanned_at", desc=True)
            .limit(2)
            .execute()
            .data
        )
        if len(latest_scan) >= 2:
            curr_scores = latest_scan[0].get("competitor_scores") or {}
            prev_scores = latest_scan[1].get("competitor_scores") or {}
            for comp_id, curr_data in curr_scores.items():
                prev_data = prev_scores.get(comp_id, {})
                prev_s = prev_data.get("score", 0)
                curr_s = curr_data.get("score", 0)
                if abs(curr_s - prev_s) >= 10:
                    await notifier.send_competitor_change(
                        phone, biz_name,
                        curr_data.get("name", "경쟁사"),
                        int(curr_s - prev_s),
                    )
                    break  # 첫 번째 변화만 알림

    # 4. 이달 할 일 알림 (가이드 최신 항목 3개)
    if phone:
        guide = (
            supabase.table("guides")
            .select("items_json")
            .eq("business_id", biz_id)
            .order("generated_at", desc=True)
            .limit(1)
            .execute()
            .data
        )
        if guide and guide[0].get("items_json"):
            items = guide[0]["items_json"]
            if isinstance(items, list) and items:
                titles = [
                    it.get("title", str(it)) if isinstance(it, dict) else str(it)
                    for it in items[:3]
                ]
                await notifier.send_action_items(phone, biz_name, titles)

    # 5. 갭 카드 PNG 생성 → Storage 업로드 → URL 알림
    try:
        latest_scan = (
            supabase.table("scan_results")
            .select("total_score, competitor_scores, score_breakdown")
            .eq("business_id", biz_id)
            .order("scanned_at", desc=True)
            .limit(1)
            .execute()
            .data
        )
        if latest_scan:
            scan = latest_scan[0]
            my_score = float(scan.get("total_score", 0))
            comp_scores: dict = scan.get("competitor_scores") or {}

            comp_rows = (
                supabase.table("competitors")
                .select("id, name")
                .eq("business_id", biz_id)
                .eq("is_active", True)
                .execute()
                .data
            ) or []
            comp_name_map = {c["id"]: c["name"] for c in comp_rows}
            competitor_items = [
                {"name": comp_name_map.get(cid, "경쟁사"), "score": float(v.get("score", 0))}
                for cid, v in comp_scores.items()
            ]

            breakdown = scan.get("score_breakdown") or {}
            LABELS = {
                "exposure_freq": "Gemini 노출 빈도",
                "review_quality": "리뷰 품질",
                "schema_score": "Schema 구조화",
                "online_mentions": "온라인 언급",
                "info_completeness": "정보 완성도",
                "content_freshness": "콘텐츠 최신성",
            }
            lowest = min(breakdown.items(), key=lambda x: x[1], default=(None, None))
            hint = f"{LABELS.get(lowest[0], '')} 개선 시 점수 상승 예상" if lowest[0] else ""

            from services.gap_card import generate_and_upload_gap_card
            gap_url = await generate_and_upload_gap_card(
                business_id=biz_id,
                business_name=biz_name,
                region=biz.get("region", ""),
                category=biz.get("category", ""),
                my_score=my_score,
                competitor_items=competitor_items,
                hint=hint,
            )
            if gap_url and phone:
                await notifier.send_gap_card_url(phone, biz_name, gap_url)
    except Exception as gap_err:
        logger.warning(f"Gap card generation failed for {biz_name}: {gap_err}")


async def weekly_kakao_notify():
    """Basic 구독자 주간 카카오톡 알림 (월요일 오전 9시)
    Pro+ 구독자는 daily_kakao_notify가 매일 처리.
    """
    from db.supabase_client import get_client
    from services.kakao_notify import KakaoNotifier

    try:
        supabase = get_client()
        notifier = KakaoNotifier()

        users = (
            supabase.table("subscriptions")
            .select("user_id, plan, profiles(phone), businesses(*)")
            .eq("status", "active")
            .in_("plan", ["basic"])
            .execute()
            .data
        )

        for user in users:
            try:
                await _send_kakao_notifications(supabase, notifier, user)
            except Exception as e:
                logger.error(f"Notify failed for user: {e}")

    except Exception as e:
        logger.error(f"weekly_kakao_notify failed: {e}")


async def daily_kakao_notify():
    """Pro/Biz/Enterprise/Startup 구독자 일별 카카오톡 알림 (매일 오전 9시)"""
    from db.supabase_client import get_client
    from services.kakao_notify import KakaoNotifier

    try:
        supabase = get_client()
        notifier = KakaoNotifier()

        users = (
            supabase.table("subscriptions")
            .select("user_id, plan, profiles(phone), businesses(*)")
            .eq("status", "active")
            .in_("plan", ["pro", "biz", "enterprise", "startup"])
            .execute()
            .data
        )

        for user in users:
            try:
                await _send_kakao_notifications(supabase, notifier, user)
            except Exception as e:
                logger.error(f"Daily notify failed for user: {e}")

    except Exception as e:
        logger.error(f"daily_kakao_notify failed: {e}")


async def subscription_lifecycle_job():
    """매일 오전 1시: 구독 만료/갱신/정지 처리"""
    from db.supabase_client import get_client
    from services.toss_billing import retry_billing
    from services.kakao_notify import KakaoNotifier

    try:
        supabase = get_client()
        notifier = KakaoNotifier()
        today = date.today()

        # 1. 7일 후 만료 예정 → 갱신 안내 알림
        expiring_soon = (
            supabase.table("subscriptions")
            .select("*, profiles(phone)")
            .eq("status", "active")
            .eq("end_at", str(today + timedelta(days=7)))
            .execute()
            .data
        )
        for sub in expiring_soon:
            phone = (sub.get("profiles") or {}).get("phone")
            if phone:
                await notifier.send_expire_warning(phone, sub["plan"], 7)

        # 2. 오늘 만료 → 갱신 시도 (토스 자동결제)
        expired_today = (
            supabase.table("subscriptions")
            .select("*, profiles(phone)")
            .eq("status", "active")
            .eq("end_at", str(today))
            .execute()
            .data
        )
        for sub in expired_today:
            success = await retry_billing(sub)
            if success:
                new_end = today + timedelta(days=30)
                supabase.table("subscriptions").update(
                    {"end_at": str(new_end), "status": "active"}
                ).eq("id", sub["id"]).execute()
                logger.info(f"Subscription renewed: {sub['id']}")
            else:
                supabase.table("subscriptions").update(
                    {"status": "grace_period", "grace_until": str(today + timedelta(days=3))}
                ).eq("id", sub["id"]).execute()
                phone = (sub.get("profiles") or {}).get("phone")
                if phone:
                    await notifier.send_payment_failed(phone)

        # 3. 유예 기간 만료 → 정지
        grace_expired = (
            supabase.table("subscriptions")
            .select("*, profiles(phone)")
            .eq("status", "grace_period")
            .lte("grace_until", str(today))
            .execute()
            .data
        )
        for sub in grace_expired:
            supabase.table("subscriptions").update(
                {"status": "suspended"}
            ).eq("id", sub["id"]).execute()
            phone = (sub.get("profiles") or {}).get("phone")
            if phone:
                await notifier.send_suspended(phone)
            logger.info(f"Subscription suspended: {sub['id']}")

    except Exception as e:
        logger.error(f"subscription_lifecycle_job failed: {e}")


async def after_screenshot_job():
    """매일 오전 8시: 가입 후 30/60/90일 경과 사업장 After 스크린샷 자동 캡처"""
    from db.supabase_client import get_client
    from services.screenshot import capture_batch, build_queries
    from services.before_after_card import generate_comparison_card
    from services.kakao_notify import KakaoNotifier
    import httpx

    try:
        supabase = get_client()
        notifier = KakaoNotifier()
        today = date.today()

        for days in [30, 60, 90]:
            target_date = today - timedelta(days=days)
            businesses = (
                supabase.table("businesses")
                .select("*, subscriptions!inner(status)")
                .eq("subscriptions.status", "active")
                .gte("created_at", str(target_date))
                .lt("created_at", str(target_date + timedelta(days=1)))
                .execute()
                .data
            )

            for biz in businesses:
                try:
                    queries = build_queries(biz)
                    after_urls = await capture_batch(biz["id"], queries)

                    before_rows = (
                        supabase.table("before_after")
                        .select("image_url")
                        .eq("business_id", biz["id"])
                        .eq("capture_type", "before")
                        .limit(1)
                        .execute()
                        .data
                    )

                    if not (before_rows and after_urls):
                        continue

                    async with httpx.AsyncClient(timeout=30) as c:
                        before_bytes = (await c.get(before_rows[0]["image_url"])).content
                        after_bytes = (await c.get(after_urls[0])).content

                    # 점수 변화 조회
                    score_history = (
                        supabase.table("score_history")
                        .select("total_score")
                        .eq("business_id", biz["id"])
                        .order("score_date", desc=True)
                        .limit(2)
                        .execute()
                        .data
                    )
                    before_score = score_history[-1]["total_score"] if len(score_history) > 1 else 0
                    after_score = score_history[0]["total_score"] if score_history else 0

                    card = await generate_comparison_card(
                        before_bytes, after_bytes,
                        biz["name"], before_score, after_score,
                    )

                    # Supabase Storage 업로드
                    card_path = f"cards/{biz['id']}/{days}d.png"
                    supabase.storage.from_("before-after").upload(
                        card_path, card, {"content-type": "image/png", "upsert": "true"}
                    )
                    card_url = supabase.storage.from_("before-after").get_public_url(card_path)

                    # DB 기록
                    supabase.table("before_after").insert({
                        "business_id": biz["id"],
                        "capture_type": f"after_{days}d",
                        "image_url": card_url,
                    }).execute()

                    logger.info(f"After card generated: {biz['name']} ({days}d)")

                except Exception as e:
                    logger.error(f"After screenshot failed for {biz.get('name')}: {e}")

    except Exception as e:
        logger.error(f"after_screenshot_job failed: {e}")


async def monthly_market_news_job():
    """매월 1일 오전 10시: 업종별 시장 변화 뉴스 카카오 알림 (AEOLAB_NEWS_01)"""
    from db.supabase_client import get_client
    from services.kakao_notify import KakaoNotifier
    import anthropic
    import os

    try:
        supabase = get_client()
        notifier = KakaoNotifier()

        users = (
            supabase.table("subscriptions")
            .select("user_id, profiles(phone), businesses(id,name,category,region)")
            .eq("status", "active")
            .execute()
            .data
        )

        # 업종별 카테고리 집계 후 Claude로 뉴스 생성 (카테고리당 1회 API 호출로 비용 절감)
        category_news: dict = {}
        client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))

        for user in users:
            try:
                biz_list = user.get("businesses") or []
                if not biz_list:
                    continue
                biz = biz_list[0]
                phone = (user.get("profiles") or {}).get("phone")
                if not phone:
                    continue

                category = biz.get("category", "")
                region = biz.get("region", "")
                cache_key = f"{category}_{region}"

                if cache_key not in category_news:
                    msg = await client.messages.create(
                        model="claude-haiku-4-5",
                        max_tokens=300,
                        messages=[{
                            "role": "user",
                            "content": (
                                f"한국 {region} {category} 업종의 이달 AI 검색 트렌드를 "
                                f"3줄 이내로 요약해줘. 소상공인이 알아야 할 핵심만."
                            ),
                        }],
                    )
                    category_news[cache_key] = msg.content[0].text.strip()

                news_text = category_news[cache_key]
                await notifier.send_market_news(phone, biz.get("name", ""), category, news_text)

            except Exception as e:
                logger.error(f"Monthly market news failed for user: {e}")

    except Exception as e:
        logger.error(f"monthly_market_news_job failed: {e}")


async def check_competitor_overtake():
    """매일 새벽 3시: 경쟁사 점수 역전 감지 후 카카오톡 알림"""
    from db.supabase_client import get_client
    from services.kakao_notify import KakaoNotifier

    try:
        supabase = get_client()
        notifier = KakaoNotifier()

        # 활성 구독 사업장 조회
        subscribed = (
            supabase.table("subscriptions")
            .select("user_id")
            .eq("status", "active")
            .execute()
            .data or []
        )
        user_ids = [s["user_id"] for s in subscribed]

        businesses = (
            supabase.table("businesses")
            .select("id, name, user_id")
            .in_("user_id", user_ids)
            .eq("is_active", True)
            .execute()
            .data or []
        )

        for biz in businesses:
            try:
                # 내 최근 2회 점수
                my_history = (
                    supabase.table("score_history")
                    .select("total_score")
                    .eq("business_id", biz["id"])
                    .order("score_date", desc=True)
                    .limit(2)
                    .execute()
                    .data or []
                )
                if len(my_history) < 2:
                    continue

                my_score = my_history[0]["total_score"]
                my_prev = my_history[1]["total_score"]

                # 경쟁사 목록 조회
                competitors = (
                    supabase.table("competitors")
                    .select("id, name")
                    .eq("business_id", biz["id"])
                    .eq("is_active", True)
                    .execute()
                    .data or []
                )

                for comp in competitors:
                    comp_latest = (
                        supabase.table("score_history")
                        .select("total_score")
                        .eq("business_id", comp["id"])
                        .order("score_date", desc=True)
                        .limit(1)
                        .execute()
                        .data or []
                    )
                    if not comp_latest:
                        continue

                    comp_score = comp_latest[0]["total_score"]

                    # 역전 감지: 이전엔 내가 앞섰는데 지금은 뒤처짐
                    if my_prev > comp_score and my_score <= comp_score:
                        # 사용자 폰 번호 조회
                        profile = (
                            supabase.table("profiles")
                            .select("phone")
                            .eq("id", biz["user_id"])
                            .maybe_single()
                            .execute()
                            .data
                        )
                        phone = (profile or {}).get("phone")
                        if phone:
                            await notifier.send_competitor_overtake(
                                phone=phone,
                                biz_name=biz["name"],
                                comp_name=comp["name"],
                                my_score=my_score,
                                comp_score=comp_score,
                                gap=comp_score - my_score,
                            )
                            logger.info(
                                f"역전 알림 발송: {biz['name']} → {comp['name']} "
                                f"({my_score:.1f} vs {comp_score:.1f})"
                            )

            except Exception as e:
                logger.error(f"Competitor overtake check failed for {biz.get('name')}: {e}")

    except Exception as e:
        logger.error(f"check_competitor_overtake failed: {e}")


async def _enrich_competitor_excerpts():
    """경쟁사 스캔 결과의 excerpt 필드 보강 (최근 미보강 스캔 대상).

    competitor_scores JSONB에 excerpt가 없는 최근 30개 스캔을 찾아
    gemini single_check를 다시 실행해 excerpt를 채워 넣는다.
    keyword_gap의 competitor_only_keywords 정확도를 높이기 위한 보조 잡.
    """
    try:
        from db.supabase_client import get_client
        from services.ai_scanner.gemini_scanner import GeminiScanner

        supabase = get_client()
        # 경쟁사 점수는 있지만 excerpt가 없는 최근 스캔 30개 조회
        scans = (
            supabase.table("scan_results")
            .select("id, business_id, query_used, competitor_scores")
            .not_.is_("competitor_scores", "null")
            .order("scanned_at", desc=True)
            .limit(30)
            .execute()
            .data
        ) or []

        gemini = GeminiScanner()
        enriched = 0
        for scan in scans:
            comp_scores = scan.get("competitor_scores") or {}
            needs_update = False
            for comp_id, data in comp_scores.items():
                if isinstance(data, dict) and not data.get("excerpt"):
                    name = data.get("name", "")
                    query = scan.get("query_used", "")
                    if name and query:
                        try:
                            r = await gemini.single_check(query, name)
                            excerpt = r.get("excerpt", "")
                            if excerpt:
                                comp_scores[comp_id]["excerpt"] = excerpt[:300]
                                needs_update = True
                        except Exception:
                            pass
            if needs_update:
                supabase.table("scan_results").update(
                    {"competitor_scores": comp_scores}
                ).eq("id", scan["id"]).execute()
                enriched += 1

        if enriched:
            logger.info(f"competitor_excerpts enriched: {enriched} scans updated")
    except Exception as e:
        logger.warning(f"_enrich_competitor_excerpts failed: {e}")


async def detect_new_competitors():
    """매주 월요일 오전 4시: 카카오 로컬 API로 신규 경쟁사 감지 후 알림.

    각 사업장의 카테고리·지역으로 카카오 검색 후,
    기존 등록 경쟁사에 없는 새 사업장이 발견되면 카카오톡 알림 발송.
    """
    import os
    import aiohttp
    from db.supabase_client import get_client
    from services.kakao_notify import KakaoNotifier

    rest_key = os.getenv("KAKAO_REST_API_KEY")
    if not rest_key:
        logger.warning("detect_new_competitors: KAKAO_REST_API_KEY 미설정")
        return

    # 업종 코드 → 검색 키워드 매핑 (주요 업종만)
    _CAT_KO = {
        "restaurant": "음식점", "cafe": "카페", "beauty": "미용실",
        "clinic": "병원", "academy": "학원", "fitness": "헬스장",
        "pet": "반려동물", "dental": "치과", "bakery": "베이커리",
    }

    try:
        supabase = get_client()
        notifier = KakaoNotifier()

        # 구독 중인 사업장 조회
        subscribed = (
            supabase.table("subscriptions")
            .select("user_id")
            .eq("status", "active")
            .execute()
            .data or []
        )
        user_ids = [s["user_id"] for s in subscribed]
        businesses = (
            supabase.table("businesses")
            .select("id, name, user_id, category, region")
            .in_("user_id", user_ids)
            .eq("is_active", True)
            .execute()
            .data or []
        )

        for biz in businesses:
            try:
                category = biz.get("category", "")
                region = biz.get("region", "")
                cat_ko = _CAT_KO.get(category)
                if not cat_ko or not region:
                    continue

                region_prefix = region.split()[0]
                query = f"{region_prefix} {cat_ko}"

                async with aiohttp.ClientSession() as session:
                    async with session.get(
                        "https://dapi.kakao.com/v2/local/search/keyword.json",
                        params={"query": query, "size": 15},
                        headers={"Authorization": f"KakaoAK {rest_key}"},
                        timeout=aiohttp.ClientTimeout(total=8),
                    ) as res:
                        if res.status != 200:
                            continue
                        data = await res.json()

                found_places = [
                    doc.get("place_name", "")
                    for doc in data.get("documents", [])
                    if doc.get("place_name")
                ]
                if not found_places:
                    continue

                # 기존 등록 경쟁사 이름 조회
                existing_comps = (
                    supabase.table("competitors")
                    .select("name")
                    .eq("business_id", biz["id"])
                    .eq("is_active", True)
                    .execute()
                    .data or []
                )
                existing_names = {c["name"] for c in existing_comps}

                new_places = [p for p in found_places if p not in existing_names and p != biz["name"]]
                if len(new_places) < 1:
                    continue

                # 사용자 전화번호 조회
                profile = (
                    supabase.table("profiles")
                    .select("phone, kakao_competitor_notify")
                    .eq("id", biz["user_id"])
                    .maybe_single()
                    .execute()
                    .data
                )
                phone = (profile or {}).get("phone")
                notify_on = (profile or {}).get("kakao_competitor_notify", True)

                if not phone or not notify_on:
                    continue

                # 이미 이번 주에 알림 발송했으면 스킵
                from datetime import date, timedelta
                week_start = (date.today() - timedelta(days=date.today().weekday())).isoformat() + "T00:00:00"
                already_sent = (
                    supabase.table("notifications")
                    .select("id", count="exact")
                    .eq("user_id", biz["user_id"])
                    .eq("type", "new_competitor")
                    .gte("sent_at", week_start)
                    .execute()
                )
                if (already_sent.count or 0) > 0:
                    continue

                new_names_str = ", ".join(new_places[:3])
                await notifier.send_text(
                    phone=phone,
                    message=(
                        f"[AEOlab] {biz['name']} 알림\n\n"
                        f"이번 주 {region_prefix} {cat_ko} 검색에 새로운 사업장이 발견됐습니다.\n\n"
                        f"새 경쟁 후보: {new_names_str}\n\n"
                        f"경쟁사로 등록하고 AI 노출 순위를 비교해보세요.\n"
                        f"https://aeolab.co.kr/competitors"
                    ),
                )
                # 알림 이력 저장
                supabase.table("notifications").insert({
                    "user_id": biz["user_id"],
                    "business_id": biz["id"],
                    "type": "new_competitor",
                    "payload": {"new_places": new_places[:3]},
                }).execute()

                logger.info(f"신규 경쟁사 알림: {biz['name']} → {new_names_str}")
            except Exception as e:
                logger.warning(f"detect_new_competitors biz={biz.get('id')}: {e}")

    except Exception as e:
        logger.error(f"detect_new_competitors failed: {e}")


async def keyword_alert_job():
    """매일 오전 8시: AI 발췌문에서 신규 키워드 출현 → 사장님에게 알림.

    어제 스캔 결과의 ai_citations에서 업종 키워드가 처음 언급된 경우 알림 발송.
    "오늘 AI 검색에서 [주차 편리]로 처음 언급됐습니다!" 형태.
    """
    from db.supabase_client import get_client
    from services.kakao_notify import KakaoNotifier
    from services.keyword_taxonomy import analyze_keyword_coverage
    from datetime import date, timedelta

    try:
        supabase = get_client()
        notifier = KakaoNotifier()

        yesterday = (date.today() - timedelta(days=1)).isoformat() + "T00:00:00"
        today_str = date.today().isoformat() + "T00:00:00"

        # 어제 스캔 결과 조회 (ai_citations join)
        recent_cits = (
            supabase.table("ai_citations")
            .select("business_id, excerpt, platform")
            .gte("created_at", yesterday)
            .lt("created_at", today_str)
            .eq("mentioned", True)
            .limit(200)
            .execute()
            .data or []
        )

        # business_id별 발췌문 그룹화
        from collections import defaultdict
        biz_excerpts: dict[str, list[str]] = defaultdict(list)
        for cit in recent_cits:
            bid = cit.get("business_id")
            exc = cit.get("excerpt", "")
            if bid and exc:
                biz_excerpts[bid].append(exc)

        if not biz_excerpts:
            return

        biz_ids = list(biz_excerpts.keys())
        businesses = (
            supabase.table("businesses")
            .select("id, name, user_id, category")
            .in_("id", biz_ids)
            .eq("is_active", True)
            .execute()
            .data or []
        )

        # 이전 스캔 발췌문 (어제 이전 최근 5회) — 신규 여부 판단용
        for biz in businesses:
            try:
                category = biz.get("category", "")
                if not category:
                    continue

                new_excerpts = biz_excerpts.get(biz["id"], [])
                if not new_excerpts:
                    continue

                # 어제 이전 발췌문
                old_cits = (
                    supabase.table("ai_citations")
                    .select("excerpt")
                    .eq("business_id", biz["id"])
                    .lt("created_at", yesterday)
                    .order("created_at", desc=True)
                    .limit(50)
                    .execute()
                    .data or []
                )
                old_excerpts = [c["excerpt"] for c in old_cits if c.get("excerpt")]

                # 어제 발췌문의 키워드 커버리지
                new_coverage = analyze_keyword_coverage(
                    category=category,
                    review_excerpts=new_excerpts,
                    competitor_review_excerpts=None,
                )
                old_coverage = analyze_keyword_coverage(
                    category=category,
                    review_excerpts=old_excerpts,
                    competitor_review_excerpts=None,
                ) if old_excerpts else {"covered": []}

                newly_appeared = [
                    kw for kw in new_coverage.get("covered", [])
                    if kw not in old_coverage.get("covered", [])
                ]
                if not newly_appeared:
                    continue

                # 사용자 알림 설정 확인
                profile = (
                    supabase.table("profiles")
                    .select("phone, kakao_scan_notify")
                    .eq("id", biz["user_id"])
                    .maybe_single()
                    .execute()
                    .data
                )
                phone = (profile or {}).get("phone")
                notify_on = (profile or {}).get("kakao_scan_notify", True)
                if not phone or not notify_on:
                    continue

                kw_str = ", ".join(newly_appeared[:3])
                await notifier.send_text(
                    phone=phone,
                    message=(
                        f"[AEOlab] {biz['name']} 키워드 알림\n\n"
                        f"오늘 AI 검색에서 새 키워드로 언급됐습니다!\n\n"
                        f"신규 키워드: {kw_str}\n\n"
                        f"이 키워드가 포함된 리뷰를 더 받으면 AI 브리핑 노출이 늘어납니다.\n"
                        f"https://aeolab.co.kr/guide"
                    ),
                )
                logger.info(f"키워드 알림: {biz['name']} → {kw_str}")

            except Exception as e:
                logger.warning(f"keyword_alert biz={biz.get('id')}: {e}")

    except Exception as e:
        logger.error(f"keyword_alert_job failed: {e}")


async def trial_followup_job():
    """매일 오전 10시: 무료 체험 팔로업 이메일 시퀀스 (1·3·7일차).

    trial_scans에서 email 있고 followup_sent_N = False인 건 조회 후 발송.
    UPDATE WHERE followup_sent_N = FALSE 원자적 업데이트로 중복 발송 방지.
    """
    from db.supabase_client import get_client
    from services.email_sender import send_trial_followup
    from datetime import date, timedelta

    try:
        supabase = get_client()
        today = date.today()

        for day in (1, 3, 7):
            col = f"followup_sent_{day}"
            target_date = (today - timedelta(days=day)).isoformat()

            rows = (
                supabase.table("trial_scans")
                .select("id, email, business_name, category, region")
                .eq(col, False)
                .not_.is_("email", "null")
                .lte("created_at", target_date + "T23:59:59")
                .gte("created_at", target_date + "T00:00:00")
                .limit(100)
                .execute()
                .data or []
            )

            for row in rows:
                email = row.get("email")
                if not email:
                    continue

                # 원자적 업데이트 (이미 처리된 행 스킵)
                updated = (
                    supabase.table("trial_scans")
                    .update({col: True, "followup_sent_at": today.isoformat()})
                    .eq("id", row["id"])
                    .eq(col, False)
                    .execute()
                )
                if not (updated.data or []):
                    continue  # 다른 프로세스가 먼저 처리한 경우

                sent = await send_trial_followup(
                    email=email,
                    business_name=row.get("business_name", ""),
                    category=row.get("category", ""),
                    region=row.get("region", ""),
                    score=float(row.get("score") or 0),
                    day=day,
                )
                if sent:
                    logger.info(f"trial_followup day={day} → {email}")

    except Exception as e:
        logger.error(f"trial_followup_job failed: {e}")


async def weekly_post_draft_job():
    """매주 월요일 오전 9시: 활성 사업장 스마트플레이스 소식 초안 자동 생성.

    Claude Haiku로 업종별 이번 주 소식 초안 생성 → guides(type='post_draft') 저장.
    카카오 알림: "이번 주 소식 초안이 준비됐습니다"
    """
    import anthropic
    import os
    from db.supabase_client import get_client
    from services.kakao_notify import KakaoNotifier
    from datetime import date

    try:
        supabase = get_client()
        notifier = KakaoNotifier()
        client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))

        # 구독 중인 사업장 조회 (basic 이상)
        subs = (
            supabase.table("subscriptions")
            .select("user_id")
            .eq("status", "active")
            .in_("plan", ["basic", "startup", "pro", "biz", "enterprise"])
            .execute()
            .data or []
        )
        user_ids = list({s["user_id"] for s in subs})
        if not user_ids:
            return

        businesses = (
            supabase.table("businesses")
            .select("id, name, category, region, user_id, keywords")
            .in_("user_id", user_ids)
            .eq("is_active", True)
            .execute()
            .data or []
        )

        _CATEGORY_KO: dict[str, str] = {
            "restaurant": "음식점", "cafe": "카페", "beauty": "미용실",
            "clinic": "병원", "academy": "학원", "fitness": "헬스장",
            "pet": "반려동물샵", "legal": "법률사무소",
        }

        for biz in businesses:
            try:
                category = biz.get("category", "")
                cat_ko = _CATEGORY_KO.get(category, category)
                keywords = ", ".join((biz.get("keywords") or [])[:3])
                week = date.today().isocalendar()[1]

                prompt = (
                    f"한국 {biz['region']} {cat_ko} '{biz['name']}'의 네이버 스마트플레이스 '소식' 탭에 올릴 "
                    f"이번 주 소식 초안을 작성해주세요.\n"
                    f"핵심 키워드: {keywords}\n\n"
                    f"조건:\n"
                    f"- 100~150자 이내\n"
                    f"- 자연스럽고 친근한 말투\n"
                    f"- 홍보성 느낌 없이 유용한 정보 포함\n"
                    f"- 계절/주간 관련 내용 포함\n"
                    f"초안만 출력 (설명 없이):"
                )

                msg = await client.messages.create(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=200,
                    messages=[{"role": "user", "content": prompt}],
                )
                draft = msg.content[0].text.strip()

                # guides 테이블에 저장 (guide_type='post_draft')
                supabase.table("guides").insert({
                    "business_id": biz["id"],
                    "items_json": [{"title": "주간 소식 초안", "action": draft, "difficulty": "easy"}],
                    "priority_json": [draft],
                    "summary": f"{week}주차 소식 초안 자동 생성",
                    "context": "post_draft",
                }).execute()

                # 카카오 알림 (알림 설정한 사용자만)
                profile = (
                    supabase.table("profiles")
                    .select("phone, kakao_scan_notify")
                    .eq("id", biz["user_id"])
                    .maybe_single()
                    .execute()
                    .data
                )
                phone = (profile or {}).get("phone")
                if phone and (profile or {}).get("kakao_scan_notify", True):
                    await notifier.send_text(
                        phone=phone,
                        message=(
                            f"[AEOlab] {biz['name']} 소식 초안\n\n"
                            f"이번 주 스마트플레이스 소식 초안이 준비됐습니다.\n\n"
                            f"확인 후 복사해서 바로 올려보세요!\n"
                            f"https://aeolab.co.kr/guide"
                        ),
                    )

                logger.info(f"weekly_post_draft: {biz['name']} 완료")

            except Exception as e:
                logger.warning(f"weekly_post_draft biz={biz.get('id')}: {e}")

    except Exception as e:
        logger.error(f"weekly_post_draft_job failed: {e}")


async def monthly_growth_card_job():
    """매월 말일 오후 6시: 월간 성장 카드 이미지 생성 후 Storage 저장 + 카카오 알림.

    score_history에서 이달 첫날 vs 마지막 날 점수 비교.
    상승폭이 있을 때만 카드 생성.
    """
    from db.supabase_client import get_client
    from services.kakao_notify import KakaoNotifier
    from datetime import date

    try:
        supabase = get_client()
        notifier = KakaoNotifier()

        today = date.today()
        month_start = today.replace(day=1).isoformat() + "T00:00:00"

        # 구독 중인 사업장 전체
        subs = (
            supabase.table("subscriptions")
            .select("user_id")
            .eq("status", "active")
            .execute()
            .data or []
        )
        user_ids = list({s["user_id"] for s in subs})
        if not user_ids:
            return

        businesses = (
            supabase.table("businesses")
            .select("id, name, user_id, category, region")
            .in_("user_id", user_ids)
            .eq("is_active", True)
            .execute()
            .data or []
        )

        for biz in businesses:
            try:
                biz_id = biz["id"]

                # 이달 첫 번째 점수
                first_row = (
                    supabase.table("score_history")
                    .select("total_score, score_date")
                    .eq("business_id", biz_id)
                    .gte("score_date", month_start)
                    .order("score_date", desc=False)
                    .limit(1)
                    .execute()
                    .data or []
                )
                # 이달 마지막 점수
                last_row = (
                    supabase.table("score_history")
                    .select("total_score, score_date")
                    .eq("business_id", biz_id)
                    .gte("score_date", month_start)
                    .order("score_date", desc=True)
                    .limit(1)
                    .execute()
                    .data or []
                )

                if not first_row or not last_row:
                    continue

                score_start = float(first_row[0]["total_score"])
                score_end = float(last_row[0]["total_score"])
                diff = score_end - score_start

                if diff <= 0:
                    logger.debug(f"monthly_growth_card: {biz['name']} 상승 없음 ({diff:+.1f})")
                    continue

                # Pillow로 성장 카드 이미지 생성
                try:
                    from PIL import Image, ImageDraw, ImageFont
                    from io import BytesIO
                    from services.before_after_card import _FONT_BOLD, _FONT_REG  # 폰트 경로 재사용
                    from pathlib import Path

                    W, H = 1080, 1080
                    img = Image.new("RGB", (W, H), "#0f172a")
                    draw = ImageDraw.Draw(img)

                    def _lf(paths, size):
                        for p in paths:
                            if Path(p).exists():
                                try:
                                    return ImageFont.truetype(p, size)
                                except Exception:
                                    pass
                        return ImageFont.load_default()

                    f_lg = _lf(_FONT_BOLD, 80)
                    f_md = _lf(_FONT_BOLD, 48)
                    f_sm = _lf(_FONT_REG, 32)

                    draw.text((540, 180), "이번 달 AI 점수", font=f_sm, fill="#94a3b8", anchor="mm")
                    draw.text((540, 380), f"+{diff:.1f}점 상승!", font=f_lg, fill="#34d399", anchor="mm")
                    draw.text((540, 520), f"{score_start:.0f}점 → {score_end:.0f}점", font=f_md, fill="#ffffff", anchor="mm")
                    draw.text((540, 640), biz["name"], font=f_md, fill="#93c5fd", anchor="mm")
                    draw.text((540, 900), "aeolab.co.kr", font=f_sm, fill="#475569", anchor="mm")

                    buf = BytesIO()
                    img.save(buf, format="PNG")
                    buf.seek(0)

                    # Supabase Storage 저장
                    storage_path = f"growth/{biz_id}/{today.isoformat()}.png"
                    supabase.storage.from_("before-after").upload(
                        storage_path, buf.read(), {"content-type": "image/png"}
                    )
                    card_url = supabase.storage.from_("before-after").get_public_url(storage_path)

                except Exception as img_err:
                    logger.warning(f"monthly_growth_card 이미지 생성 실패 {biz['name']}: {img_err}")
                    card_url = "https://aeolab.co.kr/dashboard"

                # 카카오 알림
                profile = (
                    supabase.table("profiles")
                    .select("phone")
                    .eq("id", biz["user_id"])
                    .maybe_single()
                    .execute()
                    .data
                )
                phone = (profile or {}).get("phone")
                if phone:
                    await notifier.send_text(
                        phone=phone,
                        message=(
                            f"[AEOlab] {biz['name']} 이달 성장 리포트\n\n"
                            f"이번 달 AI 검색 점수가 +{diff:.1f}점 상승했습니다!\n\n"
                            f"{score_start:.0f}점 → {score_end:.0f}점\n\n"
                            f"성장 카드를 확인하세요:\n{card_url}"
                        ),
                    )
                logger.info(f"monthly_growth_card: {biz['name']} +{diff:.1f}")

            except Exception as e:
                logger.warning(f"monthly_growth_card biz={biz.get('id')}: {e}")

    except Exception as e:
        logger.error(f"monthly_growth_card_job failed: {e}")


async def check_low_rating_reviews():
    """매 6시간마다: 별점 2점 이하 리뷰 감지 후 카카오 긴급 알림.

    naver_place_stats.py의 get_recent_low_rating_reviews()로 각 사업장 최근 리뷰 조회.
    이미 알림 발송한 review_id는 notifications 테이블에서 중복 여부 확인 후 스킵.
    KAKAO_APP_KEY 미설정 시 warning 로그 후 skip.
    """
    from db.supabase_client import get_client
    from services.kakao_notify import KakaoNotifier
    from services.naver_place_stats import get_recent_low_rating_reviews

    try:
        supabase = get_client()
        notifier = KakaoNotifier()

        # naver_place_id가 설정된 활성 구독 사업장 조회
        subs = (
            supabase.table("subscriptions")
            .select("user_id")
            .eq("status", "active")
            .execute()
            .data or []
        )
        user_ids = [s["user_id"] for s in subs]
        if not user_ids:
            return

        businesses = (
            supabase.table("businesses")
            .select("id, name, user_id, naver_place_id")
            .in_("user_id", user_ids)
            .eq("is_active", True)
            .not_.is_("naver_place_id", "null")
            .execute()
            .data or []
        )

        for biz in businesses:
            try:
                naver_place_id = biz.get("naver_place_id")
                if not naver_place_id:
                    continue

                # 전화번호 + 알림 설정 확인
                profile = (
                    supabase.table("profiles")
                    .select("phone, kakao_scan_notify")
                    .eq("id", biz["user_id"])
                    .maybe_single()
                    .execute()
                    .data
                )
                phone = (profile or {}).get("phone")
                if not phone:
                    continue

                # 별점 2점 이하 리뷰 조회 (Playwright)
                low_reviews = await get_recent_low_rating_reviews(
                    naver_place_id=naver_place_id,
                    min_rating=2,
                    max_reviews=5,
                )

                for review in low_reviews:
                    review_id = review.get("review_id", "")
                    rating = review.get("rating", 0)
                    excerpt = review.get("excerpt", "")

                    # 중복 발송 방지: notifications 테이블에서 해당 review_id 확인
                    if review_id:
                        already = (
                            supabase.table("notifications")
                            .select("id", count="exact")
                            .eq("type", "low_rating_alert")
                            .eq("user_id", biz["user_id"])
                            .contains("content", {"review_id": review_id})
                            .execute()
                        )
                        if (already.count or 0) > 0:
                            continue

                    # 카카오 알림 발송
                    await notifier.send_low_rating_alert(
                        phone=phone,
                        biz_name=biz["name"],
                        rating=rating,
                        review_excerpt=excerpt,
                    )

                    # 발송 이력 저장
                    supabase.table("notifications").insert({
                        "user_id": biz["user_id"],
                        "type": "low_rating_alert",
                        "content": {
                            "biz_name": biz["name"],
                            "review_id": review_id,
                            "rating": rating,
                            "excerpt": excerpt[:100],
                        },
                        "channel": "kakao",
                        "status": "sent",
                    }).execute()

                    logger.info(
                        f"low_rating_alert sent: {biz['name']} ({rating}점) review_id={review_id}"
                    )
                    break  # 사업장당 1건만 알림 (중복 방지)

            except Exception as e:
                logger.warning(f"check_low_rating_reviews biz={biz.get('id')}: {e}")

    except Exception as e:
        logger.error(f"check_low_rating_reviews failed: {e}")


async def send_monthly_growth_report():
    """매월 1일 오전 9시: 이전 달 성과 집계 후 카카오 월간 성장 리포트 발송."""
    from services.monthly_report import send_monthly_growth_report_to_all
    await send_monthly_growth_report_to_all()
