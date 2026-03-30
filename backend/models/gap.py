"""
Domain 3 — GapAnalysis (격차 분석)
"1위 가게랑 나랑 뭐가 달라?"
도메인 모델 v2.1 § 7
"""
from __future__ import annotations
from pydantic import BaseModel
from typing import Optional, List, Literal
from datetime import datetime
from models.context import ScanContext


class DimensionGap(BaseModel):
    """점수 항목 1개의 격차"""
    dimension_key: str          # "exposure_freq" | "review_quality" | ...
    dimension_label: str        # "AI 검색 노출" | "리뷰 품질" | ...
    my_score: float             # 내 항목 점수
    top_score: float            # 1위 가게의 해당 항목 점수
    avg_score: float            # 업종 평균 해당 항목 점수
    gap_to_top: float           # top_score - my_score (양수 = 뒤처짐)
    gap_reason: str             # "네이버 스마트플레이스 미등록으로 구조화 점수 낮음"
    improvement_potential: Literal["high", "medium", "low"]
    weight: float               # 이 항목의 전체 점수 가중치 (0.30 등)
    priority: int               # 1 = 개선 시 점수 향상 효과 가장 큼


class CompetitorGap(BaseModel):
    """1위 경쟁사와의 격차 요약"""
    top_competitor_name: str
    top_competitor_score: float
    my_score: float
    total_gap: float            # top - my
    strongest_gap_dimension: str    # 가장 차이가 큰 항목 label
    closeable_gap: float        # 실현 가능한 격차 좁힘


class GapAnalysis(BaseModel):
    """격차 분석 — DiagnosisReport + MarketLandscape로부터 계산"""
    business_id: str
    scan_id: str
    analyzed_at: datetime
    context: ScanContext            # gap_reason 문구 및 dimension 가중치 분기 기준

    vs_top: CompetitorGap
    dimensions: List[DimensionGap]  # priority 오름차순 정렬 (context별 가중치 적용)
    gap_card_url: Optional[str] = None  # Supabase Storage URL (공유 이미지)
    estimated_score_if_fixed: float     # 우선순위 상위 3개 개선 시 예상 점수
