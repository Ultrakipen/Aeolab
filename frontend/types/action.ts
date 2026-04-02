// Domain 4 — ActionPlan (실행 계획)
// 도메인 모델 v2.4 § 8

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

// v2.4 신규 — 리뷰 답변 초안
export interface ReviewResponseDraft {
  review_snippet: string;             // 원본 리뷰 일부
  rating?: number;                    // 별점 (1~5)
  draft_response: string;             // 사장님이 바로 복사·붙여넣기 가능한 답변
  tone: "grateful" | "apologetic" | "neutral";
}

export interface ActionTools {
  json_ld_schema: string;
  faq_list: FAQ[];
  keyword_list: string[];
  blog_post_template: string;
  smart_place_checklist?: string[];   // location_based 전용
  seo_checklist?: string[];           // non_location 전용
  // v2.4 추가 — 소상공인 즉시 활용 도구
  review_response_drafts: ReviewResponseDraft[];    // 리뷰 답변 초안 3개
  smart_place_faq_answers?: FAQ[];                  // 스마트플레이스 Q&A 바로 등록용
  review_request_message: string;                   // QR·영수증 리뷰 유도 문구
  naver_post_template?: string;                     // 스마트플레이스 '소식' 공지 초안
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
