"""
Domain 4 — ActionPlan (실행 계획)
"뭘 어떻게 직접 해야 해?"
도메인 모델 v2.1 § 8
"""
from __future__ import annotations
from pydantic import BaseModel
from typing import Optional, List, Literal
from datetime import datetime
from models.context import ScanContext


class ActionItem(BaseModel):
    """개선 항목 1개"""
    rank: int                           # 우선순위 (1 = 가장 중요)
    dimension: str                      # 관련 점수 항목 dimension_key
    title: str                          # "네이버 스마트플레이스 등록하기"
    action: str                         # "1. 스마트플레이스 관리자(smartplace.naver.com) 접속..."
    expected_effect: str                # "AI 검색 노출 빈도 +15~25점 예상"
    difficulty: Literal["easy", "medium", "hard"]
    time_required: str                  # "10분" | "1시간" | "1주일"
    competitor_example: Optional[str] = None  # "인근 [가게명]이 이 방법으로 AI 노출 1위"
    is_quick_win: bool                  # 이번 주 완료 가능 여부


class FAQ(BaseModel):
    """AI 검색 최적화용 FAQ 항목"""
    question: str       # "강남 [업종] 추천해줘"
    answer: str         # "네, [사업장명]은 [강점] 전문점으로..."


class ActionTools(BaseModel):
    """직접 활용 가능한 실행 도구 — 모두 복사·붙여넣기 가능
    context별 생성 여부:
      json_ld_schema:          항상 생성
      faq_list:                항상 생성 (쿼리 형태가 context별로 다름)
      keyword_list:            항상 생성
      blog_post_template:      항상 생성 (location: 지역 키워드 중심, non_location: 전문성 중심)
      smart_place_checklist:   location_based 전용 → non_location이면 None
      seo_checklist:           non_location 전용 → location_based이면 None
    """
    json_ld_schema: str             # <script type="application/ld+json"> 코드
    faq_list: List[FAQ]             # AI 검색 최적화용 FAQ 질문/답변 (5~10개)
    keyword_list: List[str]         # 리뷰·블로그에 넣어야 할 핵심 키워드
    blog_post_template: str         # 블로그 포스팅 초안 (800~1000자)
    smart_place_checklist: Optional[List[str]] = None  # location_based 전용
    seo_checklist: Optional[List[str]] = None          # non_location 전용


class ActionProgress(BaseModel):
    """체크리스트 진행률 (클라이언트 localStorage 기반)"""
    total_items: int
    completed_items: int
    completion_rate: float          # 0.0 ~ 1.0
    completed_ranks: List[int]      # 완료한 action item의 rank 목록


class ActionPlan(BaseModel):
    """실행 계획 — DiagnosisReport + GapAnalysis를 기반으로 Claude Sonnet 생성"""
    plan_id: str
    business_id: str
    scan_id: str
    generated_at: datetime
    context: ScanContext            # ActionItem.action 내용과 ActionTools 생성 분기 기준

    summary: str                    # 3줄 현황 요약
    items: List[ActionItem]         # 전체 개선 항목 (priority 순, context별 가중치 적용)
    quick_wins: List[ActionItem]    # items 중 is_quick_win=True만
    next_month_goal: str            # "다음 달까지 AI 노출 빈도 +20% 목표"
    tools: ActionTools
    progress: Optional[ActionProgress] = None  # 프론트에서 주입
