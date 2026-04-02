// Domain 2 — MarketLandscape (시장 현황)
// 도메인 모델 v2.4 § 6
// API: GET /api/report/market/{biz_id}

import type { ScanContext } from "./context";

export interface MarketPosition {
  my_score: number;
  my_rank: number | null;
  total_in_category: number;
  percentile: number | null;       // 상위 몇 %인지 (100이면 최상위)
  avg_score: number;
  top10_score: number;
}

export interface CompetitorProfile {
  id: string;
  name: string;
  address?: string;
  score: number;
  grade?: "A" | "B" | "C" | "D";
  is_naver_smart_place?: boolean;
  is_on_kakao?: boolean;
  blog_mentions?: number;
  ai_mentioned?: boolean;
  ai_platform_count?: number;
  strengths?: string[];
  rank?: number;
  // v2.4 추가 — "왜 저 가게가 잘 나오는지" 구체적 근거
  smart_place_faq_count?: number;     // 스마트플레이스 Q&A 등록 수 (AI 브리핑 직결)
  recent_blog_post_count?: number;    // 최근 30일 블로그 언급 수
  response_rate?: number;             // 리뷰 답변율 0.0~1.0 (AI 신뢰도 신호)
  top_review_keywords?: string[];     // 경쟁사 리뷰 핵심 키워드 (최대 5개)
}

export interface MarketDistributionBand {
  grade: "A" | "B" | "C" | "D";
  range: string;                   // "80~100", "60~80", ...
  count: number;
}

export interface MarketLandscape {
  biz_id: string;
  context: ScanContext;
  category: string;
  region?: string;                 // location_based 필수, non_location = undefined
  market_position: MarketPosition;
  competitors: CompetitorProfile[];
  distribution: MarketDistributionBand[];
  sample_count: number;
}
