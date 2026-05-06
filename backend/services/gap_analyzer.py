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

# 항목별 한국어 레이블 (v3.0 + v3.1 신규 6항목)
_DIMENSION_LABELS = {
    "keyword_gap_score":        "키워드 커버리지",
    "review_quality":           "리뷰 품질",
    "smart_place_completeness": "스마트플레이스 완성도",
    "naver_exposure_confirmed":  "네이버 AI 브리핑 노출",
    "multi_ai_exposure":        "글로벌 AI 노출",
    "schema_seo":               "웹사이트 구조화",
    # v3.1 신규 (SCORE_MODEL_VERSION=v3_1 토글 시)
    "keyword_search_rank":      "네이버 키워드 검색 노출",
    "blog_crank":               "블로그 생태계 (C-rank 추정)",
    "local_map_score":          "지도/플레이스 + 카카오맵",
    "ai_briefing_score":        "AI 브리핑 인용",
}

# context별 gap_reason 템플릿 (dimension_key → callable)
_GAP_REASONS = {
    ScanContext.LOCATION_BASED: {
        "keyword_gap_score": lambda gap: (
            f"AI 브리핑에 자주 나오는 업종 키워드가 부족합니다 (경쟁사 대비 -{gap:.0f}점 차이). 리뷰·소개글에 핵심 키워드를 추가하면 조건 검색 노출이 늘어납니다."
            if gap > 0 else
            "AI 브리핑 업종 키워드가 아직 분석 중입니다. 리뷰·소개글에 업종 키워드를 추가하세요."
        ),
        "review_quality": lambda gap: (
            f"리뷰 수나 평점이 경쟁사보다 부족합니다 (-{gap:.0f}점 차이). 키워드가 포함된 리뷰를 늘리면 AI 브리핑 노출이 개선됩니다."
            if gap > 0 else
            "리뷰를 꾸준히 받아 평점을 높이세요. 키워드가 포함된 리뷰는 AI 브리핑 노출에 직접 영향을 줍니다."
        ),
        "smart_place_completeness": lambda gap: "소개글·소식 탭이 비어있습니다. 소개글에 지역명·업종·Q&A 섹션을 추가하고 소식을 30일에 1번 이상 올리면 AI 브리핑 인용 후보에 포함될 가능성이 높아집니다.",
        "naver_exposure_confirmed": lambda gap: (
            f"네이버 AI 브리핑에 가게가 아직 나오지 않습니다 (경쟁사 대비 -{gap:.0f}점 차이). 소개글 Q&A 섹션 작성과 소식 업로드가 가장 빠른 방법입니다."
            if gap > 0 else
            "네이버 AI 브리핑에 가게가 아직 노출되지 않습니다. 소개글 하단에 고객 자주 묻는 질문 3개와 답변을 추가해 보세요."
        ),
        "multi_ai_exposure": lambda gap: (
            f"ChatGPT·구글 AI에서 가게가 검색되지 않습니다 (경쟁사 대비 -{gap:.0f}점 차이). ① 구글 비즈니스 프로필 등록, ② 네이버 블로그에 가게 소개 글 발행이 홈페이지 없이도 가장 빠른 방법입니다."
            if gap > 0 else
            "ChatGPT·구글 AI에서 가게가 아직 검색되지 않습니다. 구글 비즈니스 프로필을 등록하고 네이버 블로그에 가게 소개 글을 올리세요. 가게 홈페이지가 있다면 가이드 탭의 'AI 정보 코드'를 추가하면 더 빠릅니다."
        ),
        "schema_seo": lambda gap: (
            "구글·ChatGPT가 가게 정보를 정확히 인식하려면 'AI 정보 코드' 등록이 필요합니다. 가게 홈페이지가 있다면 가이드 탭에서 자동 생성된 코드를 복사해 붙여넣으세요. 홈페이지가 없다면 구글 비즈니스 프로필 완성 + 스마트플레이스 정보 채우기가 동일한 효과를 냅니다."
            if gap == 0 else
            "구글·ChatGPT가 인식하는 가게 정보가 경쟁사보다 부족합니다. 가게 홈페이지가 있다면 가이드 탭의 'AI 정보 코드'를 추가하고, 없다면 구글 비즈니스 프로필을 먼저 완성하세요."
        ),
        # v3.1 신규 4개 항목 (SCORE_MODEL_VERSION=v3_1 토글 시 score_breakdown에 포함됨)
        "keyword_search_rank": lambda gap: (
            f"네이버 키워드 검색 순위가 경쟁사보다 낮습니다 (경쟁사 대비 -{gap:.0f}점 차이). 스마트플레이스 소개글에 주력 키워드를 2~3개 추가하면 순위 개선에 직접 영향을 줍니다."
            if gap > 0 else
            "키워드 검색 순위는 측정 후 표시됩니다. 스마트플레이스 소개글에 업종 핵심 키워드를 포함하면 순위가 안정됩니다."
        ),
        "blog_crank": lambda gap: (
            f"블로그 C-rank 추정 점수가 경쟁사보다 낮습니다 (경쟁사 대비 -{gap:.0f}점 차이). 네이버 블로그에 가게 소개 글을 월 1~2회 꾸준히 발행하면 C-rank가 서서히 올라갑니다."
            if gap > 0 else
            "블로그 발행 이력이 확인되지 않습니다. 네이버 블로그를 개설하고 가게 소개 글 1개를 올리는 것이 첫 단계입니다."
        ),
        "local_map_score": lambda gap: (
            f"지도/카카오맵 노출이 경쟁사보다 부족합니다 (경쟁사 대비 -{gap:.0f}점 차이). 카카오맵 사업장 정보를 등록하고 대표 사진 3장 이상을 추가하면 지도 노출이 늘어납니다."
            if gap > 0 else
            "카카오맵 사업장 등록 여부를 확인하세요. 등록 후 영업시간·전화번호·사진을 채우면 지도 검색 노출이 시작됩니다."
        ),
        "ai_briefing_score": lambda gap: (
            f"AI 브리핑 인용 점수가 경쟁사보다 낮습니다 (경쟁사 대비 -{gap:.0f}점 차이). 소개글에 Q&A 섹션(자주 묻는 질문 3개)을 추가하는 것이 가장 빠른 인용 개선 방법입니다."
            if gap > 0 else
            "AI 브리핑에 아직 인용되지 않습니다. 소개글 Q&A 섹션 작성 후 네이버가 반영하는 시점은 측정으로만 확인 가능하며, 다음 스캔에서 변화를 확인하실 수 있습니다."
        ),
    },
    ScanContext.NON_LOCATION: {
        "keyword_gap_score": lambda gap: (
            f"전문 분야 키워드가 경쟁사보다 부족합니다 (경쟁사 대비 -{gap:.0f}점 차이). 웹사이트·블로그 콘텐츠에 전문 키워드를 추가하세요."
            if gap > 0 else
            "전문 분야 키워드를 웹사이트·블로그 콘텐츠에 추가하면 AI 검색 노출이 시작됩니다."
        ),
        "review_quality": lambda gap: (
            f"전문가 리뷰·포트폴리오가 경쟁사보다 부족합니다 (경쟁사 대비 -{gap:.0f}점 차이)."
            if gap > 0 else
            "고객 사례·포트폴리오를 웹사이트에 추가하면 AI가 전문성을 인식하기 시작합니다."
        ),
        "smart_place_completeness": lambda gap: "온라인 프로필(구글 비즈니스·네이버 블로그)이 비어있습니다. 소개글과 대표 서비스 키워드를 채워주세요.",
        "naver_exposure_confirmed": lambda gap: (
            f"네이버 AI 브리핑에 아직 노출되지 않습니다 (경쟁사 대비 -{gap:.0f}점 차이). 네이버 블로그·지식인에 전문 콘텐츠를 발행하세요."
            if gap > 0 else
            "네이버 AI 브리핑 노출을 위해 네이버 블로그에 전문 콘텐츠를 1주에 1개 이상 발행하세요."
        ),
        "multi_ai_exposure": lambda gap: (
            f"ChatGPT·Gemini·Google AI에서 아직 인용되지 않습니다 (경쟁사 대비 -{gap:.0f}점 차이). 전문 블로그 글·인터뷰·기사가 필요합니다."
            if gap > 0 else
            "전문 블로그·인터뷰·기사를 작성하면 ChatGPT·Gemini·Google AI가 인용하기 시작합니다."
        ),
        "schema_seo": lambda gap: "구글·ChatGPT가 사업자 정보를 정확히 파악하려면 'AI 정보 코드' 등록이 필요합니다. 홈페이지가 있다면 가이드 탭에서 코드를 복사해 붙여넣으세요. 홈페이지가 없다면 구글 비즈니스 프로필과 네이버 블로그 소개 페이지가 대안입니다.",
        # v3.1 신규 4개 항목
        "keyword_search_rank": lambda gap: (
            f"키워드 검색 순위가 경쟁사보다 낮습니다 (경쟁사 대비 -{gap:.0f}점 차이). 웹사이트 주요 페이지 제목·소개글에 전문 키워드를 2~3개 추가하면 순위 개선에 직접 영향을 줍니다."
            if gap > 0 else
            "키워드 검색 순위는 측정 후 표시됩니다. 웹사이트·블로그 소개글에 전문 분야 핵심 키워드를 포함하면 순위가 안정됩니다."
        ),
        "blog_crank": lambda gap: (
            f"블로그 C-rank 추정 점수가 경쟁사보다 낮습니다 (경쟁사 대비 -{gap:.0f}점 차이). 전문 분야 블로그 글을 월 1~2회 꾸준히 발행하면 C-rank가 서서히 올라갑니다."
            if gap > 0 else
            "블로그 발행 이력이 확인되지 않습니다. 네이버 블로그나 전문 블로그에 서비스 소개 글 1개를 올리는 것이 첫 단계입니다."
        ),
        "local_map_score": lambda gap: (
            f"지도/카카오맵 노출이 경쟁사보다 부족합니다 (경쟁사 대비 -{gap:.0f}점 차이). 카카오맵 사업장 정보를 등록하고 연락처·서비스 설명을 완성하면 지도 노출이 늘어납니다."
            if gap > 0 else
            "카카오맵 사업장 등록 여부를 확인하세요. 등록 후 기본 정보를 채우면 지도 검색 노출이 시작됩니다."
        ),
        "ai_briefing_score": lambda gap: (
            f"AI 검색 인용 점수가 경쟁사보다 낮습니다 (경쟁사 대비 -{gap:.0f}점 차이). 웹사이트에 FAQ 페이지를 추가하거나 네이버 블로그에 자주 묻는 질문 글을 작성하면 AI 인용이 늘어납니다."
            if gap > 0 else
            "AI 검색에 아직 인용되지 않습니다. 서비스 FAQ를 온라인에 공개하면 ChatGPT·Gemini가 인용하기 시작하며, 반영 여부는 다음 스캔에서 확인하실 수 있습니다."
        ),
    },
}


def _build_gap_reason(
    dimension: str,
    gap: float,
    context: "ScanContext",
    keyword_gap=None,
) -> str:
    """dimension별 gap_reason 문자열 반환.

    keyword_gap(ReviewKeywordGap)이 있으면 competitor_only_keywords[:3]을
    메시지에 포함해 구체적인 조언을 제공한다.
    없으면 기존 _GAP_REASONS 람다 결과를 그대로 반환한다.
    """
    try:
        base_fn = _GAP_REASONS[context].get(dimension)
        base = base_fn(gap) if callable(base_fn) else f"{dimension} 개선 필요"
    except Exception as e:
        _logger.warning(f"_build_gap_reason {dimension}: {e}")
        base = f"{dimension} 개선 필요"

    if dimension != "keyword_gap_score" or keyword_gap is None:
        return base

    try:
        comp_only = getattr(keyword_gap, "competitor_only_keywords", None) or []
        if not comp_only:
            return base
        kw_str = ", ".join(comp_only[:3])
        return (
            f"경쟁사엔 있고 내 리뷰에 없는 키워드: {kw_str} "
            f"→ 이 키워드를 리뷰/FAQ에 추가하면 AI 브리핑 노출이 늘어납니다."
        )
    except Exception as e:
        _logger.warning("_enrich_with_competitor_keywords 실패: %s", e)
        return base


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
    competitor_excerpts_by_name: dict[str, str] | None = None,
    business_keywords: list[str] | None = None,
    excluded_keywords: list[str] | None = None,
    custom_keywords: list[str] | None = None,
) -> ReviewKeywordGap:
    """
    업종별 키워드 분류 체계 기반 리뷰 키워드 격차 분석.

    "리뷰 품질 -15점"이 아니라
    "이 키워드들이 리뷰에 없어서 AI 브리핑 조건 검색에 안 나옵니다"를 알려줍니다.

    competitor_excerpts_by_name: {경쟁사명: excerpt 텍스트} — 경쟁사별 키워드 분류에 사용
    business_keywords: 사업장 등록 키워드 — taxonomy 오버라이드 판단에 사용
        (예: education 카테고리인데 "녹음", "작곡" → music taxonomy 자동 전환)
    """
    from services.keyword_taxonomy import get_all_keywords_flat, _infer_taxonomy_key, KEYWORD_TAXONOMY

    # business_keywords는 "taxonomy 오버라이드 감지용", custom_keywords는 "추가될 키워드".
    # custom_keywords가 명시되지 않으면 business_keywords에서 승계.
    _bus_kw_for_tax = business_keywords if business_keywords else None
    _custom_kw = custom_keywords if custom_keywords is not None else (business_keywords or [])

    result = analyze_keyword_coverage(
        category=category,
        review_excerpts=review_excerpts or [],
        competitor_review_excerpts=competitor_review_excerpts,
        business_keywords=_custom_kw,
        excluded_keywords=excluded_keywords,
    )

    top_kw = result["top_priority_keyword"]
    qr_msg = build_qr_message(
        top_priority_keyword=top_kw,
        missing_keywords=result["missing"],
        business_name=business_name,
    )

    # 경쟁사별 키워드 분류: 내 가게에 없고 해당 경쟁사 텍스트에 있는 키워드
    # taxonomy 오버라이드 반영: business_keywords로 결정된 실제 taxonomy key 사용
    competitor_keyword_sources: dict[str, list[str]] = {}
    if competitor_excerpts_by_name:
        _eff_key = _infer_taxonomy_key(category, _bus_kw_for_tax)
        _eff_industry = KEYWORD_TAXONOMY.get(_eff_key, KEYWORD_TAXONOMY["restaurant"])
        all_kws = [kw for cd in sorted(_eff_industry.values(), key=lambda x: x["weight"], reverse=True) for kw in cd["keywords"]]
        # excluded 키워드는 경쟁사 소스에서도 제외
        _excl = {k for k in (excluded_keywords or []) if isinstance(k, str) and k.strip()}
        if _excl:
            all_kws = [kw for kw in all_kws if kw not in _excl]
        my_missing_set = set(result["missing"])
        for comp_name, comp_text in competitor_excerpts_by_name.items():
            if not comp_text:
                continue
            comp_lower = comp_text.lower()
            comp_nospace = comp_lower.replace(" ", "")
            found = [
                kw for kw in all_kws
                if kw in my_missing_set
                and (kw.replace(" ", "") in comp_nospace or kw in comp_lower)
            ]
            if found:
                competitor_keyword_sources[comp_name] = found[:6]  # 경쟁사당 최대 6개

    return ReviewKeywordGap(
        covered_keywords=result["covered"],
        missing_keywords=result["missing"],
        competitor_only_keywords=result["competitor_only"],
        pioneer_keywords=result["pioneer"],
        coverage_rate=result["coverage_rate"],
        top_priority_keyword=top_kw,
        qr_card_message=qr_msg,
        category_scores=result["category_scores"],
        competitor_keyword_sources=competitor_keyword_sources,
    )


# 성장 단계별 설정 (score_engine._GROWTH_THRESHOLDS 기준과 동기화)
_GROWTH_STAGES = [
    {
        "stage": "survival",
        "stage_label": "생존기",
        "score_range": "0~30점",
        "focus_message": "지금은 스마트플레이스 기본 완성이 최우선입니다. AI가 내 가게를 인식할 수 있도록 기본 정보를 채워야 합니다.",
        "this_week_action": "스마트플레이스에서 사진 5장·영업시간·전화번호 완성하기",
        "do_not_do": "블로그 광고비 지출, SNS 채널 새로 만들기 (기본이 먼저입니다)",
        "estimated_weeks_to_next": 4,
    },
    {
        "stage": "stability",
        "stage_label": "안정기",
        "score_range": "30~55점",
        "focus_message": "기본은 갖췄습니다. 이제 소개글 Q&A 섹션 작성과 리뷰로 AI 브리핑 노출을 늘릴 차례입니다.",
        "this_week_action": "소개글 하단에 자주 묻는 질문 3개와 답변 작성하기",
        "do_not_do": "리뷰 조작·구매, 허위 정보 등록 (네이버 제재 대상)",
        "estimated_weeks_to_next": 6,
    },
    {
        "stage": "growth",
        "stage_label": "성장기",
        "score_range": "55~75점",
        "focus_message": "경쟁사보다 앞서기 시작했습니다. 키워드 다양화와 소식 업로드로 격차를 벌리세요.",
        "this_week_action": "소식 탭에 최근 작업 사진 1~2장 + 짧은 글 올리기",
        "do_not_do": "기존에 잘 되는 키워드 갑자기 변경, 운영 중단",
        "estimated_weeks_to_next": 8,
    },
    {
        "stage": "dominance",
        "stage_label": "지배기",
        "score_range": "75~100점",
        "focus_message": "지역 상위권입니다. 지금은 현상 유지와 리뷰 꾸준히 받기가 핵심입니다.",
        "this_week_action": "신규 리뷰에 키워드 포함 답글 달기 (3분이면 충분)",
        "do_not_do": "급격한 카테고리 변경, 스마트플레이스 정보 대량 수정",
        "estimated_weeks_to_next": None,
    },
]


def _build_growth_stage(
    total_score: float,
    track1_score: float | None = None,
    biz_data: dict | None = None,
    competitor_scores: list[dict] | None = None,
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

    # 스마트플레이스 미등록: 등록이 최우선 — score/단계 무관하게 조기 반환
    if biz_data and not is_smart_place:
        cfg = _GROWTH_STAGES[0]  # 생존기
        return GrowthStage(
            stage=cfg["stage"],
            stage_label=cfg["stage_label"],
            score_range=cfg["score_range"],
            focus_message="스마트플레이스를 먼저 등록해야 합니다. 등록 후 AI 브리핑 노출이 시작됩니다.",
            this_week_action="스마트플레이스 등록하기 (smartplace.naver.com) — AI 브리핑 노출의 첫 번째 조건입니다",
            do_not_do=cfg["do_not_do"],
            estimated_weeks_to_next=cfg["estimated_weeks_to_next"],
        )

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
            missing.append("소개글 하단에 Q&A 5개 추가 (네이버 AI 브리핑 인용 후보)")
        if not has_intro:
            missing.append("소개글에 핵심 키워드 2~3개 포함한 2문장 작성")
        if not has_recent_post:
            missing.append("소식 탭에 최근 작업 사진 1~2장 + 짧은 글 올리기")
        if missing:
            this_week_action = " → ".join(missing[:2])  # 가장 중요한 2개만

    # 경쟁사 평균 점수를 focus_message에 포함 (데이터 있을 때만)
    focus_message = cfg["focus_message"]
    if competitor_scores:
        try:
            valid_scores = [
                float(c.get("score", 0))
                for c in competitor_scores
                if isinstance(c, dict) and c.get("score") is not None
            ]
            if valid_scores:
                comp_avg = round(sum(valid_scores) / len(valid_scores), 1)
                my_rounded = round(score, 1)
                if my_rounded > comp_avg:
                    focus_message = (
                        f"지역 경쟁사 평균 {comp_avg}점 대비 당신은 {my_rounded}점 — "
                        f"앞서고 있습니다. {cfg['focus_message']}"
                    )
                else:
                    gap_to_avg = round(comp_avg - my_rounded, 1)
                    focus_message = (
                        f"지역 경쟁사 평균 {comp_avg}점 대비 당신은 {my_rounded}점 "
                        f"({gap_to_avg}점 차이). {cfg['focus_message']}"
                    )
        except Exception as e:
            _logger.warning(f"competitor_scores focus_message 주입 실패: {e}")

    return GrowthStage(
        stage=cfg["stage"],
        stage_label=cfg["stage_label"],
        score_range=cfg["score_range"],
        focus_message=focus_message,
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
    competitor_excerpts_by_name: dict[str, str] | None = None,
    # taxonomy 오버라이드용 — 사업장 등록 키워드 (education→music 등 오추천 방지)
    business_keywords: list[str] | None = None,
    # v3.2 — 사용자 맞춤 키워드 (keyword_resolver.get_user_keyword_prefs 결과)
    custom_keywords: list[str] | None = None,
    excluded_keywords: list[str] | None = None,
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

    # breakdown이 비어 있거나 전부 0인 경우 총점 기반 차원 추정
    _breakdown_has_real_data = bool(top_breakdown) and any(v > 0 for v in top_breakdown.values())
    _is_competitor_estimated = False
    if top_comp and not _breakdown_has_real_data and top_score > 0:
        ratio = top_score / 100.0
        top_breakdown = {
            "keyword_gap_score":        round(top_score * 1.1, 1),
            "review_quality":           round(top_score * ratio, 1),
            "smart_place_completeness": round(top_score * 1.05 * ratio, 1),
            "naver_exposure_confirmed":  round(top_score * 0.9 * ratio, 1),
            "multi_ai_exposure":        round(top_score * ratio, 1),
            "schema_seo":               round(top_score * 0.85 * ratio, 1),
            "keyword_search_rank":      round(top_score * ratio, 1),
            "blog_crank":               round(top_score * 0.8 * ratio, 1),
            "local_map_score":          round(top_score * ratio, 1),
            "ai_briefing_score":        round(top_score * 0.9 * ratio, 1),
        }
        _is_competitor_estimated = True

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

        reason = _build_gap_reason(key, gap, ctx, keyword_gap=None)

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

    # INACTIVE 업종: 네이버 AI 브리핑 관련 dimension 메시지 분기
    _eligibility = "active"
    if biz_data:
        from services.score_engine import get_briefing_eligibility
        _eligibility = get_briefing_eligibility(
            category or biz_data.get("category", ""),
            bool((biz_data or {}).get("is_franchise")),
        )
    if _eligibility == "inactive":
        _naver_inactive_dims = {"naver_exposure_confirmed", "ai_briefing_score", "smart_place_completeness"}
        for i, dim in enumerate(dimensions):
            if dim.dimension_key in _naver_inactive_dims:
                dimensions[i] = dim.model_copy(update={
                    "gap_reason": (
                        f"{dim.dimension_label} 항목은 이 업종({category})에서 네이버 AI 브리핑 대상이 아닙니다. "
                        "ChatGPT·Gemini·Google AI 노출을 위해 구글 비즈니스 프로필과 소개글 최적화에 집중하세요."
                    )
                })

    # 우선순위 결정: gap × weight (개선 시 점수 효과 기준) 내림차순
    dimensions.sort(key=lambda d: d.gap_to_top * d.weight, reverse=True)

    # gap=0인 항목과 실제 격차가 있는 항목 분리
    dims_with_gap = [d for d in dimensions if d.gap_to_top > 0]
    dims_zero_gap = [d for d in dimensions if d.gap_to_top == 0]

    # gap 있는 항목 먼저, gap=0 항목 뒤 순서로 우선순위 재부여
    all_sorted = dims_with_gap + dims_zero_gap
    for i, dim in enumerate(all_sorted, 1):
        all_sorted[i - 1] = dim.model_copy(update={"priority": i})
    dimensions = all_sorted

    # 가장 큰 격차 항목
    strongest = max(dimensions, key=lambda d: d.gap_to_top) if dimensions else None
    strongest_label = strongest.dimension_label if strongest else "AI 검색 노출"

    # gap 있는 항목만 상위 3개로 예상 점수 계산 (gap=0 항목이 top3에 섞이면 estimated_gain=0이 되는 문제 방지)
    top3_with_gap = dims_with_gap[:3]
    if top3_with_gap:
        estimated_gain = sum(d.gap_to_top * d.weight * 0.7 for d in top3_with_gap)  # 70% 달성 가정
        estimated_score = min(100.0, round(my_total_score + estimated_gain, 1))
    else:
        # 모든 격차가 0이면 estimated_score=0 반환 → 프론트에서 숨김 처리
        estimated_score = 0.0

    # closeable_gap: gap 있는 상위 3개 격차의 합
    closeable = sum(d.gap_to_top * 0.7 for d in top3_with_gap)

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
                competitor_excerpts_by_name=competitor_excerpts_by_name,
                business_keywords=business_keywords,
                custom_keywords=custom_keywords,
                excluded_keywords=excluded_keywords,
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
                excluded_keywords=excluded_keywords,
                business_keywords=custom_keywords or business_keywords,
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

    growth_stage = _build_growth_stage(
        my_total_score,
        track1_score=track1_score,
        biz_data=biz_data,
        competitor_scores=competitor_scores,
    )

    # keyword_gap 데이터로 keyword_gap_score dimension reason 보강
    if keyword_gap is not None:
        try:
            updated_dims = []
            for dim in dimensions:
                if dim.dimension_key == "keyword_gap_score":
                    new_reason = _build_gap_reason(
                        "keyword_gap_score", dim.gap_to_top, ctx, keyword_gap=keyword_gap
                    )
                    updated_dims.append(dim.model_copy(update={"gap_reason": new_reason}))
                else:
                    updated_dims.append(dim)
            dimensions = updated_dims
        except Exception as e:
            _logger.warning(f"keyword_gap reason 보강 실패 (biz={business_id}): {e}")

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
        is_competitor_estimated=_is_competitor_estimated,
    )


async def analyze_gap_from_db(business_id: str, supabase) -> Optional[GapAnalysis]:
    """DB에서 최신 스캔 + 경쟁사 데이터 로드 후 GapAnalysis 반환"""
    from db.supabase_client import execute
    from services.keyword_resolver import get_user_keyword_prefs

    # 사업장 정보 (category, name, 블로그 분석 결과 + 스마트플레이스 실제 상태 포함)
    biz_row = (await execute(
        supabase.table("businesses")
        .select("id, name, category, region, business_type, review_sample, keywords, blog_url, blog_keyword_coverage, blog_analysis_json, blog_post_count, blog_latest_post_date, blog_analyzed_at, is_smart_place, has_faq, has_intro, has_recent_post, review_count")
        .eq("id", business_id)
        .single()
    )).data
    if not biz_row:
        return None

    # 사용자 맞춤 키워드 prefs 조회 (DB 컬럼 없으면 graceful fallback)
    _prefs = await get_user_keyword_prefs(business_id, supabase)
    _custom_kw = _prefs.get("custom") or []
    _excluded_kw = _prefs.get("excluded") or []

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

    # 3.5순위: blog_analysis_json.keyword_coverage.present — 실제 블로그 포스트에 등장하는 커버 키워드
    # 리뷰가 없어도 블로그에 키워드가 있으면 "missing"으로 오분류하지 않기 위해 추가
    _blog_kw_json = biz_row.get("blog_analysis_json") or {}
    _blog_covered_list = (_blog_kw_json.get("keyword_coverage") or {}).get("present") or []
    if isinstance(_blog_covered_list, list) and _blog_covered_list:
        _add_excerpt(" ".join(_blog_covered_list))

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
        _logger.warning(f"ai_citations query failed: {e}")

    # 경쟁사 점수 + 리뷰 발췌문 수집 (scan_results.competitor_scores JSONB)
    raw_comp_scores = scan.get("competitor_scores") or {}
    competitor_scores = []
    competitor_review_excerpts: list[str] = []
    competitor_excerpts_by_name: dict[str, str] = {}  # {경쟁사명: excerpt} 경쟁사별 키워드 분류용
    for comp_id, data in raw_comp_scores.items():
        if isinstance(data, dict):
            comp_name = data.get("name", comp_id)
            competitor_scores.append({
                "name": comp_name,
                "score": float(data.get("score", 0)),
                "breakdown": data.get("breakdown", {}),
            })
            # Gemini 스캔 시 저장된 발췌문 수집 (scan.py에서 저장)
            excerpt = data.get("excerpt", "")
            if excerpt and isinstance(excerpt, str):
                competitor_review_excerpts.append(excerpt)
                # 경쟁사 이름별로도 저장 (키워드 출처 추적용)
                if comp_name not in competitor_excerpts_by_name:
                    competitor_excerpts_by_name[comp_name] = excerpt
                else:
                    competitor_excerpts_by_name[comp_name] += " " + excerpt

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
                    business_keywords=biz_keywords or None,
                    custom_keywords=_custom_kw or None,
                    excluded_keywords=_excluded_kw or None,
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
                    business_keywords=biz_keywords or None,
                    custom_keywords=_custom_kw or None,
                    excluded_keywords=_excluded_kw or None,
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
        competitor_excerpts_by_name=competitor_excerpts_by_name or None,
        business_keywords=biz_keywords or None,
        custom_keywords=_custom_kw or None,
        excluded_keywords=_excluded_kw or None,
    )
    # blog_diagnosis는 analyze_gap() 파라미터가 아니므로 반환 후 주입
    return gap_result.model_copy(update={"blog_diagnosis": blog_diagnosis})


def analyze_review_keyword_distribution(
    biz: dict,
    competitors: list[dict],
) -> dict:
    """
    리뷰 키워드 카테고리별 분포 분석. AI 호출 0회.
    출처 데이터가 없으면 data_unavailable=True 반환.

    biz:         businesses 테이블 row dict (blog_analysis_json 포함)
    competitors: competitors 테이블 row dict 목록 (blog_analysis_json 포함)
    """
    REVIEW_CATEGORIES: dict[str, list[str]] = {
        "맛·품질":    ["맛있", "맛", "신선", "품질", "재료", "퀄리티"],
        "분위기":     ["분위기", "인테리어", "감성", "예쁜", "아늑", "조용"],
        "서비스":     ["친절", "서비스", "빠른", "응대", "직원", "사장님"],
        "위치·접근":  ["주차", "접근", "위치", "교통", "가깝", "편리"],
        "가격·가성비": ["가성비", "저렴", "합리적", "비싸", "가격"],
    }

    # 내 사업장 리뷰 텍스트 추출 (blog_analysis_json 활용)
    my_text = ""
    blog_json = biz.get("blog_analysis_json") or {}
    if isinstance(blog_json, dict):
        my_text = (
            blog_json.get("combined_text")
            or blog_json.get("review_text")
            or ""
        )
    # blog_analysis_json에 없으면 review_sample fallback
    if not my_text:
        my_text = biz.get("review_sample") or ""

    if not my_text:
        return {"data_unavailable": True, "reason": "no_review_data"}

    my_dist: dict[str, int] = {}
    for cat, kws in REVIEW_CATEGORIES.items():
        my_dist[cat] = sum(my_text.count(kw) for kw in kws)

    # 경쟁사 평균 분포
    comp_dist: dict[str, float] = {cat: 0.0 for cat in REVIEW_CATEGORIES}
    valid_comps = 0
    for comp in (competitors or []):
        comp_text = ""
        comp_blog = comp.get("blog_analysis_json") or {}
        if isinstance(comp_blog, dict):
            comp_text = (
                comp_blog.get("combined_text")
                or comp_blog.get("review_text")
                or ""
            )
        if not comp_text:
            comp_text = comp.get("review_sample") or ""
        if comp_text:
            valid_comps += 1
            for cat, kws in REVIEW_CATEGORIES.items():
                comp_dist[cat] += sum(comp_text.count(kw) for kw in kws)

    if valid_comps > 0:
        comp_avg: dict[str, float] = {
            cat: round(v / valid_comps, 1) for cat, v in comp_dist.items()
        }
    else:
        comp_avg = {cat: 0.0 for cat in REVIEW_CATEGORIES}

    return {
        "data_unavailable": False,
        "my_distribution": my_dist,
        "competitor_avg": comp_avg,
        "categories": list(REVIEW_CATEGORIES.keys()),
    }
