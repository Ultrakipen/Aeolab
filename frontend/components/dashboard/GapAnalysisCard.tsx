import type { GapAnalysis } from "@/types/gap";
import { TrendingUp, AlertTriangle } from "lucide-react";

interface Props {
  gap: GapAnalysis;
}

const DIMENSION_LABELS: Record<string, string> = {
  exposure_freq:     "AI 검색 노출 빈도",
  review_quality:    "리뷰 수·평점",
  schema_score:      "AI 인식 최적화",
  online_mentions:   "온라인 언급 빈도",
  info_completeness: "정보 완성도",
  content_freshness: "최신성",
};

export function GapAnalysisCard({ gap }: Props) {
  const top3 = gap.dimensions
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp className="w-4 h-4 text-orange-500" />
        <div className="text-sm font-medium text-gray-700">1위와 나의 격차 분석</div>
      </div>
      <p className="text-sm text-gray-400 mb-4">
        최고 점수 경쟁사 대비 나의 부족한 항목을 우선순위 순으로 보여줍니다.
        {gap.vs_top?.top_competitor_name && (
          <span className="ml-1 text-gray-500">
            (비교 대상: <strong>{gap.vs_top.top_competitor_name}</strong>{" "}
            {gap.vs_top.top_competitor_score}점)
          </span>
        )}
      </p>

      {top3.length === 0 ? (
        <p className="text-sm text-gray-400">경쟁사를 먼저 등록하면 격차 분석이 가능합니다.</p>
      ) : (
        <div className="space-y-3">
          {top3.map((d) => {
            const potentialWidth = d.improvement_potential === "high" ? 85 : d.improvement_potential === "medium" ? 55 : 25;
            return (
              <div key={d.dimension_key} className="flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-700">
                      {DIMENSION_LABELS[d.dimension_key] ?? d.dimension_key}
                    </span>
                    <span className="text-sm text-red-500 font-semibold shrink-0">
                      -{Math.round(d.gap_to_top)}점
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{d.gap_reason}</p>
                  <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-400 rounded-full" style={{ width: `${potentialWidth}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {gap.estimated_score_if_fixed > 0 && gap.vs_top?.my_score > 0 && (
        <div className="mt-4 bg-blue-50 rounded-xl p-3 text-sm text-blue-700">
          위 3개 항목 개선 시 예상 점수:{" "}
          <strong className="text-blue-900">
            {Math.round(gap.estimated_score_if_fixed)}점
          </strong>{" "}
          (현재 {Math.round(gap.vs_top.my_score)}점)
        </div>
      )}
    </div>
  );
}
