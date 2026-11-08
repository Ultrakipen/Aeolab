"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, TrendingDown, Calculator } from "lucide-react";
import { PLAN_PRICES } from "@/lib/plans";
import { SiteFooter } from "@/components/common/SiteFooter";

const AEOLAB_MONTHLY = PLAN_PRICES.basic;

export default function AdCostCalculatorPage() {
  const [adCost, setAdCost] = useState(300000); // 기본 30만원

  const adCostManWon = Math.round(adCost / 10000);
  const aeolab12mo = AEOLAB_MONTHLY * 12;
  const adCost12mo = adCost * 12;

  const formatWon = (v: number) =>
    v >= 10000
      ? `${(v / 10000).toFixed(v % 10000 === 0 ? 0 : 1)}만원`
      : `${v.toLocaleString()}원`;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-8 md:py-10">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            홈으로
          </Link>
          <div className="flex items-center gap-2 mb-2">
            <Calculator className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl md:text-3xl font-black text-gray-900">광고비 vs 구독료 비교</h1>
          </div>
          <p className="text-sm md:text-base text-gray-600">
            내 광고비와 AEOlab 구독료를 나란히 비교해 보세요
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 md:py-12 space-y-6">
        {/* 슬라이더 카드 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 md:p-6">
          <label className="block text-sm font-semibold text-gray-700 mb-4">
            현재 월 광고비
          </label>

          {/* 금액 표시 */}
          <div className="text-center mb-5">
            <span className="text-3xl md:text-4xl font-black text-gray-900">
              {adCostManWon}만원
            </span>
            <span className="text-base text-gray-600 ml-1">/월</span>
          </div>

          {/* 슬라이더 */}
          <input
            type="range"
            min={10000}
            max={2000000}
            step={10000}
            value={adCost}
            onChange={(e) => setAdCost(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-600"
            aria-label="월 광고비 슬라이더"
          />

          {/* 최소/최대 레이블 */}
          <div className="flex justify-between text-sm text-gray-600 mt-1.5">
            <span>1만원</span>
            <span>200만원</span>
          </div>
        </div>

        {/* 비교 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 현재 광고비 */}
          <div className="bg-red-50 border border-red-100 rounded-xl p-5">
            <p className="text-sm font-semibold text-red-700 mb-1">현재 월 광고비</p>
            <p className="text-2xl md:text-3xl font-black text-red-700">{formatWon(adCost)}</p>
            <p className="text-sm text-red-700 mt-1">광고를 멈추면 광고 노출도 멈춥니다</p>
          </div>

          {/* AEOlab 구독료 */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
            <p className="text-sm font-semibold text-blue-600 mb-1">AEOlab 구독료</p>
            <p className="text-2xl md:text-3xl font-black text-blue-700">{formatWon(AEOLAB_MONTHLY)}</p>
            <p className="text-sm text-blue-600 mt-1">
              광고비의{" "}
              <span className="font-bold">
                {((AEOLAB_MONTHLY / adCost) * 100).toFixed(1)}%
              </span>
            </p>
          </div>
        </div>

        {/* 연간 비교 (절감 약속 아님 — 단순 금액 비교) */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 md:p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingDown className="w-5 h-5 text-emerald-700" />
            <h2 className="text-base font-bold text-gray-900">1년 금액 비교</h2>
          </div>
          <div className="space-y-3 text-sm text-gray-700">
            <div className="flex items-center justify-between gap-4">
              <span>광고비 {formatWon(adCost)} × 12개월</span>
              <span className="font-bold text-gray-900 shrink-0">{formatWon(adCost12mo)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>AEOlab Basic {formatWon(AEOLAB_MONTHLY)} × 12개월</span>
              <span className="font-bold text-gray-900 shrink-0">{formatWon(aeolab12mo)}</span>
            </div>
          </div>
          <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-3">
            <p className="text-sm text-amber-700 break-keep">
              <span className="font-semibold">안내:</span> 단순 금액 비교입니다. AEOlab은 광고를 대체하거나 광고비 절감을 보장하지 않으며, AI 검색에 나올 준비 상태를 점검하고 고칠 순서를 알려드립니다. 첫 달은 8,950원입니다.
            </p>
          </div>
        </div>

        {/* 면책 문구 */}
        <p className="text-sm text-gray-600 text-center leading-relaxed break-keep">
          광고 효과와 AI 검색 노출은 업종·지역·경쟁 강도에 따라 다릅니다.
          내 가게 상태는 무료 진단으로 먼저 확인하세요.
        </p>

        {/* CTA */}
        <div className="text-center py-6 bg-white rounded-xl border border-gray-100 shadow-sm">
          <p className="text-base font-bold text-gray-900 mb-1">
            실제 내 사업장의 AI 노출 현황이 궁금하다면?
          </p>
          <p className="text-sm text-gray-600 mb-4">회원가입 없이 무료 진단</p>
          <Link
            href="/trial"
            className="inline-block px-7 py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors"
          >
            무료 체험 시작 →
          </Link>
        </div>

        {/* 다른 도구 링크 */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">다른 무료 도구</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/tools/keyword"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium underline"
            >
              무료 키워드 생성기
            </Link>
            <span className="text-gray-300">|</span>
            <Link
              href="/trial"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium underline"
            >
              무료 AI 노출 진단
            </Link>
          </div>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
