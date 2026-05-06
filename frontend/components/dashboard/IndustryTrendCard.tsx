"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { IndustryTrend } from "@/types";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props {
  trend: IndustryTrend | null;
  category: string;
  isLoading?: boolean;
}

// "2026-01" → "1월" 변환
function formatPeriod(period: string): string {
  const parts = period.split("-");
  if (parts.length >= 2) {
    return `${parseInt(parts[1], 10)}월`;
  }
  return period;
}

const DIRECTION_CONFIG = {
  rising: {
    label: "상승",
    icon: TrendingUp,
    badgeCls: "bg-green-100 text-green-700 border-green-200",
    iconCls: "text-green-600",
  },
  falling: {
    label: "하락",
    icon: TrendingDown,
    badgeCls: "bg-red-100 text-red-600 border-red-200",
    iconCls: "text-red-500",
  },
  stable: {
    label: "유지",
    icon: Minus,
    badgeCls: "bg-gray-100 text-gray-600 border-gray-200",
    iconCls: "text-gray-500",
  },
};

function Skeleton() {
  return (
    <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 bg-gray-200 rounded w-28" />
        <div className="h-6 bg-gray-200 rounded-full w-16" />
      </div>
      <div className="h-36 bg-gray-100 rounded-xl mb-3" />
      <div className="h-4 bg-gray-200 rounded w-48" />
    </div>
  );
}

export function IndustryTrendCard({ trend, category, isLoading = false }: Props) {
  if (isLoading) return <Skeleton />;
  if (!trend) return null;

  const config = DIRECTION_CONFIG[trend.trend_direction] ?? DIRECTION_CONFIG.stable;
  const DirectionIcon = config.icon;

  const chartData = trend.trend_data.map((d) => ({
    period: formatPeriod(d.period),
    ratio: d.ratio,
  }));

  const deltaSign = trend.trend_delta >= 0 ? "+" : "";
  const deltaColor =
    trend.trend_direction === "rising"
      ? "text-green-600"
      : trend.trend_direction === "falling"
      ? "text-red-500"
      : "text-gray-600";

  return (
    <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <DirectionIcon className={`w-4 h-4 ${config.iconCls}`} />
          <span className="text-sm md:text-base font-semibold text-gray-800">
            업종 트렌드
          </span>
        </div>
        <span
          className={`flex items-center gap-1 text-sm font-semibold px-2.5 py-0.5 rounded-full border ${config.badgeCls}`}
        >
          <DirectionIcon className="w-3.5 h-3.5" />
          {config.label}
        </span>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        최근 3개월 <strong className="text-gray-700">{category}</strong> 검색 트렌드:{" "}
        <span className={`font-semibold ${deltaColor}`}>
          {deltaSign}{trend.trend_delta.toFixed(1)}pt {config.label} 중
        </span>
      </p>

      {/* Recharts LineChart */}
      {chartData.length > 0 ? (
        <div className="h-36 md:h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="period"
                tick={{ fontSize: 12, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 12, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip
                formatter={(value) => [`${value}`, "상대 지수"]}
                labelStyle={{ color: "#374151", fontWeight: 600 }}
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid #e5e7eb",
                  fontSize: "13px",
                }}
              />
              <Line
                type="monotone"
                dataKey="ratio"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 4, fill: "#3b82f6", strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-36 flex items-center justify-center text-sm text-gray-400 bg-gray-50 rounded-xl">
          트렌드 데이터 없음
        </div>
      )}

      {/* 주의 문구 */}
      <p className="text-sm text-gray-400 mt-3">
        * 네이버 상대 지수 기준 (절대 검색량 아님). 100 = 최고 검색 시점.
      </p>
    </div>
  );
}
