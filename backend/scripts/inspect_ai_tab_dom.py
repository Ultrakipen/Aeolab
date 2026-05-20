"""네이버 AI탭 DOM 셀렉터 실측 진단 스크립트.

P2 활성화 후 실제 DOM 구조를 확인하여 _AI_TAB_SELECTORS 업데이트에 사용.

실행 방법 (서버 SSH):
    cd /var/www/aeolab
    source venv/bin/activate
    python3 backend/scripts/inspect_ai_tab_dom.py

출력: AI 관련 DOM 요소 목록 + 실제 작동하는 셀렉터 + HTML 스냅샷
"""

import asyncio
import json
import re
import sys
from datetime import datetime

QUERIES = [
    "강남역 맛집 추천",
    "홍대 카페 추천",
    "서울 헬스장 추천",
]

# 수집할 후보 셀렉터 (폭넓게 탐색)
CANDIDATE_SELECTORS = [
    # AI탭 관련 예상 셀렉터
    "div[data-tab='ai']",
    "#ai_answer",
    ".ai_tab_answer",
    "div[class*='AiTab']",
    "div[class*='ai_tab']",
    "[data-section='ai_tab']",
    # 네이버 일반 구조
    "#wrap_ai",
    ".ai_wrap",
    "[class*='ai_']",
    "[id*='ai_']",
    "[class*='_ai']",
    # 탭 구조
    "a[role='tab']",
    "li[role='tab']",
    ".tab_list a",
    "#gnb_tab a",
    "[data-area='tab']",
    # AI 브리핑 공유 가능 셀렉터
    ".cue_listen",
    "#ai_briefing",
    ".briefing_wrap",
    "[class*='Briefing']",
    "[class*='briefing']",
]

# AI 관련 키워드 (동적 클래스 탐지용)
AI_KEYWORDS = ["ai", "briefing", "answer", "생성", "요약", "AI", "chat"]


async def inspect_query(page, query: str) -> dict:
    import urllib.parse
    url = f"https://search.naver.com/search.naver?query={urllib.parse.quote(query)}"
    result = {"query": query, "url": url, "found_selectors": [], "tabs": [], "ai_elements": [], "snapshot": ""}

    try:
        await page.goto(url, timeout=25000)
        await page.wait_for_timeout(4000)

        # 1. 후보 셀렉터 탐색
        for sel in CANDIDATE_SELECTORS:
            try:
                els = await page.query_selector_all(sel)
                if els:
                    texts = []
                    for el in els[:3]:
                        t = (await el.inner_text()).strip()[:80]
                        if t:
                            texts.append(t)
                    result["found_selectors"].append({
                        "selector": sel,
                        "count": len(els),
                        "sample_text": texts,
                    })
            except Exception:
                continue

        # 2. 탭 목록 수집 (a[role=tab], li[role=tab])
        for tab_sel in ["a[role='tab']", "li[role='tab']", ".tab_list a"]:
            try:
                tabs = await page.query_selector_all(tab_sel)
                for tab in tabs:
                    text = (await tab.inner_text()).strip()
                    href = await tab.get_attribute("href") or ""
                    cls = await tab.get_attribute("class") or ""
                    result["tabs"].append({"text": text, "href": href[:100], "class": cls[:80]})
            except Exception:
                continue

        # 3. AI 키워드 포함 동적 클래스 요소 탐색
        all_divs = await page.query_selector_all("div[class], section[class]")
        for el in all_divs[:500]:  # 최대 500개
            try:
                cls = (await el.get_attribute("class") or "").lower()
                if any(kw in cls for kw in [k.lower() for k in AI_KEYWORDS]):
                    text = (await el.inner_text()).strip()[:100]
                    if text:
                        result["ai_elements"].append({"class": cls[:100], "text": text})
                        if len(result["ai_elements"]) >= 20:
                            break
            except Exception:
                continue

        # 4. HTML 스냅샷 (첫 5000자)
        body_html = await page.content()
        # AI 관련 섹션만 추출
        ai_sections = re.findall(r'<[^>]*(?:ai|briefing|answer)[^>]*>.*?</[a-z]+>', body_html[:50000], re.IGNORECASE | re.DOTALL)
        result["snapshot"] = "\n".join(ai_sections[:5])[:2000] if ai_sections else "(AI 관련 HTML 없음)"

    except Exception as e:
        result["error"] = str(e)

    return result


async def main():
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("ERROR: playwright 미설치. pip install playwright && playwright install chromium")
        sys.exit(1)

    print(f"\n{'='*60}")
    print(f"  네이버 AI탭 DOM 셀렉터 진단")
    print(f"  실행 시각: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}\n")

    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        )
        ctx = await browser.new_context(
            locale="ko-KR",
            timezone_id="Asia/Seoul",
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
        )
        for query in QUERIES:
            print(f"[탐색 중] {query} ...")
            page = await ctx.new_page()
            r = await inspect_query(page, query)
            results.append(r)
            await page.close()
            await asyncio.sleep(2)
        await browser.close()

    # 결과 출력
    print("\n" + "="*60)
    print("  탐색 결과")
    print("="*60)

    # 공통으로 발견된 셀렉터
    all_found: dict[str, int] = {}
    for r in results:
        for s in r.get("found_selectors", []):
            sel = s["selector"]
            all_found[sel] = all_found.get(sel, 0) + 1

    print("\n[1] 작동하는 셀렉터 (발견 횟수):")
    if all_found:
        for sel, cnt in sorted(all_found.items(), key=lambda x: -x[1]):
            print(f"    {cnt}/{len(QUERIES)}회  →  {sel}")
        best = [s for s, c in all_found.items() if c == len(QUERIES)]
        if best:
            print(f"\n  ★ 전 쿼리 공통 셀렉터 (교체 권장):")
            for s in best:
                print(f"    \"{s}\",")
        print()
    else:
        print("    (발견된 셀렉터 없음 — AI탭 아직 미활성 또는 셀렉터 변경됨)\n")

    print("[2] 탭 목록 (첫 쿼리 기준):")
    for tab in results[0].get("tabs", [])[:10]:
        print(f"    [{tab['text']}]  href={tab['href'][:60]}")

    print("\n[3] AI 키워드 포함 요소 (첫 쿼리 기준):")
    for el in results[0].get("ai_elements", [])[:10]:
        print(f"    class={el['class'][:60]}")
        print(f"    text={el['text'][:80]}\n")

    print("[4] HTML 스냅샷 (첫 쿼리):")
    print(results[0].get("snapshot", "")[:1000])

    # JSON 저장
    out_path = f"/tmp/ai_tab_dom_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n[전체 결과 저장] {out_path}")
    print("\n[업데이트 방법]")
    print("  위 '★ 전 쿼리 공통 셀렉터'를 복사하여")
    print("  backend/services/ai_scanner/naver_ai_tab_scanner.py")
    print("  _AI_TAB_SELECTORS 리스트를 교체 후 pm2 restart aeolab-backend")


if __name__ == "__main__":
    asyncio.run(main())
