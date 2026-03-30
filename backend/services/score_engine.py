"""
AI Visibility Score 계산 엔진
도메인 모델 v2.1 § 9 — ScanContext별 가중치 분기 적용
"""
from models.context import ScanContext

# context별 가중치 (합계 = 1.0)
WEIGHTS = {
    ScanContext.LOCATION_BASED: {
        "exposure_freq":     0.30,
        "review_quality":    0.20,
        "schema_score":      0.15,
        "online_mentions":   0.15,
        "info_completeness": 0.10,
        "content_freshness": 0.10,
    },
    ScanContext.NON_LOCATION: {
        "exposure_freq":     0.35,
        "review_quality":    0.10,
        "schema_score":      0.20,
        "online_mentions":   0.20,
        "info_completeness": 0.10,
        "content_freshness": 0.05,
    },
}


def calculate_score(
    scan_result: dict,
    biz: dict = None,
    naver_data: dict = None,
    context: str = "location_based",
) -> dict:
    """AI Visibility Score 계산 (0~100점)
    naver_data: get_naver_visibility() 반환값 (trial 스캔 시 실측값)
    context: "location_based" | "non_location"
    """
    if biz is None:
        biz = {}
    if naver_data is None:
        naver_data = {}

    # business_type 필드에서 context 읽기 (biz dict에서 올 수 있음)
    if context == "location_based" and biz.get("business_type"):
        context = biz["business_type"]

    try:
        ctx = ScanContext(context)
    except ValueError:
        ctx = ScanContext.LOCATION_BASED
    weights = WEIGHTS[ctx]

    s = {}

    # 1. AI 노출 빈도 (Gemini 100회 샘플링 기준)
    gemini = scan_result.get("gemini", {})
    s["exposure_freq"] = gemini.get("exposure_freq", 0)

    # 2. 리뷰 품질 (등록 사용자: DB 저장값 / trial: 기본값)
    rc = biz.get("review_count", 0)
    ar = biz.get("avg_rating", 0)
    kd = biz.get("keyword_diversity", 0)
    receipt_count = biz.get("receipt_review_count", 0) or 0
    receipt_bonus = min(10, receipt_count / 10 * 10)
    s["review_quality"] = min(100, rc / 200 * 40 + ar / 5 * 40 + kd * 20 + receipt_bonus)

    # 3. 정보 구조화 점수 — context별 계산 (§ 9.4)
    s["schema_score"] = _calc_schema_score(ctx, biz, naver_data, scan_result)

    # 4. 온라인 언급 수
    from services.naver_visibility import blog_mention_score
    blog_count = naver_data.get("blog_mentions")
    if blog_count is not None:
        s["online_mentions"] = blog_mention_score(blog_count)
    else:
        mention_platforms = ["chatgpt", "perplexity", "grok", "naver", "claude", "zeta", "google"]
        mentioned_count = sum(
            1 for p in mention_platforms
            if (scan_result.get(p) or {}).get("mentioned", False)
        )
        _mention_map = {0: 10, 1: 25, 2: 40, 3: 55, 4: 70, 5: 80, 6: 90, 7: 100}
        s["online_mentions"] = _mention_map.get(mentioned_count, 100)

    # 5. 기본 정보 완성도
    is_smart_place = naver_data.get("is_smart_place") or biz.get("has_schema", False)
    completeness_base = _calc_completeness(biz, ctx)
    smart_bonus = 40 if (is_smart_place and ctx == ScanContext.LOCATION_BASED) else 0
    s["info_completeness"] = min(100, completeness_base + smart_bonus)

    # 6. 콘텐츠 최신성
    s["content_freshness"] = _calc_freshness(biz, scan_result)

    total = sum(s[k] * weights[k] for k in weights)
    total = round(total, 1)

    # 채널 분리 점수 계산
    naver_ch  = _calc_naver_channel_score(scan_result, biz, naver_data)
    global_ch = _calc_global_channel_score(scan_result, biz)

    # dominant_channel 판단 (§ 9.5)
    gap = abs(naver_ch - global_ch)
    if gap < 10:
        dominant_channel = "balanced"
    elif naver_ch > global_ch:
        dominant_channel = "naver"
    else:
        dominant_channel = "global"

    return {
        "total_score": total,
        "breakdown": s,
        "grade": "A" if total >= 80 else "B" if total >= 60 else "C" if total >= 40 else "D",
        "naver_channel_score": naver_ch,
        "global_channel_score": global_ch,
        "channel_scores": {
            "naver_channel": naver_ch,
            "global_channel": global_ch,
            "dominant_channel": dominant_channel,
            "channel_gap": round(gap, 1),
        },
        "context": ctx.value,
    }


def _calc_schema_score(ctx: ScanContext, biz: dict, naver_data: dict, scan_result: dict) -> float:
    """정보 구조화 점수 — context별 분기 계산 (§ 9.4)

    location_based:
      schema_score = (60 if is_smart_place else 0) + (40 if website_url else 0)

    non_location:
      schema_score = (80 if website_url + has_json_ld else 40 if website_url else 0)
                   + (20 if google_place_id else 0)
    """
    is_smart_place = naver_data.get("is_smart_place") or biz.get("has_schema", False)
    has_web = bool(biz.get("website_url", ""))
    website_check = scan_result.get("website_check") or scan_result.get("website_check_result") or {}
    has_json_ld = bool(website_check.get("has_json_ld"))
    has_google_place = bool(biz.get("google_place_id"))

    if ctx == ScanContext.LOCATION_BASED:
        return (60 if is_smart_place else 0) + (40 if has_web else 0)
    else:
        if has_web and has_json_ld:
            web_score = 80
        elif has_web:
            web_score = 40
        else:
            web_score = 0
        return min(100, web_score + (20 if has_google_place else 0))


def _calc_completeness(biz: dict, ctx: ScanContext = ScanContext.LOCATION_BASED) -> float:
    """사업장 정보 완성도 계산 (context 반영)"""
    if ctx == ScanContext.NON_LOCATION:
        fields = ["name", "category", "website_url", "keywords", "google_place_id"]
    else:
        fields = [
            "name", "address", "phone", "category", "region",
            "website_url", "naver_place_id", "google_place_id", "kakao_place_id",
        ]
    filled = sum(1 for f in fields if biz.get(f))
    return (filled / len(fields)) * 100


def _calc_naver_channel_score(scan_result: dict, biz: dict, naver_data: dict) -> float:
    """네이버 AI 생태계 채널 점수 (0~100)"""
    from services.naver_visibility import blog_mention_score

    score = 0.0

    naver_result = scan_result.get("naver") or {}
    if naver_result.get("mentioned"):
        score += 35
    if naver_result.get("in_briefing"):
        score += 15

    is_smart_place = naver_data.get("is_smart_place") or biz.get("has_schema", False)
    if is_smart_place:
        score += 20

    blog_count = naver_data.get("blog_mentions")
    if blog_count is not None:
        score += blog_mention_score(blog_count) * 0.20

    kakao_result = scan_result.get("kakao") or {}
    if kakao_result.get("is_on_kakao"):
        score += 10

    return min(100.0, round(score, 1))


def _calc_global_channel_score(scan_result: dict, biz: dict) -> float:
    """글로벌 AI 채널 점수 (0~100)"""
    score = 0.0

    gemini = scan_result.get("gemini") or {}
    exposure_freq = gemini.get("exposure_freq", 0)
    if gemini.get("mentioned") and exposure_freq == 0:
        exposure_freq = 1
    score += min(25.0, (exposure_freq / 100) * 25)

    if (scan_result.get("chatgpt") or {}).get("mentioned"):
        score += 20

    google = scan_result.get("google") or {}
    if google.get("mentioned") or google.get("in_ai_overview"):
        score += 20

    if (scan_result.get("perplexity") or {}).get("mentioned"):
        score += 15

    if (scan_result.get("grok") or {}).get("mentioned"):
        score += 10

    if (scan_result.get("claude") or {}).get("mentioned"):
        score += 10

    if biz.get("website_url"):
        score += 2
    website_check = scan_result.get("website_check") or scan_result.get("website_check_result") or {}
    if website_check.get("has_json_ld"):
        score += 2
    if website_check.get("has_schema_local_business"):
        score += 1

    return min(100.0, round(score, 1))


def _calc_freshness(biz: dict, scan_result: dict = None) -> float:
    """콘텐츠 최신성 점수 계산 (0~100)"""
    from datetime import datetime, timezone

    score = 50.0

    if scan_result is None:
        return biz.get("freshness_score", score)

    last_scan_at = scan_result.get("scanned_at")
    if last_scan_at:
        try:
            scanned = datetime.fromisoformat(last_scan_at.replace("Z", "+00:00"))
            days_old = (datetime.now(timezone.utc) - scanned).days
            if days_old <= 7:
                score += 20
            elif days_old <= 30:
                score += 10
            elif days_old > 90:
                score -= 20
        except Exception:
            pass

    naver_result = (scan_result.get("naver_result") or {})
    recent_review_days = naver_result.get("recent_review_days")
    if recent_review_days is not None:
        if recent_review_days <= 7:
            score += 20
        elif recent_review_days <= 30:
            score += 10
        elif recent_review_days > 180:
            score -= 15

    google_result = (scan_result.get("google_result") or {})
    if google_result.get("mentioned") and google_result.get("recency_signal"):
        score += 10

    return max(0.0, min(100.0, score))


def get_weights_for_context(context: str) -> dict:
    """context에 맞는 가중치 dict 반환 (외부 사용용)"""
    try:
        ctx = ScanContext(context)
    except ValueError:
        ctx = ScanContext.LOCATION_BASED
    return WEIGHTS[ctx]
