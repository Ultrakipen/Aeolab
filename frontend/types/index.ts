export type Category = string; // lib/categories.ts 참고

export type Plan = "free" | "basic" | "pro" | "biz" | "startup" | "enterprise";

export interface Business {
  id: string;
  user_id: string;
  name: string;
  category: Category;
  region: string;
  address?: string;
  phone?: string;
  naver_place_id?: string;
  website_url?: string;
  keywords?: string[];
  is_active: boolean;
  created_at: string;
}

export interface Competitor {
  id: string;
  business_id: string;
  name: string;
  address?: string;
  is_active: boolean;
}

export interface CompetitorScore {
  name: string;
  score: number;
  mentioned: boolean;
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
  exposure_freq: number;
  total_score: number;
  score_breakdown: ScoreBreakdown;
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

export interface Subscription {
  id: string;
  user_id: string;
  plan: Plan;
  status: "active" | "grace_period" | "suspended" | "cancelled" | "expired";
  start_at: string;
  end_at: string;
  billing_key?: string;
  customer_key?: string;
}

export interface TrialScanRequest {
  business_name: string;
  category: Category;
  region: string;
  email?: string;
}

export interface TrialScanResult {
  score: {
    total_score: number;
    grade: string;
    breakdown: ScoreBreakdown;
  };
  result: Record<string, AIResult>;
  query: string;
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
  id: string;
  name: string;
  category: string;
  region: string;
  avg_score: number;
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
