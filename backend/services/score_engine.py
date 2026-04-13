"""
AI Visibility Score 계산 엔진 — 업종별 듀얼트랙 통합 모델 v3.0
docs/model_engine_v3.0.md 기준 구현

핵심 변화:
  - WEIGHTS 6항목 단일 점수 → 업종별 DUAL_TRACK_RATIO 기반 통합 점수
  - Track 1 (네이버 AI 브리핑 준비도): keyword_gap 35% 반영
  - Track 2 (글로벌 AI 가시성): Gemini 100회 + ChatGPT + Perplexity + Grok + Claude
  - unified_score = track1 × naver_weight + track2 × global_weight (업종별 비율)
  - growth_stage: track1_score 기준 (업종별 비율 차이 오진단 방지)
"""
import logging
from services.keyword_taxonomy import normalize_category
from services.naver_visibility import blog_mention_score

_logger = logging.getLogger("aeolab")

# ────────────────────────────────────────────────────────────────
# 업종별 듀얼트랙 비율
# 근거: 오픈서베이 2026 AI 검색 트렌드 + 연령별 사용자 분포
# ────────────────────────────────────────────────────────────────
DUAL_TRACK_RATIO: dict[str, dict[str, float]] = {
    # 위치 기반 업종 (location_based)
    "restaurant": {"naver": 0.70, "global": 0.30},  # 즉시방문형, 30-50대 고객 70%+
    "cafe":       {"naver": 0.65, "global": 0.35},  # 분위기 탐색 AI 증가, 20대 고객 多
    "beauty":     {"naver": 0.65, "global": 0.35},  # 당일예약 네이버, 전문시술 AI 리서치
    "fitness":    {"naver": 0.60, "global": 0.40},  # 10-20대 고객 → AI 네이티브 비중 높음
    "pet":        {"naver": 0.65, "global": 0.35},  # 동물병원 AI 검색 빠르게 증가
    "clinic":     {"naver": 0.55, "global": 0.45},  # 증상 검색 = ChatGPT, 지식 습득 목적 47.6%
    "academy":    {"naver": 0.40, "global": 0.60},  # 10대(AI 네이티브), 커리큘럼 비교 AI
    # 위치 무관 업종 (non_location)
    "legal":      {"naver": 0.20, "global": 0.80},  # 전문직 = ChatGPT·Perplexity 주전장
    "shopping":   {"naver": 0.10, "global": 0.90},  # 온라인 = 글로벌 AI 압도적
    # 사진·영상·디자인 (위치 기반, 지역 스튜디오·제작사)
    "photo":  {"naver": 0.65, "global": 0.35},  # 지역 기반 사진·영상 검색 ← 네이버 강세
    "video":  {"naver": 0.55, "global": 0.45},  # 포트폴리오 탐색 = AI 비중 증가
    "design": {"naver": 0.35, "global": 0.65},  # 온라인 레퍼런스 탐색 = 글로벌 AI 우세
}

# 미등록 업종 중립 기본값 (오진단 방지)
DEFAULT_DUAL_TRACK_RATIO: dict[str, float] = {"naver": 0.60, "global": 0.40}


def get_dual_track_ratio(category: str) -> dict[str, float]:
    """업종 코드로 naver/global 비율 반환. 미등록 업종은 중립 기본값(0.60/0.40)."""
    key = normalize_category(category)
    return DUAL_TRACK_RATIO.get(key, DEFAULT_DUAL_TRACK_RATIO)


# ────────────────────────────────────────────────────────────────
# Track 1 — 네이버 AI 브리핑 준비도 가중치
# ────────────────────────────────────────────────────────────────
NAVER_TRACK_WEIGHTS: dict[str, float] = {
    "keyword_gap_score":        0.35,  # 업종별 키워드 커버리지 — 조건검색 직결
    "review_quality":           0.25,  # 리뷰 수·평점·최신성·키워드 다양성
    "smart_place_completeness": 0.15,  # FAQ·소개글·소식·부가정보 완성도 (0.25 → 0.15, kakao 10% 분리)
    "naver_exposure_confirmed": 0.15,  # 네이버 AI 브리핑 실제 확인
    "kakao_completeness":       0.10,  # 카카오맵 완성도 (사용자 체크리스트 기반)
}

# ────────────────────────────────────────────────────────────────
# Track 2 — 글로벌 AI 가시성 가중치
# 점수 배분 근거: §1.3 글로벌 AI 플랫폼 시장 점유율 (model_engine_v3.0.md)
# ────────────────────────────────────────────────────────────────
GLOBAL_TRACK_WEIGHTS: dict[str, float] = {
    "multi_ai_exposure": 0.40,  # Gemini×100 + ChatGPT + Perplexity + Grok + Claude
    "schema_seo":        0.30,  # JSON-LD + 웹사이트 SEO + Open Graph
    "online_mentions":   0.20,  # 블로그·뉴스·미디어 언급 (네이버 블로그 API)
    "google_presence":   0.10,  # Google AI Overview 노출
}

# 성장 단계 기준 (track1_score 기준 — 업종별 unified 비율 차이 오판 방지)
_GROWTH_THRESHOLDS = [
    (30,  "survival",  "시작 단계"),
    (55,  "stability", "성장 중"),
    (75,  "growth",    "빠른 성장"),
    (101, "dominance", "지역 1등"),
]


def determine_growth_stage(track1_score: float) -> str:
    """track1_score 기준 성장 단계 코드 반환"""
    for threshold, stage, _ in _GROWTH_THRESHOLDS:
        if track1_score < threshold:
            return stage
    return "dominance"


def determine_growth_stage_label(track1_score: float) -> str:
    """track1_score 기준 성장 단계 한국어 레이블 반환"""
    for threshold, _, label in _GROWTH_THRESHOLDS:
        if track1_score < threshold:
            return label
    return "지역 1등"


# ────────────────────────────────────────────────────────────────
# Track 1 계산 함수들
# ────────────────────────────────────────────────────────────────

def _resolve_keyword_gap_score(
    keyword_coverage_rate: float | None,
    naver_data: dict,
    biz: dict,
    category: str = "",
) -> tuple[float, bool]:
    """
    keyword_gap_score 계산 (0~100).
    반환: (score, is_estimated)
      is_estimated=True  → fallback 30.0 사용, UI에서 "(추정값)" 회색 배지 표시
      is_estimated=False → 실제 리뷰 또는 블로그 텍스트 기반 계산
    """
    if keyword_coverage_rate is not None and keyword_coverage_rate >= 0.1:
        return (keyword_coverage_rate * 100, False)

    # Cold start 2단계: 등록 키워드 + 네이버 블로그 자동 추출
    # businesses.keywords[] 포함 — 스마트플레이스 등록 키워드는 AI에게 노출되므로 "있는 것"으로 처리
    biz_kw_list = biz.get("keywords") or []
    biz_kw_text = " ".join(biz_kw_list) if isinstance(biz_kw_list, list) else ""
    biz_review_sample = biz.get("review_sample") or ""

    top_blogs = naver_data.get("top_blogs") or []
    auto_excerpts = [
        b.get("description") or b.get("title") or ""
        for b in top_blogs
        if isinstance(b, dict)
    ]
    auto_excerpts = [t for t in auto_excerpts if t]
    # 등록 키워드와 리뷰 샘플을 자동 발췌문 앞에 추가 (우선순위 높음)
    if biz_kw_text:
        auto_excerpts = [biz_kw_text] + auto_excerpts
    if biz_review_sample:
        auto_excerpts = [biz_review_sample] + auto_excerpts

    if auto_excerpts and category:
        try:
            from services.keyword_taxonomy import analyze_keyword_coverage
            result = analyze_keyword_coverage(
                category=category,
                review_excerpts=auto_excerpts,
            )
            return (result["coverage_rate"] * 100, False)
        except Exception as e:
            _logger.warning(f"keyword_coverage calc failed: {e}")

    # Cold start 3단계: fallback 30.0 (업종 평균 추정, 0점 왜곡 방지)
    return (30.0, True)


def calc_review_quality(biz: dict) -> float:
    """리뷰 품질 점수 (0~100)
    keyword_diversity는 businesses 테이블에 항상 존재하지 않아 항상 0 반환 문제가 있음.
    대신 scan 후 keyword_coverage로 업데이트하는 방식 사용 (5-B 참조).
    공식: review_count/200×50 + avg_rating/5×50 + receipt_bonus (keyword_diversity 비중 제거)
    """
    rc = biz.get("review_count", 0) or 0
    ar = biz.get("avg_rating", 0) or 0
    receipt_count = biz.get("receipt_review_count", 0) or 0
    receipt_bonus = min(10, receipt_count / 10 * 10)
    return min(100, rc / 200 * 50 + ar / 5 * 50 + receipt_bonus)


def calc_smart_place_completeness(naver_data: dict, biz: dict) -> float:
    """
    스마트플레이스 완성도 점수 (0~100).
    is_smart_place: naver_visibility.py 자동 수집
    naver_place_rank: 지역 검색 순위 (1위=30점, 2~5위=20점, 6~20위=10점)
    has_faq / has_recent_post / has_intro: 사용자 체크박스 입력
    """
    is_smart_place  = bool(
        naver_data.get("is_smart_place")  # 네이버 검색 결과에서 자동 확인
        or biz.get("is_smart_place")       # 사용자 체크박스
        or biz.get("naver_place_id")       # place_id 입력 = 스마트플레이스 등록 간접 증명
    )
    has_faq         = bool(biz.get("has_faq"))
    has_recent_post = bool(biz.get("has_recent_post"))
    has_intro       = bool(biz.get("has_intro"))

    # 네이버 지역 검색 순위 반영 — 검색 노출 = 소상공인에게 가장 직접적 성과
    _rank = naver_data.get("my_rank") or naver_data.get("naver_place_rank")
    if _rank is not None:
        if _rank == 1:
            rank_score = 30   # 1위: 최고 노출
        elif _rank <= 5:
            rank_score = 20   # 2~5위: 상위 노출
        elif _rank <= 10:
            rank_score = 12   # 6~10위: 중간 노출
        else:
            rank_score = 5    # 11위+: 하위 노출
    else:
        rank_score = 0        # 미노출

    return min(100, (
        (25 if is_smart_place  else 0) +   # 스마트플레이스 등록 확인 (40→25, 순위로 분산)
        rank_score +                        # 네이버 지역 검색 순위 (신규, 최대 30점)
        (25 if has_faq         else 0) +   # 체크박스 — AI 브리핑 가장 직접적 경로 (30→25)
        (15 if has_recent_post else 0) +   # 체크박스 — 최신성 점수 유지 (20→15)
        (5  if has_intro       else 0)     # 체크박스 — 영구 키워드 기반 (10→5)
    ))


def calc_naver_exposure(scan_result: dict) -> float:
    """네이버 AI 브리핑 실제 노출 확인 점수 (0~100)"""
    naver_result = scan_result.get("naver") or scan_result.get("naver_result") or {}
    return (
        (60 if naver_result.get("mentioned") else 0) +
        (40 if naver_result.get("in_briefing") else 0)
    )


def calc_kakao_completeness(scan_result: dict, biz: dict) -> float:
    """
    카카오맵 완성도 점수 (0~100).
    - businesses.kakao_score: 사용자 체크리스트 저장 값 (0~100) 우선
    - scan_result.kakao_result: 스캔 시점 카카오 데이터 fallback
    - kakao_place_id 있으면 최소 25점 보장 (등록 확인)
    """
    # 1순위: businesses 테이블에 저장된 체크리스트 점수
    stored = biz.get("kakao_score")
    if stored is not None and stored > 0:
        return float(min(100, stored))

    # 2순위: scan_result의 kakao_result (스캔 시 저장된 데이터)
    kakao_result = scan_result.get("kakao_result") or {}
    if kakao_result:
        score = 0.0
        if kakao_result.get("mentioned"):
            score += 25.0   # 등록 확인
        if kakao_result.get("has_hours"):
            score += 15.0
        if kakao_result.get("has_phone"):
            score += 15.0
        if kakao_result.get("has_photos"):
            score += 20.0
        return min(100.0, score)

    # 3순위: kakao_place_id 존재 여부 (등록만 확인된 경우 25점)
    if biz.get("kakao_place_id"):
        return 25.0

    return 0.0


def calc_track1_score(
    scan_result: dict,
    biz: dict,
    naver_data: dict,
    keyword_coverage_rate: float | None = None,
    category: str = "",
) -> tuple[float, bool, float]:
    """
    Track 1 — 네이버 AI 브리핑 준비도 점수 (0~100).
    반환: (track1_score, is_keyword_estimated, kw_gap)
    kw_gap을 함께 반환해 calculate_score()에서 재사용 (이중 호출 방지)

    구성 (합계 1.0):
      keyword_gap_score        35%
      review_quality           25%
      smart_place_completeness 15%  (← 0.25에서 축소, kakao 10% 분리)
      naver_exposure_confirmed 15%
      kakao_completeness       10%  (← 카카오맵 완성도 신규)
    """
    kw_gap, is_estimated = _resolve_keyword_gap_score(
        keyword_coverage_rate, naver_data, biz, category
    )
    rv_qual   = calc_review_quality(biz)
    sp_comp   = calc_smart_place_completeness(naver_data, biz)
    nv_exp    = calc_naver_exposure(scan_result)
    kakao_com = calc_kakao_completeness(scan_result, biz)

    score = (
        kw_gap    * NAVER_TRACK_WEIGHTS["keyword_gap_score"] +
        rv_qual   * NAVER_TRACK_WEIGHTS["review_quality"] +
        sp_comp   * NAVER_TRACK_WEIGHTS["smart_place_completeness"] +
        nv_exp    * NAVER_TRACK_WEIGHTS["naver_exposure_confirmed"] +
        kakao_com * NAVER_TRACK_WEIGHTS["kakao_completeness"]
    )
    return (round(score, 1), is_estimated, kw_gap)


# ────────────────────────────────────────────────────────────────
# Track 2 계산 함수들
# ────────────────────────────────────────────────────────────────

def calc_multi_ai_exposure(scan_result: dict) -> float:
    """
    멀티 AI 노출 점수 (0~100).
    Gemini 50점 + ChatGPT 25점 + Perplexity 15점 + Instagram 10점
    (grok·claude 제거, Instagram ai_citation_signal 추가)
    """
    gemini = scan_result.get("gemini") or {}
    gemini_score     = min(50.0, (gemini.get("exposure_freq", 0) / 100) * 50)
    chatgpt_score    = 25.0 if (scan_result.get("chatgpt")    or {}).get("mentioned") else 0
    perplexity_score = 15.0 if (scan_result.get("perplexity") or scan_result.get("perplexity_result") or {}).get("mentioned") else 0
    # Instagram ai_citation_signal (0.0~1.0) → 0~10점
    instagram_result = scan_result.get("instagram") or {}
    instagram_score  = instagram_result.get("ai_citation_signal", 0.0) * 10.0
    return min(100.0, gemini_score + chatgpt_score + perplexity_score + instagram_score)


def calc_schema_seo(scan_result: dict, biz: dict) -> float:
    """웹사이트 SEO + JSON-LD + Google Place 구조화 점수 (0~100)"""
    website_check = (
        scan_result.get("website_check")
        or scan_result.get("website_check_result")
        or {}
    )
    score = (
        (40 if website_check.get("has_json_ld")                else 0) +
        (20 if website_check.get("has_schema_local_business")  else 0) +
        (20 if website_check.get("has_open_graph")             else 0) +
        (10 if website_check.get("has_viewport")               else 0) +
        (10 if biz.get("google_place_id")                      else 0)
    )
    return float(score)


def calc_online_mentions(naver_data: dict) -> float:
    """온라인 언급 점수 (0~100) — naver_visibility.blog_mention_score() 활용"""
    blog_count = naver_data.get("blog_mentions")
    if blog_count is not None:
        return blog_mention_score(blog_count)
    return 5.0  # 데이터 없을 때 최소값


def calc_google_presence(scan_result: dict) -> float:
    """Google AI Overview 노출 점수 (0~100)"""
    google = scan_result.get("google") or scan_result.get("google_result") or {}
    return 100.0 if (google.get("mentioned") or google.get("in_ai_overview")) else 0.0


def calc_track2_score(scan_result: dict, biz: dict, naver_data: dict) -> float:
    """Track 2 — 글로벌 AI 가시성 점수 (0~100)"""
    ai_exp   = calc_multi_ai_exposure(scan_result)
    schema   = calc_schema_seo(scan_result, biz)
    mentions = calc_online_mentions(naver_data)
    google   = calc_google_presence(scan_result)

    score = (
        ai_exp   * GLOBAL_TRACK_WEIGHTS["multi_ai_exposure"] +
        schema   * GLOBAL_TRACK_WEIGHTS["schema_seo"] +
        mentions * GLOBAL_TRACK_WEIGHTS["online_mentions"] +
        google   * GLOBAL_TRACK_WEIGHTS["google_presence"]
    )
    return round(score, 1)


# ────────────────────────────────────────────────────────────────
# 통합 점수 계산 (하위호환 포함)
# ────────────────────────────────────────────────────────────────

def calculate_score(
    scan_result: dict,
    biz: dict = None,
    naver_data: dict = None,
    context: str = "location_based",
    keyword_coverage_rate: float | None = None,
) -> dict:
    """
    AI Visibility Score 계산 (0~100점).

    Args:
        scan_result: AI 스캐너 결과 dict
        biz: 사업장 정보 dict (has_faq, has_recent_post, has_intro 포함)
        naver_data: get_naver_visibility() 반환값
        context: "location_based" | "non_location" (하위호환용, category로 대체)
        keyword_coverage_rate: analyze_keyword_coverage() 결과 (0.0~1.0), None이면 cold start 처리

    Returns:
        {
          total_score, unified_score, track1_score, track2_score,
          naver_weight, global_weight, growth_stage, growth_stage_label,
          is_keyword_estimated, breakdown, grade,
          naver_channel_score (하위호환), global_channel_score (하위호환),
          channel_scores (하위호환)
        }
    """
    if biz is None:
        biz = {}
    if naver_data is None:
        naver_data = {}

    # category 추출 (biz dict 우선, 없으면 context 기반 추정)
    category = biz.get("category") or ""

    # 업종별 듀얼트랙 비율
    ratio = get_dual_track_ratio(category)
    naver_w  = ratio["naver"]
    global_w = ratio["global"]

    # Track 1 계산 (kw_gap도 함께 받아 breakdown 재사용 — 이중 호출 방지)
    track1, is_estimated, kw_gap = calc_track1_score(
        scan_result, biz, naver_data, keyword_coverage_rate, category
    )

    # Track 2 계산
    track2 = calc_track2_score(scan_result, biz, naver_data)

    # Unified Score
    unified = round(track1 * naver_w + track2 * global_w, 1)

    # 성장 단계 (track1 기준)
    growth_stage       = determine_growth_stage(track1)
    growth_stage_label = determine_growth_stage_label(track1)

    # breakdown (하위호환 — track 세부 항목 포함)
    breakdown = {
        # Track 1 항목
        "keyword_gap_score":        round(kw_gap, 1),
        "review_quality":           round(calc_review_quality(biz), 1),
        "smart_place_completeness": round(calc_smart_place_completeness(naver_data, biz), 1),
        "naver_exposure_confirmed": round(calc_naver_exposure(scan_result), 1),
        "kakao_completeness":       round(calc_kakao_completeness(scan_result, biz), 1),
        # Track 2 항목
        "multi_ai_exposure":        round(calc_multi_ai_exposure(scan_result), 1),
        "schema_seo":               round(calc_schema_seo(scan_result, biz), 1),
        "online_mentions_t2":       round(calc_online_mentions(naver_data), 1),
        "google_presence":          round(calc_google_presence(scan_result), 1),
        # 하위호환 필드
        "exposure_freq":            (scan_result.get("gemini") or {}).get("exposure_freq", 0),
        "schema_score":             round(calc_schema_seo(scan_result, biz), 1),
        "online_mentions":          round(calc_online_mentions(naver_data), 1),
        "info_completeness":        round(calc_smart_place_completeness(naver_data, biz), 1),
        "content_freshness":        round(_calc_freshness(biz, scan_result), 1),
    }

    grade = "A" if unified >= 80 else "B" if unified >= 60 else "C" if unified >= 40 else "D"

    # 하위호환 채널 점수 (기존 컴포넌트용)
    naver_ch  = track1
    global_ch = track2
    gap = abs(naver_ch - global_ch)
    dominant = "balanced" if gap < 10 else ("naver" if naver_ch > global_ch else "global")

    return {
        # v3.0 핵심 필드
        "total_score":           unified,   # unified_score alias (하위호환)
        "unified_score":         unified,
        "track1_score":          track1,
        "track2_score":          track2,
        "naver_weight":          naver_w,
        "global_weight":         global_w,
        "growth_stage":          growth_stage,
        "growth_stage_label":    growth_stage_label,
        "is_keyword_estimated":  is_estimated,
        "breakdown":             breakdown,
        "grade":                 grade,
        # 하위호환 채널 점수
        "naver_channel_score":   round(naver_ch, 1),
        "global_channel_score":  round(global_ch, 1),
        "channel_scores": {
            "naver_channel":   round(naver_ch, 1),
            "global_channel":  round(global_ch, 1),
            "dominant_channel": dominant,
            "channel_gap":     round(gap, 1),
        },
        "context": context,
    }


def _calc_freshness(biz: dict, scan_result: dict = None) -> float:
    """콘텐츠 최신성 점수 계산 (0~100) — 하위호환용"""
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
        except Exception as e:
            _logger.warning(f"freshness datetime parse failed: {e}")

    naver_result = scan_result.get("naver_result") or {}
    recent_review_days = naver_result.get("recent_review_days")
    if recent_review_days is not None:
        if recent_review_days <= 7:
            score += 20
        elif recent_review_days <= 30:
            score += 10
        elif recent_review_days > 180:
            score -= 15

    return max(0.0, min(100.0, score))


def get_weights_for_context(context: str) -> dict:
    """
    context별 DimensionGap 가중치 반환 — gap_analyzer.py에서 사용.

    v3.0 정합성:
    - location_based → Track1 차원은 NAVER_TRACK_WEIGHTS, Track2 차원은 GLOBAL_TRACK_WEIGHTS 사용
    - non_location   → Track2 가중치를 기준으로, Track1 차원 가중치는 절반으로 축소
    - DualTrackCard 점수 비중과 DimensionGap 우선순위가 일치하도록 맞춤

    dimension_key 매핑:
      exposure_freq     ← naver_exposure_confirmed (Track1) + multi_ai_exposure (Track2) 혼합
      review_quality    ← review_quality (Track1)
      schema_score      ← schema_seo (Track2)
      online_mentions   ← online_mentions (Track2)
      info_completeness ← smart_place_completeness (Track1)
      content_freshness ← 점수 배분 없음 (최신성 보조 지표, 0.05 고정)
    """
    if context == "non_location":
        # non_location: 글로벌 AI 위주 → Track2 가중치 중심
        return {
            "keyword_gap_score":        NAVER_TRACK_WEIGHTS["keyword_gap_score"] * 0.5,   # 0.175
            "review_quality":           NAVER_TRACK_WEIGHTS["review_quality"] * 0.5,      # 0.125
            "smart_place_completeness": NAVER_TRACK_WEIGHTS["smart_place_completeness"] * 0.5,  # 0.125
            "naver_exposure_confirmed":  NAVER_TRACK_WEIGHTS["naver_exposure_confirmed"] * 0.5,  # 0.075
            "multi_ai_exposure":        GLOBAL_TRACK_WEIGHTS["multi_ai_exposure"],         # 0.40
            "schema_seo":               GLOBAL_TRACK_WEIGHTS["schema_seo"],               # 0.30
        }
    else:
        # location_based (기본): 네이버 중심 → Track1 + Track2 가중치 혼합
        return {
            "keyword_gap_score":        NAVER_TRACK_WEIGHTS["keyword_gap_score"],          # 0.35
            "review_quality":           NAVER_TRACK_WEIGHTS["review_quality"],             # 0.25
            "smart_place_completeness": NAVER_TRACK_WEIGHTS["smart_place_completeness"],   # 0.25
            "naver_exposure_confirmed":  NAVER_TRACK_WEIGHTS["naver_exposure_confirmed"],   # 0.15
            "multi_ai_exposure":        GLOBAL_TRACK_WEIGHTS["multi_ai_exposure"] * 0.5,   # 0.20
            "schema_seo":               GLOBAL_TRACK_WEIGHTS["schema_seo"] * 0.5,         # 0.15
        }
