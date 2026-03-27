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
    region: str
    email: Optional[str] = None  # 대기자 명단 수집용


class BusinessCreate(BaseModel):
    name: str
    category: str
    region: str
    address: Optional[str] = None
    phone: Optional[str] = None
    naver_place_id: Optional[str] = None
    website_url: Optional[str] = None
    keywords: Optional[List[str]] = None


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


class PaymentConfirm(BaseModel):
    paymentKey: str
    orderId: str
    amount: int


class BillingIssueRequest(BaseModel):
    authKey: str
    customerKey: str
    plan: str
    amount: int
