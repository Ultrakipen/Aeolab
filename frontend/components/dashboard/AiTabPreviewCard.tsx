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
  /** "measured" = 실측 in_ai_tab 데이터 존재, "estimated" = 추정 (기본값) */
  data_source?: "measured" | "estimated";
  /** 실측 AI탭 노출 확인 여부 (data_source==="measured" 일 때만 신뢰) */
  confirmed_in_ai_tab?: boolean;
  /** 광고 영역 노출 여부 — true 시 유기 점수 제외 안내 */
  ad_only?: boolean;
  /** 예약 연동 여부 — null=미측정, true=연동됨, false=미연동 */
  has_reservation?: boolean | null;
  /** 사진 수 실측 추정값 — null=미측정, int=추정 수 */
  photo_count?: number | null;
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
  /** blog_analyzer.py에서 오는 블로그 발견 수 (AI탭 UGC 신호) */
  blogMentionCount?: number;
  /** businesses.keywords 길이 — 0이면 키워드 등록 유도 분기 노출 */
  keywordCount?: number;
}

function isUnavailable(res: ApiResponse): res is AiTabPreviewUnavailable {
  return (res as AiTabPreviewUnavailable).available === false;
}

export default function AiTabPreviewCard({ bizId, subscriptionPlan, category, blogMentionCount, keywordCount }: Props) {
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

  // INACTIVE 업종 응답: AI탭은 모든 업종 가능(beta)이므로 숨기지 않고
  // 카드 내 안내 톤만 분기하여 표시 — unavailable 플래그는 배너 전용으로만 사용

  return (
    <section
      aria-labelledby="ai-tab-preview-title"
      className="mb-4 md:mb-6 rounded-xl border border-blue-200 bg-white shadow-sm overflow-hidden"
    >
      {/* 헤더 */}
      <div className="px-4 py-3 md:px-6 md:py-4 border-b border-blue-100 bg-blue-50">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-blue-600 shrink-0" />
            <h2
              id="ai-tab-preview-title"
              className="text-base md:text-lg font-bold text-blue-900 break-keep"
            >
              네이버 AI탭 답변 미리보기
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
        <p className="mt-1 text-sm text-blue-700/80 leading-snug break-keep">
          네이버 검색결과 상단 &quot;AI&quot; 탭 (2026-04-27 베타 · <strong>모든 업종 노출 가능</strong>) — AI 브리핑과는 다른 노출 경로입니다.
        </p>
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

        {/* INACTIVE 업종: 카드 숨김 대신 안내 배너 표시 */}
        {!loading && unavailable && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700">
            <p className="font-semibold text-slate-800 mb-1">AI탭은 모든 업종에서 노출 가능합니다 (Beta)</p>
            <p className="leading-relaxed break-keep">
              네이버 AI 브리핑 대상 업종은 아니지만, AI탭에서는 소개글·사진·리뷰 키워드를 잘 등록한 모든 업종의 사업장이 노출될 수 있습니다.
              ChatGPT·Gemini 등 글로벌 AI 최적화도 병행하세요.
            </p>
          </div>
        )}

        {/* 정상 데이터 */}
        {!loading && !error && !forbidden && !isFree && data && (
          <>
            {/* likely 업종 안내 배너 — flex-row 밖에 배치해야 레이아웃 붕괴 없음 */}
            {data.eligibility === "likely" && (
              <div className="w-full rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800 mb-4">
                AI 브리핑 확대 예상 업종입니다. AI탭은 이미 모든 업종 베타 대상이므로 지금부터 소개글·사진·리뷰를 준비해두세요.
              </div>
            )}

          <div className="flex flex-col md:flex-row gap-5 md:gap-6">

            {/* 좌측: 시뮬레이션 답변 */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2 flex-wrap">
                예시 답변
                {data.data_source === "measured" ? (
                  data.confirmed_in_ai_tab ? (
                    <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full font-semibold">
                      AI탭 노출 실측 확인
                    </span>
                  ) : (
                    <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full font-semibold">
                      실측 데이터 기반
                    </span>
                  )
                ) : (
                  <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full font-normal">(추정)</span>
                )}
              </p>
              {data.ad_only && (
                <div className="mb-3 flex items-start gap-1.5 rounded-lg px-3 py-2 bg-orange-50 border border-orange-200">
                  <AlertCircle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-orange-800 leading-snug break-keep">
                    최근 스캔에서 <strong>광고 영역</strong>으로 감지되었습니다. 유기 노출 점수에는 반영되지 않습니다.
                  </p>
                </div>
              )}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-sm md:text-base text-gray-800 leading-relaxed whitespace-pre-line">
                    {data.simulated_answer}
                  </p>
                </div>
              </div>
              {/* 면책 문구 */}
              <p className="mt-2 text-sm text-gray-500 leading-snug">
                {data.disclaimer}
              </p>
              {/* 실측 정보 — has_reservation / photo_count */}
              {(data.has_reservation !== null && data.has_reservation !== undefined) || data.photo_count !== null && data.photo_count !== undefined ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {data.has_reservation !== null && data.has_reservation !== undefined && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold border ${
                      data.has_reservation
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-orange-50 text-orange-700 border-orange-200"
                    }`}>
                      {data.has_reservation ? "✓ 예약 연동 확인" : "⚠ 예약 미연동"}
                    </span>
                  )}
                  {data.photo_count !== null && data.photo_count !== undefined && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold border ${
                      data.photo_count >= 10
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-orange-50 text-orange-700 border-orange-200"
                    }`}>
                      {data.photo_count >= 10 ? `✓ 사진 ${data.photo_count}장+` : `⚠ 사진 ${data.photo_count}장 (10장 권장)`}
                    </span>
                  )}
                </div>
              ) : (
                <p className="mt-1.5 text-sm text-gray-400 leading-snug">
                  * 예약 연동·사진 수는 스캔 시 자동 감지됩니다.
                </p>
              )}
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

              {/* 사용자 키워드 미등록 분기 — matched=0 + keywordCount=0 시 우선 노출 */}
              {data.matched_contexts.length === 0 && keywordCount === 0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                  <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    키워드 미등록 — 정확한 AI탭 시뮬레이션 위해 등록 필요
                  </p>
                  <p className="text-sm text-amber-700 mt-1 leading-snug break-keep">
                    사업장 핵심 키워드 3~5개를 등록하면 AI탭 답변 추정이 정확해집니다.
                  </p>
                  <Link
                    href="/settings"
                    className="mt-2 inline-flex items-center text-sm font-semibold text-amber-700 hover:text-amber-900 transition-colors"
                  >
                    키워드 등록하러 가기 →
                  </Link>
                </div>
              )}

              {/* matched·missing 모두 빈 경우 폴백 — taxonomy ai_tab_context 미보유 업종 보호 */}
              {data.matched_contexts.length === 0 && data.missing_contexts.length === 0 && (keywordCount === undefined || keywordCount > 0) && (
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                  <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
                    이 업종의 AI탭 패턴 분석 준비 중
                  </p>
                  <p className="text-sm text-gray-600 mt-1 leading-snug break-keep">
                    소개글·사진·예약 정보를 충실히 등록하면 AI탭 노출 가능성이 높아집니다.
                  </p>
                  <Link
                    href="/guide/ai-info-tab"
                    className="mt-2 inline-flex items-center text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    AI탭 최적화 가이드 →
                  </Link>
                </div>
              )}

              {/* 5번째 요소: 외부 블로그 UGC 발견 수 */}
              <div className="flex items-center justify-between py-2 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">외부 블로그 언급</span>
                  <span className="text-sm text-gray-500">AI탭 블로그·SNS 후기 신호</span>
                </div>
                <div className="flex items-center gap-1">
                  {(blogMentionCount ?? 0) >= 5 ? (
                    <span className="text-sm font-semibold text-emerald-600">{blogMentionCount}건</span>
                  ) : (blogMentionCount ?? 0) > 0 ? (
                    <span className="text-sm font-semibold text-amber-600">{blogMentionCount}건</span>
                  ) : (
                    <span className="text-sm text-gray-400">미발견</span>
                  )}
                  {(blogMentionCount ?? 0) === 0 && (
                    <span className="text-sm text-gray-400 ml-1">블로그 후기 유도 권장</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          </>
        )}
      </div>
    </section>
  );
}
