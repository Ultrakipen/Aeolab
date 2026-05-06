"use client";

import { useEffect, useState } from "react";
import { trackPlanRecommend, trackEvent } from "@/lib/analytics";
import { PayButton } from "./PayButton";
import Link from "next/link";
import { getSafeSession } from "@/lib/supabase/client";

interface Option {
  value: string;
  label: string;
  recommend: string;
  planKey: string;
  amount: number;
  firstMonthAmount?: number;
}

const OPTIONS: Option[] = [
  {
    value: "basic",
    label: "가게 1개를 운영하고 있어요 (음식점·카페·법무·의료·교육 등 모든 업종)",
    recommend: "Basic",
    planKey: "basic",
    amount: 9900,
    firstMonthAmount: 4950,
  },
  {
    value: "pro",
    label: "경쟁사 변화를 매일 빠르게 알고 싶어요",
    recommend: "Pro",
    planKey: "pro",
    amount: 18900,
  },
  {
    value: "biz",
    label: "가게가 2개 이상이거나 대행사예요",
    recommend: "Biz",
    planKey: "biz",
    amount: 49900,
  },
  {
    value: "startup",
    label: "아직 창업 전이에요",
    recommend: "창업 패키지",
    planKey: "startup",
    amount: 12900,
  },
  {
    value: "global",
    label: "네이버보다 ChatGPT·Gemini 노출이 더 중요해요",
    recommend: "Basic",
    planKey: "basic",
    amount: 9900,
    firstMonthAmount: 4950,
  },
];

export default function PlanRecommender() {
  const [picked, setPicked] = useState<string>("");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    getSafeSession().then((s) => setIsLoggedIn(!!s?.user));
  }, []);

  const selectedOption = OPTIONS.find((o) => o.value === picked) ?? null;

  const handleSelect = (opt: Option) => {
    setPicked(opt.value);
    trackPlanRecommend(opt.recommend);
    const id = `plan-${opt.recommend.replace(/\s+/g, "-")}`;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleCtaClick = (planKey: string) => {
    trackEvent("plan_recommender_cta_click", { plan: planKey });
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 md:p-6 mb-8">
      <p className="text-base md:text-lg font-bold text-blue-900 mb-2">
        나한테 맞는 플랜 찾기 (15초)
      </p>
      <p className="text-sm md:text-base text-blue-700 mb-4">Q. 지금 내 상황은?</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3 mb-3">
        {OPTIONS.map((opt) => {
          const active = picked === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt)}
              className={`flex items-center justify-between gap-3 rounded-xl px-3 md:px-4 py-3 text-left border transition-all ${
                active
                  ? "bg-blue-600 text-white border-blue-700 shadow-md"
                  : "bg-white text-gray-800 border-gray-200 hover:border-blue-400"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                    active ? "border-white bg-white" : "border-gray-300"
                  }`}
                >
                  {active && <span className="w-2 h-2 rounded-full bg-blue-600" />}
                </span>
                <span className="text-sm md:text-base font-medium break-keep">{opt.label}</span>
              </div>
              <span
                className={`text-sm font-bold shrink-0 ${
                  active ? "text-blue-100" : "text-blue-600"
                }`}
              >
                → {opt.recommend}
              </span>
            </button>
          );
        })}
      </div>

      {/* 추천 결과 + 바로 결제 CTA */}
      {selectedOption && (
        <div className="mt-4 bg-white rounded-xl border border-blue-200 p-4 md:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-3">
            <div>
              <p className="text-base font-bold text-gray-900">
                추천 플랜: {selectedOption.recommend}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                월 {selectedOption.amount.toLocaleString()}원
                {selectedOption.firstMonthAmount && (
                  <span className="ml-2 text-emerald-600 font-semibold">
                    (첫 달 {selectedOption.firstMonthAmount.toLocaleString()}원 · 50% 할인)
                  </span>
                )}
              </p>
            </div>
            <p className="text-sm text-blue-700 font-medium hidden sm:block">
              지금 바로 시작할 수 있습니다
            </p>
          </div>

          {picked === "global" && (
            <p className="text-sm text-blue-700 mt-2 mb-3 leading-relaxed">
              Basic 플랜은 ChatGPT·Gemini·Google AI 노출을 주 1회 자동 측정합니다.
              네이버 AI 탭(2026 베타 공개) 연동 데이터도 포함됩니다.
            </p>
          )}

          <div onClick={() => handleCtaClick(selectedOption.planKey)}>
            {/* Biz는 문의 전용 (isPay: false) */}
            {selectedOption.planKey === "biz" ? (
              <a
                href="mailto:hello@aeolab.co.kr"
                className="block text-center w-full py-3 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm md:text-base"
              >
                도입 문의하기 →
              </a>
            ) : isLoggedIn ? (
              /* 로그인 상태 → PayButton 직접 사용 */
              <PayButton
                planName={selectedOption.recommend}
                amount={selectedOption.amount}
                highlight={true}
                signupHref="/signup"
                firstMonthAmount={selectedOption.firstMonthAmount}
              />
            ) : (
              /* 비로그인 → signup?plan= 으로 이동 */
              <Link
                href={`/signup?plan=${selectedOption.planKey}`}
                className="block text-center w-full py-3 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm md:text-base"
              >
                {selectedOption.planKey === "basic"
                  ? "1분 가입 후 첫 달 4,950원으로 시작 →"
                  : "1분 가입 후 바로 시작 →"}
              </Link>
            )}
          </div>

          <p className="text-sm text-gray-400 text-center mt-2">
            언제든지 설정에서 해지 가능 · 카드 자동결제
          </p>
        </div>
      )}

      {!picked && (
        <p className="text-sm md:text-base text-blue-800 bg-white/60 rounded-xl px-3 py-2 border border-blue-100">
          위에서 내 상황을 선택하면 맞춤 플랜과 결제 버튼이 나타납니다
        </p>
      )}
    </div>
  );
}
