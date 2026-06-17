"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, TrendingDown, Calculator } from "lucide-react";
import { PLAN_PRICES } from "@/lib/plans";
import { SiteFooter } from "@/components/common/SiteFooter";

const AEOLAB_MONTHLY = PLAN_PRICES.basic;
const AI_REPLACE_RATIO = 0.3; // 광고비의 30%를 AI 노출로 대체 가정

export default function AdCostCalculatorPage() {
  const [adCost, setAdCost] = useState(300000); // 기본 30만원

  const adCostManWon = Math.round(adCost / 10000);
  const aeolab6mo = AEOLAB_MONTHLY * 6;
  const aeolab12mo = AEOLAB_MONTHLY * 12;

  // 6개월 절감 = 광고비 * 30% * 6개월 - AEOlab 6개월 구독료
  const saving6mo = Math.round(adCost * AI_REPLACE_RATIO * 6 - aeolab6mo);
  // 1년 절감
  const saving12mo = Math.round(adCost * AI_REPLACE_RATIO * 12 - aeolab12mo);

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
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            홈으로
          </Link>
          <div className="flex items-center gap-2 mb-2">
            <Calculator className="w-6 h-6 text-blue-500" />
            <h1 className="text-2xl md:text-3xl font-black text-gray-900">광고비 절감 계산기</h1>
          </div>
          <p className="text-sm md:text-base text-gray-500">
            AI 검색 노출로 광고비를 절감하면?
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
            <span className="text-base text-gray-400 ml-1">/월</span>
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
          <div className="flex justify-between text-sm text-gray-400 mt-1.5">
            <span>1만원</span>
            <span>200만원</span>
          </div>
        </div>

        {/* 비교 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 현재 광고비 */}
          <div className="bg-red-50 border border-red-100 rounded-xl p-5">
            <p className="text-sm font-semibold text-red-600 mb-1">현재 월 광고비</p>
            <p className="text-2xl md:text-3xl font-black text-red-700">{formatWon(adCost)}</p>
            <p className="text-sm text-red-500 mt-1">광고 끄면 노출 0</p>
          </div>

          {/* AEOlab 구독료 */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
            <p className="text-sm font-semibold text-blue-600 mb-1">AEOlab 구독료</p>
            <p className="text-2xl md:text-3xl font-black text-blue-700">{formatWon(AEOLAB_MONTHLY)}</p>
            <p className="text-sm text-blue-500 mt-1">
              광고비의{" "}
              <span className="font-bold">
                {((AEOLAB_MONTHLY / adCost) * 100).toFixed(1)}%
              </span>
            </p>
          </div>
        </div>

        {/* 절감 예상 카드 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 md:p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingDown className="w-5 h-5 text-emerald-500" />
            <h2 className="text-base font-bold text-gray-900">절감 예상 금액</h2>
          </div>

          <div className="space-y-4">
            {/* 6개월 */}
            <div className="flex items-center justify-between gap-4 py-4 border-b border-gray-50">
              <div>
                <p className="text-sm font-semibold text-gray-700">6개월 절감 예상</p>
                <p className="text-sm text-gray-400 mt-0.5">
                  광고비 {formatWon(adCost)} × 30% × 6개월 − AEOlab {formatWon(aeolab6mo)}
                </p>
              </div>
              <span className={`text-xl font-black shrink-0 ${saving6mo > 0 ? "text-emerald-600" : "text-gray-400"}`}>
                {saving6mo > 0 ? `+${formatWon(saving6mo)}` : "효과 미미"}
              </span>
            </div>

            {/* 1년 */}
            <div className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="text-sm font-semibold text-gray-700">1년 절감 예상</p>
                <p className="text-sm text-gray-400 mt-0.5">
                  광고비 {formatWon(adCost)} × 30% × 12개월 − AEOlab {formatWon(aeolab12mo)}
                </p>
              </div>
              <span className={`text-xl font-black shrink-0 ${saving12mo > 0 ? "text-emerald-600" : "text-gray-400"}`}>
                {saving12mo > 0 ? `+${formatWon(saving12mo)}` : "효과 미미"}
              </span>
            </div>
          </div>

          {/* 가정 표시 */}
          <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-3">
            <p className="text-sm text-amber-700">
              <span className="font-semibold">계산 기준:</span> 현재 광고비의 30%를 AI 노출로 대체할 수 있다고 가정합니다.
            </p>
          </div>
        </div>

        {/* 면책 문구 */}
        <p className="text-sm text-gray-400 text-center leading-relaxed">
          절감 효과는 업종·지역·경쟁 강도에 따라 다릅니다.
          실제 효과는 AEOlab 스캔 후 확인하세요.
        </p>

        {/* CTA */}
        <div className="text-center py-6 bg-white rounded-xl border border-gray-100 shadow-sm">
          <p className="text-base font-bold text-gray-900 mb-1">
            실제 내 사업장의 AI 노출 현황이 궁금하다면?
          </p>
          <p className="text-sm text-gray-500 mb-4">회원가입 없이 1분 무료 진단</p>
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
