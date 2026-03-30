export type Category = string; // lib/categories.ts 참고

// 핵심 엔티티는 entities.ts에서 관리 (도메인 모델 v2.1 § 4)
export type {
  Plan,
  BusinessType,
  Business,
  Competitor,
  Subscription,
  SubscriptionStatus,
} from "./entities";

export interface CompetitorScore {
  name: string;
  score: number;
  mentioned: boolean;
}

export interface WebsiteCheckResult {
  has_json_ld: boolean;
  has_schema_local_business: boolean;
  has_open_graph: boolean;
  is_mobile_friendly: boolean;
  has_favicon: boolean;
  is_https: boolean;
  title: string;
  error: string | null;
}

export interface ScanResult {
  id: string;
  business_id: string;
  scanned_at: string;
  query_used: string;
  gemini_result?: AIResult;
  chatgpt_result?: AIResult;
  perplexity_result?: AIResult;
  grok_result?: AIResult;
  naver_result?: AIResult;
  claude_result?: AIResult;
  zeta_result?: AIResult;
  google_result?: AIResult;
  kakao_result?: KakaoVisibilityData;
  website_check_result?: WebsiteCheckResult;
  exposure_freq: number;
  total_score: number;
  score_breakdown: ScoreBreakdown;
  naver_channel_score?: number;
  global_channel_score?: number;
  rank_in_query?: number;
  competitor_scores?: Record<string, CompetitorScore>;
}

export interface AIResult {
  platform: string;
  mentioned: boolean;
  rank?: number;
  excerpt?: string;
  exposure_freq?: number;
  exposure_rate?: number;
  citations?: string[];
  confidence?: { lower: number; upper: number };
  in_briefing?: boolean;
  in_ai_overview?: boolean;
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

export interface ScoreHistory {
  id: string;
  business_id: string;
  score_date: string;
  total_score: number;
  exposure_freq: number;
  rank_in_category: number;
  total_in_category: number;
  weekly_change: number;
}

export interface BeforeAfterItem {
  id: string;
  business_id: string;
  capture_type: "before" | "after_30d" | "after_60d" | "after_90d";
  image_url: string;
  created_at: string;
}

export interface Guide {
  id: string;
  business_id: string;
  generated_at: string;
  summary: string;
  items_json: GuideItem[];
  priority_json: string[];
}

export interface GuideItem {
  rank: number;
  category: string;
  title: string;
  action: string;
  expected_effect?: string;
  difficulty: "easy" | "medium" | "hard";
  time_required?: string;
  competitor_example?: string;
}

// Subscription은 entities.ts에서 re-export됩니다.

export interface TrialScanRequest {
  business_name: string;
  category: Category;
  region?: string;
  keyword?: string;
  email?: string;
  business_type?: "location_based" | "non_location";
  website_url?: string;   // non_location 전용 웹사이트 SEO 체크용
}

export interface NaverCompetitor {
  rank: number;
  name: string;
  address: string;
  category: string;
  telephone: string;
  link: string;
}

export interface NaverBlogPost {
  title: string;
  link: string;
  description: string;
  postdate: string;
}

export interface NaverVisibilityData {
  search_query: string;
  my_rank: number | null;
  is_smart_place: boolean;
  blog_mentions: number;
  naver_competitors: NaverCompetitor[];
  top_blogs: NaverBlogPost[];
  top_competitor_name: string | null;
  top_competitor_blog_count: number;
}

export interface KakaoCompetitor {
  rank: number;
  name: string;
  address: string;
  category: string;
  phone: string;
  url: string;
}

export interface KakaoVisibilityData {
  search_query: string;
  my_rank: number | null;
  is_on_kakao: boolean;
  kakao_competitors: KakaoCompetitor[];
}

export interface TrialScanResult {
  score: {
    total_score: number;
    grade: string;
    breakdown: ScoreBreakdown;
    naver_channel_score?: number;
    global_channel_score?: number;
  };
  result: Record<string, AIResult>;
  query: string;
  competitors: string[];
  naver?: NaverVisibilityData;
  kakao?: KakaoVisibilityData;
  message: string;
}

export interface RankingItem {
  business_id: string;
  name: string;
  total_score: number;
  exposure_freq: number;
  rank: number;
  scanned_at: string;
}

export interface BenchmarkData {
  category: string;
  region: string;
  avg_score: number;
  top10_score: number;
  sample_count: number;
  distribution: { range: string; count: number }[];
  fallback?: "region" | "global";
  fallback_message?: string;
}

export interface AdDefenseGuide {
  biz_id: string;
  generated_at: string;
  summary: string;
  strategies: { title: string; action: string; priority: number }[];
}

export interface StartupReportRequest {
  category: string;
  region: string;
  target_business_name?: string;
}

export interface StartupReport {
  category: string;
  region: string;
  competitor_count: number;
  avg_score: number;
  entry_difficulty: "low" | "medium" | "high";
  top_competitors: { name: string; score: number }[];
  strategy: string;
  generated_at: string;
}

export interface StartupMarket {
  category: string;
  region: string;
  business_count: number;
  avg_score: number;
  top_business: { name: string; score: number } | null;
}

export interface TeamMember {
  id: string;
  user_id: string;
  email: string;
  role: "admin" | "member";
  invited_at: string;
  accepted_at?: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at?: string;
}

export interface CompetitorSearchResult {
  name: string;
  address: string;
  category: string;
  phone?: string;
  naver_place_id?: string;
}

export interface CompetitorSuggestion {
  name: string;
  address: string;
  region: string;
  score: number;
}

export interface SharePageData {
  business_name: string;
  category: string;
  region: string;
  score: number;
  grade: string;
  gemini_frequency: number;
  scanned_at: string;
}

export interface MentionContext {
  platform: string;
  sentiment: "positive" | "neutral" | "negative";
  mention_type: "recommendation" | "information" | "comparison" | "warning";
  mentioned_attributes: string[];
  excerpt: string;
  position: "top3" | "middle" | "bottom";
}

export interface BadgeData {
  eligible: boolean;
  grade: string;
  score: number;
  issued_at: string;
  svg_url: string;
  embed_code: string;
}
