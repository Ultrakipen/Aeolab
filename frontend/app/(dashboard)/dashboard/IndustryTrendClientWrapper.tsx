"use client";

import { useState, useEffect } from "react";
import { IndustryTrendCard } from "@/components/dashboard/IndustryTrendCard";
import { getIndustryTrend } from "@/lib/api";
import type { IndustryTrend } from "@/types";

interface Props {
  category: string;        // 한국어 표시용 (예: "음식점")
  categoryCode: string;    // API 호출용 (예: "restaurant")
  region?: string;
}

export function IndustryTrendClientWrapper({ category, categoryCode, region }: Props) {
  const [trend, setTrend] = useState<IndustryTrend | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, [categoryCode, region]);

  return (
    <IndustryTrendCard
      trend={trend}
      category={category}
      isLoading={loading}
    />
  );
}
