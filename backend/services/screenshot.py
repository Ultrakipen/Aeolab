import asyncio
import uuid
import os
from playwright.async_api import async_playwright


async def capture_ai_result(
    platform: str, query: str, biz_id: str, capture_type: str = "before"
) -> str:
    """AI 검색 결과 스크린샷 캡처 → Supabase Storage 업로드"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox"],  # 서버 환경 필수
        )
        ctx = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            locale="ko-KR",
            timezone_id="Asia/Seoul",
        )
        page = await ctx.new_page()

        try:
            if platform == "naver":
                await page.goto(
                    f"https://search.naver.com/search.naver?query={query}",
                    timeout=30000,
                )
                await page.wait_for_timeout(2000)  # AI 브리핑 로딩 대기
            elif platform == "perplexity":
                await page.goto("https://www.perplexity.ai", timeout=30000)
                await page.fill("textarea[placeholder]", query)
                await page.keyboard.press("Enter")
                await page.wait_for_timeout(5000)  # 답변 생성 대기
            elif platform == "google":
                await page.goto(
                    f"https://www.google.com/search?q={query}",
                    timeout=30000,
                )
                await page.wait_for_timeout(2000)

            fname = f"{biz_id}_{platform}_{capture_type}_{uuid.uuid4().hex[:8]}.png"
            img_bytes = await page.screenshot(
                clip={"x": 0, "y": 0, "width": 1280, "height": 1200}
            )
        finally:
            await browser.close()

    # Supabase Storage 업로드
    from db.supabase_client import get_storage

    path = f"screenshots/{biz_id}/{fname}"
    storage = get_storage()
    storage.from_("before-after").upload(path, img_bytes)
    public_url = storage.from_("before-after").get_public_url(path)
    return public_url


def build_queries(biz: dict) -> list:
    """사업장 정보로 대표 검색 쿼리 생성"""
    region = biz.get("region", "")
    category = biz.get("category", "")
    keywords = biz.get("keywords") or []
    queries = [f"{region} {category} 추천"]
    for kw in keywords[:2]:
        queries.append(f"{region} {kw}")
    return queries


async def capture_batch(biz_id: str, queries: list) -> list:
    """가입 시점 Before 일괄 캡처 — 순차 실행 (RAM 4GB 서버 보호)
    RAM 원칙: Playwright 인스턴스 1개 ≈ 300~500MB → 동시 2개 이상 금지
    """
    results = []
    for q in queries[:3]:  # 대표 쿼리 3개만
        try:
            url = await capture_ai_result("naver", q, biz_id, "before")
            results.append(url)
        except Exception as e:
            results.append(None)
        await asyncio.sleep(3)  # 브라우저 메모리 해제 대기
    return results
