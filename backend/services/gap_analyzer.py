"""
GapAnalysis 계산 서비스
도메인 모델 v2.5 § 7 — DiagnosisReport + MarketLandscape → GapAnalysis

v2.5 변경:
- ReviewKeywordGap: 추상적 점수 대신 "어떤 키워드를 리뷰에 받아야 하는지" 구체적으로 제시
- GrowthStage: "지금 어느 단계이고 이번 주 뭘 해야 하는지" 소상공인 관점 명확화
"""
import logging
from datetime import datetime, timezone
from typing import Optional
from models.context import ScanContext
from models.gap import GapAnalysis, DimensionGap, CompetitorGap, ReviewKeywordGap, GrowthStage
from services.score_engine import get_weights_for_context, determine_growth_stage
from services.keyword_taxonomy import analyze_keyword_coverage, build_qr_message

_logger = logging.getLogger("aeolab")

# 항목별 한국어 레이블
_DIMENSION_LABELS = {
    "keyword_gap_score":        "키워드 커버리지",
    "review_quality":           "리뷰 품질",
    "smart_place_completeness": "스마트플레이스 완성도",
    "naver_exposure_confirmed":  "네이버 AI 브리핑 노출",
    "multi_ai_exposure":        "글로벌 AI 노출",
    "schema_seo":               "웹사이트 구조화",
}

# context별 gap_reason 템플릿 (dimension_key → callable)
_GAP_REASONS = {
    ScanContext.LOCATION_BASED: {
        "keyword_gap_score": lambda gap: f"업종 키워드 커버리지 부족 — 경쟁사 대비 -{gap:.0f}점. 리뷰·소개글에 핵심 키워드 추가 필요",
        "review_quality": lambda gap: f"리뷰 수·평점이 경쟁사 대비 부족 (-{gap:.0f}점). 키워드 다양성 개선 필요",
        "smart_place_completeness": lambda gap: "스마트플레이스 FAQ·소개글·소식 미완성 — AI 브리핑 인용 가능성 낮음",
        "naver_exposure_confirmed": lambda gap: f"네이버 AI 브리핑 미노출 (경쟁사 대비 -{gap:.0f}점). FAQ 등록 및 키워드 강화 필요",
        "multi_ai_exposure": lambda gap: f"글로벌 AI(Gemini·ChatGPT) 노출 빈도 낮음 (경쟁사 대비 -{gap:.0f}점)",
        "schema_seo": lambda gap: "웹사이트 AI 인식 정보 코드 미설정 — 글로벌 AI가 사업장 정보 인식 불가",
    },
    ScanContext.NON_LOCATION: {
        "keyword_gap_score": lambda gap: f"전문 분야 키워드 커버리지 부족 (경쟁사 대비 -{gap:.0f}점). 웹사이트 콘텐츠 보강 필요",
        "review_quality": lambda gap: f"전문가 리뷰·사례 포트폴리오 부족 (경쟁사 대비 -{gap:.0f}점)",
        "smart_place_completeness": lambda gap: "온라인 프로필 정보 미완성 — 구글 비즈니스 프로필·소개글 보강 필요",
        "naver_exposure_confirmed": lambda gap: f"네이버 AI 브리핑 미노출 (경쟁사 대비 -{gap:.0f}점). 네이버 블로그·지식인 콘텐츠 추가 권장",
        "multi_ai_exposure": lambda gap: f"ChatGPT·Perplexity 미인용. 전문 콘텐츠(블로그·인터뷰·기사) 부족 (경쟁사 대비 -{gap:.0f}점)",
        "schema_seo": lambda gap: "웹사이트 AI 인식 정보 코드 없음 — AI가 사업장 정보를 구조적으로 파악 불가",
    },
}


def _improvement_potential(gap_to_top: float, weight: float) -> str:
    """격차 크기와 가중치로 개선 잠재력 계산"""
    impact = gap_to_top * weight
    if impact >= 5.0:
        return "high"
    elif impact >= 2.5:
        return "medium"
    else:
        return "low"


def _build_keyword_gap(
    category: str,
    business_name: str,
    review_excerpts: list[str] | None,
    competitor_review_excerpts: list[str] | None,
) -> ReviewKeywordGap:
    """
    업종별 키워드 분류 체계 기반 리뷰 키워드 격차 분석.

    "리뷰 품질 -15점"이 아니라
    "이 키워드들이 리뷰에 없어서 AI 브리핑 조건 검색에 안 나옵니다"를 알려줍니다.
    """
    result = analyze_keyword_coverage(
        category=category,
        review_excerpts=review_excerpts or [],
        competitor_review_excerpts=competitor_review_excerpts,
    )

    top_kw = result["top_priority_keyword"]
    qr_msg = build_qr_message(
        top_priority_keyword=top_kw,
        missing_keywords=result["missing"],
        business_name=business_name,
    )

    return ReviewKeywordGap(
        covered_keywords=result["covered"],
        missing_keywords=result["missing"],
        competitor_only_keywords=result["competitor_only"],
        pioneer_keywords=result["pioneer"],
        coverage_rate=result["coverage_rate"],
        top_priority_keyword=top_kw,
        qr_card_message=qr_msg,
        category_scores=result["category_scores"],
    )


# 성장 단계별 설정 (score 기반)
_GROWTH_STAGES = [
    {
        "stage": "survival", "stage_label": "생존기", "score_range": "0~30점",
        "focus_message": "지금은 스마트플레이스 기본 완성이 최우선입니다. AI 검색보다 네이버 지도에 정확히 나오는 것이 먼저입니다.",
        "this_week_action": "네이버 스마트플레이스 접속 → 사진 10장 이상 업로드 + 영업시간·주소·전화번호 정확히 입력",
        "do_not_do": "SNS 광고, 블로그, ChatGPT 최적화에 시간을 쓰지 마세요. 기본이 먼저입니다.",
        "estimated_weeks_to_next": 3,
    },
    {
        "stage": "stability", "stage_label": "안정기", "score_range": "30~55점",
        "focus_message": "기본 등록은 됐습니다. 이제 리뷰 키워드 다양성을 확보할 때입니다. 경쟁사가 보유한 키워드를 내 리뷰에도 받아야 AI 브리핑에 나옵니다.",
        "this_week_action": "이번 주 가장 부족한 키워드 1개를 정해 QR 카드를 테이블에 올려두세요",
        "do_not_do": "리뷰 이벤트(할인·쿠폰 제공)는 네이버 정책 위반입니다. 자연스러운 부탁 방식만 사용하세요.",
        "estimated_weeks_to_next": 6,
    },
    {
        "stage": "growth", "stage_label": "성장기", "score_range": "55~75점",
        "focus_message": "리뷰 기반이 만들어졌습니다. 이제 경쟁사가 없는 키워드를 먼저 선점할 때입니다. 조건 검색 확장 예정 키워드를 지금 확보하면 경쟁 우위를 오래 유지할 수 있습니다.",
        "this_week_action": "선점 가능 키워드 중 가장 가능성 높은 것 1개를 집중 확보하고, 스마트플레이스 '소식' 탭에 새 글을 올리세요",
        "do_not_do": "모든 키워드를 동시에 추구하지 마세요. 한 번에 하나씩 확실히 잡아야 합니다.",
        "estimated_weeks_to_next": 8,
    },
    {
        "stage": "dominance", "stage_label": "지배기", "score_range": "75~100점",
        "focus_message": "네이버 AI 브리핑에서 강한 위치에 있습니다. 이제 ChatGPT·Perplexity 등 글로벌 AI에서도 노출되도록 확장할 때입니다.",
        "this_week_action": "독립 웹사이트에 AI 인식 정보 코드를 추가하거나 구글 비즈니스 프로필을 정비하세요",
        "do_not_do": "현재 강점(리뷰 키워드, 스마트플레이스)을 방치하지 마세요. 지금까지 쌓은 것을 유지하는 것이 우선입니다.",
        "estimated_weeks_to_next": None,
    },
]


def _build_growth_stage(
    total_score: float,
    track1_score: float | None = None,
    biz_data: dict | None = None,
) -> GrowthStage:
    """성장 단계 판정.

    v3.0: track1_score 기준으로 판정 (업종별 dual track 비율 차이로 unified 기준 시 오판).
    track1_score 없으면 total_score로 fallback.
    biz_data가 있으면 실제 사업장 상태를 반영해 단계 및 안내문 보정.
    """
    score = track1_score if track1_score is not None else total_score

    is_smart_place = (biz_data or {}).get("is_smart_place", False)
    review_count = int((biz_data or {}).get("review_count") or 0)
    has_faq = (biz_data or {}).get("has_faq", False)
    has_intro = (biz_data or {}).get("has_intro", False)
    has_recent_post = (biz_data or {}).get("has_recent_post", False)

    # 스마트플레이스 등록 + 리뷰가 있으면 최소 "안정기"로 보정 (생존기 안내 오진단 방지)
    if is_smart_place and review_count > 0 and score < 30:
        score = 30.0

    if score < 30:
        cfg = _GROWTH_STAGES[0]
    elif score < 55:
        cfg = _GROWTH_STAGES[1]
    elif score < 75:
        cfg = _GROWTH_STAGES[2]
    else:
        cfg = _GROWTH_STAGES[3]

    # this_week_action: 실제 미완성 항목 기반으로 덮어쓰기
    this_week_action = cfg["this_week_action"]
    if biz_data and is_smart_place:
        missing = []
        if not has_faq:
            missing.append("스마트플레이스 FAQ 탭에 질문·답변 3개 등록")
        if not has_intro:
            missing.append("소개글에 핵심 키워드 2~3개 포함한 2문장 작성")
        if not has_recent_post:
            missing.append("소식 탭에 최근 작업 사진 1~2장 + 짧은 글 올리기")
        if missing:
            this_week_action = " → ".join(missing[:2])  # 가장 중요한 2개만

    return GrowthStage(
        stage=cfg["stage"],
        stage_label=cfg["stage_label"],
        score_range=cfg["score_range"],
        focus_message=cfg["focus_message"],
        this_week_action=this_week_action,
        do_not_do=cfg["do_not_do"],
        estimated_weeks_to_next=cfg["estimated_weeks_to_next"],
    )


def analyze_gap(
    business_id: str,
    scan_id: str,
    context: str,
    my_breakdown: dict,
    my_total_score: float,
    competitor_scores: list[dict],  # [{"name": str, "score": float, "breakdown": dict}, ...]
    avg_breakdown: dict = None,
    gap_card_url: str = None,
    # v2.5 추가 파라미터
    category: str = "",
    business_name: str = "",
    review_excerpts: list[str] | None = None,
    competitor_review_excerpts: list[str] | None = None,
    # v3.0 추가
    track1_score: float | None = None,
    biz_data: dict | None = None,
) -> GapAnalysis:
    """
    GapAnalysis 계산

    Args:
        business_id: 사업장 ID
        scan_id: 스캔 ID
        context: "location_based" | "non_location"
        my_breakdown: 내 점수 breakdown dict
        my_total_score: 내 종합 점수
        competitor_scores: 경쟁사 점수 목록
        avg_breakdown: 업종 평균 breakdown (없으면 경쟁사 평균으로 대체)
        gap_card_url: 공유 이미지 URL (선택)

    Returns:
        GapAnalysis 도메인 모델
    """
    try:
        ctx = ScanContext(context)
    except ValueError:
        ctx = ScanContext.LOCATION_BASED

    weights = get_weights_for_context(context)
    reasons = _GAP_REASONS[ctx]

    # 1위 경쟁사 찾기
    sorted_comps = sorted(competitor_scores, key=lambda x: x.get("score", 0), reverse=True)
    top_comp = sorted_comps[0] if sorted_comps else None

    top_name = top_comp["name"] if top_comp else "경쟁사"
    top_score = top_comp["score"] if top_comp else my_total_score
    top_breakdown = top_comp.get("breakdown") or {} if top_comp else {}

    # breakdown이 비어 있으면 총점 기반 차원 추정 (exposure_freq 비중 강조)
    if top_comp and not top_breakdown and top_score > 0:
        ratio = top_score / 100.0
        top_breakdown = {
            "keyword_gap_score":        round(top_score * 1.1, 1),
            "review_quality":           round(top_score * ratio, 1),
            "smart_place_completeness": round(top_score * 1.05 * ratio, 1),
            "naver_exposure_confirmed":  round(top_score * 0.9 * ratio, 1),
            "multi_ai_exposure":        round(top_score * ratio, 1),
            "schema_seo":               round(top_score * 0.85 * ratio, 1),
        }

    # 평균 breakdown 계산 (없으면 경쟁사 평균)
    if not avg_breakdown and sorted_comps:
        avg_breakdown = {}
        for key in _DIMENSION_LABELS:
            vals = [c.get("breakdown", {}).get(key, 0) for c in sorted_comps if c.get("breakdown")]
            avg_breakdown[key] = (sum(vals) / len(vals)) if vals else my_breakdown.get(key, 0)
    elif not avg_breakdown:
        avg_breakdown = my_breakdown.copy()

    # DimensionGap 계산
    dimensions: list[DimensionGap] = []
    for key, label in _DIMENSION_LABELS.items():
        my_val = my_breakdown.get(key, 0)
        top_val = top_breakdown.get(key, my_val)
        avg_val = avg_breakdown.get(key, my_val)
        gap = max(0.0, top_val - my_val)
        weight = weights.get(key, 0.10)

        reason_fn = reasons.get(key)
        reason = reason_fn(gap) if callable(reason_fn) else f"{label} 개선 필요"

        dimensions.append(DimensionGap(
            dimension_key=key,
            dimension_label=label,
            my_score=round(my_val, 1),
            top_score=round(top_val, 1),
            avg_score=round(avg_val, 1),
            gap_to_top=round(gap, 1),
            gap_reason=reason,
            improvement_potential=_improvement_potential(gap, weight),
            weight=weight,
            priority=0,  # 아래에서 재정렬
        ))

    # 우선순위 결정: gap × weight (개선 시 점수 효과 기준) 내림차순
    dimensions.sort(key=lambda d: d.gap_to_top * d.weight, reverse=True)
    for i, dim in enumerate(dimensions, 1):
        dimensions[i - 1] = dim.model_copy(update={"priority": i})

    # 가장 큰 격차 항목
    strongest = max(dimensions, key=lambda d: d.gap_to_top) if dimensions else None
    strongest_label = strongest.dimension_label if strongest else "AI 검색 노출"

    # 우선순위 상위 3개 개선 시 예상 점수
    top3 = dimensions[:3]
    estimated_gain = sum(d.gap_to_top * d.weight * 0.7 for d in top3)  # 70% 달성 가정
    estimated_score = min(100.0, round(my_total_score + estimated_gain, 1))

    # closeable_gap: 상위 3개 격차의 합
    closeable = sum(d.gap_to_top * 0.7 for d in top3)

    vs_top = CompetitorGap(
        top_competitor_name=top_name,
        top_competitor_score=round(top_score, 1),
        my_score=round(my_total_score, 1),
        total_gap=round(max(0.0, top_score - my_total_score), 1),
        strongest_gap_dimension=strongest_label,
        closeable_gap=round(closeable, 1),
    )

    # v3.0 — growth_stage는 track1_score 기준 (파라미터로 전달된 경우 우선 사용)
    # biz_data가 있으면 실제 사업장 상태 반영
    # ────────────────────────────────────────────────────────────────
    # 네이버는 ChatGPT·Gemini·Claude 크롤러를 robots.txt로 전면 차단 (2023~)
    # 독립 웹사이트 없는 location_based 사업장 → 글로벌 AI에서 완전 비노출
    # schema_score < 40: 스마트플레이스만 있고 웹사이트 없음으로 판단
    naver_only = (ctx == ScanContext.LOCATION_BASED and my_breakdown.get("schema_seo", 0) < 40)

    # 웹사이트 + JSON-LD 등록 시 예상 점수 상승폭
    # schema_score 0→60 가정 × 가중치(0.20) + online_mentions +20 × 가중치(0.15)
    naver_only_impact = 0.0
    if naver_only:
        schema_gap = max(0.0, 60.0 - my_breakdown.get("schema_seo", 0))
        schema_weight = weights.get("schema_seo", 0.15)
        mention_weight = weights.get("multi_ai_exposure", 0.20)
        naver_only_impact = round(schema_gap * schema_weight + 20.0 * mention_weight, 1)

    # v2.5 — 키워드 갭 + 성장 단계 계산
    keyword_gap: ReviewKeywordGap | None = None
    if category and ctx == ScanContext.LOCATION_BASED:
        # location_based 사업장: 네이버 AI 브리핑 핵심 전장
        try:
            keyword_gap = _build_keyword_gap(
                category=category,
                business_name=business_name or "사업장",
                review_excerpts=review_excerpts,
                competitor_review_excerpts=competitor_review_excerpts,
            )
        except Exception as e:
            _logger.warning(f"keyword_gap 계산 실패 (biz={business_id}): {e}")
    elif category and ctx == ScanContext.NON_LOCATION and review_excerpts:
        # non_location 사업장: 전문 콘텐츠 키워드 분석 (네이버 비해당)
        try:
            from services.keyword_taxonomy import analyze_nonlocation_keywords
            nl_result = analyze_nonlocation_keywords(
                category=category,
                business_name=business_name or "사업장",
                ai_excerpts=review_excerpts,
            )
            # ReviewKeywordGap 형식으로 변환 (non_location 호환)
            keyword_gap = ReviewKeywordGap(
                covered_keywords=nl_result["covered"],
                missing_keywords=nl_result["missing"],
                competitor_only_keywords=[],
                pioneer_keywords=[],
                coverage_rate=nl_result["coverage_rate"],
                top_priority_keyword=nl_result["top_priority_keyword"],
                qr_card_message=nl_result["advice"],
                category_scores={},
            )
        except Exception as e:
            _logger.warning(f"nonlocation keyword_gap 계산 실패 (biz={business_id}): {e}")

    growth_stage = _build_growth_stage(my_total_score, track1_score=track1_score, biz_data=biz_data)

    return GapAnalysis(
        business_id=business_id,
        scan_id=scan_id,
        analyzed_at=datetime.now(timezone.utc),
        context=ctx,
        vs_top=vs_top,
        dimensions=dimensions,
        gap_card_url=gap_card_url,
        estimated_score_if_fixed=estimated_score,
        naver_only_risk=naver_only,
        naver_only_risk_score_impact=naver_only_impact,
        keyword_gap=keyword_gap,
        growth_stage=growth_stage,
    )


async def analyze_gap_from_db(business_id: str, supabase) -> Optional[GapAnalysis]:
    """DB에서 최신 스캔 + 경쟁사 데이터 로드 후 GapAnalysis 반환"""
    from db.supabase_client import execute

    # 사업장 정보 (category, name, 블로그 분석 결과 + 스마트플레이스 실제 상태 포함)
    biz_row = (await execute(
        supabase.table("businesses")
        .select("id, name, category, region, business_type, review_sample, keywords, blog_url, blog_keyword_coverage, blog_latest_post_date, blog_analyzed_at, is_smart_place, has_faq, has_intro, has_recent_post, review_count")
        .eq("id", business_id)
        .single()
    )).data
    if not biz_row:
        return None

    context = biz_row.get("business_type") or "location_based"
    category = biz_row.get("category") or ""
    business_name = biz_row.get("name") or ""

    # 최신 스캔 결과 (track1_score, naver_result 포함)
    scan_row = (await execute(
        supabase.table("scan_results")
        .select("id, total_score, track1_score, score_breakdown, competitor_scores, naver_result, gemini_result, keyword_coverage")
        .eq("business_id", business_id)
        .order("scanned_at", desc=True)
        .limit(1)
    )).data
    if not scan_row:
        return None

    scan = scan_row[0]
    my_breakdown = scan.get("score_breakdown") or {}
    my_total = float(scan.get("total_score", 0))
    my_track1 = scan.get("track1_score")
    if my_track1 is not None:
        my_track1 = float(my_track1)
    scan_id = scan["id"]

    # keyword_coverage_rate: DB에 저장된 값 우선 활용 (cold start 방지)
    stored_coverage = scan.get("keyword_coverage")
    keyword_coverage_rate: float | None = float(stored_coverage) if stored_coverage is not None else None

    # 리뷰 발췌문 수집 — 다단계 우선순위로 keyword_gap 계산에 사용
    review_excerpts: list[str] = []
    _seen_excerpts: set[str] = set()

    def _add_excerpt(text: str) -> None:
        """중복 제거하여 발췌문 추가"""
        t = (text or "").strip()
        if t and t not in _seen_excerpts:
            _seen_excerpts.add(t)
            review_excerpts.append(t)

    # 1순위: businesses.review_sample (사용자가 직접 입력한 리뷰 — 가장 신뢰도 높음)
    biz_review_sample = biz_row.get("review_sample") or ""
    if biz_review_sample:
        _add_excerpt(biz_review_sample)

    # 1b순위: businesses.keywords[] (스마트플레이스 등록 키워드 — 이미 등록된 키워드를 missing으로 잘못 표시 방지)
    # 소상공인이 스마트플레이스에 등록한 대표 키워드·소개글 키워드는 AI에게도 노출됨
    # → 이 키워드들은 "있는 키워드"로 인식해야 함
    biz_keywords = biz_row.get("keywords") or []
    if isinstance(biz_keywords, list) and biz_keywords:
        _add_excerpt(" ".join(biz_keywords))  # 공백으로 연결해 단일 텍스트로 처리

    # 2순위: naver_result / gemini_result 스캔 결과에서 텍스트 추출
    for result_key in ("naver_result", "gemini_result"):
        result_data = scan.get(result_key) or {}
        if isinstance(result_data, dict):
            # 단일 텍스트 필드 (answer_summary 추가 — single_check_with_competitors 반환값)
            for field in ("excerpt", "context", "mention_text", "review_text", "answer_summary"):
                val = result_data.get(field)
                if isinstance(val, str) and val:
                    _add_excerpt(val)
            # 리스트 형식 필드 (citations 추가 — gemini single_check 반환값)
            for field in ("citations", "excerpts", "reviews", "mentions"):
                items = result_data.get(field)
                if isinstance(items, list):
                    for item in items:
                        if isinstance(item, str):
                            _add_excerpt(item)
                        elif isinstance(item, dict):
                            _add_excerpt(item.get("text") or item.get("excerpt") or "")

    # 3순위: naver_result.top_blogs — 블로그 제목/설명
    naver_result_data = scan.get("naver_result") or {}
    top_blogs = naver_result_data.get("top_blogs") or []
    for blog in top_blogs:
        if isinstance(blog, dict):
            text = blog.get("description") or blog.get("title") or ""
            _add_excerpt(text)

    # 4순위: ai_citations 테이블에서 추가 발췌문 (최근 20개)
    try:
        cit_rows = (await execute(
            supabase.table("ai_citations")
            .select("excerpt")
            .eq("business_id", business_id)
            .order("created_at", desc=True)
            .limit(20)
        )).data or []
        for row in cit_rows:
            _add_excerpt(row.get("excerpt") or "")
    except Exception as e:
        _logger.debug(f"ai_citations skip: {e}")

    # 경쟁사 점수 + 리뷰 발췌문 수집 (scan_results.competitor_scores JSONB)
    raw_comp_scores = scan.get("competitor_scores") or {}
    competitor_scores = []
    competitor_review_excerpts: list[str] = []
    for comp_id, data in raw_comp_scores.items():
        if isinstance(data, dict):
            competitor_scores.append({
                "name": data.get("name", comp_id),
                "score": float(data.get("score", 0)),
                "breakdown": data.get("breakdown", {}),
            })
            # Gemini 스캔 시 저장된 발췌문 수집 (scan.py에서 저장)
            excerpt = data.get("excerpt", "")
            if excerpt and isinstance(excerpt, str):
                competitor_review_excerpts.append(excerpt)

    # 블로그 진단 결과 — DB에 저장된 분석 결과를 GapAnalysis에 포함
    blog_diagnosis: dict | None = None
    blog_analyzed_at = biz_row.get("blog_analyzed_at")
    if blog_analyzed_at and biz_row.get("blog_url"):
        blog_diagnosis = {
            "blog_url": biz_row.get("blog_url"),
            "keyword_coverage": biz_row.get("blog_keyword_coverage"),
            "post_count": biz_row.get("blog_post_count"),
            "latest_post_date": (
                biz_row["blog_latest_post_date"].isoformat()
                if hasattr(biz_row.get("blog_latest_post_date"), "isoformat")
                else biz_row.get("blog_latest_post_date")
            ),
            "analyzed_at": (
                blog_analyzed_at.isoformat()
                if hasattr(blog_analyzed_at, "isoformat")
                else blog_analyzed_at
            ),
        }

    # 경쟁사 미등록 시 성장 단계만 계산하여 반환 (GapAnalysis 최소 버전)
    if not competitor_scores:
        growth_stage = _build_growth_stage(my_total, track1_score=my_track1, biz_data=biz_row)
        # 경쟁사 없을 때: 내 점수와 업종 평균(55점) 기준 기본 vs_top 생성
        fallback_top_score = max(my_total + 10.0, 55.0)
        fallback_vs_top = CompetitorGap(
            top_competitor_name="업종 평균",
            top_competitor_score=round(fallback_top_score, 1),
            my_score=round(my_total, 1),
            total_gap=round(max(0.0, fallback_top_score - my_total), 1),
            strongest_gap_dimension="경쟁사 데이터 없음",
            closeable_gap=0.0,
        )
        weights = get_weights_for_context(context)
        _raw_fallback_dims = [
            DimensionGap(
                dimension_key=key,
                dimension_label=label,
                my_score=round(my_breakdown.get(key, 0), 1),
                top_score=round(min(100, my_breakdown.get(key, 0) + 15), 1),
                avg_score=55.0,
                gap_to_top=round(max(0, 55.0 - my_breakdown.get(key, 0)), 1),
                gap_reason=f"{label} 개선 필요 (경쟁사 미등록 — 업종 평균 기준)",
                improvement_potential="medium",
                weight=weights.get(key, 0.10),
                priority=0,
            )
            for key, label in _DIMENSION_LABELS.items()
        ]
        # gap × weight 내림차순 정렬 후 우선순위 부여 (명세 § 7)
        _raw_fallback_dims.sort(key=lambda d: d.gap_to_top * d.weight, reverse=True)
        fallback_dims = [
            d.model_copy(update={"priority": i + 1})
            for i, d in enumerate(_raw_fallback_dims)
        ]
        keyword_gap_result = None
        if category and ScanContext(context) == ScanContext.LOCATION_BASED:
            try:
                keyword_gap_result = _build_keyword_gap(
                    category=category,
                    business_name=business_name or "사업장",
                    review_excerpts=review_excerpts or None,
                    competitor_review_excerpts=None,
                )
            except Exception as e:
                _logger.warning(f"keyword_gap fallback 계산 실패 (biz={business_id}): {e}")
        # keyword_coverage_rate가 있으면 활용
        if keyword_gap_result is None and keyword_coverage_rate is not None and category:
            try:
                keyword_gap_result = _build_keyword_gap(
                    category=category,
                    business_name=business_name or "사업장",
                    review_excerpts=review_excerpts or None,
                    competitor_review_excerpts=None,
                )
            except Exception as e:
                _logger.warning(f"keyword_gap fallback 계산 실패 (biz={business_id}): {e}")
        return GapAnalysis(
            business_id=business_id,
            scan_id=scan_id,
            analyzed_at=datetime.now(timezone.utc),
            context=ScanContext(context),
            vs_top=fallback_vs_top,
            dimensions=fallback_dims,
            gap_card_url=None,
            estimated_score_if_fixed=min(100.0, round(my_total + 15.0, 1)),
            naver_only_risk=(ScanContext(context) == ScanContext.LOCATION_BASED and my_breakdown.get("schema_seo", 0) < 40),
            naver_only_risk_score_impact=0.0,
            keyword_gap=keyword_gap_result,
            growth_stage=growth_stage,
            blog_diagnosis=blog_diagnosis,
        )

    gap_result = analyze_gap(
        business_id=business_id,
        scan_id=scan_id,
        context=context,
        my_breakdown=my_breakdown,
        my_total_score=my_total,
        competitor_scores=competitor_scores,
        category=category,
        business_name=business_name,
        review_excerpts=review_excerpts or None,
        competitor_review_excerpts=competitor_review_excerpts or None,
        track1_score=my_track1,
        biz_data=biz_row,
    )
    # blog_diagnosis는 analyze_gap() 파라미터가 아니므로 반환 후 주입
    return gap_result.model_copy(update={"blog_diagnosis": blog_diagnosis})
