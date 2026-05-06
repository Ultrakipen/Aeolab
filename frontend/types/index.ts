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
  naver_result?: NaverResult;
  google_result?: AIResult;
  kakao_result?: KakaoVisibilityData;
  website_check_result?: WebsiteCheckResult;
  exposure_freq: number;
  total_score: number;
  // v3.0 듀얼트랙 점수
  unified_score?: number;
  track1_score?: number;
  track2_score?: number;
  naver_weight?: number;
  global_weight?: number;
  keyword_coverage?: number;
  growth_stage?: string;
  growth_stage_label?: string;
  is_keyword_estimated?: boolean;
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

export interface NaverCompetitor {
  rank: number;
  name: string;
  address?: string;
  blog_count?: number;
}

export interface KeywordBlogComparison {
  keyword: string;
  competitor_name?: string;
  competitor_count: number;
  my_count: number;
}

export interface KeywordRank {
  query: string;
  exposed: boolean;
  rank?: number | null;
}

export interface NaverTopBlog {
  link: string;
  title: string;
  description?: string;
  postdate?: string;
}

/** 네이버 스캔 결과 — AIResult를 확장한 네이버 전용 필드 포함 */
export interface NaverResult extends AIResult {
  my_rank?: number | null;
  blog_mentions?: number;
  top_competitor_name?: string;
  top_competitor_blog_count?: number;
  is_smart_place?: boolean;
  naver_competitors?: NaverCompetitor[];
  top_blogs?: NaverTopBlog[];
  keyword_blog_comparison?: KeywordBlogComparison[];
  keyword_ranks?: KeywordRank[];
  in_briefing?: boolean;
  briefing_excerpt?: string | null;
  search_query?: string;
  captcha_detected?: boolean;
  error?: string;
}

export interface ScoreBreakdown {
  // 하위호환 필드
  exposure_freq: number;
  review_quality: number;
  schema_score: number;
  online_mentions: number;
  info_completeness: number;
  content_freshness: number;
  // v3.0 Track 1 항목
  keyword_gap_score?: number;
  smart_place_completeness?: number;
  naver_exposure_confirmed?: number;
  // v3.0 Track 2 항목
  multi_ai_exposure?: number;
  schema_seo?: number;
  online_mentions_t2?: number;
  google_presence?: number;
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
  capture_type: "before" | "after_7d" | "after_14d" | "after_30d" | "after_60d" | "after_90d";
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
  keywords?: string[];  // 등록 키워드 목록 (복수)
  email?: string;
  business_type?: "location_based" | "non_location";
  website_url?: string;
  // v3.0 스마트플레이스 체크박스
  has_faq?: boolean;
  has_recent_post?: boolean;
  has_intro?: boolean;
  is_smart_place?: boolean;  // 사용자 직접 입력 — API 결과보다 우선 적용
  review_text?: string;
  description?: string;
  // 신뢰도 강화 1라운드: 네이버 지역검색에서 선택한 가게의 place ID
  naver_place_id?: string;
  // v3.3-fix: 사용자가 후보를 명시적으로 선택했을 때만 채워서 전달
  // 백엔드는 이 객체가 있을 때만 응답 place_match를 채운다 (재검색·자동 매칭 금지)
  place_match?: {
    title: string;
    address: string;
    phone: string | null;
    naver_place_id: string;
    naver_place_url: string;
    category?: string;
    mapx?: string;
    mapy?: string;
  };
}

// 신뢰도 강화 1라운드 — 네이버 지역검색 후보 항목
export interface TrialBusinessCandidate {
  title: string;
  address: string;
  phone: string | null;
  category: string;
  naver_place_id: string;
  naver_place_url: string;
  mapx?: string;
  mapy?: string;
}

// 신뢰도 강화 1라운드 — 검색 응답
export interface TrialBusinessSearchResponse {
  results: TrialBusinessCandidate[];
  fallback_to_manual: boolean;
}

// 신뢰도 강화 1라운드 — 결과 화면 매칭 카드 데이터
export interface TrialPlaceMatch {
  name: string;
  address: string;
  phone: string | null;
  rating: number | null;
  review_count: number | null;
  category: string;
  business_status: string | null;
  naver_place_id: string;
  naver_place_url: string;
}

// 신뢰도 강화 1라운드 — 스마트플레이스 자동 진단 카드 데이터
export interface TrialSmartPlaceCheck {
  is_smart_place: boolean;
  has_faq: boolean;
  has_recent_post: boolean;
  has_intro: boolean;
  score_loss: number;
  action_links: {
    register?: string;
    faq?: string;
    post?: string;
    intro?: string;
  };
}

// 신뢰도 강화 2라운드 — AI 응답 원문 증거 카드
export interface TrialAIEvidenceQuery {
  query: string;
  mentioned: boolean;
  excerpt: string;
}
export interface TrialAIEvidence {
  platform: string;
  total_queries: number;
  mentioned_count: number;
  queries: TrialAIEvidenceQuery[];
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
  keyword_ranks?: KeywordRank[];
  in_briefing?: boolean;
  briefing_excerpt?: string | null;
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

export interface GrowthStage {
  stage: "survival" | "stability" | "growth" | "dominance";
  stage_label: string;
  score_range: string;
  focus_message: string;
  this_week_action: string;
  do_not_do: string;
  estimated_weeks_to_next?: number;
}

export interface TrialScanResult {
  score: {
    total_score: number;
    unified_score?: number;
    track1_score?: number;
    track2_score?: number;
    naver_weight?: number;
    global_weight?: number;
    growth_stage?: string;
    growth_stage_label?: string;
    is_keyword_estimated?: boolean;
    grade: string;
    breakdown: ScoreBreakdown;
    naver_channel_score?: number;
    global_channel_score?: number;
  };
  // v3.0 키워드 갭
  track1_score?: number;
  track2_score?: number;
  naver_weight?: number;
  global_weight?: number;
  growth_stage?: GrowthStage;
  growth_stage_label?: string;
  is_keyword_estimated?: boolean;
  top_missing_keywords?: string[];
  pioneer_keywords?: string[];
  keyword_coverage_rate?: number;
  faq_copy_text?: string;
  keyword_blog_comparison?: Array<{
    keyword: string;
    my_count: number;
    competitor_name: string;
    competitor_count: number;
  }>;
  result: Record<string, AIResult>;
  query: string;
  competitors: string[];
  naver?: NaverVisibilityData;
  kakao?: KakaoVisibilityData;
  website_health?: WebsiteCheckResult;
  message: string;
  context?: string;
  // 신뢰도 강화 1라운드 — 네이버 place_id 선택 시 자동 진단 결과
  place_match?: TrialPlaceMatch | null;
  smart_place_check?: TrialSmartPlaceCheck | null;
  // 신뢰도 강화 2라운드 — AI 응답 원문 증거
  ai_evidence?: TrialAIEvidence | null;
  // Trial Conversion Funnel — 30일 보관용 trial_scans.id
  trial_id?: string;
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

export interface BusinessSearchResult {
  name: string;
  address: string;
  category: string;
  phone: string;
  region?: string;
  naver_place_url: string;
  naver_place_id: string;
  kakao_place_id: string;
  review_count: number;
  avg_rating: number;
  source: 'kakao' | 'naver' | 'both';
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
  platform_label?: string;
  query?: string;
  mentioned?: boolean;
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
export interface Notice {
  id: number;
  title: string;
  content: string;
  category: "general" | "update" | "maintenance";
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface FAQ {
  id: number;
  question: string;
  answer: string;
  category: "general" | "pricing" | "scan" | "guide";
  order_num: number;
  is_active: boolean;
  created_at: string;
}

export interface Inquiry {
  id: number;
  name: string;
  email: string;
  subject: string;
  content: string;
  status: 'pending' | 'answered';
  answer: string | null;
  answered_at: string | null;
  created_at: string;
}

// ── 스마트플레이스·블로그 AI 최적화 (SchemaClient v2) ───────────────────────

export interface IntroScore {
  score: number;
  grade: "A" | "B" | "C" | "D";
  matched_keywords: string[];
  missing_top_keywords: string[];
  total_checked: number;
}

export interface BlogDraft {
  template_type: string;
  title: string;
  content: string;
  target_keyword: string;
}

export interface CategoryTips {
  smartplace_tip: string;
  blog_tip: string;
  no_website_guide?: string;
}

export interface SchemaResult {
  smartplace_intro: string;
  blog_title: string;
  blog_content: string;
  keywords: string[];
  smartplace_checklist: Array<{ item: string; tip: string }>;
  script_tag?: string;
  intro_score?: IntroScore;
  blog_drafts?: BlogDraft[];
  category_tips?: CategoryTips;
  extended_checklist?: Array<{ item: string; tip: string }>;
  no_website_guide?: string;
}

// ── 블로그 진단 (GuideClient BlogDiagnosisCard) ──────────────────────────────

export interface BlogAnalysisResult {
  platform: string;
  post_count: number;
  total_post_count?: number;
  latest_post_date: string | null;
  keyword_coverage: number;
  covered_keywords: string[];
  missing_keywords: string[];
  ai_readiness_score: number;
  ai_readiness_items: Array<{ label: string; passed: boolean; tip: string }>;
  freshness: "fresh" | "stale" | "outdated";
  top_recommendation: string;
  error?: string;
}

// 네이버 데이터랩 키워드 검색량
export interface KeywordVolume {
  keyword: string;
  monthly_pc: number;
  monthly_mo: number;
  monthly_total: number;
  competition?: 'low' | 'medium' | 'high';
}

// 업종 트렌드 (네이버 데이터랩 상대 지수)
export interface IndustryTrend {
  category: string;
  region?: string;
  trend_data: Array<{ period: string; ratio: number }>;
  trend_direction: 'rising' | 'falling' | 'stable';
  trend_delta: number;
}

export type ConversionTipEvidence = "keyword_gap" | "ai_citation" | "smart_place" | "review";

export interface ConversionTip {
  id: string;
  title: string;
  reason: string;
  evidence_type: ConversionTipEvidence;
  evidence_badge: string;
  urgency: "do_now" | "this_week" | "this_month";
  urgency_label: string;
  estimated_time: string;
  impact: string;
  copy_text: string;
  action_url: string | null;
  action_label: string;
  action_steps?: string[];
  locked: boolean;
}

export interface ConversionTipsResponse {
  business_name: string;
  plan: string;
  summary: string;
  tips: ConversionTip[];
  missing_platforms: string[];
  growth_stage: { stage?: string; message?: string } | null;
  locked_count: number;
}

export interface IntroGeneratedResult {
  intro_text: string;
  char_count: number;
  qa_count: number;
  keywords_included: string[];
}

export interface TalktalkFAQItem {
  question: string;
  answer: string;
  category: string;
}

export interface TalktalkFAQGeneratedResult {
  items: TalktalkFAQItem[];
  chat_menus: string[];
}
