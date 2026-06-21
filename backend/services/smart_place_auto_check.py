"""
스마트플레이스 자동 진단 서비스 (트라이얼용)

`naver_place_id` 하나만으로 항목을 자동 판정 — 사용자 자가체크 대체:
- is_smart_place: 페이지 정상 로드 여부
- has_recent_post: 소식 탭에 최근 90일 내 게시물 1개 이상
- has_intro: 소개글 텍스트 50자 이상
- has_faq: [DEPRECATED 2026-05-01] 스마트플레이스 사장님 Q&A 탭 폐기로 항상 False.
           하위 호환을 위해 키만 유지. 점수 미반영.
- has_reservation: [P1-B-1] 네이버 예약 연동 여부 추정. 점수 미반영, AI탭 안내용.
- photo_count: [P1-B-2] 홈 탭에서 추정한 등록 사진 수. 점수 미반영, AI탭 품질 안내용.

Playwright 인스턴스는 RAM 보호용 Semaphore(1)로 직렬화. 실패 시 절대 raise 하지 않고
모든 항목 False + error 코드 반환 (트라이얼 흐름 보존).
"""
import asyncio
import logging
import re
from datetime import datetime, timedelta, timezone

from playwright.async_api import async_playwright

_logger = logging.getLogger("aeolab")

# Playwright 세마포어: multi_scanner.PLAYWRIGHT_SEMAPHORE 공유 (동시 Playwright 전역 1개 보장)
# GitHub Actions 등 multi_scanner import 불가 환경에서는 독립 Semaphore(1) fallback 사용
def _get_playwright_sem():
    try:
        from services.ai_scanner.multi_scanner import PLAYWRIGHT_SEMAPHORE
        return PLAYWRIGHT_SEMAPHORE
    except Exception:
        if not hasattr(_get_playwright_sem, "_fallback"):
            import asyncio
            _get_playwright_sem._fallback = asyncio.Semaphore(1)
        return _get_playwright_sem._fallback

from services.ai_scanner import apply_stealth as _apply_stealth, get_proxy_config as _get_proxy_config, get_random_ua as _get_random_ua

_PAGE_TIMEOUT_MS = 8000          # 단일 페이지 로드 타임아웃
_TOTAL_TIMEOUT_S = 30            # 전체 진단 타임아웃 (홈/소식/정보 3탭 + 마진)
                                  # [2026-05-01] /qna 탭 폐기로 4탭 → 3탭, 35s → 30s


def _build_action_links(naver_place_id: str, results: dict) -> dict:
    """미통과 항목별 사장님 행동 링크 — 스마트플레이스 백오피스 딥링크.

    [2026-05-01] 사장님 Q&A 탭 폐기로 `links["faq"]` 제거. Q&A는 소개글에 포함.
    [P1-B-1] has_reservation=False 시 partner.naver.com 예약 설정 링크 추가.
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
    if not results.get("has_reservation"):
        links["reservation"] = "https://partner.naver.com/"
    return links


def _calc_score_loss(results: dict) -> int:
    """미통과 항목별 추정 손실 점수 (score_engine.calc_smart_place_completeness 기준 동기화).

    score_engine.py calc_smart_place_completeness 배점 (rank=0 기준):
      is_smart_place: 25점 / has_recent_post: 25점 / has_intro: 20점 → 합계 70점
    has_faq: [2026-05-01 폐기] 점수 미반영.
    has_reservation: [P1-B-1] 점수 미반영 — AI탭 개선 행동 안내 전용.
    photo_count: [P1-B-2] 점수 미반영 — AI탭 품질 향상 안내 전용.
    """
    loss = 0
    if not results.get("is_smart_place"):
        return 70  # 미등록: 등록(25) + 소식(25) + 소개글(20) 전부 손실 (rank=0 기준)
    if not results.get("has_recent_post"):
        loss += 25      # 최신성 점수
    if not results.get("has_intro"):
        loss += 20      # 소개글 (score_engine 20점과 동기화)
    return loss


async def auto_check_smart_place(naver_place_id: str) -> dict:
    """
    네이버 플레이스 모바일 페이지를 Playwright로 자동 진단.

    Returns:
        {
            is_smart_place: bool,
            has_faq: bool,           # [DEPRECATED] 항상 False
            has_recent_post: bool,
            has_intro: bool,
            has_reservation: bool,   # [P1-B-1] 네이버 예약 연동 여부 (점수 미반영)
            photo_count: int,        # [P1-B-2] 등록 사진 수 추정 (점수 미반영)
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
        async with _get_playwright_sem():
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
        "has_reservation": False,
        "photo_count": None,
        "visitor_review_count": 0,
        "avg_rating": None,
        "intro_text": "",
        "score_loss": 70,
        "action_links": {"register": "https://smartplace.naver.com/"},
        "error": error_code,
    }


def _detect_visitor_review_count(home_text: str) -> int:
    """홈 탭 텍스트에서 리뷰 수를 추출. 0이면 미감지.

    Naver 실측 (2026-06-20): 홈 탭에 "[업종]리뷰 N" 형식으로 표시됨.
    예: "돼지고기구이리뷰 202" → 리뷰 + 공백 + 숫자 패턴으로 202 추출.
    """
    _patterns = [
        # 실측: "돼지고기구이리뷰 202" — 업종명+리뷰 뒤 공백+숫자
        r"리뷰\s+(\d[\d,]+)",
        r"방문자\s*리뷰\s*(\d[\d,]*)",
        r"방문자리뷰\s*(\d[\d,]*)",
        r"리뷰\s*(\d[\d,]+)\s*개",
        r"(\d[\d,]+)\s*개\s*리뷰",
        r"방문자\s+(\d[\d,]+)",
    ]
    for pat in _patterns:
        m = re.search(pat, home_text)
        if m:
            try:
                return int(m.group(1).replace(",", ""))
            except ValueError:
                pass
    return 0


def _detect_avg_rating(home_text: str) -> "float | None":
    """홈 탭 텍스트에서 별점/평점을 추출. None이면 미감지 (0.0 오표시 방지)."""
    _patterns = [
        r"별점\s*(\d+(?:\.\d{1,2})?)",
        r"평점\s*(\d+(?:\.\d{1,2})?)",
    ]
    for pat in _patterns:
        m = re.search(pat, home_text)
        if m:
            try:
                val = float(m.group(1))
                if 0.0 < val <= 5.0:
                    return val
            except ValueError:
                pass
    return None


async def _run_check(naver_place_id: str) -> dict:
    """실제 Playwright 크롤링 — 3개 탭(home/feed/info) 순차 방문"""
    base_url = f"https://m.place.naver.com/place/{naver_place_id}"
    # 2026-04-30 표준 URL: /place/ 경로 (구 /restaurant/는 deprecated 위험)

    results = {
        "is_smart_place": False,
        "has_faq": False,
        "has_recent_post": False,
        "recent_post_measured": True,   # False = 차단으로 측정 불가
        "has_intro": False,
        "has_reservation": False,
        "photo_count": None,      # 감지 성공 시 int, 미감지 시 None (프론트 "0장" 오표시 방지)
        "visitor_review_count": 0,
        "avg_rating": None,       # 감지 성공 시 float, 미감지 시 None
        "intro_text": "",
    }

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
            proxy=_get_proxy_config(),
        )
        ctx = await browser.new_context(
            locale="ko-KR",
            timezone_id="Asia/Seoul",
            user_agent=_get_random_ua(),
            viewport={"width": 412, "height": 915},
        )
        page = await ctx.new_page()
        await _apply_stealth(page)
        try:
            _NAVER_IP_BLOCK = "플레이스 서비스 이용이 제한"
            # ── 1단계: 홈 탭 — 페이지 정상 로드 여부 + 예약 감지 + 사진 수 ──
            try:
                await page.goto(
                    f"{base_url}/home",
                    timeout=_PAGE_TIMEOUT_MS,
                    wait_until="domcontentloaded",
                )
                await page.wait_for_timeout(1500)
                home_text = (await page.inner_text("body"))[:15000] or ""
                # IP 차단 감지 — 차단 시 photo/review 등 감지 불가이므로 early return
                if _NAVER_IP_BLOCK in home_text:
                    _logger.warning(f"smart_place home tab blocked (IP restriction) [{naver_place_id}]")
                    return {
                        **results,
                        "score_loss": _calc_score_loss(results),
                        "action_links": _build_action_links(naver_place_id, results),
                        "error": "ip_blocked",
                    }
                # "삭제된 업체" / "존재하지 않는" 메시지 차단 — 그 외엔 등록된 것으로 판정
                if home_text and not re.search(
                    r"(존재하지 않|삭제|찾을 수 없|페이지를 찾을 수 없)", home_text
                ):
                    results["is_smart_place"] = True
                # [P1-B-1] 예약 연동 여부 감지 (홈 탭에서 처리 — 별도 탭 이동 불필요)
                results["has_reservation"] = await _detect_reservation(page, home_text)
                # [P1-B-2] 사진 수 추정 (홈 탭 텍스트·DOM 기반 — 별도 탭 이동 불필요)
                results["photo_count"] = await _detect_photo_count(page, home_text)
                # 방문자 리뷰 수·별점 추출 (홈 탭 텍스트 — Playwright 추가 호출 없음)
                results["visitor_review_count"] = _detect_visitor_review_count(home_text)
                results["avg_rating"] = _detect_avg_rating(home_text)
            except Exception as e:
                _logger.warning(f"smart_place home tab failed [{naver_place_id}]: {e}")
                # 홈 탭 실패 = 미등록 판정으로 종료
                return {
                    **results,
                    "score_loss": _calc_score_loss(results),
                    "action_links": _build_action_links(naver_place_id, results),
                    "error": "home_load_failed",
                }

            # ── 2단계: 소식 탭 — 최근 90일 내 게시물 ───────────────────
            try:
                await page.goto(
                    f"{base_url}/feed",
                    timeout=_PAGE_TIMEOUT_MS,
                    wait_until="domcontentloaded",
                )
                await page.wait_for_timeout(1500)
                feed_text = (await page.inner_text("body")) or ""
                if _NAVER_IP_BLOCK in feed_text:
                    _logger.warning(f"smart_place feed tab blocked (IP restriction) [{naver_place_id}]")
                    results["recent_post_measured"] = False
                else:
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
                results["intro_text"] = _extract_intro_text(info_text)
                # has_faq는 _calc_score_loss/_build_action_links에서 미사용. 항상 False.
            except Exception as e:
                _logger.warning(f"smart_place information tab skipped [{naver_place_id}]: {e}")

            # ── 4단계: 사진 탭 — 전체 사진 수 정확 파악 ────────────────────────
            # 사진 탭은 JS 비동기 로딩. networkidle 대기 후 숫자 패턴 추출.
            try:
                await page.goto(
                    f"{base_url}/photo",
                    timeout=_PAGE_TIMEOUT_MS,
                    wait_until="networkidle",
                )
                await page.wait_for_timeout(1500)
                photo_body = (await page.inner_text("body")) or ""
                # 네트워크 오류·IP 차단 감지 — 오류 시 기존 값 유지 (잘못된 숫자 방지)
                if re.search(r"네트워크 오류|Failed to fetch|일시적인.*오류", photo_body) or _NAVER_IP_BLOCK in photo_body:
                    _logger.warning(f"[smart_place] photo tab network error [{naver_place_id}]")
                else:
                    # "전체 N" 패턴 (사진 탭 필터 버튼)
                    m_total = re.search(r"전체\s*([\d,]+)", photo_body)
                    if m_total:
                        tab_total = int(m_total.group(1).replace(",", ""))
                        if tab_total > 0:
                            results["photo_count"] = tab_total
                            _logger.info(
                                f"[smart_place] photo_count updated from photo tab: {tab_total} [{naver_place_id}]"
                            )
                    elif not results["photo_count"]:
                        # "사진 N" 패턴 fallback
                        m_photo = re.search(r"사진\s*([\d,]+)", photo_body)
                        if m_photo:
                            tab_total = int(m_photo.group(1).replace(",", ""))
                            if tab_total > 0:
                                results["photo_count"] = tab_total
                                _logger.info(
                                    f"[smart_place] photo_count from photo tab text: {tab_total} [{naver_place_id}]"
                                )
            except Exception as e:
                _logger.warning(f"smart_place photo tab skipped [{naver_place_id}]: {e}")

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

_RECENT_POST_DAYS = 90  # naver_place_stats.py와 동일 기준


def _detect_recent_post(feed_body: str) -> bool:
    """소식 탭 본문에서 최근 90일 내 게시물 존재 여부 추정.

    - "N일 전" / "N시간 전" 표시: 최근 = True
    - "N개월 전": N*30 <= 90이면 True (1·2·3개월 전 포함), "N년 전": 오래됨 = False
    - 절대 날짜(YYYY.MM.DD): 90일 이내 판정
    - "등록된 소식이 없습니다" / "최근 소식이 없습니다": False
    """
    if not feed_body:
        return False
    if re.search(r"(등록된 소식이 없|소식이 없|게시물이 없)", feed_body):
        return False

    # "N시간 전" / "N분 전" / "방금" → 무조건 최근
    if re.search(r"(\d+\s*시간\s*전|\d+\s*분\s*전|방금)", feed_body):
        return True
    # "오늘" / "어제" — 영업시간 문구 오탐 방지
    if re.search(r"오늘|어제", feed_body) and not re.search(
        r"오늘\s*(영업|운영|휴무|휴일|오픈|닫|쉬)", feed_body
    ):
        return True
    days = [int(d) for d in re.findall(r"(\d+)\s*일\s*전", feed_body)]
    if days:
        return any(d <= _RECENT_POST_DAYS for d in days)
    # "N개월 전" — 1개월=30일, 2개월=60일, 3개월=90일 이내 → True
    months = [int(m) for m in re.findall(r"(\d+)\s*개월\s*전", feed_body)]
    if months:
        return any(m * 30 <= _RECENT_POST_DAYS for m in months)

    # 절대 날짜 (YYYY.MM.DD 또는 YYYY-MM-DD) — 90일 이내면 최근
    today = datetime.now(timezone.utc).date()
    for m in re.finditer(r"(20\d{2})[./\-](\d{1,2})[./\-](\d{1,2})", feed_body):
        try:
            d = datetime(
                int(m.group(1)), int(m.group(2)), int(m.group(3)), tzinfo=timezone.utc
            ).date()
            if (today - d) <= timedelta(days=_RECENT_POST_DAYS):
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


def _extract_intro_text(info_body: str) -> str:
    """정보 탭 본문에서 소개글 텍스트 추출. 없으면 빈 문자열 반환."""
    if not info_body:
        return ""
    m = re.search(r"(업체\s*소개|소개)[\s\S]{0,1500}", info_body)
    if not m:
        return ""
    block = m.group(0)
    cleaned = re.sub(r"(업체\s*소개|소개)\s*", "", block, count=1).strip()
    # 1500자 이상이면 잘라내기 (분석용으로 충분)
    return cleaned[:1500]


# DEPRECATED 2026-05-01: 스마트플레이스 Q&A 탭 폐기로 미사용. 호출처 0건.
# 재도입 시 /profile 경로 사용할 것.
def _detect_faq(info_body: str) -> bool:
    """[DEPRECATED 2026-05-01] FAQ 감지 — 호출 제거됨.
    스마트플레이스 사장님 Q&A 탭(/qna) 폐기로 인해 사용처 제거. 함수만 하위 호환을 위해 잔존.
    항상 False 반환.
    """
    return False


# ── P1-B 신규 감지 함수 ──────────────────────────────────────────────────

async def _detect_reservation(page, home_text: str) -> bool:
    """[P1-B-1] 홈 탭에서 네이버 예약 연동 여부 추정.

    점수 미반영 — AI탭 개선 행동 안내 전용.
    1. 텍스트에서 강한 신호("네이버 예약" / "예약하기") 검출
    2. DOM 셀렉터 확인 (추정 셀렉터 — 네이버 스마트플레이스 UI 변경 시 수정 필요)
    """
    # 1. 본문 텍스트에서 예약 기능 강한 신호 추출
    if re.search(r"네이버\s*예약|예약하기", home_text):
        return True
    # 2. DOM 셀렉터 (추정 — 실측 후 수정 권장, §5 모니터링 참조)
    try:
        for sel in [
            "a[href*='/booking']",
            "button[aria-label*='예약']",
            ".booking_btn",
            "a[data-type='reservation']",
        ]:
            if await page.query_selector(sel):
                return True
    except Exception:
        _logger.warning("smart_place: reservation DOM check failed → text-only result")
    return False


async def _detect_photo_count(page, home_text: str) -> "int | None":
    """[P1-B-2] 홈 탭에서 등록 사진 수 추정.

    점수 미반영 — 10장 미만 시 AI탭 품질 향상 안내 전용.
    Naver 실측 (2026-06-20): 홈 탭 텍스트에 사진 수 미포함. 사진 탭은 JS 비동기 로딩
    으로 inner_text()로 접근 불가("로딩중" 상태 8s 이상 유지).
    감지 불가 시 None 반환 — 프론트가 "0장" 오표시 방지.
    """
    # 1. 탭 버튼에 표시된 사진 수 "사진 N" 패턴 추출 (콤마 포함 숫자 지원)
    m = re.search(r"사진\s*(\d[\d,]+)", home_text)
    if m:
        try:
            val = int(m.group(1).replace(",", ""))
            if val > 0:
                return val
        except ValueError:
            pass
    # 2. "N장" 형태 (예: "15장 등록")
    m2 = re.search(r"(\d[\d,]+)\s*장", home_text)
    if m2:
        try:
            val = int(m2.group(1).replace(",", ""))
            if val > 0:
                return val
        except ValueError:
            pass
    return None  # 감지 불가 — 프론트에서 표시 안 함
