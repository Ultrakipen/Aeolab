// Domain 3 — GapAnalysis (격차 분석)
// 도메인 모델 v2.1 § 7

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

export interface GapAnalysis {
  business_id: string;
  scan_id: string;
  analyzed_at: string;
  context: ScanContext;
  vs_top: CompetitorGap;
  dimensions: DimensionGap[];
  gap_card_url?: string;
  estimated_score_if_fixed: number;
}
