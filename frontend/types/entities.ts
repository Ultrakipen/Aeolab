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

  // 카카오맵 완성도 체크리스트 (프론트 체크박스 저장값)
  kakao_score?: number;
  kakao_checklist?: Record<string, boolean>;
  kakao_registered?: boolean;

  // 리뷰 메타 (스캔 시 수집)
  review_count: number;
  avg_rating: number;
  keyword_diversity: number;
  receipt_review_count: number;

  // 인스타그램 연동 (선택)
  instagram_username?: string;
  instagram_connected?: boolean;
  instagram_follower_count?: number;
  instagram_post_count_30d?: number;

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

  // 네이버 플레이스 데이터 (place_synced_at 있을 때 수집됨)
  naver_place_id?: string;
  place_review_count?: number | null;
  place_avg_rating?: number | null;
  place_has_faq?: boolean;
  place_has_recent_post?: boolean;
  place_has_menu?: boolean;
  place_photo_count?: number | null;
  place_synced_at?: string | null;
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
