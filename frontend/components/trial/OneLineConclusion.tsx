"use client";

import { TrendingUp } from "lucide-react";

interface OneLineConclusionProps {
  gsLabel: string;
  benchmarkAvg: number;
  isEstimatedBenchmark?: boolean;
  myScore: number;
  categoryLabel: string;
  track1: number;
  track2: number;
  unified: number;
  analyzedKeyword: string;
}

export default function OneLineConclusion({
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
  const borderColor = isAboveAvg ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50";

  return (
    <section className={`rounded-xl border-2 ${borderColor} p-4 md:p-6 mb-4 shadow-sm`}>
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-gray-500 shrink-0" />
        <p className="text-sm md:text-base font-semibold text-gray-600">AI 검색 노출 수준</p>
      </div>

      <p className="text-xl md:text-2xl font-black leading-snug break-keep mb-1 text-gray-900">
        <strong>{gsLabel}</strong> 단계 ·{" "}
        <span className={isAboveAvg ? "text-emerald-700" : "text-red-600"}>
          {categoryLabel} 평균 {isAboveAvg ? "이상" : "이하"}
        </span>
      </p>

      <p className="text-sm md:text-base text-gray-700 leading-relaxed mb-4 break-keep">
        업종 평균{" "}
        <strong>{benchmarkAvg}점</strong>
        {isEstimatedBenchmark && (
          <span className="ml-1 text-sm text-gray-500 font-normal">(추정 · 실측 누적 후 갱신)</span>
        )}{" "}
        vs 내 점수{" "}
        <strong className={isAboveAvg ? "text-emerald-700" : "text-red-700"}>{myScore}점</strong>
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        <span className="inline-flex items-center gap-1 text-sm md:text-sm font-semibold text-blue-800 bg-blue-100 border border-blue-200 rounded-full px-3 py-1">
          <span className="text-blue-500">●</span>
          네이버 트랙 {Math.round(track1)}점
        </span>
        <span className="inline-flex items-center gap-1 text-sm md:text-sm font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-full px-3 py-1">
          <span className="text-slate-500">●</span>
          글로벌 트랙 {Math.round(track2)}점
        </span>
        <span className="inline-flex items-center gap-1 text-sm md:text-sm font-bold text-gray-900 bg-white border-2 border-gray-300 rounded-full px-3 py-1">
          통합 {Math.round(unified)}점
        </span>
      </div>

      <p className="text-sm text-gray-500 italic leading-relaxed break-keep border-t border-gray-200 pt-2 mt-1">
        &lsquo;<strong className="not-italic text-gray-700">{analyzedKeyword}</strong>&rsquo; 키워드 기준 분석 · 측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다
      </p>
    </section>
  );
}
