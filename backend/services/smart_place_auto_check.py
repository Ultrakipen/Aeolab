"""
스마트플레이스 자동 진단 서비스 (트라이얼용)

`naver_place_id` 하나만으로 항목을 자동 판정 — 사용자 자가체크 대체:
- is_smart_place: 페이지 정상 로드 여부
- has_recent_post: 소식 탭에 최근 30일 내 게시물 1개 이상
- has_intro: 소개글 텍스트 50자 이상
- has_faq: [DEPRECATED 2026-05-01] 스마트플레이스 사장님 Q&A 탭 폐기로 항상 False.
           하위 호환을 위해 키만 유지. 점수 미반영.

Playwright 인스턴스는 RAM 보호용 Semaphore(1)로 직렬화. 실패 시 절대 raise 하지 않고
모든 항목 False + error 코드 반환 (트라이얼 흐름 보존).
"""
import asyncio
import logging
import re
from datetime import datetime, timedelta, timezone

from playwright.async_api import async_playwright

_logger = logging.getLogger("aeolab")

# Playwright 동시 실행 제한 (iwinv 4GB RAM, 인스턴스당 300~500MB)
_PLAYWRIGHT_SEM = asyncio.Semaphore(1)

_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

_PAGE_TIMEOUT_MS = 8000          # 단일 페이지 로드 타임아웃
_TOTAL_TIMEOUT_S = 30            # 전체 진단 타임아웃 (홈/소식/정보 3탭 + 마진)
                                  # [2026-05-01] /qna 탭 폐기로 4탭 → 3탭, 35s → 30s


def _build_action_links(naver_place_id: str, results: dict) -> dict:
    """미통과 항목별 사장님 행동 링크 — 스마트플레이스 백오피스 딥링크.

    [2026-05-01] 사장님 Q&A 탭 폐기로 `links["faq"]` 제거. Q&A는 소개글에 포함.
    """
    links: dict = {}
    if not results.get("is_smart_place"):
        links["register"] = "https://smartplace.naver.com/"
        return links
    base = f"https://smartplace.naver.com/bizes/{naver_place_id}"
    if not results.get("has_recent_post"):
        links["post"] = f"{base}/posts"
    if not results.get("has_intro"):
        links["intro"] = f"{base}/profile"
    return links


def _calc_score_loss(results: dict) -> int:
    """미통과 항목별 추정 손실 점수 (Track1 smart_place_completeness 만점 60 기준).

    [2026-05-01] has_faq 25점 손실 제거 — 사장님 Q&A 탭 폐기로 has_faq는 항상 False가 되므로
    25점을 소개글 25 + 소식 25 + 등록 10으로 재배분 (합계 60점 보존).
    """
    loss = 0
    if not results.get("is_smart_place"):
        return 60  # 미등록은 만점 손실
    if not results.get("has_recent_post"):
        loss += 25      # 최신성 점수 (15→25 상향, FAQ 25점 흡수)
    if not results.get("has_intro"):
        loss += 25      # 소개글 (10→25 상향, FAQ 25점 흡수 + AI 브리핑 인용 후보 핵심)
    return loss


async def auto_check_smart_place(naver_place_id: str) -> dict:
    """
    네이버 플레이스 모바일 페이지를 Playwright로 자동 진단.

    Returns:
        {
            is_smart_place: bool,
            has_faq: bool,
            has_recent_post: bool,
            has_intro: bool,
            score_loss: int,
            action_links: dict[str, str],
            error: str | None,
        }
    실패 시: 모든 bool False + error 코드 반환 (raise 금지)
    """
    if not naver_place_id or not str(naver_place_id).strip():
        return _failed_result("invalid_id")

    place_id = str(naver_place_id).strip()

    try:
        async with _PLAYWRIGHT_SEM:
            return await asyncio.wait_for(
                _run_check(place_id),
                timeout=_TOTAL_TIMEOUT_S,
            )
    except asyncio.TimeoutError:
        _logger.warning(f"smart_place_auto_check timeout: {place_id}")
        return _failed_result("timeout", naver_place_id=place_id)
    except Exception as e:
        _logger.warning(f"smart_place_auto_check error [{place_id}]: {e}")
        return _failed_result("fetch_failed", naver_place_id=place_id)


def _failed_result(error_code: str, naver_place_id: str = "") -> dict:
    """진단 실패 시 안전 fallback — 모든 항목 False + 등록 링크 노출"""
    return {
        "is_smart_place": False,
        "has_faq": False,
        "has_recent_post": False,
        "has_intro": False,
        "score_loss": 60,
        "action_links": {"register": "https://smartplace.naver.com/"},
        "error": error_code,
    }


async def _run_check(naver_place_id: str) -> dict:
    """실제 Playwright 크롤링 — 3개 탭(home/feed/info) 순차 방문"""
    base_url = f"https://m.place.naver.com/place/{naver_place_id}"
    # 2026-04-30 표준 URL: /place/ 경로 (구 /restaurant/는 deprecated 위험)

    results = {
        "is_smart_place": False,
        "has_faq": False,
        "has_recent_post": False,
        "has_intro": False,
    }

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        )
        ctx = await browser.new_context(
            locale="ko-KR",
            timezone_id="Asia/Seoul",
            user_agent=_USER_AGENT,
            viewport={"width": 412, "height": 915},
        )
        page = await ctx.new_page()
        try:
            # ── 1단계: 홈 탭 — 페이지 정상 로드 여부 ───────────────────
            try:
                await page.goto(
                    f"{base_url}/home",
                    timeout=_PAGE_TIMEOUT_MS,
                    wait_until="domcontentloaded",
                )
                await page.wait_for_timeout(1500)
                home_text = (await page.inner_text("body"))[:5000] or ""
                # "삭제된 업체" / "존재하지 않는" 메시지 차단 — 그 외엔 등록된 것으로 판정
                if home_text and not re.search(
                    r"(존재하지 않|삭제|찾을 수 없|페이지를 찾을 수 없)", home_text
                ):
                    results["is_smart_place"] = True
            except Exception as e:
                _logger.warning(f"smart_place home tab failed [{naver_place_id}]: {e}")
                # 홈 탭 실패 = 미등록 판정으로 종료
                return {
                    **results,
                    "score_loss": _calc_score_loss(results),
                    "action_links": _build_action_links(naver_place_id, results),
                    "error": "home_load_failed",
                }

            # ── 2단계: 소식 탭 — 최근 30일 내 게시물 ───────────────────
            try:
                await page.goto(
                    f"{base_url}/feed",
                    timeout=_PAGE_TIMEOUT_MS,
                    wait_until="domcontentloaded",
                )
                await page.wait_for_timeout(1500)
                feed_text = (await page.inner_text("body")) or ""
                results["has_recent_post"] = _detect_recent_post(feed_text)
            except Exception as e:
                _logger.warning(f"smart_place feed tab skipped [{naver_place_id}]: {e}")

            # ── 3단계: 정보 탭 — 소개글 ────────────────────────
            # [2026-05-01] 사장님 Q&A 탭(/qna) 폐기로 has_faq 자동 감지 제거.
            # has_faq는 results dict에 False로 고정 (점수 미반영).
            try:
                await page.goto(
                    f"{base_url}/information",
                    timeout=_PAGE_TIMEOUT_MS,
                    wait_until="domcontentloaded",
                )
                await page.wait_for_timeout(1500)
                info_text = (await page.inner_text("body")) or ""
                results["has_intro"] = _detect_intro(info_text)
                # has_faq는 _calc_score_loss/_build_action_links에서 미사용. 항상 False.
            except Exception as e:
                _logger.warning(f"smart_place information tab skipped [{naver_place_id}]: {e}")

        finally:
            try:
                await ctx.close()
            except Exception as e:
                _logger.warning(f"smart_place ctx close failed: {e}")
            try:
                await browser.close()
            except Exception as e:
                _logger.warning(f"smart_place browser close failed: {e}")

    return {
        **results,
        "score_loss": _calc_score_loss(results),
        "action_links": _build_action_links(naver_place_id, results),
        "error": None,
    }


# ── 텍스트 기반 휴리스틱 ──────────────────────────────────────────────────

def _detect_recent_post(feed_body: str) -> bool:
    """소식 탭 본문에서 최근 30일 내 게시물 존재 여부 추정.

    - "N일 전" / "N시간 전" 표시: 최근 = True
    - "N개월 전" / "N년 전": 오래됨 = False
    - 절대 날짜(YYYY.MM.DD): 30일 이내 판정
    - "등록된 소식이 없습니다" / "최근 소식이 없습니다": False
    """
    if not feed_body:
        return False
    if re.search(r"(등록된 소식이 없|소식이 없|게시물이 없)", feed_body):
        return False

    # "N일 전" / "N시간 전" / "방금" / "어제" / "오늘" → 최근
    if re.search(r"(\d+\s*시간\s*전|\d+\s*분\s*전|방금|오늘|어제)", feed_body):
        return True
    m_day = re.search(r"(\d+)\s*일\s*전", feed_body)
    if m_day:
        try:
            return int(m_day.group(1)) <= 30
        except ValueError:
            return False

    # 절대 날짜 (YYYY.MM.DD 또는 YYYY-MM-DD) — 30일 이내면 최근
    today = datetime.now(timezone.utc).date()
    for m in re.finditer(r"(20\d{2})[./\-](\d{1,2})[./\-](\d{1,2})", feed_body):
        try:
            d = datetime(
                int(m.group(1)), int(m.group(2)), int(m.group(3)), tzinfo=timezone.utc
            ).date()
            if (today - d) <= timedelta(days=30):
                return True
        except (ValueError, OverflowError):
            continue

    return False


def _detect_intro(info_body: str) -> bool:
    """정보 탭 본문에서 소개글 50자 이상 존재 여부 추정."""
    if not info_body:
        return False
    # "업체 소개" / "소개" 헤더 다음 텍스트 블록 추출 (최대 1500자)
    m = re.search(r"(업체\s*소개|소개)[\s\S]{0,1500}", info_body)
    if not m:
        return False
    block = m.group(0)
    # 헤더 라벨 제거 + 공백 제거 후 길이 측정
    cleaned = re.sub(r"(업체\s*소개|소개)\s*", "", block, count=1)
    cleaned = re.sub(r"\s+", "", cleaned)
    return len(cleaned) >= 50


def _detect_faq(info_body: str) -> bool:
    """[DEPRECATED 2026-05-01] FAQ 감지 — 호출 제거됨.
    스마트플레이스 사장님 Q&A 탭(/qna) 폐기로 인해 사용처 제거. 함수만 하위 호환을 위해 잔존.
    항상 False 반환.
    """
    return False
