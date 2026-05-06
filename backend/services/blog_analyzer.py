"""
블로그 URL 분석 서비스

- 네이버 블로그: 네이버 검색 API blog.json 사용 (직접 크롤링 절대 금지 — robots.txt 위반)
- 외부 블로그(티스토리/워드프레스/기타): aiohttp fetch + HTML 파싱
- 분석 항목: 포스트 수, 최신성, 키워드 커버리지, AI 브리핑 인용 가능성
"""
import re
import os
import asyncio
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
    except Exception:
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
    text_len = len(desc.strip())

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

    # 2) 검색 의도어 포함 여부 — 누락 시 AI 인용률 저하
    intent_kws = ["추천", "리뷰", "후기", "비용", "가격", "비교", "선택", "방법",
                  "총정리", "근처", "맛집", "하는 법", "알아보기", "순위", "BEST"]
    matched_intent = [kw for kw in intent_kws if kw in title]
    if not matched_intent:
        issues.append("검색 의도어 없음 (추천/후기/비교)")
        score -= 15
    else:
        positives.append(f"검색 의도어 포함 ('{matched_intent[0]}')")

    if text_len < 300:
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
                "제목 끝에 '추천·후기·비교' 같은 검색 의도어를 추가하면 AI 브리핑 인용률이 올라갑니다."
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
        suggestion = "본문에 실제 경험, 가격, 위치 등 구체적 정보를 300자 이상으로 보강하세요"
    elif not issues:
        suggestion = "잘 작성된 포스트입니다. 꾸준히 이 패턴을 유지하세요."

    # 개선 제목 제안
    improved_title = _improve_title(title, region, category, covered_keywords)

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
    }


_CATEGORY_SUFFIX_MAP: dict[str, str] = {
    "photo":      "스튜디오 추천 | 가격·예약·후기 총정리",
    "restaurant": "맛집 추천 | 메뉴·주차·예약 총정리",
    "cafe":       "카페 추천 | 분위기·가격·좌석 총정리",
    "beauty":     "잘하는 곳 추천 | 가격·예약·후기 비교",
    "clinic":     "병원 추천 | 진료시간·비용·예약 총정리",
    "academy":    "학원 추천 | 수강료·체험수업·커리큘럼 비교",
    "fitness":    "추천 | PT 가격·시설·이용권 총정리",
    "pet":        "동물병원 추천 | 진료비·후기·예약 총정리",
    "legal":      "변호사 상담 | 수임료·승소사례 비교",
    "shopping":   "추천 | 가격·배송·후기 비교",
}


def _improve_title(title: str, region: str, category: str, covered_keywords: list[str]) -> str:
    """
    기존 제목을 AI 인용에 유리하게 개선한 제목 생성.

    전략: 원 제목의 군더더기 수식어를 버리고 "{도시} {업종 키워드} {정보형 접미사}" 로 재구성.
    (단순 접미사 이어붙이기를 하지 않음 — 긴 원 제목이 그대로 남는 문제 방지)
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

    # 제목에 실제 포함된 업종 키워드 추출 (긴 것 우선 — "돌잔치 스냅" > "스냅")
    matched = sorted(
        [kw for kw in (covered_keywords or []) if kw and kw in title],
        key=lambda k: -len(k),
    )

    # 카테고리별 접미사 — keyword_taxonomy 정규화 거쳐 매칭
    try:
        from services.keyword_taxonomy import normalize_category
        norm_cat = normalize_category(category)
    except Exception:
        norm_cat = category
    suffix = _CATEGORY_SUFFIX_MAP.get(norm_cat, "추천 | 가격·후기 비교")

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
            "reason": f"이 키워드가 블로그에 없어 AI 브리핑에서 누락됩니다",
        })

    # 3순위: 최신성 문제
    if freshness in ("outdated", "stale") and post_count > 0:
        actions.append({
            "priority": len(actions) + 1,
            "action": "이번 주 안에 포스트 1개를 올려 최신성을 회복하세요",
            "impact": "high" if freshness == "outdated" else "medium",
            "reason": "AI는 오래된 블로그를 신뢰하지 않습니다",
        })

    # 4순위: 홍보형 비율이 높은 경우
    if content_issue and "홍보형" in content_issue:
        actions.append({
            "priority": len(actions) + 1,
            "action": "다음 3개 포스트는 '추천', '비교', '총정리' 형식으로 작성",
            "impact": "medium",
            "reason": "홍보형 글은 AI 인용률이 낮습니다",
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

    if monthly_avg >= 2:
        consistency = "active"
        consistency_message = "꾸준히 발행하고 있습니다. AI가 이 블로그를 신뢰합니다."
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
        "reason": "현재 블로그에서 AI 브리핑에 가장 가까운 포스트입니다",
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

        # 2차: 공백 분리 토큰 중 2글자+ 의미 단어 (문법 어미 제외)
        # 공백 기준 분리이므로 "성하"(완성하는 부분문자열) 같은 오탐 구조적으로 불가
        tokens = re.sub(r"[|·\-\[\]()「」『』【】]", " ", title).split()
        for tok in tokens:
            tok = re.sub(r"[^\w가-힣]", "", tok)  # 특수문자 제거
            if (
                len(tok) >= 2
                and tok not in matched_in_post
                and tok not in seen_kw          # taxonomy 키워드 중복 방지
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


def _build_competitor_comparison(
    my_score: float,
    my_post_count: int,
    my_freshness: str,
    my_keyword_coverage: float,
    competitor_blogs: list[dict],
    my_covered_keywords: list[str] = None,
) -> Optional[dict]:
    """경쟁사 블로그 비교 — competitor_blogs: [{name, blog_analysis_json}]"""
    if not competitor_blogs:
        return None

    competitors = []
    scores = []
    comp_all_keywords: set[str] = set()

    for cb in competitor_blogs:
        analysis = cb.get("blog_analysis_json") or {}
        c_score = analysis.get("citation_score", 0)
        c_count = analysis.get("post_count", 0)
        # 경쟁사 키워드 수집 (keyword_coverage.present + covered_keywords)
        kw_cov = analysis.get("keyword_coverage", {})
        if isinstance(kw_cov, dict):
            comp_all_keywords.update(kw_cov.get("present", []))
        covered = analysis.get("covered_keywords", [])
        if isinstance(covered, list):
            comp_all_keywords.update(covered)
        competitors.append({
            "name": cb.get("name", "경쟁사"),
            "score": c_score,
            "post_count": c_count,
            "freshness": analysis.get("freshness", "unknown"),
            "keyword_coverage": kw_cov.get("present", []) if isinstance(kw_cov, dict) else [],
        })
        scores.append(c_score)

    avg_score = round(sum(scores) / max(len(scores), 1), 1) if scores else 0

    # 내 순위 계산 (점수 기반)
    all_scores = scores + [my_score]
    all_scores.sort(reverse=True)
    my_rank = all_scores.index(my_score) + 1

    # 경쟁사에는 있고 내 블로그에는 없는 키워드
    my_covered = set(my_covered_keywords or [])
    competitor_keyword_gaps = list(comp_all_keywords - my_covered)[:10]

    return {
        "avg_score": avg_score,
        "my_score": my_score,
        "my_rank": my_rank,
        "total_count": len(competitors) + 1,
        "competitors": competitors,
        "competitor_keyword_gaps": competitor_keyword_gaps,
        "competitor_gap_message": f"경쟁사 블로그에는 있고 내 블로그에는 없는 키워드 {len(competitor_keyword_gaps)}개가 발견됐습니다.",
    }


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
) -> dict:
    """AI 브리핑 인용 가능성 체크 (8개 항목)"""
    items = []
    combined = " ".join(posts_texts)

    # 1. 질문형/조건형 키워드 포함 여부
    question_patterns = ["하는 법", "추천", "어디서", "리뷰", "후기", "근처", "맛집", "가격", "예약"]
    has_question = any(p in combined for p in question_patterns)
    items.append({
        "label": "검색 의도 키워드 포함 (추천/리뷰/근처 등)",
        "passed": has_question,
        "tip": "포스트 제목에 '추천', '리뷰', '근처' 등의 검색 의도 키워드를 포함하면 AI 인용률이 높아집니다.",
    })

    # 2. 지역 정보 포함 여부 — 시(市) 단위 정규화 후 검사 ("창원시" → "창원"도 매칭)
    region_clean = re.sub(r"(특별시|광역시|특별자치시|특별자치도|시|도|군|구)$", "", region.strip().split()[0]) if region else ""
    has_region = bool(region_clean) and (region_clean in combined or (region and region in combined))
    items.append({
        "label": f"지역 키워드 포함 ({region_clean or region or '지역명'})",
        "passed": has_region,
        "tip": "블로그 본문에 지역명을 자연스럽게 포함하면 로컬 AI 검색에서 인용됩니다.",
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
        "tip": "한 달에 1~2개 포스트를 올리면 AI가 최신 정보로 인식합니다.",
    })

    # 4. 포스트 길이 체크 (평균 300자 이상)
    has_content = len(combined) > 300
    items.append({
        "label": "충분한 본문 내용 (300자 이상)",
        "passed": has_content,
        "tip": "AI가 인용할 내용이 충분하려면 포스트당 최소 300자 이상 작성이 필요합니다.",
    })

    # 5. FAQ/Q&A 구조 포함 여부
    faq_patterns = ["Q.", "A.", "질문", "답변", "Q&A", "자주 묻는", "궁금", "어떻게", "뭔가요", "인가요", "할까요"]
    faq_matched = sum(1 for p in faq_patterns if p in combined)
    has_faq = faq_matched >= 2
    items.append({
        "label": "FAQ/Q&A 구조 포함",
        "passed": has_faq,
        "tip": "Q&A 형식 글은 네이버 AI 브리핑이 가장 많이 인용합니다. FAQ 섹션을 추가하세요.",
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
        "tip": "블로그에 전화번호·주소가 있으면 AI가 스마트플레이스 정보와 연결해 신뢰도를 높입니다.",
    })

    # 7. 포스트 길이 500자 이상 비율 50% 초과
    long_posts = [t for t in posts_texts if len(t) >= 500]
    long_ratio = len(long_posts) / max(len(posts_texts), 1)
    has_long_posts = long_ratio > 0.5
    items.append({
        "label": "포스트 길이 500자 이상 비율 50% 초과",
        "passed": has_long_posts,
        "tip": "500자 이상의 충분한 내용이 있어야 AI가 인용할 근거를 찾을 수 있습니다.",
    })

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
        "tip": "숫자가 포함된 제목('3가지 방법', 'TOP5')은 AI 브리핑 인용률이 높습니다.",
    })

    passed_count = sum(1 for i in items if i["passed"])
    score = round(passed_count / len(items) * 100)

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
) -> tuple[list[dict], int]:
    """
    단일 쿼리로 네이버 블로그 검색 → blog_id 필터링 → (결과, total) 반환

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
                return [], 0
            data = await resp.json()
    except aiohttp.ClientError as e:
        _logger.warning(f"naver blog search failed for query='{query}': {e}")
        return [], 0

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
        })
    return result, total


async def _fetch_naver_rss(blog_id: str) -> tuple[list[dict], int]:
    """네이버 블로그 RSS regex 파싱 (CDATA 비표준 형식 대응)"""
    if not blog_id:
        return [], 0
    rss_url = f"https://rss.blog.naver.com/{blog_id}"
    try:
        async with aiohttp.ClientSession(timeout=_TIMEOUT, headers=_HEADERS) as session:
            async with session.get(rss_url) as resp:
                if resp.status != 200:
                    return [], 0
                raw = await resp.read()
                xml_text = raw.decode("utf-8", errors="replace")
    except Exception as e:
        _logger.warning("naver rss fetch failed for blog_id=%s: %s", blog_id, e)
        return [], 0

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
        desc = re.sub(r"<[^>]+>", "", desc_raw).strip()[:300]
        pub_date_str = _field("pubDate", block)
        if not pub_date_str:
            m3 = re.search(r"<pubDate>([^<]+)</pubDate>", block)
            pub_date_str = m3.group(1).strip() if m3 else ""
        postdate = ""
        if pub_date_str:
            try:
                dt = parsedate_to_datetime(pub_date_str)
                postdate = dt.strftime("%Y%m%d")
            except Exception:
                pass
        if title or link:
            items.append({
                "title": title,
                "desc": desc,
                "link": link,
                "bloggerlink": f"https://blog.naver.com/{blog_id}",
                "postdate": postdate,
            })
    return items, len(items)


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

    # 1단계: RSS 피드 먼저 직접 수집 (blog_id 기반, 가장 신뢰할 수 있는 내 블로그 포스트 목록)
    if blog_id:
        try:
            rss_items, _ = await _fetch_naver_rss(blog_id)
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
            _logger.warning("naver rss failed for blog_id=%s: %s", blog_id, e)

    # 2단계: 검색 API로 RSS에서 누락된 포스트 보완 (중복 제거)
    async with aiohttp.ClientSession(timeout=_TIMEOUT) as session:
        for query in queries[:4]:  # 최대 4개 쿼리
            items, _ = await _search_naver_blog_once(
                session=session,
                query=query,
                client_id=client_id,
                client_secret=client_secret,
                blog_id=blog_id,
                display=100,
            )

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

    # 포스트 텍스트 및 날짜 수집
    posts_texts: list[str] = []
    post_dates: list[Optional[date]] = []

    for item in all_items:
        title = item.get("title", "")
        desc  = item.get("desc", "")
        if title or desc:
            posts_texts.append(f"{title} {desc}")

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

    kw_result = _calc_keyword_coverage(
        posts_texts, category,
        custom_keywords=custom_keywords, excluded_keywords=excluded_keywords,
    )
    readiness = _calc_blog_ai_readiness(posts_texts, post_dates, region)

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

    # v2: 개별 포스트 상세 분석 (상위 10개)
    posts_detail: list[dict] = []
    for idx, item in enumerate(all_items[:10]):
        pd = post_dates[idx] if idx < len(post_dates) else None
        detail = _analyze_single_post(
            item, pd, region, category, kw_result["covered_keywords"]
        )
        posts_detail.append(detail)

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
                raw = await resp.read()
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
        issue = f"글의 {promo_ratio}%가 홍보형입니다 — 네이버 AI는 광고 느낌 글을 잘 인용하지 않습니다"
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
        return "블로그 포스트가 없습니다. 첫 번째 포스트를 작성해 AI 브리핑 신호를 만드세요."
    if freshness == "outdated":
        return "마지막 포스트가 90일 이상 지났습니다. 이번 주 안에 포스트 1개를 올려 최신성을 회복하세요."
    if freshness == "stale":
        return "최근 포스트가 30~90일 전입니다. 이달 내 포스트 1개를 추가하면 AI 인용 가능성이 높아집니다."
    if coverage < 30:
        top_kw = missing_keywords[0] if missing_keywords else "업종 핵심 키워드"
        return f"키워드 커버리지가 낮습니다. 다음 포스트 제목에 '{top_kw}'를 포함하세요."
    if readiness_score < 50:
        return "포스트 제목에 '추천', '후기', '근처' 등 검색 의도 키워드를 포함하면 AI 인용률이 높아집니다."
    return "블로그 관리가 양호합니다. 월 2회 이상 꾸준한 발행으로 AI 브리핑 노출을 유지하세요."


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
