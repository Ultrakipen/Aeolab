from pydantic import BaseModel, EmailStr, Field, field_validator
from uuid import UUID
from typing import Annotated, Literal, Optional, List

_VALID_CATEGORIES = Literal[
    "restaurant", "cafe", "bakery", "bar", "beauty", "nail",
    "medical", "pharmacy", "fitness", "yoga", "pet",
    "education", "tutoring", "legal", "realestate", "interior",
    "auto", "cleaning", "shopping", "fashion", "photo",
    "video", "design", "accommodation", "other",
]

_Keywords = Annotated[List[str], Field(max_length=30)]


class ScanRequest(BaseModel):
    business_name: str = Field(..., min_length=1, max_length=100, description="사업장 이름")
    category: _VALID_CATEGORIES = Field(...)
    region: str = Field(..., max_length=50)             # '강남구', '마포구'
    keywords: Optional[_Keywords] = None
    business_id: Optional[str] = None  # 로그인 사용자 전용


class TrialScanRequest(BaseModel):
    business_name: str = Field(..., min_length=1, max_length=100, description="사업장 이름")
    category: _VALID_CATEGORIES = Field(...)
    region: Optional[str] = Field(None, max_length=50)
    keyword: Optional[str] = Field(None, max_length=100)      # 직접 입력 서비스 키워드 (단일)
    keywords: Optional[_Keywords] = None                       # 등록 키워드 목록 (복수, 우선순위 높음)
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
    # v3.3 (2026-04-23) — 트라이얼 신뢰도 강화 1라운드
    # 네이버 지역검색에서 사용자가 선택한 가게의 place_id.
    # 들어오면 smart_place_auto_check로 4개 체크박스 자동 진단
    naver_place_id: Optional[str] = Field(None, max_length=50)
    # v3.3-fix (2026-04-23) — place_match 신뢰도 강화 (임의 매칭 금지)
    # 사용자가 검색 후보를 명시적으로 클릭한 경우에만 채워진다.
    # 있으면 응답 place_match로 그대로 사용 (재검색·자동 매칭 금지)
    # 없으면 응답 place_match=None (임의 가게 표시 금지)
    place_match: Optional[dict] = None


class BusinessCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    category: _VALID_CATEGORIES = Field(...)
    region: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=20)
    naver_place_id: Optional[str] = Field(None, max_length=100)
    google_place_id: Optional[str] = Field(None, max_length=100)
    kakao_place_id: Optional[str] = Field(None, max_length=100)
    website_url: Optional[str] = Field(None, max_length=200)
    blog_url: Optional[str] = Field(None, max_length=300)          # 블로그 URL (네이버/티스토리/워드프레스)
    keywords: Optional[_Keywords] = None
    business_type: Optional[str] = Field("location_based", max_length=30)  # location_based | non_location
    business_registration_no: Optional[str] = None  # 사업자등록번호
    naver_place_url: Optional[str] = Field(None, max_length=300)  # 네이버 플레이스 URL
    review_sample: Optional[str] = Field(None, max_length=2000)   # 리뷰 발췌문 샘플
    review_count: Optional[int] = Field(None, ge=0)               # 리뷰 수 (사용자 직접 입력)
    avg_rating: Optional[float] = Field(None, ge=0, le=5)         # 평균 평점 (사용자 직접 입력)
    trial_scan_id: Optional[str] = Field(None, max_length=36)     # 무료 체험 결과 자동 이전용 (UUID)

    @field_validator('trial_scan_id')
    @classmethod
    def validate_trial_scan_id(cls, v):
        if v is None:
            return v
        try:
            UUID(v)
        except ValueError:
            raise ValueError('trial_scan_id must be a valid UUID')
        return v


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


# ── v3.6 — Trial Conversion Funnel (2026-04-24) ───────────────────────────
class TrialClaimRequest(BaseModel):
    """무료 체험 → 회원 전환 깔때기 요청.

    비로그인 trial 사용자가 결과 페이지에서 이메일을 남기면
    Supabase Auth magic link를 발송 → 가입 후 trial_id 매칭으로 흡수한다.
    """
    trial_id: str = Field(..., description="trial_scans.id (UUID)")
    email: EmailStr = Field(..., description="수신 이메일")
    phone: Optional[str] = Field(None, max_length=20)
    marketing_opt_in: bool = False

    @field_validator("trial_id")
    @classmethod
    def _validate_trial_id(cls, v: str) -> str:
        try:
            UUID(v)
        except ValueError:
            raise ValueError("trial_id must be a valid UUID")
        return v


class TrialAttachRequest(BaseModel):
    """가입 후 인증된 사용자가 자기 trial_id를 본인 계정에 흡수."""
    trial_id: str = Field(..., description="trial_scans.id (UUID)")

    @field_validator("trial_id")
    @classmethod
    def _validate_trial_id(cls, v: str) -> str:
        try:
            UUID(v)
        except ValueError:
            raise ValueError("trial_id must be a valid UUID")
        return v
