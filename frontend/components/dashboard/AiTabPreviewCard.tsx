"use client";

import { useEffect, useState } from "react";
import { Lock, Sparkles, CheckCircle2, AlertCircle, Clock, Lightbulb, Bot, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { getSafeSession } from "@/lib/supabase/client";
import { authFetch } from "@/lib/api";

// 환경변수 게이트: false이면 "측정 준비 중" UI 표시
const NAVER_AI_TAB_ENABLED = process.env.NEXT_PUBLIC_NAVER_AI_TAB_ENABLED !== "false";

// ai_tab_signal 값 → 사용자 친화적 설명
const SIGNAL_USER_LABELS: Record<string, string> = {
  "결과 시각화": "AI탭에서 사진·포트폴리오를 직접 보여줄 수 있어요",
  "예약 버튼 노출": "AI탭에서 예약 버튼이 바로 표시돼요",
  "가격 투명성": "고객이 AI탭에서 가격을 바로 확인할 수 있어요",
  "서비스 정보": "AI가 서비스 과정을 상세히 설명할 수 있어요",
  "UGC 풍부도": "외부 후기가 많을수록 AI탭 노출 신뢰도가 높아져요",
  "위치 정보": "AI탭에서 내 위치가 정확히 표시돼요",
  "영업 정보": "영업시간·연락처를 AI탭에서 바로 볼 수 있어요",
  "메뉴 정보": "AI탭에서 메뉴·가격을 미리 확인할 수 있어요",
  "전문성 신호": "전문 분야를 강조할수록 AI탭에서 신뢰도가 높아져요",
  "콘텐츠 풍부도": "소개글이 풍부할수록 AI탭 답변이 구체적으로 나와요",
};

function getPriorityBadge(weight: number): { label: string; className: string } {
  if (weight >= 0.25) return { label: "매우 중요", className: "bg-red-50 text-red-700 border-red-200" };
  if (weight >= 0.15) return { label: "중요", className: "bg-amber-50 text-amber-700 border-amber-200" };
  return { label: "권장", className: "bg-blue-50 text-blue-700 border-blue-200" };
}

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface ChecklistItem {
  item: string;
  weight: number; // 0.0~1.0
  ai_tab_signal: string;
  guide_url?: string;
  /** true=스캔 확인 완료, false=미완료, undefined=직접 확인 필요(미측정) */
  completed?: boolean;
}

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
  /** 업종별 AI탭 준비 체크리스트 (ai_tab_checklists.py 단일 소스) */
  checklist?: ChecklistItem[];
  /** AI탭 노출 가능성 텍스트 레이블 */
  readiness_label?: {
    short: string;       // "준비 중", "거의 완료" 등
    description: string; // 상세 설명 문장
  };
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
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [confirmingItem, setConfirmingItem] = useState<string | null>(null);
  const [readinessLabel, setReadinessLabel] = useState<{ short: string; description: string } | null>(null);

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

        let res: Response;
        try {
          res = await authFetch(`${BACKEND}/api/report/ai-tab-preview/${bizId}`, token);
        } catch {
          // SESSION_EXPIRED → authFetch가 /login으로 리다이렉트 처리
          return;
        }

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
        if (json.readiness_label) {
          setReadinessLabel(json.readiness_label);
        }
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

  const handleConfirm = async (itemText: string, completed: boolean) => {
    setConfirmingItem(itemText);
    try {
      const session = await getSafeSession();
      const token = session?.access_token;
      if (!token) return;

      const res = await fetch(
        `${BACKEND}/api/report/ai-tab-checklist-confirm/${bizId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ item: itemText, completed }),
        }
      );
      if (res.ok) {
        const json = await res.json();
        setOverrides(prev => ({ ...prev, [itemText]: completed }));
        if (json.readiness_label) {
          setReadinessLabel(json.readiness_label);
        }
      }
    } finally {
      setConfirmingItem(null);
    }
  };

  // INACTIVE 업종 응답: AI탭은 모든 업종 가능(beta)이므로 숨기지 않고
  // 카드 내 안내 톤만 분기하여 표시 — unavailable 플래그는 배너 전용으로만 사용

  // measured/estimated 배지 계산 (naver_result.in_ai_tab 기반)
  const isMeasured = data ? typeof data.confirmed_in_ai_tab === "boolean" || data.data_source === "measured" : false;
  const isVisible = data?.confirmed_in_ai_tab === true;

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
            {/* 데이터 소스 배지: measured / estimated */}
            {!isFree && !loading && data && (
              isMeasured ? (
                <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-sm font-semibold border border-emerald-200">
                  실측
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-sm font-medium border border-gray-200">
                  추정
                </span>
              )
            )}
            {data?.eligibility === "likely" && (
              <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-sm font-semibold">
                AI 브리핑 확대 예정
              </span>
            )}
          </div>
          {isFree && (
            <div className="flex items-center gap-1 text-sm text-gray-600 shrink-0">
              <Lock className="w-4 h-4" />
              <span className="hidden sm:inline">Basic 이상</span>
            </div>
          )}
        </div>
        <p className="mt-1 text-sm text-blue-700/80 leading-snug break-keep">
          고객이 네이버에서 검색할 때 <strong>AI탭에 내 가게가 어떻게 소개되는지</strong> 미리 볼 수 있습니다.
          네이버 AI 브리핑과는 별개 경로로, <strong>업종 제한 발표 없이</strong> 모든 업종이 대상입니다.
        </p>
      </div>

      {/* 본문 */}
      <div className="p-4 md:p-6">
        {/* 환경변수 게이트: NAVER_AI_TAB_ENABLED=false 시 측정 준비 중 UI */}
        {!NAVER_AI_TAB_ENABLED && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center">
              <Clock className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <p className="text-base font-semibold text-gray-800 mb-1">
                AI탭 측정 준비 중
              </p>
              <p className="text-sm text-gray-600 max-w-xs mx-auto leading-relaxed break-keep">
                네이버 AI탭 측정이 일시적으로 비활성화되어 있습니다.
              </p>
            </div>
            <Link
              href="/guide/ai-info-tab"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-semibold px-5 py-2.5 transition-colors border border-blue-200"
            >
              AI탭 최적화 가이드 미리 보기 →
            </Link>
          </div>
        )}

        {/* 스켈레톤 로딩 */}
        {NAVER_AI_TAB_ENABLED && loading && (
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
        {NAVER_AI_TAB_ENABLED && !loading && error && !forbidden && (
          <div className="flex items-center gap-2 text-sm text-gray-600 py-2">
            <AlertCircle className="w-4 h-4 text-gray-600 shrink-0" />
            잠시 후 다시 시도해주세요.
          </div>
        )}

        {/* Free 플랜: 잠금 오버레이 */}
        {NAVER_AI_TAB_ENABLED && !loading && (forbidden || isFree) && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <Lock className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <p className="text-base font-semibold text-gray-800 mb-1">
                AI탭 답변 미리보기
              </p>
              <p className="text-sm text-gray-600 max-w-xs mx-auto leading-relaxed break-keep">
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
        {NAVER_AI_TAB_ENABLED && !loading && unavailable && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700">
            <p className="font-semibold text-slate-800 mb-1">플레이스형 AI 브리핑 비대상 업종 — 정보형 AI 브리핑·AI탭은 모든 업종 가능</p>
            <p className="leading-relaxed break-keep">
              AI탭은 업종 제한 발표 없이 모든 업종이 대상입니다.
              소개글 200자·사진 10장·리뷰 키워드를 미리 최적화하면 플레이스 에이전트를 통한 AI탭 노출에 유리합니다.
              ChatGPT·Gemini 등 글로벌 AI 최적화도 함께 진행하세요.
            </p>
          </div>
        )}

        {/* 정상 데이터 — 측정 상태 분기 배너 */}
        {NAVER_AI_TAB_ENABLED && !loading && !error && !forbidden && !isFree && data && (
          <div className="mb-4">
            {isMeasured && isVisible && (
              <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-emerald-800">AI탭 노출 확인됨</p>
                  <p className="text-sm text-emerald-700 mt-0.5 leading-snug break-keep">
                    마지막 스캔에서 네이버 AI탭에 내 사업장이 실제로 노출된 것을 확인했습니다.
                  </p>
                  <span className="inline-flex items-center mt-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-sm font-semibold">
                    실측 확인
                  </span>
                </div>
              </div>
            )}
            {isMeasured && !isVisible && (
              <div className="flex items-start gap-2.5 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
                <AlertCircle className="w-5 h-5 text-gray-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-700">AI탭 미노출</p>
                  <p className="text-sm text-gray-600 mt-0.5 leading-snug break-keep">
                    마지막 스캔에서 AI탭 노출이 확인되지 않았습니다. 아래 체크리스트를 완료하면 노출 가능성이 높아집니다.
                  </p>
                  <span className="inline-flex items-center mt-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200 px-2 py-0.5 text-sm font-medium">
                    실측 기반
                  </span>
                </div>
              </div>
            )}
            {!isMeasured && (
              <div className="flex items-start gap-2.5 rounded-xl bg-orange-50 border border-orange-200 px-4 py-3">
                <Clock className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-orange-800">측정 대기 중</p>
                  <p className="text-sm text-orange-700 mt-0.5 leading-snug break-keep">
                    AI탭 실측 데이터가 아직 없습니다. 아래는 등록 정보 기반 추정 시뮬레이션입니다.
                    스캔을 다시 실행하면 최신 상태로 측정됩니다.
                  </p>
                  <span className="inline-flex items-center mt-1 rounded-full bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 text-sm font-medium">
                    추정 예시
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 정상 데이터 */}
        {NAVER_AI_TAB_ENABLED && !loading && !error && !forbidden && !isFree && data && (
          <>
            {/* likely 업종 안내 배너 — flex-row 밖에 배치해야 레이아웃 붕괴 없음 */}
            {data.eligibility === "likely" && (
              <div className="w-full rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800 mb-4">
                AI 브리핑 확대 예상 업종입니다. AI탭은 업종 제한 발표가 없으므로 지금부터 소개글·사진·리뷰를 준비해두세요.
              </div>
            )}

          <div className="flex flex-col md:flex-row gap-5 md:gap-6 md:items-start">

            {/* 좌측: 시뮬레이션 답변 */}
            <div className="flex-1 min-w-0">
              <div className="mb-2">
                <p className="text-sm font-semibold text-gray-700 flex items-center gap-2 flex-wrap">
                  AI탭이 이렇게 소개해요
                  {data.data_source === "measured" ? (
                    data.confirmed_in_ai_tab ? (
                      <span className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full font-semibold">
                        ✓ 실제 AI탭 노출 확인
                      </span>
                    ) : (
                      <span className="text-sm text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full font-semibold">
                        실측 데이터 기반
                      </span>
                    )
                  ) : (
                    <span className="text-sm text-gray-600 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded-full font-medium">추정 예시</span>
                  )}
                </p>
                {data.data_source !== "measured" && (
                  <p className="text-sm text-gray-600 mt-0.5">등록된 정보를 바탕으로 AI가 어떻게 답변할지 시뮬레이션한 결과입니다</p>
                )}
              </div>
              {data.ad_only && (
                <div className="mb-3 flex items-start gap-1.5 rounded-lg px-3 py-2 bg-orange-50 border border-orange-200">
                  <AlertCircle className="w-4 h-4 text-orange-700 shrink-0 mt-0.5" />
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
              <p className="mt-2 text-sm text-gray-600 leading-snug">
                {data.disclaimer}
              </p>
              {/* AI탭 베타 면책 문구 */}
              <p className="mt-1 text-sm text-gray-600 leading-snug break-keep">
                네이버 AI탭 노출 기준은 알고리즘 업데이트에 따라 변경될 수 있습니다.
              </p>
              {/* 실측 정보 — has_reservation / photo_count */}
              {(data.has_reservation !== null && data.has_reservation !== undefined) || data.photo_count !== null && data.photo_count !== undefined ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {data.has_reservation !== null && data.has_reservation !== undefined && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold border ${
                      data.has_reservation
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-orange-50 text-orange-700 border-orange-200"
                    }`}>
                      {data.has_reservation ? <><CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />예약 연동 확인</> : <><AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />예약 미연동</>}
                    </span>
                  )}
                  {data.photo_count !== null && data.photo_count !== undefined && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold border ${
                      data.photo_count >= 10
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-orange-50 text-orange-700 border-orange-200"
                    }`}>
                      {data.photo_count >= 10 ? <><CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />사진 {data.photo_count}장+</> : <><AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />사진 {data.photo_count}장 (10장 권장)</>}
                    </span>
                  )}
                </div>
              ) : (
                <p className="mt-1.5 text-sm text-gray-600 leading-snug">
                  * 예약 연동·사진 수는 스캔 시 자동 감지됩니다.
                </p>
              )}

              {/* AI탭 준비도 요약 — 빈 공간 활용 + 즉시 행동 유도 */}
              {readinessLabel && (
                <div className="mt-3 rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2.5">
                  <p className="text-sm font-bold text-indigo-900">
                    AI탭 준비도 — {readinessLabel.short}
                  </p>
                  <p className="text-sm text-indigo-700 mt-0.5 leading-snug break-keep">
                    {readinessLabel.description}
                  </p>
                </div>
              )}
              {data.checklist && data.checklist.filter(it => it.completed === false).length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-orange-400 shrink-0" />
                    지금 할 수 있는 개선
                  </p>
                  <ul className="space-y-1.5">
                    {data.checklist.filter(it => it.completed === false).slice(0, 3).map((it, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="mt-1 w-3.5 h-3.5 rounded-full border-2 border-orange-300 shrink-0" />
                        <span className="leading-snug break-keep">{it.item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* 우측: 매칭/부족 컨텍스트 */}
            <div className="md:w-60 lg:w-72 shrink-0 flex flex-col gap-4">

              {/* 매칭된 컨텍스트 */}
              {data.matched_contexts.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-0.5 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-green-700 shrink-0" />
                    AI가 파악한 내 가게 정보
                  </p>
                  <p className="text-sm text-gray-600 mb-2">이 정보들이 AI탭 답변에 반영됩니다</p>
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
                <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-3">
                  <p className="text-sm font-semibold text-orange-800 mb-1 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-orange-700 shrink-0" />
                    아직 AI탭에 소개되지 않은 서비스
                  </p>
                  <p className="text-sm text-orange-700 mb-2 leading-snug break-keep">
                    아래 항목을 <strong>네이버 스마트플레이스 → 소개글</strong>에 자연스러운 문장으로 추가하면 AI탭 노출이 늘어납니다.
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {data.missing_contexts.map((ctx, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center rounded-full bg-white border border-orange-300 text-orange-800 px-2.5 py-1 text-sm font-medium"
                      >
                        {ctx}
                      </span>
                    ))}
                  </div>
                  {/* 어디에 입력하는지 3단계 안내 */}
                  <div className="rounded bg-white border border-orange-100 px-3 py-2 mb-3">
                    <p className="text-sm font-semibold text-gray-700 mb-1">📍 입력 위치</p>
                    <ol className="text-sm text-gray-600 space-y-0.5 leading-snug">
                      <li>① <a href="https://smartplace.naver.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-medium">smartplace.naver.com</a> 접속</li>
                      <li>② 업체정보 → <strong>소개글</strong> 수정 (200자 이상 작성 권장)</li>
                      <li>③ 위 항목들을 문장 안에 자연스럽게 포함</li>
                    </ol>
                  </div>
                  <Link
                    href="/guide/ai-tab"
                    className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    소개글 작성 예시 보기 →
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

              {/* 고객 블로그 후기 UGC */}
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-gray-700">고객 블로그 후기</span>
                    <span className="block text-sm text-gray-600 mt-0.5 break-keep leading-relaxed">
                      방문 고객이 네이버 블로그에 직접 쓴 후기 수<br />
                      <span className="text-gray-600">사장님 블로그 포스팅과는 별개로 측정됩니다</span>
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    {(blogMentionCount ?? 0) >= 5 ? (
                      <>
                        <span className="text-base font-bold text-emerald-700">{blogMentionCount}건</span>
                        <span className="block text-sm text-emerald-700 mt-0.5">충분해요!</span>
                      </>
                    ) : (blogMentionCount ?? 0) > 0 ? (
                      <>
                        <span className="text-base font-bold text-amber-700">{blogMentionCount}건</span>
                        <span className="block text-sm text-gray-600 mt-0.5">5건 이상 권장</span>
                      </>
                    ) : (
                      <>
                        <span className="text-sm text-gray-600">아직 없음</span>
                        <span className="block text-sm text-gray-600 mt-0.5">5건 이상 권장</span>
                      </>
                    )}
                  </div>
                </div>
                {(blogMentionCount ?? 0) < 5 && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-sm text-gray-600 break-keep leading-relaxed flex items-start gap-1.5">
                      <Lightbulb className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />방문 고객에게 <strong>네이버 블로그</strong>에 후기를 남겨달라고 요청해 보세요.
                      고객 후기가 많을수록 AI탭에서 신뢰도 있는 정보로 인식됩니다.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 업종별 AI탭 노출 높이는 방법 */}
          {data.checklist && data.checklist.length > 0 && (() => {
            const verifiedItems = data.checklist!.filter(it => it.completed !== undefined);
            const completedItems = data.checklist!.filter(it => it.completed === true);
            const pendingItems = data.checklist!.filter(it => it.completed === false);
            const unknownItems = data.checklist!.filter(it => it.completed === undefined);
            // 정렬: 미완료 → 미측정 → 완료
            const sorted = [...pendingItems, ...unknownItems, ...completedItems];
            return (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <h4 className="text-sm font-semibold text-gray-800">
                    네이버 AI탭 노출 높이는 방법
                  </h4>
                  {verifiedItems.length > 0 && (
                    <span className="text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                      ✓ {completedItems.length}/{verifiedItems.length}개 자동 확인
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-2 break-keep">
                  아래 항목을 채울수록 AI탭에 더 자주, 더 풍부하게 노출됩니다.
                </p>

                {/* AI탭 노출 가능성 텍스트 레이블 */}
                {readinessLabel && (
                  <div className="mb-3 rounded-lg bg-indigo-50 border border-indigo-200 px-4 py-3">
                    <p className="text-sm font-bold text-indigo-900">
                      AI탭 노출 가능성 — {readinessLabel.short}
                    </p>
                    <p className="text-sm text-indigo-700 mt-0.5 leading-snug break-keep">
                      {readinessLabel.description}
                    </p>
                  </div>
                )}

                {/* 안내 배너 — 실측 데이터가 있을 때만 표시 */}
                {verifiedItems.length > 0 && (
                  <div className="mb-3 flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-blue-800 leading-relaxed break-keep">
                      <strong>✓ 표시 항목</strong>은 마지막 스캔에서 자동으로 확인된 완료 상태입니다.
                      나머지 항목은 스마트플레이스에서 직접 확인이 필요합니다.
                      스캔을 다시 실행하면 최신 상태로 업데이트됩니다.
                    </p>
                  </div>
                )}

                <ul className="space-y-2">
                  {sorted.map((it, idx) => {
                    const badge = getPriorityBadge(it.weight);
                    const signal = SIGNAL_USER_LABELS[it.ai_tab_signal] ?? it.ai_tab_signal;
                    const isDone = it.completed === true || overrides[it.item] === true;
                    const isUserConfirmed = overrides[it.item] === true && it.completed !== true;
                    const isUnknown = it.completed === undefined && !overrides[it.item];
                    return (
                      <li
                        key={idx}
                        className={`flex items-start gap-3 rounded-lg px-3 py-2.5 ${
                          isDone
                            ? isUserConfirmed
                              ? "bg-blue-50 border border-blue-100"
                              : "bg-emerald-50 border border-emerald-100"
                            : it.completed === false
                            ? "bg-white border border-gray-200"
                            : "bg-gray-50 border border-gray-100"
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${isUserConfirmed ? "text-blue-600" : "text-emerald-700"}`} />
                        ) : isUnknown ? (
                          <span className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0 mt-0.5 flex-none" />
                        ) : (
                          <span className={`inline-flex items-center justify-center shrink-0 rounded-full border px-2 py-0.5 text-sm font-semibold mt-0.5 ${badge.className}`}>
                            {badge.label}
                          </span>
                        )}
                        <span className="flex-1 min-w-0">
                          <span className={`block text-sm font-medium leading-snug ${
                            isDone
                              ? isUserConfirmed
                                ? "text-blue-800 line-through decoration-blue-400"
                                : "text-emerald-800 line-through decoration-emerald-400"
                              : "text-gray-800"
                          }`}>
                            {it.item}
                          </span>
                          <span className={`block text-sm mt-0.5 leading-snug ${
                            isDone
                              ? isUserConfirmed
                                ? "text-blue-600"
                                : "text-emerald-700"
                              : isUnknown
                              ? "text-gray-600"
                              : "text-gray-600"
                          }`}>
                            {isDone
                              ? isUserConfirmed
                                ? "직접 확인 완료"
                                : "스캔에서 확인 완료"
                              : isUnknown
                              ? `직접 확인 필요 — ${signal}`
                              : signal}
                          </span>
                        </span>
                        {isUnknown && (
                          <button
                            onClick={() => handleConfirm(it.item, true)}
                            disabled={confirmingItem === it.item}
                            className="shrink-0 text-sm font-semibold text-white bg-blue-600 border border-blue-600 rounded-full px-3 py-1.5 hover:bg-blue-700 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm mt-0.5"
                          >
                            {confirmingItem === it.item ? "저장 중…" : "✓ 완료했어요"}
                          </button>
                        )}
                        {isDone && !isUserConfirmed && (
                          <span className="text-sm text-emerald-700 font-semibold shrink-0 mt-0.5">완료</span>
                        )}
                        {isUserConfirmed && (
                          <button
                            onClick={() => handleConfirm(it.item, false)}
                            disabled={confirmingItem === it.item}
                            className="shrink-0 text-sm font-medium text-gray-600 border border-gray-200 rounded-full px-2.5 py-1 hover:border-red-300 hover:text-red-700 transition-colors cursor-pointer disabled:opacity-50 mt-0.5"
                          >
                            취소
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {unknownItems.length > 0 && (
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed break-keep">
                    ○ 원형 표시 항목은 자동 측정이 어렵습니다. 스마트플레이스 관리자에서 직접 확인해주세요.
                  </p>
                )}
              </div>
            );
          })()}

          {/* 네이버 로컬 에이전트 준비 안내 — 예약 미연동 시 노출 */}
          {data.has_reservation === false && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-3 md:p-4">
                <div className="flex items-start gap-2">
                  <Bot className="w-4 h-4 shrink-0 text-indigo-700" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-indigo-900">
                      네이버 로컬 에이전트 준비 (H2 2026 예정)
                    </p>
                    <p className="text-sm text-indigo-700 mt-0.5 leading-snug break-keep">
                      네이버가 2026년 하반기 AI 에이전트를 통해 <strong>예약 → 결제까지</strong> 자동 처리하는 기능을 출시할 예정입니다.
                      지금 예약 연동을 완료해 두면 출시 즉시 노출 우위를 가져갈 수 있습니다.
                    </p>
                    <a
                      href="https://partner.naver.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                      네이버 예약 연동 설정하기 →
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
          </>
        )}
      </div>
    </section>
  );
}
