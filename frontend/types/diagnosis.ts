// Domain 1 — DiagnosisReport (진단 리포트)
// 도메인 모델 v2.1 § 5

import { ScanContext } from "./context";

export interface PlatformRegistration {
  naver_smart_place: boolean;
  kakao_maps: boolean;
  google_maps: boolean;
  website: boolean;
}

export interface BusinessSnapshot {
  name: string;
  category: string;
  context: ScanContext;
  region?: string;                  // location_based 필수, non_location = undefined
  platform_registration: PlatformRegistration;
  keyword_count: number;
}

export interface AIPlatformResult {
  platform: string;
  mentioned: boolean;
  rank?: number;
  excerpt?: string;
  confidence?: { lower: number; upper: number };
  in_briefing?: boolean;
  in_ai_overview?: boolean;
  error?: string;
}

export interface AIVisibility {
  exposure_freq: number;
  exposure_rate: number;
  platforms: Record<string, AIPlatformResult>;
  mentioned_count: number;
  query_used: string;
}

export interface ChannelScores {
  naver_channel: number;
  global_channel: number;
  dominant_channel: "naver" | "global" | "balanced";
  channel_gap: number;
}

export interface NaverChannelDetail {
  in_ai_briefing: boolean;
  is_smart_place: boolean;
  blog_mentions: number;
  is_on_kakao: boolean;
  naver_rank: number | null;
  top_competitor_blog_count: number;
}

export interface WebsiteHealth {
  has_website: boolean;
  is_https: boolean;
  is_mobile_friendly: boolean;
  has_json_ld: boolean;
  has_schema_local_business: boolean;
  has_open_graph: boolean;
  has_favicon: boolean;
  title?: string;
  error?: string;
}

export interface ScoreBreakdown {
  exposure_freq: number;
  review_quality: number;
  schema_score: number;
  online_mentions: number;
  info_completeness: number;
  content_freshness: number;
}

export interface ScoreResult {
  total_score: number;
  grade: "A" | "B" | "C" | "D";
  breakdown: ScoreBreakdown;
  channel_scores: ChannelScores;
  weekly_change?: number;
  rank_in_category?: number;
  total_in_category?: number;
}

export interface DiagnosisReport {
  scan_id: string;
  business_id: string;
  scanned_at: string;
  context: ScanContext;
  snapshot: BusinessSnapshot;
  ai_visibility: AIVisibility;
  naver_detail?: NaverChannelDetail;    // location_based 전용
  website_health?: WebsiteHealth;       // 웹사이트 있을 때만
  score: ScoreResult;
}
