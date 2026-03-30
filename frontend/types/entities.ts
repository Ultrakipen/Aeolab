/**
 * AEOlab 핵심 엔티티 타입 (도메인 모델 v2.1 § 4)
 * Business, Competitor, Subscription — DB 테이블과 1:1 대응
 *
 * 4개 도메인(DiagnosisReport, MarketLandscape, GapAnalysis, ActionPlan)의 입력값입니다.
 * frontend/types/index.ts에서 re-export합니다.
 */

export type Plan = "free" | "basic" | "pro" | "biz" | "startup" | "enterprise";

export type BusinessType = "location_based" | "non_location";

export interface Business {
  id: string;
  user_id: string;
  name: string;
  category: string;
  business_type: BusinessType;
  region?: string;           // location_based 필수, non_location = undefined
  address?: string;
  phone?: string;
  website_url?: string;
  keywords?: string[];

  // 플랫폼 등록 현황
  naver_place_id?: string;
  google_place_id?: string;
  kakao_place_id?: string;

  // 리뷰 메타 (스캔 시 수집)
  review_count: number;
  avg_rating: number;
  keyword_diversity: number;
  receipt_review_count: number;

  is_active: boolean;
  created_at: string;
}

export interface Competitor {
  id: string;
  business_id: string;      // 내 사업장 FK
  name: string;
  address?: string;
  is_active: boolean;
  created_at?: string;
}

export type SubscriptionStatus =
  | "active"
  | "grace_period"
  | "suspended"
  | "cancelled"
  | "expired"
  | "inactive";

export interface Subscription {
  id: string;
  user_id: string;
  plan: Plan;
  status: SubscriptionStatus;
  start_at?: string;
  end_at?: string;
  billing_key?: string;
  customer_key?: string;
  grace_until?: string;
}
