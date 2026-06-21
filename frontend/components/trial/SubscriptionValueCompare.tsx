"use client";

import Link from "next/link";
import { PLAN_PRICES, FIRST_MONTH_DISCOUNT_PRICES } from "@/lib/plans";
import { Check, X, Lightbulb } from "lucide-react";

interface SubscriptionValueCompareProps {
  isLoggedIn: boolean;
  onSave: () => void;
}

export default function SubscriptionValueCompare({ isLoggedIn, onSave }: SubscriptionValueCompareProps) {
  const trialFeatures = [
    { label: "지금 이 순간 네이버 검색 순위 확인" },
    { label: "ChatGPT가 내 가게를 아는지 확인" },
    { label: "스마트플레이스 부족 항목 체크" },
    { label: "다음 주 변화는 알 수 없음", locked: true },
    { label: "경쟁사와 순위 비교 불가", locked: true },
    { label: "개선 효과 추적 불가", locked: true },
  ];

  const subscriptionFeatures = [
    { label: "매주 네이버 순위 변화 자동 추적" },
    { label: "순위가 오르면 카톡으로 바로 알림" },
    { label: "경쟁사 3곳과 매주 비교" },
    { label: "이번 주 해야 할 1가지 개선 가이드" },
    { label: "30일 추세로 개선 효과 직접 확인" },
    { label: "소개글 Q&A 5개 자동 생성 + 1번에 복사" },
  ];

  return (
    <section className="bg-slate-50 border border-slate-200 rounded-xl p-4 md:p-6 mb-4 shadow-sm">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="w-6 h-6 text-amber-400 shrink-0" />
        <p className="text-base md:text-lg font-bold text-gray-800">이번 결과를 다음 주에도 받고 싶다면</p>
      </div>
      <p className="text-sm text-slate-500 mb-4 leading-relaxed break-keep">
        지금 스캔 결과는 오늘의 사진입니다. 개선했을 때 순위가 실제로 올랐는지, 경쟁 가게가 앞서가고 있는지 — 매주 확인하지 않으면 알 수 없습니다.
      </p>

      {/* 좌우 비교 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-5">
        {/* 좌측 — 체험은 1회 */}
        <div className="bg-white rounded-xl border-2 border-red-200 p-4 md:p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="text-base md:text-lg font-bold text-gray-700">지금 받은 결과</p>
            <span className="text-sm font-bold text-red-700 bg-red-100 border border-red-200 px-2.5 py-1 rounded-full">
              체험 = 1회
            </span>
          </div>
          <ul className="space-y-2">
            {trialFeatures.map((f) => (
              <li
                key={f.label}
                className={`flex items-start gap-2 text-sm leading-relaxed break-keep ${
                  f.locked ? "text-gray-400" : "text-gray-700"
                }`}
              >
                {f.locked
                  ? <X className="w-4 h-4 text-red-300 shrink-0 mt-0.5" />
                  : <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                }
                <span>{f.label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 우측 — 구독은 매주 */}
        <div className="bg-white rounded-xl border-2 border-emerald-300 p-4 md:p-5 shadow-md relative">
          <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-sm font-bold px-2.5 py-1 rounded-full shadow-md">
            추천
          </div>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="text-base md:text-lg font-bold text-gray-900">구독하면 매주</p>
            <span className="text-sm font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-full">
              자동 추적
            </span>
          </div>
          <ul className="space-y-2">
            {subscriptionFeatures.map((f) => (
              <li
                key={f.label}
                className="flex items-start gap-2 text-sm leading-relaxed break-keep text-gray-800"
              >
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{f.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 하단 큰 CTA */}
      {!isLoggedIn ? (
        <Link
          href="/signup"
          onClick={onSave}
          className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center font-black text-lg md:text-xl py-4 md:py-5 rounded-2xl transition-colors shadow-lg"
        >
          매주 자동 추적 시작 — 첫 달 <span className="text-emerald-300">{FIRST_MONTH_DISCOUNT_PRICES.basic.toLocaleString()}원</span>
          <span className="block text-sm font-medium text-blue-200 mt-1">
            이후 월 {PLAN_PRICES.basic.toLocaleString()}원 · 언제든 해지 가능
          </span>
        </Link>
      ) : (
        <Link
          href="/dashboard"
          className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center font-black text-lg md:text-xl py-4 md:py-5 rounded-2xl transition-colors shadow-lg"
        >
          내 대시보드로 이동
        </Link>
      )}
    </section>
  );
}
