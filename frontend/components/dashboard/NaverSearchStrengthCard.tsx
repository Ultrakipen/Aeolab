"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Lock, TrendingUp, TrendingDown, Minus, BarChart2 } from "lucide-react";
import Link from "next/link";
import { authFetch } from "@/lib/api";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface KeywordRankPoint {
  date: string;
  keyword_rank_avg: number;
}

interface BlogTrendPoint {
  date: string;
  post_count: number;
  keyword_coverage: number | null;
}

interface NaverSeoStrengthData {
  biz_id: string;
  keyword_rank_trend: KeywordRankPoint[];
  blog_trend: BlogTrendPoint[];
  has_data: boolean;
}

interface Props {
  businessId: string;
  token: string | null;
}

/** 순위 밴딩: 낮은 숫자 = 높은 순위 (1위가 최고) */
function getRankBand(avgRank: number): { label: string; colorClass: string } {
  if (avgRank <= 3)  return { label: "상위권", colorClass: "text-emerald-700" };
  if (avgRank <= 10) return { label: "중위권", colorClass: "text-amber-700" };
  return                     { label: "하위권", colorClass: "text-red-700" };
}

/** 순위 추이: 숫자가 줄어들수록 순위 상승 (좋아짐) */
function getKeywordRankTrend(trend: KeywordRankPoint[]): "up" | "down" | "stable" {
  if (trend.length < 2) return "stable";
  const latest = trend[trend.length - 1].keyword_rank_avg;
  const prev   = trend[trend.length - 2].keyword_rank_avg;
  if (latest < prev - 0.5) return "up";
  if (latest > prev + 0.5) return "down";
  return "stable";
}

/** 블로그 발행 추이 */
function getBlogTrend(trend: BlogTrendPoint[]): "up" | "down" | "stable" {
  if (trend.length < 2) return "stable";
  const last = trend[trend.length - 1].post_count;
  const prev = trend[trend.length - 2].post_count;
  if (last > prev) return "up";
  if (last < prev) return "down";
  return "stable";
}

function TrendIcon({ direction }: { direction: "up" | "down" | "stable" }) {
  if (direction === "up")   return <TrendingUp   className="w-4 h-4 text-emerald-700 shrink-0" aria-label="상승" />;
  if (direction === "down") return <TrendingDown className="w-4 h-4 text-red-700 shrink-0"     aria-label="하락" />;
  return                           <Minus        className="w-4 h-4 text-gray-600 shrink-0"    aria-label="유지" />;
}

function TrendLabel({ direction }: { direction: "up" | "down" | "stable" }) {
  if (direction === "up")   return <span className="text-sm text-emerald-700 font-medium">상승 중</span>;
  if (direction === "down") return <span className="text-sm text-red-700 font-medium">하락 중</span>;
  return                           <span className="text-sm text-gray-600">유지</span>;
}

export default function NaverSearchStrengthCard({ businessId, token }: Props) {
  const [data,       setData]       = useState<NaverSeoStrengthData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [planLocked, setPlanLocked] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    if (!businessId || !token) {
      setLoading(false);
      if (!token) setFetchError(true);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        let res: Response;
        try {
          res = await authFetch(
            `${BACKEND}/api/report/naver-seo-strength/${businessId}`,
            token,
          );
        } catch {
          // SESSION_EXPIRED → authFetch가 /login 리다이렉트
          return;
        }

        if (cancelled) return;

        if (res.status === 403) {
          const json = await res.json().catch(() => ({})) as { detail?: { code?: string }; code?: string };
          const code = json?.detail?.code ?? json?.code ?? "";
          if (code === "PLAN_REQUIRED") {
            setPlanLocked(true);
          } else {
            setFetchError(true);
          }
          setLoading(false);
          return;
        }

        if (!res.ok) {
          setFetchError(true);
          setLoading(false);
          return;
        }

        const json = await res.json() as NaverSeoStrengthData;
        if (cancelled) return;
        setData(json);
        setLoading(false);
      } catch {
        if (!cancelled) { setFetchError(true); setLoading(false); }
      }
    })();

    return () => { cancelled = true; };
  }, [businessId, token]);

  // 파생 값 계산
  const rankTrend = data?.keyword_rank_trend ? getKeywordRankTrend(data.keyword_rank_trend) : "stable";
  const latestRank = data?.keyword_rank_trend?.length
    ? data.keyword_rank_trend[data.keyword_rank_trend.length - 1]
    : null;
  const rankBand = latestRank ? getRankBand(latestRank.keyword_rank_avg) : null;

  const blogTrend = data?.blog_trend ? getBlogTrend(data.blog_trend) : "stable";
  const latestBlog = data?.blog_trend?.length
    ? data.blog_trend[data.blog_trend.length - 1]
    : null;

  // 키워드/블로그 시계열 데이터가 하나라도 있어야 이 카드를 보여준다
  // (smart_place 요약은 NaverSeoBaseCard가 이미 실시간으로 보여주므로 여기선 제외)
  const hasTrendData = (data?.keyword_rank_trend?.length ?? 0) > 0 || (data?.blog_trend?.length ?? 0) > 0;

  return (
    <section
      aria-labelledby="naver-seo-strength-title"
      className="mb-4 md:mb-6 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 shrink-0 text-gray-700" aria-hidden="true" />
          <h2
            id="naver-seo-strength-title"
            className="text-base md:text-lg font-bold text-gray-900 break-keep"
          >
            네이버 검색·블로그 발행 30일 추이
          </h2>
        </div>
        {planLocked && (
          <div className="flex items-center gap-1 text-sm text-gray-600 shrink-0">
            <Lock className="w-4 h-4" />
            <span className="hidden sm:inline">Basic 이상</span>
          </div>
        )}
      </div>

      {/* 본문 */}
      <div className="p-4 md:p-6">

        {/* 플랜 잠금 */}
        {planLocked && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <Lock className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <p className="text-base font-semibold text-gray-800 mb-1">
                네이버 검색·블로그 발행 30일 추이
              </p>
              <p className="text-sm text-gray-600 max-w-xs mx-auto leading-relaxed break-keep">
                키워드 순위와 블로그 발행 추이를 30일 단위로 확인하세요.
              </p>
            </div>
            <Link
              href="/settings?tab=plan"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm md:text-base font-bold px-5 py-2.5 transition-colors"
            >
              Basic 이상에서 확인 가능 →
            </Link>
          </div>
        )}

        {/* 로딩 스켈레톤 */}
        {!planLocked && loading && (
          <div className="space-y-3 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="h-24 bg-gray-100 rounded-xl" />
              <div className="h-24 bg-gray-100 rounded-xl" />
            </div>
          </div>
        )}

        {/* 에러 */}
        {!planLocked && !loading && fetchError && (
          <div className="flex items-center gap-2 text-sm text-gray-600 py-4">
            <AlertCircle className="w-4 h-4 text-gray-600 shrink-0" />
            데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
          </div>
        )}

        {/* 데이터 없음 */}
        {!planLocked && !loading && !fetchError && data && !hasTrendData && (
          <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
            <TrendingUp className="w-8 h-8 text-gray-700" aria-hidden="true" />
            <p className="text-sm text-gray-600 break-keep max-w-xs mx-auto leading-relaxed">
              데이터 수집 중 — 스캔·블로그 분석을 진행하면 표시됩니다
            </p>
          </div>
        )}

        {/* 데이터 있음 */}
        {!planLocked && !loading && !fetchError && data && hasTrendData && (
          <div className="space-y-4">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

              {/* 키워드 검색 순위 */}
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 md:p-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">키워드 검색 순위</p>
                {latestRank && rankBand ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-base font-bold ${rankBand.colorClass}`}>
                        {rankBand.label}
                      </span>
                      <TrendIcon direction={rankTrend} />
                      <TrendLabel direction={rankTrend} />
                    </div>
                    <p className="text-sm text-gray-600 leading-snug">
                      최근 {data.keyword_rank_trend.length}회 측정 기준
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">아직 순위 데이터 없음</p>
                )}
              </div>

              {/* 블로그 발행 추이 */}
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 md:p-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">블로그 발행 추이</p>
                {latestBlog !== null ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-gray-800">
                        최근 {latestBlog?.post_count ?? 0}건
                      </span>
                      <TrendIcon direction={blogTrend} />
                      <TrendLabel direction={blogTrend} />
                    </div>
                    <p className="text-sm text-gray-600 leading-snug">
                      최근 {data.blog_trend.length}회 측정 기준
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">블로그 분석 후 표시됩니다</p>
                )}
              </div>
            </div>

            {/* 면책 문구 */}
            <p className="text-sm text-gray-600 leading-snug">
              네이버 검색 순위는 측정 시점·기기·지역·로그인 상태에 따라 달라질 수 있습니다
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
