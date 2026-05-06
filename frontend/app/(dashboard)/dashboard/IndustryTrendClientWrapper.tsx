"use client";

import { useState, useEffect } from "react";
import { Lock, TrendingUp } from "lucide-react";
import { IndustryTrendCard } from "@/components/dashboard/IndustryTrendCard";
import { getIndustryTrend } from "@/lib/api";
import type { IndustryTrend } from "@/types";

interface Props {
  category: string;        // 한국어 표시용 (예: "음식점")
  categoryCode: string;    // API 호출용 (예: "restaurant")
  region?: string;
  isPro?: boolean;
}

export function IndustryTrendClientWrapper({ category, categoryCode, region, isPro = false }: Props) {
  const [trend, setTrend] = useState<IndustryTrend | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isPro) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const fetchTrend = async () => {
      setLoading(true);
      try {
        const data = await getIndustryTrend(categoryCode, region);
        if (!cancelled) setTrend(data);
      } catch {
        // silent — IndustryTrendCard null 처리
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchTrend();
    return () => { cancelled = true; };
  }, [categoryCode, region, isPro]);

  if (!isPro) {
    return (
      <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-5 h-5 text-gray-400" />
          <h2 className="text-base font-bold text-gray-700">{category} AI 검색 트렌드</h2>
          <span className="ml-auto text-sm bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">Pro</span>
        </div>
        <div className="relative">
          {/* 샘플 미리보기 — 흐릿하게 */}
          <div className="blur-sm pointer-events-none select-none">
            <div className="flex items-end gap-1 h-20 mb-2">
              {[40, 55, 48, 62, 70, 65, 78].map((h, i) => (
                <div key={i} className="flex-1 bg-blue-200 rounded-t" style={{ height: `${h}%` }} />
              ))}
            </div>
            <div className="flex justify-between text-sm text-gray-300">
              <span>10월</span><span>11월</span><span>12월</span><span>1월</span><span>2월</span><span>3월</span><span>4월</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div className="bg-gray-50 rounded-lg p-2"><div className="text-sm text-gray-300">업종 평균</div><div className="font-bold text-gray-300">43점</div></div>
              <div className="bg-blue-50 rounded-lg p-2"><div className="text-sm text-blue-300">내 점수</div><div className="font-bold text-blue-300">51점</div></div>
              <div className="bg-gray-50 rounded-lg p-2"><div className="text-sm text-gray-300">상위 10%</div><div className="font-bold text-gray-300">78점</div></div>
            </div>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 rounded-xl">
            <Lock className="w-6 h-6 text-gray-400 mb-2" />
            <p className="text-sm font-semibold text-gray-700 text-center px-4">이 업종·지역 AI 검색 트렌드와<br/>경쟁사 평균 대비 내 위치를 확인합니다.</p>
            <a href="/pricing" className="mt-3 text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-4 py-1.5 rounded-full transition-colors">Pro로 업그레이드 →</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <IndustryTrendCard
      trend={trend}
      category={category}
      isLoading={loading}
    />
  );
}
