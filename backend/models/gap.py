"""
Domain 3 — GapAnalysis (격차 분석)
"1위 가게랑 나랑 뭐가 달라?"
도메인 모델 v2.4 § 7
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
    weight: float               # 이 항목의 전체 점수 가중치 (0.25 등)
    priority: int               # 1 = 개선 시 점수 향상 효과 가장 큼


class CompetitorGap(BaseModel):
    """1위 경쟁사와의 격차 요약"""
    top_competitor_name: str
    top_competitor_score: float
    my_score: float
    total_gap: float            # top - my
    strongest_gap_dimension: str    # 가장 차이가 큰 항목 label
    closeable_gap: float        # 실현 가능한 격차 좁힘


class ReviewKeywordGap(BaseModel):
    """리뷰 키워드 수준의 격차 분석

    소상공인이 실제로 행동할 수 있는 가장 구체적인 정보입니다.
    "리뷰 품질 -15점"이 아니라 "이 키워드 3개가 리뷰에 없습니다"를 알려줍니다.
    """
    covered_keywords: List[str]          # 내 리뷰에 이미 있는 키워드
    missing_keywords: List[str]          # 업종 전체 기준 아직 없는 키워드
    competitor_only_keywords: List[str]  # 경쟁사엔 있고 내겐 없는 키워드 (긴급 확보)
    pioneer_keywords: List[str]          # 경쟁사도 없는 선점 가능 키워드
    coverage_rate: float                 # 업종 전체 키워드 중 보유 비율 (0.0~1.0)
    top_priority_keyword: Optional[str]  # 지금 당장 확보해야 할 1순위 키워드
    qr_card_message: str                 # 이 키워드를 자연스럽게 유도하는 QR 카드 문구
    category_scores: dict                # 카테고리별 {"접근편의": {"score": 80, ...}}


class GrowthStage(BaseModel):
    """소상공인 성장 단계 (score 기반 자동 판정)

    추상적인 점수 대신 "지금 어느 단계이고 뭘 해야 하는가"를 명확히 합니다.
    """
    stage: str                           # "survival" | "stability" | "growth" | "dominance"
    stage_label: str                     # "생존기" | "안정기" | "성장기" | "지배기"
    score_range: str                     # "0~30점" | "30~55점" | "55~75점" | "75~100점"
    focus_message: str                   # "지금은 스마트플레이스 기본 완성이 최우선입니다"
    this_week_action: str                # "오늘 할 일 1가지" — 가장 중요한 단일 행동
    do_not_do: str                       # "지금 하지 말아야 할 것"
    estimated_weeks_to_next: Optional[int]  # 다음 단계까지 예상 기간


class GapAnalysis(BaseModel):
    """격차 분석 — DiagnosisReport + MarketLandscape로부터 계산"""
    business_id: str
    scan_id: str
    analyzed_at: datetime
    context: ScanContext            # gap_reason 문구 및 dimension 가중치 분기 기준

    vs_top: CompetitorGap
    dimensions: List[DimensionGap]  # priority 오름차순 정렬 (context별 가중치 적용)
    gap_card_url: Optional[str] = None      # Supabase Storage URL (공유 이미지)
    estimated_score_if_fixed: float         # 우선순위 상위 3개 개선 시 예상 점수

    # v2.4 추가 — 글로벌 AI 차단 리스크 명시
    naver_only_risk: bool = False
    # True = 독립 웹사이트 없음 → ChatGPT·Gemini·Perplexity 완전 비노출
    # 네이버는 글로벌 AI 크롤러를 robots.txt로 전면 차단 중 (2023~)
    naver_only_risk_score_impact: float = 0.0
    # 독립 웹사이트 + JSON-LD 등록 시 예상 점수 상승폭

    # v2.5 추가 — 키워드 수준 격차 + 성장 단계
    keyword_gap: Optional[ReviewKeywordGap] = None
    # 어떤 키워드를 리뷰에 받아야 AI 브리핑에 나오는지 구체적으로 제시
    growth_stage: Optional[GrowthStage] = None
    # 지금 어느 단계이고 이번 주 뭘 해야 하는지 명확히 제시

    # 기능 B 추가 — 블로그 진단 결과 (blog_analyzer.analyze_blog() 반환 구조)
    blog_diagnosis: Optional[dict] = None
    # platform, post_count, keyword_coverage, ai_readiness_score, freshness,
    # top_recommendation 등 블로그 분석 결과 전체 포함
