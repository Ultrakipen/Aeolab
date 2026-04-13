"""
경쟁사 네이버 플레이스 데이터 크롤러
naver_place_stats.py 패턴 참고 — 경쟁사용 추가 필드(has_faq, has_recent_post, has_menu) 포함
Playwright 인스턴스는 순차 실행 (asyncio.Semaphore(1)) — RAM 보호
"""
import asyncio
import logging
import os
import re
from datetime import datetime, timezone
from typing import Optional

import aiohttp
from playwright.async_api import async_playwright

_logger = logging.getLogger(__name__)

# Playwright 동시 실행 제한: 1개 (RAM 300~500MB/인스턴스, iwinv 4GB RAM 보호)
_PLAYWRIGHT_SEM = asyncio.Semaphore(1)

_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


async def fetch_competitor_place_data(naver_place_id: str) -> dict:
    """
    네이버 플레이스 공개 페이지에서 경쟁사 데이터 크롤링.

    Returns:
        {
            review_count: int,
            avg_rating: float,
            has_faq: bool,
            has_recent_post: bool,
            has_menu: bool,
            photo_count: int,
            place_name: str,
            naver_place_id: str,
            error: str | None
        }
    """
    if not naver_place_id:
        return {"error": "naver_place_id required"}

    default = {
        "naver_place_id": naver_place_id,
        "place_name": "",
        "review_count": 0,
        "avg_rating": 0.0,
        "has_faq": False,
        "has_recent_post": False,
        "has_menu": False,
        "photo_count": 0,
        "error": None,
    }

    try:
        async with _PLAYWRIGHT_SEM:
            return await asyncio.wait_for(_run_place_crawl(naver_place_id), timeout=30)
    except asyncio.TimeoutError:
        _logger.warning(f"competitor_place_crawler timeout: {naver_place_id}")
        return {**default, "error": "timeout"}
    except Exception as e:
        _logger.warning(f"competitor_place_crawler error [{naver_place_id}]: {e}")
        return {**default, "error": str(e)}


async def _run_place_crawl(naver_place_id: str) -> dict:
    url = f"https://map.naver.com/p/entry/place/{naver_place_id}"

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        )
        ctx = await browser.new_context(
            locale="ko-KR",
            timezone_id="Asia/Seoul",
            user_agent=_USER_AGENT,
        )
        page = await ctx.new_page()
        try:
            await page.goto(url, timeout=20000, wait_until="domcontentloaded")
            await page.wait_for_timeout(4000)

            # pcmap.place.naver.com iframe이 실제 플레이스 데이터를 담고 있음
            frame = None
            for f in page.frames:
                if "pcmap.place.naver.com" in f.url or "place.naver.com" in f.url:
                    frame = f
                    break
            target = frame or page

            body_text = await target.inner_text("body")

            # ── 리뷰 수 파싱 ─────────────────────────────────────────
            review_count = 0
            review_match = re.search(r"방문자\s*리뷰\s*(\d[\d,]*)", body_text)
            if review_match:
                review_count = int(review_match.group(1).replace(",", ""))
            else:
                review_match2 = re.search(r"리뷰\s*(\d[\d,]+)\s*개?", body_text)
                if review_match2:
                    review_count = int(review_match2.group(1).replace(",", ""))

            # ── 별점 파싱 ─────────────────────────────────────────────
            rating_match = re.search(r"(\d\.\d{1,2})\s*(?:점|★)", body_text)
            avg_rating = float(rating_match.group(1)) if rating_match else 0.0

            # ── 사업장명 파싱 ─────────────────────────────────────────
            place_name = ""
            for sel in ["h1", ".place_name", "[data-testid='place-name']"]:
                try:
                    el = target.locator(sel).first
                    if await el.is_visible(timeout=2000):
                        place_name = (await el.inner_text()).strip()
                        break
                except Exception:
                    continue

            # ── FAQ(Q&A) 탭 존재 여부 ─────────────────────────────────
            # 네이버 플레이스 Q&A 탭 또는 FAQ 메뉴 텍스트 탐지
            has_faq = bool(re.search(r"Q&A|질문|답변|FAQ", body_text, re.IGNORECASE))

            # ── 최근 소식 존재 여부 ───────────────────────────────────
            # "소식" 탭 또는 "업데이트", "포스팅" 관련 텍스트 감지
            has_recent_post = bool(re.search(r"소식|포스팅|업데이트|최근\s*게시", body_text))

            # ── 메뉴 등록 여부 ────────────────────────────────────────
            has_menu = bool(re.search(r"메뉴|가격표|대표메뉴|원\b", body_text))

            # ── 사진 수 파싱 ──────────────────────────────────────────
            photo_count = 0
            photo_match = re.search(r"사진\s*(\d[\d,]*)", body_text)
            if photo_match:
                photo_count = int(photo_match.group(1).replace(",", ""))
            else:
                # 이미지 개수 대략 추정 (img 태그 수)
                try:
                    img_count = await target.locator("img").count()
                    photo_count = max(0, img_count - 5)  # UI 아이콘 제외 추정
                except Exception:
                    photo_count = 0

            # ── 외부 웹사이트 URL 추출 시도 ──────────────────────────────
            website_url = None
            try:
                # 네이버 플레이스 외부 링크 버튼 (홈페이지 등록 시 노출)
                ext_link = target.locator("a[href^='http']:not([href*='naver.com'])").first
                if await ext_link.is_visible(timeout=2000):
                    href = await ext_link.get_attribute("href")
                    if href and not any(d in href for d in ["naver.com", "kakao.com", "google.com"]):
                        website_url = href
            except Exception:
                pass  # 외부 링크 없으면 무시

            return {
                "naver_place_id": naver_place_id,
                "place_name": place_name,
                "review_count": review_count,
                "avg_rating": avg_rating,
                "has_faq": has_faq,
                "has_recent_post": has_recent_post,
                "has_menu": has_menu,
                "photo_count": photo_count,
                "website_url": website_url,
                "error": None,
            }
        finally:
            await browser.close()


async def fetch_competitor_blog_mentions(competitor_name: str, region: str) -> int:
    """네이버 블로그 API로 경쟁사 블로그 언급 수 조회.

    naver_visibility.py의 _get() 패턴 재사용.
    쿼리: "{region 앞 2글자} {competitor_name}"
    실패 시 0 반환.
    """
    naver_id     = os.getenv("NAVER_CLIENT_ID", "")
    naver_secret = os.getenv("NAVER_CLIENT_SECRET", "")
    if not naver_id or not naver_secret:
        return 0

    region_prefix = region[:2] if region else ""
    query = f"{region_prefix} {competitor_name}".strip() if region_prefix else competitor_name

    headers = {
        "X-Naver-Client-Id": naver_id,
        "X-Naver-Client-Secret": naver_secret,
    }
    timeout = aiohttp.ClientTimeout(total=6)
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(
                "https://openapi.naver.com/v1/search/blog.json",
                headers=headers,
                params={"query": query, "display": 1},
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    return int(data.get("total", 0))
                _logger.warning(f"naver blog API HTTP {resp.status} for {competitor_name}")
    except Exception as e:
        _logger.warning(f"fetch_competitor_blog_mentions error [{competitor_name}]: {e}")
    return 0


async def fetch_competitor_website_seo(website_url: str) -> dict:
    """website_checker.check_website_seo() 래퍼.

    website_url 없으면 {} 반환.
    체크 실패 시 {} 반환 (기존 데이터 유지 원칙).
    """
    if not website_url or not website_url.strip():
        return {}
    try:
        from services.website_checker import check_website_seo
        return await check_website_seo(website_url)
    except Exception as e:
        _logger.warning(f"fetch_competitor_website_seo error [{website_url}]: {e}")
        return {}


async def sync_competitor_place(
    competitor_id: str,
    naver_place_id: str,
    supabase,
    region: str = "",
) -> dict:
    """
    경쟁사 네이버 플레이스 크롤링 후 competitors 테이블 업데이트.
    blog_mention_count, website_seo_score, website_seo_result, detail_synced_at 포함.

    Returns:
        크롤링 결과 dict (error 키 포함 여부로 성공/실패 판단)
    """
    from db.supabase_client import execute

    # region 미전달 시 competitors → businesses 테이블에서 자동 조회
    resolved_region = region
    if not resolved_region:
        try:
            comp_row = await execute(
                supabase.table("competitors")
                .select("business_id")
                .eq("id", competitor_id)
                .maybe_single()
            )
            if comp_row.data:
                biz_row = await execute(
                    supabase.table("businesses")
                    .select("region")
                    .eq("id", comp_row.data["business_id"])
                    .maybe_single()
                )
                if biz_row.data:
                    resolved_region = biz_row.data.get("region", "")
        except Exception as e:
            _logger.warning(f"sync_competitor_place region 조회 실패 [{competitor_id}]: {e}")

    data = await fetch_competitor_place_data(naver_place_id)
    if data.get("error"):
        _logger.warning(
            f"sync_competitor_place [{competitor_id}] 실패: {data['error']}"
        )
        return data

    competitor_name = data.get("place_name", "")

    # 블로그 언급 수 + 웹사이트 SEO 병렬 실행
    async def _zero() -> int:
        return 0

    blog_count, website_seo = await asyncio.gather(
        fetch_competitor_blog_mentions(competitor_name, resolved_region) if competitor_name else _zero(),
        fetch_competitor_website_seo(data.get("website_url", "")),
        return_exceptions=True,
    )
    if isinstance(blog_count, Exception):
        _logger.warning(f"blog_mentions gather error [{competitor_id}]: {blog_count}")
        blog_count = 0
    if isinstance(website_seo, Exception):
        _logger.warning(f"website_seo gather error [{competitor_id}]: {website_seo}")
        website_seo = {}

    # website_seo_score: 통과 항목 수 기반 0~100 점수
    seo_checks = ["has_json_ld", "has_schema_local_business", "has_open_graph",
                  "is_mobile_friendly", "has_favicon", "is_https"]
    seo_score = 0
    if isinstance(website_seo, dict) and not website_seo.get("error"):
        passed = sum(1 for k in seo_checks if website_seo.get(k, False))
        seo_score = round(passed / len(seo_checks) * 100)

    now_iso = datetime.now(timezone.utc).isoformat()
    update_payload: dict = {
        "naver_review_count": data["review_count"],
        "naver_avg_rating": data["avg_rating"],
        "has_faq": data["has_faq"],
        "has_recent_post": data["has_recent_post"],
        "has_menu": data["has_menu"],
        "naver_photo_count": data["photo_count"],
        "naver_place_last_synced_at": now_iso,
        "blog_mention_count": int(blog_count) if blog_count else 0,
        "website_seo_score": seo_score,
        "detail_synced_at": now_iso,
    }
    # place_name 수집 시 이름 업데이트
    if data.get("place_name"):
        update_payload["naver_place_name"] = data["place_name"]
    # 웹사이트 URL 있으면 저장
    if data.get("website_url"):
        update_payload["website_url"] = data["website_url"]
    # SEO 결과 JSON 저장 (오류 없는 경우만)
    if isinstance(website_seo, dict) and website_seo and not website_seo.get("error"):
        update_payload["website_seo_result"] = website_seo

    try:
        await execute(
            supabase.table("competitors")
            .update(update_payload)
            .eq("id", competitor_id)
        )
        _logger.info(
            f"sync_competitor_place [{competitor_id}] 완료: "
            f"reviews={data['review_count']}, rating={data['avg_rating']}, "
            f"blog={blog_count}, seo={seo_score}"
        )
    except Exception as e:
        _logger.warning(f"sync_competitor_place DB 업데이트 실패 [{competitor_id}]: {e}")
        data["db_error"] = str(e)

    data["blog_mention_count"] = int(blog_count) if blog_count else 0
    data["website_seo_score"] = seo_score
    data["website_seo_result"] = website_seo if isinstance(website_seo, dict) else {}
    return data


async def sync_all_competitor_places(business_id: str, supabase) -> list[dict]:
    """
    스케줄러용: business_id의 모든 활성 경쟁사 순차 크롤링.
    Playwright 동시 실행 금지 — 순차 처리 + 2초 간격으로 서버 부하 분산.

    Returns:
        각 경쟁사 크롤링 결과 목록
    """
    from db.supabase_client import execute

    # naver_place_id가 있는 경쟁사만 조회
    rows = (
        await execute(
            supabase.table("competitors")
            .select("id, name, naver_place_id")
            .eq("business_id", business_id)
            .eq("is_active", True)
            .not_.is_("naver_place_id", "null")
        )
    ).data or []

    if not rows:
        _logger.info(f"sync_all_competitor_places: naver_place_id 없음 [{business_id}]")
        return []

    results: list[dict] = []
    for row in rows:
        competitor_id = row["id"]
        naver_place_id = row.get("naver_place_id", "")
        if not naver_place_id:
            continue

        _logger.info(
            f"경쟁사 플레이스 동기화: {row['name']} ({naver_place_id})"
        )
        result = await sync_competitor_place(competitor_id, naver_place_id, supabase)
        results.append({"competitor_id": competitor_id, "name": row["name"], **result})

        # 순차 처리 — 네이버 크롤링 간 2초 간격
        await asyncio.sleep(2)

    return results
