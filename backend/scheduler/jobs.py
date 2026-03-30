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
    - basic   : Gemini(100회) + 네이버 매일 / 8개 AI 전체는 월요일만 (비용 절감)
    - pro/startup : 8개 AI 매일
    - biz/enterprise : 8개 AI 매일
    """
    from db.supabase_client import get_client
    from services.ai_scanner.multi_scanner import MultiAIScanner
    from services.score_engine import calculate_score

    try:
        supabase = get_client()
        today = date.today()
        is_monday = today.weekday() == 0

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

                # 플랜별 스캐너 선택
                # basic 평일 → 경량 스캔 / basic 월요일 → 풀스캔 / 나머지 → 매일 풀스캔
                if plan == "basic" and not is_monday:
                    result = await basic_scanner.scan_basic(query, biz["name"])
                else:
                    result = await full_scanner.scan_all(query, biz["name"])

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
                        "zeta_result": result.get("zeta"),
                        "google_result": result.get("google"),
                        "exposure_freq": result.get("gemini", {}).get("exposure_freq", 0),
                        "total_score": score["total_score"],
                        "score_breakdown": score["breakdown"],
                        "naver_channel_score": naver_channel,
                        "global_channel_score": global_channel,
                    }
                ).execute().data

                # score_history 기록 (30일 추세용)
                today_str = str(date.today())
                prev_history = (
                    supabase.table("score_history")
                    .select("total_score")
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
                        "exposure_freq": result.get("gemini", {}).get("exposure_freq", 0),
                        "weekly_change": weekly_change,
                        "naver_channel_score": naver_channel,
                        "global_channel_score": global_channel,
                    },
                    on_conflict="business_id,score_date",
                ).execute()

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


async def weekly_kakao_notify():
    """활성 구독자 주간 카카오톡 알림 (월요일 오전 9시)"""
    from db.supabase_client import get_client
    from services.kakao_notify import KakaoNotifier

    try:
        supabase = get_client()
        notifier = KakaoNotifier()

        users = (
            supabase.table("subscriptions")
            .select("user_id, profiles(phone), businesses(*)")
            .eq("status", "active")
            .execute()
            .data
        )

        for user in users:
            try:
                biz_list = user.get("businesses") or []
                if not biz_list:
                    continue
                biz = biz_list[0]
                biz_id = biz.get("id")
                biz_name = biz.get("name", "")
                phone = (user.get("profiles") or {}).get("phone")

                if not biz_id:
                    continue

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

                # 2. AI 인용 실증 알림 (이번 주 신규 인용 첫 건)
                if phone:
                    citations = (
                        supabase.table("ai_citations")
                        .select("platform, query, excerpt")
                        .eq("business_id", biz_id)
                        .eq("mentioned", True)
                        .gte("created_at", str(date.today() - timedelta(days=7)))
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

            except Exception as e:
                logger.error(f"Notify failed for user: {e}")

    except Exception as e:
        logger.error(f"weekly_kakao_notify failed: {e}")


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
