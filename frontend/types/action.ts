// Domain 4 — ActionPlan (실행 계획)
// 도메인 모델 v2.1 § 8

import { ScanContext } from "./context";

export interface ActionItem {
  rank: number;
  dimension: string;
  title: string;
  action: string;
  expected_effect: string;
  difficulty: "easy" | "medium" | "hard";
  time_required: string;
  competitor_example?: string;
  is_quick_win: boolean;
}

export interface FAQ {
  question: string;
  answer: string;
}

export interface ActionTools {
  json_ld_schema: string;
  faq_list: FAQ[];
  keyword_list: string[];
  blog_post_template: string;
  smart_place_checklist?: string[];   // location_based 전용
  seo_checklist?: string[];           // non_location 전용
}

export interface ActionProgress {
  total_items: number;
  completed_items: number;
  completion_rate: number;
  completed_ranks: number[];
}

export interface ActionPlan {
  plan_id: string;
  business_id: string;
  scan_id: string;
  generated_at: string;
  context: ScanContext;
  summary: string;
  items: ActionItem[];
  quick_wins: ActionItem[];
  next_month_goal: string;
  tools: ActionTools;
  progress?: ActionProgress;
}
