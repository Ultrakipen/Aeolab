"use client";

import { Search, Check } from "lucide-react";
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
    <div className="max-w-md mx-auto px-4 py-8 md:py-12 text-center">
      {/* 스피너 + 이모지 오버레이 */}
      <div className="relative mx-auto mb-8 w-20 h-20">
        <div className="w-20 h-20 border-4 border-blue-100 rounded-full" />
        <div
          className="absolute inset-0 w-20 h-20 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"
          role="status"
          aria-label="분석 중"
        />
        <span
          className="absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <Search className="w-5 h-5 text-blue-600" />
        </span>
      </div>

      {/* 제목 */}
      <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">
        내 가게 AI 노출 진단 중...
      </h2>
      <p className="text-base text-slate-500 leading-relaxed mb-2">
        <span className="font-semibold text-blue-600">
          &ldquo;{[region, selectedTag].filter(Boolean).join(" ") || "이 업종"} 추천&rdquo;
        </span>
        을<br />
        ChatGPT·네이버 AI에게 직접 물어보고 있습니다
      </p>
      <p className="text-sm text-slate-400 mb-8">보통 30~60초 소요됩니다</p>

      {/* 스캔 단계 목록 */}
      <div className="max-w-sm mx-auto space-y-2 text-left">
        {scanSteps.map((s, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              i < scanStep
                ? "bg-emerald-50 text-emerald-700"
                : i === scanStep
                  ? "bg-blue-50 text-blue-700 font-semibold shadow-sm"
                  : "text-slate-400"
            }`}
          >
            <span className="shrink-0 w-5 h-5 flex items-center justify-center">
              {i < scanStep ? (
                <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" />
              ) : i === scanStep ? (
                <span
                  className="w-4 h-4 border-2 border-blue-400 border-t-blue-600 rounded-full animate-spin inline-block"
                  aria-hidden="true"
                />
              ) : (
                <span
                  className="w-3 h-3 rounded-full bg-slate-200 inline-block"
                  aria-hidden="true"
                />
              )}
            </span>
            <span className="text-base">{s}</span>
          </div>
        ))}
      </div>

      {/* 하단 안심 메시지 */}
      <p className="text-sm text-slate-400 mt-8 leading-relaxed">
        실제로 AI에게 질문을 보내고 응답을 분석합니다.
        <br />
        창을 닫으면 결과가 사라질 수 있습니다.
      </p>
    </div>
  );
}
