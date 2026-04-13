from pydantic import BaseModel, Field
from typing import Optional, List


class ScanRequest(BaseModel):
    business_name: str = Field(..., min_length=1, max_length=100, description="사업장 이름")
    category: str = Field(..., max_length=50)           # restaurant|cafe|hospital|academy|law|beauty|shop
    region: str = Field(..., max_length=50)             # '강남구', '마포구'
    keywords: Optional[List[str]] = None
    business_id: Optional[str] = None  # 로그인 사용자 전용


class TrialScanRequest(BaseModel):
    business_name: str = Field(..., min_length=1, max_length=100, description="사업장 이름")
    category: str = Field(..., max_length=50)
    region: Optional[str] = Field(None, max_length=50)
    keyword: Optional[str] = Field(None, max_length=100)      # 직접 입력 서비스 키워드 (단일)
    keywords: Optional[List[str]] = None                       # 등록 키워드 목록 (복수, 우선순위 높음)
    email: Optional[str] = Field(None, max_length=200)        # 대기자 명단 수집용
    business_type: Optional[str] = Field("location_based", max_length=30)  # location_based | non_location
    website_url: Optional[str] = Field(None, max_length=200)  # non_location: WebsiteChecker 실행용
    # v3.0 스마트플레이스 체크박스 (Track 1 점수에 즉시 반영)
    is_smart_place: Optional[bool] = None  # 사용자 직접 확인 → Naver API 결과보다 우선 적용
    has_faq: bool = False              # Q&A(FAQ) 탭 등록 여부 → AI 브리핑 가장 직접적 경로
    has_recent_post: bool = False      # 최근 7일 내 소식 업데이트 여부
    has_intro: bool = False            # 소개글 작성 여부
    # 리뷰 발췌문 (직접 입력, 없으면 cold start 처리)
    review_text: Optional[str] = Field(None, max_length=2000)  # 손님 리뷰 1~3개 붙여넣기
    description: Optional[str] = Field(None, max_length=500)   # 내 가게만의 특징 (키워드 분석 보강용)


class BusinessCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    category: str = Field(..., max_length=50)
    region: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=20)
    naver_place_id: Optional[str] = Field(None, max_length=100)
    google_place_id: Optional[str] = Field(None, max_length=100)
    kakao_place_id: Optional[str] = Field(None, max_length=100)
    website_url: Optional[str] = Field(None, max_length=200)
    blog_url: Optional[str] = Field(None, max_length=300)          # 블로그 URL (네이버/티스토리/워드프레스)
    keywords: Optional[List[str]] = None
    business_type: Optional[str] = Field("location_based", max_length=30)  # location_based | non_location
    business_registration_no: Optional[str] = None  # 사업자등록번호
    naver_place_url: Optional[str] = Field(None, max_length=300)  # 네이버 플레이스 URL
    review_sample: Optional[str] = Field(None, max_length=2000)   # 리뷰 발췌문 샘플
    review_count: Optional[int] = Field(None, ge=0)               # 리뷰 수 (사용자 직접 입력)
    avg_rating: Optional[float] = Field(None, ge=0, le=5)         # 평균 평점 (사용자 직접 입력)


class CompetitorCreate(BaseModel):
    business_id: str
    name: str = Field(..., min_length=1, max_length=100)
    address: Optional[str] = Field(None, max_length=200)
    kakao_place_id: Optional[str] = Field(None, max_length=100)
    naver_place_id: Optional[str] = Field(None, max_length=100)
    lat: Optional[float] = None   # 카카오 검색 결과에서 전달받은 위도
    lng: Optional[float] = None   # 카카오 검색 결과에서 전달받은 경도


class GuideRequest(BaseModel):
    business_id: str
    scan_id: str


class SchemaRequest(BaseModel):
    business_name: str = Field(..., min_length=1, max_length=100)
    category: str = Field(..., max_length=50)
    region: str = Field(..., max_length=50)
    address: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=20)
    website_url: Optional[str] = Field(None, max_length=200)
    opening_hours: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = Field(None, max_length=500)
    menu_items: Optional[str] = Field(None, max_length=500)   # 메뉴·서비스 목록 (쉼표 구분 또는 자유 텍스트)
    specialty: Optional[str] = Field(None, max_length=300)    # 가게 특징·강점 (자유 텍스트)


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
