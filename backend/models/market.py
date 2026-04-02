"""
Domain 2 — MarketLandscape (시장 현황)
"근처 같은 업종 가게들은 어떻게 잘되고 있어?"
도메인 모델 v2.4 § 6
"""
from __future__ import annotations
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime
from models.context import ScanContext


class MarketPosition(BaseModel):
    """시장 내 내 위치"""
    my_rank: int                    # 내 순위 (1위가 최상위)
    total_in_market: int            # 비교 가능한 전체 사업장 수
    my_score: float
    category_avg_score: float       # 업종 평균 점수
    top10_score: float              # 상위 10% 기준 점수
    percentile: float               # 내 위치 백분위 (상위 N%)
    is_above_average: bool


class CompetitorProfile(BaseModel):
    """경쟁 가게 1개의 현황"""
    competitor_id: str
    name: str
    score: float
    grade: str                          # A | B | C | D
    is_naver_smart_place: bool = False
    is_on_kakao: bool = False
    blog_mentions: int = 0
    ai_mentioned: bool                  # AI 검색 노출 여부
    ai_platform_count: int = 0          # 몇 개 AI에 노출되는지
    strengths: List[str] = []           # context별 강점 레이블
    rank: int                           # 이 경쟁사의 시장 순위

    # v2.4 추가 — "왜 저 가게가 잘 나오는지" 구체적 근거
    smart_place_faq_count: int = 0
    # 스마트플레이스 사장님 Q&A 등록 수 — AI 브리핑 노출 직결
    recent_blog_post_count: int = 0
    # 최근 30일 블로그 언급 수 (체험단·리뷰 활동)
    response_rate: Optional[float] = None
    # 리뷰 답변율 0.0~1.0 — AI 신뢰도 신호 (네이버·구글 공통)
    top_review_keywords: List[str] = []
    # 경쟁사 리뷰에서 자주 나오는 핵심 키워드 (최대 5개)
    # 소상공인이 "저 가게는 뭘 강조하는구나" 파악하는 데 사용


class MarketDistribution(BaseModel):
    """업종 점수 분포"""
    grade_a_count: int              # 80점 이상
    grade_b_count: int              # 60~79점
    grade_c_count: int              # 40~59점
    grade_d_count: int              # 40점 미만
    distribution: List[Dict]        # [{"range": "80-100", "count": 3}, ...]


class MarketLandscape(BaseModel):
    """시장 현황 — 업종 기준 경쟁 현황
    context별 비교 범위:
      location_based: category + region 필터 (지역 동종업체)
      non_location:   category 전국 필터 (region = None)
    """
    context: ScanContext
    category: str
    region: Optional[str] = None    # location_based 필수, non_location = None
    position: MarketPosition
    competitors: List[CompetitorProfile]
    distribution: MarketDistribution
    data_updated_at: datetime       # 캐시 갱신 시각 (30분 TTL)
