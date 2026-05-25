"use client";

import Link from "next/link";
import { Sparkles, Info } from "lucide-react";

// M3 사전 작업: Q2 광고 도입 감지 시 true로 변경 → 광고 경고 배너 즉시 활성화
// AiInfoTabStatusCard의 동일 상수와 함께 변경할 것 (단일 소스는 추후 lib/featureFlags.ts로 이관 가능)
const NAVER_AD_IN_BRIEFING_ACTIVE = true;

interface Props {
  /** 사용자 업종의 AI 브리핑 노출 가능성 */
  briefingEligibility: "active" | "likely" | "inactive";
  /** 프랜차이즈 가맹점 여부 */
  isFranchise?: boolean;
  /** 최근 스캔의 naver_result.ad_only — Q2 광고 도입 후 배너 표시용 (M3 사전 작업) */
  latestAdOnly?: boolean;
  /** 글로벌 AI 비중 (0~1). global < 0.65이면 채널별 측정 원리 미니 섹션 표시 */
  globalWeight?: number;
}

/**
 * 네이버 AI 브리핑 vs 네이버 AI탭 — 두 노출 경로 비교 카드
 *
 * 사용자 노출 화면 전체에서 두 개념이 혼재되어 있어 발생하는 오해를 방지하기 위해
 * 대시보드 상단에 명확한 비교 표를 노출.
 *
 * - AI 브리핑: 업종 제한 있음 (음식점·카페 등), 프랜차이즈 제외, 2025.03 정식
 * - AI탭: 모든 업종 가능, 2026-04-27 베타, 6월 전체 확대 예정 (네이버 공식)
 *
 * 자기 업종 기준으로 "현재 대상" 배지를 자동 표시.
 */
export default function NaverAiPathwayCard({ briefingEligibility, isFranchise, latestAdOnly, globalWeight }: Props) {
  const briefingActive = briefingEligibility === "active" && !isFranchise;
  const briefingLikely = briefingEligibility === "likely" && !isFranchise;
  const briefingInactive = briefingEligibility === "inactive" || isFranchise;

  return (
    <section
      aria-labelledby="naver-ai-pathway-title"
      className="rounded-xl border bg-white shadow-sm overflow-hidden"
    >
      <div className="flex items-center gap-2 px-4 py-3 md:px-6 md:py-4 border-b border-slate-100 bg-slate-50">
        <Info className="w-4 h-4 md:w-5 md:h-5 text-slate-500 shrink-0" />
        <h2
          id="naver-ai-pathway-title"
          className="text-base md:text-lg font-bold text-slate-800 break-keep"
        >
          AI 검색 채널 5종 — 내 가게가 노출될 수 있는 곳
        </h2>
      </div>

      <div className="p-4 md:p-6">
        <p className="text-sm md:text-base text-gray-700 mb-4 leading-relaxed break-keep">
          AEOlab은 5가지 AI 채널 노출을 측정합니다. 네이버 2채널은 업종 조건이 있고, 글로벌 3채널은 모든 업종 가능합니다.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {/* 좌측: AI 브리핑 */}
          <div
            className={`rounded-xl border p-4 ${
              briefingActive
                ? "bg-blue-50 border-blue-300"
                : briefingLikely
                ? "bg-blue-50 border-blue-200"
                : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center justify-center w-6 h-6 rounded-md text-sm font-black bg-blue-600 text-white"
                  aria-hidden="true"
                >
                  A
                </span>
                <h3 className="text-sm md:text-base font-bold text-blue-900">
                  네이버 AI 브리핑
                </h3>
              </div>
              {briefingActive && (
                <span className="inline-flex items-center rounded-full bg-blue-600 text-white px-2 py-0.5 text-xs font-bold">
                  내 업종 대상
                </span>
              )}
              {briefingLikely && (
                <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 text-xs font-semibold">
                  확대 예정 (네이버 공식 발표 기준)
                </span>
              )}
              {briefingInactive && (
                <span className="inline-flex items-center rounded-full bg-slate-200 text-slate-600 px-2 py-0.5 text-xs font-semibold">
                  비대상
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-blue-900 mb-1.5 break-keep">
              검색 결과 상단 AI 자동 추천 박스
            </p>
            <ul className="space-y-1 text-sm text-slate-700 leading-snug">
              <li className="text-sm">• 음식점·카페·베이커리·바·숙박 (+ 확대 중)</li>
              <li className="text-sm">• 프랜차이즈 가맹점 제외 (네이버 공식)</li>
              <li className="text-sm">• 핵심: 네이버 품질 기준, 리뷰 확보(권장), 소식·소개글</li>
              <li className="text-sm">• 2025.03 정식 출시 (외식 중심)</li>
            </ul>
            {isFranchise && (
              <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                프랜차이즈 가맹점은 현재 AI 브리핑 제공 대상에서 제외 (추후 확대 예정)
              </p>
            )}
            {/* M3 광고 경고 배너 — NAVER_AD_IN_BRIEFING_ACTIVE=true 시 노출 */}
            {NAVER_AD_IN_BRIEFING_ACTIVE && latestAdOnly === true && (
              <div className="mt-2 flex items-start gap-1.5 rounded px-2 py-1.5 bg-orange-50 border border-orange-200">
                <span className="text-orange-500 text-sm shrink-0">⚠️</span>
                <p className="text-sm text-orange-800 leading-snug break-keep">
                  최근 스캔 결과 <strong>광고 영역</strong>에서 노출됨 — 유기 점수에 미반영. 자연 노출 강화가 필요합니다.
                </p>
              </div>
            )}
          </div>

          {/* 우측: AI탭 */}
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center justify-center w-6 h-6 rounded-md text-sm font-black bg-indigo-600 text-white"
                  aria-hidden="true"
                >
                  T
                </span>
                <h3 className="text-sm md:text-base font-bold text-indigo-900">
                  네이버 AI탭
                </h3>
              </div>
              <span className="inline-flex items-center rounded-full bg-indigo-600 text-white px-2 py-0.5 text-xs font-bold gap-1">
                <Sparkles className="w-3 h-3" /> 모든 업종 Beta
              </span>
            </div>
            <p className="text-sm font-semibold text-indigo-900 mb-1.5 break-keep">
              검색 결과 상단 &quot;AI&quot; 탭 메뉴
            </p>
            <ul className="space-y-1 text-sm text-slate-700 leading-snug">
              <li>• <strong>모든 업종 가능</strong> (프랜차이즈 포함)</li>
              <li>• 네이버플러스 구독자 우선 베타</li>
              <li>• 핵심: 소개글 200자·사진 10장·예약 연동·블로그 후기</li>
              <li>• 2026-04-27 베타 → 6월 전체 확대 예정 (네이버 공식)</li>
            </ul>
          </div>
        </div>

        {/* 글로벌 AI 3채널 — 모든 업종 가능 */}
        <div className="mt-3 md:mt-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">글로벌 AI 3채널 — 모든 업종</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* ChatGPT */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-black bg-emerald-600 text-white"
                  aria-hidden="true"
                >
                  C
                </span>
                <h3 className="text-sm font-bold text-emerald-900">ChatGPT</h3>
                <span className="ml-auto inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 text-xs font-semibold">
                  모든 업종
                </span>
              </div>
              <ul className="space-y-0.5 text-sm text-slate-600 leading-snug">
                <li>• 학습 데이터 기반 (GPT-4.1-mini)</li>
                <li>• 블로그·리뷰·구조화 데이터 핵심</li>
                <li>• 면책: 실시간 검색과 다를 수 있음</li>
              </ul>
            </div>
            {/* Gemini */}
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-black bg-violet-600 text-white"
                  aria-hidden="true"
                >
                  G
                </span>
                <h3 className="text-sm font-bold text-violet-900">Gemini</h3>
                <span className="ml-auto inline-flex items-center rounded-full bg-violet-100 text-violet-700 border border-violet-200 px-1.5 py-0.5 text-xs font-semibold">
                  모든 업종
                </span>
              </div>
              <ul className="space-y-0.5 text-sm text-slate-600 leading-snug">
                <li>• Google 데이터 기반 (Gemini Flash)</li>
                <li>• 100회 샘플링 → 노출 빈도 측정</li>
                <li>• 웹 구조화·위치 정보 중요</li>
              </ul>
            </div>
            {/* Google AI */}
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-black bg-orange-500 text-white"
                  aria-hidden="true"
                >
                  O
                </span>
                <h3 className="text-sm font-bold text-orange-900">Google AI</h3>
                <span className="ml-auto inline-flex items-center rounded-full bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 text-xs font-semibold">
                  모든 업종
                </span>
              </div>
              <ul className="space-y-0.5 text-sm text-slate-600 leading-snug">
                <li>• Google AI Overview (SGE)</li>
                <li>• 한국 내 노출 빈도 증가 중</li>
                <li>• 구조화 데이터(Schema.org) 핵심</li>
              </ul>
              <p className="mt-2 text-xs text-orange-600 font-medium">Pro 이상 스캔에서 측정</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <Link
            href="/guide/ai-info-tab"
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-white hover:bg-blue-50 text-blue-700 text-sm md:text-base font-semibold px-3 py-2 transition-colors"
          >
            AI 브리핑 5단계 가이드 →
          </Link>
          <Link
            href="/guide/ai-tab"
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-700 text-sm md:text-base font-semibold px-3 py-2 transition-colors"
          >
            AI탭 5항목 가이드 →
          </Link>
        </div>

        {/* 채널별 측정 원리 — GlobalAiFocusCard 미표시 업종(global < 0.65)에만 노출 */}
        {globalWeight !== undefined && globalWeight < 0.65 && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">
              채널별 측정 원리
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/30 p-3">
                <p className="font-semibold text-emerald-900 dark:text-emerald-100">네이버 AI 브리핑·AI탭</p>
                <p className="text-emerald-800 dark:text-emerald-300 leading-snug mt-1">
                  실시간 검색 결과 + 스마트플레이스 신호. 사진·예약·리뷰가 핵심.
                </p>
              </div>
              <div className="rounded-lg bg-violet-50 dark:bg-violet-900/30 p-3">
                <p className="font-semibold text-violet-900 dark:text-violet-100">ChatGPT·Gemini</p>
                <p className="text-violet-800 dark:text-violet-300 leading-snug mt-1">
                  학습 데이터·웹 검색 기반. 블로그·후기·구조화 데이터가 핵심.
                </p>
              </div>
            </div>
          </div>
        )}

        <p className="mt-3 text-sm text-gray-500 leading-snug break-keep">
          AI 브리핑·AI탭 노출은 네이버 알고리즘 기준이며 보장되지 않습니다. 측정 시점·기기·로그인 상태에 따라 달라질 수 있습니다.
        </p>
      </div>
    </section>
  );
}
