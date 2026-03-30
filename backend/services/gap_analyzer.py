"""
GapAnalysis 계산 서비스
도메인 모델 v2.1 § 7 — DiagnosisReport + MarketLandscape → GapAnalysis
"""
import logging
from datetime import datetime, timezone
from typing import Optional
from models.context import ScanContext
from models.gap import GapAnalysis, DimensionGap, CompetitorGap
from services.score_engine import get_weights_for_context

_logger = logging.getLogger("aeolab")

# 항목별 한국어 레이블
_DIMENSION_LABELS = {
    "exposure_freq":     "AI 검색 노출 빈도",
    "review_quality":    "리뷰 품질",
    "schema_score":      "정보 구조화",
    "online_mentions":   "온라인 언급",
    "info_completeness": "정보 완성도",
    "content_freshness": "콘텐츠 최신성",
}

# context별 gap_reason 템플릿 (dimension_key → callable)
_GAP_REASONS = {
    ScanContext.LOCATION_BASED: {
        "exposure_freq": lambda gap: f"네이버 AI 브리핑 미노출로 Gemini·ChatGPT 노출 빈도 낮음 (경쟁사 대비 -{gap:.0f}점)",
        "review_quality": lambda gap: f"리뷰 수·평점이 경쟁사 대비 부족 (-{gap:.0f}점). 키워드 다양성 개선 필요",
        "schema_score": lambda gap: "네이버 스마트플레이스 미등록 또는 웹사이트 없음으로 구조화 점수 낮음",
        "online_mentions": lambda gap: f"블로그 언급 수 부족 (경쟁사 대비 -{gap:.0f}점). 체험단·리뷰 이벤트 필요",
        "info_completeness": lambda gap: "카카오맵·구글 지도 등록 누락 또는 기본 정보(주소·전화) 미완성",
        "content_freshness": lambda gap: "최근 리뷰 또는 스캔 간격이 길어 콘텐츠 최신성 낮음",
    },
    ScanContext.NON_LOCATION: {
        "exposure_freq": lambda gap: f"ChatGPT·Perplexity 미노출로 AI 검색 빈도 낮음 (경쟁사 대비 -{gap:.0f}점)",
        "review_quality": lambda gap: f"전문가 리뷰·사례 포트폴리오 부족 (경쟁사 대비 -{gap:.0f}점)",
        "schema_score": lambda gap: "웹사이트 JSON-LD 없음 — AI가 사업장 정보를 구조적으로 파악 불가",
        "online_mentions": lambda gap: f"ChatGPT·Perplexity 미인용. 전문 콘텐츠(블로그·인터뷰·기사) 부족 (경쟁사 대비 -{gap:.0f}점)",
        "info_completeness": lambda gap: "웹사이트 Open Graph·favicon 미설정 또는 구글 비즈니스 프로필 미등록",
        "content_freshness": lambda gap: "블로그·뉴스 최근 게재물 없어 콘텐츠 최신성 낮음",
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


def analyze_gap(
    business_id: str,
    scan_id: str,
    context: str,
    my_breakdown: dict,
    my_total_score: float,
    competitor_scores: list[dict],  # [{"name": str, "score": float, "breakdown": dict}, ...]
    avg_breakdown: dict = None,
    gap_card_url: str = None,
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
    top_breakdown = top_comp.get("breakdown", {}) if top_comp else {}

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
        object.__setattr__(dim, "priority", i) if hasattr(dim, "__fields_set__") else None
        # Pydantic v2 방식으로 priority 업데이트
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

    return GapAnalysis(
        business_id=business_id,
        scan_id=scan_id,
        analyzed_at=datetime.now(timezone.utc),
        context=ctx,
        vs_top=vs_top,
        dimensions=dimensions,
        gap_card_url=gap_card_url,
        estimated_score_if_fixed=estimated_score,
    )


async def analyze_gap_from_db(business_id: str, supabase) -> Optional[GapAnalysis]:
    """DB에서 최신 스캔 + 경쟁사 데이터 로드 후 GapAnalysis 반환"""
    from db.supabase_client import execute

    # 사업장 정보
    biz_row = (await execute(
        supabase.table("businesses")
        .select("id, category, region, business_type")
        .eq("id", business_id)
        .single()
    )).data
    if not biz_row:
        return None

    context = biz_row.get("business_type") or "location_based"

    # 최신 스캔 결과
    scan_row = (await execute(
        supabase.table("scan_results")
        .select("id, total_score, score_breakdown, competitor_scores")
        .eq("business_id", business_id)
        .order("scanned_at", desc=True)
        .limit(1)
    )).data
    if not scan_row:
        return None

    scan = scan_row[0]
    my_breakdown = scan.get("score_breakdown") or {}
    my_total = float(scan.get("total_score", 0))
    scan_id = scan["id"]

    # 경쟁사 점수 (scan_results.competitor_scores JSONB)
    raw_comp_scores = scan.get("competitor_scores") or {}
    competitor_scores = []
    for name, data in raw_comp_scores.items():
        if isinstance(data, dict):
            competitor_scores.append({
                "name": name,
                "score": float(data.get("score", 0)),
                "breakdown": data.get("breakdown", {}),
            })

    if not competitor_scores:
        return None

    return analyze_gap(
        business_id=business_id,
        scan_id=scan_id,
        context=context,
        my_breakdown=my_breakdown,
        my_total_score=my_total,
        competitor_scores=competitor_scores,
    )
