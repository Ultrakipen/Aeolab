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
import time
from typing import Optional

from services.ai_scanner import apply_stealth, get_proxy_config, get_random_ua

_logger = logging.getLogger("aeolab")

# 환경변수 fallback — DB 조회 실패 시에만 사용
NAVER_AI_TAB_ENABLED: bool = os.getenv("NAVER_AI_TAB_ENABLED", "false").lower() == "true"

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
                timeout=30.0,
            )
    except asyncio.TimeoutError:
        _logger.warning(f"[naver_ai_tab] scan timeout (30s): query={query!r}")
        return None
    except Exception as e:
        _logger.warning(f"[naver_ai_tab] scan 오류: query={query!r}, error={e}")
        return None


async def _run_scan(query: str, business_name: str) -> Optional[dict]:
    """Playwright로 네이버 AI탭 DOM을 파싱한다 (내부 구현)."""
    import urllib.parse
    from playwright.async_api import async_playwright

    encoded_q = urllib.parse.quote(query)
    url = f"https://search.naver.com/search.naver?query={encoded_q}"

    proxy = get_proxy_config()
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
            proxy=proxy,
        )
        ctx = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            locale="ko-KR",
            timezone_id="Asia/Seoul",
            user_agent=get_random_ua(),
        )
        page = await ctx.new_page()
        await apply_stealth(page)

        try:
            await page.goto(url, timeout=25000)
            await page.wait_for_timeout(3000)

            # isAITab JS 상태 확인: false이면 AI탭 콘텐츠 자체가 렌더링 안 됨
            try:
                is_ai_tab_js = await page.evaluate(
                    "() => {"
                    "  try {"
                    "    const s = window.naver && window.naver.search && window.naver.search.ext;"
                    "    if (!s) return null;"
                    "    for (const ns of Object.values(s)) {"
                    "      const ps = ns && ns.salt && ns.salt.__PROFILE_STATE__;"
                    "      if (ps && typeof ps.isAITab === 'boolean') return ps.isAITab;"
                    "    }"
                    "  } catch(e) { return null; }"
                    "  return null;"
                    "}"
                )
            except Exception:
                is_ai_tab_js = None

            if is_ai_tab_js is False:
                _logger.info(
                    f"[naver_ai_tab] isAITab=false (서버 IP 미지원 또는 기능 비활성): query={query!r}"
                )
                return {
                    "mentioned": False,
                    "excerpt": "",
                    "tab_available": False,
                    "selector_matched": "isAITab_false",
                }

            # AI탭 섹션 탐색: _AI_TAB_SELECTORS 순서대로 시도
            tab_available = False
            ai_text = ""
            selector_matched: Optional[str] = None

            for selector in _AI_TAB_SELECTORS:
                try:
                    el = await page.query_selector(selector)
                    if el:
                        text_candidate = (await el.inner_text()) or ""
                        if text_candidate.strip():
                            tab_available = True
                            ai_text = text_candidate
                            selector_matched = selector
                            break
                except Exception:
                    continue

            # Fallback: 모든 셀렉터 실패 시 body 전체 텍스트에서 사업장명 부분매칭
            # 네이버 DOM 구조 변경으로 셀렉터가 전부 미스 나도 AI 답변에 사업장명이
            # 있으면 감지할 수 있도록 보강. tab_available은 False로 유지.
            body_fallback_mentioned = False
            if not tab_available:
                try:
                    body_text = await page.inner_text("body")
                    if body_text and _name_in_text(business_name, body_text):
                        body_fallback_mentioned = True
                        selector_matched = "body_text"
                        # body_text에서 사업장명 포함 라인 발췌
                        for line in body_text.split("\n"):
                            if _name_in_text(business_name, line):
                                ai_text = line.strip()[:200]
                                break
                except Exception as e:
                    _logger.debug(f"[naver_ai_tab] body fallback 실패: {e}")

                if not body_fallback_mentioned:
                    _logger.debug(
                        f"[naver_ai_tab] AI탭 섹션 미발견 (DOM 미존재 또는 셀렉터 불일치): "
                        f"query={query!r}"
                    )
                    return {
                        "mentioned": False,
                        "excerpt": "",
                        "tab_available": False,
                        "selector_matched": None,
                    }

            # 사업장명 언급 여부 판단 (셀렉터 매칭 or body fallback)
            if body_fallback_mentioned:
                mentioned = True
                excerpt = ai_text  # 이미 발췌 완료
            else:
                normalized_name = _normalize(business_name)
                normalized_text = _normalize(ai_text)
                mentioned = normalized_name in normalized_text and len(normalized_name) >= 2

                # 언급된 문장 추출 (언급 시 해당 문장 반환)
                excerpt = ""
                if mentioned:
                    for line in ai_text.split("\n"):
                        if normalized_name in _normalize(line):
                            excerpt = line.strip()[:200]
                            break

            _logger.info(
                f"[naver_ai_tab] 스캔 완료: query={query!r}, "
                f"mentioned={mentioned}, tab_available={tab_available}, "
                f"selector_matched={selector_matched!r}"
            )
            return {
                "mentioned": mentioned,
                "excerpt": excerpt,
                "tab_available": tab_available,
                "selector_matched": selector_matched,
            }

        finally:
            await browser.close()


async def scan_batch(queries: list[str], business_name: str) -> dict:
    """여러 쿼리에 대해 네이버 AI탭 스캔을 순차 실행한다.

    비활성 상태(NAVER_AI_TAB_ENABLED=false)이면 빈 dict 반환.
    순차 실행으로 Playwright RAM 보호 (동시 2개 이상 금지).

    Args:
        queries: 검색 쿼리 목록 (최대 4개 처리)
        business_name: 사업장명

    Returns:
        {query: result_dict} 형태. 오류 발생 쿼리는 None 값으로 포함.
    """
    if not await _get_ai_tab_enabled():
        _logger.debug("[naver_ai_tab] scan_batch skip — ai_tab_enabled=false")
        return {}

    results: dict = {}
    for query in queries[:4]:  # 최대 4개
        result = await scan(query, business_name)
        results[query] = result
        if result is not None:
            # 인스턴스 해제 후 짧은 대기 (RAM 복구)
            await asyncio.sleep(2)
    return results
