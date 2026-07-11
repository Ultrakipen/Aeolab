"use client";

import { useState } from "react";
import Link from "next/link";

interface ActionHeroCardProps {
  businessName: string;
  exposureCount: number | null;
  topMissingKeywords: string[];
  todayActionText: string | null;
  copyText: string | null;
  hasScanData: boolean;
  hasRegisteredKeywords?: boolean;
}

export default function ActionHeroCard({
  businessName,
  exposureCount,
  topMissingKeywords,
  todayActionText,
  copyText,
  hasScanData,
  hasRegisteredKeywords = false,
}: ActionHeroCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!copyText) return;
    try {
      navigator.clipboard.writeText(copyText).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } catch {
      // 클립보드 접근 실패 무시
    }
  };

  if (!hasScanData) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 md:p-5 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <p className="text-base md:text-lg font-bold text-blue-900 mb-1">
              ChatGPT는 내 가게를 모릅니다
            </p>
            <p className="text-sm md:text-base text-blue-700">
              지금 AI가 내 가게를 언급하는지 실제로 측정해 드립니다
            </p>
          </div>
          <Link
            href="#scan"
            className="shrink-0 inline-flex items-center justify-center gap-1.5 bg-blue-600 text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors"
            onClick={(e) => {
              e.preventDefault();
              const btn = document.querySelector<HTMLButtonElement>('[data-scan-trigger]');
              if (btn) btn.click();
            }}
          >
            AI 스캔 시작하기
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 md:p-5 mb-4">
      {/* 헤더 */}
      <p className="text-sm font-semibold text-blue-500 mb-3">
        오늘 {businessName}의 AI 노출 현황
      </p>

      <div className="space-y-3">
        {/* 네이버 AI 브리핑 노출 횟수 */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xl">📍</span>
          <span className="text-sm md:text-base text-gray-800">
            네이버 AI 브리핑:{" "}
            <span className="font-bold text-blue-700">
              100번 중{" "}
              {exposureCount !== null ? (
                <span className="text-xl md:text-2xl">{exposureCount}</span>
              ) : (
                <span className="text-gray-500">측정 중</span>
              )}
              {exposureCount !== null && "번"} 언급
            </span>
          </span>
        </div>

        {/* 없는 키워드 */}
        {topMissingKeywords.length > 0 && (
          <div className="flex items-start gap-3 flex-wrap">
            <span className="text-xl shrink-0">❌</span>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-700 font-medium">
                {hasRegisteredKeywords ? "이 키워드로도 확인해 보세요:" : "지금 없는 키워드:"}
              </span>
              {topMissingKeywords.map((kw) => (
                <span
                  key={kw}
                  className="inline-block bg-amber-100 text-amber-800 text-sm font-semibold px-2.5 py-1 rounded-full"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 오늘 할 일 */}
        {todayActionText && (
          <div className="bg-white border border-blue-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <span className="text-base shrink-0">▶</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-blue-600 mb-0.5">오늘 할 일</p>
                <p className="text-sm text-gray-800 font-medium">{todayActionText}</p>
                {copyText && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{copyText}</p>
                )}
              </div>
            </div>
            {copyText && (
              <button
                onClick={handleCopy}
                className="shrink-0 inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                {copied ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    복사됨
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    복사
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
