"""
Domain 1 — DiagnosisReport (진단 리포트)
"내 가게 지금 어때?"
도메인 모델 v2.4 § 5
"""
from __future__ import annotations
from pydantic import BaseModel
from typing import Optional, Dict
from datetime import datetime
from models.context import ScanContext


class PlatformRegistration(BaseModel):
    """플랫폼 등록 현황
    context별 중요도:
      location_based: naver_smart_place ★★★  kakao_maps ★★★  google_maps ★★  website ★★
      non_location:   naver_smart_place ★     kakao_maps ★     google_maps ★★★ website ★★★
    """
    naver_smart_place: bool     # 네이버 스마트플레이스
    kakao_maps: bool            # 카카오맵
    google_maps: bool           # 구글 지도
    website: bool               # 독립 웹사이트


class BusinessSnapshot(BaseModel):
    """내 가게 기본 현황 — 스캔 시점의 등록 정보"""
    name: str
    category: str
    context: ScanContext            # location_based | non_location
    region: Optional[str] = None   # location_based 필수, non_location = None
    platform_registration: PlatformRegistration
    keyword_count: int


class AIPlatformResult(BaseModel):
    """AI 플랫폼 1개의 노출 결과"""
    platform: str               # gemini | chatgpt | perplexity | grok | naver | claude | google
    mentioned: bool             # 노출 여부
    rank: Optional[int] = None  # 노출 순위 (1~5)
    excerpt: Optional[str] = None  # 인용 문구
    confidence: Optional[Dict] = None  # {"lower": float, "upper": float} — Gemini Wilson 신뢰구간
    in_briefing: Optional[bool] = None  # 네이버 AI 브리핑 포함 여부
    in_ai_overview: Optional[bool] = None  # Google AI Overview 포함 여부
    error: Optional[str] = None


class AIVisibility(BaseModel):
    """8개 AI 플랫폼 노출 현황"""
    exposure_freq: float        # Gemini 100회 샘플링 기준 노출 빈도 (0~100)
    exposure_rate: float        # 노출률 % (exposure_freq / 100)
    platforms: Dict[str, AIPlatformResult]  # 플랫폼명 → 결과
    mentioned_count: int        # 노출된 플랫폼 수 (0~8)
    query_used: str             # 검색에 사용된 쿼리


class ChannelScores(BaseModel):
    """AI 채널 분리 점수"""
    naver_channel: float        # 네이버 생태계 점수 (0~100)
    global_channel: float       # 글로벌 AI 채널 점수 (0~100)
    dominant_channel: str       # "naver" | "global" | "balanced"
    channel_gap: float          # abs(naver - global) — 10 이상이면 채널 불균형


class NaverChannelDetail(BaseModel):
    """네이버 채널 세부 현황 (location_based 전용)"""
    in_ai_briefing: bool            # 네이버 AI 브리핑 노출
    is_smart_place: bool            # 스마트플레이스 등록
    blog_mentions: int              # 블로그 언급 수
    is_on_kakao: bool               # 카카오맵 등록
    naver_rank: Optional[int] = None            # 지역 검색 순위
    top_competitor_blog_count: int = 0          # 1위 경쟁사 블로그 언급 수

    # v2.4 추가 — AI 브리핑 노출 품질 신호
    briefing_keyword: Optional[str] = None      # 어떤 검색어에서 브리핑 노출됐는지
    briefing_excerpt: Optional[str] = None      # 브리핑에서 내 가게를 어떻게 소개했는지
    smart_place_faq_count: int = 0              # 스마트플레이스 사장님 Q&A 등록 수 (브리핑 직결)
    smart_place_photo_count: int = 0            # 스마트플레이스 사진 수 (완성도 신호)

    # v2.4 추가 — 카카오 리뷰 데이터 (AI 추천 신호)
    kakao_review_count: int = 0                 # 카카오맵 리뷰 수
    kakao_avg_rating: float = 0.0               # 카카오맵 평점


class WebsiteHealth(BaseModel):
    """웹사이트 SEO 체크리스트"""
    has_website: bool
    is_https: bool = False
    is_mobile_friendly: bool = False
    has_json_ld: bool = False               # 구조화 데이터 (JSON-LD)
    has_schema_local_business: bool = False # LocalBusiness 스키마
    has_open_graph: bool = False            # 소셜 미리보기 (OG 태그)
    has_favicon: bool = False
    title: Optional[str] = None
    error: Optional[str] = None


class CustomerSignals(BaseModel):
    """실제 고객 행동 신호 — 스마트플레이스 API 연동 (v2.4 신규)

    점수↑ = 손님↑ 연결고리: AI 노출 개선이 실제 클릭·방문으로 이어지는지 추적.
    데이터 없으면 None (스마트플레이스 API 미연동 사업장).
    """
    smart_place_views_week: Optional[int] = None    # 7일 스마트플레이스 조회수
    smart_place_saves: Optional[int] = None         # 저장(찜) 수
    phone_clicks_week: Optional[int] = None         # 7일 전화 연결 클릭
    direction_clicks_week: Optional[int] = None     # 7일 길 찾기 클릭
    photo_views_week: Optional[int] = None          # 7일 사진 조회수
    views_change_pct: Optional[float] = None        # 전주 대비 조회수 변화율 (%)


class ScoreBreakdown(BaseModel):
    """6항목 세부 점수 (각 0~100)"""
    exposure_freq: float        # AI 검색 노출 빈도 (25% / 35%)
    review_quality: float       # 리뷰 수·평점·키워드 (25% / 10%)
    schema_score: float         # 정보 구조화 점수 (20% / 20%)
    online_mentions: float      # 온라인 언급 빈도 (15% / 20%)
    info_completeness: float    # 정보 완성도 (10%)
    content_freshness: float    # 콘텐츠 최신성 (5%)


class ScoreResult(BaseModel):
    """종합 점수 결과"""
    total_score: float          # 0~100
    grade: str                  # A | B | C | D
    breakdown: ScoreBreakdown
    channel_scores: ChannelScores
    weekly_change: Optional[float] = None      # 지난 스캔 대비 점수 변화
    rank_in_category: Optional[int] = None     # 업종 내 순위
    total_in_category: Optional[int] = None    # 업종 내 전체 사업장 수


class DiagnosisReport(BaseModel):
    """진단 리포트 — 스캔 1회의 전체 결과"""
    scan_id: str
    business_id: str
    scanned_at: datetime
    context: ScanContext            # 모든 하위 모델의 동작 분기 기준

    snapshot: BusinessSnapshot
    ai_visibility: AIVisibility
    # location_based 전용 — non_location이면 None
    naver_detail: Optional[NaverChannelDetail] = None
    # 웹사이트가 있을 때만 수집 (context 무관)
    website_health: Optional[WebsiteHealth] = None
    # 스마트플레이스 API 연동 시 수집 (location_based 전용)
    customer_signals: Optional[CustomerSignals] = None
    score: ScoreResult
