"use client";

import type { TrialScanningStepProps } from "./TrialSharedTypes";

/**
 * Trial — 스캐닝 진행 화면 (Step: scanning)
 *
 * 부모 page.tsx 가 scanStep 인덱스를 600ms 간격으로 증가시킴.
 * 본 컴포넌트는 SCAN_STEPS 라벨을 단계별 색으로 표시만 한다.
 */
export default function TrialScanningStep({
  scanStep,
  scanSteps,
  selectedTag,
  region,
}: TrialScanningStepProps) {
  return (
    <div className="text-center py-16">
      <div
        className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"
        role="status"
        aria-label="분석 중"
      />
      <h2 className="text-xl font-semibold text-gray-900 mb-1">내 가게 분석 중...</h2>
      <p className="text-gray-500 text-sm mb-8">
        손님이 &ldquo;{region} {selectedTag} 추천&rdquo; 이라고 물어봤을 때<br />
        AI에 내 가게가 노출되는지 진단하고 있습니다.
      </p>
      <div className="max-w-xs mx-auto space-y-2">
        {scanSteps.map((s, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 text-sm px-4 py-2 rounded-lg transition-all ${
              i < scanStep
                ? "text-green-600 bg-green-50"
                : i === scanStep
                  ? "text-blue-600 bg-blue-50 font-medium"
                  : "text-gray-500"
            }`}
          >
            {i < scanStep ? (
              <span aria-hidden="true">✓</span>
            ) : i === scanStep ? (
              <span
                className="w-3 h-3 border-2 border-blue-400 border-t-blue-600 rounded-full animate-spin inline-block"
                aria-hidden="true"
              />
            ) : (
              <span
                className="w-3 h-3 rounded-full bg-gray-200 inline-block"
                aria-hidden="true"
              />
            )}
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}
