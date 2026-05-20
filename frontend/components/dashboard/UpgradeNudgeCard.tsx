"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, ArrowRight } from "lucide-react";
import { FIRST_MONTH_DISCOUNT_PRICES } from "@/lib/plans";

interface Props {
  plan: string;
  hasLatestScan: boolean;
}

export default function UpgradeNudgeCard({ plan, hasLatestScan }: Props) {
  const [dismissed, setDismissed] = useState(true); // SSR-safe: start hidden

  useEffect(() => {
    try {
      const dismissedAt = localStorage.getItem("upgrade_nudge_dismissed_at");
      if (dismissedAt) {
        const d = new Date(dismissedAt);
        const today = new Date();
        if (d.toDateString() === today.toDateString()) return; // 오늘 이미 닫음
      }
      setDismissed(false);
    } catch {
      setDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.setItem("upgrade_nudge_dismissed_at", new Date().toISOString());
    } catch {}
    setDismissed(true);
  };

  if (plan !== "free" || !hasLatestScan || dismissed) return null;

  const discountPrice = (FIRST_MONTH_DISCOUNT_PRICES.basic ?? 4950).toLocaleString();

  return (
    <div className="relative rounded-xl bg-amber-50 border border-amber-200 p-4">
      <button
        onClick={handleDismiss}
        aria-label="업그레이드 안내 닫기"
        className="absolute top-3 right-3 text-amber-400 hover:text-amber-600 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
          현재 무료 플랜
        </span>
      </div>

      <p className="text-sm font-semibold text-gray-800 mb-3">
        Basic 플랜에서는 이렇게 달라집니다
      </p>

      <ul className="text-sm text-gray-700 space-y-1.5 mb-4">
        <li className="flex items-start gap-2">
          <span className="text-amber-500 font-bold shrink-0">→</span>
          <span>
            <span className="line-through text-gray-400">수동 스캔 0회/일</span>
            {" → "}
            <span className="font-medium text-emerald-700">2회/일</span>
            <span className="text-gray-500 text-sm ml-1">(스캔 버튼 비활성화 이유)</span>
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-amber-500 font-bold shrink-0">→</span>
          <span>
            <span className="line-through text-gray-400">경쟁사 분석 잠금</span>
            {" → "}
            <span className="font-medium text-emerald-700">최대 3곳 비교</span>
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-amber-500 font-bold shrink-0">→</span>
          <span>
            <span className="line-through text-gray-400">AI 개선 가이드 잠금</span>
            {" → "}
            <span className="font-medium text-emerald-700">월 3회 맞춤 가이드</span>
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-amber-500 font-bold shrink-0">→</span>
          <span>
            <span className="line-through text-gray-400">키워드 순위 추적 잠금</span>
            {" → "}
            <span className="font-medium text-emerald-700">주 1회 자동 측정</span>
          </span>
        </li>
      </ul>

      <Link
        href="/pricing?from=dashboard_nudge"
        className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
      >
        Basic 시작하기 — 첫 달 {discountPrice}원
        <ArrowRight className="w-4 h-4" />
      </Link>
      <p className="text-sm text-gray-500 mt-2">첫 달 50% 할인 · 언제든 해지 가능</p>
    </div>
  );
}
