#!/usr/bin/env python3
"""GitHub Actions 전용 네이버 야간 스캔.

GitHub 호스팅 서버에서 실행 → 매 실행마다 다른 IP → iwinv 단일 IP 차단 회피.
① 네이버 AI 브리핑 언급 여부 체크
② 스마트플레이스 소식(피드)·소개글(정보) 탭 완성도 체크 — iwinv 차단 탭 우회
결과는 Supabase naver_prescan 테이블에 저장.
서버 daily_scan_all이 이 결과를 읽어 네이버 재스캔 생략.

실행:
    python scripts/github_naver_scan.py

필요 환경변수 (GitHub Secrets):
    NEXT_PUBLIC_SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
"""

import asyncio
import logging
import os
import random
import sys
from datetime import date, datetime, timezone, timedelta

# backend 디렉토리를 Python 경로에 추가 (Actions checkout 루트 기준)
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(_ROOT, "backend"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(f"/tmp/naver_scan_{date.today()}.log"),
    ],
)
logger = logging.getLogger("github_naver_scan")


async def main() -> None:
    from supabase import create_client

    supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not supabase_url or not service_key:
        logger.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수 누락")
        sys.exit(1)

    supabase = create_client(supabase_url, service_key)

    # 활성 구독자 사업장만 조회
    res = (
        supabase.table("businesses")
        .select("id, name, category, region, keywords, naver_place_id, naver_place_url")
        .execute()
    )
    businesses = res.data or []
    logger.info("스캔 대상 사업장: %d개", len(businesses))

    from services.ai_scanner.naver_scanner import NaverAIBriefingScanner
    from services.keyword_taxonomy import build_ai_scan_queries
    from services.naver_place_stats import check_smart_place_completeness

    scanner = NaverAIBriefingScanner()
    # KST 날짜 사용 — 서버(Asia/Seoul)와 날짜 기준 일치 (UTC 사용 시 1일 불일치)
    today_str = str(datetime.now(tz=timezone(timedelta(hours=9))).date())
    weekday = date.today().weekday()

    success = 0
    failed = 0

    for i, biz in enumerate(businesses):
        biz_name = biz.get("name", "")
        try:
            keywords = biz.get("keywords") or []
            valid_kws = [k.strip() for k in keywords if k.strip() and len(k.strip()) >= 2]
            kw = valid_kws[weekday % len(valid_kws)] if valid_kws else biz.get("category", "")
            queries = build_ai_scan_queries(biz.get("region", ""), kw)

            result = await scanner.check_mention_multi(queries, biz_name)

            # CAPTCHA 감지 시 즉시 중단
            if result.get("captcha_detected"):
                logger.warning("[%s] CAPTCHA 감지 — 남은 스캔 중단", biz_name)
                break

            # ── 스마트플레이스 완성도 체크 (피드·정보 탭 — iwinv IP 차단 우회) ──
            # GitHub Actions IP는 매 실행마다 다름 → 네이버 차단 없음
            place_url = biz.get("naver_place_url") or (
                f"https://map.naver.com/p/entry/place/{biz['naver_place_id']}"
                if biz.get("naver_place_id") else None
            )
            if place_url:
                try:
                    sp_check = await check_smart_place_completeness(place_url)
                    result["smart_place_check"] = sp_check
                    logger.info(
                        "[%d/%d] %s — sp: recent_post=%s(measured=%s) intro=%s(measured=%s)",
                        i + 1, len(businesses), biz_name,
                        sp_check.get("has_recent_post"), sp_check.get("recent_post_measured"),
                        sp_check.get("has_intro"), sp_check.get("intro_measured"),
                    )
                except Exception as sp_err:
                    logger.warning("[%s] SmartPlace check 실패 (스킵): %s", biz_name, sp_err)

            supabase.table("naver_prescan").upsert(
                {
                    "business_id": biz["id"],
                    "scan_date": today_str,
                    "naver_result": result,
                },
                on_conflict="business_id,scan_date",
            ).execute()

            logger.info(
                "[%d/%d] %s — briefing=%s, mentioned=%s",
                i + 1, len(businesses), biz_name,
                result.get("in_briefing"), result.get("mentioned"),
            )
            success += 1

        except Exception as e:
            logger.error("[%s] 스캔 실패: %s", biz_name, e)
            failed += 1

        # 사업장 간 랜덤 딜레이 (25~50초) — 요청 패턴 자연화
        delay = random.uniform(25, 50)
        logger.debug("다음 사업장까지 %.0f초 대기", delay)
        await asyncio.sleep(delay)

    logger.info("완료 — 성공=%d, 실패=%d", success, failed)


if __name__ == "__main__":
    asyncio.run(main())
