WEIGHTS = {
    "exposure_freq":     0.30,  # AI 노출 빈도 (30%)
    "review_quality":    0.20,  # 리뷰 수·평점·키워드 다양성 (20%)
    "schema_score":      0.15,  # Schema 구조화 (15%)
    "online_mentions":   0.15,  # 온라인 언급 빈도 (15%)
    "info_completeness": 0.10,  # 정보 완성도 (10%)
    "content_freshness": 0.10,  # 콘텐츠 최신성 (10%)
}


def calculate_score(scan_result: dict, biz: dict = None) -> dict:
    """AI Visibility Score 계산 (0~100점)"""
    if biz is None:
        biz = {}

    s = {}

    # 1. AI 노출 빈도 (Gemini 100회 샘플링 기준)
    gemini = scan_result.get("gemini", {})
    s["exposure_freq"] = gemini.get("exposure_freq", 0)

    # 2. 리뷰 품질
    rc = biz.get("review_count", 0)
    ar = biz.get("avg_rating", 0)
    kd = biz.get("keyword_diversity", 0)  # 0~1
    s["review_quality"] = min(100, rc / 200 * 40 + ar / 5 * 40 + kd * 20)

    # 3. Schema 구조화
    has_schema = biz.get("has_schema", False)
    has_web = bool(biz.get("website_url", ""))
    s["schema_score"] = (60 if has_schema else 0) + (40 if has_web else 0)

    # 4. 온라인 언급 — 멀티 AI 플랫폼 언급 수 기반 실계산
    # Gemini(주력 노출빈도로 별도 계산) 제외 7개 플랫폼에서 mentioned 카운트
    mention_platforms = ["chatgpt", "perplexity", "grok", "naver", "claude", "zeta", "google"]
    mentioned_count = sum(
        1 for p in mention_platforms
        if (scan_result.get(p) or {}).get("mentioned", False)
    )
    # 0개→10점, 1→25, 2→40, 3→55, 4→70, 5→80, 6→90, 7→100
    _mention_map = {0: 10, 1: 25, 2: 40, 3: 55, 4: 70, 5: 80, 6: 90, 7: 100}
    s["online_mentions"] = _mention_map.get(mentioned_count, 100)

    # 5. 정보 완성도
    s["info_completeness"] = _calc_completeness(biz)

    # 6. 콘텐츠 최신성 (scan_result 기반 실계산)
    s["content_freshness"] = _calc_freshness(biz, scan_result)

    total = sum(s[k] * WEIGHTS[k] for k in WEIGHTS)
    total = round(total, 1)

    return {
        "total_score": total,
        "breakdown": s,
        "grade": "A" if total >= 80 else "B" if total >= 60 else "C" if total >= 40 else "D",
    }


def _calc_completeness(biz: dict) -> float:
    """사업장 정보 완성도 계산"""
    fields = ["name", "address", "phone", "category", "region", "website_url", "naver_place_id"]
    filled = sum(1 for f in fields if biz.get(f))
    return (filled / len(fields)) * 100


def _calc_freshness(biz: dict, scan_result: dict = None) -> float:
    """콘텐츠 최신성 점수 계산 (0~100)
    - 마지막 스캔 날짜 신선도
    - 네이버 플레이스 최근 리뷰 날짜
    - Google AI Overview 최신성 신호
    """
    from datetime import datetime, timezone

    score = 50.0  # 기본값

    if scan_result is None:
        return biz.get("freshness_score", score)

    # 1. 마지막 스캔 날짜 기반 (스캔 데이터 신선도)
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

    # 2. 네이버 플레이스 최근 리뷰 여부 (naver_place_stats에서 수집)
    naver_result = (scan_result.get("naver_result") or {})
    recent_review_days = naver_result.get("recent_review_days")
    if recent_review_days is not None:
        if recent_review_days <= 7:
            score += 20
        elif recent_review_days <= 30:
            score += 10
        elif recent_review_days > 180:
            score -= 15

    # 3. Google AI Overview에서 최근 활동 언급 여부
    google_result = (scan_result.get("google_result") or {})
    if google_result.get("mentioned") and google_result.get("recency_signal"):
        score += 10

    return max(0.0, min(100.0, score))
