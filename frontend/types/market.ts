// Domain 2 — MarketLandscape (시장 현황)
// 도메인 모델 v2.1 § 6
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
