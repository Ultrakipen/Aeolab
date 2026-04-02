from pydantic import BaseModel
from typing import Optional, List


class ScanRequest(BaseModel):
    business_name: str
    category: str           # restaurant|cafe|hospital|academy|law|beauty|shop
    region: str             # '강남구', '마포구'
    keywords: Optional[List[str]] = None
    business_id: Optional[str] = None  # 로그인 사용자 전용


class TrialScanRequest(BaseModel):
    business_name: str
    category: str
    region: Optional[str] = None
    keyword: Optional[str] = None      # 직접 입력 서비스 키워드
    email: Optional[str] = None        # 대기자 명단 수집용
    business_type: Optional[str] = "location_based"  # location_based | non_location
    website_url: Optional[str] = None  # non_location: WebsiteChecker 실행용
    # v3.0 스마트플레이스 체크박스 3개 (Track 1 점수에 즉시 반영)
    has_faq: bool = False              # Q&A(FAQ) 탭 등록 여부 → AI 브리핑 가장 직접적 경로
    has_recent_post: bool = False      # 최근 7일 내 소식 업데이트 여부
    has_intro: bool = False            # 소개글 작성 여부
    # 리뷰 발췌문 (직접 입력, 없으면 cold start 처리)
    review_text: Optional[str] = None  # 손님 리뷰 1~3개 붙여넣기


class BusinessCreate(BaseModel):
    name: str
    category: str
    region: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    naver_place_id: Optional[str] = None
    google_place_id: Optional[str] = None
    kakao_place_id: Optional[str] = None
    website_url: Optional[str] = None
    keywords: Optional[List[str]] = None
    business_type: Optional[str] = "location_based"  # location_based | non_location


class CompetitorCreate(BaseModel):
    business_id: str
    name: str
    address: Optional[str] = None


class GuideRequest(BaseModel):
    business_id: str
    scan_id: str


class SchemaRequest(BaseModel):
    business_name: str
    category: str
    region: str
    address: Optional[str] = None
    phone: Optional[str] = None
    website_url: Optional[str] = None
    opening_hours: Optional[str] = None
    description: Optional[str] = None
    menu_items: Optional[str] = None   # 메뉴·서비스 목록 (쉼표 구분 또는 자유 텍스트)
    specialty: Optional[str] = None    # 가게 특징·강점 (자유 텍스트)


class PaymentConfirm(BaseModel):
    paymentKey: str
    orderId: str
    amount: int
    plan: str | None = None  # 클라이언트에서 플랜명 전달 (서버에서 금액으로 교차 검증)


class BillingIssueRequest(BaseModel):
    authKey: str
    customerKey: str
    plan: str
    amount: int
