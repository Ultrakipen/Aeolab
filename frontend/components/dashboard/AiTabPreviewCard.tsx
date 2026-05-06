"use client";

import { useEffect, useState } from "react";
import { Lock, Sparkles, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { getSafeSession } from "@/lib/supabase/client";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface AiTabPreviewResponse {
  biz_id: string;
  simulated_answer: string;
  matched_contexts: string[];
  missing_contexts: string[];
  preview_only: boolean;
  disclaimer: string;
  eligibility?: "active" | "likely";
}

interface AiTabPreviewUnavailable {
  available: false;
  reason: string;
}

type ApiResponse = AiTabPreviewResponse | AiTabPreviewUnavailable;

interface Props {
  bizId: string;
  subscriptionPlan: string; // "free" | "basic" | "pro" | "biz"
  category: string;
}

function isUnavailable(res: ApiResponse): res is AiTabPreviewUnavailable {
  return (res as AiTabPreviewUnavailable).available === false;
}

export default function AiTabPreviewCard({ bizId, subscriptionPlan, category }: Props) {
  const [data, setData] = useState<AiTabPreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const isFree = subscriptionPlan === "free";

  useEffect(() => {
    if (!bizId) return;
    let cancelled = false;

    (async () => {
      try {
        const session = await getSafeSession();
        const token = session?.access_token;
        if (!token) {
          if (!cancelled) {
            setLoading(false);
            setError(true);
          }
          return;
        }

        const res = await fetch(
          `${BACKEND}/api/report/ai-tab-preview/${bizId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (cancelled) return;

        if (res.status === 403) {
          setForbidden(true);
          setLoading(false);
          return;
        }

        if (!res.ok) {
          setError(true);
          setLoading(false);
          return;
        }

        const json: ApiResponse = await res.json();

        if (cancelled) return;

        if (isUnavailable(json)) {
          setUnavailable(true);
          setLoading(false);
          return;
        }

        setData(json);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bizId]);

  // INACTIVE 업종 응답: 카드 숨김
  if (!loading && unavailable) return null;

  return (
    <section
      aria-labelledby="ai-tab-preview-title"
      className="mb-4 md:mb-6 rounded-2xl border border-blue-200 bg-white shadow-sm overflow-hidden"
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4 border-b border-blue-100 bg-blue-50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-blue-600 shrink-0" />
          <h2
            id="ai-tab-preview-title"
            className="text-base md:text-lg font-bold text-blue-900 break-keep"
          >
            AI탭 답변 미리보기
          </h2>
          {data?.eligibility === "likely" ? (
            <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-sm font-semibold">
              확대 예정
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-sm font-semibold">
              Beta
            </span>
          )}
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
        {/* 스켈레톤 로딩 */}
        {loading && (
          <div className="space-y-3 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
            <div className="h-4 bg-gray-200 rounded w-5/6" />
            <div className="mt-4 flex gap-2">
              <div className="h-6 bg-gray-200 rounded-full w-20" />
              <div className="h-6 bg-gray-200 rounded-full w-24" />
            </div>
          </div>
        )}

        {/* 에러 상태 */}
        {!loading && error && !forbidden && (
          <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
            <AlertCircle className="w-4 h-4 text-gray-400 shrink-0" />
            잠시 후 다시 시도해주세요.
          </div>
        )}

        {/* Free 플랜: 잠금 오버레이 */}
        {!loading && (forbidden || isFree) && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <Lock className="w-6 h-6 text-gray-400" />
            </div>
            <div>
              <p className="text-base font-semibold text-gray-800 mb-1">
                AI탭 답변 미리보기
              </p>
              <p className="text-sm text-gray-500 max-w-xs mx-auto leading-relaxed break-keep">
                {category === "restaurant" || category === "cafe" || category === "bakery"
                  ? "내 가게가 네이버 AI탭에 어떻게 답변되는지 예시를 확인하고, 부족한 키워드를 파악하세요."
                  : "AI 검색에 내 가게가 어떻게 답변되는지 예시를 확인하고, 노출 확률을 높이세요."}
              </p>
            </div>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm md:text-base font-bold px-5 py-2.5 transition-colors"
            >
              Basic 이상에서 이용 가능 →
            </Link>
          </div>
        )}

        {/* 정상 데이터 */}
        {!loading && !error && !forbidden && !isFree && data && (
          <div className="flex flex-col md:flex-row gap-5 md:gap-6">

            {/* likely 업종 안내 배너 */}
            {data.eligibility === "likely" && (
              <div className="md:col-span-2 w-full rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                네이버 AI탭 확대 예정 업종입니다. 2026년 상반기 전체 확대 시 바로 적용될 수 있도록 지금부터 키워드를 준비하세요.
              </div>
            )}

            {/* 좌측: 시뮬레이션 답변 */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-600 mb-2">예시 답변</p>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-sm md:text-base text-gray-800 leading-relaxed whitespace-pre-line">
                    {data.simulated_answer}
                  </p>
                </div>
              </div>
              {/* 면책 문구 */}
              <p className="mt-2 text-xs text-gray-400 leading-snug">
                {data.disclaimer}
              </p>
            </div>

            {/* 우측: 매칭/부족 컨텍스트 */}
            <div className="md:w-60 lg:w-72 shrink-0 flex flex-col gap-4">

              {/* 매칭된 컨텍스트 */}
              {data.matched_contexts.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    답변에 포함된 정보
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.matched_contexts.map((ctx, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center rounded-full bg-green-50 border border-green-200 text-green-800 px-2.5 py-1 text-sm font-medium"
                      >
                        {ctx}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 부족한 컨텍스트 */}
              {data.missing_contexts.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-orange-500 shrink-0" />
                    아직 부족한 정보
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.missing_contexts.map((ctx, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center rounded-full bg-orange-50 border border-orange-200 text-orange-800 px-2.5 py-1 text-sm font-medium"
                      >
                        {ctx}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-sm text-orange-700 leading-snug break-keep">
                    등록 키워드에 추가하면 노출 확률이 높아집니다.
                  </p>
                  <Link
                    href="/settings?tab=business"
                    className="mt-2 inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    키워드 추가하기 →
                  </Link>
                </div>
              )}

              {/* 부족 항목 없을 때 */}
              {data.missing_contexts.length === 0 && data.matched_contexts.length > 0 && (
                <div className="rounded-xl bg-green-50 border border-green-200 p-3">
                  <p className="text-sm font-semibold text-green-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    등록 정보가 잘 반영되어 있습니다!
                  </p>
                  <p className="text-sm text-green-700 mt-0.5 leading-snug break-keep">
                    꾸준한 리뷰 관리와 소개글 업데이트로 유지하세요.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
