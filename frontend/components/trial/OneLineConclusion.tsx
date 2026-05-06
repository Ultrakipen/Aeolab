"use client";

interface OneLineConclusionProps {
  /** 점수(0-100) → 손님 10명 중 N명 */
  visitorReach: number;
  /** 성장 단계 라벨 (예: "성장 중", "안정화") */
  gsLabel: string;
  /** 업종 평균 점수 */
  benchmarkAvg: number;
  /** true면 API 실측값이 아닌 업종 추정값 — (추정) 배지 표시 */
  isEstimatedBenchmark?: boolean;
  /** 내 점수 */
  myScore: number;
  /** 업종 한글 라벨 */
  categoryLabel: string;
  /** track1 점수 */
  track1: number;
  /** track2 점수 */
  track2: number;
  /** unified 점수 */
  unified: number;
  /** 분석에 사용된 키워드 (Task 7 — 회색 글씨로 1줄 표시) */
  analyzedKeyword: string;
}

/**
 * 한 줄 결론 섹션 (4섹션 구조의 섹션 2)
 *
 * - 큰 텍스트 1줄: 손님 N명 도달
 * - 보조 1줄: 업종 평균 vs 내 점수
 * - DualTrack 점수 배지 (track1 / track2 / unified)
 * - 회색 1줄: 분석 기준 키워드 (Task 7 통합)
 */
export default function OneLineConclusion({
  visitorReach,
  gsLabel,
  benchmarkAvg,
  myScore,
  categoryLabel,
  track1,
  track2,
  unified,
  analyzedKeyword,
  isEstimatedBenchmark = false,
}: OneLineConclusionProps) {
  const isAboveAvg = myScore >= benchmarkAvg;
  const reachColor =
    visitorReach >= 7 ? "text-emerald-700" : visitorReach >= 5 ? "text-amber-700" : "text-red-700";
  const reachBg =
    visitorReach >= 7 ? "bg-emerald-50 border-emerald-200" : visitorReach >= 5 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";

  return (
    <section className={`rounded-2xl border-2 ${reachBg} p-4 md:p-6 mb-4 shadow-sm`}>
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl md:text-2xl">📊</span>
        <p className="text-sm md:text-base font-semibold text-gray-600">한 줄 결론</p>
      </div>

      {/* 큰 텍스트 — 손님 N명 도달 */}
      <p className={`text-xl md:text-3xl font-black leading-snug break-keep mb-3 ${reachColor}`}>
        손님 10명 중 <span className="text-2xl md:text-4xl">{visitorReach}명</span>만 내 가게에 도달합니다
      </p>

      {/* 보조 — 업종 평균 vs 내 점수 */}
      <p className="text-sm md:text-base text-gray-700 leading-relaxed mb-4 break-keep">
        <strong>{gsLabel}</strong> · 업종 평균{" "}
        <strong>{benchmarkAvg}점</strong>
        {isEstimatedBenchmark && (
          <span className="ml-1 text-xs text-gray-400 font-normal">(추정 · 실측 누적 후 갱신)</span>
        )}{" "}
        vs 내 점수 <strong className={isAboveAvg ? "text-emerald-700" : "text-red-700"}>{myScore}점</strong>
        {" — "}
        <span className={isAboveAvg ? "text-emerald-700 font-semibold" : "text-red-600 font-semibold"}>
          {categoryLabel} 기준 {isAboveAvg ? "평균 이상" : "평균 이하"}
        </span>
      </p>

      {/* DualTrack 배지 */}
      <div className="flex flex-wrap gap-2 mb-3">
        <span className="inline-flex items-center gap-1 text-xs md:text-sm font-semibold text-blue-800 bg-blue-100 border border-blue-200 rounded-full px-3 py-1">
          <span className="text-blue-500">●</span>
          네이버 트랙 {Math.round(track1)}점
        </span>
        <span className="inline-flex items-center gap-1 text-xs md:text-sm font-semibold text-purple-800 bg-purple-100 border border-purple-200 rounded-full px-3 py-1">
          <span className="text-purple-500">●</span>
          글로벌 트랙 {Math.round(track2)}점
        </span>
        <span className="inline-flex items-center gap-1 text-xs md:text-sm font-bold text-gray-900 bg-white border-2 border-gray-300 rounded-full px-3 py-1">
          ⭐ 통합 {Math.round(unified)}점
        </span>
      </div>

      {/* Task 7 — 분석 기준 키워드 (회색 작은 글씨 1줄) */}
      <p className="text-xs md:text-sm text-gray-500 italic leading-relaxed break-keep border-t border-gray-200 pt-2 mt-1">
        이 분석은 &lsquo;<strong className="not-italic text-gray-700">{analyzedKeyword}</strong>&rsquo; 키워드 기준입니다
      </p>
    </section>
  );
}
