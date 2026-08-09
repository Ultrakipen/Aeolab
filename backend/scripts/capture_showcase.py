"""
공개 쇼케이스 페이지(/showcase)용 정적 스크린샷 캡처 스크립트.

실제 구독 사업장(홍뮤직스튜디오작곡교습소)의 대시보드 8개 화면을 로그인 후
PC·모바일 두 뷰포트로 각각 캡처해 frontend/public/showcase/*.png 로 저장한다.
사이트가 PC/모바일 별개 레이아웃으로 구현되어 있어(CLAUDE.md 원칙), 데스크톱
캡처를 축소해 모바일에 억지로 끼워 넣지 않고 실제 모바일 렌더링을 그대로 캡처한다.
1회성 관리자 스크립트 — FastAPI 앱과 별도 프로세스로 실행하므로
PLAYWRIGHT_SEMAPHORE 공유 불필요.

사용법 (로컬 backend_venv):
    SHOWCASE_EMAIL=xxx SHOWCASE_PASSWORD=xxx backend_venv/Scripts/python backend/scripts/capture_showcase.py

상호명은 캡처 직전 DOM에서 텍스트 치환으로만 마스킹한다 (DB 원본 미변경).
"""
import asyncio
import os
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE_URL = "https://aeolab.co.kr"
EMAIL = os.environ.get("SHOWCASE_EMAIL")
PASSWORD = os.environ.get("SHOWCASE_PASSWORD")

OUTPUT_DIR = Path(__file__).resolve().parents[2] / "frontend" / "public" / "showcase"

# 마스킹 대상 — 실제 상호명·로그인 이메일 → 표시용 문구 (경쟁사명·지역명 등은 그대로 유지)
BUSINESS_NAME = "홍뮤직스튜디오작곡교습소"
MASK_TEXT = "OO음악학원"
EMAIL_MASK_TEXT = "owner@example.com"

PAGES = [
    ("/dashboard", "01_dashboard", "대시보드"),
    ("/competitors", "02_competitors", "경쟁사 관리"),
    ("/history", "03_history", "변화 기록"),
    ("/growth", "04_growth", "성장 리포트"),
    ("/guide", "05_guide", "개선 가이드"),
    ("/blog-analysis", "06_blog_analysis", "블로그 진단"),
    ("/schema", "07_schema", "소개글·콘텐츠"),
    ("/review-inbox", "08_review_inbox", "리뷰 답변"),
]

VIEWPORTS = [
    ("desktop", {"width": 1440, "height": 900}, ""),
    ("mobile", {"width": 390, "height": 844}, "_mobile"),
]

EXPAND_JS = """
() => {
    // [aria-haspopup]은 계정 메뉴 등 팝업 트리거(콘텐츠 아코디언 아님) — 실제 이메일 등이
    // 노출될 수 있어 제외. 콘텐츠 섹션만 펼친다.
    const els = Array.from(document.querySelectorAll('[aria-expanded="false"]:not([aria-haspopup])'));
    els.forEach((el) => { try { el.click(); } catch (e) {} });
    return els.length;
}
"""

MASK_JS = """
(pairs) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    let count = 0;
    for (const node of nodes) {
        for (const {find, replace} of pairs) {
            if (find && node.nodeValue && node.nodeValue.includes(find)) {
                node.nodeValue = node.nodeValue.split(find).join(replace);
                count++;
            }
        }
    }
    // input/textarea value·title 속성은 텍스트 노드가 아니라 위 TreeWalker로 못 잡음
    // (예: /schema 폼 입력값, 계정 메뉴 이메일 title 속성)
    document.querySelectorAll('input, textarea, [title]').forEach((el) => {
        for (const {find, replace} of pairs) {
            if (!find) continue;
            if ('value' in el && el.value && el.value.includes(find)) {
                el.value = el.value.split(find).join(replace);
                count++;
            }
            const title = el.getAttribute('title');
            if (title && title.includes(find)) {
                el.setAttribute('title', title.split(find).join(replace));
                count++;
            }
        }
    });
    return count;
}
"""


async def capture_pages(context, suffix: str):
    page = await context.new_page()
    for path, base_name, label in PAGES:
        try:
            print(f"캡처 중[{suffix or 'desktop'}]: {label} ({path})")
            await page.goto(f"{BASE_URL}{path}", wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(2500)
            # 접힌 아코디언(aria-expanded=false)을 펼쳐 실제 콘텐츠 깊이가 보이도록 함.
            # 라디오형(상호배타) 아코디언은 마지막 클릭 항목만 열린 채 남음 — 안전한 단일 순회, 무한루프 없음.
            # 2회 순회: 1차에서 펼친 섹션 안에 중첩된 토글이 새로 나타나는 경우까지 커버.
            for _ in range(2):
                expanded_count = await page.evaluate(EXPAND_JS)
                if not expanded_count:
                    break
                await page.wait_for_timeout(500)
            masked = await page.evaluate(MASK_JS, [
                {"find": BUSINESS_NAME, "replace": MASK_TEXT},
                {"find": EMAIL, "replace": EMAIL_MASK_TEXT},
            ])
            if masked:
                print(f"  상호명 마스킹 {masked}건")
            await page.wait_for_timeout(300)
            out_path = OUTPUT_DIR / f"{base_name}{suffix}.png"
            await page.screenshot(path=str(out_path), full_page=True)
            print(f"  저장: {out_path}")
        except Exception as e:
            print(f"  실패({label}): {e}", file=sys.stderr)
    await page.close()


async def main():
    if not EMAIL or not PASSWORD:
        print("SHOWCASE_EMAIL / SHOWCASE_PASSWORD 환경변수가 필요합니다.", file=sys.stderr)
        sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        # 데스크톱 컨텍스트에서 로그인 후 세션(storage_state)을 모바일 컨텍스트와 공유
        desktop_ctx = await browser.new_context(viewport={"width": 1440, "height": 900})
        login_page = await desktop_ctx.new_page()
        print("로그인 중...")
        await login_page.goto(f"{BASE_URL}/login", wait_until="networkidle", timeout=30000)
        await login_page.fill('input[type="email"]', EMAIL)
        await login_page.fill('input[type="password"]', PASSWORD)
        await login_page.click('button[type="submit"]')
        await login_page.wait_for_url("**/dashboard**", timeout=20000)
        print("로그인 완료 →", login_page.url)
        await login_page.close()
        storage_state = await desktop_ctx.storage_state()

        await capture_pages(desktop_ctx, "")
        await desktop_ctx.close()

        mobile_ctx = await browser.new_context(
            viewport={"width": 390, "height": 844},
            storage_state=storage_state,
            is_mobile=True,
            has_touch=True,
        )
        await capture_pages(mobile_ctx, "_mobile")
        await mobile_ctx.close()

        await browser.close()
    print("완료.")


if __name__ == "__main__":
    asyncio.run(main())
