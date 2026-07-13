import asyncio
import logging
import os
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.events import EVENT_JOB_ERROR
from datetime import date, datetime, timedelta
from utils.alert import send_slack_alert
from db.supabase_client import execute as _db
from services.keyword_taxonomy import build_ai_scan_queries as _build_ai_scan_queries

# 카카오 알림 키 설정 여부 — 미설정 시 알림 발송 시도 자체를 스킵해 에러 로그 누적 방지
_KAKAO_CONFIGURED = bool(os.getenv("KAKAO_APP_KEY") and os.getenv("KAKAO_SENDER_KEY"))

logger = logging.getLogger(__name__)
_logger = logger  # index_aggregator 패턴 통일용 alias
scheduler = AsyncIOScheduler(timezone="Asia/Seoul")


def _estimate_competitor_score(naver_result: dict) -> float:
    """
    네이버 Gemini 단일 스캔 결과 기반 경쟁사 간이 점수 추정 (0~95점).
    random.uniform 대신 실제 데이터 속성으로 점수를 결정한다.

    기준:
      - 기본값 30점 (미노출 기본)
      - 스마트플레이스 등록: +15점
      - 리뷰 수 (100+: +20, 30+: +12, 10+: +6)
      - 평균 평점 (4.5+: +10, 4.0+: +5)
      - 블로그 포스팅 있음: +8점
      - AI 브리핑 언급됨: +17점
    """
    score = 30.0
    if naver_result.get("is_smart_place"):
        score += 15
    review_count = naver_result.get("review_count", 0) or 0
    if review_count >= 100:
        score += 20
    elif review_count >= 30:
        score += 12
    elif review_count >= 10:
        score += 6
    rating = naver_result.get("rating", 0) or 0
    if rating >= 4.5:
        score += 10
    elif rating >= 4.0:
        score += 5
    if naver_result.get("has_blog_post"):
        score += 8
    if naver_result.get("in_briefing") or naver_result.get("mentioned_in_briefing") or naver_result.get("mentioned"):
        score += 17
    return min(score, 95.0)


def start_scheduler():
    scheduler.add_job(
        daily_scan_all, "cron", hour=2, minute=0, id="daily_scan",
        replace_existing=True, max_instances=1, misfire_grace_time=300,
    )
    scheduler.add_job(
        weekly_kakao_notify, "cron", day_of_week="mon", hour=9, id="weekly_notify",
        replace_existing=True,
    )
    scheduler.add_job(
        daily_kakao_notify, "cron", hour=9, minute=10, id="daily_notify",
        replace_existing=True,
    )
    scheduler.add_job(
        subscription_lifecycle_job, "cron", hour=1, minute=0, id="subscription_lifecycle",
        replace_existing=True, max_instances=1, misfire_grace_time=3600,
    )
    scheduler.add_job(
        after_screenshot_job, "cron", hour=8, minute=0, id="after_screenshot",
        replace_existing=True, max_instances=1, misfire_grace_time=300,
    )
    scheduler.add_job(
        monthly_market_news_job, "cron", day=1, hour=10, minute=0, id="monthly_market_news",
        replace_existing=True,
    )
    scheduler.add_job(
        check_competitor_overtake, "cron", hour=3, minute=0, id="competitor_overtake",
        replace_existing=True,
    )
    # 인메모리 캐시·SSE 토큰 주기 정리 (10분마다)
    scheduler.add_job(
        _cleanup_memory_stores, "interval", minutes=10, id="memory_cleanup",
        replace_existing=True,
    )
    # 경쟁사 keyword_gap excerpt 보강 (매주 일요일 02:00 KST, 트래픽 최저점)
    scheduler.add_job(
        _enrich_competitor_excerpts, "cron", day_of_week="sun", hour=2, minute=0,
        id="enrich_competitor_keywords_job",
        replace_existing=True, max_instances=1, misfire_grace_time=300,
    )
    # 신규 경쟁사 감지 (월요일 오전 4시)
    scheduler.add_job(
        detect_new_competitors, "cron", day_of_week="mon", hour=4, minute=30,
        id="detect_new_competitors", replace_existing=True,
    )
    # 분기 공개 인덱스 집계 — 분기 종료 후 8일째 새벽 3시
    # 1월 8일 → Q4 집계, 4월 8일 → Q1 집계, 7월 8일 → Q2 집계, 10월 8일 → Q3 집계
    scheduler.add_job(
        quarterly_index_job, "cron",
        month="1,4,7,10", day=8, hour=3, minute=0,
        id="quarterly_index",
        replace_existing=True, max_instances=1, misfire_grace_time=3600,
    )
    # 리뷰 키워드 알림 (매일 오전 8시)
    scheduler.add_job(
        keyword_alert_job, "cron", hour=8, minute=0, id="keyword_alert",
        replace_existing=True,
    )
    # 무료 체험 팔로업 이메일 (매일 오전 10시)
    scheduler.add_job(
        trial_followup_job, "cron", hour=10, minute=0, id="trial_followup",
        replace_existing=True,
    )
    # 별점 2점 이하 리뷰 긴급 알림 (6시간마다)
    scheduler.add_job(
        check_low_rating_reviews, "cron", hour="*/6", minute=0, id="low_rating_check",
        replace_existing=True,
    )
    # 월간 성장 리포트 자동 발송 (매월 1일 오전 9시)
    scheduler.add_job(
        send_monthly_growth_report, "cron", day=1, hour=9, minute=0, id="monthly_growth_report",
        replace_existing=True,
    )
    # 주간 소식 초안 자동 생성 (매주 월요일 오전 9시)
    scheduler.add_job(
        weekly_post_draft_job, "cron", day_of_week="mon", hour=9, minute=0, id="weekly_post_draft",
        replace_existing=True,
    )
    # 월간 성장 카드 (매월 말일 오후 6시)
    scheduler.add_job(
        monthly_growth_card_job, "cron", day="last", hour=18, minute=0, id="monthly_growth_card",
        replace_existing=True,
    )
    # 가입 5일차 free 사용자 결제 리마인더 (매일 오전 10시 15분)
    scheduler.add_job(
        send_trial_day5_reminder, "cron", hour=10, minute=15,
        id="trial_day5_reminder", replace_existing=True,
    )
    # [2026-05-01] competitor_faq_sync_job 비활성화 — 스마트플레이스 Q&A 탭 폐기로 항상 빈 결과
    # scheduler.add_job(
    #     competitor_faq_sync_job, "cron", day_of_week="mon", hour=5, minute=0,
    #     id="competitor_faq_sync", replace_existing=True, misfire_grace_time=3600,
    # )
    scheduler.add_job(
        competitor_place_sync_job, "cron", day_of_week="tue", hour=3, minute=30,
        id="competitor_place_sync", replace_existing=True, max_instances=1, misfire_grace_time=600,
    )
    # 경쟁사 상세 정보 보강 — 블로그 언급 수·웹사이트 SEO (매주 목요일 03:00)
    scheduler.add_job(
        enrich_competitor_details_job, "cron", day_of_week="thu", hour=3, minute=0,
        id="enrich_competitor_details", replace_existing=True, max_instances=1, misfire_grace_time=600,
    )
    # 업종 트렌드 갱신 (매주 월요일 03:00)
    scheduler.add_job(
        weekly_industry_trend_job, "cron", day_of_week="mon", hour=3, minute=0,
        id="weekly_industry_trend", replace_existing=True, max_instances=1, misfire_grace_time=600,
    )
    # 내 사업장 네이버 플레이스 리뷰 수·평점 갱신 (매주 일요일 03:00)
    # 월요일 새벽 2시 daily_scan_all 직전에 최신 리뷰 수를 확보해 점수에 반영
    scheduler.add_job(
        weekly_my_place_stats_job, "cron", day_of_week="sun", hour=3, minute=0,
        id="weekly_my_place_stats", replace_existing=True, max_instances=1, misfire_grace_time=600,
    )
    # 행동 완료 7일 후 재스캔 (매일 새벽 3시)
    scheduler.add_job(
        check_action_rescans, "cron", hour=3, minute=0, id="action_rescans",
        replace_existing=True, max_instances=1, misfire_grace_time=300,
    )
    # 경쟁사 변화 감지 (매주 월요일 새벽 4시)
    scheduler.add_job(
        detect_competitor_changes, "cron", day_of_week="mon", hour=4, minute=0,
        id="competitor_changes", replace_existing=True, max_instances=1, misfire_grace_time=300,
    )
    scheduler.add_job(
        _fill_action_score_after, "cron", hour=3, minute=30,
        id="fill_action_score_after", replace_existing=True,
    )
    # 주간 성적표 카카오 알림 (매주 월요일 오전 9시)
    scheduler.add_job(
        weekly_score_report_job, "cron", day_of_week="mon", hour=9, minute=5,
        id="weekly_score_report", replace_existing=True,
    )
    # 네이버 AI 브리핑 언급 변화 감지 알림 (매일 오전 8시 30분)
    # keyword_alert_job(08:00)과 after_screenshot_job(08:00)이 이미 있으므로 30분 분리
    scheduler.add_job(
        check_briefing_alert_job, "cron", hour=8, minute=30,
        id="briefing_alert", replace_existing=True,
    )
    # 30/60/90일 구독자 성과 이메일 (매일 오전 9시 5분)
    scheduler.add_job(
        send_monthly_performance_reports,
        "cron", hour=9, minute=5,
        id="monthly_performance_report",
        replace_existing=True,
    )
    # 월간 AI 노출 리포트 카카오 알림 (매월 1일 오전 9시 — monthly_growth_report와 10분 분리)
    scheduler.add_job(
        monthly_report_notify, "cron", day=1, hour=9, minute=10,
        id="monthly_report_notify", replace_existing=True,
    )
    # v3.6 — 가입 7일차 자동 재스캔 + 행동 알림 (매일 09:00 KST)
    scheduler.add_job(
        new_user_day7_rescan_job, "cron", hour=9, minute=0,
        id="new_user_day7_rescan", replace_existing=True,
        max_instances=1, misfire_grace_time=600,
    )
    # 가입 후 미결제 사용자 전환 알림 시퀀스 D+7/14/30 (매일 10:00 KST = UTC 01:00)
    scheduler.add_job(
        conversion_followup_job, "cron", hour=1, minute=0,
        id="conversion_followup", replace_existing=True,
        max_instances=1, misfire_grace_time=600,
    )
    # 구독자 주간 AI 노출 현황 다이제스트 이메일 (매주 월요일 08:30 KST)
    scheduler.add_job(
        weekly_digest_job, "cron", day_of_week="mon", hour=8, minute=30,
        id="weekly_digest", replace_existing=True,
        max_instances=1, misfire_grace_time=600,
    )
    # 키워드 순위 측정 (Phase A-2 / service_unification_v1.0.md §6)
    # Basic 주 1회(월 04:00) / Pro 일 1회(매일 04:30) — 시간 분산으로 RAM peak 회피
    scheduler.add_job(
        keyword_rank_basic_weekly_job, "cron", day_of_week="mon", hour=4, minute=0,
        id="keyword_rank_basic_weekly", replace_existing=True,
        max_instances=1, misfire_grace_time=600,
    )
    scheduler.add_job(
        keyword_rank_pro_daily_job, "cron", hour=4, minute=30,
        id="keyword_rank_pro_daily", replace_existing=True,
        max_instances=1, misfire_grace_time=600,
    )
    # v1.1 §3.3 — 소식 14일 미작성 알림 (매일 09:10 KST)
    scheduler.add_job(
        inactive_post_alert_job, "cron", hour=9, minute=10,
        id="inactive_post_alert", replace_existing=True,
        max_instances=1, misfire_grace_time=600,
    )
    # v5.8 대행 서비스 — 미결제 7일 방치 자동 취소 (매일 10:30 KST = UTC 01:30)
    scheduler.add_job(
        delivery_auto_cancel_job, "cron", hour=1, minute=30,
        id="delivery_auto_cancel", replace_existing=True,
        max_instances=1, misfire_grace_time=600,
    )
    # v6.2b 대행 서비스 — 결제완료+자료 미제출 7일 자동 환불 (매일 11:30 KST = UTC 02:30)
    scheduler.add_job(
        delivery_auto_refund_job, "cron", hour=2, minute=30,
        id="delivery_auto_refund", replace_existing=True,
        max_instances=1, misfire_grace_time=600,
    )
    # v5.8 대행 서비스 — 종합 풀패키지 완료 30일 후 자동 재스캔 (매일 11:00 KST = UTC 02:00)
    scheduler.add_job(
        delivery_30day_rescan_job, "cron", hour=2, minute=0,
        id="delivery_30day_rescan", replace_existing=True,
        max_instances=1, misfire_grace_time=600,
    )
    # [P3] v3.1 readiness check -- daily 09:15 KST (UTC 00:15)
    scheduler.add_job(
        _check_v31_readiness_job, "cron", hour=0, minute=15,
        id="v31_readiness_check_job", replace_existing=True,
        max_instances=1, misfire_grace_time=600,
    )
    # [데이터 배선 확장] DataLab/Playwright 자동화 착수 조건 체크 -- daily 09:20 KST (UTC 00:20)
    scheduler.add_job(
        _check_data_wiring_readiness_job, "cron", hour=0, minute=20,
        id="data_wiring_readiness_check_job", replace_existing=True,
        max_instances=1, misfire_grace_time=600,
    )
    # M3-1: AI탭 P2 자동 트리거 감지 — 주 2회(월·목 09:00 KST)
    scheduler.add_job(
        ai_tab_trigger_check_job, "cron", day_of_week="mon,thu", hour=9, minute=0,
        id="ai_tab_trigger_check", replace_existing=True,
        max_instances=1, misfire_grace_time=600,
    )
    # M3-4: 의료·법무·헬스케어 AI 브리핑 업종 확대 감지 — 월 1회(1일 09:00 KST, 계획서 §M3-4)
    scheduler.add_job(
        briefing_category_expansion_monitor_job, "cron", day=1, hour=9, minute=0,
        id="briefing_expansion_monitor", replace_existing=True,
        max_instances=1, misfire_grace_time=3600,
    )
    # AI탭 정식 출시일 당일 선제 점검 — 2026-06-01 10:00 KST 일회성
    # 기존 월/목 09:00 잡과 별도로 출시 당일 1시간 빠른 시점에 즉시 점검.
    # 감지 시 ai_tab_enabled=true 자동 설정 (pm2 restart 불필요).
    scheduler.add_job(
        ai_tab_trigger_check_job, "date",
        run_date=datetime(2026, 6, 1, 10, 0, 0),
        id="ai_tab_june1_launch_check",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    # 네이버 NID_AUT 쿠키 유효성 검사 + 자동 갱신 — 매주 월요일 09:30 KST (UTC 00:30)
    scheduler.add_job(
        check_naver_cookie_health_job, "cron", day_of_week="mon", hour=0, minute=30,
        id="naver_cookie_health_check", replace_existing=True,
        max_instances=1, misfire_grace_time=3600,
    )
    # AI 프로바이더(Gemini/ChatGPT) 전면 장애 감지 — 30분마다 (2026-07-12 OpenAI 결제미등록 사고 이후 신설)
    scheduler.add_job(
        ai_provider_health_check_job, "interval", minutes=30,
        id="ai_provider_health_check", replace_existing=True,
        max_instances=1, misfire_grace_time=600,
    )
    scheduler.add_listener(_on_job_error, EVENT_JOB_ERROR)
    scheduler.start()
    logger.info("Scheduler started")


def _on_job_error(event) -> None:
    """APScheduler 잡 실패 시 운영자 알림.

    이전에는 잡이 실패해도 PM2 로그(로테이트로 며칠 뒤 소멸)에만 남고 admin이
    알 방법이 없었다(admin_service_oversight_design_v1.0.md §3-A-G). Claude를
    호출하는 잡(weekly_post_draft_job 등)이 조용히 실패하면 사용자 문의가 오기
    전까지 아무도 모르는 문제였다 — send_operator_alert가 record_alert를 내부
    호출하므로 system_alerts 이력에도 함께 남는다.
    """
    job_id = event.job_id
    exc = event.exception
    detail = f"job_id={job_id}\nexception={exc}"
    logger.error(f"[scheduler] 잡 실패: {job_id}: {exc}")
    try:
        from services.email_sender import send_operator_alert
        asyncio.create_task(send_operator_alert(f"스케줄러 잡 실패: {job_id}", detail))
    except Exception as e:
        logger.warning(f"[scheduler] 잡 실패 알림 발송 준비 중 오류: {e}")


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
    - basic/startup : 월요일 1회만 풀스캔 (Gemini 100 + ChatGPT 100 + Naver + Google) — 나머지 날 스킵
    - pro           : 월·수·금 풀스캔 / 나머지 날 경량 스캔 (Gemini 50 + ChatGPT 50)
    - biz           : 매일 풀스캔
    """
    from db.supabase_client import get_client
    from services.ai_scanner.multi_scanner import MultiAIScanner
    from services.score_engine import calculate_score

    try:
        supabase = get_client()
        today = date.today()
        is_monday = today.weekday() == 0
        is_pro_scan_day = today.weekday() in (0, 2, 4)  # 월·수·금

        import os
        # ADMIN_USER_IDS: 관리자 UUID 목록 (쉼표 구분), 자동 스캔 제외용
        admin_user_ids = set(
            uid.strip()
            for uid in os.getenv("ADMIN_USER_IDS", "").split(",")
            if uid.strip()
        )

        # subscriptions!inner 조인은 FK 없어 PGRST200 에러 → 두 번 조회로 교체
        # grace_period(결제실패 유예)도 plan_gate.get_user_plan()이 유료로 취급하는 상태이므로
        # 자동 스캔 대상에 포함 — active만 필터하면 유예 중인 유료 구독자가 스캔에서 부당 제외됨
        _subs_res = await _db(
            supabase.table("subscriptions")
            .select("user_id, plan, status")
            .in_("status", ["active", "grace_period"])
            .in_("plan", ["basic", "pro", "biz", "startup"])
        )
        _active_subs = {s["user_id"]: s["plan"] for s in (_subs_res.data or [])}
        _biz_res = await _db(
            supabase.table("businesses")
            .select("*")
            .in_("user_id", list(_active_subs.keys()) or ["__none__"])
        )
        # 각 사업장에 플랜 정보 병합
        businesses = []
        for _b in (_biz_res.data or []):
            _b["subscriptions"] = {"plan": _active_subs.get(_b["user_id"], "basic"), "status": "active"}
            businesses.append(_b)

        # 관리자 계정은 자동 스캔 대상에서 명시적으로 제외
        if admin_user_ids:
            before_count = len(businesses)
            businesses = [biz for biz in businesses if biz.get("user_id") not in admin_user_ids]
            logger.info(f"daily_scan_all: 관리자 {before_count - len(businesses)}개 사업장 제외")
        logger.info(f"daily_scan_all: 스캔 대상 {len(businesses)}개 사업장")

        basic_scanner = MultiAIScanner(mode="basic")
        full_scanner  = MultiAIScanner(mode="full")

        _naver_captcha_count = 0  # 연속 캡챠 감지 카운터 — 2회 이상 시 당일 네이버 스캔 중단

        for i, biz in enumerate(businesses):
            try:
                plan = (biz.get("subscriptions") or {}).get("plan", "basic")
                keywords = biz.get("keywords") or []
                # 요일별 키워드 순환: 등록된 키워드를 하루씩 바꿔가며 스캔
                # → 월=keyword[0], 화=keyword[1], 수=keyword[2] ... 모든 키워드가 주 1회 이상 스캔
                valid_kws = [k.strip() for k in keywords if k.strip() and len(k.strip()) >= 2]
                weekday = datetime.now().weekday()  # 0=월, 1=화, ..., 6=일
                # 짧은 변형 + 긴 자연어 질의(롱테일 2.5배 대응) 단일 소스 — 첫 요소는 짧은 쿼리(naver용)
                _scan_kw = valid_kws[weekday % len(valid_kws)] if valid_kws else biz["category"]
                _scan_queries = _build_ai_scan_queries(biz["region"], _scan_kw)
                query = _scan_queries[0]  # 단일 쿼리 문자열 — naver·single_check·query_used 저장용

                # GitHub Actions prescan 결과 재사용 (naver_prescan 테이블, 있으면 네이버 재스캔 생략)
                # github_naver_scan.py가 01:00 KST에 실행 → 이 함수(02:00 KST) 도달 시 이미 저장됨
                _prescan_naver: dict = {}
                try:
                    _ps = supabase.table("naver_prescan").select("naver_result").eq(
                        "business_id", biz["id"]
                    ).eq("scan_date", str(today)).execute()
                    if _ps and _ps.data:
                        _prescan_naver = _ps.data[0].get("naver_result") or {}
                        if _prescan_naver:
                            logger.debug("[daily_scan_all] naver prescan 재사용 biz=%s", biz.get("id"))
                except Exception as _pe:
                    logger.debug("[daily_scan_all] naver_prescan 조회 실패 (테이블 없으면 무시): %s", _pe)

                # 플랜별 스캐너 선택 (plan_gate.py auto_scan_mode 기준)
                # basic/startup: 월요일만 풀스캔 — 나머지 날 스킵 (UI "주 1회 자동 AI 진단"과 일치)
                # pro:           월·수·금 → 풀스캔 / 나머지 → 경량 스캔 (주 3회 풀스캔)
                # biz: 매일 풀스캔
                if plan in ("basic", "startup") and not is_monday:
                    logger.debug("[daily_scan_all] basic/startup 비월요일 스킵 biz=%s", biz.get("id"))
                    continue
                elif plan == "pro" and not is_pro_scan_day:
                    result = await basic_scanner.scan_basic(_scan_queries, biz["name"])
                else:
                    result = await full_scanner.scan_all(_scan_queries, biz["name"])

                # GitHub Actions prescan 결과가 있으면 서버 스캔 결과를 덮어쓰기
                if _prescan_naver:
                    result["naver"] = _prescan_naver

                # prescan의 SmartPlace 완성도 결과 적용 (피드·정보 탭 차단 우회)
                _prescan_sp = _prescan_naver.get("smart_place_check") or {}
                if _prescan_sp and not _prescan_sp.get("error"):
                    _sp_biz_upd: dict = {}
                    if _prescan_sp.get("recent_post_measured"):
                        _sp_biz_upd["has_recent_post"] = _prescan_sp["has_recent_post"]
                    if _prescan_sp.get("intro_measured"):
                        _sp_biz_upd["has_intro"] = _prescan_sp["has_intro"]
                    if _sp_biz_upd:
                        try:
                            supabase.table("businesses").update(_sp_biz_upd).eq("id", biz["id"]).execute()
                            logger.debug("[daily_scan_all] SmartPlace prescan businesses 업데이트 biz=%s", biz.get("id"))
                        except Exception as _sp_upd_err:
                            logger.warning("[daily_scan_all] SmartPlace prescan DB 업데이트 실패: %s", _sp_upd_err)

                # 네이버 캡챠 연속 감지 시 당일 네이버 스캔 조기 중단
                _naver_result = result.get("naver") or {}
                if _naver_result.get("captcha_detected"):
                    _naver_captcha_count += 1
                    if _naver_captcha_count >= 2:
                        logger.warning(
                            "[daily_scan_all] 네이버 캡챠 연속 %d회 감지 — 당일 네이버 스캔 중단 (IP 차단 방어)",
                            _naver_captcha_count,
                        )
                        await send_slack_alert(
                            "네이버 스캔 IP 차단 감지",
                            f"연속 {_naver_captcha_count}회 captcha 감지 — 남은 사업장 네이버 스캔 건너뜀. 내일 재시도.",
                            level="warning",
                        )
                        break
                else:
                    _naver_captcha_count = 0  # 정상 응답 시 카운터 리셋

                # 블로그 covered 키워드를 biz에 병합해 keyword_gap 정확도 향상
                _sched_blog_json = biz.get("blog_analysis_json") or {}
                _sched_blog_covered = (_sched_blog_json.get("keyword_coverage") or {}).get("present") or []
                if isinstance(_sched_blog_covered, list) and _sched_blog_covered:
                    biz = {**biz, "blog_covered_keywords": " ".join(_sched_blog_covered)}
                _sched_blog_kw_cov = float(biz.get("blog_keyword_coverage") or 0)
                _sched_kw_rate = _sched_blog_kw_cov / 100 if _sched_blog_kw_cov >= 5 else None
                score = calculate_score(result, biz, keyword_coverage_rate=_sched_kw_rate)

                naver_channel = score.get("naver_channel_score")
                global_channel = score.get("global_channel_score")

                # ── 블로그 자동 재분석 (blog_url 있고 14일 이상 미분석 시) ─────────
                try:
                    _blog_url = biz.get("blog_url") or ""
                    _blog_analyzed_at = biz.get("blog_analyzed_at")
                    if _blog_url:
                        _needs_reanalyze = True
                        if _blog_analyzed_at:
                            from datetime import timezone as _tz
                            _analyzed_dt = (
                                datetime.fromisoformat(_blog_analyzed_at.replace("Z", "+00:00"))
                                if isinstance(_blog_analyzed_at, str)
                                else _blog_analyzed_at
                            )
                            _days_since = (datetime.now(_tz.utc) - _analyzed_dt.replace(tzinfo=_tz.utc) if _analyzed_dt.tzinfo is None else datetime.now(_tz.utc) - _analyzed_dt).days
                            _needs_reanalyze = _days_since >= 14
                        if _needs_reanalyze:
                            from services.blog_analyzer import analyze_blog as _analyze_blog
                            _blog_result = await _analyze_blog(
                                blog_url=_blog_url,
                                business_name=biz.get("name", ""),
                                category=biz.get("category", ""),
                                region=biz.get("region", ""),
                                business_id=biz["id"],
                            )
                            if _blog_result and not _blog_result.get("error"):
                                logger.info(f"[scheduler] 블로그 자동 재분석 완료: biz={biz['id']}")
                except Exception as _blog_err:
                    logger.warning(f"[scheduler] 블로그 재분석 실패 biz={biz['id']}: {_blog_err}")

                # ── 경쟁사 스캔 (등록된 경쟁사가 있을 때만, 비용 절감) ───────────
                competitor_scores: dict = {}
                try:
                    _comp_res2 = await _db(
                        supabase.table("competitors")
                        .select("id, name")
                        .eq("business_id", biz["id"])
                        .eq("is_active", True)
                    )
                    comp_rows = _comp_res2.data or []

                    if comp_rows:
                        from services.ai_scanner.gemini_scanner import GeminiScanner
                        _gemini = GeminiScanner()
                        comp_results = await asyncio.gather(
                            *[_gemini.single_check(query, c["name"]) for c in comp_rows],
                            return_exceptions=True,
                        )
                        for comp, cr in zip(comp_rows, comp_results):
                            if isinstance(cr, Exception):
                                logger.warning(
                                    f"[scheduler] 경쟁사 단일 스캔 예외 "
                                    f"comp={comp['name']}: {cr}"
                                )
                                continue
                            if not cr.get("_measured", True):
                                # API 오류·타임아웃 — "미노출"로 확정하지 않고 이번 배치 갱신을 생략
                                logger.warning(
                                    f"[scheduler] 경쟁사 측정 실패, 갱신 생략 — "
                                    f"comp={comp['name']}: {cr.get('_error')}"
                                )
                                continue
                            is_mentioned = (cr.get("exposure_freq") or 0) > 0
                            excerpt = cr.get("excerpt") or ""
                            # Gemini 단일 스캔 결과로 간이 점수 추정 (random 제거)
                            # cr은 gemini single_check 반환 dict — naver 데이터 없으므로
                            # mentioned / excerpt 길이 기반 속성을 naver_result 포맷으로 변환
                            _naver_proxy = {
                                "mentioned": is_mentioned,
                                "mentioned_in_briefing": is_mentioned,
                                "has_blog_post": bool(excerpt and len(excerpt) > 100),
                                "review_count": cr.get("review_count", 0) or 0,
                                "rating": cr.get("rating", 0) or 0,
                                "is_smart_place": cr.get("is_smart_place", False),
                            }
                            comp_score = round(_estimate_competitor_score(_naver_proxy), 1)
                            competitor_scores[comp["id"]] = {
                                "name": comp["name"],
                                "mentioned": is_mentioned,
                                "score": comp_score,
                                "excerpt": excerpt,
                                "region": biz.get("region", ""),
                            }
                except Exception as e:
                    logger.warning(
                        f"[scheduler] 경쟁사 스캔 실패 biz={biz['id']}: {e}"
                    )
                # ────────────────────────────────────────────────────────────────

                # naver AI탭 결과 추출 — result["naver_ai_tab"] = {query: {mentioned, excerpt, ...}}
                _ai_tab_raw = result.get("naver_ai_tab") or {}
                _sched_ai_tab_visible: "bool | None" = None
                _sched_ai_tab_excerpt: "str | None" = None
                if _ai_tab_raw:
                    _sched_ai_tab_visible = any(v.get("mentioned") for v in _ai_tab_raw.values() if v)
                    for _v in _ai_tab_raw.values():
                        if _v and _v.get("mentioned") and _v.get("excerpt"):
                            _sched_ai_tab_excerpt = (_v["excerpt"] or "")[:500] or None
                            break
                    if _sched_ai_tab_excerpt is None:
                        for _v in _ai_tab_raw.values():
                            if _v and _v.get("excerpt"):
                                _sched_ai_tab_excerpt = (_v["excerpt"] or "")[:500] or None
                                break

                # 이번 스캔이 경량 스캔(scan_basic)이었거나 AI탭 측정이 실패해 None이면
                # 최근 실측값을 carry-forward — "측정 예정"으로 되돌아가 보이는 플리커 방지
                if _sched_ai_tab_visible is None:
                    from services.ai_scanner.naver_ai_tab_scanner import get_last_known_visibility
                    _sched_ai_tab_visible, _sched_ai_tab_excerpt = await get_last_known_visibility(biz["id"])

                _insert_res = await _db(
                    supabase.table("scan_results").insert(
                        {
                            "business_id": biz["id"],
                            "query_used": query,
                            "gemini_result": result.get("gemini"),
                            "chatgpt_result": result.get("chatgpt"),
                            "naver_result": result.get("naver"),
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
                            "competitor_scores": competitor_scores if competitor_scores else None,
                            "blog_post_count": int(_sched_blog_json.get("post_count") or 0) or None,
                            "blog_ai_readiness": float(_sched_blog_json.get("ai_readiness_score") or 0) or None,
                            "blog_keyword_coverage": float(_sched_blog_json.get("keyword_coverage") or 0) or None,
                            "blog_platform": _sched_blog_json.get("platform") or None,
                            "blog_top_recommendation": (_sched_blog_json.get("top_recommendation") or "")[:500] or None,
                            "smart_place_completeness_result": (_prescan_sp if _prescan_sp and not _prescan_sp.get("error") else None),
                            "naver_ai_tab_visible": _sched_ai_tab_visible,
                            "naver_ai_tab_excerpt": _sched_ai_tab_excerpt,
                        }
                    )
                )
                scan_row = _insert_res.data

                # ai_citations 저장 (자동 스캔 결과도 누적 — weekly_digest/keyword_alert 데이터 정확도)
                _new_scan_id = scan_row[0]["id"] if (scan_row and scan_row[0]) else None
                if _new_scan_id:
                    citation_rows = []
                    for _key in ("gemini", "chatgpt", "naver", "google"):
                        r = result.get(_key) or {}
                        if not r:
                            continue
                        if _key == "naver" and r.get("keyword_results"):
                            for kw_r in r["keyword_results"]:
                                citation_rows.append({
                                    "scan_id": _new_scan_id,
                                    "business_id": biz["id"],
                                    "platform": "naver",
                                    "query": kw_r.get("_query_used") or query,
                                    "mentioned": bool(kw_r.get("in_briefing")),
                                    "excerpt": (kw_r.get("excerpt") or "").strip()[:500],
                                    "sentiment": "neutral",
                                    "mention_type": "information",
                                })
                        elif "mentioned" in r or "exposure_freq" in r:
                            _mentioned = bool(r.get("mentioned")) or (r.get("exposure_freq", 0) > 0)
                            _excerpt_src = r.get("excerpt") or r.get("content")
                            if not _excerpt_src and r.get("citations"):
                                _excerpt_src = r["citations"][0] if r["citations"] else ""
                            citation_rows.append({
                                "scan_id": _new_scan_id,
                                "business_id": biz["id"],
                                "platform": _key,
                                "query": query,
                                "mentioned": _mentioned,
                                "excerpt": (_excerpt_src or "").strip()[:500],
                                "sentiment": r.get("sentiment") or "neutral",
                                "mention_type": r.get("mention_type") or "information",
                            })
                    if citation_rows:
                        try:
                            # 멱등성: 동일 scan_id 행이 이미 있으면 INSERT 건너뜀
                            _exist = await _db(
                                supabase.table("ai_citations")
                                .select("id")
                                .eq("scan_id", _new_scan_id)
                                .limit(1)
                            )
                            if not (_exist and _exist.data):
                                await _db(supabase.table("ai_citations").insert(citation_rows))
                        except Exception as _cit_err:
                            logger.warning(f"[scheduler] ai_citations insert 실패 biz={biz['id']}: {_cit_err}")

                # ── v3.1 Shadow 점수 계산 + scan_results v31 컬럼 업데이트 ──────
                _shadow_v31: dict = {}
                if _new_scan_id:
                    try:
                        from services.score_engine import calc_shadow_v3_1 as _calc_shadow
                        _shadow_v31 = _calc_shadow(
                            scan_result=result,
                            biz=biz,
                            naver_data=result.get("naver") or {},
                            keyword_coverage_rate=_sched_kw_rate,
                        )
                        await _db(
                            supabase.table("scan_results").update({
                                "track1_score_v31": _shadow_v31["track1_score_v31"],
                                "unified_score_v31": _shadow_v31["unified_score_v31"],
                                "user_group_v31": _shadow_v31["user_group_v31"],
                            }).eq("id", _new_scan_id)
                        )
                    except Exception as _sv_err:
                        logger.warning(
                            f"[daily_scan_all] v3.1 shadow 저장 실패 biz={biz.get('id')}: {_sv_err}"
                        )
                # ─────────────────────────────────────────────────────────────────

                # score_history 기록 (30일 추세용)
                today_str = str(date.today())
                _prev_res = await _db(
                    supabase.table("score_history")
                    .select("total_score, track1_score")
                    .eq("business_id", biz["id"])
                    .order("score_date", desc=True)
                    .limit(1)
                )
                prev_history = _prev_res.data or []
                weekly_change = 0.0
                if prev_history:
                    weekly_change = round(score["total_score"] - prev_history[0]["total_score"], 2)
                _history_row: dict = {
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
                }
                # v31 Shadow 점수 — DB 컬럼 미존재 시 graceful fallback
                if _shadow_v31:
                    _history_row["track1_score_v31"] = _shadow_v31.get("track1_score_v31")
                    _history_row["unified_score_v31"] = _shadow_v31.get("unified_score_v31")
                try:
                    await _db(
                        supabase.table("score_history").upsert(
                            _history_row,
                            on_conflict="business_id,score_date",
                        )
                    )
                except Exception as _sh_err:
                    if "v31" in str(_sh_err).lower() or "column" in str(_sh_err).lower():
                        # v31 컬럼 미존재 — 제외 후 재시도
                        logger.warning(
                            f"[daily_scan_all] score_history v31 컬럼 없음, 제외 재시도 biz={biz.get('id')}: {_sh_err}"
                        )
                        _history_row.pop("track1_score_v31", None)
                        _history_row.pop("unified_score_v31", None)
                        await _db(
                            supabase.table("score_history").upsert(
                                _history_row,
                                on_conflict="business_id,score_date",
                            )
                        )
                    else:
                        raise

                # rank_in_category 계산 — 자동 스캔 경로도 카테고리 내 전 사업장 최신 점수 기준으로 채움
                # (누락 시 market_position.my_rank가 자동 스캔 사용자 전체에서 항상 비어있게 됨)
                try:
                    from routers.scan import _calc_rank_in_category
                    _rank, _total = await _calc_rank_in_category(
                        supabase, biz.get("category", ""), biz["id"], score["total_score"],
                    )
                    await _db(
                        supabase.table("score_history").update({
                            "rank_in_category": _rank,
                            "total_in_category": _total,
                        }).eq("business_id", biz["id"]).eq("score_date", today_str)
                    )
                except Exception as _rank_err:
                    logger.warning(f"[daily_scan_all] rank_in_category 계산 실패 biz={biz.get('id')}: {_rank_err}")

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
                            if _KAKAO_CONFIGURED:
                                try:
                                    from services.kakao_notify import KakaoNotifier as _KN
                                    _notifier = _KN()
                                    _phone_res = await _db(
                                        supabase.table("profiles").select("phone")
                                        .eq("user_id", biz.get("user_id")).single()
                                    )
                                    _phone = (_phone_res.data or {}).get("phone")
                                    if _phone and hasattr(_notifier, "send_growth_stage_upgrade"):
                                        await _notifier.send_growth_stage_upgrade(
                                            _phone, biz["name"],
                                            prev_stage.stage_label, current_stage.stage_label,
                                            current_stage.this_week_action,
                                        )
                                except Exception as _ke:
                                    logger.warning(f"GrowthStage 카카오 알림 실패 ({biz.get('name')}): {_ke}")
                except Exception as _ge:
                    logger.warning(f"GrowthStage 감지 실패 (biz={biz.get('name')}): {_ge}")

                # ── 점수 급변 자동 로그 (TrendLine 이벤트 오버레이용) ───────────────
                try:
                    _uni_new = score.get("unified_score")
                    new_unified = float(_uni_new if _uni_new is not None else (score.get("total_score") or 0))
                    if prev_history:
                        _uni_old = prev_history[0].get("unified_score")
                        old_unified = float(_uni_old if _uni_old is not None else (prev_history[0].get("total_score") or 0))
                    else:
                        old_unified = 0.0
                    await _auto_log_score_change(supabase, biz["id"], new_unified, old_unified)
                except Exception as _ale:
                    logger.warning(f"auto_log_score 호출 실패 biz={biz.get('id')}: {_ale}")

                # ── 경쟁사 역전 자동 로그 ─────────────────────────────────────────
                try:
                    if competitor_scores:
                        _uni_my = score.get("unified_score")
                        my_s = float(_uni_my if _uni_my is not None else (score.get("total_score") or 0))
                        for _cid, _cdata in competitor_scores.items():
                            await _auto_log_competitor_overtake(
                                supabase,
                                biz["id"],
                                _cdata.get("name", "경쟁사"),
                                my_s,
                                float(_cdata.get("score", 0)),
                            )
                except Exception as _cle:
                    logger.warning(f"auto_log_competitor 호출 실패 biz={biz.get('id')}: {_cle}")

                # 첫 AI 노출 감지 알림
                try:
                    await _check_first_exposure(
                        supabase, biz["id"], biz.get("name", ""), biz.get("user_id", ""),
                        {"gemini_result": result.get("gemini", {})},
                    )
                except Exception as _fe:
                    logger.warning(f"_check_first_exposure 호출 실패 biz={biz.get('id')}: {_fe}")

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
        await send_slack_alert("daily_scan_all 실패", str(e), level="error")

    # 경쟁사 점수 급등 FOMO 알림 (스캔 완료 후 실행, try-except 외부)
    try:
        await _detect_competitor_score_spike()
    except Exception as _spike_e:
        logger.warning(f"_detect_competitor_score_spike 호출 실패: {_spike_e}")


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
    _hist_res = await _db(
        supabase.table("score_history")
        .select("total_score, score_date, rank_in_category")
        .eq("business_id", biz_id)
        .order("score_date", desc=True)
        .limit(2)
    )
    history = _hist_res.data or []
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
        _cit_res = await _db(
            supabase.table("ai_citations")
            .select("platform, query, excerpt")
            .eq("business_id", biz_id)
            .eq("mentioned", True)
            .gte("created_at", str(date.today() - timedelta(days=1)))
            .limit(1)
        )
        citations = _cit_res.data or []
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
        _scan_res = await _db(
            supabase.table("scan_results")
            .select("competitor_scores, total_score")
            .eq("business_id", biz_id)
            .order("scanned_at", desc=True)
            .limit(2)
        )
        latest_scan = _scan_res.data or []
        if len(latest_scan) >= 2:
            curr_scores = latest_scan[0].get("competitor_scores") or {}
            prev_scores = latest_scan[1].get("competitor_scores") or {}
            for comp_id, curr_data in curr_scores.items():
                prev_data = prev_scores.get(comp_id, {})
                prev_s = prev_data.get("score", 0)
                curr_s = curr_data.get("score", 0)
                delta = curr_s - prev_s
                if abs(delta) >= 5:
                    comp_name_str = curr_data.get("name", "경쟁사")
                    await notifier.send_competitor_change(
                        phone, biz_name,
                        comp_name_str,
                        int(delta),
                    )
                    break  # 첫 번째 변화만 알림

    # 4. 이달 할 일 알림 (가이드 최신 항목 3개)
    if phone:
        _guide_res = await _db(
            supabase.table("guides")
            .select("items_json")
            .eq("business_id", biz_id)
            .order("generated_at", desc=True)
            .limit(1)
        )
        guide = _guide_res.data or []
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
        _ls_res = await _db(
            supabase.table("scan_results")
            .select("total_score, competitor_scores, score_breakdown")
            .eq("business_id", biz_id)
            .order("scanned_at", desc=True)
            .limit(1)
        )
        latest_scan = _ls_res.data or []
        if latest_scan:
            scan = latest_scan[0]
            my_score = float(scan.get("total_score", 0))
            comp_scores: dict = scan.get("competitor_scores") or {}

            _cr_res = await _db(
                supabase.table("competitors")
                .select("id, name")
                .eq("business_id", biz_id)
                .eq("is_active", True)
            )
            comp_rows = _cr_res.data or []
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



async def _check_first_exposure(
    supabase,
    biz_id: str,
    biz_name: str,
    user_id: str,
    scan_result: dict,
) -> None:
    """처음으로 AI에 노출된 사업장 감지 -> 카카오/이메일 알림"""
    try:
        exposure_freq = (scan_result.get("gemini_result") or {}).get("exposure_freq", 0) or 0
        if exposure_freq <= 0:
            return

        # 이미 알림 보낸 사업장인지 확인 (중복 방지)
        biz_res = await _db(
            supabase.table("businesses")
            .select("first_exposure_notified_at")
            .eq("id", biz_id)
            .single()
        )
        if not (biz_res and biz_res.data):
            return
        if biz_res.data.get("first_exposure_notified_at"):
            return  # 이미 알림 발송됨

        # 프로필에서 phone 조회 + auth.admin에서 email 조회
        prof_res = await _db(
            supabase.table("profiles")
            .select("phone")
            .eq("user_id", user_id)
            .single()
        )
        prof = (prof_res.data or {}) if prof_res else {}
        phone = prof.get("phone")
        # email은 auth.users에 있음 (profiles 테이블에 email 컬럼 없음)
        email = ""
        try:
            import asyncio as _asyncio_fe
            _auth_resp = await _asyncio_fe.to_thread(
                lambda: supabase.auth.admin.get_user_by_id(user_id)
            )
            if _auth_resp and _auth_resp.user:
                email = _auth_resp.user.email or ""
        except Exception as _ae:
            logger.debug(f"_check_first_exposure auth email 조회 실패 ({biz_name}): {_ae}")

        platform = "네이버 AI 브리핑"

        # 카카오 알림 (phone 있을 때)
        if phone and _KAKAO_CONFIGURED:
            try:
                from services.kakao_notify import KakaoNotifier as _KN
                _notifier = _KN()
                await _notifier.send_first_exposure(phone, biz_name, platform)
            except Exception as _ke:
                logger.warning(f"_check_first_exposure 카카오 실패 ({biz_name}): {_ke}")

        # 이메일 알림
        if email:
            try:
                from services.email_sender import send_first_exposure_email
                await send_first_exposure_email(email, biz_name, platform)
            except Exception as _ee:
                logger.warning(f"_check_first_exposure 이메일 실패 ({biz_name}): {_ee}")

        # businesses.first_exposure_notified_at 업데이트
        try:
            from datetime import timezone
            now_iso = datetime.now(timezone.utc).isoformat()
            await _db(
                supabase.table("businesses")
                .update({"first_exposure_notified_at": now_iso})
                .eq("id", biz_id)
            )
            logger.info(f"first_exposure 알림 완료: {biz_name} (biz_id={biz_id})")
        except Exception as _ue:
            logger.warning(f"_check_first_exposure DB update 실패 ({biz_name}): {_ue}")

    except Exception as e:
        logger.warning(f"_check_first_exposure 실패 ({biz_name}): {e}")


async def weekly_kakao_notify():
    """Basic 구독자 주간 카카오톡 알림 (월요일 오전 9시)
    Pro+ 구독자는 daily_kakao_notify가 매일 처리.
    """
    if not _KAKAO_CONFIGURED:
        logger.debug("weekly_kakao_notify: KAKAO_APP_KEY/SENDER_KEY 미설정, 스킵")
        return

    from db.supabase_client import get_client
    from services.kakao_notify import KakaoNotifier

    try:
        supabase = get_client()
        notifier = KakaoNotifier()

        _u_res = await _db(
            supabase.table("subscriptions")
            .select("user_id, plan, profiles(phone), businesses(*)")
            .eq("status", "active")
            .in_("plan", ["basic"])
        )
        users = _u_res.data or []

        for user in users:
            try:
                await _send_kakao_notifications(supabase, notifier, user)
            except Exception as e:
                logger.error(f"Notify failed for user: {e}")

    except Exception as e:
        logger.error(f"weekly_kakao_notify failed: {e}")
        await send_slack_alert("weekly_kakao_notify 실패", str(e), level="error")

    # ── 리뷰 인박스 알림: 새 리뷰 발췌문이 있는 사용자에게 재방문 유도 ──────
    try:
        from db.supabase_client import get_client as _get_client_review, _db as _db_r
        from datetime import datetime, timedelta
        supabase_r = _get_client_review()
        review_notif_result = await _db_r(
            supabase_r.table("scan_results")
            .select("business_id, naver_result, scanned_at")
            .gte("scanned_at", (datetime.utcnow() - timedelta(days=7)).isoformat())
        )
        for row in (review_notif_result.data or []):
            try:
                naver = row.get("naver_result") or {}
                reviews = naver.get("reviews") or naver.get("review_excerpts") or []
                if not reviews:
                    continue
                new_review_count = len(reviews)
                bid = row["business_id"]
                biz_row = await _db_r(
                    supabase_r.table("businesses")
                    .select("user_id, name")
                    .eq("id", bid)
                    .single()
                )
                if not (biz_row and biz_row.data):
                    continue
                biz_data = biz_row.data
                prof = await _db_r(
                    supabase_r.table("profiles")
                    .select("phone, kakao_scan_notify")
                    .eq("user_id", biz_data["user_id"])
                    .single()
                )
                if not (prof and prof.data):
                    continue
                phone = prof.data.get("phone")
                if not phone:
                    continue
                biz_name = biz_data.get("name", "내 가게")
                msg = (
                    f"이번 주 {biz_name}에 고객 리뷰가 {new_review_count}개 달렸습니다.\n"
                    f"AI 최적화 답변 초안을 확인해보세요.\n"
                    f"→ https://aeolab.co.kr/guide"
                )
                notifier_r = KakaoNotifier()
                await notifier_r.send_text(phone, msg)
            except Exception as row_e:
                logger.warning(f"review inbox notify row failed: {row_e}")
    except Exception as e:
        logger.warning(f"review inbox notify failed: {e}")


async def daily_kakao_notify():
    """Pro/Biz/Enterprise/Startup 구독자 일별 카카오톡 알림 (매일 오전 9시)"""
    if not _KAKAO_CONFIGURED:
        logger.debug("daily_kakao_notify: KAKAO_APP_KEY/SENDER_KEY 미설정, 스킵")
        return

    from db.supabase_client import get_client
    from services.kakao_notify import KakaoNotifier

    try:
        supabase = get_client()
        notifier = KakaoNotifier()

        _u_res2 = await _db(
            supabase.table("subscriptions")
            .select("user_id, plan")
            .eq("status", "active")
            .in_("plan", ["pro", "biz", "startup"])
        )
        subs_data = _u_res2.data or []

        for sub in subs_data:
            try:
                uid = sub["user_id"]
                # profiles phone 별도 조회 (subscriptions↔profiles FK 미등록)
                _ph_res = await _db(
                    supabase.table("profiles").select("phone").eq("user_id", uid).limit(1)
                )
                _biz_res = await _db(
                    supabase.table("businesses")
                    .select("id, name, category, region")
                    .eq("user_id", uid)
                    .eq("is_active", True)
                    .limit(1)
                )
                user = {
                    "user_id": uid,
                    "plan": sub["plan"],
                    "profiles": (_ph_res.data or [{}])[0],
                    "businesses": _biz_res.data or [],
                }
                await _send_kakao_notifications(supabase, notifier, user)
            except Exception as e:
                logger.error(f"Daily notify failed for user: {e}")

    except Exception as e:
        logger.error(f"daily_kakao_notify failed: {e}")
        await send_slack_alert("daily_kakao_notify 실패", str(e), level="error")


async def subscription_lifecycle_job():
    """매일 오전 1시: 구독 만료/갱신/정지 처리"""
    from db.supabase_client import get_client
    from services.toss_billing import retry_billing, compute_renewal_amount
    from services.kakao_notify import KakaoNotifier
    from utils.payment_event_log import find_recent_success_event

    # 이중 청구 방지: retry_billing(Toss 청구) 성공 후 바로 아래 status/end_at 갱신이
    # 실패하면(예: Supabase 일시 오류) 그 구독 행이 그대로 "만료됨"으로 남아, 다음날
    # 이 잡이 다시 돌 때 같은 구독을 또 결제 대상으로 골라 재청구할 수 있었다
    # (2026-07-11, settings.py update_card·webhook.py issue_billing과 동일 패턴 발견).
    # 매일 1회 실행되는 잡이라 24시간보다 짧은 20시간 창으로 "어제 이미 성공한 결제"를 재사용.
    RENEWAL_DEDUP_WINDOW_MIN = 20 * 60

    async def _charge_once(sub: dict) -> bool:
        expected_amount = compute_renewal_amount(sub)
        if await find_recent_success_event(sub.get("user_id"), "renewal", expected_amount, window_minutes=RENEWAL_DEDUP_WINDOW_MIN):
            logger.warning(f"subscription_lifecycle_job 이중청구 방지 — 최근 성공 이벤트 재사용 (sub={sub.get('id')})")
            return True
        return await retry_billing(sub)

    try:
        supabase = get_client()
        notifier = KakaoNotifier()
        today = date.today()

        # 1. 7일 후 만료 예정 → 갱신 안내 알림 (정확일치 — 2일 폭 윈도우는 매 구독자에게 반드시
        # 이틀 연속 중복발송되는 자체 버그였음(2026-07-07 자체점검에서 발견해 되돌림). end_at을
        # 이제 전부 날짜단위로 통일했으므로 .eq() 단순 정확일치로도 안정적으로 매칭됨 — §2(갱신)와
        # 달리 이 알림은 하루 놓쳐도 다음날 재고지되지 않는 대신 중복발송도 없는 편이 안전.
        # subscriptions↔profiles FK 미등록 → embedded join(profiles(phone)) 불가, 매 실행 PGRST200으로
        # 잡 전체가 죽던 버그(2026-07-07 발견, jobs.py:2064 send_trial_day5_reminder와 동일 원인) —
        # user_id로 분리 조회 후 dict lookup 패턴으로 통일
        _exp_res = await _db(
            supabase.table("subscriptions")
            .select("*")
            .eq("status", "active")
            .eq("end_at", str(today + timedelta(days=7)))
        )
        expiring_soon = _exp_res.data or []

        # 2. 오늘(또는 그 이전 — 배치 누락분 포함) 만료 → 갱신 시도 (토스 자동결제)
        # .eq(today)였던 예전 코드는 하루라도 못 돌면 해당 행을 영구히 못 찾는 P0 버그였음(2026-07-07 발견)
        # .lte()로 전환하면 갱신 성공 직후 status가 바뀌어 보통은 중복 처리되지 않지만, 그 상태
        # 갱신 자체가 실패하는 경우(Toss 청구는 성공, DB 저장만 실패)엔 다음날 재선택돼 재청구
        # 위험이 있었음(2026-07-11 발견) — _charge_once()의 이중청구 방지 가드로 대응
        _expired_res = await _db(
            supabase.table("subscriptions")
            .select("*")
            .eq("status", "active")
            .lte("end_at", str(today))
        )
        expired_today = _expired_res.data or []

        # 3. 유예 기간 중 매일 1회 재시도 — 오늘 막 §2에서 진입한 건은 방금 시도했으므로 제외
        # (카드 일시 오류로 실패한 경우 3일 내내 재시도 없이 정지만 기다리던 버그 수정, 2026-07-06)
        _grace_res = await _db(
            supabase.table("subscriptions")
            .select("*")
            .eq("status", "grace_period")
        )
        grace_subs_all = _grace_res.data or []

        # profiles.phone 일괄 조회 (subscriptions↔profiles FK 미등록이라 IN 쿼리로 분리)
        all_user_ids = list({
            s["user_id"] for s in (expiring_soon + expired_today + grace_subs_all) if s.get("user_id")
        })
        phone_by_user: dict = {}
        if all_user_ids:
            _phone_res = await _db(
                supabase.table("profiles").select("user_id, phone").in_("user_id", all_user_ids)
            )
            for p in (_phone_res.data or []):
                if p.get("phone"):
                    phone_by_user[p["user_id"]] = p["phone"]

        for sub in expiring_soon:
            phone = phone_by_user.get(sub.get("user_id"))
            if phone:
                await notifier.send_expire_warning(phone, sub["plan"], 7)

        # 1-B. 첫 달 50% 할인 종료 D-3 → 정상가 자동전환 사전고지
        # (legal_compliance_and_infra_resilience_audit_v1.0.md B축 P1, 전자상거래법 시행령 대응)
        # first_month_discount_until은 webhook.py issue_billing에서 가입 시점 1회만 기록되고
        # 이후 다시 쓰이지 않는 컬럼(grep 확인) — end_at 갱신 로직과 독립적이라 별도 조회로 처리.
        try:
            _price_up_res = await _db(
                supabase.table("subscriptions")
                .select("user_id, plan")
                .eq("status", "active")
                .eq("first_month_discount_until", str(today + timedelta(days=3)))
            )
            price_increase_soon = _price_up_res.data or []
            if price_increase_soon:
                from config.prices import PLAN_PRICE_MAP
                _pu_user_ids = [s["user_id"] for s in price_increase_soon if s.get("user_id")]
                _pu_phone_res = await _db(
                    supabase.table("profiles").select("user_id, phone").in_("user_id", _pu_user_ids)
                )
                pu_phone_by_user = {p["user_id"]: p["phone"] for p in (_pu_phone_res.data or []) if p.get("phone")}
                for sub in price_increase_soon:
                    phone = pu_phone_by_user.get(sub.get("user_id"))
                    if phone:
                        regular_price = PLAN_PRICE_MAP.get(sub.get("plan"), 9900)
                        await notifier.send_price_increase_notice(phone, regular_price)
        except Exception as e:
            logger.error(f"subscription_lifecycle_job 가격인상 사전고지 실패: {e}")

        just_entered_grace_ids: set = set()
        for sub in expired_today:
            try:
                success = await _charge_once(sub)
                renew_days = 365 if sub.get("billing_cycle") == "yearly" else 30
                if success:
                    new_end = today + timedelta(days=renew_days)
                    await _db(
                        supabase.table("subscriptions").update(
                            {"end_at": str(new_end), "status": "active"}
                        ).eq("id", sub["id"])
                    )
                    logger.info(f"Subscription renewed: {sub['id']}")
                else:
                    await _db(
                        supabase.table("subscriptions").update(
                            {"status": "grace_period", "grace_until": str(today + timedelta(days=3))}
                        ).eq("id", sub["id"])
                    )
                    just_entered_grace_ids.add(sub["id"])
                    phone = phone_by_user.get(sub.get("user_id"))
                    if phone:
                        await notifier.send_payment_failed(phone)
            except Exception as e:
                logger.error(f"Subscription renewal processing failed for {sub.get('id')}: {e}")

        grace_subs = [s for s in grace_subs_all if s["id"] not in just_entered_grace_ids]
        for sub in grace_subs:
            try:
                phone = phone_by_user.get(sub.get("user_id"))
                success = await _charge_once(sub)
                if success:
                    renew_days = 365 if sub.get("billing_cycle") == "yearly" else 30
                    new_end = today + timedelta(days=renew_days)
                    await _db(
                        supabase.table("subscriptions").update(
                            {"end_at": str(new_end), "status": "active", "grace_until": None}
                        ).eq("id", sub["id"])
                    )
                    if phone:
                        await notifier.send_payment_recovered(phone)
                    logger.info(f"Subscription recovered during grace period: {sub['id']}")
                    continue

                grace_until_str = sub.get("grace_until")
                if grace_until_str and str(grace_until_str) <= str(today):
                    # 유예 기간 만료 — 정지
                    await _db(
                        supabase.table("subscriptions").update(
                            {"status": "suspended"}
                        ).eq("id", sub["id"])
                    )
                    if phone:
                        await notifier.send_suspended(phone)
                    logger.info(f"Subscription suspended: {sub['id']}")
                else:
                    logger.info(f"Subscription still in grace period, retry failed: {sub['id']}")
            except Exception as e:
                logger.error(f"Grace period processing failed for {sub.get('id')}: {e}")

    except Exception as e:
        logger.error(f"subscription_lifecycle_job failed: {e}")
        await send_slack_alert("subscription_lifecycle_job 실패", str(e), level="error")


async def after_screenshot_job():
    """매일 오전 8시: 가입 후 7/14/30일 경과 사업장 After 스크린샷 자동 캡처
    (30→7일로 단축: 소상공인이 1주일 안에 개선 효과 확인 가능)
    """
    from db.supabase_client import get_client
    from services.screenshot import capture_batch, build_queries, capture_ai_result
    from services.before_after_card import generate_comparison_card
    from services.kakao_notify import KakaoNotifier
    import httpx

    try:
        supabase = get_client()
        notifier = KakaoNotifier()
        today = date.today()

        for days in [7, 14, 30]:
            target_date = today - timedelta(days=days)
            # subscriptions!inner 조인 PGRST200 에러 → 두 번 조회
            _as_subs = await _db(
                supabase.table("subscriptions").select("user_id").eq("status", "active")
            )
            _as_active_uids = [s["user_id"] for s in (_as_subs.data or [])]
            _as_biz_res = await _db(
                supabase.table("businesses")
                .select("*")
                .in_("user_id", _as_active_uids or ["__none__"])
                .gte("created_at", str(target_date))
                .lt("created_at", str(target_date + timedelta(days=1)))
            )
            businesses = _as_biz_res.data or []

            for biz in businesses:
                try:
                    queries = build_queries(biz)
                    # 네이버 블로그 After 스크린샷 — 올바른 capture_type 사용
                    # (capture_batch는 내부적으로 "before" 타입으로 저장하는 버그 있어 직접 호출)
                    after_urls = []
                    for _aq in queries[:2]:
                        try:
                            _au = await capture_ai_result("naver", _aq, biz["id"], f"after_{days}d_naver_blog")
                            after_urls.append(_au)
                        except Exception as _e:
                            logger.warning(f"[after_screenshot_job] capture_ai_result failed — {_e}")
                            after_urls.append(None)
                        await asyncio.sleep(3)

                    _br_res = await _db(
                        supabase.table("before_after")
                        .select("image_url")
                        .eq("business_id", biz["id"])
                        .eq("capture_type", "before")
                        .limit(1)
                    )
                    before_rows = _br_res.data or []

                    if not (before_rows and after_urls):
                        continue

                    async with httpx.AsyncClient(timeout=30) as c:
                        before_bytes = (await c.get(before_rows[0]["image_url"])).content
                        after_bytes = (await c.get(after_urls[0])).content

                    # 점수 변화 조회
                    _sh_res = await _db(
                        supabase.table("score_history")
                        .select("total_score")
                        .eq("business_id", biz["id"])
                        .order("score_date", desc=True)
                        .limit(2)
                    )
                    score_history = _sh_res.data or []
                    before_score = score_history[-1]["total_score"] if len(score_history) > 1 else 0
                    after_score = score_history[0]["total_score"] if score_history else 0

                    card = await generate_comparison_card(
                        before_bytes, after_bytes,
                        biz["name"], before_score, after_score,
                    )

                    # Supabase Storage 업로드 (storage는 동기 유지 — blocking 짧음)
                    card_path = f"cards/{biz['id']}/{days}d.png"
                    supabase.storage.from_("before-after").upload(
                        card_path, card, {"content-type": "image/png", "upsert": "true"}
                    )
                    card_url = supabase.storage.from_("before-after").get_public_url(card_path)

                    # DB 기록 — 네이버 블로그 After 비교 카드
                    await _db(
                        supabase.table("before_after").insert({
                            "business_id": biz["id"],
                            "capture_type": f"after_{days}d",
                            "image_url": card_url,
                        })
                    )

                    # 네이버 AI 브리핑 After 스크린샷 — ACTIVE/LIKELY 업종만
                    from services.screenshot import _needs_naver_ai_shot
                    if _needs_naver_ai_shot(biz.get("category", ""), bool(biz.get("is_franchise"))):
                        try:
                            for q in queries[:2]:
                                ai_url = await capture_ai_result("naver_ai", q, biz["id"], f"after_{days}d_naver_ai")
                                if ai_url:
                                    await _db(
                                        supabase.table("before_after").insert({
                                            "business_id": biz["id"],
                                            "capture_type": f"after_{days}d_naver_ai",
                                            "image_url": ai_url,
                                            "query_used": q,
                                        })
                                    )
                                await asyncio.sleep(3)
                        except Exception as e_ai:
                            logger.warning(f"naver_ai after screenshot failed for {biz.get('name')}: {e_ai}")
                    else:
                        logger.info(f"naver_ai after screenshot skipped (INACTIVE): {biz.get('name')}")

                    # AI탭 After 스크린샷 — 모든 업종 (P2 — NAVER_AI_TAB_ENABLED=true 시 실행)
                    import os as _os_tab
                    if _os_tab.getenv("NAVER_AI_TAB_ENABLED", "false").lower() == "true":
                        try:
                            for q in queries[:2]:
                                ai_tab_url = await capture_ai_result("naver_ai_tab", q, biz["id"], f"after_{days}d_ai_tab")
                                if ai_tab_url:
                                    await _db(
                                        supabase.table("before_after").insert({
                                            "business_id": biz["id"],
                                            "capture_type": f"after_{days}d_ai_tab",
                                            "image_url": ai_tab_url,
                                            "query_used": q,
                                        })
                                    )
                                await asyncio.sleep(3)
                        except Exception as e_tab:
                            logger.warning(f"naver_ai_tab after screenshot failed for {biz.get('name')}: {e_tab}")

                    # Google After 스크린샷 제거
                    # 이유: 데이터센터 IP(iwinv) → Google CAPTCHA 100% 감지
                    # 재도입 기준: 구독자 50명 이후 DataForSEO Screenshot API 연동

                    logger.info(f"After card generated: {biz['name']} ({days}d)")

                except Exception as e:
                    logger.error(f"After screenshot failed for {biz.get('name')}: {e}")

    except Exception as e:
        logger.error(f"after_screenshot_job failed: {e}")
        await send_slack_alert("after_screenshot_job 실패", str(e), level="error")


async def monthly_market_news_job():
    """매월 1일 오전 10시: 업종별 시장 변화 뉴스 카카오 알림 (AEOLAB_NEWS_01)"""
    from db.supabase_client import get_client
    from services.kakao_notify import KakaoNotifier
    import anthropic
    import os

    try:
        supabase = get_client()
        notifier = KakaoNotifier()

        # subscriptions↔profiles/businesses는 FK 없어 embedded join 시 PGRST200 →
        # 세 번 조회 후 user_id 기준 병합으로 교체 (2026-07-01, 기존 패턴과 동일)
        _subs_res = await _db(
            supabase.table("subscriptions").select("user_id").eq("status", "active")
        )
        _active_user_ids = list({s["user_id"] for s in (_subs_res.data or [])}) or ["__none__"]

        _profiles_res = await _db(
            supabase.table("profiles").select("user_id, phone").in_("user_id", _active_user_ids)
        )
        _phone_by_user = {p["user_id"]: p.get("phone") for p in (_profiles_res.data or [])}

        _biz_res0 = await _db(
            supabase.table("businesses")
            .select("id, name, category, region, user_id")
            .in_("user_id", _active_user_ids)
        )
        _biz_by_user: dict = {}
        for _b in (_biz_res0.data or []):
            _biz_by_user.setdefault(_b["user_id"], []).append(_b)

        users = [
            {
                "user_id": uid,
                "profiles": {"phone": _phone_by_user.get(uid)},
                "businesses": _biz_by_user.get(uid, []),
            }
            for uid in _active_user_ids
            if uid != "__none__"
        ]
        if not users:
            return

        # 업종별 카테고리 집계 후 Claude로 뉴스 생성 (카테고리당 1회 API 호출로 비용 절감)
        category_news: dict = {}
        client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))
        MAX_CLAUDE_CALLS = int(os.getenv("MAX_CLAUDE_CALLS_PER_JOB", "50"))
        _claude_call_count = 0

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
                    if _claude_call_count >= MAX_CLAUDE_CALLS:
                        logger.warning(f"[monthly_market_news_job] MAX_CLAUDE_CALLS({MAX_CLAUDE_CALLS}) 도달 — 조기 종료")
                        break
                    _claude_call_count += 1
                    msg = await client.messages.create(
                        model="claude-haiku-4-5-20251001",
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
        await send_slack_alert("monthly_market_news_job 실패", str(e), level="error")


async def check_competitor_overtake():
    """매일 새벽 3시: 경쟁사 점수 역전 감지 후 카카오톡 알림"""
    from db.supabase_client import get_client
    from services.kakao_notify import KakaoNotifier

    try:
        supabase = get_client()
        notifier = KakaoNotifier()

        # 활성 구독 사업장 조회
        _sub_res = await _db(
            supabase.table("subscriptions")
            .select("user_id")
            .eq("status", "active")
        )
        subscribed = _sub_res.data or []
        user_ids = [s["user_id"] for s in subscribed]

        _biz_res2 = await _db(
            supabase.table("businesses")
            .select("id, name, user_id")
            .in_("user_id", user_ids)
            .eq("is_active", True)
        )
        businesses = _biz_res2.data or []

        for biz in businesses:
            try:
                # 내 최근 2회 점수
                _mh_res = await _db(
                    supabase.table("score_history")
                    .select("total_score")
                    .eq("business_id", biz["id"])
                    .order("score_date", desc=True)
                    .limit(2)
                )
                my_history = _mh_res.data or []
                if len(my_history) < 2:
                    continue

                my_score = my_history[0]["total_score"]
                my_prev = my_history[1]["total_score"]

                # 경쟁사 목록 조회
                _comp_list_res = await _db(
                    supabase.table("competitors")
                    .select("id, name")
                    .eq("business_id", biz["id"])
                    .eq("is_active", True)
                )
                competitors = _comp_list_res.data or []

                for comp in competitors:
                    _cl_res = await _db(
                        supabase.table("score_history")
                        .select("total_score")
                        .eq("business_id", comp["id"])
                        .order("score_date", desc=True)
                        .limit(1)
                    )
                    comp_latest = _cl_res.data or []
                    if not comp_latest:
                        continue

                    comp_score = comp_latest[0]["total_score"]

                    # 역전 감지: 이전엔 내가 앞섰는데 지금은 뒤처짐
                    if my_prev > comp_score and my_score <= comp_score:
                        # 멱등키: 오늘 이미 발송한 역전 알림이면 skip
                        _today = date.today().isoformat()
                        _idem_key = f"competitor_overtake_{biz['id']}_{comp['id']}_{_today}"
                        _already_sent = (await _db(
                            supabase.table("notifications")
                            .select("id")
                            .eq("business_id", biz["id"])
                            .eq("type", "competitor_overtake")
                            .gte("created_at", _today)
                            .eq("idempotency_key", _idem_key)
                            .limit(1)
                        )).data
                        if _already_sent:
                            continue

                        # 사용자 폰 번호 조회
                        _prof_res = await _db(
                            supabase.table("profiles")
                            .select("phone")
                            .eq("user_id", biz["user_id"])
                            .maybe_single()
                        )
                        profile = _prof_res.data
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
                            # 발송 이력 기록
                            try:
                                await _db(supabase.table("notifications").insert({
                                    "business_id": biz["id"],
                                    "type": "competitor_overtake",
                                    "idempotency_key": _idem_key,
                                    "payload": {"comp_id": comp["id"], "gap": comp_score - my_score},
                                }))
                            except Exception as _ne:
                                logger.warning(f"역전 알림 이력 저장 실패: {_ne}")
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
        _scans_res = await _db(
            supabase.table("scan_results")
            .select("id, business_id, query_used, competitor_scores")
            .not_.is_("competitor_scores", "null")
            .order("scanned_at", desc=True)
            .limit(30)
        )
        scans = _scans_res.data or []

        gemini = GeminiScanner()
        max_calls = int(os.getenv("MAX_CLAUDE_CALLS_PER_JOB", "50"))
        enriched = 0
        failed = 0
        api_calls = 0
        for scan in scans:
            if api_calls >= max_calls:
                logger.warning(f"[keyword_gap_enrich] API 상한 도달 ({max_calls}회), 중단")
                break
            comp_scores = scan.get("competitor_scores") or {}
            needs_update = False
            for comp_id, data in comp_scores.items():
                if api_calls >= max_calls:
                    break
                if isinstance(data, dict) and not data.get("excerpt"):
                    name = data.get("name", "")
                    query = scan.get("query_used", "")
                    if name and query:
                        try:
                            r = await gemini.single_check(query, name)
                            api_calls += 1
                            excerpt = r.get("excerpt", "")
                            if excerpt:
                                comp_scores[comp_id]["excerpt"] = excerpt[:300]
                                needs_update = True
                        except Exception as _exc:
                            failed += 1
                            logger.warning(f"competitor excerpt enrich skip [{comp_id}]: {_exc}")
            if needs_update:
                await _db(
                    supabase.table("scan_results").update(
                        {"competitor_scores": comp_scores}
                    ).eq("id", scan["id"])
                )
                enriched += 1

        logger.info(f"[keyword_gap_enrich] 완료 {enriched}건 / 실패 {failed}건 (API {api_calls}회)")
    except Exception as e:
        logger.warning(f"_enrich_competitor_excerpts failed: {e}")
        await send_slack_alert("_enrich_competitor_excerpts 실패", str(e), level="error")


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

    # 업종 코드 → 검색 키워드 매핑 (v3.5 25개 화이트리스트 기준)
    _CAT_KO = {
        "restaurant": "음식점", "cafe": "카페", "bakery": "베이커리", "bar": "술집",
        "beauty": "미용실", "nail": "네일샵", "medical": "병원", "pharmacy": "약국",
        "fitness": "헬스장", "yoga": "요가 필라테스", "pet": "반려동물",
        "education": "학원", "tutoring": "과외", "legal": "법률사무소",
        "realestate": "부동산", "interior": "인테리어", "auto": "자동차정비",
        "cleaning": "청소대행", "shopping": "쇼핑몰", "fashion": "의류",
        "photo": "사진·영상", "video": "영상제작", "design": "디자인",
        "accommodation": "숙박 펜션", "other": "",
    }

    try:
        supabase = get_client()
        notifier = KakaoNotifier()

        # 구독 중인 사업장 조회
        _dnc_sub_res = await _db(
            supabase.table("subscriptions")
            .select("user_id")
            .eq("status", "active")
        )
        subscribed = _dnc_sub_res.data or []
        user_ids = [s["user_id"] for s in subscribed]
        _dnc_biz_res = await _db(
            supabase.table("businesses")
            .select("id, name, user_id, category, region")
            .in_("user_id", user_ids)
            .eq("is_active", True)
        )
        businesses = _dnc_biz_res.data or []

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
                _ec_res = await _db(
                    supabase.table("competitors")
                    .select("name")
                    .eq("business_id", biz["id"])
                    .eq("is_active", True)
                )
                existing_comps = _ec_res.data or []
                existing_names = {c["name"] for c in existing_comps}

                new_places = [p for p in found_places if p not in existing_names and p != biz["name"]]
                if len(new_places) < 1:
                    continue

                # 사용자 전화번호 조회
                _dnc_prof_res = await _db(
                    supabase.table("profiles")
                    .select("phone, kakao_competitor_notify")
                    .eq("user_id", biz["user_id"])
                    .maybe_single()
                )
                profile = _dnc_prof_res.data
                phone = (profile or {}).get("phone")
                notify_on = (profile or {}).get("kakao_competitor_notify", False)

                if not phone or not notify_on:
                    continue

                # 이미 이번 주에 알림 발송했으면 스킵
                from datetime import date, timedelta
                week_start = (date.today() - timedelta(days=date.today().weekday())).isoformat() + "T00:00:00"
                already_sent = await _db(
                    supabase.table("notifications")
                    .select("id", count="exact")
                    .eq("user_id", biz["user_id"])
                    .eq("type", "new_competitor")
                    .gte("sent_at", week_start)
                )
                if (already_sent.count or 0) > 0:
                    continue

                new_names_str = ", ".join(new_places[:3])

                # FAQ 유무 확인 — 기존 등록 경쟁사 중 naver_place_id 있는 최대 3개 순차 체크
                # (RAM 주의: Playwright 순차 처리, 동시 실행 금지)
                has_faq_count = 0
                try:
                    from services.naver_place_stats import check_smart_place_completeness
                    _faq_comp_res = await _db(
                        supabase.table("competitors")
                        .select("name, naver_place_id")
                        .eq("business_id", biz["id"])
                        .eq("is_active", True)
                        .not_.is_("naver_place_id", "null")
                        .limit(3)
                    )
                    faq_check_targets = _faq_comp_res.data or []
                    for comp_row in faq_check_targets:
                        pid = comp_row.get("naver_place_id", "")
                        if not pid:
                            continue
                        try:
                            naver_url = f"https://map.naver.com/p/entry/place/{pid}"
                            faq_stats = await check_smart_place_completeness(naver_url)
                            if faq_stats and faq_stats.get("has_faq"):
                                has_faq_count += 1
                        except Exception as _faq_err:
                            logger.debug(f"FAQ check skip (place_id={pid}): {_faq_err}")
                except Exception as _faq_import_err:
                    logger.debug(f"FAQ check skipped: {_faq_import_err}")

                if has_faq_count > 0:
                    alert_msg = (
                        f"[AEOlab] {biz['name']} 알림\n\n"
                        f"이번 주 {region_prefix} {cat_ko} 검색에 새로운 사업장 {len(new_places)}곳이 발견됐습니다.\n\n"
                        f"새 경쟁 후보: {new_names_str}\n\n"
                        f"⚠️ 기존 경쟁사 {has_faq_count}곳이 소개글 안 Q&A 섹션을 추가해\n"
                        f"AI 브리핑 노출 경쟁이 높아지고 있습니다.\n\n"
                        f"내 FAQ 확인하기: https://aeolab.co.kr/guide"
                    )
                else:
                    alert_msg = (
                        f"[AEOlab] {biz['name']} 알림\n\n"
                        f"이번 주 {region_prefix} {cat_ko} 검색에 새로운 사업장 {len(new_places)}곳이 발견됐습니다.\n\n"
                        f"새 경쟁 후보: {new_names_str}\n\n"
                        f"경쟁사로 등록하고 AI 노출 순위를 비교해보세요.\n"
                        f"https://aeolab.co.kr/competitors"
                    )

                await notifier.send_text(phone=phone, message=alert_msg)
                # 알림 이력 저장
                await _db(
                    supabase.table("notifications").insert({
                        "user_id": biz["user_id"],
                        "business_id": biz["id"],
                        "type": "new_competitor",
                        "content": {"new_places": new_places[:3]},
                    })
                )

                logger.info(f"신규 경쟁사 알림: {biz['name']} → {new_names_str}")
            except Exception as e:
                logger.warning(f"detect_new_competitors biz={biz.get('id')}: {e}")

    except Exception as e:
        logger.error(f"detect_new_competitors failed: {e}")
        await send_slack_alert("detect_new_competitors 실패", str(e), level="error")


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
        _cit_res2 = await _db(
            supabase.table("ai_citations")
            .select("business_id, excerpt, platform")
            .gte("created_at", yesterday)
            .lt("created_at", today_str)
            .eq("mentioned", True)
            .limit(200)
        )
        recent_cits = _cit_res2.data or []

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
        _ka_biz_res = await _db(
            supabase.table("businesses")
            .select("id, name, user_id, category")
            .in_("id", biz_ids)
            .eq("is_active", True)
        )
        businesses = _ka_biz_res.data or []

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
                _oc_res = await _db(
                    supabase.table("ai_citations")
                    .select("excerpt")
                    .eq("business_id", biz["id"])
                    .lt("created_at", yesterday)
                    .order("created_at", desc=True)
                    .limit(50)
                )
                old_cits = _oc_res.data or []
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
                _ka_prof_res = await _db(
                    supabase.table("profiles")
                    .select("phone, kakao_scan_notify")
                    .eq("user_id", biz["user_id"])
                    .maybe_single()
                )
                profile = _ka_prof_res.data
                phone = (profile or {}).get("phone")
                notify_on = (profile or {}).get("kakao_scan_notify", False)
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
        await send_slack_alert("keyword_alert_job 실패", str(e), level="error")


async def send_trial_day5_reminder():
    """매일 오전 10시 15분: 가입 5일차 free 사용자 결제 전환 유도 알림.

    subscriptions 테이블에서 plan='free', created_at이 정확히 5일 전인 사용자를 조회.
    profiles.phone이 있으면 카카오 알림, 없으면 조용히 스킵.
    카카오 미설정 환경에서도 에러 없이 종료.
    """
    from db.supabase_client import get_client

    try:
        supabase = get_client()
        today = date.today()
        target_date = today - timedelta(days=5)
        target_start = target_date.isoformat() + "T00:00:00"
        target_end   = target_date.isoformat() + "T23:59:59"

        # subscriptions↔profiles FK 미등록 → profiles(phone) 조인 불가 → user_id만 조회
        result = await _db(
            supabase.table("subscriptions")
            .select("user_id, plan")
            .eq("plan", "free")
            .gte("created_at", target_start)
            .lte("created_at", target_end)
        )
        rows = (result.data or []) if result else []

        user_ids = [r["user_id"] for r in rows if r.get("user_id")]

        # profiles phone 별도 IN 쿼리 (subscriptions↔profiles FK 미등록)
        phone_by_user: dict = {}
        if user_ids:
            ph_res = await _db(
                supabase.table("profiles").select("user_id, phone").in_("user_id", user_ids)
            )
            for p in (ph_res.data or []):
                if p.get("phone"):
                    phone_by_user[p["user_id"]] = p["phone"]

        biz_by_user: dict = {}
        if user_ids:
            biz_res = await _db(
                supabase.table("businesses")
                .select("user_id, id, name")
                .in_("user_id", user_ids)
            )
            for b in (biz_res.data or []):
                biz_by_user.setdefault(b["user_id"], []).append(b)

        logger.info(f"trial_day5_reminder: 대상 {len(rows)}명")

        if not _KAKAO_CONFIGURED:
            logger.debug("trial_day5_reminder: KAKAO 미설정, 알림 스킵")
            return

        from services.kakao_notify import KakaoNotifier
        notifier = KakaoNotifier()

        for row in rows:
            try:
                uid = row.get("user_id")
                phone = phone_by_user.get(uid)
                if not phone:
                    continue

                biz_list = biz_by_user.get(row.get("user_id"), [])
                biz_name = biz_list[0].get("name", "내 가게") if biz_list else "내 가게"

                message = (
                    f"[AEOlab] {biz_name}\n\n"
                    "5\uc77c \uc804\uc5d0 \ubb34\ub8cc \uccb4\ud5d8\uc744 \ubc1b\uc73c\uc168\ub124\uc694.\n"
                    "AI \uac80\uc0c9 \uac1c\uc120\uc744 \uacc4\uc18d \ubc1b\uc544\ubcf4\uc138\uc694.\n\n"
                    "Basic \ud50c\ub79c(\uc6d4 9,900\uc6d0)\uc73c\ub85c \uc2dc\uc791\ud558\uba74\n"
                    "\u2022 \ub9e4\uc8fc \uc790\ub3d9 AI \uc2a4\uce94\n"
                    "\u2022 \uacbd\uc7c1\uc0ac \ube44\uad50 \ubd84\uc11d\n"
                    "\u2022 \ub9de\ucda4 \uac1c\uc120 \uac00\uc774\ub4dc\n\n"
                    "\uc9c0\uae08 \uc2dc\uc791\ud558\uae30: aeolab.co.kr/pricing"
                )
                await notifier._send_raw(phone, message, template_code="AEOLAB_NOTICE_01")
                # 마스킹 처리
                masked = phone[:3] + "****" + phone[-4:] if len(phone) >= 7 else "***"
                logger.info(f"trial_day5_reminder sent: {biz_name} → {masked}")
            except Exception as e:
                logger.warning(f"trial_day5_reminder per-user failed: {e}")

    except Exception as e:
        logger.error(f"send_trial_day5_reminder failed: {e}")
        await send_slack_alert("trial_day5_reminder 실패", str(e), level="error")


async def trial_followup_job():
    """매일 오전 10시: 무료 체험 팔로업 이메일 시퀀스 — 비활성화됨.

    2026-06-24: 스캔 완료 즉시 1회 발송으로 전환 (scan.py _save() 내 처리).
    day-1/3/7 시퀀스는 자원 낭비로 판단하여 제거.
    """
    return  # 비활성화

    from db.supabase_client import get_client
    from services.email_sender import send_trial_followup
    from datetime import date, timedelta

    try:
        supabase = get_client()
        today = date.today()

        for day in (1, 3, 7):
            col = f"followup_sent_{day}"
            target_date = (today - timedelta(days=day)).isoformat()

            _tr_res = await _db(
                supabase.table("trial_scans")
                .select(
                    "id, email, business_name, category, region, total_score, unified_score, "
                    "naver_rank, blog_mentions, top_competitor_name, ai_mentioned, "
                    "top_missing_keywords, has_recent_post, has_intro, track1_score, "
                    "track2_score, growth_stage, smart_place_completeness"
                )
                .eq(col, False)
                .not_.is_("email", "null")
                .lte("scanned_at", target_date + "T23:59:59")
                .gte("scanned_at", target_date + "T00:00:00")
                .limit(100)
            )
            rows = _tr_res.data or []

            for row in rows:
                email = row.get("email")
                if not email:
                    continue

                # 중복 발송 방지 업데이트 (supabase-py 2.7.4: update+select 체인 미지원)
                await _db(
                    supabase.table("trial_scans")
                    .update({col: True, "followup_sent_at": today.isoformat()})
                    .eq("id", row["id"])
                    .eq(col, False)
                )

                sent = await send_trial_followup(
                    email=email,
                    business_name=row.get("business_name", ""),
                    category=row.get("category", ""),
                    region=row.get("region", ""),
                    score=float(row.get("unified_score") or row.get("total_score") or 0),
                    day=day,
                    naver_rank=row.get("naver_rank"),
                    blog_mentions=row.get("blog_mentions"),
                    top_competitor_name=row.get("top_competitor_name"),
                    ai_mentioned=row.get("ai_mentioned"),
                    top_missing_keywords=row.get("top_missing_keywords") or [],
                    has_recent_post=row.get("has_recent_post"),
                    has_intro=row.get("has_intro"),
                    track1_score=row.get("track1_score"),
                    track2_score=row.get("track2_score"),
                    growth_stage=row.get("growth_stage"),
                    smart_place_completeness=row.get("smart_place_completeness"),
                )
                if sent:
                    logger.info(f"trial_followup day={day} → {email[:2]}***")

    except Exception as e:
        logger.error(f"trial_followup_job failed: {e}")
        await send_slack_alert("trial_followup_job 실패", str(e), level="error")


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
        _wpd_subs_res = await _db(
            supabase.table("subscriptions")
            .select("user_id")
            .eq("status", "active")
            .in_("plan", ["basic", "startup", "pro", "biz"])
        )
        subs = _wpd_subs_res.data or []
        user_ids = list({s["user_id"] for s in subs})
        if not user_ids:
            return

        _wpd_biz_res = await _db(
            supabase.table("businesses")
            .select("id, name, category, region, user_id, keywords")
            .in_("user_id", user_ids)
            .eq("is_active", True)
        )
        businesses = _wpd_biz_res.data or []
        MAX_CLAUDE_CALLS = int(os.getenv("MAX_CLAUDE_CALLS_PER_JOB", "50"))
        _claude_call_count = 0

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

                # 이번 주 초안이 이미 있으면 skip (중복 방지)
                from datetime import timedelta
                _today = date.today()
                _week_start = (_today - timedelta(days=_today.weekday())).isoformat()
                _existing = await _db(
                    supabase.table("guides")
                    .select("id")
                    .eq("business_id", biz["id"])
                    .eq("context", "post_draft")
                    .gte("created_at", _week_start)
                    .limit(1)
                )
                if _existing and _existing.data:
                    continue

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

                if _claude_call_count >= MAX_CLAUDE_CALLS:
                    logger.warning(f"[weekly_post_draft_job] MAX_CLAUDE_CALLS({MAX_CLAUDE_CALLS}) 도달 — 조기 종료")
                    break
                _claude_call_count += 1
                msg = await client.messages.create(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=200,
                    messages=[{"role": "user", "content": prompt}],
                )
                draft = msg.content[0].text.strip()

                # guides 테이블에 저장 (guide_type='post_draft')
                await _db(
                    supabase.table("guides").insert({
                        "business_id": biz["id"],
                        "items_json": [{"title": "주간 소식 초안", "action": draft, "difficulty": "easy"}],
                        "priority_json": [draft],
                        "summary": f"{week}주차 소식 초안 자동 생성",
                        "context": "post_draft",
                    })
                )

                # 카카오 알림 (알림 설정한 사용자만)
                _wpd_prof_res = await _db(
                    supabase.table("profiles")
                    .select("phone, kakao_scan_notify")
                    .eq("user_id", biz["user_id"])
                    .maybe_single()
                )
                profile = _wpd_prof_res.data
                phone = (profile or {}).get("phone")
                if phone and (profile or {}).get("kakao_scan_notify", False):
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
        await send_slack_alert("weekly_post_draft_job 실패", str(e), level="error")


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
        _mgc_subs_res = await _db(
            supabase.table("subscriptions")
            .select("user_id")
            .eq("status", "active")
        )
        subs = _mgc_subs_res.data or []
        user_ids = list({s["user_id"] for s in subs})
        if not user_ids:
            return

        _mgc_biz_res = await _db(
            supabase.table("businesses")
            .select("id, name, user_id, category, region")
            .in_("user_id", user_ids)
            .eq("is_active", True)
        )
        businesses = _mgc_biz_res.data or []

        for biz in businesses:
            try:
                biz_id = biz["id"]

                # 이달 첫 번째 점수
                _fr_res = await _db(
                    supabase.table("score_history")
                    .select("total_score, score_date")
                    .eq("business_id", biz_id)
                    .gte("score_date", month_start)
                    .order("score_date", desc=False)
                    .limit(1)
                )
                first_row = _fr_res.data or []
                # 이달 마지막 점수
                _lr_res = await _db(
                    supabase.table("score_history")
                    .select("total_score, score_date")
                    .eq("business_id", biz_id)
                    .gte("score_date", month_start)
                    .order("score_date", desc=True)
                    .limit(1)
                )
                last_row = _lr_res.data or []

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
                    from services.share_card import _score_stage_label
                    from pathlib import Path

                    stage_start = _score_stage_label(score_start)
                    stage_end = _score_stage_label(score_end)

                    W, H = 1080, 1080
                    img = Image.new("RGB", (W, H), "#0f172a")
                    draw = ImageDraw.Draw(img)

                    def _lf(paths, size):
                        for p in paths:
                            if Path(p).exists():
                                try:
                                    return ImageFont.truetype(p, size)
                                except Exception as _fe:
                                    logger.debug(f"[monthly_growth_card] font load: {_fe}")
                        return ImageFont.load_default()

                    f_lg = _lf(_FONT_BOLD, 80)
                    f_md = _lf(_FONT_BOLD, 48)
                    f_sm = _lf(_FONT_REG, 32)

                    draw.text((540, 180), "이번 달 AI 검색 노출", font=f_sm, fill="#94a3b8", anchor="mm")
                    draw.text((540, 380), "좋아졌어요!", font=f_lg, fill="#34d399", anchor="mm")
                    draw.text((540, 520), f"{stage_start} → {stage_end}", font=f_md, fill="#ffffff", anchor="mm")
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
                _mgc_prof_res = await _db(
                    supabase.table("profiles")
                    .select("phone")
                    .eq("user_id", biz["user_id"])
                    .maybe_single()
                )
                profile = _mgc_prof_res.data
                phone = (profile or {}).get("phone")
                if phone:
                    await notifier.send_text(
                        phone=phone,
                        message=(
                            f"[AEOlab] {biz['name']} 이달 성장 리포트\n\n"
                            f"이번 달 AI 검색 노출이 좋아졌습니다! ({stage_start} → {stage_end})\n\n"
                            f"성장 카드를 확인하세요:\n{card_url}"
                        ),
                    )
                logger.info(f"monthly_growth_card: {biz['name']} +{diff:.1f}")

            except Exception as e:
                logger.warning(f"monthly_growth_card biz={biz.get('id')}: {e}")

    except Exception as e:
        logger.error(f"monthly_growth_card_job failed: {e}")
        await send_slack_alert("monthly_growth_card_job 실패", str(e), level="error")


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
        _clr_subs_res = await _db(
            supabase.table("subscriptions")
            .select("user_id")
            .eq("status", "active")
        )
        subs = _clr_subs_res.data or []
        user_ids = [s["user_id"] for s in subs]
        if not user_ids:
            return

        _clr_biz_res = await _db(
            supabase.table("businesses")
            .select("id, name, user_id, naver_place_id")
            .in_("user_id", user_ids)
            .eq("is_active", True)
            .not_.is_("naver_place_id", "null")
        )
        businesses = _clr_biz_res.data or []

        for biz in businesses:
            try:
                naver_place_id = biz.get("naver_place_id")
                if not naver_place_id:
                    continue

                # 전화번호 + 알림 설정 확인
                _clr_prof_res = await _db(
                    supabase.table("profiles")
                    .select("phone, kakao_scan_notify")
                    .eq("user_id", biz["user_id"])
                    .maybe_single()
                )
                profile = _clr_prof_res.data
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
                        already = await _db(
                            supabase.table("notifications")
                            .select("id", count="exact")
                            .eq("type", "low_rating_alert")
                            .eq("user_id", biz["user_id"])
                            .contains("content", {"review_id": review_id})
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
                    await _db(
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
                        })
                    )

                    logger.info(
                        f"low_rating_alert sent: {biz['name']} ({rating}점) review_id={review_id}"
                    )
                    break  # 사업장당 1건만 알림 (중복 방지)

            except Exception as e:
                logger.warning(f"check_low_rating_reviews biz={biz.get('id')}: {e}")

    except Exception as e:
        logger.error(f"check_low_rating_reviews failed: {e}")
        await send_slack_alert("check_low_rating_reviews 실패", str(e), level="error")


async def send_monthly_growth_report():
    """매월 1일 오전 9시: 이전 달 성과 집계 후 카카오 월간 성장 리포트 발송."""
    try:
        from services.monthly_report import send_monthly_growth_report_to_all
        await send_monthly_growth_report_to_all()
    except Exception as e:
        logger.error(f"send_monthly_growth_report failed: {e}")
        await send_slack_alert("send_monthly_growth_report 실패", str(e), level="error")


async def monthly_report_notify():
    """월간 AI 노출 리포트 카카오 알림 — 매월 1일 09:10.

    활성 구독자별로 최근 2개월 점수 변화를 계산해
    kakao_scan_notify=True인 사용자에게 send_monthly_report 알림 발송.
    """
    from db.supabase_client import get_client
    from datetime import datetime

    supabase = get_client()
    if not _KAKAO_CONFIGURED:
        _logger.info("monthly_report_notify: KAKAO_APP_KEY 미설정 — skip")
        return

    try:
        subs = await _db(
            supabase.table("subscriptions")
            .select("user_id, plan")
            .eq("status", "active")
        )
        if not subs.data:
            return

        notifier = None
        try:
            from services.kakao_notify import KakaoNotifier
            notifier = KakaoNotifier()
        except Exception as e:
            _logger.warning(f"monthly_report_notify: KakaoNotifier import 실패: {e}")
            return

        month_str = datetime.now().strftime("%m")
        sent = 0
        skipped = 0

        for sub in subs.data:
            user_id = sub["user_id"]
            try:
                # 프로필(전화번호, 알림설정) 조회
                profile = await _db(
                    supabase.table("profiles")
                    .select("phone, kakao_scan_notify")
                    .eq("user_id", user_id)
                    .maybe_single()
                )
                if not profile.data or not profile.data.get("kakao_scan_notify"):
                    skipped += 1
                    continue
                phone = profile.data.get("phone")
                if not phone:
                    skipped += 1
                    continue

                # 사업장 조회 (활성 1개)
                biz = await _db(
                    supabase.table("businesses")
                    .select("id, name")
                    .eq("user_id", user_id)
                    .eq("is_active", True)
                    .limit(1)
                    .maybe_single()
                )
                if not biz.data:
                    skipped += 1
                    continue

                biz_id = biz.data["id"]
                biz_name = biz.data["name"]

                # 최근 60개 점수 조회 (약 2달치)
                scores = await _db(
                    supabase.table("score_history")
                    .select("unified_score, created_at")
                    .eq("business_id", biz_id)
                    .order("created_at", desc=True)
                    .limit(60)
                )
                if not scores.data or len(scores.data) < 2:
                    skipped += 1
                    continue

                latest = scores.data[0].get("unified_score") or 0.0
                prev = scores.data[-1].get("unified_score") or 0.0
                diff = round(latest - prev, 1)

                # 이달 스캔 횟수
                month_start = datetime.now().replace(day=1).strftime("%Y-%m-01T00:00:00")
                scan_res = await _db(
                    supabase.table("score_history")
                    .select("id", count="exact")
                    .eq("business_id", biz_id)
                    .gte("created_at", month_start)
                )
                scan_count = scan_res.count or 0

                # AI 인용 건수
                cite_res = await _db(
                    supabase.table("ai_citations")
                    .select("id", count="exact")
                    .eq("business_id", biz_id)
                    .gte("created_at", month_start)
                )
                citation_count = cite_res.count or 0

                await notifier.send_monthly_report(
                    phone=phone,
                    biz_name=biz_name,
                    score_change=diff,
                    scan_count=scan_count,
                    citation_count=citation_count,
                    month_str=month_str,
                )
                sent += 1
            except Exception as e:
                _logger.warning(f"monthly_report_notify user={user_id}: {e}")

        _logger.info(f"monthly_report_notify 완료: sent={sent}, skipped={skipped}")
    except Exception as e:
        _logger.warning(f"monthly_report_notify failed: {e}")
        await send_slack_alert("monthly_report_notify 실패", str(e), level="error")


async def quarterly_index_job():
    """
    분기 종료 후 8일째 새벽 3시: 직전 분기 공개 인덱스 집계.

    실행 월 → 집계 대상 분기:
      1월 8일  → 직전 연도 Q4
      4월 8일  → 당해 연도 Q1
      7월 8일  → 당해 연도 Q2
      10월 8일 → 당해 연도 Q3

    index_snapshots 테이블이 없으면 오류 로그만 남기고 조용히 종료.
    """
    from db.supabase_client import get_client

    try:
        today = date.today()
        month = today.month
        year  = today.year

        # 실행 월 기준 직전 분기 계산
        _MONTH_TO_PREV_QUARTER: dict[int, tuple[int, str]] = {
            1:  (year - 1, "Q4"),
            4:  (year,     "Q1"),
            7:  (year,     "Q2"),
            10: (year,     "Q3"),
        }

        if month not in _MONTH_TO_PREV_QUARTER:
            # 예상치 못한 월(misfire 등) — 경고만
            logger.warning(
                f"[quarterly_index_job] 예상하지 못한 실행 월: {month}. "
                f"APScheduler cron 설정(month=1,4,7,10)을 확인하세요."
            )
            return

        q_year, q_label = _MONTH_TO_PREV_QUARTER[month]
        quarter = f"{q_year}-{q_label}"

        logger.info(f"[quarterly_index_job] 시작: quarter={quarter}")

        supabase = get_client()
        from services.index_aggregator import run_full_index_aggregation

        result = await run_full_index_aggregation(supabase, quarter)

        logger.info(
            f"[quarterly_index_job] 완료: quarter={quarter} "
            f"computed={result['computed']}, skipped={result['skipped_low_sample']}"
        )

    except Exception as e:
        logger.error(f"[quarterly_index_job] 실패: {e}")
        try:
            await send_slack_alert(
                "quarterly_index_job 실패",
                str(e),
                level="error",
            )
        except Exception as _se:
            logger.warning(f"[quarterly_index_job] slack alert 실패: {_se}")


async def competitor_place_sync_job():
    """매주 월요일 03:30 — naver_place_id가 있는 모든 경쟁사 플레이스 데이터 동기화"""
    from db.supabase_client import get_client
    from services.competitor_place_crawler import sync_all_competitor_places

    try:
        supabase = get_client()

        # naver_place_id가 있는 경쟁사의 business_id 목록 수집 (중복 제거)
        _cps_rows_res = await _db(
            supabase.table("competitors")
            .select("business_id")
            .eq("is_active", True)
            .not_.is_("naver_place_id", "null")
        )
        rows = _cps_rows_res.data or []

        # business_id 중복 제거
        business_ids = list({r["business_id"] for r in rows})
        logger.info(f"competitor_place_sync_job: {len(business_ids)}개 사업장 동기화 시작")

        total_synced = 0
        total_errors = 0
        ip_banned = False
        for biz_id in business_ids:
            if ip_banned:
                break
            try:
                results = await sync_all_competitor_places(biz_id, supabase)
                errors = [r for r in results if r.get("error")]
                total_synced += len(results) - len(errors)
                total_errors += len(errors)
                # 배치 내 ip_blocked 발생 시 남은 사업장 전체 중단
                if any(r.get("error") == "ip_blocked" for r in results):
                    ip_banned = True
                    logger.warning("competitor_place_sync_job: IP 차단 감지, 전체 잡 조기 종료")
            except Exception as e:
                logger.warning(f"competitor_place_sync_job [{biz_id}] 오류: {e}")
                total_errors += 1

        logger.info(
            f"competitor_place_sync_job 완료: "
            f"성공={total_synced}, 오류={total_errors}"
            + (" [IP 차단으로 조기 종료]" if ip_banned else "")
        )

    except Exception as e:
        logger.error(f"[competitor_place_sync_job] 실패: {e}")


async def competitor_faq_sync_job():
    """매주 월요일 05:00 — naver_place_id가 있는 모든 경쟁사 Q&A 키워드 시드 수집.

    [2026-05-01] 스마트플레이스 사장님 Q&A 탭(/faq /qna) 폐기로 크롤러 자체가 deprecated_qna_tab_removed
    에러 반환. 잡은 잔존하지만 questions 수집은 사실상 불가. 추후 정보 탭 텍스트 기반 수집으로 대체 검토.
    답변 본문은 저작권 이슈로 저장하지 않음.
    """
    from db.supabase_client import get_client, execute
    from services.competitor_place_crawler import fetch_competitor_faq_items

    try:
        supabase = get_client()
        comps_res = await execute(
            supabase.table("competitors")
            .select("id, naver_place_id, business_id")
            .eq("is_active", True)
            .not_.is_("naver_place_id", "null")
        )
        comps = comps_res.data or []
        logger.info(f"competitor_faq_sync_job: {len(comps)}개 경쟁사 FAQ 수집 시작")

        total_collected = 0
        total_errors = 0
        for c in comps:
            cid = c.get("id")
            npid = c.get("naver_place_id")
            if not cid or not npid:
                continue
            try:
                result = await fetch_competitor_faq_items(npid)
                questions = result.get("questions", []) or []
                err = result.get("error")
                await execute(
                    supabase.table("competitor_faqs").insert({
                        "competitor_id": cid,
                        "naver_place_id": npid,
                        "questions": questions,
                        "error": err,
                    })
                )
                if questions:
                    total_collected += len(questions)
                else:
                    total_errors += 1
                await asyncio.sleep(3)  # 네이버 서버 부하 방지
            except Exception as e:
                logger.warning(f"competitor_faq_sync_job [{cid}] 오류: {e}")
                total_errors += 1

        logger.info(
            f"competitor_faq_sync_job 완료: "
            f"질문 수집={total_collected}, 오류={total_errors}"
        )
    except Exception as e:
        logger.error(f"[competitor_faq_sync_job] 실패: {e}")


async def enrich_competitor_details_job():
    """매주 목요일 03:00 — 경쟁사 블로그 언급 수 + 웹사이트 SEO + 상세 정보 보강.

    naver_place_id가 있는 경쟁사를 순차 처리한다.
    Playwright 세마포어(1) 제한 유지 — 오류 발생 시 해당 경쟁사 스킵.
    """
    from db.supabase_client import get_client, execute
    from services.competitor_place_crawler import sync_competitor_place

    try:
        supabase = get_client()

        # naver_place_id 있는 경쟁사만 조회 (business_id, region 포함)
        rows = (
            await execute(
                supabase.table("competitors")
                .select("id, name, naver_place_id, business_id")
                .eq("is_active", True)
                .not_.is_("naver_place_id", "null")
            )
        ).data or []

        if not rows:
            logger.info("enrich_competitor_details_job: 대상 경쟁사 없음")
            return

        # business_id → region 일괄 조회 (N+1 방지)
        biz_ids = list({r["business_id"] for r in rows})
        biz_rows = (
            await execute(
                supabase.table("businesses")
                .select("id, region")
                .in_("id", biz_ids)
            )
        ).data or []
        region_map: dict[str, str] = {b["id"]: b.get("region", "") for b in biz_rows}

        import random as _random
        logger.info(f"enrich_competitor_details_job: {len(rows)}개 경쟁사 상세 보강 시작")
        total_ok = 0
        total_err = 0
        ip_banned = False

        for row in rows:
            if ip_banned:
                break
            competitor_id   = row["id"]
            naver_place_id  = row.get("naver_place_id", "")
            biz_id          = row.get("business_id", "")
            region          = region_map.get(biz_id, "")

            try:
                result = await sync_competitor_place(
                    competitor_id, naver_place_id, supabase, region=region,
                    registered_name=row.get("name", ""),
                )
                if result.get("error") == "ip_blocked":
                    logger.warning("enrich_competitor_details_job: IP 차단 감지, 전체 잡 조기 종료")
                    ip_banned = True
                    total_err += 1
                    break
                elif result.get("error"):
                    logger.warning(
                        f"enrich_competitor_details [{competitor_id}] 크롤링 실패: {result['error']}"
                    )
                    total_err += 1
                else:
                    logger.debug(
                        f"enrich_competitor_details [{row['name']}] "
                        f"blog={result.get('blog_mention_count', 0)}, "
                        f"seo={result.get('website_seo_score', 0)}"
                    )
                    total_ok += 1
            except Exception as e:
                logger.warning(f"enrich_competitor_details [{competitor_id}] 스킵: {e}")
                total_err += 1

            # 크롤링 간 랜덤 딜레이 (균일 패턴 차단 회피)
            await asyncio.sleep(_random.uniform(7, 15))

        logger.info(
            f"enrich_competitor_details_job 완료: 성공={total_ok}, 오류={total_err}"
            + (" [IP 차단으로 조기 종료]" if ip_banned else "")
        )

    except Exception as e:
        logger.error(f"[enrich_competitor_details_job] 실패: {e}")


async def weekly_industry_trend_job():
    """매주 월요일 03:00 — 모든 활성 사업장의 카테고리별 DataLab 트렌드 갱신"""
    from db.supabase_client import get_client
    from services.naver_datalab import get_datalab_client

    try:
        supabase = get_client()
        client = get_datalab_client()

        # 활성 구독 사업장의 카테고리·지역 목록 조회 (distinct 처리)
        _wit_biz_res = await _db(
            supabase.table("businesses")
            .select("category, region")
            .eq("is_active", True)
        )
        businesses = _wit_biz_res.data or []

        # (category, region) 쌍 중복 제거 — 동일 조합은 한 번만 갱신
        pairs: set[tuple[str, str | None]] = set()
        for biz in businesses:
            cat = biz.get("category") or "restaurant"
            region = biz.get("region")
            # region은 시·구 단위 → 시 단위로 축소 (예: "강남구" → None, "서울시 강남구" → "서울")
            region_key: str | None = None
            if region:
                parts = region.split()
                if parts:
                    # 광역시·특별시 수준으로만 캐싱 (세분화 시 API 호출 횟수 과다)
                    region_key = parts[0] if len(parts[0]) <= 3 else None
            pairs.add((cat, region_key))

        logger.info(f"weekly_industry_trend_job: {len(pairs)}개 (카테고리, 지역) 조합 갱신")

        success = 0
        skipped = 0
        for category, region in pairs:
            try:
                result = await client.get_trend_with_cache(category, region, supabase)
                if result.get("error"):
                    skipped += 1
                    logger.debug(
                        f"industry_trend 스킵 [{category}/{region}]: {result['error']}"
                    )
                else:
                    success += 1
                # API 호출 간 0.5초 간격 (네이버 DataLab API rate limit 방지)
                await asyncio.sleep(0.5)
            except Exception as e:
                logger.warning(f"weekly_industry_trend_job [{category}/{region}] 오류: {e}")
                skipped += 1

        logger.info(
            f"weekly_industry_trend_job 완료: 갱신={success}, 스킵={skipped}"
        )

    except Exception as e:
        logger.error(f"[weekly_industry_trend_job] 실패: {e}")


async def weekly_my_place_stats_job():
    """매주 일요일 03:00 — 내 사업장 네이버 플레이스 리뷰 수·평점 자동 갱신.

    naver_place_id가 등록된 활성 구독 사업장에 대해 NaverPlaceStatsService로
    businesses.review_count / avg_rating 을 최신값으로 업데이트한다.

    실행 타이밍: 일요일 03:00 → 월요일 02:00 daily_scan_all 이전에 최신 리뷰 수 확보,
    calc_review_quality()가 실제 최신 데이터를 사용하도록 보장.

    비용: Playwright 스크래핑 (API 비용 없음).
    RAM: Playwright 순차 실행, 사업장 간 5초 간격 (iwinv RAM4GB 기준).
    """
    from db.supabase_client import get_client
    from services.naver_place_stats import sync_naver_place_stats

    try:
        supabase = get_client()

        # naver_place_id가 설정된 활성 구독 사업장만 대상
        _wps_biz_res = await _db(
            supabase.table("businesses")
            .select("id, name, naver_place_id, user_id")
            .eq("is_active", True)
            .not_.is_("naver_place_id", "null")
        )
        businesses = _wps_biz_res.data or []

        # 활성 구독자만 필터 (구독 없는 사업장 스킵)
        _wps_subs_res = await _db(
            supabase.table("subscriptions")
            .select("user_id")
            .eq("status", "active")
        )
        subs = _wps_subs_res.data or []
        active_user_ids = {s["user_id"] for s in subs}
        targets = [b for b in businesses if b.get("user_id") in active_user_ids]

        logger.info(f"weekly_my_place_stats_job: 대상 {len(targets)}개 사업장")

        success = 0
        errors = 0
        for biz in targets:
            try:
                stats = await sync_naver_place_stats(biz["id"], biz["naver_place_id"])
                if stats.get("error"):
                    logger.warning(
                        f"weekly_my_place_stats [{biz['name']}]: {stats['error']}"
                    )
                    errors += 1
                else:
                    logger.info(
                        f"weekly_my_place_stats [{biz['name']}]: "
                        f"review={stats.get('review_count')}, rating={stats.get('avg_rating')}"
                    )
                    success += 1
            except Exception as e:
                logger.warning(f"weekly_my_place_stats [{biz.get('name')}] 오류: {e}")
                errors += 1
            # Playwright 인스턴스 완전 해제 대기 (OOM 방지)
            await asyncio.sleep(5)

        logger.info(
            f"weekly_my_place_stats_job 완료: 성공={success}, 오류={errors}"
        )

    except Exception as e:
        logger.error(f"[weekly_my_place_stats_job] 실패: {e}")
        await send_slack_alert("weekly_my_place_stats_job 실패", str(e), level="error")


async def check_action_rescans():
    """행동 완료 7일 후 Gemini 단일 재스캔 → Before/After 결과 저장 (매일 03:00)"""
    from db.supabase_client import get_client
    from services.ai_scanner.gemini_scanner import GeminiScanner
    from datetime import datetime, timezone
    import asyncio as _aio

    try:
        supabase = get_client()
        now_iso = datetime.now(timezone.utc).isoformat()

        _pending_res = await _db(
            supabase.table("action_completions")
            .select(
                "id, business_id, keyword, action_type, "
                "before_score, before_mentioned"
            )
            .lte("rescan_at", now_iso)
            .eq("rescan_done", False)
            .limit(20)
        )
        pending = _pending_res.data or []

        logger.info(f"[check_action_rescans] 처리 대상 {len(pending)}건")

        gemini = GeminiScanner()

        for action in pending:
            try:
                biz_id = action["business_id"]
                keyword = action["keyword"]
                action_id = action["id"]

                biz = await _db(
                    supabase.table("businesses")
                    .select("name, region, category")
                    .eq("id", biz_id)
                    .maybe_single()
                )
                if not biz.data:
                    logger.warning(f"[action_rescan] 사업장 없음 biz_id={biz_id}")
                    continue

                biz_name = biz.data["name"]
                region = biz.data.get("region", "")
                query = f"{region} {keyword}".strip() if region else keyword

                result = await gemini.single_check(query, biz_name)
                if not result.get("_measured", True):
                    # API 오류·타임아웃 — "노출 안 됨"으로 확정하지 않고 rescan_done을 세팅하지 않아
                    # 다음 날 배치에서 자동 재시도되도록 둔다 (측정 실패 ≠ 실측된 미노출)
                    logger.warning(
                        f"[action_rescan] Gemini 측정 실패, 다음 배치에 재시도 — "
                        f"id={action_id}, error={result.get('_error')}"
                    )
                    continue
                after_mentioned = bool(result.get("exposure_freq", 0) > 0)

                score_row = await _db(
                    supabase.table("scan_results")
                    .select("unified_score, track1_score")
                    .eq("business_id", biz_id)
                    .order("scanned_at", desc=True)
                    .limit(1)
                    .maybe_single()
                )
                after_score = None
                if score_row.data:
                    _uni = score_row.data.get("unified_score")
                    after_score = _uni if _uni is not None else score_row.data.get("track1_score")

                before_mentioned = action.get("before_mentioned")

                if before_mentioned is False and after_mentioned:
                    summary = (
                        f"'{keyword}' 키워드로 AI 브리핑에 노출되기 시작했습니다 ✓"
                    )
                elif before_mentioned and after_mentioned:
                    summary = "AI 브리핑 노출이 유지되고 있습니다"
                else:
                    summary = (
                        "아직 AI 브리핑에 반영되지 않았습니다. 조금 더 기다려주세요"
                    )

                await _db(
                    supabase.table("action_completions").update(
                        {
                            "after_score": after_score,
                            "after_mentioned": after_mentioned,
                            "result_summary": summary,
                            "rescan_done": True,
                        }
                    ).eq("id", action_id)
                )

                logger.info(
                    f"[action_rescan] 완료 — id={action_id}, "
                    f"before={before_mentioned}, after={after_mentioned}"
                )
                await _aio.sleep(2)

            except Exception as e:
                logger.warning(f"[action_rescan] 개별 처리 실패 id={action.get('id')}: {e}")

    except Exception as e:
        logger.error(f"check_action_rescans 실패: {e}")
        await send_slack_alert("check_action_rescans 실패", str(e), level="error")


async def detect_competitor_changes():
    """경쟁사 플레이스 정보 변화 감지 → notifications 테이블 저장 (매주 월 04:00)"""
    from db.supabase_client import get_client
    from datetime import datetime, timezone

    try:
        supabase = get_client()

        _dcc_rows_res = await _db(
            supabase.table("competitors")
            .select(
                "id, business_id, name, "
                "has_faq, has_menu, has_recent_post, "
                "review_count, photo_count, "
                "prev_has_faq, prev_has_menu, prev_has_recent_post, "
                "prev_review_count, prev_photo_count"
            )
            .eq("is_active", True)
        )
        rows = _dcc_rows_res.data or []

        logger.info(f"[detect_competitor_changes] 점검 대상 {len(rows)}개 경쟁사")

        for comp in rows:
            try:
                comp_id = comp["id"]
                changes = []

                def _chk_flag(key, prev_key, label):
                    cur = comp.get(key)
                    prev = comp.get(prev_key)
                    if cur is not None and prev is not None and cur != prev:
                        changes.append(f"{label} {'신규 등록' if cur else '삭제'}")

                def _chk_count(key, prev_key, label):
                    cur = comp.get(key) or 0
                    prev = comp.get(prev_key) or 0
                    diff = cur - prev
                    if abs(diff) >= 5:
                        changes.append(f"{label} {abs(diff)}개 {'증가' if diff > 0 else '감소'}")

                _chk_flag("has_faq", "prev_has_faq", "FAQ")
                _chk_flag("has_menu", "prev_has_menu", "메뉴")
                _chk_flag("has_recent_post", "prev_has_recent_post", "소식")
                _chk_count("review_count", "prev_review_count", "리뷰")
                _chk_count("photo_count", "prev_photo_count", "사진")

                now_iso = datetime.now(timezone.utc).isoformat()
                update_data = {
                    "prev_has_faq": comp.get("has_faq"),
                    "prev_has_menu": comp.get("has_menu"),
                    "prev_has_recent_post": comp.get("has_recent_post"),
                    "prev_review_count": comp.get("review_count") or 0,
                    "prev_photo_count": comp.get("photo_count") or 0,
                }

                if changes:
                    change_summary = ", ".join(changes)
                    update_data["change_summary"] = change_summary
                    update_data["change_detected_at"] = now_iso
                    logger.info(f"[competitor_change] {comp['name']}: {change_summary}")

                    biz_row = await _db(
                        supabase.table("businesses")
                        .select("user_id")
                        .eq("id", comp["business_id"])
                        .maybe_single()
                    )
                    if biz_row.data:
                        await _db(
                            supabase.table("notifications").insert(
                                {
                                    "user_id": biz_row.data["user_id"],
                                    "type": "competitor_change",
                                    "message": (
                                        f"경쟁사 '{comp['name']}'에 변화가 감지됐습니다: "
                                        f"{change_summary}"
                                    ),
                                    "is_read": False,
                                }
                            )
                        )
                        # 카카오 알림 (kakao_competitor_notify ON 사용자)
                        try:
                            uid2 = biz_row.data["user_id"]
                            prof2 = await _db(
                                supabase.table("profiles")
                                .select("phone, kakao_competitor_notify")
                                .eq("user_id", uid2)
                                .maybe_single()
                            )
                            if (
                                prof2.data
                                and prof2.data.get("kakao_competitor_notify")
                                and prof2.data.get("phone")
                            ):
                                biz_nm2 = await _db(
                                    supabase.table("businesses")
                                    .select("name")
                                    .eq("id", comp["business_id"])
                                    .maybe_single()
                                )
                                biz_nm2_str = biz_nm2.data.get("name", "") if biz_nm2.data else ""
                                from services.kakao_notify import KakaoNotifier as _KN2
                                _notifier2 = _KN2()
                                await _notifier2.send_competitor_change(
                                    prof2.data["phone"], biz_nm2_str, comp["name"], 0
                                )
                        except Exception as _ke:
                            logger.warning(f"[competitor_change] 카카오 알림 실패: {_ke}")

                await _db(
                    supabase.table("competitors").update(update_data).eq("id", comp_id)
                )

            except Exception as e:
                logger.warning(f"[competitor_change] 개별 처리 실패 comp={comp.get('name')}: {e}")

    except Exception as e:
        logger.error(f"detect_competitor_changes 실패: {e}")
        await send_slack_alert("detect_competitor_changes 실패", str(e), level="error")



async def _auto_log_score_change(
    supabase,
    business_id: str,
    new_score: float,
    old_score: float,
) -> None:
    """점수가 ±5점 이상 변동 시 business_action_log에 자동 기록."""
    from datetime import datetime as _dt, timezone as _tz
    diff = new_score - old_score
    if abs(diff) < 5.0:
        return

    from services.share_card import _score_stage_label
    stage_old = _score_stage_label(old_score)
    stage_new = _score_stage_label(new_score)

    if diff > 0:
        action_type = "score_up"
        action_label = f"AI 검색 노출 개선 ({stage_old} → {stage_new}, 자동 스캔)"
    else:
        action_type = "score_down"
        action_label = f"AI 검색 노출 하락 ({stage_old} → {stage_new}) — 경쟁사 강화 또는 정보 갱신 필요"

    today = _dt.now(_tz.utc).date().isoformat()

    try:
        existing = await execute(
            supabase.table("business_action_log")
            .select("id")
            .eq("business_id", business_id)
            .eq("action_type", action_type)
            .eq("action_date", today)
            .limit(1)
        )
        if existing.data:
            return  # 오늘 이미 기록됨
        await execute(
            supabase.table("business_action_log").insert({
                "business_id": business_id,
                "action_type": action_type,
                "action_label": action_label,
                "action_date": today,
                "score_before": round(old_score, 1),
                "score_after": round(new_score, 1),
            })
        )
        _logger.info(f"auto_log_score: {business_id} {action_label}")
    except Exception as e:
        _logger.warning(f"auto_log_score 실패 {business_id}: {e}")


async def _auto_log_competitor_overtake(
    supabase,
    business_id: str,
    competitor_name: str,
    my_score: float,
    comp_score: float,
) -> None:
    """경쟁사가 내 가게보다 20점 이상 앞서면 business_action_log 기록."""
    from datetime import datetime as _dt, timezone as _tz
    gap = comp_score - my_score
    if gap < 20.0:
        return

    today = _dt.now(_tz.utc).date().isoformat()

    try:
        existing = await execute(
            supabase.table("business_action_log")
            .select("id")
            .eq("business_id", business_id)
            .eq("action_type", "competitor_ahead")
            .eq("action_date", today)
            .limit(1)
        )
        if existing.data:
            return
        await execute(
            supabase.table("business_action_log").insert({
                "business_id": business_id,
                "action_type": "competitor_ahead",
                "action_label": f"경쟁사 '{competitor_name}'가 {gap:.0f}점 앞서 있습니다",
                "action_date": today,
                "score_before": round(my_score, 1),
                "score_after": None,
            })
        )
        _logger.info(f"auto_log_competitor: {business_id} gap={gap:.1f} comp={competitor_name}")
    except Exception as e:
        _logger.warning(f"auto_log_competitor 실패 {business_id}: {e}")

async def _fill_action_score_after():
    """행동 로그의 score_after를 7일 후 점수로 채움 (매일 새벽 3시 30분 실행)"""
    from db.supabase_client import get_client, execute as _execute

    supabase = get_client()
    target_date = (date.today() - timedelta(days=7)).isoformat()

    try:
        logs = await _execute(
            supabase.table("business_action_log")
            .select("id, business_id, action_date")
            .eq("action_date", target_date)
            .is_("score_after", "null")
        )
    except Exception as e:
        logger.warning("[fill_action_score_after] 테이블 조회 실패 (미생성?): %s", e)
        return

    if not (logs and logs.data):
        return

    for log in logs.data:
        try:
            score_row = await _execute(
                supabase.table("score_history")
                .select("unified_score, total_score")
                .eq("business_id", log["business_id"])
                .order("score_date", desc=True)
                .limit(1)
                .maybe_single()
            )
            if score_row and score_row.data:
                _uni = score_row.data.get("unified_score")
                score_val = _uni if _uni is not None else score_row.data.get("total_score")
                await _execute(
                    supabase.table("business_action_log")
                    .update({"score_after": score_val})
                    .eq("id", log["id"])
                )
                logger.info(
                    "[fill_action_score_after] id=%s score_after=%.1f",
                    log["id"],
                    score_val or 0,
                )
        except Exception as e:
            logger.warning("[fill_action_score_after] 개별 처리 실패: %s", e)


async def weekly_score_report_job():
    """매주 월요일 오전 9시 — 주간 성적표 카카오 알림 (모든 active 구독자)

    이번 주 AI 노출 점수와 지난 주 대비 변화, 최우선 할 일 1개를 알림.
    """
    from db.supabase_client import get_client, execute as _exec
    from services.kakao_notify import KakaoNotifier
    from services.gap_analyzer import analyze_gap_from_db

    try:
        supabase = get_client()
        notifier = KakaoNotifier()

        # active/grace_period 구독자 조회 (profiles FK 없으므로 별도 조회)
        subs_res = await _exec(
            supabase.table("subscriptions")
            .select("user_id, plan")
            .in_("status", ["active", "grace_period"])
        )
        subs = subs_res.data or []
        logger.info("[weekly_score_report_job] 대상 구독자 %d명", len(subs))

        for sub in subs:
            try:
                # profiles에서 phone 별도 조회
                phone_res = await _exec(
                    supabase.table("profiles")
                    .select("phone")
                    .eq("user_id", sub["user_id"])
                    .limit(1)
                )
                phone = ((phone_res.data or [{}])[0]).get("phone")
                if not phone:
                    continue

                # businesses 별도 조회
                biz_res = await _exec(
                    supabase.table("businesses")
                    .select("id, name")
                    .eq("user_id", sub["user_id"])
                    .eq("is_active", True)
                    .limit(1)
                )
                biz_list = biz_res.data or []
                if not biz_list:
                    continue
                biz = biz_list[0]
                biz_id = biz.get("id")
                biz_name = biz.get("name", "")
                if not biz_id:
                    continue

                # 최신 score_history 2개 조회 (이번 주 vs 지난 주)
                hist_res = await _exec(
                    supabase.table("score_history")
                    .select("unified_score, total_score, score_date")
                    .eq("business_id", biz_id)
                    .order("score_date", desc=True)
                    .limit(2)
                )
                history = hist_res.data or []
                if not history:
                    continue

                def _hist_score(row: dict) -> float:
                    _u = row.get("unified_score")
                    if _u is not None:
                        return float(_u)
                    return float(row.get("total_score") or 0)

                current_score = _hist_score(history[0])
                prev_score = _hist_score(history[1]) if len(history) >= 2 else current_score

                # gap_analysis에서 최우선 할 일 추출
                top_action = "소개글 안 Q&A 섹션을 1개 추가해보세요 — AI 브리핑 인용 후보 가능성 상승"
                try:
                    gap = await analyze_gap_from_db(biz_id, supabase)
                    if gap and gap.dimensions:
                        worst_dim = max(gap.dimensions, key=lambda d: d.gap_score)
                        top_action = worst_dim.gap_reason or top_action
                except Exception as gap_err:
                    logger.warning(
                        "[weekly_score_report_job] gap 조회 실패 biz=%s: %s", biz_id, gap_err
                    )

                await notifier.send_weekly_score_report(
                    phone=phone,
                    business_name=biz_name,
                    current_score=current_score,
                    prev_score=prev_score,
                    top_action=top_action,
                )

            except Exception as e:
                logger.warning("[weekly_score_report_job] 개별 처리 실패: %s", e)

    except Exception as e:
        logger.error("[weekly_score_report_job] 전체 실패: %s", e)
        await send_slack_alert("weekly_score_report_job 실패", str(e), level="error")


async def check_briefing_alert_job():
    """매일 오전 8시 — 네이버 AI 브리핑 언급 변화 감지 후 카카오 알림

    어제 스캔 결과와 그 전 날 결과를 비교:
    - False → True: 브리핑 등장 축하 알림
    - True → False: 브리핑 이탈 경고 알림
    profiles.kakao_scan_notify=True인 사용자에게만 발송.
    """
    from db.supabase_client import get_client, execute as _exec
    from services.kakao_notify import KakaoNotifier
    from datetime import datetime, timezone

    try:
        supabase = get_client()
        notifier = KakaoNotifier()

        today = date.today()
        yesterday = (today - timedelta(days=1)).isoformat()
        day_before = (today - timedelta(days=2)).isoformat()

        # 어제 스캔이 완료된 사업장 조회 (active 구독자만)
        scan_res = await _exec(
            supabase.table("scan_results")
            .select("business_id, naver_result, scanned_at")
            .gte("scanned_at", yesterday + "T00:00:00")
            .lt("scanned_at", today.isoformat() + "T00:00:00")
            .order("scanned_at", desc=True)
        )
        today_scans = scan_res.data or []

        if not today_scans:
            logger.debug("[check_briefing_alert_job] 어제 스캔 결과 없음")
            return

        # business_id별 최신 스캔 1개씩 추출
        seen_biz: dict[str, dict] = {}
        for row in today_scans:
            bid = row.get("business_id")
            if bid and bid not in seen_biz:
                seen_biz[bid] = row

        biz_ids = list(seen_biz.keys())
        logger.info("[check_briefing_alert_job] 어제 스캔 사업장 %d개 분석", len(biz_ids))

        # 전날 스캔 결과 조회 (비교용)
        prev_res = await _exec(
            supabase.table("scan_results")
            .select("business_id, naver_result, scanned_at")
            .gte("scanned_at", day_before + "T00:00:00")
            .lt("scanned_at", yesterday + "T00:00:00")
            .in_("business_id", biz_ids)
            .order("scanned_at", desc=True)
        )
        prev_scans_data = prev_res.data or []
        prev_map: dict[str, dict] = {}
        for row in prev_scans_data:
            bid = row.get("business_id")
            if bid and bid not in prev_map:
                prev_map[bid] = row

        # 사업장 정보 + 구독자 phone 조회 (kakao_scan_notify 포함)
        biz_info_res = await _exec(
            supabase.table("businesses")
            .select("id, name, user_id")
            .in_("id", biz_ids)
            .eq("is_active", True)
        )
        biz_info_map: dict[str, dict] = {
            b["id"]: b for b in (biz_info_res.data or [])
        }

        # 구독자 phone + kakao_scan_notify 조회
        user_ids = list({b.get("user_id") for b in biz_info_map.values() if b.get("user_id")})
        if not user_ids:
            return

        profile_res = await _exec(
            supabase.table("profiles")
            .select("user_id, phone, kakao_scan_notify")
            .in_("user_id", user_ids)
        )
        profile_map: dict[str, dict] = {
            p["user_id"]: p for p in (profile_res.data or [])
        }

        for biz_id, today_scan in seen_biz.items():
            try:
                biz_info = biz_info_map.get(biz_id)
                if not biz_info:
                    continue

                user_id = biz_info.get("user_id")
                profile = profile_map.get(user_id or "")
                if not profile:
                    continue

                phone = profile.get("phone")
                # kakao_scan_notify가 명시적 False면 스킵, None이면 기본 발송
                if profile.get("kakao_scan_notify") is False:
                    continue
                if not phone:
                    continue

                biz_name = biz_info.get("name", "")

                # 오늘 브리핑 언급 여부
                today_naver = today_scan.get("naver_result") or {}
                today_mentioned = bool(
                    today_naver.get("mentioned_in_briefing")
                    or today_naver.get("ai_briefing_mentioned")
                )

                # 어제 브리핑 언급 여부 (비교 기준)
                prev_scan = prev_map.get(biz_id)
                if not prev_scan:
                    # 전날 스캔 없으면 변화 감지 불가 — 건너뜀
                    continue

                prev_naver = prev_scan.get("naver_result") or {}
                prev_mentioned = bool(
                    prev_naver.get("mentioned_in_briefing")
                    or prev_naver.get("ai_briefing_mentioned")
                )

                if today_mentioned == prev_mentioned:
                    # 변화 없음 — 알림 불필요
                    continue

                if today_mentioned and not prev_mentioned:
                    # 새로 등장
                    message = (
                        f"[AEOlab] {biz_name}\n\n"
                        f"축하합니다! 네이버 AI 브리핑에 내 가게가 나왔습니다!\n\n"
                        f"AI 검색에서 내 가게 이름이 언급되기 시작했어요.\n"
                        f"지금 FAQ와 소개글을 유지해 노출을 지속하세요.\n\n"
                        f"aeolab.co.kr/dashboard 에서 확인"
                    )
                    _logger.info(
                        "[check_briefing_alert_job] biz=%s 브리핑 신규 등장 — 알림 발송", biz_id
                    )
                else:
                    # 이탈
                    message = (
                        f"[AEOlab] {biz_name}\n\n"
                        f"네이버 AI 브리핑에서 내 가게가 빠졌습니다.\n\n"
                        f"소개글 안 Q&A 섹션을 추가하거나 소식을 업데이트하면\n"
                        f"다시 브리핑에 나올 수 있습니다.\n\n"
                        f"개선 가이드 보기 → aeolab.co.kr/guide"
                    )
                    _logger.info(
                        "[check_briefing_alert_job] biz=%s 브리핑 이탈 — 알림 발송", biz_id
                    )

                await notifier._send_raw(phone, message, template_code="AEOLAB_SCAN_01")

            except Exception as e:
                logger.warning(
                    "[check_briefing_alert_job] 개별 처리 실패 biz=%s: %s", biz_id, e
                )

    except Exception as e:
        logger.error("[check_briefing_alert_job] 전체 실패: %s", e)
        await send_slack_alert("check_briefing_alert_job 실패", str(e), level="error")


async def _detect_competitor_score_spike():
    """경쟁사 score가 이번 주 스캔 대비 지난 주 스캔에서 15점 이상 상승 시 알림.

    scan_results.competitor_scores JSONB {comp_id: {name, score, ...}} 구조 비교.
    score_history.business_id는 사업장 기준이므로 경쟁사 점수 조회에 사용 불가.
    """
    import asyncio as _asyncio
    from db.supabase_client import get_client as _get_client
    try:
        supabase = _get_client()
        today = date.today()
        week_ago = today - timedelta(days=7)
        threshold = 15.0

        # 활성 사업장 목록 조회
        bizs_res = await _asyncio.to_thread(
            supabase.table("businesses")
            .select("id,user_id,name,category")
            .eq("is_active", True)
            .execute
        )
        bizs = bizs_res.data or []
        if not bizs:
            return

        for biz in bizs:
            try:
                biz_id = biz["id"]

                # 이번 주 최신 스캔 (최근 3일 이내)
                this_scan_res = await _asyncio.to_thread(
                    supabase.table("scan_results")
                    .select("competitor_scores,created_at")
                    .eq("business_id", biz_id)
                    .gte("created_at", str(today - timedelta(days=3)))
                    .order("created_at", desc=True)
                    .limit(1)
                    .execute
                )
                # 지난 주 스캔 (4~10일 전)
                last_scan_res = await _asyncio.to_thread(
                    supabase.table("scan_results")
                    .select("competitor_scores,created_at")
                    .eq("business_id", biz_id)
                    .gte("created_at", str(week_ago))
                    .lt("created_at", str(today - timedelta(days=4)))
                    .order("created_at", desc=True)
                    .limit(1)
                    .execute
                )

                if not (this_scan_res.data and last_scan_res.data):
                    continue

                this_scores = this_scan_res.data[0].get("competitor_scores") or {}
                last_scores = last_scan_res.data[0].get("competitor_scores") or {}

                if not (this_scores and last_scores):
                    continue

                # 경쟁사별 점수 비교 — competitor_scores 딕셔너리는 comp_id를 키로 하고
                # 값에는 "score"만 있음("unified_score"/"total_score" 키는 존재한 적 없어
                # 이전 코드가 이 함수를 사실상 상시 0점 비교로 무력화시키고 있었음)
                spike_comps = []
                for comp_id, this_data in this_scores.items():
                    last_data = last_scores.get(comp_id, {})
                    if not last_data:
                        continue
                    this_score = float(this_data.get("score") or 0)
                    last_score = float(last_data.get("score") or 0)
                    comp_name = this_data.get("name") or comp_id
                    if this_score > 0 and last_score > 0 and (this_score - last_score) >= threshold:
                        spike_comps.append((comp_name, this_score - last_score, this_score))

                if not spike_comps:
                    continue

                # 중복 알림 방지 (7일 쿨다운)
                notif_res = await _asyncio.to_thread(
                    supabase.table("notifications")
                    .select("id")
                    .eq("business_id", biz_id)
                    .eq("type", "competitor_spike")
                    .gte("created_at", str(week_ago) + "T00:00:00")
                    .execute
                )
                if notif_res.data:
                    continue

                # 사용자 phone + 알림 설정 조회
                profile_res = await _asyncio.to_thread(
                    supabase.table("profiles")
                    .select("phone,kakao_competitor_notify")
                    .eq("user_id", biz["user_id"])
                    .maybe_single()
                    .execute
                )
                if not (profile_res and profile_res.data):
                    continue

                profile = profile_res.data
                phone = profile.get("phone")
                if not phone or profile.get("kakao_competitor_notify") is False:
                    continue

                # 가장 급등한 경쟁사 1개만 알림
                spike_comps.sort(key=lambda x: x[1], reverse=True)
                comp_name, delta, comp_score = spike_comps[0]

                from services.share_card import _score_stage_label
                comp_stage = _score_stage_label(comp_score)

                masked = phone[:3] + "****" + phone[-4:] if len(phone) >= 7 else "***"
                biz_name = biz.get("name", "")
                _nl = "\n"
                msg = (
                    "[AEOlab] " + biz_name + _nl + _nl
                    + "경쟁업체 " + comp_name + " AI 노출 점수 상승"
                    + " (현재 " + comp_stage + ")" + _nl + _nl
                    + "내 가게 현황 확인 및 FAQ 업데이트를 권장합니다." + _nl
                    + "경쟁사 비교: https://aeolab.co.kr/competitors"
                )

                if _KAKAO_CONFIGURED:
                    from services.kakao_notify import KakaoNotifier as _KN2
                    _kn2 = _KN2()
                    await _kn2._send_raw(phone, msg, template_code="AEOLAB_COMP_01")
                    logger.info(
                        "[competitor_spike] biz=%s comp=%s +%d -> %s 알림",
                        biz_name, comp_name, round(delta), masked,
                    )

                await _asyncio.to_thread(
                    supabase.table("notifications").insert({
                        "business_id": biz_id,
                        "type": "competitor_spike",
                        "message": msg,
                    }).execute
                )

            except Exception as e:
                logger.warning("[competitor_spike] 실패 biz=%s: %s", biz.get("name"), e)

    except Exception as e:
        logger.warning("_detect_competitor_score_spike 실패: %s", e)

async def send_monthly_performance_reports():
    """구독 후 30/60/90일차에 성과 이메일 자동 발송 (매일 오전 9시 실행)"""
    import asyncio as _asyncio
    from db.supabase_client import get_client as _get_client
    try:
        from services.email_sender import send_email as _send_email
    except Exception as _ie:
        logger.warning(f"send_monthly_performance_reports: email_sender import 실패 {_ie}")
        return

    try:
        supabase = _get_client()
        today = date.today()

        # 활성 구독자 조회
        subs_res = await _asyncio.to_thread(
            supabase.table("subscriptions")
            .select("user_id, plan, start_at")
            .eq("status", "active")
            .execute
        )
        subs = subs_res.data or []

        # admin_client는 루프 밖에서 1회만 생성 (루프 내 반복 생성 성능 낭비 수정)
        from supabase import create_client as _create_client_monthly
        import os as _os_monthly
        admin_client = _create_client_monthly(
            _os_monthly.getenv("SUPABASE_URL", ""),
            _os_monthly.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
        )

        for sub in subs:
            try:
                start_raw = sub.get("start_at")
                if not start_raw:
                    continue
                start = date.fromisoformat(str(start_raw)[:10])
                days_since = (today - start).days
                if days_since not in (30, 60, 90):
                    continue

                # 사업장 목록 (첫 번째)
                bizs_res = await _asyncio.to_thread(
                    supabase.table("businesses")
                    .select("id, name")
                    .eq("user_id", sub["user_id"])
                    .eq("is_active", True)
                    .limit(1)
                    .execute
                )
                if not (bizs_res and bizs_res.data):
                    continue
                biz = bizs_res.data[0]

                # 현재 점수
                score_now_r = await _asyncio.to_thread(
                    supabase.table("score_history")
                    .select("unified_score, total_score")
                    .eq("business_id", biz["id"])
                    .order("score_date", desc=True)
                    .limit(1)
                    .execute
                )
                # 28일 전 점수
                score_before_r = await _asyncio.to_thread(
                    supabase.table("score_history")
                    .select("unified_score, total_score")
                    .eq("business_id", biz["id"])
                    .lte("score_date", str(today - timedelta(days=28)))
                    .order("score_date", desc=True)
                    .limit(1)
                    .execute
                )

                def _get_score(r):
                    if not (r and r.data):
                        return 0.0
                    row = r.data[0]
                    _u = row.get("unified_score")
                    if _u is not None:
                        return float(_u)
                    return float(row.get("total_score") or 0)

                score_now = _get_score(score_now_r)
                score_before = _get_score(score_before_r)
                delta = score_now - score_before
                from services.share_card import _score_stage_label
                stage_before = _score_stage_label(score_before)
                stage_now = _score_stage_label(score_now)
                trend_text = "상승" if delta > 0 else ("하락" if delta < 0 else "유지")
                color = "#10B981" if delta >= 0 else "#EF4444"

                # 완료한 행동 수 (30일)
                try:
                    actions_r = await _asyncio.to_thread(
                        supabase.table("business_action_log")
                        .select("id", count="exact")
                        .eq("business_id", biz["id"])
                        .gte("action_date", str(today - timedelta(days=30)))
                        .execute
                    )
                    action_count = actions_r.count or 0
                except Exception as _ace:
                    logger.warning(f"[monthly_perf] action_count 조회 실패 biz={biz['id']}: {_ace}")
                    action_count = 0

                # 사용자 이메일 (auth.users 직접 접근) — admin_client는 루프 밖에서 1회만 생성
                try:
                    user_data = admin_client.auth.admin.get_user_by_id(sub["user_id"])
                    user_email = user_data.user.email if user_data and user_data.user else None
                except Exception as _ue:
                    logger.warning(f"[monthly_perf] 이메일 조회 실패 user={sub["user_id"]}: {_ue}")
                    continue

                if not user_email:
                    continue

                biz_name = biz["name"]
                html = f"""
<div style="font-family:Apple SD Gothic Neo,sans-serif;max-width:560px;margin:auto;padding:24px">
  <h2 style="color:#111;margin-bottom:4px">{biz_name}</h2>
  <p style="color:#6B7280;margin-top:0">{days_since}일 성과 리포트</p>
  <div style="background:#F9FAFB;border-radius:12px;padding:20px;margin:16px 0;border:1px solid #E5E7EB">
    <p style="color:#6B7280;margin:0 0 4px;font-size:13px">AI 노출 변화 (지난 28일)</p>
    <p style="font-size:28px;font-weight:700;color:{color};margin:4px 0">{trend_text}</p>
    <p style="color:#374151;margin:0">{stage_before} → {stage_now}</p>
  </div>
  <p style="color:#374151">이번 달 완료한 행동: <strong>{action_count}건</strong></p>
  <a href="https://aeolab.co.kr/guide"
     style="display:inline-block;background:#3B82F6;color:white;padding:12px 24px;
            border-radius:8px;text-decoration:none;margin-top:8px;font-weight:600">
    가이드 확인하기 →
  </a>
  <p style="color:#9CA3AF;font-size:12px;margin-top:24px">
    AEOlab · 구독 관리:
    <a href="https://aeolab.co.kr/settings" style="color:#9CA3AF">설정 페이지</a>
  </p>
</div>
"""
                subject = f"[{biz_name}] {days_since}일 동안 이렇게 달라졌습니다"
                ok = await _send_email(user_email, subject, html)
                if ok:
                    logger.info(f"[monthly_perf] 발송 완료: {biz_name} ({days_since}일) → {user_email[:2]}***")
                else:
                    logger.warning(f"[monthly_perf] 발송 실패: {biz_name} ({days_since}일)")

            except Exception as e:
                logger.warning(f"[monthly_perf] 개별 처리 실패 user={sub.get('user_id')}: {e}")

    except Exception as e:
        logger.warning(f"send_monthly_performance_reports 전체 실패: {e}")
        await send_slack_alert("send_monthly_performance_reports 실패", str(e), level="warning")


# ── v3.6 — 가입 7일차 자동 재스캔 + 행동 알림 (2026-04-24) ─────────────────
async def new_user_day7_rescan_job():
    """매일 오전 9시: 가입 정확히 7일 전인 사용자의 첫 사업장 자동 재스캔(quick) + 알림.

    중복 차단: notifications 테이블 (user_id, type='day7_action') 멱등키로 한 번만 발송.
    """
    from db.supabase_client import get_client

    try:
        supabase = get_client()
        today = date.today()
        target_date = today - timedelta(days=7)
        target_start = target_date.isoformat() + "T00:00:00"
        target_end   = target_date.isoformat() + "T23:59:59"

        # 1) 가입 7일 전인 profiles 조회 (created_at 기준)
        prof_res = await _db(
            supabase.table("profiles")
            .select("id, phone")
            .gte("created_at", target_start)
            .lte("created_at", target_end)
            .limit(500)
        )
        profiles = (prof_res.data or []) if prof_res else []
        if not profiles:
            logger.info("[day7_rescan] 대상 사용자 없음")
            return

        user_ids = [p["id"] for p in profiles if p.get("id")]
        phone_by_user = {p["id"]: p.get("phone") for p in profiles if p.get("id")}

        # 2) 각자의 첫 사업장 조회 (가장 먼저 등록한 사업장)
        biz_res = await _db(
            supabase.table("businesses")
            .select("id, name, user_id, category, region, business_type, keywords, created_at")
            .in_("user_id", user_ids)
            .eq("is_active", True)
            .order("created_at", desc=False)
        )
        biz_rows = (biz_res.data or []) if biz_res else []

        first_biz_by_user: dict[str, dict] = {}
        for b in biz_rows:
            uid = b.get("user_id")
            if uid and uid not in first_biz_by_user:
                first_biz_by_user[uid] = b

        if not first_biz_by_user:
            logger.info("[day7_rescan] 대상 사업장 없음")
            return

        # 3) 멱등 차단용 — notifications 테이블에서 day7_action 발송 이력 조회
        sent_user_ids: set = set()
        try:
            notif_res = await _db(
                supabase.table("notifications")
                .select("user_id")
                .eq("type", "day7_action")
                .in_("user_id", list(first_biz_by_user.keys()))
            )
            sent_user_ids = {
                n["user_id"] for n in (notif_res.data or []) if n.get("user_id")
            }
        except Exception as e:
            logger.warning(f"[day7_rescan] notifications 조회 실패 (계속 진행): {e}")

        logger.info(
            f"[day7_rescan] 대상 {len(first_biz_by_user)}명 (이미 발송 {len(sent_user_ids)}명)"
        )

        # 4) 각 사용자별 처리: 재스캔 트리거 + 알림 + 멱등 INSERT
        from routers.scan import _run_quick_scan as _quick
        from models.schemas import ScanRequest

        for uid, biz in first_biz_by_user.items():
            if uid in sent_user_ids:
                continue
            try:
                biz_id = biz.get("id")
                if not biz_id:
                    continue

                # 4-a) 재스캔 (백그라운드 — 실패해도 알림은 발송)
                import uuid as _uuid
                scan_id = str(_uuid.uuid4())
                req = ScanRequest(
                    business_name=biz.get("name") or "",
                    category=biz.get("category") or "other",
                    region=biz.get("region") or "",
                    keywords=biz.get("keywords") or None,
                    business_id=biz_id,
                )
                try:
                    await _quick(scan_id, req)
                except Exception as e:
                    logger.warning(f"[day7_rescan] quick scan 실패 biz={biz_id}: {e}")

                # 4-b) 카카오 알림 (phone 있을 때만)
                phone = phone_by_user.get(uid)
                if phone and _KAKAO_CONFIGURED:
                    try:
                        from services.kakao_notify import KakaoNotifier as _KN
                        _notifier = _KN()
                        biz_name = biz.get("name") or "내 가게"
                        message = (
                            f"[AEOlab] {biz_name}\n\n"
                            "가입 7일차 자동 재스캔이 완료됐습니다.\n"
                            "오늘의 추천 행동 1가지를 대시보드에서 확인하세요.\n\n"
                            "→ aeolab.co.kr"
                        )
                        await _notifier._send_raw(
                            phone, message, template_code="AEOLAB_ACTION_01"
                        )
                    except Exception as e:
                        logger.warning(f"[day7_rescan] 카카오 발송 실패 user={uid}: {e}")

                # 4-c) notifications INSERT — 멱등키 (user_id, type='day7_action')
                try:
                    await _db(
                        supabase.table("notifications").insert({
                            "user_id": uid,
                            "type": "day7_action",
                            "title": "가입 7일차 자동 재스캔 완료",
                            "message": "오늘의 추천 행동 1가지를 확인하세요.",
                            "metadata": {"business_id": biz_id, "scan_id": scan_id},
                        })
                    )
                except Exception as e:
                    logger.warning(f"[day7_rescan] notifications INSERT 실패 user={uid}: {e}")

            except Exception as e:
                logger.warning(f"[day7_rescan] 사용자 처리 실패 user={uid}: {e}")

    except Exception as e:
        logger.error(f"new_user_day7_rescan_job 전체 실패: {e}")
        await send_slack_alert("new_user_day7_rescan_job 실패", str(e), level="warning")


# ── 가입 후 미결제 사용자 전환 알림 시퀀스 D+7/14/30 ────────────────────────
async def conversion_followup_job():
    """매일 오전 10시 KST (UTC 01:00): 가입 후 구독 미결제 사용자 전환 유도 알림.

    대상: auth.users 기준 D+7/14/30 가입자 중 subscriptions.status='active' 없는 사용자
    중복 차단: notifications 테이블 멱등키 (user_id + type='conversion_d7/d14/d30')
    알림 채널: 이메일 (전체) + 카카오 (phone 있고 kakao_scan_notify=True 인 경우만, D+7/30)
    """
    from db.supabase_client import get_client
    from services.email_sender import send_conversion_followup

    _DAY_CONFIGS = [
        {"day": 7,  "notif_type": "conversion_d7",  "kakao": True},
        {"day": 14, "notif_type": "conversion_d14", "kakao": False},
        {"day": 30, "notif_type": "conversion_d30", "kakao": True},
    ]

    try:
        supabase = get_client()
        today = date.today()

        for cfg in _DAY_CONFIGS:
            day: int = cfg["day"]
            notif_type: str = cfg["notif_type"]
            send_kakao: bool = cfg["kakao"]

            target_date = today - timedelta(days=day)
            target_start = target_date.isoformat() + "T00:00:00"
            target_end   = target_date.isoformat() + "T23:59:59"

            # 1) 해당 날짜에 가입한 profiles 조회
            prof_res = await _db(
                supabase.table("profiles")
                .select("id, phone, kakao_scan_notify")
                .gte("created_at", target_start)
                .lte("created_at", target_end)
                .limit(500)
            )
            profiles = (prof_res.data or []) if prof_res else []
            if not profiles:
                logger.info(f"[conversion_followup] D+{day}: 대상 사용자 없음")
                continue

            user_ids = [p["id"] for p in profiles if p.get("id")]

            # 2) 구독 활성 사용자 제외 (subscriptions.status='active')
            subs_res = await _db(
                supabase.table("subscriptions")
                .select("user_id")
                .in_("user_id", user_ids)
                .eq("status", "active")
            )
            active_user_ids: set = {
                r["user_id"] for r in (subs_res.data or []) if r.get("user_id")
            } if subs_res else set()

            # 3) 이미 발송한 사용자 제외 (notifications 멱등키)
            notif_res = await _db(
                supabase.table("notifications")
                .select("user_id")
                .eq("type", notif_type)
                .in_("user_id", user_ids)
            )
            sent_user_ids: set = {
                n["user_id"] for n in (notif_res.data or []) if n.get("user_id")
            } if notif_res else set()

            # 4) 대상 필터링 (미결제 + 미발송)
            target_profiles = [
                p for p in profiles
                if p.get("id")
                and p["id"] not in active_user_ids
                and p["id"] not in sent_user_ids
            ]
            logger.info(
                f"[conversion_followup] D+{day}: 가입 {len(profiles)}명 / "
                f"활성구독 제외 {len(active_user_ids)}명 / 이미발송 {len(sent_user_ids)}명 / "
                f"발송 대상 {len(target_profiles)}명"
            )

            if not target_profiles:
                continue

            # 5) auth.users 이메일 조회 — Supabase admin API 접근은 service_role로
            target_user_ids = [p["id"] for p in target_profiles]
            phone_by_user = {p["id"]: p.get("phone") for p in target_profiles}
            kakao_by_user = {p["id"]: bool(p.get("kakao_scan_notify")) for p in target_profiles}

            # 사업장명·업종 조회 (개인화 이메일용)
            biz_by_user: dict[str, dict] = {}
            try:
                biz_res = await _db(
                    supabase.table("businesses")
                    .select("user_id, name, category")
                    .in_("user_id", target_user_ids)
                    .limit(500)
                )
                for row in (biz_res.data or []):
                    uid = row.get("user_id")
                    if uid:
                        biz_by_user[uid] = row
            except Exception as e:
                logger.warning(f"[conversion_followup] D+{day}: businesses 조회 실패: {e}")

            # profiles 테이블에 email 컬럼이 없으므로 businesses → 이메일은
            # trial_scans 또는 profiles.email 컬럼 가용 여부에 따라 폴백 조회
            # 여기서는 auth 이메일 직접 접근이 불가하므로 profiles.email 컬럼 시도 후
            # businesses 테이블의 user 이메일을 대체 경로로 사용
            email_by_user: dict[str, str] = {}
            try:
                email_prof_res = await _db(
                    supabase.table("profiles")
                    .select("user_id, email")
                    .in_("user_id", target_user_ids)
                )
                for row in (email_prof_res.data or []):
                    uid = row.get("user_id")
                    em = row.get("email")
                    if uid and em:
                        email_by_user[uid] = em
            except Exception as e:
                logger.warning(f"[conversion_followup] D+{day}: profiles.email 조회 실패: {e}")

            # 이메일 없는 사용자 — waitlist 테이블에서 보완 시도
            missing_ids = [uid for uid in target_user_ids if uid not in email_by_user]
            if missing_ids:
                try:
                    wl_res = await _db(
                        supabase.table("waitlist")
                        .select("user_id, email")
                        .in_("user_id", missing_ids)
                    )
                    for row in (wl_res.data or []):
                        uid = row.get("user_id")
                        em = row.get("email")
                        if uid and em and uid not in email_by_user:
                            email_by_user[uid] = em
                except Exception as e:
                    logger.warning(f"[conversion_followup] D+{day}: waitlist email 조회 실패: {e}")

            # 6) 각 사용자에게 발송
            sent_count = 0
            for profile in target_profiles:
                uid = profile.get("id")
                if not uid:
                    continue
                email = email_by_user.get(uid)
                if not email:
                    logger.warning(f"[conversion_followup] D+{day}: 이메일 없음 user={uid}")
                    continue

                try:
                    # 6-a) 이메일 발송
                    biz = biz_by_user.get(uid, {})
                    ok = await send_conversion_followup(
                        email=email,
                        day=day,
                        biz_name=biz.get("name", ""),
                        category=biz.get("category", ""),
                    )

                    # 6-b) 카카오 알림 (D+7, D+30만, phone+동의 필요)
                    if send_kakao and _KAKAO_CONFIGURED:
                        phone = phone_by_user.get(uid)
                        kakao_ok = kakao_by_user.get(uid, False)
                        if phone and kakao_ok:
                            try:
                                from services.kakao_notify import KakaoNotifier as _KN
                                _notifier = _KN()
                                if day == 7:
                                    msg = (
                                        "[AEOlab] 안녕하세요! 가입하신 지 일주일이 됐어요.\n"
                                        "아직 AI 노출 점수를 확인 못 하셨다면, "
                                        "지금 무료 체험으로 확인해 보세요.\n"
                                        "https://aeolab.co.kr/trial"
                                    )
                                else:  # day == 30
                                    msg = (
                                        "[AEOlab] 마지막 안내입니다.\n"
                                        "지금 시작하면 첫 달 4,950원 (50% 할인).\n"
                                        "https://aeolab.co.kr/pricing"
                                    )
                                await _notifier._send_raw(
                                    phone, msg, template_code="AEOLAB_NOTICE_01"
                                )
                            except Exception as e:
                                masked = f"{phone[:3]}****{phone[-2:]}" if len(phone) >= 5 else "***"
                                logger.warning(
                                    f"[conversion_followup] D+{day}: 카카오 실패 {masked}: {e}"
                                )

                    # 6-c) notifications 멱등 INSERT (발송 성공 여부와 무관하게 기록)
                    if ok:
                        try:
                            await _db(
                                supabase.table("notifications").insert({
                                    "user_id": uid,
                                    "type": notif_type,
                                    "title": f"가입 D+{day} 전환 알림 발송",
                                    "message": f"미결제 사용자 D+{day} 전환 유도 이메일 발송 완료",
                                    "channel": "email",
                                    "metadata": {"email": email, "day": day},
                                })
                            )
                        except Exception as e:
                            logger.warning(
                                f"[conversion_followup] D+{day}: notifications INSERT 실패 user={uid}: {e}"
                            )
                        sent_count += 1
                        logger.info(f"[conversion_followup] D+{day} 발송 OK: {email[:2]}***")

                except Exception as e:
                    logger.warning(
                        f"[conversion_followup] D+{day}: 사용자 처리 실패 user={uid}: {e}"
                    )

            logger.info(f"[conversion_followup] D+{day} 완료: {sent_count}건 발송")

    except Exception as e:
        logger.error(f"conversion_followup_job 전체 실패: {e}")
        await send_slack_alert("conversion_followup_job 실패", str(e), level="warning")


async def weekly_digest_job():
    """매주 월요일 08:30 KST: 활성 구독자에게 주간 AI 노출 현황 다이제스트 이메일 발송.

    발송 대상: subscriptions.status='active' 구독자
    이메일 출처: profiles.email 컬럼
    점수 출처: score_history 최근 2주 데이터
    AI 언급 출처: ai_citations 최근 7일
    키워드 출처: businesses.keywords[]
    멱등성: notifications 테이블 (type='weekly_digest' + business_id + 이번 주 월요일)
    AI 호출 0회 — 기존 DB 데이터만 조합
    """
    from db.supabase_client import get_client
    from services.email_sender import send_weekly_digest

    logger.info("weekly_digest_job started")

    try:
        supabase = get_client()
        today = date.today()
        # 이번 주 월요일 (오늘이 월요일이므로 today 자체)
        this_monday = today - timedelta(days=today.weekday())
        this_monday_str = this_monday.isoformat()
        last_week_start = (this_monday - timedelta(days=14)).isoformat()
        seven_days_ago = (today - timedelta(days=7)).isoformat()

        # 1) 활성 구독자 목록 조회
        subs_res = await _db(
            supabase.table("subscriptions")
            .select("user_id, plan")
            .eq("status", "active")
            .limit(1000)
        )
        subscriptions = (subs_res.data or []) if subs_res else []
        if not subscriptions:
            logger.info("[weekly_digest_job] 활성 구독자 없음 — 종료")
            return

        user_ids = [s["user_id"] for s in subscriptions if s.get("user_id")]
        logger.info(f"[weekly_digest_job] 활성 구독자 {len(user_ids)}명")

        # 2) profiles에서 이메일 조회
        prof_res = await _db(
            supabase.table("profiles")
            .select("user_id, email")
            .in_("user_id", user_ids)
        )
        email_by_user: dict[str, str] = {}
        for row in (prof_res.data or []) if prof_res else []:
            uid = row.get("user_id")
            em = row.get("email")
            if uid and em:
                email_by_user[uid] = em

        # 3) 각 구독자 처리
        sent_count = 0
        skip_count = 0
        for sub in subscriptions:
            uid = sub.get("user_id")
            if not uid:
                continue

            email = email_by_user.get(uid)
            if not email:
                logger.warning(f"[weekly_digest_job] 이메일 없음 user={uid} — skip")
                skip_count += 1
                continue

            try:
                # 3-a) 사업장 조회 (user_id 기준 첫 번째 활성 사업장)
                biz_res = await _db(
                    supabase.table("businesses")
                    .select("id, name, keywords")
                    .eq("user_id", uid)
                    .limit(1)
                )
                biz_rows = (biz_res.data or []) if biz_res else []
                if not biz_rows:
                    logger.warning(f"[weekly_digest_job] 사업장 없음 user={uid} — skip")
                    skip_count += 1
                    continue

                biz = biz_rows[0]
                biz_id = biz["id"]
                biz_name = biz.get("name") or "내 가게"
                keywords: list[str] = biz.get("keywords") or []

                # 3-b) 멱등성 체크 (이번 주 월요일 기준 이미 발송 여부)
                notif_res = await _db(
                    supabase.table("notifications")
                    .select("id")
                    .eq("type", "weekly_digest")
                    .eq("business_id", biz_id)
                    .gte("sent_at", this_monday_str + "T00:00:00")
                    .limit(1)
                )
                already_sent = bool((notif_res.data or []) if notif_res else [])
                if already_sent:
                    logger.info(f"[weekly_digest_job] 이미 발송됨 biz_id={biz_id} — skip")
                    skip_count += 1
                    continue

                # 3-c) score_history에서 이번 주 / 전주 점수 조회
                hist_res = await _db(
                    supabase.table("score_history")
                    .select("unified_score, score_date")
                    .eq("business_id", biz_id)
                    .gte("score_date", last_week_start)
                    .order("score_date", desc=True)
                    .limit(20)
                )
                hist_rows = (hist_res.data or []) if hist_res else []

                current_score: float | None = None
                prev_score: float | None = None
                for row in hist_rows:
                    row_date = (row.get("score_date") or "")[:10]
                    val = row.get("unified_score")
                    if val is None:
                        continue
                    val = float(val)
                    if row_date >= this_monday_str:
                        if current_score is None:
                            current_score = val
                    else:
                        if prev_score is None:
                            prev_score = val

                if current_score is None:
                    logger.warning(
                        f"[weekly_digest_job] 이번 주 점수 없음 biz_id={biz_id} — skip"
                    )
                    skip_count += 1
                    continue

                # 3-d) ai_citations 최근 7일 언급 횟수
                cite_res = await _db(
                    supabase.table("ai_citations")
                    .select("id", count="exact")
                    .eq("business_id", biz_id)
                    .gte("cited_at", seven_days_ago)
                )
                ai_citations_count = 0
                if cite_res:
                    # count 모드는 data가 빈 리스트이고 count 속성에 숫자가 있음
                    if hasattr(cite_res, "count") and cite_res.count is not None:
                        ai_citations_count = int(cite_res.count)
                    else:
                        ai_citations_count = len(cite_res.data or [])

                # 3-e) 발송
                ok = await send_weekly_digest(
                    to_email=email,
                    business_name=biz_name,
                    current_score=current_score,
                    prev_score=prev_score,
                    ai_citations_count=ai_citations_count,
                    top_keywords=keywords[:5],
                    biz_id=biz_id,
                )

                # 3-f) notifications 멱등 INSERT
                if ok:
                    try:
                        await _db(
                            supabase.table("notifications").insert({
                                "user_id": uid,
                                "business_id": biz_id,
                                "type": "weekly_digest",
                                "title": f"{biz_name} 주간 다이제스트 발송",
                                "message": (
                                    f"점수 {current_score:.0f}점 / AI 언급 {ai_citations_count}건"
                                ),
                                "channel": "email",
                                "sent_at": this_monday_str + "T08:30:00",
                                "metadata": {
                                    "score": current_score,
                                    "prev_score": prev_score,
                                    "citations": ai_citations_count,
                                    "week": this_monday_str,
                                },
                            })
                        )
                    except Exception as e:
                        logger.warning(
                            f"[weekly_digest_job] notifications INSERT 실패 biz_id={biz_id}: {e}"
                        )
                    sent_count += 1
                    logger.info(f"[weekly_digest_job] 발송 OK biz_id={biz_id} to={email[:2]}***")

            except Exception as e:
                logger.warning(
                    f"[weekly_digest_job] 사용자 처리 실패 user={uid}: {e}"
                )

        logger.info(
            f"[weekly_digest_job] 완료 — 발송 {sent_count}건 / 스킵 {skip_count}건"
        )

    except Exception as e:
        logger.error(f"weekly_digest_job 전체 실패: {e}")
        await send_slack_alert("weekly_digest_job 실패", str(e), level="warning")


async def weekly_competitor_sync_job():
    """매주 화요일 03:00 KST — 7일 이상 미갱신 경쟁사 네이버 플레이스 데이터 동기화.

    competitor_place_sync_job(월요일)과 달리 sync_all_competitor_places 대신
    경쟁사별 sync_competitor_place를 직접 호출해 7일 조건을 만족하는 경쟁사만 처리.
    서버 부하 방지: 경쟁사 간 2초 sleep, 사업장 간 5초 sleep.
    """
    from db.supabase_client import get_client, execute as _execute
    from services.competitor_place_crawler import sync_competitor_place
    from datetime import datetime, timezone, timedelta

    try:
        supabase = get_client()
        cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

        # 7일 이상 미갱신 또는 한 번도 동기화 안 된 경쟁사 조회
        _res = await _db(
            supabase.table("competitors")
            .select("id, name, naver_place_id, business_id, naver_place_last_synced_at")
            .eq("is_active", True)
            .not_.is_("naver_place_id", "null")
        )
        all_comps = _res.data or []

        # Python 레벨에서 7일 조건 필터 (OR 조건 — Supabase OR 쿼리 복잡성 회피)
        targets = [
            c for c in all_comps
            if not c.get("naver_place_last_synced_at")
            or c["naver_place_last_synced_at"] < cutoff
        ]

        if not targets:
            logger.info("[weekly_competitor_sync] 동기화 대상 없음")
            return

        logger.info(f"[weekly_competitor_sync] 대상 {len(targets)}개 경쟁사 동기화 시작")

        # 사업장별로 그룹화
        biz_groups: dict[str, list[dict]] = {}
        for comp in targets:
            biz_id = comp["business_id"]
            biz_groups.setdefault(biz_id, []).append(comp)

        import random as _random
        total_synced = 0
        total_errors = 0
        ip_banned = False

        for biz_id, comps in biz_groups.items():
            if ip_banned:
                break
            for comp in comps:
                if ip_banned:
                    break
                comp_id = comp.get("id")
                naver_place_id = comp.get("naver_place_id")
                if not comp_id or not naver_place_id:
                    continue
                try:
                    result = await sync_competitor_place(
                        comp_id, naver_place_id, supabase,
                        registered_name=comp.get("name", ""),
                    )
                    if result and result.get("error") == "ip_blocked":
                        logger.warning("[weekly_competitor_sync] IP 차단 감지, 전체 잡 조기 종료")
                        ip_banned = True
                        total_errors += 1
                        break
                    elif result and result.get("error"):
                        logger.warning(
                            f"[weekly_competitor_sync] 동기화 오류 comp={comp_id}: {result['error']}"
                        )
                        total_errors += 1
                    else:
                        total_synced += 1
                        logger.debug(f"[weekly_competitor_sync] 완료 comp={comp_id}")
                except Exception as e:
                    logger.warning(f"[weekly_competitor_sync] 예외 comp={comp_id}: {e}")
                    total_errors += 1
                # 경쟁사 간 랜덤 딜레이 (균일 패턴 차단 회피)
                await asyncio.sleep(_random.uniform(7, 15))
            if not ip_banned:
                # 사업장 그룹 간 딜레이
                await asyncio.sleep(_random.uniform(10, 20))

        logger.info(
            f"[weekly_competitor_sync] 완료 — 성공={total_synced}, 오류={total_errors}"
            + (" [IP 차단으로 조기 종료]" if ip_banned else "")
        )

    except Exception as e:
        logger.error(f"[weekly_competitor_sync] 전체 실패: {e}")
        await send_slack_alert("weekly_competitor_sync_job 실패", str(e), level="error")


# ════════════════════════════════════════════════════════════════
# 키워드 순위 측정 잡 (Phase A / service_unification_v1.0.md §6)
# ════════════════════════════════════════════════════════════════

async def _measure_keyword_rank_for_biz(biz: dict) -> bool:
    """단일 사업장 키워드 순위 측정 + scan_results.keyword_ranks 저장.

    반환: 성공 여부 (True/False).
    실패 시 로그만 남기고 다음 사업장 진행 (전체 잡 중단 안 함).
    """
    biz_id = biz.get("id")
    keywords = biz.get("keywords") or []
    keywords = [k.strip() for k in keywords if isinstance(k, str) and k.strip()]
    keywords = list(dict.fromkeys(keywords))[:10]
    if not biz_id or not keywords or not biz.get("name"):
        return False

    # 변동 감지용: 이전 측정 결과 미리 조회
    prev_ranks: dict = {}
    try:
        prev_res = await execute(
            get_client().table("scan_results")
                .select("keyword_ranks")
                .eq("business_id", biz_id)
                .order("scanned_at", desc=True)
                .limit(1)
        )
        if prev_res and prev_res.data:
            kr = prev_res.data[0].get("keyword_ranks")
            if isinstance(kr, dict):
                prev_ranks = {k: v for k, v in kr.items() if not k.startswith("_")}
    except Exception as _e:
        logger.warning(f"[keyword_rank] prev_ranks 조회 실패: {_e}")

    try:
        from services.naver_keyword_rank import measure_keywords as _measure
        rank_result = await _measure(
            keywords=keywords,
            biz_name=biz["name"],
            place_id=biz.get("naver_place_id"),
        )
    except Exception as e:
        logger.warning(f"[keyword_rank] biz={biz_id} 측정 실패: {e}")
        return False

    # 변동 감지 + 알림톡 발송 (TOP10 진입·이탈 또는 순위 ±3 이상 변동)
    await _maybe_notify_keyword_change(biz, prev_ranks, rank_result)

    # 평균 순위 (미노출=99)
    rank_values = []
    for kw in keywords:
        data = rank_result.get(kw) if isinstance(rank_result.get(kw), dict) else None
        if not data:
            continue
        ranks = [data.get("pc_rank"), data.get("mobile_rank"), data.get("place_rank")]
        ranks = [r for r in ranks if isinstance(r, (int, float)) and r > 0]
        rank_values.append(min(ranks) if ranks else 99.0)
    avg_rank = round(sum(rank_values) / len(rank_values), 2) if rank_values else None

    supabase = get_client()
    # 가장 최근 scan_results 갱신
    try:
        latest = await execute(
            supabase.table("scan_results")
                .select("id")
                .eq("business_id", biz_id)
                .order("scanned_at", desc=True)
                .limit(1)
        )
        if latest and latest.data:
            await execute(
                supabase.table("scan_results")
                    .update({"keyword_ranks": rank_result})
                    .eq("id", latest.data[0]["id"])
            )
        else:
            await execute(
                supabase.table("scan_results").insert({
                    "business_id": biz_id,
                    "query_used": "keyword_rank_only",
                    "keyword_ranks": rank_result,
                })
            )
        if avg_rank is not None:
            await execute(
                supabase.table("score_history").insert({
                    "business_id": biz_id,
                    "context": "keyword_rank",
                    "keyword_rank_avg": avg_rank,
                })
            )
        return True
    except Exception as e:
        logger.warning(f"[keyword_rank] biz={biz_id} 저장 실패: {e}")
        return False


async def _run_keyword_rank_for_plans(plans: list[str]) -> None:
    """지정된 플랜의 활성 구독자 사업장 전체에 대해 키워드 순위 측정.

    Semaphore로 동시성 제한 (BACKEND_MAX_CONCURRENCY 환경변수, 기본 2).
    사업장 간 5초 sleep으로 RAM peak 회피.
    """
    supabase = get_client()
    try:
        subs = await execute(
            supabase.table("subscriptions")
                .select("user_id, plan, status")
                .eq("status", "active")
                .in_("plan", plans)
        )
    except Exception as e:
        logger.error(f"[keyword_rank_job] subscriptions 조회 실패: {e}")
        return
    if not (subs and subs.data):
        logger.info(f"[keyword_rank_job] 대상 사용자 없음 (plans={plans})")
        return

    user_ids = [s["user_id"] for s in subs.data if s.get("user_id")]
    try:
        biz_res = await execute(
            supabase.table("businesses")
                .select("id, user_id, name, naver_place_id, keywords")
                .in_("user_id", user_ids)
        )
    except Exception as e:
        logger.error(f"[keyword_rank_job] businesses 조회 실패: {e}")
        return

    targets = [b for b in (biz_res.data or []) if b.get("keywords")]
    logger.info(f"[keyword_rank_job] plans={plans} 대상={len(targets)}건")

    success = 0
    failed = 0
    for b in targets:
        ok = await _measure_keyword_rank_for_biz(b)
        if ok:
            success += 1
        else:
            failed += 1
        await asyncio.sleep(5)  # 사업장 간 분산 (RAM peak·DDoS 회피)

    logger.info(f"[keyword_rank_job] 완료 — 성공={success}, 실패={failed}")


async def _maybe_notify_keyword_change(biz: dict, prev: dict, curr: dict) -> None:
    """키워드 순위 변동 시 카카오 알림톡 발송 (AEOLAB_KW_01).
    조건: TOP10 진입·이탈 또는 ±3 이상 변동. 한 키워드만 (가장 큰 변화).
    프로필 phone + kakao_competitor_notify 또는 kakao_scan_notify ON 사용자만.
    """
    if not isinstance(prev, dict) or not isinstance(curr, dict) or not prev:
        return  # 첫 측정이면 비교 없음

    def _best_rank(d: dict) -> int:
        if not isinstance(d, dict):
            return 99
        ranks = [d.get("pc_rank"), d.get("mobile_rank"), d.get("place_rank")]
        ranks = [r for r in ranks if isinstance(r, (int, float)) and r > 0]
        return int(min(ranks)) if ranks else 99

    biggest_change = None
    biggest_delta = 0
    for kw in (curr.keys() if isinstance(curr, dict) else []):
        if kw.startswith("_"):
            continue
        prev_rank = _best_rank(prev.get(kw, {}))
        curr_rank = _best_rank(curr.get(kw, {}))
        delta = prev_rank - curr_rank  # 양수 = 상승
        if abs(delta) >= 3 or (prev_rank > 10 and curr_rank <= 10) or (prev_rank <= 10 and curr_rank > 10):
            if abs(delta) > abs(biggest_delta):
                biggest_change = (kw, prev_rank, curr_rank)
                biggest_delta = delta

    if not biggest_change:
        return

    # 사용자 phone + 알림 동의 확인 (graceful)
    try:
        prof = await execute(
            get_client().table("profiles")
                .select("phone, kakao_scan_notify")
                .eq("user_id", biz.get("user_id"))
                .single()
        )
        if not (prof and prof.data):
            return
        phone = (prof.data or {}).get("phone")
        notify_on = (prof.data or {}).get("kakao_scan_notify", False)
        if not phone or not notify_on:
            return
    except Exception as _e:
        logger.warning(f"[keyword_rank_notify] 프로필 조회 실패: {_e}")
        return

    try:
        from services.kakao_notify import KakaoNotifier
        kw, p, c = biggest_change
        await KakaoNotifier().send_keyword_change(
            phone=phone,
            biz_name=biz.get("name", ""),
            keyword=kw,
            prev_rank=p,
            curr_rank=c,
        )
        # notifications 테이블에 멱등키 기록
        await execute(
            get_client().table("notifications").insert({
                "user_id": biz.get("user_id"),
                "type": "keyword_change",
                "keyword_change_payload": {
                    "biz_id": biz.get("id"),
                    "keyword": kw,
                    "prev_rank": p,
                    "curr_rank": c,
                    "delta": p - c,
                },
            })
        )
    except Exception as e:
        logger.warning(f"[keyword_change_notify] 발송 실패: {e}")


async def keyword_rank_basic_weekly_job() -> None:
    """Basic 플랜 주 1회 키워드 순위 측정 (매주 월요일 04:00 KST)."""
    try:
        await _run_keyword_rank_for_plans(["basic"])
    except Exception as e:
        logger.error(f"[keyword_rank_basic_weekly_job] 실패: {e}")
        await send_slack_alert("keyword_rank_basic_weekly_job 실패", str(e), level="error")


async def keyword_rank_pro_daily_job() -> None:
    """Pro/Biz/Enterprise 플랜 일 1회 키워드 순위 측정 (매일 04:30 KST)."""
    try:
        await _run_keyword_rank_for_plans(["pro", "biz", "enterprise", "startup"])
    except Exception as e:
        logger.error(f"[keyword_rank_pro_daily_job] 실패: {e}")


# ─── 소식 14일 미작성 알림 잡 (v1.1 §3.3) ─────────────────────────────────────────
async def inactive_post_alert_job() -> None:
    """14일 이상 소식 미작성 사업장에 카카오 알림 발송 (매일 09:10 KST).

    - last_post_at 컬럼 부재 또는 NULL/14일전 → 알림 대상
    - 멱등키: post_remind_{biz_id}_{cutoff_date}
    - has_recent_post=False 이거나 last_post_at is null AND created_at < 14d 전 사업장만
    - graceful fallback: last_post_at 컬럼 미존재 시 잡 종료 (warning 로그)
    """
    if not _KAKAO_CONFIGURED:
        logger.info("[inactive_post_alert_job] KAKAO 미설정 — 스킵")
        return

    try:
        from db.supabase_client import get_supabase
        from services.kakao_notify import KakaoNotifier

        supabase = get_supabase()
        notifier = KakaoNotifier()
        cutoff = datetime.now() - timedelta(days=14)
        cutoff_iso = cutoff.isoformat()
        cutoff_date = cutoff.date().isoformat()

        # last_post_at < cutoff OR (last_post_at IS NULL AND created_at < cutoff)
        try:
            res = await _db(
                supabase.table("businesses")
                .select("id, user_id, name, last_post_at, created_at")
                .or_(
                    f"last_post_at.lt.{cutoff_iso},last_post_at.is.null"
                )
                .eq("is_active", True)
                .limit(500)
            )
        except Exception as col_err:
            if "last_post_at" in str(col_err) or "column" in str(col_err).lower():
                logger.warning(
                    "[inactive_post_alert_job] last_post_at 컬럼 부재 — ALTER 미실행 가능성. 잡 스킵"
                )
                return
            raise

        rows = (res.data if res and res.data else []) or []
        if not rows:
            logger.info("[inactive_post_alert_job] 대상 없음")
            return

        sent = 0
        for biz in rows:
            # last_post_at NULL인 경우 created_at으로 가입한 지 14일+ 인지 확인
            if not biz.get("last_post_at"):
                created_at = biz.get("created_at")
                if created_at:
                    try:
                        ca = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                        if ca.replace(tzinfo=None) > cutoff:
                            continue  # 가입 14일 미만 — 새 사용자, 알림 skip
                    except Exception as _e:
                        logger.warning(f"[inactive_post_alert_job] created_at 파싱 실패 — {_e}")

            # 멱등키 체크 (14일에 1회만)
            idem_key = f"post_remind_{biz['id']}_{cutoff_date}"
            already = await _db(
                supabase.table("notifications")
                .select("id")
                .eq("business_id", biz["id"])
                .eq("type", "post_remind")
                .eq("idempotency_key", idem_key)
                .limit(1)
            )
            if already and already.data:
                continue

            # 사용자 폰 번호 조회
            prof_res = await _db(
                supabase.table("profiles")
                .select("phone, kakao_scan_notify")
                .eq("user_id", biz["user_id"])
                .maybe_single()
            )
            profile = (prof_res.data if prof_res and prof_res.data else None) or {}
            phone = profile.get("phone")
            if not phone:
                continue
            # 사용자 알림 옵트아웃 존중 (kakao_scan_notify=False면 skip)
            if profile.get("kakao_scan_notify") is False:
                continue

            try:
                await notifier.send_post_remind(phone, biz["name"], days=14)
                await _db(
                    supabase.table("notifications").insert({
                        "business_id": biz["id"],
                        "type": "post_remind",
                        "idempotency_key": idem_key,
                        "payload": {"last_post_at": biz.get("last_post_at"), "days": 14},
                    })
                )
                sent += 1
            except Exception as send_err:
                logger.warning(
                    f"[inactive_post_alert_job] 발송 실패 biz={biz.get('id')}: {send_err}"
                )

        logger.info(f"[inactive_post_alert_job] 발송 {sent}/{len(rows)}건 완료")
    except Exception as e:
        logger.error(f"[inactive_post_alert_job] 잡 실패: {e}")
        await send_slack_alert("inactive_post_alert_job 실패", str(e), level="error")


async def delivery_auto_cancel_job():
    """미결제 상태로 7일 경과한 대행 신청 자동 취소 (매일 10:30 KST).

    조건:
    - status = 'received' (주문 접수만 되고 결제가 완료되지 않은 상태 — 결제 완료 시
      confirm 엔드포인트가 즉시 'paid'로 전환하므로, 'received'가 7일간 유지된다는 것은
      곧 미결제 방치를 뜻한다. "결제완료+자료미제출" 케이스는 이 잡의 대상이 아니며
      delivery_auto_refund_job이 별도로 처리한다.)
    - created_at < now() - 7일
    - materials_url IS NULL 또는 빈 배열 (참고용 필터 — 결제 전이라 사실상 항상 비어있음)
    멱등성: 이미 cancelled 상태인 행은 조회 자체에서 제외됨.
    환불 없음: 결제 자체가 이뤄지지 않았으므로 Toss 결제취소 API 호출 불필요.
    """
    from datetime import timezone  # 2026-07-10: 누락 발견 — 이 import 없이는 timezone.utc가
    # NameError를 던지고 아래 broad try/except가 삼켜, 이 잡이 배포 이후 매일 조용히
    # 실패해왔을 가능성이 높음. jobs.py의 다른 함수들은 전부 로컬 import를 갖고 있었음.
    from db.supabase_client import get_client

    try:
        supabase = get_client()
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        cutoff_iso = cutoff.isoformat()

        res = await _db(
            supabase.table("delivery_orders")
            .select("id, business_id, created_at, materials_url")
            .eq("status", "received")
            .lt("created_at", cutoff_iso)
        )
        rows = (res.data if res and res.data else []) or []

        if not rows:
            logger.info("[delivery_auto_cancel_job] 취소 대상 없음")
            return

        # materials_url 이 null 또는 빈 배열인 행만 대상
        targets = [
            r for r in rows
            if not r.get("materials_url")
        ]

        if not targets:
            logger.info("[delivery_auto_cancel_job] 자료 제출 완료 주문 제외 후 취소 대상 없음")
            return

        cancelled_ids = [r["id"] for r in targets]

        await _db(
            supabase.table("delivery_orders")
            .update({
                "status": "cancelled",
                "refund_reason": "미결제 7일 경과 자동 취소 (결제 자체가 이뤄지지 않음)",
            })
            .in_("id", cancelled_ids)
            .eq("status", "received")  # TOCTOU 방지 — 조회~UPDATE 사이 결제완료된 주문 보호
        )

        logger.warning(
            f"[delivery_auto_cancel_job] {len(cancelled_ids)}건 자동 취소 완료: {cancelled_ids}"
        )

    except Exception as e:
        logger.warning(f"[delivery_auto_cancel_job] 잡 실패: {e}")


async def delivery_auto_refund_job():
    """결제완료 + 자료 미제출 7일 경과 주문 자동 환불 (매일 11:30 KST).

    랜딩 페이지 안내("결제 후 담당자가 카카오톡으로 연락드립니다 · 7일 내 자료 미제출 시
    자동 환불")가 실제로 지켜지도록 하는 잡. delivery_auto_cancel_job(미결제 방치 취소)과는
    별개 — 이 잡은 결제까지 완료했지만 자료를 안 보낸 고객을 대상으로 한다.

    조건:
    - status = 'paid'
    - paid_at IS NOT NULL AND paid_at < now() - 7일 (v6.2b 마이그레이션 필요 — 없으면 대상 0건)
    - materials_url IS NULL 또는 빈 배열
    처리: Toss 결제취소 API로 전액 환불 → 성공 시 status='refunded', refund_amount 기록,
    delivery_messages에 고객이 볼 수 있는 시스템 안내 메시지 삽입(카카오 환불 전용 템플릿
    미보유). 실패 시 이메일+Slack 운영자 알림(수동 확인 필요 — money-moving 이벤트).
    멱등성: status='paid' 조건이라 이미 refunded/cancelled된 행은 재조회되지 않음.
    """
    import httpx
    from datetime import timezone
    from db.supabase_client import get_client
    from services.email_sender import send_operator_alert

    # routers/delivery.py의 관리자 수동 환불(admin_update_status)과 값을 동일하게 유지할 것 —
    # 이중 환불(double refund) 방지용 원자적 락 마커(refund_reason IS NULL 조건부 UPDATE로 선점).
    _REFUND_CLAIM_MARKER = "__refund_processing__"

    toss_secret = os.getenv("TOSS_SECRET_KEY", "")
    if not toss_secret:
        logger.warning("[delivery_auto_refund_job] TOSS_SECRET_KEY 미설정 — 잡 스킵")
        return

    try:
        supabase = get_client()
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        cutoff_iso = cutoff.isoformat()

        res = await _db(
            supabase.table("delivery_orders")
            .select("id, user_id, business_id, package_type, amount, payment_key, paid_at, materials_url")
            .eq("status", "paid")
            .not_.is_("paid_at", "null")
            .lt("paid_at", cutoff_iso)
        )
        rows = (res.data if res and res.data else []) or []
        targets = [r for r in rows if not r.get("materials_url")]

        if not targets:
            logger.info("[delivery_auto_refund_job] 환불 대상 없음")
            return

        logger.info(f"[delivery_auto_refund_job] 환불 대상 {len(targets)}건")

        for order in targets:
            order_id = order["id"]
            payment_key = order.get("payment_key")
            amount = order.get("amount")
            if not payment_key:
                logger.error(
                    f"[delivery_auto_refund_job] payment_key 없음 — 수동 확인 필요: order_id={order_id}"
                )
                await send_operator_alert(
                    "대행 서비스 자동환불 실패 — payment_key 없음",
                    f"order_id={order_id}\n결제는 paid 상태인데 payment_key가 비어있어 환불 API 호출 불가. 수동 확인 필요.",
                )
                await send_slack_alert(
                    "대행 서비스 자동환불 실패", f"order_id={order_id}, payment_key 없음", level="error"
                )
                continue

            # 이중 환불 방지 — 조건부 UPDATE로 선점(claim) 후에만 토스 API 호출.
            # routers/delivery.py admin_update_status(관리자 수동 환불)와 동일 마커 사용 —
            # 동시 실행/경합 시 둘 중 하나만 이 UPDATE에 성공(영향 행 1건)한다.
            claim_res = await _db(
                supabase.table("delivery_orders")
                .update({"refund_reason": _REFUND_CLAIM_MARKER})
                .eq("id", order_id)
                .eq("status", "paid")
                .is_("refund_reason", "null")
            )
            if not (claim_res and claim_res.data):
                logger.info(
                    f"[delivery_auto_refund_job] 잠금 선점 실패(관리자 수동 처리와 경합 또는 이미 처리됨), skip: order_id={order_id}"
                )
                continue

            try:
                async with httpx.AsyncClient(timeout=15) as c:
                    cancel_resp = await c.post(
                        f"https://api.tosspayments.com/v1/payments/{payment_key}/cancel",
                        auth=(toss_secret, ""),
                        json={"cancelReason": "대행 서비스 자료 미제출 7일 경과 자동 환불"},
                    )
            except Exception as e:
                logger.error(f"[delivery_auto_refund_job] 토스 API 요청 오류: order_id={order_id}, error={e}")
                await _db(
                    supabase.table("delivery_orders")
                    .update({"refund_reason": None})
                    .eq("id", order_id)
                    .eq("refund_reason", _REFUND_CLAIM_MARKER)
                )
                await send_operator_alert(
                    "대행 서비스 자동환불 오류 — 수동 확인 필요", f"order_id={order_id}\nerror={e}"
                )
                await send_slack_alert(
                    "대행 서비스 자동환불 오류", f"order_id={order_id}, error={e}", level="error"
                )
                continue

            if cancel_resp.status_code != 200:
                # 락 해제 — 재시도 가능하도록 원복
                await _db(
                    supabase.table("delivery_orders")
                    .update({"refund_reason": None})
                    .eq("id", order_id)
                    .eq("refund_reason", _REFUND_CLAIM_MARKER)
                )
                # 경쟁조건 방어: 운영자가 먼저 수동 환불/상태변경했을 수 있음 — 재조회 후 이미
                # paid가 아니면 정상적인 중복 응답으로 간주하고 오탐 알림 억제.
                _recheck = await _db(
                    supabase.table("delivery_orders").select("status").eq("id", order_id).single()
                )
                if (_recheck.data or {}).get("status") != "paid":
                    logger.info(
                        f"[delivery_auto_refund_job] 이미 처리됨(정상), 오탐 알림 억제: order_id={order_id}"
                    )
                    continue
                logger.error(
                    f"[delivery_auto_refund_job] 토스 환불 실패: order_id={order_id}, "
                    f"status={cancel_resp.status_code} body={cancel_resp.text}"
                )
                await send_operator_alert(
                    "대행 서비스 자동환불 실패 — 수동 확인 필요",
                    f"order_id={order_id}\npayment_key={payment_key}\n"
                    f"status={cancel_resp.status_code}\nbody={cancel_resp.text}",
                )
                await send_slack_alert(
                    "대행 서비스 자동환불 실패", f"order_id={order_id}, status={cancel_resp.status_code}", level="error"
                )
                continue

            try:
                await _db(
                    supabase.table("delivery_orders")
                    .update({
                        "status": "refunded",
                        "refund_amount": amount,
                        "refund_reason": "자료 미제출 7일 경과 자동 환불",
                    })
                    .eq("id", order_id)
                )
                await _db(
                    supabase.table("delivery_messages")
                    .insert({
                        "order_id": order_id,
                        "sender_type": "admin",
                        "sender_id": "system",
                        "body": (
                            "결제 후 7일 이내 자료 제출이 확인되지 않아 자동으로 전액 환불 처리되었습니다. "
                            f"환불 금액: {amount:,}원. 다시 신청을 원하시면 새로 대행 서비스를 신청해 주세요."
                        ),
                    })
                )
                logger.info(f"[delivery_auto_refund_job] 환불 완료: order_id={order_id}, amount={amount}")
            except Exception as e:
                # 토스 환불은 이미 성공했는데 DB 갱신이 실패하면 "돈은 나갔는데 상태는 paid로
                # 남는" 불일치 발생 — money-moving 이후이므로 silent pass 금지.
                logger.error(
                    f"[delivery_auto_refund_job] 환불 완료 후 DB 갱신 실패: order_id={order_id}, error={e}"
                )
                await send_operator_alert(
                    "대행 서비스 환불 완료 후 DB 갱신 실패 — 수동 확인 필요",
                    f"order_id={order_id}\nToss 환불은 이미 처리됨(amount={amount}). DB 상태를 수동으로 refunded로 변경해 주세요.\nerror={e}",
                )
                await send_slack_alert(
                    "대행 서비스 환불 DB 갱신 실패", f"order_id={order_id}, amount={amount}", level="error"
                )

    except Exception as e:
        logger.warning(f"[delivery_auto_refund_job] 잡 실패: {e}")


async def delivery_30day_rescan_job():
    """종합 풀패키지(comprehensive) 완료 30일 후 자동 재스캔 (매일 11:00 KST).

    조건:
    - package_type = 'comprehensive'
    - status = 'completed'
    - work_completed_at < now() - 30일
    - followup_scan_id IS NULL (아직 재스캔 미완료)

    재스캔 방식: AI 재스캔(Playwright) 비용 절감을 위해
    기존 스캔 결과 기반 score만 재계산하여 scan_results 에 INSERT.
    완료 후 followup_scan_id 에 새 scan_results.id 저장 + 이메일 발송.
    실패 시 raise 하지 않고 warning 로그만 기록.
    """
    from datetime import timezone  # 2026-07-10: 누락 발견 — delivery_auto_cancel_job과 동일한
    # 버그. import 없이 timezone.utc 참조 시 NameError → 아래 try/except가 삼켜 매일 조용히 실패.
    from db.supabase_client import get_client
    from services.score_engine import calculate_score

    try:
        supabase = get_client()
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        cutoff_iso = cutoff.isoformat()

        res = await _db(
            supabase.table("delivery_orders")
            .select("id, business_id, work_completed_at, score_after")
            .eq("package_type", "comprehensive")
            .eq("status", "completed")
            .lt("work_completed_at", cutoff_iso)
            .is_("followup_scan_id", "null")
            .limit(50)
        )
        rows = (res.data if res and res.data else []) or []

        if not rows:
            logger.info("[delivery_30day_rescan_job] 재스캔 대상 없음")
            return

        logger.info(f"[delivery_30day_rescan_job] 재스캔 대상 {len(rows)}건")

        for order in rows:
            order_id = order["id"]
            biz_id = order.get("business_id")
            if not biz_id:
                logger.warning(f"[delivery_30day_rescan_job] business_id 없음 order={order_id}")
                continue

            try:
                # 사업장 기본 정보 조회
                biz_res = await _db(
                    supabase.table("businesses")
                    .select("id, name, category, region, keywords, has_recent_post, has_intro, user_id")
                    .eq("id", biz_id)
                    .maybe_single()
                )
                biz_data = biz_res.data if (biz_res and biz_res.data) else {}
                if not biz_data:
                    logger.warning(
                        f"[delivery_30day_rescan_job] 사업장 없음 biz={biz_id}"
                    )
                    continue

                # 가장 최근 scan_results 조회 (기존 AI 스캔 결과 재활용)
                prev_res = await _db(
                    supabase.table("scan_results")
                    .select(
                        "gemini_result, chatgpt_result, naver_result, google_result, "
                        "naver_channel_score, global_channel_score, query_used"
                    )
                    .eq("business_id", biz_id)
                    .order("created_at", desc=True)
                    .limit(1)
                    .maybe_single()
                )
                prev_scan = prev_res.data if (prev_res and prev_res.data) else {}

                # 점수 재계산 (AI 재스캔 없이 기존 결과 기반)
                score = calculate_score(
                    scan_result=prev_scan,
                    biz=biz_data,
                    context=(
                        "location_based"
                        if biz_data.get("category") in (
                            "restaurant", "cafe", "bakery", "bar", "beauty", "nail",
                            "medical", "pharmacy", "fitness", "yoga", "pet",
                            "accommodation",
                        )
                        else "non_location"
                    ),
                )

                # scan_results INSERT
                insert_res = await _db(
                    supabase.table("scan_results").insert({
                        "business_id": biz_id,
                        "query_used": prev_scan.get("query_used", ""),
                        "gemini_result": prev_scan.get("gemini_result"),
                        "chatgpt_result": prev_scan.get("chatgpt_result"),
                        "naver_result": prev_scan.get("naver_result"),
                        "google_result": prev_scan.get("google_result"),
                        "total_score": score["total_score"],
                        "unified_score": score.get("unified_score", score["total_score"]),
                        "track1_score": score.get("track1_score"),
                        "track2_score": score.get("track2_score"),
                        "score_breakdown": score.get("breakdown"),
                        "naver_channel_score": prev_scan.get("naver_channel_score"),
                        "global_channel_score": prev_scan.get("global_channel_score"),
                        "scan_type": "followup_rescan",
                    })
                )
                new_scan_id = (
                    insert_res.data[0]["id"]
                    if (insert_res and insert_res.data and insert_res.data[0])
                    else None
                )
                if not new_scan_id:
                    logger.warning(
                        f"[delivery_30day_rescan_job] scan INSERT 실패 biz={biz_id}"
                    )
                    continue

                # followup_scan_id 갱신 + score_after 미기록 시 30일 재측정 점수로 확정
                # (2026-07-11: 후기 작성 시 score_after가 이미 채워졌다면 덮어쓰지 않음 —
                # 사용자가 자발적으로 남긴 후기 시점 점수를 더 신뢰할 수 있는 값으로 우선함)
                _update_fields = {"followup_scan_id": new_scan_id}
                if order.get("score_after") is None:
                    _new_unified = score.get("unified_score", score.get("total_score"))
                    if _new_unified is not None:
                        _update_fields["score_after"] = _new_unified
                await _db(
                    supabase.table("delivery_orders")
                    .update(_update_fields)
                    .eq("id", order_id)
                )

                # 이메일 발송 — RESEND_API_KEY 미설정 시 graceful skip
                try:
                    from services.email_sender import _get_resend, FROM_EMAIL
                    from services.share_card import _score_stage_label

                    resend = _get_resend()

                    # 이메일 수신자 조회 (profiles.email 또는 auth users)
                    prof_res = await _db(
                        supabase.table("profiles")
                        .select("email")
                        .eq("user_id", biz_data.get("user_id", ""))
                        .maybe_single()
                    )
                    recipient_email = (
                        prof_res.data.get("email") if (prof_res and prof_res.data) else None
                    )
                    if recipient_email:
                        # 점수 숫자 직접 노출 금지 원칙(CLAUDE.md) — 텍스트 레이블로만 안내
                        stage_label = _score_stage_label(score.get("unified_score", score.get("total_score", 0)) or 0)
                        resend.Emails.send({
                            "from": FROM_EMAIL,
                            "to": recipient_email,
                            "subject": f"[AEOlab] {biz_data.get('name', '사업장')} 30일 후 재측정 보고서",
                            "html": (
                                f"<h2>30일 후 AI 노출 재측정 결과</h2>"
                                f"<p>안녕하세요, {biz_data.get('name', '사업장')} 사장님.</p>"
                                f"<p>종합 풀패키지 완료 후 30일이 지나 재측정을 진행했습니다.</p>"
                                f"<p>현재 상태: <strong>{stage_label}</strong></p>"
                                f"<p>대시보드에서 상세 결과를 확인하세요: "
                                f"<a href='https://aeolab.co.kr/dashboard'>aeolab.co.kr/dashboard</a></p>"
                            ),
                        })
                        logger.info(
                            f"[delivery_30day_rescan_job] 이메일 발송 완료 order={order_id}"
                        )
                except Exception as mail_err:
                    logger.warning(
                        f"[delivery_30day_rescan_job] 이메일 발송 실패 order={order_id}: {mail_err}"
                    )

                logger.info(
                    f"[delivery_30day_rescan_job] 재스캔 완료 order={order_id} scan={new_scan_id}"
                )

            except Exception as inner_e:
                logger.warning(
                    f"[delivery_30day_rescan_job] 처리 실패 order={order_id}: {inner_e}"
                )

    except Exception as e:
        logger.warning(f"[delivery_30day_rescan_job] 잡 실패: {e}")

async def _check_v31_readiness_job():
    """[P3] beta subscriber count check — triggers v3.1 activation warning.

    Condition: active subscriptions >= 5 AND SCORE_MODEL_VERSION == 'v3_0'
    Notification: WARNING log only (no email/kakao)
    """
    import os
    from datetime import date

    if os.getenv("SCORE_MODEL_VERSION", "v3_0") != "v3_0":
        return  # v3.1 already active

    try:
        from db.supabase_client import get_supabase
        supabase = get_supabase()

        res = await _db(
            supabase.table("subscriptions")
            .select("id", count="exact")
            .eq("status", "active")
        )
        count = res.count if (res and res.count is not None) else 0
        if count >= 5:
            today = date.today().isoformat()
            _logger.warning(
                f"[P3-READY] {today} -- beta subscriber count={count} -- "
                "SCORE_MODEL_VERSION=v3_1 activation ready. "
                "Update .env then: pm2 restart aeolab-backend. "
                "Verify track1 6-item measurements before activation (service_unification_v1.0.md sec3)"
            )
    except Exception as e:
        _logger.warning(f"[P3-READY] subscriber check failed: {e}")


async def _check_data_wiring_readiness_job():
    """[데이터 배선 확장] beta subscriber count check — DataLab/Playwright 자동화 착수 조건 감지.

    Condition A (Playwright 완전 자동화): active subscriptions >= 50 AND SMARTPLACE_AUTO_FULL_ENABLED != 'true'
    Condition B (네이버 DataLab API 연동): active subscriptions >= 100 AND NAVER_DATALAB_ENABLED != 'true'
    Notification: WARNING log only (no email/kakao) — 실제 설계·구현은 새 대화창에서 사람이 시작
    """
    import os
    from datetime import date

    playwright_done = os.getenv("SMARTPLACE_AUTO_FULL_ENABLED", "false").lower() == "true"
    datalab_done = os.getenv("NAVER_DATALAB_ENABLED", "false").lower() == "true"
    if playwright_done and datalab_done:
        return  # 둘 다 이미 구현·활성화됨

    try:
        from db.supabase_client import get_supabase
        supabase = get_supabase()

        res = await _db(
            supabase.table("subscriptions")
            .select("id", count="exact")
            .eq("status", "active")
        )
        count = res.count if (res and res.count is not None) else 0
        today = date.today().isoformat()

        if not playwright_done and count >= 50:
            _logger.warning(
                f"[DATA-WIRING-READY-50] {today} -- active subscriber count={count} -- "
                "smart_place_completeness Playwright 완전 자동화 착수 조건 충족. "
                "새 대화창에서 CLAUDE.md 남은 작업 항목 확인 후 설계 시작 "
                "(naver_place_stats.py check_smart_place_completeness 기준 코드 최신 상태 재확인 필수)."
            )
        if not datalab_done and count >= 100:
            _logger.warning(
                f"[DATA-WIRING-READY-100] {today} -- active subscriber count={count} -- "
                "네이버 DataLab API 연동(naver_datalab.py) 착수 조건 충족. "
                "새 대화창에서 CLAUDE.md 남은 작업 항목 확인 후 설계 시작."
            )
    except Exception as e:
        _logger.warning(f"[DATA-WIRING-READY] subscriber check failed: {e}")


async def ai_tab_trigger_check_job():
    """M3-1: 주 2회(월·목 09:00 KST) AI탭 전체 공개 여부 자동 감지.

    헤드리스(비로그인) 상태로 통합검색 4개 쿼리에서 AI탭 섹션 DOM 존재 확인.
    - 베타(현재): 네이버플러스 멤버십 한정 → 비로그인 노출 0%
    - 전체 공개 후: 전체 네이버 사용자 대상 → 비로그인에서도 노출 예상
    노출률 80%+ 감지 시 system_status.ai_tab_enabled=true 자동 설정 + Slack 알림.

    2026-07-04 수정: 기존 구현은 `_check_single_page(page, q, "")`로 target을 빈
    문자열로 넘겼는데, `_name_in_text("", text)`는 `"" in text`가 항상 True이므로
    실제 렌더 텍스트 길이·내용과 무관하게 셀렉터만 매치되면(빈 래퍼 div 포함) 무조건
    "노출 감지"로 오탐지했다(`briefing_category_expansion_monitor_job`의 2026-07-01
    P0 수정과 동일 버그 클래스). 이 잡은 특정 사업장명 매칭이 필요 없는 "AI탭 섹션
    DOM 존재 확인"이 목적이므로, `_check_single_page` 재사용 대신 셀렉터 직접 조회 +
    텍스트 길이 검증(빈 래퍼 div 오탐 제거)으로 교체한다.
    """
    try:
        from playwright.async_api import async_playwright
        from services.ai_scanner.naver_scanner import AI_TAB_SELECTORS
    except ImportError as e:
        _logger.warning(f"ai_tab_trigger_check_job: import failed: {e}")
        return

    queries = ["강남역 맛집", "홍대 카페", "신사동 미용실", "분당 학원"]
    hit_count = 0

    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
            )
            ctx = await browser.new_context(
                locale="ko-KR",
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/131.0.0.0 Safari/537.36"
                ),
            )
            for q in queries:
                page = await ctx.new_page()
                try:
                    await page.goto(
                        f"https://search.naver.com/search.naver?query={q}",
                        wait_until="domcontentloaded", timeout=30000,
                    )
                    await page.wait_for_timeout(3000)
                    text = ""
                    for sel in AI_TAB_SELECTORS:
                        el = await page.query_selector(sel)
                        if el:
                            t = await el.inner_text()
                            if t and t.strip():
                                text = t
                                break
                    if len(text.strip()) > 20:
                        hit_count += 1
                        _logger.info(f"[ai_tab_trigger] AI탭 섹션 감지 query='{q}' text_len={len(text.strip())}")
                except Exception as e:
                    _logger.warning(f"[ai_tab_trigger] query='{q}' failed: {e}")
                finally:
                    await page.close()
                await asyncio.sleep(1.0)
            await browser.close()
    except Exception as e:
        _logger.warning(f"ai_tab_trigger_check_job playwright failed: {e}")
        return

    rate = hit_count / len(queries)
    _logger.info(f"[ai_tab_trigger_check] hit={hit_count}/{len(queries)} rate={rate:.0%}")

    if rate >= 0.8:
        _alert_msg = (
            f"비로그인 노출률 {rate*100:.0f}% ({hit_count}/{len(queries)}) — "
            "P2 작업 시작 필요. "
            "naver_ai_search_optimization_plan_v1.0.md §P2 참조."
        )
        await send_slack_alert("[P2-READY] AI탭 전체 확대 감지", _alert_msg, level="info")
        # SLACK_WEBHOOK_URL 미설정 시 위 호출은 무동작 — 이메일로 이중 발송 (2026-07-01)
        from services.email_sender import send_operator_alert
        await send_operator_alert("[P2-READY] AI탭 전체 확대 감지", _alert_msg)
        _logger.warning(f"[P2-READY] AI탭 노출률 {rate*100:.0f}% — 전체 확대 감지")
        # system_status 자동 활성화 (pm2 restart 불필요)
        try:
            from db.supabase_client import get_client
            from datetime import datetime
            _supabase = get_client()
            _supabase.table("system_status").upsert({
                "key": "ai_tab_enabled",
                "value": "true",
                "message": f"P2 자동 활성화 {datetime.now().strftime('%Y-%m-%d')} — 노출률 {rate*100:.0f}%",
                "updated_at": datetime.now().isoformat(),
            }).execute()
            # 캐시 무효화
            from services.ai_scanner.naver_ai_tab_scanner import _ai_tab_enabled_cache
            _ai_tab_enabled_cache["ts"] = 0.0
            _logger.warning("[P2-ACTIVATED] system_status.ai_tab_enabled=true 자동 설정 완료")
        except Exception as _e_p2:
            _logger.warning(f"[P2] system_status 자동 업데이트 실패 (수동 설정 필요): {_e_p2}")
    elif rate >= 0.5:
        _logger.info(f"[P2-MONITOR] AI탭 노출률 {rate*100:.0f}% — 확산 중, 추가 관찰 필요")


async def briefing_category_expansion_monitor_job():
    """M3-4: 월 1회(1일 09:00 KST) 의료·법무·헬스케어 AI 브리핑 업종 확대 감지.

    INACTIVE 업종(medical, dental, legal, accounting)의 실제 검색 결과에서
    "플레이스형" AI 브리핑 노출 여부를 확인. 노출 감지 시 Slack 알림 → LIKELY/ACTIVE 승급 검토.

    2026-07-01 수정 (P0 버그): 기존 구현은 `_check_single_page(page, q, "")`로 target을
    빈 문자열로 넘겼는데, `_name_in_text("", text)`는 `"" in text`가 항상 True이므로
    실제 콘텐츠 유무·업종 관련성과 무관하게 "노출 감지"를 오탐지했다(2026-07-01 09:00 KST
    실측: accounting 오탐 → 잘못된 Slack 액션 알림 발송 확인). 또한 "~추천" 질의는 업종
    무관 정보형(공식형·멀티출처형) AI 브리핑을 유발하기 쉬우므로(2026-06-29 사진업종
    실측·네이버 공식 확인) 이 잡은 다음 두 가지로 수정한다:
      1. 실제 렌더된 텍스트 길이 검증(빈 래퍼 div 오탐 제거)
      2. 정보형 신호(관련질문/비교표) 감지 시 "확대 아님"으로 분리 — 업종 재분류를
         유발하는 액션 알림은 플레이스형으로 보이는 경우에만 발송
    """
    try:
        from playwright.async_api import async_playwright
        from services.ai_scanner.naver_scanner import BRIEFING_SELECTORS
        from services.ai_scanner import get_naver_cookies, build_chrome_ua, get_proxy_config
    except ImportError as e:
        _logger.warning(f"briefing_category_expansion_monitor_job: import failed: {e}")
        return

    import random

    # 확대 모니터링 대상 업종 + 테스트 쿼리 (업종별 2개)
    MONITOR_QUERIES: dict[str, list[str]] = {
        "medical":    ["강남 내과 추천", "홍대 피부과 추천"],
        "dental":     ["강남 치과 추천", "송파 치과 추천"],
        "legal":      ["서울 법무사 추천", "강남 변호사 추천"],
        "accounting": ["서울 세무사 추천", "강남 회계사 추천"],
    }

    def _is_info_type(text: str) -> bool:
        """공식형·멀티출처형(정보형) 신호 — 관련질문 섹션 또는 구분/근거 비교표."""
        return (
            "관련 질문" in text or "관련질문" in text
            or ("구분" in text and "근거" in text)
        )

    newly_detected_place: list[str] = []
    info_only_detected: list[str] = []

    try:
        async with async_playwright() as pw:
            # §4-A 승격 레시피(2026-06-30 검증): channel=chrome + 쿠키 주입 + 프록시, apply_stealth 미사용
            browser = await pw.chromium.launch(
                headless=True,
                channel="chrome",
                args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
                      "--disable-blink-features=AutomationControlled"],
                proxy=get_proxy_config(),
            )
            ctx = await browser.new_context(locale="ko-KR", user_agent=build_chrome_ua())
            naver_cookies = get_naver_cookies()
            if naver_cookies:
                await ctx.add_cookies(naver_cookies)

            for cat, queries in MONITOR_QUERIES.items():
                place_hit = 0
                info_hit = 0
                for q in queries:
                    page = await ctx.new_page()
                    try:
                        await page.goto(
                            f"https://search.naver.com/search.naver?query={q}",
                            wait_until="domcontentloaded", timeout=30000,
                        )
                        await page.wait_for_timeout(random.randint(2800, 4800))

                        text = ""
                        for sel in BRIEFING_SELECTORS:
                            el = await page.query_selector(sel)
                            if el:
                                t = await el.inner_text()
                                if t and t.strip():
                                    text = t
                                    break

                        if text and len(text.strip()) > 20:
                            if _is_info_type(text):
                                info_hit += 1
                                _logger.info(
                                    f"[briefing_expansion] cat={cat} query='{q}' "
                                    "정보형 브리핑 감지(업종 무관 — 확대 아님)"
                                )
                            else:
                                place_hit += 1
                                _logger.warning(
                                    f"[briefing_expansion] cat={cat} query='{q}' "
                                    "플레이스형 추정 브리핑 감지"
                                )
                    except Exception as e:
                        _logger.warning(f"[briefing_expansion] cat={cat} q='{q}' failed: {e}")
                    finally:
                        await page.close()
                    await asyncio.sleep(1.0)

                if place_hit >= len(queries):
                    newly_detected_place.append(cat)
                    _logger.warning(f"[briefing_expansion] {cat} 업종 플레이스형 AI 브리핑 노출 감지!")
                elif info_hit > 0:
                    info_only_detected.append(cat)

            await browser.close()
    except Exception as e:
        _logger.warning(f"briefing_category_expansion_monitor_job playwright failed: {e}")
        return

    if newly_detected_place:
        cats_str = ", ".join(newly_detected_place)
        _alert_msg = (
            f"INACTIVE 업종에서 플레이스형 AI 브리핑 노출 확인: {cats_str}\n"
            "score_engine.py BRIEFING_LIKELY_CATEGORIES 또는 BRIEFING_ACTIVE_CATEGORIES "
            "업데이트 필요. naver_gpt_work_standard_v1.0.md 기준으로 검토."
        )
        await send_slack_alert("[AI 브리핑 업종 확대 감지 — 플레이스형]", _alert_msg, level="info")
        # SLACK_WEBHOOK_URL 미설정 시 위 호출은 무동작 — 이메일로 이중 발송 (2026-07-01)
        from services.email_sender import send_operator_alert
        await send_operator_alert("[AI 브리핑 업종 확대 감지 — 플레이스형]", _alert_msg)
    if info_only_detected:
        _logger.info(
            "[briefing_expansion] 정보형 브리핑만 감지(업종 확대 아님, 조치 불필요): "
            + ", ".join(info_only_detected)
        )
    if not newly_detected_place and not info_only_detected:
        _logger.info(
            f"[briefing_expansion] 신규 업종 확대 없음 "
            f"(모니터링: {list(MONITOR_QUERIES.keys())})"
        )


async def check_naver_cookie_health_job():
    """매주 월요일 09:30 KST — 네이버 NID_AUT/NID_SES 쿠키 유효성 검사 + 만료 시 자동 재로그인.

    작동 순서:
      1. NID_AUT로 naver.com 방문 → 로그인 상태 확인
      2. 유효: 정상 로그 기록 후 종료
      3. 만료: NAVER_LOGIN_ID/PW로 자동 재로그인 시도
         - 성공: 새 NID_AUT 추출 → .env 파일 + os.environ 즉시 갱신
         - 실패(2FA·캡챠): pm2 logs + 운영자 이메일 알림 (수동 교체 필요)

    2026-07-01 추가: SLACK_WEBHOOK_URL이 서버에 미설정이라 기존 send_slack_alert류 알림은
    무동작(no-op)이었음. 이미 동작 중인 Resend 이메일 채널(send_operator_alert)로 대체 발송.
    또한 NID_SES(AI 브리핑 전용, ~30일 만료 — NID_AUT의 365일보다 훨씬 짧음)는 기존에 만료
    추적이 전혀 없어 별도 블록으로 추가.
    """
    import subprocess, re as _re
    from datetime import datetime as _dt, timedelta as _td
    from services.email_sender import send_operator_alert

    nid_aut = os.getenv("NAVER_COOKIE_NID_AUT", "")
    if not nid_aut:
        _logger.warning("[naver_cookie_health] NID_AUT 미설정 — AI탭 스캔 불가. .env에 추가 필요")
        await send_operator_alert(
            "NID_AUT 쿠키 미설정",
            "네이버 AI탭 스캔이 동작하지 않습니다. NAVER_COOKIE_NID_AUT를 .env에 설정해주세요.",
        )
        return

    # ── NID_AUT 만료 30일 전 조기 경고 (NAVER_COOKIE_NID_AUT_ISSUED 기준, 365일 주기) ──
    _issued_str = os.getenv("NAVER_COOKIE_NID_AUT_ISSUED", "")
    if _issued_str:
        try:
            _issued = _dt.strptime(_issued_str, "%Y-%m-%d")
            _days_elapsed = (_dt.now() - _issued).days
            _days_left = 365 - _days_elapsed
            if _days_left <= 0:
                _logger.warning(
                    f"[naver_cookie_health] ⚠️ NID_AUT 만료 예상일 초과 ({_days_elapsed}일 경과) — "
                    "새 쿠키 교체 필요. Chrome → naver.com → F12 → Application → Cookies → NID_AUT 복사"
                )
                await send_operator_alert(
                    "NID_AUT 만료 예상일 초과",
                    f"{_days_elapsed}일 경과. Chrome → naver.com 로그인 → F12 → Application → "
                    "Cookies → NID_AUT 복사 → .env NAVER_COOKIE_NID_AUT 교체 필요.",
                )
            elif _days_left <= 30:
                _logger.warning(f"[naver_cookie_health] ⚠️ NID_AUT 만료 {_days_left}일 전")
                await send_operator_alert(
                    "NID_AUT 만료 임박",
                    f"{_days_left}일 후 만료 예상. 미리 새 쿠키 준비 필요 "
                    "(Chrome → naver.com → F12 → Application → Cookies → NID_AUT).",
                )
            else:
                _logger.info(f"[naver_cookie_health] NID_AUT 만료까지 {_days_left}일 남음")
        except ValueError:
            _logger.warning(f"[naver_cookie_health] NAVER_COOKIE_NID_AUT_ISSUED 형식 오류: {_issued_str} (YYYY-MM-DD 필요)")

    # ── NID_SES 만료 추적 (AI 브리핑 전용, ~30일 주기 — NAVER_COOKIE_NID_SES_ISSUED 기준) ──
    nid_ses = os.getenv("NAVER_COOKIE_NID_SES", "")
    _ses_issued_str = os.getenv("NAVER_COOKIE_NID_SES_ISSUED", "")
    if not nid_ses:
        _logger.warning("[naver_cookie_health] NID_SES 미설정 — AI 브리핑(플레이스형) 스캔 정확도 저하 가능")
    elif not _ses_issued_str:
        _logger.warning(
            "[naver_cookie_health] NAVER_COOKIE_NID_SES_ISSUED 미설정 — NID_SES 만료 추적 불가. "
            ".env에 발급일(YYYY-MM-DD) 추가 권장"
        )
    else:
        try:
            _ses_issued = _dt.strptime(_ses_issued_str, "%Y-%m-%d")
            _ses_days_elapsed = (_dt.now() - _ses_issued).days
            _ses_days_left = 30 - _ses_days_elapsed
            if _ses_days_left <= 0:
                _logger.warning(f"[naver_cookie_health] ⚠️ NID_SES 만료 예상일 초과 ({_ses_days_elapsed}일 경과)")
                await send_operator_alert(
                    "NID_SES 만료 예상일 초과 — AI 브리핑 스캔 정확도 저하 우려",
                    f"{_ses_days_elapsed}일 경과(주기 ~30일). Chrome → naver.com 로그인 → F12 → "
                    "Application → Cookies → NID_SES 복사 → .env NAVER_COOKIE_NID_SES + "
                    "NAVER_COOKIE_NID_SES_ISSUED(오늘 날짜) 갱신 필요.",
                )
            elif _ses_days_left <= 7:
                _logger.warning(f"[naver_cookie_health] ⚠️ NID_SES 만료 {_ses_days_left}일 전")
                await send_operator_alert(
                    "NID_SES 만료 임박 — AI 브리핑 스캔",
                    f"{_ses_days_left}일 후 만료 예상. 미리 교체 필요 "
                    "(Chrome → naver.com → F12 → Application → Cookies → NID_SES).",
                )
            else:
                _logger.info(f"[naver_cookie_health] NID_SES 만료까지 {_ses_days_left}일 남음")
        except ValueError:
            _logger.warning(f"[naver_cookie_health] NAVER_COOKIE_NID_SES_ISSUED 형식 오류: {_ses_issued_str} (YYYY-MM-DD 필요)")

    try:
        from playwright.async_api import async_playwright
    except ImportError:
        _logger.warning("[naver_cookie_health] playwright 미설치")
        return

    # 설치된 Chrome 버전 기반 UA
    try:
        _cr = subprocess.run(["google-chrome-stable", "--version"], capture_output=True, text=True, timeout=5)
        _ver = _cr.stdout.strip().split()[-1].split(".")[0]
        _ua = f"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{_ver}.0.0.0 Safari/537.36"
    except Exception:
        _ua = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"

    _LAUNCH_ARGS = ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
                    "--disable-blink-features=AutomationControlled"]

    # ── Step 1: 현재 쿠키 유효성 확인 ──────────────────────────────────────────
    logged_in = False
    async with async_playwright() as _p:
        _br = await _p.chromium.launch(headless=True, channel="chrome", args=_LAUNCH_ARGS)
        _ctx = await _br.new_context(viewport={"width": 1280, "height": 800},
                                     locale="ko-KR", timezone_id="Asia/Seoul", user_agent=_ua)
        await _ctx.add_cookies([{"name": "NID_AUT", "value": nid_aut, "domain": ".naver.com",
                                  "path": "/", "httpOnly": True, "secure": True}])
        _pg = await _ctx.new_page()
        try:
            await _pg.goto("https://www.naver.com", timeout=20000)
            await _pg.wait_for_timeout(2000)
            logged_in = "로그아웃" in await _pg.content()
        except Exception as _e:
            _logger.warning(f"[naver_cookie_health] naver.com 접근 실패: {_e}")
        finally:
            await _br.close()

    if logged_in:
        _logger.info("[naver_cookie_health] NID_AUT 유효 ✅ — AI탭 스캔 정상")
        return

    # ── Step 2: 만료 감지 → 자동 재로그인 ──────────────────────────────────────
    _logger.warning("[naver_cookie_health] NID_AUT 만료 감지 — 자동 재로그인 시도")
    login_id = os.getenv("NAVER_LOGIN_ID", "")
    login_pw  = os.getenv("NAVER_LOGIN_PW", "")

    if not login_id or not login_pw:
        _logger.warning(
            "[naver_cookie_health] NAVER_LOGIN_ID/PW 미설정 → 수동 교체 필요\n"
            "  Chrome → naver.com 로그인 → F12 → Application → Cookies → NID_AUT 복사 → .env 갱신"
        )
        await send_operator_alert(
            "NID_AUT 만료 — 자동 재로그인 불가",
            "NAVER_LOGIN_ID/PW가 .env에 없어 자동 재로그인을 시도할 수 없습니다.\n"
            "Chrome → naver.com 로그인 → F12 → Application → Cookies → NID_AUT 복사 → "
            ".env NAVER_COOKIE_NID_AUT 수동 교체 필요. AI탭 스캔이 중단될 수 있습니다.",
        )
        return

    new_nid_aut = None
    async with async_playwright() as _p:
        _br = await _p.chromium.launch(headless=True, channel="chrome", args=_LAUNCH_ARGS)
        _ctx = await _br.new_context(viewport={"width": 1280, "height": 800},
                                     locale="ko-KR", timezone_id="Asia/Seoul", user_agent=_ua)
        _pg = await _ctx.new_page()
        try:
            await _pg.goto("https://nid.naver.com/nidlogin.login", timeout=20000)
            await _pg.wait_for_timeout(1500)
            await _pg.fill("#id", login_id)
            await _pg.wait_for_timeout(400)
            await _pg.fill("#pw", login_pw)
            await _pg.wait_for_timeout(400)
            await _pg.click(".btn_login")
            await _pg.wait_for_timeout(6000)

            if "nidlogin" in _pg.url:
                _logger.warning(
                    f"[naver_cookie_health] 자동 로그인 실패 (2FA·캡챠 가능) url={_pg.url[:80]}\n"
                    "  수동 쿠키 교체 필요"
                )
                await send_operator_alert(
                    "NID_AUT 자동 재로그인 실패",
                    f"2FA·캡챠로 자동 로그인이 막혔을 수 있습니다 (url={_pg.url[:80]}).\n"
                    "Chrome → naver.com 로그인 → F12 → Application → Cookies → NID_AUT 복사 → "
                    ".env 수동 교체 필요. AI탭 스캔이 중단될 수 있습니다.",
                )
            else:
                _cookies = await _ctx.cookies(["https://www.naver.com"])
                for _c in _cookies:
                    if _c["name"] == "NID_AUT":
                        new_nid_aut = _c["value"]
                        break
                _logger.info(f"[naver_cookie_health] 자동 로그인 성공 — NID_AUT {len(new_nid_aut or '')}자")
        except Exception as _e:
            _logger.warning(f"[naver_cookie_health] 자동 로그인 오류: {_e}")
        finally:
            await _br.close()

    if not new_nid_aut:
        return

    # ── Step 3: .env 파일 + os.environ 즉시 갱신 ───────────────────────────────
    try:
        _env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
        with open(_env_path, "r") as _f:
            _env_txt = _f.read()
        _env_txt = _re.sub(r"NAVER_COOKIE_NID_AUT=.*", f"NAVER_COOKIE_NID_AUT={new_nid_aut}", _env_txt)
        with open(_env_path, "w") as _f:
            _f.write(_env_txt)
        os.environ["NAVER_COOKIE_NID_AUT"] = new_nid_aut
        _logger.info("[naver_cookie_health] NID_AUT 자동 갱신 완료 ✅ — .env + 인메모리 업데이트")
    except Exception as _e:
        _logger.warning(f"[naver_cookie_health] .env 갱신 실패: {_e}")


async def ai_provider_health_check_job() -> None:
    """AI 프로바이더(Gemini/ChatGPT) 전면 장애 감지 — 30분마다 실행.

    2026-07-12 발견: OpenAI 결제수단 미등록으로 ChatGPT 스캔이 insufficient_quota로
    전량 실패했으나, 스캐너가 예외를 삼키고 mentioned:False로 조용히 폴백하는 구조라
    운영 로그(debug 레벨)에도 안 남고 아무도 몰랐음(business_viability_audit_v1.0.md §1-A).
    gemini_scanner.py/chatgpt_scanner.py의 _log_failure()가 이제 실패도 ai_usage_log에
    purpose="...:FAILED:에러타입"으로 남기므로, 이 잡이 최근 30분 창을 집계해
    "호출은 있었는데 성공이 0건"인 프로바이더를 찾아 운영자에게 알린다.

    dedup: 같은 프로바이더로 최근 6시간 내 이미 보낸 알림이 있으면 재발송하지 않음
    (system_alerts 조회) — 장기 장애 중 30분마다 스팸 발송 방지.
    """
    from db.supabase_client import get_client
    from services.email_sender import send_operator_alert

    supabase = get_client()
    window_start = (datetime.utcnow() - timedelta(minutes=30)).isoformat()

    try:
        rows = (
            await _db(
                supabase.table("ai_usage_log")
                .select("provider, purpose")
                .gte("created_at", window_start)
                .limit(2000)
            )
        ).data or []
    except Exception as e:
        # ai_usage_log 테이블 미생성 등 — 헬스체크 잡 자체 실패가 알림 오발송으로
        # 이어지면 안 되므로 조용히 종료 (다음 스캔 트래픽 발생 시 재시도)
        _logger.debug(f"[ai_provider_health] ai_usage_log 조회 실패(스킵): {e}")
        return

    if not rows:
        return  # 최근 30분간 스캔 트래픽 자체가 없으면 판단 불가 — 정상 케이스

    stats: dict[str, dict[str, int]] = {}
    for r in rows:
        provider = r.get("provider") or "unknown"
        s = stats.setdefault(provider, {"total": 0, "failed": 0})
        s["total"] += 1
        if ":FAILED:" in (r.get("purpose") or ""):
            s["failed"] += 1

    for provider, s in stats.items():
        # 호출은 3건 이상 있었는데 전부 실패 — 개별 API 오류가 아닌 전면 장애로 판단
        if s["total"] >= 3 and s["failed"] == s["total"]:
            try:
                recent_alert = (
                    await _db(
                        supabase.table("system_alerts")
                        .select("id")
                        .ilike("subject", f"%{provider}%")
                        .gte("created_at", (datetime.utcnow() - timedelta(hours=6)).isoformat())
                        .limit(1)
                    )
                ).data or []
            except Exception as e:
                _logger.debug(f"[ai_provider_health] system_alerts 조회 실패: {e}")
                recent_alert = []

            if recent_alert:
                _logger.info(f"[ai_provider_health] {provider} 장애 지속 중 — 6시간 내 알림 기발송, 재발송 스킵")
                continue

            _logger.warning(f"[ai_provider_health] {provider} 전면 실패 감지 — 최근 30분 {s['total']}건 전부 실패")
            await send_operator_alert(
                f"{provider} AI 스캔 전면 실패 감지",
                f"최근 30분간 {provider} 호출 {s['total']}건 중 {s['failed']}건 전부 실패했습니다.\n"
                f"결제수단/API 키/한도를 확인해주세요(2026-07-12 OpenAI 결제 미등록 사고와 동일 패턴 가능).\n"
                "스캐너는 실패 시 '노출 없음'으로 조용히 폴백하므로, 해결 전까지 모든 신규 스캔의 "
                f"{provider} 결과가 부정확합니다.",
            )
