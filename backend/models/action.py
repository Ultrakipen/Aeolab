"""
Domain 4 — ActionPlan (실행 계획)
"뭘 어떻게 직접 해야 해?"
도메인 모델 v2.4 § 8
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
    difficulty: Literal["easy", "medium", "hard"]
    time_required: str                  # "10분" | "1시간" | "1주일"
    competitor_example: Optional[str] = None  # "인근 [가게명]이 이 방법으로 AI 노출 1위"
    is_quick_win: bool                  # 이번 주 완료 가능 여부


class FAQ(BaseModel):
    """AI 검색 최적화용 FAQ 항목"""
    question: str       # "강남 [업종] 추천해줘"
    answer: str         # "네, [사업장명]은 [강점] 전문점으로..."


class ReviewResponseDraft(BaseModel):
    """리뷰 답변 초안 (v2.4 신규)

    소상공인이 가장 힘들어하는 작업 — AI가 답변 초안을 생성.
    리뷰 답변율은 네이버 AI 브리핑·Google AI 추천의 직접 신호.
    """
    review_snippet: str             # 원본 리뷰 일부 (컨텍스트용)
    rating: Optional[int] = None    # 별점 (1~5)
    draft_response: str             # 사장님이 바로 복사·붙여넣기 가능한 답변 초안
    tone: Literal["grateful", "apologetic", "neutral"] = "grateful"
    # grateful=긍정 리뷰 감사, apologetic=부정 리뷰 사과+해결, neutral=일반


class ActionTools(BaseModel):
    """직접 활용 가능한 실행 도구 — 모두 복사·붙여넣기 가능

    context별 생성 여부:
      json_ld_schema:              항상 생성
      faq_list:                    항상 생성 (쿼리 형태가 context별로 다름)
      keyword_list:                항상 생성
      blog_post_template:          항상 생성 (location: 지역 키워드 중심, non_location: 전문성 중심)
      smart_place_checklist:       location_based 전용 → non_location이면 None
      seo_checklist:               non_location 전용 → location_based이면 None

    v2.4 추가 — 소상공인이 즉시 쓸 수 있는 도구:
      review_response_drafts:      항상 생성 (리뷰 답변율 = AI 추천 #1 신호)
      smart_place_faq_answers:     location_based 전용 (스마트플레이스 Q&A 직접 붙여넣기)
      review_request_message:      항상 생성 (QR·영수증·테이블 카드용 리뷰 유도 문구)
      naver_post_template:         location_based 전용 (스마트플레이스 '소식' 공지 초안)
    """
    json_ld_schema: str                                     # <script type="application/ld+json"> 코드
    faq_list: List[FAQ]                                     # AI 검색 최적화용 FAQ (5~10개)
    keyword_list: List[str]                                 # 리뷰·블로그에 넣어야 할 핵심 키워드
    blog_post_template: str                                 # 블로그 포스팅 초안 (800~1000자)
    smart_place_checklist: Optional[List[str]] = None       # location_based 전용
    seo_checklist: Optional[List[str]] = None               # non_location 전용

    # v2.4 추가
    review_response_drafts: List[ReviewResponseDraft] = []
    # 최근 리뷰 유형별(긍정·부정·일반) 답변 초안 3개
    # 리뷰 답변율 100% → 네이버 AI 브리핑 가중치 상승

    smart_place_faq_answers: Optional[List[FAQ]] = None
    # location_based 전용 — 스마트플레이스 '사장님 Q&A' 탭에 바로 등록 가능
    # 네이버 AI 브리핑 인용 후보 경로 (소개글 Q&A 답변이 브리핑 인용 후보가 됨)

    review_request_message: str = ""
    # QR코드·영수증·테이블 카드에 넣을 리뷰 유도 문구
    # "맛있게 드셨나요? 리뷰 한 줄이 저희에게 큰 힘이 됩니다 → [링크]"

    naver_post_template: Optional[str] = None
    # location_based 전용 — 스마트플레이스 '소식' (공지사항) 등록용 초안
    # 블로그 글쓰기가 어려운 소상공인용 대안 (200~300자 단문)

    # v2.6 추가 — AI 브리핑 직접 관리 경로
    direct_briefing_paths: List[dict] = []
    # 소상공인이 오늘 직접 할 수 있는 6가지 AI 브리핑 입력 경로
    # [경로B: FAQ, 경로A: 리뷰답변, 경로C: 소식, 경로D: 소개글, 경로E: TOP5 리스트, 경로F: 커뮤니티]
    briefing_summary: str = ""
    # 대시보드 상단 안내 문구 — 현재 상태 + 지금 할 수 있는 것
    naver_map_url: str = ""
    # 네이버 지도 검색 URL — 인스타·카카오채널·블로그에 공유해 찜·저장·길찾기 클릭 신호 생성


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
    weekly_roadmap: Optional[list] = None       # 4주 로드맵 (Claude 생성)
    this_week_mission: Optional[dict] = None    # 이번 주 미션 (Claude 생성)
