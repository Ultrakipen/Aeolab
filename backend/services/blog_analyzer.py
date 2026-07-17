"""
블로그 URL 분석 서비스

- 네이버 블로그: 네이버 검색 API blog.json 사용 (직접 크롤링 절대 금지 — robots.txt 위반)
- 외부 블로그(티스토리/워드프레스/기타): aiohttp fetch + HTML 파싱
- 분석 항목: 포스트 수, 최신성, 키워드 커버리지, AI 브리핑 인용 가능성
"""
import re
import os
import asyncio
import difflib
import ipaddress
import logging
import xml.etree.ElementTree as ET
from datetime import date, datetime
from email.utils import parsedate_to_datetime
from typing import Optional
from urllib.parse import urlparse, urljoin

import aiohttp

from services.keyword_taxonomy import KEYWORD_TAXONOMY

_logger = logging.getLogger("aeolab")


# ── SSRF 방지 ─────────────────────────────────────────────────────────────────

# 허용된 외부 도메인 화이트리스트 (naver 검색 API — _analyze_naver_blog 전용)
_NAVER_API_HOST = "openapi.naver.com"

# 외부 블로그 허용 호스트 접미사 (티스토리·워드프레스·기타 공개 블로그)
_ALLOWED_BLOG_SUFFIXES = (
    ".tistory.com",
    ".wordpress.com",
    ".blog.me",        # 구 네이버 블로그 (blog.me)
    "blog.naver.com",  # 네이버 블로그 — _analyze_external_blog 경로에서 도달하지 않음
)

def _is_ssrf_blocked(url: str) -> bool:
    """
    SSRF 차단 판정.

    True를 반환하면 해당 URL로의 요청을 차단해야 한다.

    차단 기준:
    1. 스킴이 http/https 가 아닌 경우 (file://, dict://, gopher:// 등)
    2. 호스트가 프라이빗/루프백/링크로컬 IP 주소인 경우
       - 127.0.0.0/8  (loopback)
       - ::1          (IPv6 loopback)
       - 10.0.0.0/8   (private)
       - 172.16.0.0/12 (private)
       - 192.168.0.0/16 (private)
       - 169.254.0.0/16 (link-local / AWS metadata)
       - 100.64.0.0/10 (CGNAT — iwinv 내부망 가능성)
       - fc00::/7      (IPv6 unique local)
       - fe80::/10     (IPv6 link-local)
    3. 포트가 80/443 이외의 명시적 포트인 경우 (내부 서비스 방지)
    """
    try:
        parsed = urlparse(url)
    except Exception:  # noqa: intentional-fallback — URL 파싱 실패 시 SSRF 차단 유지
        return True

    # 1. 스킴 검사
    if parsed.scheme not in ("http", "https"):
        return True

    host = parsed.hostname or ""
    port = parsed.port  # None이면 스킴 기본 포트 사용

    # 2. 비표준 포트 차단 (블로그는 80/443만 허용)
    if port is not None and port not in (80, 443):
        return True

    # 3. IP 주소 직접 접근 차단
    try:
        addr = ipaddress.ip_address(host)
        if (
            addr.is_loopback
            or addr.is_private
            or addr.is_link_local
            or addr.is_reserved
            or addr.is_multicast
            or addr.is_unspecified
        ):
            return True
        # CGNAT 대역 100.64.0.0/10
        if addr.version == 4 and addr in ipaddress.ip_network("100.64.0.0/10"):
            return True
        # IPv6 unique local fc00::/7
        if addr.version == 6 and addr in ipaddress.ip_network("fc00::/7"):
            return True
    except ValueError:
        # 호스트네임 — IP가 아님
        pass

    # 4. 호스트네임에 "localhost" 포함 차단
    if "localhost" in host.lower():
        return True

    return False

_TIMEOUT = aiohttp.ClientTimeout(total=8, connect=5)
# RSS 재시도 전용 — 원 요청보다 짧게 잡아 전체 분석 예산(35초, blog.py _ANALYZE_TIMEOUT_SECONDS)을
# 과도하게 잠식하지 않도록 함 (2026-07-06: 같은 블로그가 90초 내 3회 중 1회 RSS 실패 실측)
_RSS_RETRY_TIMEOUT = aiohttp.ClientTimeout(total=5, connect=3)

# ── 개별 포스트 분석 + 제목 SEO + 주간 액션 ──────────────────────────────────


def _calc_title_seo_score(title: str, region: str, category: str) -> int:
    """제목 SEO 점수 0-100 (4개 항목 각 25점)"""
    score = 0
    # 1. 검색 의도 키워드 포함 (+25)
    intent_kws = ["추천", "리뷰", "후기", "비용", "가격", "비교", "선택", "방법",
                  "총정리", "근처", "맛집", "하는 법", "알아보기", "순위", "BEST"]
    if any(kw in title for kw in intent_kws):
        score += 25
    # 2. 지역명 포함 (+25)
    if region:
        city = re.sub(r"(특별시|광역시|특별자치시|특별자치도|시|도|군|구)$", "", region.strip().split()[0])
        if city and city in title:
            score += 25
    # 3. 적정 길이 15~40자 (+25)
    tlen = len(title)
    if 15 <= tlen <= 40:
        score += 25
    # 4. 숫자/구체적 표현 포함 (+25)
    if re.search(r"\d", title) or any(w in title for w in ["TOP", "BEST", "가지", "가격", "원", "분", "곳"]):
        score += 25
    return score


def _analyze_single_post(
    item: dict,
    post_date: Optional[date],
    region: str,
    category: str,
    covered_keywords: list[str],
) -> dict:
    """개별 포스트 분석 — 점수, 문제점, 개선 제안, 제목 개선안

    "검색 키워드"는 두 종류를 구분해서 체크:
    - 업종 키워드 (웨딩스냅/돌잔치 스냅/프로필 촬영 등) — AI가 업종 인식용
    - 검색 의도어 (추천/후기/비교/가격/방법 등) — AI 브리핑이 "정보성 글"로 분류
    AI 브리핑은 둘 다 있는 글을 우선 인용한다.
    """
    title = item.get("title", "")
    desc = item.get("desc", "")
    link = item.get("link", "")
    text = f"{title} {desc}"
    text_len = item.get("full_text_len", -1)

    issues: list[str] = []
    positives: list[str] = []
    score = 100  # 감점 방식

    # 제목 SEO 점수
    title_seo = _calc_title_seo_score(title, region, category)

    # 1) 업종 키워드 포함 여부 — 긍정 피드백
    matched_industry_kws = [kw for kw in covered_keywords if kw in title]
    if matched_industry_kws:
        sample = matched_industry_kws[0]
        positives.append(f"업종 키워드 포함 ('{sample}')")

    # RSS 전용 구조 정보 → 양수일 때만 positives 추가
    _img = item.get("img_count", -1)
    _hdg = item.get("heading_count", -1)
    _htg = item.get("hashtag_count", -1)
    _vid = item.get("video_count", -1)
    if isinstance(_img, int) and _img > 0:
        positives.append(f"이미지 {_img}장 포함")
    if isinstance(_hdg, int) and _hdg > 0:
        positives.append("소제목(H2~H4) 있음")
    if isinstance(_htg, int) and _htg > 0:
        positives.append(f"해시태그 {_htg}개 포함")
    if isinstance(_vid, int) and _vid > 0:
        positives.append("동영상 포함")

    # 2) 검색 의도어 포함 여부 — 누락 시 AI 인용률 저하
    intent_kws = ["추천", "리뷰", "후기", "비용", "가격", "비교", "선택", "방법",
                  "총정리", "근처", "맛집", "하는 법", "알아보기", "순위", "BEST"]
    matched_intent = [kw for kw in intent_kws if kw in title]
    if not matched_intent:
        issues.append("검색 의도어 없음 (추천/후기/비교)")
        score -= 15
    else:
        positives.append(f"검색 의도어 포함 ('{matched_intent[0]}')")

    if text_len >= 0 and text_len < 300:
        issues.append(f"본문 300자 미만 (현재 {text_len}자)")
        score -= 15

    if region:
        city = re.sub(r"(특별시|광역시|특별자치시|특별자치도|시|도|군|구)$", "", region.strip().split()[0])
        if city and city not in text:
            issues.append("지역명 미포함")
            score -= 10

    if post_date:
        days_old = (date.today() - post_date).days
        if days_old > 90:
            issues.append(f"90일 이상 오래된 글 ({days_old}일)")
            score -= 20

    # 홍보성 제목 체크
    promo_patterns = ["완료", "촬영됐", "다녀왔", "완성", "!!", "💕", "❤️", "🌸"]
    if any(p in title for p in promo_patterns):
        issues.append("홍보성 제목 — 정보형으로 변경 권장")
        score -= 10

    score = max(score, 0)

    # 개선 제안 1줄 — 업종 키워드는 인정하면서 의도어 추가를 권장
    suggestion = ""
    if "검색 의도어 없음 (추천/후기/비교)" in issues:
        if matched_industry_kws:
            ikw = matched_industry_kws[0]
            suggestion = (
                f"업종 키워드 '{ikw}'는 들어 있습니다. "
                "제목 끝에 '추천·후기·비교' 같은 검색 의도어를 추가하면 AI 검색 인용률이 올라갑니다."
            )
        else:
            suggestion = "제목에 업종 키워드(예: 웨딩스냅)와 검색 의도어(추천/후기/비교)를 함께 넣으세요"
    elif "지역명 미포함" in issues:
        suggestion = f"제목이나 본문에 '{region.strip().split()[0]}'을 자연스럽게 포함하세요"
    elif "홍보성 제목" in " ".join(issues):
        suggestion = "포트폴리오형 제목을 정보형('추천', '비교', '총정리')으로 바꾸면 AI 인용률이 올라갑니다"
    elif "90일 이상" in " ".join(issues):
        suggestion = "이 글에 최신 정보를 추가하고 날짜를 업데이트하세요"
    elif "본문 300자 미만" in " ".join(issues):
        if item.get("source") == "api":
            suggestion = "본문 길이를 직접 확인할 수 없어 정확한 측정이 어렵습니다. 실제 경험과 구체적 정보를 300자 이상 작성하는 것을 권장합니다."
        else:
            suggestion = "본문에 실제 경험, 가격, 위치 등 구체적 정보를 300자 이상으로 보강하세요"
    elif not issues:
        suggestion = "잘 작성된 포스트입니다. 꾸준히 이 패턴을 유지하세요."

    # 개선 제목 제안 — issues를 전달해 문제 유형에 맞는 접미사 선택
    improved_title = _improve_title(title, region, category, covered_keywords, issues=issues)

    return {
        "title": title,
        "link": link,
        "date": post_date.isoformat() if post_date else None,
        "post_score": score,
        "title_seo_score": title_seo,
        "issues": issues,
        "positives": positives,
        "suggestion": suggestion,
        "improved_title": improved_title,
        # 구조 필드 (프론트 활용용 — RSS: 실측값, API: -1)
        "img_count": item.get("img_count", -1),
        "heading_count": item.get("heading_count", -1),
        "full_text_len": item.get("full_text_len", -1),
        "video_count": item.get("video_count", -1),
    }


# 업종 키워드가 제목에 없을 때 사용하는 범용 의도어 접미사
# category-specific "수강/레슨" 등이 무관한 제목에 삽입되는 것을 방지
_GENERIC_INTENT_SUFFIX: list[str] = [
    "추천 | 후기·비용",
    "선택 기준 | 가격 비교",
    "총정리 | 가격·후기",
    "가격·일정 총정리",
    "알아보기 | 후기",
    "비용 총정리",
]

# 검색 의도어 없음 → 업종별 의도어 변형 목록 (업종 키워드가 제목에 있을 때만 사용)
# 변형 6개로 확장 — hash 분산 개선으로 포스트별 중복 감소
_INTENT_SUFFIX: dict[str, list[str]] = {
    "photo":      [
        "추천 | 가격·예약·후기", "잘 찍는 곳 | 비용 비교", "선택 기준 | 후기",
        "촬영 비용 총정리", "예약 방법 | 가격 안내", "후기·비용 비교",
    ],
    "restaurant": [
        "맛집 추천 | 메뉴·주차", "가격·예약 비교", "선택 기준 | 메뉴",
        "메뉴·가격 총정리", "주차·예약 안내", "후기 | 가격 비교",
    ],
    "cafe":       [
        "카페 추천 | 분위기·가격", "공부하기 좋은 곳 | 와이파이·주차", "가격·메뉴 비교",
        "분위기·메뉴 총정리", "콘센트·주차 안내", "후기 | 가격 비교",
    ],
    "beauty":     [
        "추천 | 가격·후기", "잘하는 곳 | 시술 비교", "가격·예약 총정리",
        "시술 가격 비교", "예약 방법 | 후기", "시술 종류·비용 안내",
    ],
    "clinic":     [
        "추천 | 비용·예약", "진료시간·비용 비교", "잘 보는 곳 | 후기",
        "진료비 총정리", "예약 방법 | 비용 안내", "야간·주말 진료 안내",
    ],
    "academy":    [
        "수강 추천 | 후기·비용", "레슨 추천 | 가격 비교", "클래스 추천 | 커리큘럼·비용",
        "학원 선택 기준 | 비용 총정리", "수업료 비교 | 후기", "체험 수업 | 비용 안내",
    ],
    "fitness":    [
        "추천 | 가격·시설", "PT 추천 | 비용·후기", "이용권 비교 | 가격",
        "헬스장 선택 기준", "PT 가격 총정리", "시설·가격 비교",
    ],
    "pet":        [
        "추천 | 진료비·예약", "동물병원 추천 | 후기·비용", "진료비 비교 | 후기",
        "진료비 총정리", "예약 방법 | 비용 안내", "잘 보는 곳 | 후기",
    ],
    "legal":      [
        "상담 추천 | 비용", "변호사 추천 | 수임료 비교", "무료 상담 | 후기",
        "상담 비용 총정리", "선택 기준 | 후기", "수임료 비교 안내",
    ],
    "shopping":   [
        "추천 | 가격·후기", "구매 가이드 | 비용 비교", "선택 기준 | 가격",
        "가격 비교 총정리", "구매 전 확인할 것", "후기·가격 안내",
    ],
}

# 홍보성 제목 → 정보형으로 전환 (업종별 핵심 비교 정보 변형 목록)
# 변형 6개로 확장
_PROMO_SUFFIX: dict[str, list[str]] = {
    "photo":      [
        "가격·준비물 총정리", "비용·예약 총정리", "스튜디오 비교",
        "촬영 비용 안내", "예약 방법 정리", "후기·비용 비교",
    ],
    "restaurant": [
        "메뉴·가격 총정리", "예약·주차 총정리", "메뉴 비교",
        "가격·영업시간 안내", "주차 방법 정리", "후기·가격 비교",
    ],
    "cafe":       [
        "분위기·메뉴 총정리", "가격·좌석 총정리", "메뉴 비교",
        "영업시간·주차 안내", "콘센트·와이파이 정리", "후기·가격 비교",
    ],
    "beauty":     [
        "시술 가격·소요시간 총정리", "가격·예약 총정리", "시술 비교",
        "시술 종류·비용 안내", "예약 방법 정리", "후기·가격 비교",
    ],
    "clinic":     [
        "진료시간·비용 총정리", "비용·예약 총정리", "진료비 비교",
        "진료과목·비용 안내", "예약 방법 정리", "야간 진료 안내",
    ],
    "academy":    [
        "수강료·체험수업 비교", "커리큘럼·비용 총정리", "체험수업 신청 방법",
        "수강료 비교 안내", "커리큘럼 정리", "무료 체험 신청 방법",
    ],
    "fitness":    [
        "가격·이용권 총정리", "PT 비용·시설 비교", "이용권 비교",
        "PT 가격 안내", "시설 둘러보기 정리", "등록 방법·비용",
    ],
    "pet":        [
        "진료비·후기 총정리", "비용·예약 총정리", "진료비 비교",
        "진료과목·비용 안내", "예약 방법 정리", "진료시간 안내",
    ],
    "legal":      [
        "비용·상담 총정리", "수임료·후기 비교", "무료 상담 안내",
        "상담 비용 안내", "수임료 정리", "초기 상담 방법",
    ],
    "shopping":   [
        "가격·배송 총정리", "후기·가격 비교", "구매 가이드",
        "배송·반품 안내", "가격 비교 정리", "구매 전 확인사항",
    ],
}


def _improve_title(
    title: str,
    region: str,
    category: str,
    covered_keywords: list[str],
    issues: list[str] | None = None,
) -> str:
    """
    기존 제목을 AI 인용에 유리하게 개선한 제목 생성.

    접미사는 각 포스트의 실제 문제(issues)에 따라 선택:
    - 검색 의도어 없음 → 업종별 의도어 접미사 (_INTENT_SUFFIX)
    - 홍보성 제목 → 정보형 전환 접미사 (_PROMO_SUFFIX)
    - 지역명/날짜/본문 문제 → 제목 수정보다 본문 개선이 맞아 접미사 최소화
    """
    if not title:
        return ""

    # 이미 정보형이면 그대로 (변경 불필요 신호로 원 제목 반환)
    info_kws = ["추천", "비교", "총정리", "비용", "가격", "선택 기준", "BEST", "순위"]
    if any(kw in title for kw in info_kws):
        return title

    city = ""
    if region:
        city = re.sub(r"(특별시|광역시|특별자치시|특별자치도|시|도|군|구)$", "", region.strip().split()[0])

    # 카테고리 정규화
    try:
        from services.keyword_taxonomy import normalize_category
        norm_cat = normalize_category(category)
    except Exception as exc:
        _logger.warning("blog_analyzer: normalize_category 실패 → 원본 키 사용 (%s)", exc)
        norm_cat = category

    # 포스트별 문제 파악 — issues를 사용하고, 없으면 제목에서 직접 감지
    issues = issues or []
    missing_intent = any("검색 의도어 없음" in iss for iss in issues)
    is_promo = any("홍보성 제목" in iss for iss in issues)

    # issues가 비어 있을 때(외부 호출) 폴백으로 직접 감지
    if not issues:
        intent_kws = ["추천", "리뷰", "후기", "비용", "가격", "비교", "방법", "총정리", "근처"]
        missing_intent = not any(kw in title for kw in intent_kws)
        promo_patterns = ["완료", "촬영됐", "다녀왔", "완성", "!!", "💕", "❤️", "🌸"]
        is_promo = any(p in title for p in promo_patterns)

    # 제목에 실제 포함된 업종 키워드 추출 — suffix 선택보다 먼저 계산 (범용 접미사 분기에 필요)
    matched = sorted(
        [kw for kw in (covered_keywords or []) if kw and kw in title],
        key=lambda k: -len(k),
    )

    # 문제 유형에 따른 접미사 선택 — 같은 이슈라도 타이틀 해시로 분산해 반복 방지
    if missing_intent:
        if matched:
            # 업종 키워드가 제목에 있으면 category-specific 접미사 사용
            variants = _INTENT_SUFFIX.get(norm_cat, _GENERIC_INTENT_SUFFIX)
        else:
            # 업종 키워드가 없으면 범용 접미사 사용 — "수강/레슨" 등이 무관한 제목에 삽입되는 것 방지
            variants = _GENERIC_INTENT_SUFFIX
        suffix = variants[abs(hash(title)) % len(variants)]
    elif is_promo:
        variants = _PROMO_SUFFIX.get(norm_cat, ["가격·후기 총정리", "비용 총정리", "비교"])
        suffix = variants[abs(hash(title)) % len(variants)]
    else:
        # 지역명 누락·오래된 글·본문 짧음: 제목 접미사보다 내용 보강이 본질적 해결책
        suffix = "추천"

    # 원 제목 정제 — 이모지·홍보성 수식어·브랜드명(| 뒤쪽) 제거
    clean = re.sub(r"[🌸💕❤️✨~]+", "", title).strip()
    clean = re.sub(r"(촬영됐\w*|다녀왔\w*|완료했\w*|완성했\w*|포토후기)", "", clean)
    clean = clean.split("|")[0].strip()  # 브랜드명 꼬리 제거
    clean = re.sub(r"[!?]+", "", clean)
    clean = re.sub(r"\s+", " ", clean).strip()

    # 지역명이 이미 포함되어 있으면 중복 prefix 방지
    has_city_in_clean = bool(city) and city in clean
    prefix = "" if has_city_in_clean else (f"{city} " if city else "")

    # core 결정: 매칭 키워드 우선, 없으면 원 제목 정제본 (각 포스트 고유성 유지)
    if matched:
        core = " ".join(matched[:2])
    else:
        core = clean

    if not core:
        # 원 제목이 전부 제거되면 지역 + 접미사만
        improved = f"{prefix}{suffix}".strip()
    elif len(core) > 25:
        # 원 제목이 이미 길면 접미사 생략 — 중복 방지 + 가독성 확보
        improved = f"{prefix}{core}".strip()
    else:
        improved = f"{prefix}{core} {suffix}".strip()

    # 원 제목과 동일하면 변경 불필요 신호
    if improved == title:
        return title
    return improved


def _build_weekly_actions(
    posts_analysis: list[dict],
    post_count: int,
    freshness: str,
    missing_keywords: list[str],
    content_issue: Optional[str],
) -> list[dict]:
    """분석 결과 기반 이번 주 우선순위 액션 3개"""
    actions: list[dict] = []

    # 1순위: 가장 오래된 포스트 제목 수정
    old_posts = [p for p in posts_analysis if p.get("date") and p.get("post_score", 100) < 50]
    old_posts.sort(key=lambda p: p.get("post_score", 100))
    if old_posts:
        worst = old_posts[0]
        improved = worst.get("improved_title", "")
        if improved and improved != worst.get("title", ""):
            actions.append({
                "priority": 1,
                "action": f"포스트 '{worst['title'][:20]}...' 제목을 '{improved[:25]}...'로 수정",
                "impact": "high",
                "reason": "AI가 인용하기 어려운 제목입니다",
            })

    # 2순위: 누락 키워드로 신규 포스트 작성
    if missing_keywords:
        top_kw = missing_keywords[0]
        actions.append({
            "priority": len(actions) + 1,
            "action": f"'{top_kw}' 키워드로 새 포스트 1개 작성",
            "impact": "high",
            "reason": f"이 키워드가 블로그에 없어 AI 검색 노출에서 누락됩니다",
        })

    # 3순위: 최신성 문제
    if freshness in ("outdated", "stale") and post_count > 0:
        actions.append({
            "priority": len(actions) + 1,
            "action": "이번 주 안에 포스트 1개를 올려 최신성을 회복하세요",
            "impact": "high" if freshness == "outdated" else "medium",
            "reason": "AI는 오래된 블로그를 신뢰하지 않습니다",
        })

    # 4순위: 홍보형 비율이 높은 경우 — content_issue 원문(비율·"네이버 검색 노출에도 불리"
    # 문구 포함, 2026-07-07 신설)을 그대로 노출한다. 과거엔 이 필드가 트리거 조건으로만
    # 쓰이고 실제 문구는 화면 어디에도 표시되지 않아 신설 취지가 무효화돼 있었음(2026-07-15 발견).
    if content_issue and "홍보형" in content_issue:
        actions.append({
            "priority": len(actions) + 1,
            "action": "다음 3개 포스트는 '추천', '비교', '총정리' 형식으로 작성",
            "impact": "medium",
            "reason": content_issue,
        })

    # 5순위: 지역명 미포함 포스트 개선
    no_region = [p for p in posts_analysis if "지역명 미포함" in (p.get("issues") or [])]
    if len(no_region) >= 3:
        actions.append({
            "priority": len(actions) + 1,
            "action": f"최근 포스트 {min(len(no_region), 3)}개에 지역명 추가",
            "impact": "medium",
            "reason": "지역명이 없으면 로컬 AI 검색에서 인용되지 않습니다",
        })

    # 최대 3개 반환
    actions.sort(key=lambda a: a["priority"])
    return actions[:3]


def _calc_posting_frequency(post_dates: list) -> dict:
    """발행 주기 분석 — 월별 히트맵 + 일관성 지표"""
    from collections import defaultdict

    today = date.today()
    valid_dates = [d for d in post_dates if d is not None]

    # 최근 6개월 월별 카운트
    monthly_counts: dict[str, int] = {}
    for i in range(6):
        # 최근 6개월 키 생성 (역순)
        month_offset = i
        year = today.year
        month = today.month - month_offset
        while month <= 0:
            month += 12
            year -= 1
        key = f"{year:04d}-{month:02d}"
        monthly_counts[key] = 0

    for d in valid_dates:
        key = f"{d.year:04d}-{d.month:02d}"
        if key in monthly_counts:
            monthly_counts[key] = monthly_counts.get(key, 0) + 1

    # 평균 발행 간격 계산
    avg_interval_days = 0.0
    if len(valid_dates) >= 2:
        sorted_dates = sorted(valid_dates)
        intervals = [(sorted_dates[i + 1] - sorted_dates[i]).days for i in range(len(sorted_dates) - 1)]
        avg_interval_days = round(sum(intervals) / len(intervals), 1) if intervals else 0.0

    # 일관성 판정
    total_months = len(monthly_counts)
    active_months = sum(1 for v in monthly_counts.values() if v > 0)
    monthly_avg = sum(monthly_counts.values()) / max(total_months, 1)

    counts_list = sorted(monthly_counts.values(), reverse=True)
    total_count = sum(counts_list) or 1
    max_single = counts_list[0] if counts_list else 0
    is_bursty = max_single >= 5 and (max_single / total_count) > 0.4

    if monthly_avg >= 2 and is_bursty:
        consistency = "bursty"
        consistency_message = "특정 시기에 몰아서 발행했습니다 — 네이버가 어뷰징(저품질)으로 오인할 수 있는 패턴입니다. 매월 2~3개씩 고르게 발행하면 AI 검색 신뢰도가 높아집니다."
    elif monthly_avg >= 2:
        consistency = "active"
        consistency_message = "꾸준히 발행하고 있습니다. 월 2회 이상 발행으로 AI 검색 노출을 유지하세요."
    elif monthly_avg >= 1:
        consistency = "regular"
        consistency_message = "월 1회 발행 중. 월 2회로 늘리면 AI 인용률이 높아집니다."
    elif active_months >= 2:
        consistency = "irregular"
        consistency_message = "발행이 불규칙합니다. AI는 꾸준한 블로그를 더 신뢰합니다."
    else:
        consistency = "inactive"
        consistency_message = "3달 이상 포스트가 없습니다. 지금 당장 1개 발행이 필요합니다."

    # 다음 권장 발행일
    last_date = max(valid_dates) if valid_dates else None
    if last_date and avg_interval_days > 0:
        from datetime import timedelta
        next_date = last_date + timedelta(days=int(avg_interval_days))
    else:
        from datetime import timedelta
        next_date = today + timedelta(days=7)

    return {
        "monthly_counts": monthly_counts,
        "total_analyzed": len(valid_dates),
        "avg_interval_days": avg_interval_days,
        "consistency": consistency,
        "recommended_posts_per_month": 2,
        "recommended_next_date": next_date.isoformat(),
        "consistency_message": consistency_message,
    }


def _pick_best_citation_candidate(posts_detail: list[dict], region: str) -> Optional[dict]:
    """AI 인용 예측 포스트 1개 픽 — post_score 최고, 동점 시 title_seo_score 우선"""
    if not posts_detail:
        return None

    sorted_posts = sorted(
        posts_detail,
        key=lambda p: (p.get("post_score", 0), p.get("title_seo_score", 0)),
        reverse=True,
    )
    best = sorted_posts[0]
    issues = best.get("issues", [])

    # what_to_add 결정
    what_to_add = ""
    if any("검색 의도어 없음" in iss for iss in issues):
        what_to_add = "제목에 '추천' 또는 '후기'를 추가하세요 (5분 내 수정 가능)"
    elif any("지역명 미포함" in iss for iss in issues):
        region_label = region.strip().split()[0] if region else "지역명"
        what_to_add = f"제목이나 첫 문장에 '{region_label}' 지역명을 추가하세요"
    elif any("90일 이상 오래된" in iss for iss in issues):
        what_to_add = "포스트 본문에 '업데이트' 날짜와 최신 정보를 한 줄 추가하세요"
    elif any("본문 300자 미만" in iss for iss in issues):
        what_to_add = "본문에 실제 가격, 주소, 예약 방법을 추가해 300자 이상으로 늘리세요"
    else:
        what_to_add = "이미 좋은 포스트입니다. 이달 안에 비슷한 형식으로 1개 더 작성하세요."

    return {
        "title": best.get("title", ""),
        "link": best.get("link", ""),
        "post_score": best.get("post_score", 0),
        "title_seo_score": best.get("title_seo_score", 0),
        "what_to_add": what_to_add,
        "reason": "현재 블로그에서 AI 검색 인용 가능성이 가장 높은 포스트입니다",
    }


def _detect_duplicate_topics(posts_detail: list[dict]) -> list[dict]:
    """중복 주제 경고 — 하이브리드 방식(taxonomy 1차 + 공백 분리 단어 2차).

    슬라이딩 윈도우(2글자) 방식 금지: 한국어 부분 문자열 오탐 발생
    (예: '완성하는' → '성하' 오검출).

    1차: taxonomy 업종 키워드 정확 매칭
    2차: 공백 기준 단어 분리 후 3글자+ 의미 단어만 추출 (문법 어미 필터링)
    """
    from collections import defaultdict

    # 한국어 문법 어미/조사 — 이걸로 끝나는 토큰은 의미 없는 동사/형용사 활용형
    _GRAMMAR_ENDINGS = {
        "하는", "이는", "하고", "하여", "하며", "하기", "해서", "하면", "하다",
        "된다", "이다", "하지", "으로", "에서", "에게", "부터", "까지", "에는",
        "로는", "서는", "이나", "거나", "대한", "위한", "통한", "관한", "따른",
        "있는", "없는", "같은", "많은", "이후", "이전", "이상", "이하", "위해",
        "통해", "인한", "중인", "완성", "만들", "제작", "진행", "시작", "완료",
    }
    # 검색 의도어 — 이 단어 자체가 중복 주제로 오탐되면 "후기 후기" 같은 말이 제안에 나옴
    _INTENT_WORDS = {
        "추천", "리뷰", "후기", "비용", "가격", "비교", "선택", "방법", "총정리",
        "근처", "어디서", "안내", "정보", "꿀팁", "할인", "이벤트", "쿠폰",
    }

    # 1차: taxonomy 전체 키워드 수집 (길이 내림차순 — 긴 키워드 우선)
    all_taxonomy_keywords: list[str] = []
    for cat_data in KEYWORD_TAXONOMY.values():
        for sub in cat_data.values():
            if isinstance(sub, dict) and "keywords" in sub:
                all_taxonomy_keywords.extend(sub["keywords"])
    seen_kw: set[str] = set()
    unique_kws: list[str] = []
    for kw in sorted(all_taxonomy_keywords, key=len, reverse=True):
        if kw not in seen_kw and len(kw) >= 2:
            seen_kw.add(kw)
            unique_kws.append(kw)

    groups: dict[str, list[dict]] = defaultdict(list)

    for p in posts_detail:
        title = p.get("title", "")
        matched_in_post: set[str] = set()

        # 1차: taxonomy 키워드 정확 매칭
        for kw in unique_kws:
            if kw in title and kw not in matched_in_post:
                matched_in_post.add(kw)
                groups[kw].append(p)

        # 2차: 공백 분리 토큰 중 2글자+ 의미 단어 (문법 어미/검색 의도어 제외)
        # 공백 기준 분리이므로 "성하"(완성하는 부분문자열) 같은 오탐 구조적으로 불가
        tokens = re.sub(r"[|·\-\[\]()「」『』【】]", " ", title).split()
        for tok in tokens:
            tok = re.sub(r"[^\w가-힣]", "", tok)  # 특수문자 제거
            if (
                len(tok) >= 2
                and tok not in matched_in_post
                and tok not in seen_kw          # taxonomy 키워드 중복 방지
                and tok not in _INTENT_WORDS    # 검색 의도어 자체는 주제 키워드 아님
                and not any(tok.endswith(e) for e in _GRAMMAR_ENDINGS)
            ):
                matched_in_post.add(tok)
                groups[tok].append(p)

    result = []
    for keyword, posts in groups.items():
        unique_posts: list[dict] = []
        seen_links: set[str] = set()
        for p in posts:
            link = p.get("link", "") or p.get("title", "")
            if link not in seen_links:
                seen_links.add(link)
                unique_posts.append(p)

        if len(unique_posts) >= 3:
            result.append({
                "keyword": keyword,
                "count": len(unique_posts),
                "titles": [p.get("title", "") for p in unique_posts[:3]],
                "warning": f"'{keyword}' 관련 포스트 {len(unique_posts)}개가 있습니다. AI는 그 중 1개만 인용합니다.",
                "suggestion": f"각 포스트에 '{keyword} 추천', '{keyword} 가격', '{keyword} 후기'처럼 서로 다른 검색 의도어를 붙여 분산하세요.",
            })

    result.sort(key=lambda x: x["count"], reverse=True)
    return result[:5]


def _detect_templated_content(posts_detail: list[dict]) -> list[dict]:
    """제목 구조 유사도 기반 템플릿 반복 탐지.

    _detect_duplicate_topics는 "같은 주제 키워드"를 찾지만, 인명·지명 등 일부 단어만
    바뀌고 문장 구조 전체가 거의 동일한 템플릿 반복(저품질/어뷰징 신호)은 놓친다.
    숫자는 정규화해 비교(날짜·수량 차이는 무시하고 구조만 봄).
    """
    entries = [(i, p.get("title", "").strip()) for i, p in enumerate(posts_detail) if p.get("title", "").strip()]
    warnings = []
    for a in range(len(entries)):
        for b in range(a + 1, len(entries)):
            idx_a, title_a = entries[a]
            idx_b, title_b = entries[b]
            norm_a = re.sub(r"\d+", "#", title_a)
            norm_b = re.sub(r"\d+", "#", title_b)
            ratio = difflib.SequenceMatcher(None, norm_a, norm_b).ratio()
            if ratio >= 0.8:
                warnings.append({
                    "titles": [title_a, title_b],
                    "similarity": round(ratio * 100),
                    "warning": f"제목 구조가 {round(ratio * 100)}% 유사한 글이 있습니다 — 같은 템플릿 반복은 네이버가 저품질로 판단할 수 있습니다.",
                    "suggestion": "제목 구성(어순·수식어)을 바꾸거나, 본문에 서로 다른 경험·정보를 담아 차별화하세요.",
                })

    warnings.sort(key=lambda x: x["similarity"], reverse=True)
    return warnings[:3]


def _build_competitor_comparison(
    my_covered_keywords: list[str] = None,
    competitor_comp_keywords: list[dict] = None,
) -> Optional[dict]:
    """경쟁사 블로그 키워드 갭 분석 — competitor_comp_keywords: [{name, comp_keywords}]
    (competitors 테이블의 comp_keywords TEXT[], 실제로 채워지는 유일한 소스).

    2026-07-17: 점수·순위 비교(avg_score/my_rank)는 제거함 — 이를 계산하려면
    경쟁사 블로그 본문을 실제로 분석해야 하는데, 경쟁사는 네이버 플레이스에서
    수집돼 블로그 URL 자체를 모른다(등록 절차 없음). "실시간 구조비교"(§2-B)로
    문서화됐던 게 이 데이터 소스 문제였고, 사용자 확인 결과 우선순위 밖 —
    사용자 본인 블로그의 AI 노출 최적화가 핵심이므로 이 죽은 분기를 걷어냄.
    """
    if not competitor_comp_keywords:
        return None

    comp_all_keywords: set[str] = set()
    comp_blog_kw_map: dict[str, set[str]] = {}

    for ck in competitor_comp_keywords:
        ck_name = ck.get("name", "")
        db_kws = [k for k in (ck.get("comp_keywords") or []) if k]
        if db_kws:
            comp_all_keywords.update(db_kws)
        if ck_name and db_kws:
            comp_blog_kw_map[ck_name] = set(db_kws)

    # 경쟁사에는 있고 내 블로그에는 없는 키워드
    my_covered = set(my_covered_keywords or [])
    competitor_keyword_gaps = list(comp_all_keywords - my_covered)[:10]

    competitor_keyword_detail: list[dict] = []
    for kw in competitor_keyword_gaps:
        kw_lower = kw.lower()
        covered_by: list[str] = []
        for cname, kws in comp_blog_kw_map.items():
            # 대소문자 무시, 부분 일치 허용 (짧은 쪽이 긴 쪽에 포함)
            if any(
                kw_lower == k.lower()
                or kw_lower in k.lower()
                or k.lower() in kw_lower
                for k in kws
            ):
                covered_by.append(cname)
        competitor_keyword_detail.append({
            "keyword": kw,
            "covered_by": covered_by,
            "my_status": "미커버",
        })

    return {
        "competitor_keyword_gaps": competitor_keyword_gaps,  # 하위 호환 유지
        "competitor_keyword_detail": competitor_keyword_detail,  # C. 봉쇄 원인 분석
    }


def _annotate_posts_with_citations(
    posts_detail: list[dict],
    cited_source_urls: set[str],
    cited_blog_ids: set[str],
) -> list[dict]:
    """각 포스트에 is_cited, cited_confirmed 필드를 추가한 새 리스트를 반환.

    - cited_confirmed=True : source_url 정확 매칭 (쿼리스트링 무시, 높은 신뢰도)
    - is_cited=True, cited_confirmed=False : blog_id 레벨 매칭만 (fallback, 낮은 신뢰도)
    - is_cited=False, cited_confirmed=False : 인용 확인 안 됨

    과거 스캔 레코드의 source_url이 NULL이면 cited_source_urls/cited_blog_ids가 비어
    모든 포스트가 is_cited=False로 반환되므로, 프론트는 데이터 부재를 '확인 안 됨'으로 표시.
    외부 블로그(티스토리 등)는 blog.naver.com 패턴과 불일치하므로 blog_id 매칭은 건너뜀.
    """
    result: list[dict] = []
    for post in posts_detail:
        # 쿼리스트링 제거 + 모바일 도메인 정규화(m.blog.naver.com → blog.naver.com)
        link = (post.get("link") or "").split("?")[0].replace("//m.blog.naver.com/", "//blog.naver.com/")

        # 1. source_url 정확 매칭
        cited_confirmed = bool(link and link in cited_source_urls)

        # 2. blog_id 레벨 매칭 (fallback) — 네이버 블로그만
        blog_id: Optional[str] = None
        if link and not cited_confirmed:
            m = re.match(r"https?://blog\.naver\.com/([^/?#]+)", link)
            if m:
                blog_id = m.group(1)

        is_cited = cited_confirmed or bool(blog_id and blog_id in cited_blog_ids)

        result.append({**post, "is_cited": is_cited, "cited_confirmed": cited_confirmed})
    return result


# 주제 추천에 사용할 검색 의도어 (키워드+월 기반 안정적 순환 — 매달 문구가 바뀌도록)
_TOPIC_INTENT_WORDS = ["추천", "가격", "후기", "비용 총정리", "방법"]

# "지금 당장 할 수 있는 개선" 카드가 이미 missing_keywords[:5]를 그대로 노출하므로
# (BlogClient.tsx의 "다음 포스트 제목에 이 키워드를 넣으세요" 섹션),
# 이번 달 주제 추천은 같은 키워드를 반복 노출하지 않도록 그 뒤 구간만 사용한다.
_ALREADY_SURFACED_MISSING_KW_COUNT = 5


def _generate_topic_suggestions(
    missing_keywords: list[str],
    competitor_keyword_gaps: list[str],
    region: str,
    category: str,
    covered_keywords: list[str],
) -> list[dict]:
    """
    이번 달 블로그 주제 추천 (최대 5개, 최소 0개).

    우선순위:
    1. competitor_keyword_gaps — 경쟁사에는 있고 내 블로그에는 없는 키워드 (priority=high)
    2. missing_keywords[5:] — 업종 커버리지 갭 키워드, 단 상위 5개는 "지금 당장 할 수 있는
       개선" 카드가 이미 그대로 노출하므로 제외해 동일 키워드 중복 추천을 방지 (priority=medium)
    3. covered_keywords 재활용 — 위 두 소스가 부족할 때 의도어 변형 (priority=low)

    의도어는 (키워드, 이달 월) 조합의 안정적 해시로 골라 매달 문구가 자연스럽게 바뀌되
    같은 달 안에서는 재분석해도 동일하게 유지된다.

    외부 API 호출 없음 — 문자열 조합만 사용.
    반환 형식: [{"topic": str, "base_keyword": str, "reason": str, "priority": "high"|"medium"|"low", "source": str}]
    base_keyword는 topic(복합 문구)의 원본 키워드 — SearchAd 검색량 조회는 이 필드로 해야 정확도가 높다.
    """
    city = region.strip().split()[0] if region and region.strip() else ""
    this_month = date.today().month

    results: list[dict] = []
    seen_keywords: set[str] = set()

    def _make_topic(kw: str) -> str:
        stable_seed = sum(ord(c) for c in kw) + this_month
        intent = _TOPIC_INTENT_WORDS[stable_seed % len(_TOPIC_INTENT_WORDS)]
        if city:
            return f"{city} {kw} {intent}"
        return f"{kw} {intent}"

    # 1. competitor_keyword_gaps (high priority) — 다른 섹션과 겹치지 않는 독립 데이터
    for kw in (competitor_keyword_gaps or []):
        if not kw or kw in seen_keywords:
            continue
        seen_keywords.add(kw)
        results.append({
            "topic": _make_topic(kw),
            "base_keyword": kw,
            "reason": "경쟁사 블로그에는 있지만 내 블로그에는 없는 키워드입니다",
            "priority": "high",
            "source": "competitor_gap",
        })
        if len(results) >= 5:
            return results

    # 2. missing_keywords — 상위 5개(다른 카드에 이미 노출됨)는 건너뛴다
    for kw in (missing_keywords or [])[_ALREADY_SURFACED_MISSING_KW_COUNT:]:
        if not kw or kw in seen_keywords:
            continue
        seen_keywords.add(kw)
        results.append({
            "topic": _make_topic(kw),
            "base_keyword": kw,
            "reason": "업종 주요 키워드인데 아직 블로그에서 다루지 않았습니다",
            "priority": "medium",
            "source": "keyword_gap",
        })
        if len(results) >= 5:
            return results

    # 3. covered_keywords 재활용 (low priority) — 후보가 부족할 때만
    for kw in (covered_keywords or []):
        if not kw or kw in seen_keywords:
            continue
        seen_keywords.add(kw)
        results.append({
            "topic": _make_topic(kw),
            "base_keyword": kw,
            "reason": "이미 다루는 키워드에 새로운 검색 의도를 조합한 주제입니다",
            "priority": "low",
            "source": "reuse",
        })
        if len(results) >= 5:
            return results

    return results


_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; AEOlab-BlogChecker/1.0)",
    "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
}
_MAX_BODY_BYTES = 307_200  # 300KB


# ── 플랫폼 감지 ──────────────────────────────────────────────────────────────

def _detect_blog_platform(url: str) -> str:
    """블로그 플랫폼 자동 감지"""
    if "blog.naver.com" in url:
        return "naver"
    elif "tistory.com" in url:
        return "tistory"
    elif "wordpress.com" in url or "wp-content" in url or "wp-json" in url:
        return "wordpress"
    return "other"


# ── 키워드 커버리지 계산 ─────────────────────────────────────────────────────

# 매칭 시 의미 없는 조사/수식어 — 이 단어만 단독으로 텍스트에 있어도 커버리지로 인정하지 않음
_BLOG_FILLER_WORDS = {"가능", "있음", "없음", "제공", "서비스", "보유", "있어요", "됩니다", "합니다"}


def _keyword_present(keyword: str, text: str) -> bool:
    """블로그 제목/스니펫 텍스트에서 키워드 핵심어 매칭.

    택소노미 키워드는 FAQ형 복합어("주차 가능", "단체 예약 가능")인 반면
    블로그 API는 150자 스니펫만 반환하므로 정확 매칭 시 항상 0%가 됨.
    핵심어(2글자+, 조사/수식어 제외) 중 하나라도 포함되면 커버된 것으로 간주.
    """
    if keyword in text:
        return True
    words = [w for w in keyword.split() if len(w) >= 2 and w not in _BLOG_FILLER_WORDS]
    return bool(words) and any(w in text for w in words)


def _calc_keyword_coverage(
    texts: list[str],
    category: str,
    custom_keywords: Optional[list[str]] = None,
    excluded_keywords: Optional[list[str]] = None,
) -> dict:
    """키워드 커버리지 계산 공통 함수.

    custom_keywords: taxonomy에 없는 항목을 분석 대상에 합류.
    excluded_keywords: 분석 결과에서 제외.
    """
    from services.keyword_taxonomy import normalize_category
    normalized = normalize_category(category)
    taxonomy = KEYWORD_TAXONOMY.get(normalized, KEYWORD_TAXONOMY.get("restaurant", {}))

    all_keywords: list[str] = []
    for cat_data in taxonomy.values():
        if isinstance(cat_data, dict) and "keywords" in cat_data:
            all_keywords.extend(cat_data["keywords"])

    unique_keywords = list(dict.fromkeys(all_keywords))[:20]

    # custom 키워드 union (taxonomy에 없는 것만 합류, 최종 20개 제한 준수)
    if custom_keywords:
        existing_nospace = {k.replace(" ", "") for k in unique_keywords}
        for ck in custom_keywords:
            if not isinstance(ck, str):
                continue
            ck_s = ck.strip()
            if len(ck_s) < 2:
                continue
            if ck_s.replace(" ", "") not in existing_nospace:
                unique_keywords.append(ck_s)
                existing_nospace.add(ck_s.replace(" ", ""))

    # excluded 필터
    excluded_set = {
        k.strip() for k in (excluded_keywords or []) if isinstance(k, str) and k.strip()
    }
    if excluded_set:
        unique_keywords = [kw for kw in unique_keywords if kw not in excluded_set]

    combined_text = " ".join(texts)

    covered = [kw for kw in unique_keywords if _keyword_present(kw, combined_text)]
    missing = [kw for kw in unique_keywords if not _keyword_present(kw, combined_text)]

    return {
        "coverage": round(len(covered) / max(len(unique_keywords), 1) * 100, 1),
        "covered_keywords": covered,
        "missing_keywords": missing[:10],
    }


# ── AI 브리핑 인용 가능성 체크 ───────────────────────────────────────────────

def _calc_blog_ai_readiness(
    posts_texts: list[str],
    post_dates: list,
    region: str = "",
    posts_structs: Optional[list[dict]] = None,
) -> dict:
    """AI 브리핑 인용 가능성 체크 (11개 항목)"""
    items = []
    combined = " ".join(posts_texts)

    # 1. 질문형/조건형 키워드 포함 여부
    question_patterns = ["하는 법", "추천", "어디서", "리뷰", "후기", "근처", "맛집", "가격", "예약"]
    has_question = any(p in combined for p in question_patterns)
    items.append({
        "label": "검색 의도 키워드 포함 (추천/리뷰/근처 등)",
        "passed": has_question,
        "description": "포스트 제목에 '추천', '리뷰', '근처' 등의 검색 의도 키워드를 포함하면 AI 인용률이 높아집니다.",
    })

    # 2. 지역 정보 포함 여부 — 시(市) 단위 정규화 후 검사 ("창원시" → "창원"도 매칭)
    region_clean = re.sub(r"(특별시|광역시|특별자치시|특별자치도|시|도|군|구)$", "", region.strip().split()[0]) if region else ""
    has_region = bool(region_clean) and (region_clean in combined or (region and region in combined))
    items.append({
        "label": f"지역 키워드 포함 ({region_clean or region or '지역명'})",
        "passed": has_region,
        "description": "블로그 본문에 지역명을 자연스럽게 포함하면 로컬 AI 검색에서 인용됩니다.",
    })

    # 3. 최신성 체크
    latest_date: Optional[date] = None
    recent = False
    freshness = "outdated"
    if post_dates:
        valid_dates = [d for d in post_dates if d is not None]
        if valid_dates:
            latest_date = max(valid_dates)
            days_since = (date.today() - latest_date).days
            recent = days_since <= 30
            if recent:
                freshness = "fresh"
            elif days_since <= 90:
                freshness = "stale"

    items.append({
        "label": "최근 30일 이내 포스트 존재",
        "passed": recent,
        "description": "한 달에 1~2개 포스트를 올리면 AI가 최신 정보로 인식합니다.",
    })

    # 4. 포스트 길이 체크 (300자 이상 — full_text_len 측정 가능한 포스트 기준)
    measurable_4 = [s for s in (posts_structs or []) if isinstance(s.get("full_text_len"), int) and s["full_text_len"] >= 0]
    if measurable_4:
        long_enough = [s for s in measurable_4 if s["full_text_len"] >= 300]
        has_content = len(long_enough) / len(measurable_4) >= 0.5
        item4: dict = {
            "label": "충분한 본문 내용 (300자 이상 포스트 50% 이상)",
            "passed": has_content,
            "description": "AI가 인용할 내용이 충분하려면 포스트당 최소 300자 이상 작성이 필요합니다.",
        }
    else:
        # 측정 가능한 포스트 없음 (API 전용) → unavailable 처리
        item4 = {
            "label": "충분한 본문 내용 (300자 이상)",
            "passed": None,
            "unavailable": True,
            "description": "API 경로로만 수집된 포스트는 본문 길이를 직접 측정할 수 없습니다.",
        }
    items.append(item4)

    # 5. FAQ/Q&A 구조 포함 여부
    faq_patterns = ["Q.", "A.", "질문", "답변", "Q&A", "자주 묻는", "궁금", "어떻게", "뭔가요", "인가요", "할까요"]
    faq_matched = sum(1 for p in faq_patterns if p in combined)
    has_faq = faq_matched >= 2
    items.append({
        "label": "FAQ/Q&A 구조 포함",
        "passed": has_faq,
        "description": "Q&A 형식 글은 AI 검색에서 가장 많이 인용합니다. FAQ 섹션을 추가하세요.",
    })

    # 6. 본문에 전화번호/주소 포함 여부
    phone_pattern = re.compile(r'\d{2,4}[-\s]?\d{3,4}[-\s]?\d{4}')
    address_markers = ["시", "구", "동", "번지", "로", "길"]
    has_phone = bool(phone_pattern.search(combined))
    addr_marker_count = sum(1 for m in address_markers if m in combined)
    has_address = addr_marker_count >= 2 and bool(re.search(r'\d', combined))
    has_contact = has_phone or has_address
    items.append({
        "label": "전화번호 또는 주소 포함",
        "passed": has_contact,
        "description": "블로그에 전화번호·주소가 있으면 AI가 스마트플레이스 정보와 연결해 신뢰도를 높입니다.",
    })

    # 7. 포스트 길이 500자 이상 비율 50% 초과 (full_text_len 기준)
    measurable_7 = [s for s in (posts_structs or []) if isinstance(s.get("full_text_len"), int) and s["full_text_len"] >= 0]
    if measurable_7:
        long_posts_s = [s for s in measurable_7 if s["full_text_len"] >= 500]
        long_ratio = len(long_posts_s) / len(measurable_7)
        has_long_posts = long_ratio > 0.5
        item7: dict = {
            "label": "포스트 길이 500자 이상 비율 50% 초과",
            "passed": has_long_posts,
            "description": "500자 이상의 충분한 내용이 있어야 AI가 인용할 근거를 찾을 수 있습니다.",
        }
    else:
        item7 = {
            "label": "포스트 길이 500자 이상 비율 50% 초과",
            "passed": None,
            "unavailable": True,
            "description": "API 경로로만 수집된 포스트는 본문 길이를 직접 측정할 수 없습니다.",
        }
    items.append(item7)

    # 8. 제목에 숫자/구체성 포함 비율 30% 초과
    specific_patterns = re.compile(r'\d|3가지|5곳|TOP|BEST|원|분|km')
    titles = [t.split(" ")[0] for t in posts_texts if t.strip()]  # 첫 단어(제목 근사)
    # 전체 texts에서 숫자 포함 텍스트 비율 계산
    specific_texts = [t for t in posts_texts if specific_patterns.search(t)]
    specific_ratio = len(specific_texts) / max(len(posts_texts), 1)
    has_specific_titles = specific_ratio > 0.3
    items.append({
        "label": "제목에 숫자/구체적 표현 포함 비율 30% 초과",
        "passed": has_specific_titles,
        "description": "숫자가 포함된 제목('3가지 방법', 'TOP5')은 AI 검색 인용률이 높습니다.",
    })

    # 9. 이미지 포함 비율 30% 초과 (img_count 측정 가능한 포스트 기준)
    measurable_9 = [s for s in (posts_structs or []) if isinstance(s.get("img_count"), int) and s["img_count"] >= 0]
    if measurable_9:
        img_posts = [s for s in measurable_9 if s["img_count"] > 0]
        img_ratio = len(img_posts) / len(measurable_9)
        has_images = img_ratio > 0.3
        item9: dict = {
            "label": "이미지 포함 포스트 비율 30% 초과",
            "passed": has_images,
            "description": "이미지가 포함된 포스트는 AI 검색 인용률과 체류시간이 높습니다.",
        }
    else:
        item9 = {
            "label": "이미지 포함 포스트 비율 30% 초과",
            "passed": None,
            "unavailable": True,
            "description": "API 경로로만 수집된 포스트는 이미지 수를 직접 측정할 수 없습니다.",
        }
    items.append(item9)

    # 10. 소제목(H2~H4) 포함 비율 30% 초과 (heading_count 측정 가능한 포스트 기준)
    measurable_10 = [s for s in (posts_structs or []) if isinstance(s.get("heading_count"), int) and s["heading_count"] >= 0]
    if measurable_10:
        heading_posts = [s for s in measurable_10 if s["heading_count"] > 0]
        heading_ratio = len(heading_posts) / len(measurable_10)
        has_headings = heading_ratio > 0.3
        item10: dict = {
            "label": "소제목(H2~H4) 포함 포스트 비율 30% 초과",
            "passed": has_headings,
            "description": "소제목으로 문단을 나누면 AI가 핵심 정보를 더 쉽게 추출해 인용합니다.",
        }
    else:
        item10 = {
            "label": "소제목(H2~H4) 포함 포스트 비율 30% 초과",
            "passed": None,
            "unavailable": True,
            "description": "API 경로로만 수집된 포스트는 소제목 구조를 직접 측정할 수 없습니다.",
        }
    items.append(item10)

    # 11. 동영상 포함 포스트 존재 여부 (video_count 측정 가능한 포스트 기준)
    measurable_11 = [s for s in (posts_structs or []) if isinstance(s.get("video_count"), int) and s["video_count"] >= 0]
    if measurable_11:
        has_video_post = any(s["video_count"] > 0 for s in measurable_11)
        item11: dict = {
            "label": "동영상 포함 포스트 존재",
            "passed": has_video_post,
            "description": "이미지와 함께 동영상을 넣으면 체류시간이 늘어 네이버가 신뢰도 높은 문서로 판단합니다.",
        }
    else:
        item11 = {
            "label": "동영상 포함 포스트 존재",
            "passed": None,
            "unavailable": True,
            "description": "API 경로로만 수집된 포스트는 동영상 삽입 여부를 직접 측정할 수 없습니다.",
        }
    items.append(item11)

    # unavailable 항목은 분모에서 제외 (측정 불가가 점수를 깎지 않도록)
    scorable_items = [i for i in items if not i.get("unavailable")]
    passed_count = sum(1 for i in scorable_items if i["passed"])
    score = round(passed_count / max(len(scorable_items), 1) * 100)

    return {
        "score": score,
        "items": items,
        "freshness": freshness,
        "latest_post_date": latest_date.isoformat() if latest_date else None,
    }


# ── 네이버 블로그 분석 (검색 API 사용) ──────────────────────────────────────

def _get_top_category_keywords(category: str, limit: int = 3) -> list[str]:
    """업종별 상위 키워드 반환 (다중 쿼리 생성용)"""
    from services.keyword_taxonomy import normalize_category
    normalized = normalize_category(category)
    taxonomy = KEYWORD_TAXONOMY.get(normalized, {})
    keywords: list[str] = []
    for cat_data in taxonomy.values():
        if isinstance(cat_data, dict) and "keywords" in cat_data:
            keywords.extend(cat_data["keywords"])
            if len(keywords) >= limit:
                break
    return keywords[:limit]


async def _search_naver_blog_once(
    session: aiohttp.ClientSession,
    query: str,
    client_id: str,
    client_secret: str,
    blog_id: str,
    display: int = 100,
) -> tuple[list[dict], int, bool]:
    """
    단일 쿼리로 네이버 블로그 검색 → blog_id 필터링 → (결과, total, ok) 반환.
    ok=False는 API 호출 자체가 실패했다는 뜻 — "포스트 0개 발견"과 구분해야 함.

    display: API 최대값 100 (기본값 100으로 변경)
    total: API 응답의 totalResults 필드 — 실제 총 포스트 수 추정에 사용
    """
    def strip_tags(text: str) -> str:
        return re.sub(r"<[^>]+>", "", text or "").strip()

    try:
        async with session.get(
            "https://openapi.naver.com/v1/search/blog.json",
            params={"query": query, "display": display, "sort": "date"},
            headers={
                "X-Naver-Client-Id": client_id,
                "X-Naver-Client-Secret": client_secret,
            },
        ) as resp:
            if resp.status != 200:
                _logger.warning(
                    f"naver blog search non-200 for query='{query}': status={resp.status}"
                )
                return [], 0, False
            data = await resp.json()
    except aiohttp.ClientError as e:
        _logger.warning(f"naver blog search failed for query='{query}': {e}")
        return [], 0, False

    total = data.get("total", 0)
    raw_items = data.get("items", [])

    # blog_id 있으면 해당 블로그 포스트만 필터 — fallback 없음 (타 블로그 결과 혼입 방지)
    if blog_id:
        filtered = [i for i in raw_items if blog_id.lower() in (i.get("bloggerlink") or "").lower()]
    else:
        filtered = raw_items

    result = []
    for item in filtered:
        title = strip_tags(item.get("title", ""))
        desc  = strip_tags(item.get("description", ""))
        link  = item.get("link", "")
        bloggerlink = item.get("bloggerlink", "")
        postdate = item.get("postdate", "")
        result.append({
            "title": title,
            "desc": desc,
            "link": link,
            "bloggerlink": bloggerlink,
            "postdate": postdate,
            # API는 150자 스니펫만 반환 — 본문 구조 측정 불가
            "img_count": -1,
            "heading_count": -1,
            "hashtag_count": -1,
            "full_text_len": -1,
            "video_count": -1,
            "source": "api",
        })
    return result, total, True


async def _fetch_naver_rss(blog_id: str) -> tuple[list[dict], int, bool, bool]:
    """네이버 블로그 RSS regex 파싱 (CDATA 비표준 형식 대응).
    ok=False는 RSS 호출 자체가 실패했다는 뜻 — "포스트 0개 발견"과 구분해야 함.
    blog_id가 없어 애초에 시도하지 않은 경우는 실패가 아니므로 ok=True로 반환.
    4번째 반환값 not_found: 404(블로그 자체가 존재하지 않음 — 잘못된 blog_id일 가능성 높음)를
    타임아웃/네트워크 오류 등 일시적 실패와 구분하기 위한 플래그. 잘못된 주소 입력 시
    "일시적 접근 실패"가 아니라 "주소를 확인해주세요"로 정확히 안내하는 데 사용.
    """
    if not blog_id:
        return [], 0, True, False
    rss_url = f"https://rss.blog.naver.com/{blog_id}"

    # 최초 시도 실패 시 1회 재시도 — 별도 세션(DNS/TCP 재비용)이 간헐적 실패의
    # 원인으로 보여, 짧은 타임아웃으로 1회만 재시도해 안정성을 높인다
    xml_text: Optional[str] = None
    not_found = False
    for attempt, timeout in enumerate((_TIMEOUT, _RSS_RETRY_TIMEOUT)):
        try:
            async with aiohttp.ClientSession(timeout=timeout, headers=_HEADERS) as session:
                async with session.get(rss_url) as resp:
                    if resp.status != 200:
                        _logger.warning(
                            "naver rss non-200 for blog_id=%s (attempt %d): status=%s",
                            blog_id, attempt + 1, resp.status,
                        )
                        if resp.status == 404:
                            not_found = True
                        # 404/403 등 확정적 HTTP 오류는 재시도해도 결과가 같으므로 즉시 포기 —
                        # 재시도는 일시적 네트워크 실패(예외/타임아웃)에만 의미가 있음
                        break
                    raw = await resp.content.read(_MAX_BODY_BYTES)
                    xml_text = raw.decode("utf-8", errors="replace")
                    break
        except Exception as e:
            _logger.warning(
                "naver rss fetch failed for blog_id=%s (attempt %d): %s", blog_id, attempt + 1, e
            )
            continue

    if xml_text is None:
        return [], 0, False, not_found

    def _field(tag: str, block: str) -> str:
        m = re.search(rf"<{tag}[^>]*>\s*<!\[CDATA\[(.*?)(?:\]\]>|$)", block, re.DOTALL)
        if m:
            return m.group(1).strip()
        m = re.search(rf"<{tag}[^>]*>([^<]*)</{tag}>", block)
        if m:
            return m.group(1).strip()
        return ""

    item_blocks = re.findall(r"<item>(.*?)</item>", xml_text, re.DOTALL)
    items = []
    for block in item_blocks:
        title = re.sub(r"<[^>]+>", "", _field("title", block)).strip()
        link_raw = _field("link", block)
        if not link_raw:
            m2 = re.search(r"<link>([^<]+)</link>", block)
            link_raw = m2.group(1).strip() if m2 else ""
        link = link_raw.split("?")[0] if link_raw else ""
        desc_raw = _field("description", block)
        # RSS 본문 HTML에서 구조 정보 추출 (태그 제거 전)
        img_count = len(re.findall(r"<img", desc_raw, re.IGNORECASE))
        heading_count = len(re.findall(r"<h[2-4][\s>]", desc_raw, re.IGNORECASE))
        # 네이버 SmartEditor 동영상 삽입 — iframe/video 태그 또는 video 클래스·tv.naver.com 링크로 탐지
        video_count = len(re.findall(r"<iframe|<video[\s>]|class=\"[^\"]*video|tv\.naver\.com", desc_raw, re.IGNORECASE))
        desc_text_full = re.sub(r"<[^>]+>", "", desc_raw).strip()
        hashtag_count = len(re.findall(r"#\w+", desc_text_full))
        full_text_len = len(desc_text_full)
        desc = desc_text_full[:1000]
        pub_date_str = _field("pubDate", block)
        if not pub_date_str:
            m3 = re.search(r"<pubDate>([^<]+)</pubDate>", block)
            pub_date_str = m3.group(1).strip() if m3 else ""
        postdate = ""
        if pub_date_str:
            try:
                dt = parsedate_to_datetime(pub_date_str)
                postdate = dt.strftime("%Y%m%d")
            except Exception as exc:
                _logger.warning("blog_analyzer: RSS 날짜 파싱 실패 → 빈 postdate (%s)", exc)
        if title or link:
            items.append({
                "title": title,
                "desc": desc,
                "link": link,
                "bloggerlink": f"https://blog.naver.com/{blog_id}",
                "postdate": postdate,
                "img_count": img_count,
                "heading_count": heading_count,
                "hashtag_count": hashtag_count,
                "full_text_len": full_text_len,
                "video_count": video_count,
                "source": "rss",
            })
    return items, len(items), True, False


async def _analyze_naver_blog(
    blog_id: str,
    business_name: str,
    category: str,
    region: str,
    custom_keywords: Optional[list[str]] = None,
    excluded_keywords: Optional[list[str]] = None,
) -> dict:
    """
    네이버 검색 API blog.json을 통한 블로그 분석 (다중 쿼리 전략)

    단일 쿼리의 한계(API는 제목+snippet 150자만 반환):
    여러 쿼리를 병렬 실행해서 최대한 많은 포스트를 커버함.
      - 쿼리 1: 사업장명 (현재 운영 중인 포스트 탐색)
      - 쿼리 2: blog_id 직접 검색 (블로거 ID로 등록된 포스트 탐색)
      - 쿼리 3~4: 지역 + 업종 상위 키워드 (예: "창원 웨딩스냅")
    직접 크롤링 절대 금지 — NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수 사용
    """
    client_id = os.getenv("NAVER_CLIENT_ID")
    client_secret = os.getenv("NAVER_CLIENT_SECRET")

    if not client_id or not client_secret:
        return {
            "platform": "naver",
            "post_count": 0,
            "keyword_coverage": 0.0,
            "covered_keywords": [],
            "missing_keywords": [],
            "ai_readiness_score": 0.0,
            "ai_readiness_items": [],
            "freshness": "outdated",
            "latest_post_date": None,
            "top_recommendation": "네이버 API 키가 설정되지 않아 분석할 수 없습니다.",
            "error": "NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 미설정",
        }

    # 다중 쿼리 생성
    queries: list[str] = []
    if business_name:
        queries.append(business_name)
    if blog_id and blog_id not in queries:
        queries.append(blog_id)
    # 지역 + 업종 상위 키워드 쿼리 추가 (블로그 포스트 내용 커버리지 향상)
    top_kws = _get_top_category_keywords(category, limit=3)
    if region and top_kws:
        city = region.strip().split()[0]  # "창원시 성산구" → "창원시"
        for kw in top_kws[:2]:
            q = f"{city} {kw}"
            if q not in queries:
                queries.append(q)
    elif top_kws:
        for kw in top_kws[:1]:
            if kw not in queries:
                queries.append(kw)

    # 수집 순서: RSS 먼저(직접 await) -> 검색 API 보완
    # RSS를 create_task 병렬 방식 대신 직접 await로 변경 (aiohttp 세션 충돌 방지)
    seen_links: set[str] = set()
    all_items: list[dict] = []
    # 시도 대비 기술적 실패 횟수 — 전부 실패면 "포스트 0개"가 아니라 "측정 자체가 안 됨"으로 구분
    naver_total_attempts = 0
    naver_failed_attempts = 0
    # RSS(본문 구조 측정 가능)가 실패해 API-only(스니펫만, 구조 측정 불가)로 대체됐는지 —
    # 사용자에게 이번 분석의 데이터 품질이 평소보다 낮을 수 있음을 알리는 데 사용
    rss_failed = False
    # RSS가 404(블로그 자체가 존재하지 않음)로 실패했는지 — "일시적 접근 실패"와
    # "잘못된 주소 입력"을 구분해 정확한 안내를 주기 위해 추적
    rss_not_found = False

    # 1단계: RSS 피드 먼저 직접 수집 (blog_id 기반, 가장 신뢰할 수 있는 내 블로그 포스트 목록)
    if blog_id:
        naver_total_attempts += 1
        try:
            rss_items, _, rss_ok, rss_not_found = await _fetch_naver_rss(blog_id)
            if not rss_ok:
                naver_failed_attempts += 1
                rss_failed = True
            for item in rss_items:
                link = item.get("link", "")
                # RSS 링크에서 쿼리스트링 제거 후 정규화 (중복 방지)
                clean_link = link.split("?")[0] if link else ""
                if clean_link and clean_link not in seen_links:
                    seen_links.add(clean_link)
                    all_items.append(item)
                elif not link:
                    all_items.append(item)
            _logger.info("naver rss collected %d posts for blog_id=%s", len(rss_items), blog_id)
        except Exception as e:
            naver_failed_attempts += 1
            rss_failed = True
            _logger.warning("naver rss failed for blog_id=%s: %s", blog_id, e)

    # 2단계: 검색 API로 RSS에서 누락된 포스트 보완 (중복 제거)
    async with aiohttp.ClientSession(timeout=_TIMEOUT) as session:
        for query in queries[:4]:  # 최대 4개 쿼리
            naver_total_attempts += 1
            items, _, query_ok = await _search_naver_blog_once(
                session=session,
                query=query,
                client_id=client_id,
                client_secret=client_secret,
                blog_id=blog_id,
                display=100,
            )
            if not query_ok:
                naver_failed_attempts += 1

            for item in items:
                link = item.get("link", "")
                clean_link = link.split("?")[0] if link else ""
                if clean_link and clean_link not in seen_links:
                    seen_links.add(clean_link)
                    all_items.append(item)
                elif not link:
                    all_items.append(item)

    # 내 블로그로 확인된 포스트 수만 사용 (API total은 전체 검색 결과 수이므로 사용하지 않음)
    total_post_count = len(all_items)

    if not all_items:
        # RSS가 404로 확정 실패(블로그 자체가 존재하지 않음)했다면 "일시적 접근 실패"가
        # 아니라 "잘못된 주소 입력"이 진짜 원인이므로, 나머지 API 시도 성공 여부와
        # 무관하게 우선적으로 정확한 안내를 준다 (2026-07-08 재검증에서 발견한 갭 수정 —
        # 기존 로직은 이 케이스도 "일시적 접근 실패"로 뭉뚱그려 재시도를 유도했으나
        # 재시도해도 결과가 같아 사용자에게 도움이 안 됨)
        if rss_not_found:
            return {
                "platform": "naver",
                "post_count": 0,
                "total_post_count": 0,
                "keyword_coverage": 0.0,
                "covered_keywords": [],
                "missing_keywords": [],
                "ai_readiness_score": 0.0,
                "ai_readiness_items": [],
                "freshness": "outdated",
                "latest_post_date": None,
                "top_recommendation": "등록하신 네이버 블로그 주소를 찾을 수 없습니다. blog.naver.com/ 뒤의 아이디가 정확한지 확인해주세요.",
                "error": None,
            }
        # 시도 중 하나라도 기술적으로 실패했다면 "블로그에 글이 없다"고 단정할 수 없다 —
        # 실패한 시도가 성공했다면 포스트를 찾았을 수도 있으므로 "접근 실패"로 구분해서
        # 안내한다. 전부 실패했을 때뿐 아니라 일부만 실패했을 때도 동일하게 적용
        # (측정 실패를 측정된 부정 응답으로 오집계하면 사용자에게 잘못된 안내가 나가고,
        # blog.py가 이를 "성공"으로 오인해 기존 DB 값을 0으로 덮어쓰고 24시간 쿨다운·
        # 월 사용량까지 소비시키는 사고로 이어짐 — 2026-07-06 재점검에서 실측 확인)
        if naver_total_attempts > 0 and naver_failed_attempts > 0:
            return {
                "platform": "naver",
                "post_count": 0,
                "total_post_count": 0,
                "keyword_coverage": 0.0,
                "covered_keywords": [],
                "missing_keywords": [],
                "ai_readiness_score": 0.0,
                "ai_readiness_items": [],
                "freshness": "outdated",
                "latest_post_date": None,
                "top_recommendation": "네이버 블로그 검색에 일시적으로 접근하지 못했습니다. 잠시 후 다시 시도해주세요.",
                "error": "naver_search_unavailable",
            }
        return {
            "platform": "naver",
            "post_count": 0,
            "total_post_count": 0,
            "keyword_coverage": 0.0,
            "covered_keywords": [],
            "missing_keywords": [],
            "ai_readiness_score": 0.0,
            "ai_readiness_items": [],
            "freshness": "outdated",
            "latest_post_date": None,
            "top_recommendation": "블로그 포스트를 찾을 수 없습니다. 사업장명 또는 블로그 주소를 확인해주세요.",
            "error": None,
        }

    # 포스트 텍스트·날짜·구조 수집 (세 리스트 + filtered_items 인덱스 항상 일치)
    posts_texts: list[str] = []
    post_dates: list[Optional[date]] = []
    posts_structs: list[dict] = []
    filtered_items: list[dict] = []  # posts_texts와 동일 순서·길이 보장

    for item in all_items:
        title = item.get("title", "")
        desc  = item.get("desc", "")
        if not (title or desc):
            continue

        posts_texts.append(f"{title} {desc}")
        filtered_items.append(item)

        pub_date_str = item.get("postdate", "")
        if pub_date_str and len(pub_date_str) == 8:
            try:
                post_dates.append(date(
                    int(pub_date_str[:4]),
                    int(pub_date_str[4:6]),
                    int(pub_date_str[6:8]),
                ))
            except ValueError:
                post_dates.append(None)
        else:
            post_dates.append(None)

        posts_structs.append({
            "img_count": item.get("img_count", -1),
            "heading_count": item.get("heading_count", -1),
            "hashtag_count": item.get("hashtag_count", -1),
            "full_text_len": item.get("full_text_len", -1),
            "video_count": item.get("video_count", -1),
            "source": item.get("source", "api"),
        })

    kw_result = _calc_keyword_coverage(
        posts_texts, category,
        custom_keywords=custom_keywords, excluded_keywords=excluded_keywords,
    )
    readiness = _calc_blog_ai_readiness(posts_texts, post_dates, region, posts_structs)

    post_count = len(all_items)
    top_rec = _build_top_recommendation(
        post_count=post_count,
        coverage=kw_result["coverage"],
        readiness_score=readiness["score"],
        freshness=readiness["freshness"],
        missing_keywords=kw_result["missing_keywords"],
    )

    # 콘텐츠 유형 분류
    all_titles = [item.get("title", "") for item in all_items]
    content_cls = _classify_content_type(all_titles)
    title_suggestions = _generate_title_suggestions(
        all_titles, region, category, kw_result["missing_keywords"]
    )

    # v2: 개별 포스트 상세 분석 (상위 10개 — filtered_items 기준으로 post_dates 인덱스 정합)
    posts_detail: list[dict] = []
    for idx, item in enumerate(filtered_items[:10]):
        pd = post_dates[idx] if idx < len(post_dates) else None
        detail = _analyze_single_post(
            item, pd, region, category, kw_result["covered_keywords"]
        )
        posts_detail.append(detail)

    # v2-C: LLM 기반 품질 판정(진솔한 경험담 vs 홍보 문구) — 상위 5개만, 단일 호출.
    # 실패해도 위 규칙 기반 posts_detail은 그대로 유지되는 부가 기능(2026-07-17 신설).
    # 명시적 타임아웃 필수 — 이 함수 위 RSS(8초)·RSS재시도(5초)·API쿼리(각 8초)는 전부 자체
    # 타임아웃이 있는데(총 예산 45초, _ANALYZE_TIMEOUT_SECONDS=50초 설명 참조) 이 부가 기능만
    # 무제한 대기라면 느려질 때 "덤" 기능 하나 때문에 핵심 분석 전체가 504로 실패할 수 있음
    # (자체 재검토로 발견 — 최초 구현엔 타임아웃 누락).
    try:
        from services.blog_quality_scorer import score_posts_quality
        quality_input = [
            {"title": filtered_items[i].get("title", ""), "text": filtered_items[i].get("desc", "")}
            for i in range(len(posts_detail))
        ]
        quality_results = await asyncio.wait_for(score_posts_quality(quality_input), timeout=8)
        for q_idx, q in quality_results.items():
            if q_idx >= len(posts_detail):
                continue
            reason = q.get("reason") or ""
            if q.get("genuine"):
                posts_detail[q_idx]["positives"].append(f"AI 판단: 진솔한 경험담{f' ({reason})' if reason else ''}")
            else:
                posts_detail[q_idx]["issues"].append(f"AI 판단: 홍보 문구 위주{f' ({reason})' if reason else ''} — 구체적 경험 추가 권장")
    except Exception as e:
        _logger.warning(f"blog quality scoring integration failed: {e}")

    # v2: 이번 주 할 일
    weekly_actions = _build_weekly_actions(
        posts_analysis=posts_detail,
        post_count=post_count,
        freshness=readiness["freshness"],
        missing_keywords=kw_result["missing_keywords"],
        content_issue=content_cls["content_issue"],
    )

    return {
        "platform": "naver",
        "post_count": post_count,
        "total_post_count": total_post_count,
        "keyword_coverage": kw_result["coverage"],
        "covered_keywords": kw_result["covered_keywords"],
        "missing_keywords": kw_result["missing_keywords"],
        "ai_readiness_score": float(readiness["score"]),
        "ai_readiness_items": readiness["items"],
        "freshness": readiness["freshness"],
        "latest_post_date": readiness["latest_post_date"],
        "top_recommendation": top_rec,
        "content_type": content_cls["content_type"],
        "promotional_ratio": content_cls["promotional_ratio"],
        "informational_ratio": content_cls["informational_ratio"],
        "content_issue": content_cls["content_issue"],
        "title_suggestions": title_suggestions,
        # v2 신규 필드
        "posts_detail": posts_detail,
        "weekly_actions": weekly_actions,
        # v3 신규 필드
        "posting_frequency": _calc_posting_frequency(post_dates),
        "best_citation_candidate": _pick_best_citation_candidate(posts_detail, region),
        "duplicate_topics": _detect_duplicate_topics(posts_detail),
        "templated_content": _detect_templated_content(posts_detail),
        # RSS(재시도 포함) 실패로 API 스니펫만으로 분석됨 — 이미지/본문 길이 등 구조 측정치가
        # 평소보다 부정확할 수 있음을 프론트에 알리는 용도 (2026-07-06 재점검 신설)
        "rss_failed": rss_failed,
        "error": None,
    }


# ── 외부 블로그 분석 (aiohttp) ───────────────────────────────────────────────

async def _analyze_external_blog(
    url: str,
    category: str,
    region: str,
    custom_keywords: Optional[list[str]] = None,
    excluded_keywords: Optional[list[str]] = None,
) -> dict:
    """
    외부 블로그(티스토리/워드프레스/기타) aiohttp 파싱
    website_checker.py 패턴 동일 — 최대 300KB, 8초 타임아웃
    SSRF 방지: 내부 IP / localhost / 비표준 포트 차단
    """
    platform = _detect_blog_platform(url)

    if not url.startswith("http"):
        url = "https://" + url.strip()

    # SSRF 차단 — 내부 IP, localhost, 비표준 포트 접근 금지
    if _is_ssrf_blocked(url):
        _logger.warning(f"SSRF attempt blocked: {url}")
        return _error_result(platform, "허용되지 않는 URL입니다. 공개 블로그 주소를 입력해주세요.")

    try:
        async with aiohttp.ClientSession(timeout=_TIMEOUT, headers=_HEADERS) as session:
            async with session.get(url, allow_redirects=True, ssl=False) as resp:
                if resp.status >= 400:
                    return _error_result(platform, f"HTTP {resp.status}")
                content_type = resp.headers.get("Content-Type", "")
                if "html" not in content_type.lower():
                    return _error_result(platform, "HTML 페이지가 아님")
                raw = await resp.content.read(_MAX_BODY_BYTES)
                html = raw.decode("utf-8", errors="replace")
    except aiohttp.ClientConnectorError:
        return _error_result(platform, "사이트 접속 불가")
    except aiohttp.ServerTimeoutError:
        return _error_result(platform, "응답 시간 초과")
    except Exception as e:
        _logger.warning(f"external blog fetch error for {url}: {e}")
        return _error_result(platform, "페이지 로드 실패")

    # 포스트 제목 추출 (h1/h2/h3 태그)
    headings = re.findall(r'<h[1-3][^>]*>(.*?)</h[1-3]>', html, re.DOTALL | re.IGNORECASE)
    post_titles = [re.sub(r'<[^>]+>', '', h).strip() for h in headings if h.strip()]

    # 본문 텍스트 (최대 5000자)
    body_text = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
    body_text = re.sub(r'<style[^>]*>.*?</style>', '', body_text, flags=re.DOTALL | re.IGNORECASE)
    body_text = re.sub(r'<[^>]+>', ' ', body_text)
    body_text = re.sub(r'\s+', ' ', body_text).strip()[:5000]

    posts_texts = post_titles + [body_text]

    # 날짜 추출 (ISO 형식, 한국어 날짜 패턴)
    post_dates: list[Optional[date]] = []
    date_patterns = [
        r'(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})',  # 2024.03.15 / 2024-03-15
        r'(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일',   # 2024년 3월 15일
    ]
    for pattern in date_patterns:
        for m in re.finditer(pattern, html):
            try:
                post_dates.append(date(int(m.group(1)), int(m.group(2)), int(m.group(3))))
            except ValueError:
                pass
        if post_dates:
            break

    # 티스토리: article count 추정
    post_count = len(re.findall(r'<article', html, re.IGNORECASE))
    if post_count == 0:
        post_count = len([t for t in post_titles if len(t) > 5])

    kw_result = _calc_keyword_coverage(
        posts_texts, category,
        custom_keywords=custom_keywords, excluded_keywords=excluded_keywords,
    )
    readiness = _calc_blog_ai_readiness(posts_texts, post_dates, region)

    top_rec = _build_top_recommendation(
        post_count=post_count,
        coverage=kw_result["coverage"],
        readiness_score=readiness["score"],
        freshness=readiness["freshness"],
        missing_keywords=kw_result["missing_keywords"],
    )
    # 콘텐츠 유형 분류
    content_cls = _classify_content_type(post_titles)
    title_suggestions = _generate_title_suggestions(
        post_titles, region, category, kw_result["missing_keywords"]
    )

    # v2: 개별 포스트 상세 분석 (외부 블로그용 — 제목 기반)
    posts_detail: list[dict] = []
    for idx, t in enumerate(post_titles[:10]):
        pd = post_dates[idx] if idx < len(post_dates) else None
        item_stub = {"title": t, "desc": "", "link": url}
        detail = _analyze_single_post(
            item_stub, pd, region, category, kw_result["covered_keywords"]
        )
        posts_detail.append(detail)

    weekly_actions = _build_weekly_actions(
        posts_analysis=posts_detail,
        post_count=post_count,
        freshness=readiness["freshness"],
        missing_keywords=kw_result["missing_keywords"],
        content_issue=content_cls["content_issue"],
    )

    return {
        "platform": platform,
        "post_count": post_count,
        # 티스토리/워드프레스 등은 fetch한 단일 페이지 내 article 태그·제목 개수로 근사한 값 —
        # 네이버(API 정확 카운트)와 달리 실제 총 포스트 수가 아니므로 반드시 추정 표시 필요
        "is_post_count_estimated": True,
        "keyword_coverage": kw_result["coverage"],
        "covered_keywords": kw_result["covered_keywords"],
        "missing_keywords": kw_result["missing_keywords"],
        "ai_readiness_score": float(readiness["score"]),
        "ai_readiness_items": readiness["items"],
        "freshness": readiness["freshness"],
        "latest_post_date": readiness["latest_post_date"],
        "top_recommendation": top_rec,
        "content_type": content_cls["content_type"],
        "promotional_ratio": content_cls["promotional_ratio"],
        "informational_ratio": content_cls["informational_ratio"],
        "content_issue": content_cls["content_issue"],
        "title_suggestions": title_suggestions,
        # v2 신규 필드
        "posts_detail": posts_detail,
        "weekly_actions": weekly_actions,
        # v3 신규 필드
        "posting_frequency": _calc_posting_frequency(post_dates),
        "best_citation_candidate": _pick_best_citation_candidate(posts_detail, region),
        "duplicate_topics": _detect_duplicate_topics(posts_detail),
        "templated_content": _detect_templated_content(posts_detail),
        "error": None,
    }


# ── 콘텐츠 유형 분류 ──────────────────────────────────────────────────────────

def _classify_content_type(titles: list[str]) -> dict:
    """제목 패턴으로 홍보형/정보형 분류"""
    promotional_patterns = ["완료", "스냅", "후기", "촬영됐", "다녀왔", "완성", "🌸", "💕", "❤️", "!!"]
    informational_patterns = ["추천", "선택 기준", "비용", "가격", "방법", "정리", "비교", "총정리", "알아보기", "하는 법"]

    promo = sum(1 for t in titles if any(p in t for p in promotional_patterns))
    info  = sum(1 for t in titles if any(p in t for p in informational_patterns))
    total = max(len(titles), 1)

    promo_ratio = round(promo / total * 100)
    info_ratio  = round(info  / total * 100)

    if promo_ratio > 60:
        verdict = "홍보형"
        issue = f"글의 {promo_ratio}%가 홍보형입니다 — 네이버 AI는 광고 느낌 글을 잘 인용하지 않고, 일반 네이버 검색 노출에도 불리하게 작용할 수 있습니다"
    elif info_ratio > 60:
        verdict = "정보형"
        issue = None
    else:
        verdict = "혼합"
        issue = f"홍보형 {promo_ratio}% / 정보형 {info_ratio}% — 정보형 글 비중을 늘리세요" if promo_ratio > info_ratio else None

    return {
        "content_type": verdict,
        "promotional_ratio": promo_ratio,
        "informational_ratio": info_ratio,
        "content_issue": issue,
    }


def _generate_title_suggestions(titles: list[str], region: str, category: str, missing_keywords: list[str]) -> list[str]:
    """기존 홍보형 제목을 정보형으로 변환한 예시 3개 생성"""
    city = region.strip().split()[0] if region else ""
    import re as _re
    city = _re.sub(r"(특별시|광역시|특별자치시|특별자치도|시|도)$", "", city)

    templates: dict[str, list[str]] = {
        "photo": [
            f"{city} 돌사진 잘 찍는 곳 추천 | 비용·예약·준비물 총정리",
            f"{city} 웨딩촬영 스튜디오 선택 기준 5가지",
            f"가족사진 촬영 비용 현실 정리 ({city} 기준)",
            f"{city} 프로필사진 잘 나오는 스튜디오 | 가격 비교",
        ],
        "restaurant": [
            f"{city} 맛집 추천 | 주차·예약·메뉴 총정리",
            f"{city} 단체 회식 장소 선택 기준",
            f"{city} {missing_keywords[0] if missing_keywords else '음식점'} 가격 비교",
        ],
        "cafe": [
            f"{city} 카페 추천 | 주차·와이파이·콘센트 총정리",
            f"{city} 공부하기 좋은 카페 | 노트북 이용 가능 곳",
            f"{city} 카페 베이커리 메뉴 가격 정리",
        ],
        "beauty": [
            f"{city} 미용실 추천 | 가격·예약·후기 총정리",
            f"{city} 헤어 펌 비용 현실 정리",
            f"{city} 염색 잘 하는 미용실 | 선택 기준",
        ],
        "clinic": [
            f"{city} 병원 추천 | 진료시간·예약·주차 총정리",
            f"{city} 야간 진료 가능한 의원 | 위치·전화번호",
            f"{city} 건강검진 비용 총정리",
        ],
        "academy": [
            f"{city} 학원 추천 | 레벨·비용·체험 수업 총정리",
            f"{city} 영어학원 선택 기준 5가지",
            f"{city} 학원 수강료 현실 정리",
        ],
        "fitness": [
            f"{city} 헬스장 추천 | 가격·시설·PT 비용 총정리",
            f"{city} 필라테스 등록 전 꼭 확인할 것",
            f"{city} PT 가격 비교 | 헬스장 선택 기준",
        ],
        "pet": [
            f"{city} 동물병원 추천 | 진료시간·비용 총정리",
            f"{city} 강아지 예방접종 비용 현실 정리",
            f"{city} 고양이 중성화 수술 잘 하는 병원",
        ],
        "legal": [
            f"{city} 변호사 무료 상담 | 이혼·형사·교통사고",
            f"법률 상담 비용 현실 정리 ({city} 기준)",
            f"{city} 이혼 전문 변호사 선택 기준 5가지",
        ],
        "shopping": [
            f"당일 배송 쇼핑몰 추천 | 가격·반품 총정리",
            f"{missing_keywords[0] if missing_keywords else '제품'} 구매 전 꼭 확인할 것",
            f"수제 {missing_keywords[0] if missing_keywords else '제품'} 온라인 쇼핑몰 비교",
        ],
    }

    # 카테고리 정규화
    from services.keyword_taxonomy import normalize_category
    cat_key = normalize_category(category)

    suggestions = templates.get(cat_key, templates["restaurant"])[:3]
    # city가 없으면 city 포함 여부 상관없이 반환
    return suggestions[:3]


# ── 에러 결과 헬퍼 ────────────────────────────────────────────────────────────

def _error_result(platform: str, error_msg: str) -> dict:
    return {
        "platform": platform,
        "post_count": 0,
        "total_post_count": 0,
        "keyword_coverage": 0.0,
        "covered_keywords": [],
        "missing_keywords": [],
        "ai_readiness_score": 0.0,
        "ai_readiness_items": [],
        "freshness": "outdated",
        "latest_post_date": None,
        "top_recommendation": f"블로그 분석 실패: {error_msg}",
        "error": error_msg,
    }


# ── 주요 개선 권고 생성 ───────────────────────────────────────────────────────

def _build_top_recommendation(
    post_count: int,
    coverage: float,
    readiness_score: float,
    freshness: str,
    missing_keywords: list[str],
) -> str:
    """분석 결과를 바탕으로 가장 중요한 개선 사항 1줄 생성"""
    if post_count == 0:
        return "블로그 포스트가 없습니다. 첫 번째 포스트를 작성해 AI 검색 신호를 만드세요."
    if freshness == "outdated":
        return "마지막 포스트가 90일 이상 지났습니다. 이번 주 안에 포스트 1개를 올려 최신성을 회복하세요."
    if freshness == "stale":
        return "최근 포스트가 30~90일 전입니다. 이달 내 포스트 1개를 추가하면 AI 인용 가능성이 높아집니다."
    if coverage < 30:
        top_kw = missing_keywords[0] if missing_keywords else "업종 핵심 키워드"
        return f"키워드 커버리지가 낮습니다. 다음 포스트 제목에 '{top_kw}'를 포함하세요."
    if readiness_score < 50:
        return "포스트 제목에 '추천', '후기', '근처' 등 검색 의도 키워드를 포함하면 AI 인용률이 높아집니다."
    return "블로그 관리가 양호합니다. 월 2회 이상 꾸준한 발행으로 AI 검색 노출을 유지하세요."


# ── 메인 분석 함수 ────────────────────────────────────────────────────────────

async def analyze_blog(
    blog_url: str,
    business_name: str,
    category: str,
    region: str = "",
    business_id: Optional[str] = None,
) -> dict:
    """
    블로그 URL 분석 메인 함수

    Args:
        blog_url      : 블로그 URL (네이버/티스토리/워드프레스/기타)
        business_name : 사업장 이름 (네이버 API 검색 쿼리 사용)
        category      : 업종 코드 (keyword_taxonomy 키 기준)
        region        : 지역명 (AI 브리핑 지역 키워드 체크 용도)
        business_id   : 사업장 ID (있으면 custom/excluded 키워드 반영)

    Returns:
        platform, post_count, latest_post_date, keyword_coverage,
        covered_keywords, missing_keywords, ai_readiness_score,
        ai_readiness_items, freshness, top_recommendation, error
    """
    if not blog_url or not blog_url.strip():
        return _error_result("unknown", "블로그 URL이 없습니다")

    if not blog_url.startswith("http"):
        blog_url = "https://" + blog_url.strip()

    # SSRF 사전 차단 — 메인 진입점에서 1차 검증 (naver API 경로 포함)
    if _is_ssrf_blocked(blog_url):
        _logger.warning(f"SSRF attempt blocked at entry: {blog_url}")
        return _error_result("unknown", "허용되지 않는 URL입니다. 공개 블로그 주소를 입력해주세요.")

    # 사용자 맞춤 키워드 prefs 조회 (DB 컬럼 없으면 graceful fallback)
    custom_kw: list[str] = []
    excluded_kw: list[str] = []
    if business_id:
        try:
            from services.keyword_resolver import get_user_keyword_prefs
            prefs = await get_user_keyword_prefs(business_id)
            custom_kw = prefs.get("custom") or []
            excluded_kw = prefs.get("excluded") or []
        except Exception as e:
            _logger.warning(f"analyze_blog: keyword_prefs lookup failed (biz={business_id}): {e}")

    platform = _detect_blog_platform(blog_url)

    if platform == "naver":
        # 네이버 블로그 ID 추출 (blog.naver.com/{blog_id})
        parsed = urlparse(blog_url)
        path_parts = [p for p in parsed.path.split("/") if p]
        blog_id = path_parts[0] if path_parts else ""
        return await _analyze_naver_blog(
            blog_id=blog_id,
            business_name=business_name,
            category=category,
            region=region,
            custom_keywords=custom_kw,
            excluded_keywords=excluded_kw,
        )
    else:
        return await _analyze_external_blog(
            url=blog_url,
            category=category,
            region=region,
            custom_keywords=custom_kw,
            excluded_keywords=excluded_kw,
        )
