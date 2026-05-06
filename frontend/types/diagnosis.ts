// Domain 1 — DiagnosisReport (진단 리포트)
// 도메인 모델 v2.4 § 5

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
  // v2.4 추가 — AI 브리핑 노출 품질 신호
  briefing_keyword?: string;          // 어떤 검색어에서 브리핑 노출됐는지
  briefing_excerpt?: string;          // 브리핑에서 내 가게를 어떻게 소개했는지
  smart_place_faq_count: number;      // 소개글 Q&A 포함 여부 참고용 (Q&A 탭 2026-05 폐기)
  smart_place_photo_count: number;    // 스마트플레이스 사진 수
  // v2.4 추가 — 카카오 리뷰 데이터
  kakao_review_count: number;         // 카카오맵 리뷰 수
  kakao_avg_rating: number;           // 카카오맵 평점
}

// v2.4 신규 — 실제 고객 행동 신호 (스마트플레이스 API 연동)
export interface CustomerSignals {
  smart_place_views_week?: number;    // 7일 스마트플레이스 조회수
  smart_place_saves?: number;         // 저장(찜) 수
  phone_clicks_week?: number;         // 7일 전화 연결 클릭
  direction_clicks_week?: number;     // 7일 길 찾기 클릭
  photo_views_week?: number;          // 7일 사진 조회수
  views_change_pct?: number;          // 전주 대비 조회수 변화율 (%)
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
  exposure_freq: number;      // AI 검색 노출 빈도 (25% / 35%)
  review_quality: number;     // 리뷰 수·평점·키워드 (25% / 10%)
  schema_score: number;       // 정보 구조화 점수 (20% / 20%)
  online_mentions: number;    // 온라인 언급 빈도 (15% / 20%)
  info_completeness: number;  // 정보 완성도 (10%)
  content_freshness: number;  // 콘텐츠 최신성 (5%)
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

// v단계1 — AI 브리핑 노출 설정 상태
export type AiInfoTabStatus = "not_visible" | "off" | "on" | "disabled" | "unknown";

export interface BriefingMeta {
  eligibility: "active" | "likely" | "inactive";
  ai_info_tab_status: AiInfoTabStatus;
  explanation: string;
}

// v단계1 — 스캔 결과 missing 항목 (critical 우선순위 포함)
export interface MissingItem {
  item: string;
  desc: string;
  gain: number;
  priority?: "critical" | "high" | "medium" | "low";
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
  customer_signals?: CustomerSignals;   // v2.4 — 스마트플레이스 API 연동 시
  score: ScoreResult;
  briefing_meta?: BriefingMeta;         // v단계1 — AI 브리핑 노출 설정 상태
  missing?: MissingItem[];              // v단계1 — critical 포함 missing 항목 목록
}
