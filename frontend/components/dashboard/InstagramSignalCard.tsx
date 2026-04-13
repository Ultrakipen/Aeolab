"use client";

/**
 * InstagramSignalCard — 인스타그램 AI 인용 신호 카드
 *
 * 연동된 경우: ai_citation_signal 진행 바 + 팁 목록
 * 미연동 시: 연동 유도 CTA
 */

import Link from "next/link";
import type { InstagramResult } from "@/types";

interface Props {
  instagramResult?: InstagramResult | null;
  isConnected: boolean;
}

function SignalBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, Math.round(value * 100)));
  const color =
    pct >= 60 ? "bg-green-500" : pct >= 35 ? "bg-yellow-400" : "bg-red-400";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">ChatGPT 인용 가능성</span>
        <span
          className={`text-base font-bold ${
            pct >= 60
              ? "text-green-600"
              : pct >= 35
              ? "text-yellow-600"
              : "text-red-600"
          }`}
        >
          {pct}%
        </span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function InstagramSignalCard({ instagramResult, isConnected }: Props) {
  if (!isConnected || !instagramResult) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-base md:text-lg font-bold text-gray-900">
              인스타그램 AI 인용 신호
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              ChatGPT·Perplexity의 인스타그램 인용 가능성 측정
            </p>
          </div>
          <span className="shrink-0 text-sm font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
            미연동
          </span>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 mb-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            인스타그램 비즈니스 계정을 연동하면{" "}
            <span className="font-semibold text-gray-800">
              ChatGPT 인용 가능성
            </span>
            을 측정할 수 있습니다.
          </p>
          <ul className="mt-2 space-y-1">
            {[
              "팔로워 수·게시물 빈도 기반 AI 노출 신호 계산",
              "부족한 콘텐츠 방향 팁 자동 제공",
              "Perplexity 인용 가능성 별도 표시",
            ].map((tip) => (
              <li key={tip} className="flex items-start gap-1.5 text-sm text-gray-500">
                <span className="text-gray-300 mt-0.5 shrink-0">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>

        <Link
          href="/settings"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-pink-600 text-white text-sm font-semibold rounded-xl hover:bg-pink-700 transition-colors"
        >
          <span>📷</span>
          지금 연동하기
        </Link>
      </div>
    );
  }

  const signal = instagramResult.ai_citation_signal ?? 0;
  const tips = instagramResult.tips?.slice(0, 3) ?? [];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5 space-y-4">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h2 className="text-base md:text-lg font-bold text-gray-900">
            인스타그램 AI 인용 신호
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            ChatGPT·Perplexity의 인스타그램 인용 가능성 측정
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
          연동됨
        </span>
      </div>

      {/* 계정 메타 */}
      <div className="flex flex-wrap gap-3">
        {instagramResult.username && (
          <span className="text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
            @{instagramResult.username}
          </span>
        )}
        {instagramResult.follower_count !== undefined && (
          <span className="text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
            팔로워 {instagramResult.follower_count.toLocaleString()}명
          </span>
        )}
        {instagramResult.post_count_30d !== undefined && (
          <span className="text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
            월 게시물 {instagramResult.post_count_30d}개
          </span>
        )}
      </div>

      {/* AI 인용 신호 진행 바 */}
      <SignalBar value={signal} />

      {/* 키워드 커버리지 */}
      {instagramResult.keyword_coverage !== undefined && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">키워드 커버리지</span>
          <span className="font-semibold text-gray-800">
            {Math.round(instagramResult.keyword_coverage * 100)}%
          </span>
        </div>
      )}

      {/* 개선 팁 */}
      {tips.length > 0 && (
        <div className="bg-pink-50 border border-pink-100 rounded-xl p-3 md:p-4">
          <p className="text-sm font-semibold text-pink-800 mb-2">
            📌 AI 인용 신호 개선 팁
          </p>
          <ul className="space-y-1.5">
            {tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-1.5 text-sm text-pink-700 leading-relaxed">
                <span className="shrink-0 mt-0.5">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
