"""네이버 AI탭 노출 스캐너 (P2 - 6월 AI탭 전체 확대 후 활성화 예정).

활성화 방법: 환경변수 NAVER_AI_TAB_ENABLED=true 설정

현재 상태: NAVER_AI_TAB_ENABLED=false (기본값) → scan() 호출 시 즉시 None 반환

배경 (2026-05-16):
  - 네이버 AI탭은 2026-04-27 베타 공개 (네이버플러스 우선)
  - 2026년 상반기 전체 확대 예정 → 전체 확대 후 이 스캐너 활성화
  - AI탭은 모든 업종 노출 가능 (AI브리핑의 ACTIVE/LIKELY/INACTIVE 구분 없음)
  - 실제 DOM 셀렉터는 6월 전체 확대 후 재확인 필요 (TODO 주석 참조)
"""

import asyncio
import logging
import os
import random
import time
from typing import Optional

from services.ai_scanner import get_proxy_config, attach_bandwidth_counter, note_proxy_result
from services.ai_scanner.bandwidth_tracker import record_usage_mb

_logger = logging.getLogger("aeolab")

# 환경변수 fallback — DB 조회 실패 시에만 사용
NAVER_AI_TAB_ENABLED: bool = os.getenv("NAVER_AI_TAB_ENABLED", "false").lower() == "true"


def _get_naver_cookies() -> list[dict]:
    """환경변수에서 네이버 로그인 쿠키를 읽어 Playwright cookie 형식으로 반환.

    설정 방법 (backend/.env):
        NAVER_COOKIE_NID_AUT=<값>
        NAVER_COOKIE_NID_SES=<값>
        NAVER_COOKIE_NID_JKL=<값>  (선택)

    쿠키 추출: Chrome → F12 → Application → Cookies → .naver.com
    만료 주기: NID_SES 약 30일, NID_AUT 약 1년 → 월 1회 수동 교체
    """
    cookies = []
    for name, env_key in [
        ("NID_AUT", "NAVER_COOKIE_NID_AUT"),
        ("NID_SES", "NAVER_COOKIE_NID_SES"),
        ("NID_JKL", "NAVER_COOKIE_NID_JKL"),
    ]:
        val = os.getenv(env_key, "").strip()
        if val:
            cookies.append({
                "name": name,
                "value": val,
                "domain": ".naver.com",
                "path": "/",
                "httpOnly": True,
                "secure": True,
            })
    if cookies:
        _logger.info(f"[naver_ai_tab] 네이버 쿠키 {len(cookies)}개 로드 ({[c['name'] for c in cookies]})")
    else:
        _logger.debug("[naver_ai_tab] 네이버 쿠키 없음 (NAVER_COOKIE_* 미설정)")
    return cookies

# Chrome UA 캐시 — channel="chrome" 실행 시 "HeadlessChrome"이 HTTP 헤더에 노출돼 봇 감지됨.
# subprocess로 실제 Chrome 버전을 읽어 "Chrome/X.0.0.0"으로 교체.
_chrome_ua_cache: str = ""
_scan_consecutive_failures: int = 0  # 연속 실패 카운터 (쿠키 만료·차단 감지)

def _build_chrome_ua() -> str:
    """설치된 google-chrome-stable 버전을 읽어 올바른 UA 반환."""
    import subprocess
    try:
        result = subprocess.run(
            ["google-chrome-stable", "--version"],
            capture_output=True, text=True, timeout=5,
        )
        # e.g. "Google Chrome 149.0.7827.200 \n"
        version_str = result.stdout.strip().split()[-1]  # "149.0.7827.200"
        major = version_str.split(".")[0]  # "149"
        ua = (
            f"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            f"(KHTML, like Gecko) Chrome/{major}.0.0.0 Safari/537.36"
        )
        _logger.info(f"[naver_ai_tab] Chrome UA 감지: {ua}")
        return ua
    except Exception as e:
        _logger.warning(f"[naver_ai_tab] Chrome 버전 감지 실패, fallback UA 사용: {e}")
        return (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"
        )


async def _get_chrome_ua() -> str:
    """Chrome UA 반환 (프로세스 수명 동안 캐시)."""
    global _chrome_ua_cache
    if not _chrome_ua_cache:
        _chrome_ua_cache = _build_chrome_ua()
    return _chrome_ua_cache


# system_status DB 조회 캐시 (1분 TTL)
_ai_tab_enabled_cache: dict = {"value": None, "ts": 0.0}
_CACHE_TTL = 60.0


async def _get_ai_tab_enabled() -> bool:
    """system_status 테이블에서 ai_tab_enabled 값을 읽는다 (1분 캐시).

    DB 조회 실패 시 환경변수 NAVER_AI_TAB_ENABLED fallback.
    ai_tab_trigger_check_job이 P2 조건 감지 시 DB를 true로 자동 업데이트 →
    pm2 restart 없이 실시간 활성화됨.
    """
    global _ai_tab_enabled_cache
    now = time.monotonic()
    if _ai_tab_enabled_cache["value"] is not None and now - _ai_tab_enabled_cache["ts"] < _CACHE_TTL:
        return _ai_tab_enabled_cache["value"]
    try:
        from db.supabase_client import get_client
        supabase = get_client()
        res = supabase.table("system_status").select("value").eq("key", "ai_tab_enabled").execute()
        val = bool((res.data or [{}])[0].get("value", "false") == "true")
    except Exception as e:
        _logger.debug(f"[naver_ai_tab] system_status 조회 실패, env fallback: {e}")
        val = NAVER_AI_TAB_ENABLED
    _ai_tab_enabled_cache["value"] = val
    _ai_tab_enabled_cache["ts"] = now
    return val

# Playwright RAM 보호: multi_scanner의 PLAYWRIGHT_SEMAPHORE(1)를 공유 (통합 완료 2026-05-20)
# multi_scanner가 이 모듈을 상단 import하므로 순환 참조 방지를 위해 lazy import 패턴 사용
def _get_ai_tab_semaphore() -> asyncio.Semaphore:
    from services.ai_scanner.multi_scanner import PLAYWRIGHT_SEMAPHORE
    return PLAYWRIGHT_SEMAPHORE


# AI탭 DOM 셀렉터 목록 (P2 강화 2026-05-26)
# 네이버 AI탭은 베타→전체 확대 과정에서 DOM 구조가 변동될 수 있음.
# 순서대로 시도하며 첫 번째로 매칭된 셀렉터를 사용.
# 마지막 fallback: page body 전체 텍스트에서 사업장명 부분매칭 (_name_in_text).
_AI_TAB_SELECTORS = [
    # --- 네이버 AI탭 / AI Overview 직접 지시자 (신뢰도 높은 순서) ---
    "#ai_overview",                    # 통합검색 AI Overview 컨테이너 (가장 신뢰)
    "div[id*='ai_overview']",          # id에 ai_overview 포함
    "[data-cr-tab]",                   # AI탭 전환 크롬 렌더링 속성
    "div[data-tab='ai']",              # 예상 AI탭 컨테이너
    "[data-section='ai_tab']",         # data-section 변형
    # --- class 기반 셀렉터 (네이버 BEM / camelCase) ---
    "div[class*='answer_ai']",         # answer_ai* 패턴
    "div[class*='AiAnswer']",          # AiAnswer* camelCase
    "div[class*='AiTab']",             # AiTab* camelCase
    "div[class*='ai_tab']",            # ai_tab* snake_case
    "div[class*='wrap_ai']",           # wrap_ai* 래퍼
    # --- id 기반 셀렉터 ---
    "#ai_answer",                      # AI 답변 영역
    "div[id='ai_overview']",           # 정확한 id 매칭 (ai_overview)
    # --- aria/role 기반 접근성 셀렉터 ---
    ".ai_tab_answer",                  # AI탭 전용 예상 클래스
    # ⚠️ 제거된 셀렉터 (거짓 양성 원인):
    # "section[class*='ai']" — Place 결과 section과 충돌
    # "div[id*='ai']"        — Place 결과 div id와 충돌 (ai_overview 아닌 것도 매칭)
    # "[aria-label*='AI']"   — 탭 메뉴 버튼(aria-label="AI")과 충돌
]


def _normalize(text: str) -> str:
    """공백·특수문자를 제거하고 소문자로 변환한 문자열 반환."""
    import re as _re
    return _re.sub(r"[\s\W]", "", text).lower()


def _name_in_text(business_name: str, text: str) -> bool:
    """사업장명이 텍스트에 포함되는지 공백·특수문자 무시하고 부분매칭.

    길이 2자 미만이면 False 반환 (단음절 오매칭 방지).
    """
    name_norm = _normalize(business_name)
    if len(name_norm) < 2:
        return False
    return name_norm in _normalize(text)


async def scan(query: str, business_name: str) -> Optional[dict]:
    """네이버 AI탭에서 사업장명 언급 여부를 확인한다.

    Args:
        query: 검색 쿼리 (예: "서울 강남 헬스장 추천")
        business_name: 사업장명 (언급 여부 판단 기준)

    Returns:
        NAVER_AI_TAB_ENABLED=false: None (비활성 상태)
        활성화 시: {
            "mentioned": bool,
            "excerpt": str,          # 언급된 문장 (미언급 시 "")
            "tab_available": bool,   # AI탭 섹션 DOM 존재 여부
            "selector_matched": str | None  # 매칭된 셀렉터 (로깅용, fallback 시 "body_text")
        }
        오류 시: None
    """
    if not await _get_ai_tab_enabled():
        _logger.debug(f"[naver_ai_tab] scan skip — ai_tab_enabled=false (query={query!r})")
        return None

    try:
        async with _get_ai_tab_semaphore():
            return await asyncio.wait_for(
                _run_scan(query, business_name),
                timeout=60.0,  # 클릭 네비게이션 방식: naver메인+검색+AI답변 생성 최대 25s
            )
    except asyncio.TimeoutError:
        _logger.warning(f"[naver_ai_tab] scan timeout (60s): query={query!r}")
        return None
    except Exception as e:
        _logger.warning(f"[naver_ai_tab] scan 오류: query={query!r}, error={e}")
        note_proxy_result(e)
        return None


async def _run_scan(query: str, business_name: str) -> Optional[dict]:
    global _scan_consecutive_failures
    """Playwright로 네이버 AI탭 DOM을 파싱한다 (내부 구현).

    접근 방식 (2026-06-28 확정):
      1. 일반 검색 페이지 → AI탭 링크 클릭 (직접 URL 차단됨)
      2. apply_stealth 제거 — 오히려 봇 감지 유발 확인
      3. channel="chrome" + --disable-blink-features=AutomationControlled
      4. Chrome 버전 일치 UA (HeadlessChrome 제거)
    """
    import urllib.parse
    from playwright.async_api import async_playwright

    encoded_q = urllib.parse.quote(query)
    search_url = f"https://search.naver.com/search.naver?query={encoded_q}"

    proxy = get_proxy_config()
    # Chrome UA: 설치된 Chrome 버전에 맞게 동적 감지 (HeadlessChrome → Chrome)
    ua = await _get_chrome_ua()

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            channel="chrome",
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled",
            ],
            proxy=proxy,
        )
        ctx = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            locale="ko-KR",
            timezone_id="Asia/Seoul",
            user_agent=ua,
        )
        # 네이버 로그인 쿠키 주입
        naver_cookies = _get_naver_cookies()
        if naver_cookies:
            await ctx.add_cookies(naver_cookies)
        # block_heavy_resources 미적용 — image/media/font 차단이 AI탭 봇 탐지를
        # 유발함을 실측 확인(2026-07-04, 차단 미적용 시 3/3 성공 vs 적용 시 즉시 차단).
        # 대역폭 측정만 유지, 리소스 차단은 하지 않음.
        _bw_counter = attach_bandwidth_counter(ctx)

        page = await ctx.new_page()
        # apply_stealth 미적용 — AI탭에서 봇 감지 유발 확인 (2026-06-28)

        try:
            # 네이버 메인 방문 (세션 활성화)
            await page.goto("https://www.naver.com", timeout=15000)
            await page.wait_for_timeout(random.randint(1200, 2600))  # 인간 편차 딜레이

            # 일반 검색 이동
            await page.goto(search_url, timeout=20000)
            await page.wait_for_timeout(random.randint(2500, 4500))  # 인간 편차 딜레이

            # AI탭 링크 클릭 (직접 URL 차단 우회)
            ai_tab_clicked = False
            for selector in ["a[href*='tab.ait']", "a[href*='m_ait']"]:
                try:
                    el = await page.query_selector(selector)
                    if el:
                        await el.click()
                        ai_tab_clicked = True
                        _logger.debug(f"[naver_ai_tab] AI탭 링크 클릭: {selector}")
                        break
                except Exception:
                    continue

            if not ai_tab_clicked:
                # fallback: 직접 URL (클릭 실패 시)
                url_ai = f"https://search.naver.com/search.naver?ssc=tab.ait.all&query={encoded_q}"
                _logger.debug(f"[naver_ai_tab] AI탭 링크 없음 → 직접 URL 시도")
                await page.goto(url_ai, timeout=25000)

            # AI 답변 생성 대기 (최대 25초, 5초마다 체크)
            ai_text = ""
            for round_n in range(5):
                await page.wait_for_timeout(5000)
                current_url = page.url

                # 로그인 리다이렉트 감지 (쿠키 만료)
                if "nidlogin" in current_url:
                    _scan_consecutive_failures += 1
                    _logger.warning(
                        f"[naver_ai_tab] ⚠️ 쿠키 만료 감지 (연속 {_scan_consecutive_failures}회) — "
                        f"query={query!r} | "
                        "조치: Chrome → naver.com 로그인 → F12 → Application → Cookies → NID_AUT 복사 → .env 갱신"
                    )
                    if _scan_consecutive_failures >= 3:
                        _logger.warning(
                            f"[naver_ai_tab] 🚨 연속 {_scan_consecutive_failures}회 쿠키 만료 — "
                            "AI탭 스캔 중단됨. 즉시 NID_AUT 교체 필요."
                        )
                    return None

                body_check = await page.inner_text("body")
                body_stripped = body_check.strip()

                # 차단 감지
                if "잘못된 접근" in body_check and len(body_stripped) < 150:
                    _scan_consecutive_failures += 1
                    _logger.warning(
                        f"[naver_ai_tab] ⚠️ AI탭 차단 감지 (연속 {_scan_consecutive_failures}회): "
                        f"query={query!r} | 프록시 또는 접근 방식 문제"
                    )
                    return None

                # 생성 완료 판단: body 200자+ && "분석 중" 없음
                if len(body_stripped) > 200 and "분석 중" not in body_check:
                    ai_text = body_check
                    _scan_consecutive_failures = 0  # 성공 시 카운터 리셋
                    _logger.debug(f"[naver_ai_tab] AI 답변 완성 ({round_n*5+5}s): body_len={len(body_stripped)}")
                    break

            if not ai_text:
                # 시간 내 완성 안 됨 — 마지막 상태 그대로 사용
                ai_text = await page.inner_text("body")

            # 최종 차단·빈 페이지 체크
            if "잘못된 접근" in ai_text or len(ai_text.strip()) < 100:
                _logger.warning(f"[naver_ai_tab] AI탭 차단됨 (최종): query={query!r}")
                return None

            tab_available = len(ai_text.strip()) > 200

            # 사업장명 언급 여부 판단
            normalized_name = _normalize(business_name)
            normalized_text = _normalize(ai_text)
            mentioned = normalized_name in normalized_text and len(normalized_name) >= 2

            excerpt = ""
            if mentioned:
                for line in ai_text.split("\n"):
                    if normalized_name in _normalize(line):
                        excerpt = line.strip()[:200]
                        break

            _logger.info(
                f"[naver_ai_tab] 스캔 완료: query={query!r}, "
                f"mentioned={mentioned}, tab_available={tab_available}, body_len={len(ai_text.strip())}"
            )
            return {
                "mentioned": mentioned,
                "excerpt": excerpt,
                "tab_available": tab_available,
                "selector_matched": "click_navigation",
            }

        finally:
            await browser.close()
            await record_usage_mb(_bw_counter[0] / 1024 / 1024)


async def get_last_known_visibility(business_id: str) -> tuple[Optional[bool], Optional[str]]:
    """이번 스캔에서 AI탭이 측정되지 않았을 때(scan_basic 경량일·차단·타임아웃) 참조할
    해당 사업장의 가장 최근 실측값. None을 "미노출"로 오인해 덮어쓰지 않기 위한 carry-forward.

    scan_results.naver_ai_tab_visible은 스캔마다 새로 INSERT되며 미측정 시 None으로 남는데,
    대시보드가 최신 1건만 보여줘 실측 있던 값이 다음날 "측정 예정"으로 되돌아가 보이는 문제 방지.

    Returns: (naver_ai_tab_visible, naver_ai_tab_excerpt) — 이력 없으면 (None, None)
    """
    try:
        from db.supabase_client import get_client, execute
        supabase = get_client()
        res = await execute(
            supabase.table("scan_results")
            .select("naver_ai_tab_visible, naver_ai_tab_excerpt")
            .eq("business_id", business_id)
            .not_.is_("naver_ai_tab_visible", "null")
            .order("scanned_at", desc=True)
            .limit(1)
        )
        if res and res.data:
            row = res.data[0]
            return row.get("naver_ai_tab_visible"), row.get("naver_ai_tab_excerpt")
    except Exception as e:
        _logger.debug(f"[naver_ai_tab] get_last_known_visibility 조회 실패 (무시): {e}")
    return None, None


async def scan_batch(queries: list[str], business_name: str) -> dict:
    """여러 쿼리에 대해 네이버 AI탭 스캔을 순차 실행한다.

    비활성 상태(NAVER_AI_TAB_ENABLED=false)이면 빈 dict 반환.
    순차 실행으로 Playwright RAM 보호 (동시 2개 이상 금지).

    Args:
        queries: 검색 쿼리 목록 (최대 4개 처리)
        business_name: 사업장명

    Returns:
        {query: result_dict} 형태. 오류/차단 쿼리는 결과에서 제외한다
        (전체 실패 시 빈 dict — 호출측이 "미측정"과 "측정됨=False"를 구분할 수 있도록).
    """
    if not await _get_ai_tab_enabled():
        _logger.debug("[naver_ai_tab] scan_batch skip — ai_tab_enabled=false")
        return {}

    results: dict = {}
    for query in queries[:4]:  # 최대 4개
        result = await scan(query, business_name)
        if result is not None:
            results[query] = result
            # 인스턴스 해제 후 짧은 대기 (RAM 복구)
            await asyncio.sleep(2)
    return results
