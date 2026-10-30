// Domain 3 — GapAnalysis (격차 분석)
// 도메인 모델 v2.4 § 7

import { ScanContext } from "./context";

export interface DimensionGap {
  dimension_key: string;
  dimension_label: string;
  my_score: number;
  top_score: number;
  avg_score: number;
  gap_to_top: number;
  gap_reason: string;
  improvement_potential: "high" | "medium" | "low";
  weight: number;
  priority: number;
}

export interface CompetitorGap {
  top_competitor_name: string;
  top_competitor_score: number;
  my_score: number;
  total_gap: number;
  strongest_gap_dimension: string;
  closeable_gap: number;
}

export interface ReviewKeywordGap {
  covered_keywords: string[];
  missing_keywords: string[];
  competitor_only_keywords: string[];
  pioneer_keywords: string[];
  coverage_rate: number;
  top_priority_keyword?: string | null;
  qr_card_message?: string;
  category_scores?: Record<string, { score: number; covered: number; total: number; weight: number }>;
  /** 경쟁사별로 내가 없는 키워드 목록 */
  competitor_keyword_sources?: Record<string, string[]>;
}

export type GrowthStageCode = "survival" | "stability" | "growth" | "dominance";

export interface GrowthStageInfo {
  stage: GrowthStageCode;
  stage_label: string;
  track1_score: number;
  do_this_week: string[];
  avoid: string[];
  next_milestone: string;
}

export interface GapAnalysis {
  business_id: string;
  scan_id: string;
  analyzed_at: string;
  context: ScanContext;
  vs_top: CompetitorGap;
  dimensions: DimensionGap[];
  gap_card_url?: string;
  estimated_score_if_fixed: number;
  // 내 가게를 경쟁사와 같은 공식으로 계산한 비교용 점수(경쟁사 페이지 순위·막대 전용). 입력이 부족하면 null
  my_compare?: { score: number; basis: string; ai_source: string; ai_count: number; ai_sample_size: number } | null;
  // v2.4 추가 — 글로벌 AI 차단 리스크
  naver_only_risk: boolean;
  naver_only_risk_score_impact: number;
  // v2.5 추가 — 키워드 갭 + 성장 단계
  keyword_gap?: ReviewKeywordGap;
  growth_stage?: GrowthStageInfo;
}
