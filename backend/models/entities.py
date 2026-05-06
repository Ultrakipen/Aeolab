"""
AEOlab 핵심 엔티티 모델 (도메인 모델 v2.1 § 4)
Business, Competitor, Subscription — DB 테이블과 1:1 대응하는 영속 데이터

4개 도메인(DiagnosisReport, MarketLandscape, GapAnalysis, ActionPlan)의 입력값이 됩니다.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel


class Business(BaseModel):
    """사업장 — 핵심 엔티티 (DB: businesses)"""

    id: str
    user_id: str
    name: str
    category: str          # restaurant | cafe | hospital | academy | ...
    business_type: Literal["location_based", "non_location"] = "location_based"
    region: Optional[str] = None      # location_based 필수, non_location = None
    address: Optional[str] = None
    phone: Optional[str] = None
    website_url: Optional[str] = None
    keywords: Optional[List[str]] = None

    # 플랫폼 등록 현황
    naver_place_id: Optional[str] = None
    google_place_id: Optional[str] = None
    kakao_place_id: Optional[str] = None

    # 리뷰 메타 (스캔 시 수집)
    review_count: int = 0
    avg_rating: float = 0.0
    keyword_diversity: float = 0.0
    receipt_review_count: int = 0

    is_active: bool = True
    created_at: datetime

    @property
    def is_location_based(self) -> bool:
        return self.business_type == "location_based"

    @property
    def platform_completeness(self) -> float:
        """플랫폼 등록 완성도 (0.0~1.0)"""
        if self.is_location_based:
            fields = [self.naver_place_id, self.kakao_place_id, self.google_place_id, self.website_url]
        else:
            fields = [self.google_place_id, self.website_url]
        filled = sum(1 for f in fields if f)
        return filled / len(fields) if fields else 0.0


class Competitor(BaseModel):
    """경쟁사 — 핵심 엔티티 (DB: competitors)"""

    id: str
    business_id: str      # 내 사업장 FK
    name: str
    address: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None


class Subscription(BaseModel):
    """구독 정보 — 핵심 엔티티 (DB: subscriptions)"""

    id: str
    user_id: str
    plan: Literal["free", "basic", "pro", "biz", "startup"]
    status: Literal["active", "grace_period", "suspended", "cancelled", "expired", "inactive"]
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    billing_key: Optional[str] = None       # 토스 자동결제용
    customer_key: Optional[str] = None
    grace_until: Optional[date] = None      # 유예 기간 종료일

    @property
    def is_active(self) -> bool:
        return self.status in ("active", "grace_period")

    @property
    def is_paid(self) -> bool:
        return self.plan != "free" and self.is_active
