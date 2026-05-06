"use client";

import { useEffect, useState } from "react";
import { Lock, AlertCircle, BarChart2 } from "lucide-react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { getSafeSession } from "@/lib/supabase/client";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface ReviewDist {
  data_unavailable?: boolean;
  reason?: string;
  my_distribution?: Record<string, number>;
  competitor_avg?: Record<string, number>;
  categories?: string[];
}

interface GapResponse {
  review_keyword_distribution?: ReviewDist;
  [key: string]: unknown;
}

interface ChartRow {
  name: string;
  my: number;
  competitor: number;
}

interface Props {
  bizId: string;
  plan: string;
}

const PLAN_BASIC_PLUS = ["basic", "startup", "pro", "biz", "enterprise"];

export default function ReviewKeywordGapCard({ bizId, plan }: Props) {
  const isFree = !PLAN_BASIC_PLUS.includes(plan);

  const [dist, setDist] = useState<ReviewDist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!bizId || isFree) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const session = await getSafeSession();
        const token = session?.access_token;
        if (!token) {
          if (!cancelled) { setLoading(false); setError(true); }
          return;
        }

        const res = await fetch(
          `${BACKEND}/api/report/gap/${bizId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (cancelled) return;

        if (!res.ok) {
          setError(true);
          setLoading(false);
          return;
        }

        const json: GapResponse = await res.json();
        if (cancelled) return;

        setDist(json.review_keyword_distribution ?? null);
        setLoading(false);
      } catch {
        if (!cancelled) { setError(true); setLoading(false); }
      }
    })();

    return () => { cancelled = true; };
  }, [bizId, isFree]);

  // 차트 데이터 변환
  const chartData: ChartRow[] = (() => {
    if (!dist || dist.data_unavailable) return [];
    const categories = dist.categories ??
      Object.keys(dist.my_distribution ?? {});
    return categories.map((cat) => ({
      name: cat,
      my: dist.my_distribution?.[cat] ?? 0,
      competitor: dist.competitor_avg?.[cat] ?? 0,
    }));
  })();

  const dataUnavailable = !dist || dist.data_unavailable;

  return (
    <section
      aria-labelledby="review-keyword-gap-title"
      className="mb-4 md:mb-6 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden"
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 md:w-5 md:h-5 text-indigo-500 shrink-0" />
          <h2
            id="review-keyword-gap-title"
            className="text-base md:text-lg font-bold text-gray-900 break-keep"
          >
            리뷰 키워드 분포 — 경쟁사 비교
          </h2>
        </div>
        {isFree && (
          <div className="flex items-center gap-1 text-sm text-gray-500 shrink-0">
            <Lock className="w-4 h-4" />
            <span className="hidden sm:inline">Basic 이상</span>
          </div>
        )}
      </div>

      {/* 본문 */}
      <div className="p-4 md:p-6">

        {/* Free 플랜: 잠금 오버레이 */}
        {isFree && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <Lock className="w-6 h-6 text-gray-400" />
            </div>
            <div>
              <p className="text-base font-semibold text-gray-800 mb-1">
                리뷰 키워드 분포 비교
              </p>
              <p className="text-sm text-gray-500 max-w-xs mx-auto leading-relaxed break-keep">
                내 가게 리뷰에 어떤 키워드가 많은지 경쟁사와 비교합니다. 부족한 키워드를 파악해 소개글에 반영하세요.
              </p>
            </div>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm md:text-base font-bold px-5 py-2.5 transition-colors"
            >
              Basic 이상에서 확인 가능 →
            </Link>
          </div>
        )}

        {/* 로딩 스켈레톤 */}
        {!isFree && loading && (
          <div className="space-y-3 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3" />
            <div className="h-48 md:h-56 bg-gray-100 rounded-xl" />
          </div>
        )}

        {/* 에러 */}
        {!isFree && !loading && error && (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
            <AlertCircle className="w-4 h-4 text-gray-400 shrink-0" />
            데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
          </div>
        )}

        {/* 데이터 없음 */}
        {!isFree && !loading && !error && dataUnavailable && (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
            <BarChart2 className="w-8 h-8 text-gray-300" />
            <p className="text-sm text-gray-500 break-keep max-w-xs mx-auto leading-relaxed">
              스캔 후 데이터가 충분히 쌓이면 표시됩니다
            </p>
            {dist?.reason && (
              <p className="text-xs text-gray-400">{dist.reason}</p>
            )}
          </div>
        )}

        {/* 차트 */}
        {!isFree && !loading && !error && !dataUnavailable && chartData.length > 0 && (
          <>
            <div className="h-48 md:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                >
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={88}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value: unknown, name: unknown) => [
                      `${value ?? 0}건`,
                      name === "my" ? "내 가게" : "경쟁사 평균",
                    ]}
                    contentStyle={{ fontSize: 13 }}
                  />
                  <Legend
                    formatter={(value: string) =>
                      value === "my" ? "내 가게" : "경쟁사 평균"
                    }
                    wrapperStyle={{ fontSize: 13 }}
                  />
                  <Bar dataKey="my" name="my" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="competitor" name="competitor" fill="#9ca3af" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <p className="mt-3 text-xs text-gray-400 leading-snug">
              측정 시점·기기·로그인 상태에 따라 달라질 수 있음. 리뷰 키워드 분류는 AI 분석 기반 추정치입니다.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
