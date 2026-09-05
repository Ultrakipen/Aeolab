"use client";

import Link from "next/link";
import { Sparkles, AlertTriangle, Search } from "lucide-react";

interface Props {
  /** 업종의 글로벌 AI 비중 (0~1). DUAL_TRACK_RATIO[category].global 기준 */
  globalWeight: number;
  /** 사용자 업종 라벨 (예: "법무·세무", "쇼핑·이커머스") */
  categoryLabel?: string;
  /** 사용자 업종 코드 — 가이드 링크 분기용 */
  category?: string;
}

const GLOBAL_FOCUS_THRESHOLD = 0.65;

/**
 * 글로벌 AI 주전장 업종 안내 카드
 *
 * 핵심 목적: 네이버 의존도 낮은 업종(legal·shopping·accounting·design 등)
 * 사용자가 "왜 ChatGPT·Gemini 점수가 더 중요한가"를 즉시 이해하도록 명시.
 *
 * 표시 조건: globalWeight ≥ 0.65 (DUAL_TRACK_RATIO 기준, 2026-09-03 재확인)
 * - legal 0.80, shopping 0.90, accounting 0.70, design 0.65
 * - academy 0.60 등 0.65 미만 업종은 NaverAiPathwayCard만으로 충분
 */
export default function GlobalAiFocusCard({ globalWeight, categoryLabel, category }: Props) {
  if (globalWeight < GLOBAL_FOCUS_THRESHOLD) return null;

  const naverPct = Math.round((1 - globalWeight) * 100);
  const globalPct = Math.round(globalWeight * 100);

  return (
    <section
      aria-labelledby="global-ai-focus-title"
      className="rounded-xl border border-emerald-200 dark:border-emerald-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden"
    >
      <div className="flex items-center gap-2 px-4 py-3 md:px-6 md:py-4 border-b border-emerald-100 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30">
        <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
        <h2
          id="global-ai-focus-title"
          className="text-base md:text-lg font-bold text-emerald-900 dark:text-emerald-100 break-keep"
        >
          이 업종은 ChatGPT·Gemini가 주전장입니다
        </h2>
      </div>

      <div className="p-4 md:p-6">
        <p className="text-sm md:text-base text-gray-700 dark:text-gray-300 mb-4 leading-relaxed break-keep">
          {categoryLabel ? <strong>{categoryLabel}</strong> : "이 업종은"} 의 AI 검색 비중은
          {" "}
          <span className="inline-flex items-baseline gap-1 px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 font-bold">
            글로벌 AI {globalPct}%
          </span>
          {" "}
          <span className="text-sm text-gray-600 dark:text-gray-600">vs 네이버 {naverPct}%</span> 입니다.
          ChatGPT·Gemini·Google AI 노출에 우선 투자하는 것이 효율적입니다.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          {/* ChatGPT */}
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-md text-sm font-black bg-emerald-700 text-white">
                G
              </span>
              <h3 className="text-sm md:text-base font-bold text-emerald-900 dark:text-emerald-100">
                ChatGPT
              </h3>
            </div>
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100 mb-1.5 break-keep">
              학습 데이터 기반 — 권위·인용도 핵심
            </p>
            <ul className="space-y-1 text-sm text-slate-700 dark:text-gray-300 leading-snug">
              <li>• 1년 이상 누적된 웹 콘텐츠 인식</li>
              <li>• 블로그·뉴스·전문지 인용이 중요</li>
              <li>• 모델 업데이트 주기: 수개월~1년</li>
            </ul>
          </div>

          {/* Gemini */}
          <div className="rounded-xl border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-md text-sm font-black bg-blue-600 text-white">
                G
              </span>
              <h3 className="text-sm md:text-base font-bold text-blue-900 dark:text-blue-100">
                Gemini
              </h3>
            </div>
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1.5 break-keep">
              Google 실시간 검색 일부 반영
            </p>
            <ul className="space-y-1 text-sm text-slate-700 dark:text-gray-300 leading-snug">
              <li>• 최근 웹 검색 결과 부분 활용</li>
              <li>• Google 비즈니스 프로필 필수</li>
              <li>• Open Graph·구조화 데이터 우선</li>
            </ul>
          </div>

          {/* Google AI Overview */}
          <div className="rounded-xl border border-violet-200 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-md text-sm font-black bg-violet-600 text-white">
                A
              </span>
              <h3 className="text-sm md:text-base font-bold text-violet-900 dark:text-violet-100">
                Google AI Overview
              </h3>
            </div>
            <p className="text-sm font-semibold text-violet-900 dark:text-violet-100 mb-1.5 break-keep">
              검색 결과 상단 AI 요약 박스
            </p>
            <ul className="space-y-1 text-sm text-slate-700 dark:text-gray-300 leading-snug">
              <li>• SGE 기반 자연 검색 노출</li>
              <li>• 독립 웹사이트 SEO 핵심</li>
              <li>• AI 인식 정보 코드 등록 필수</li>
            </ul>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <Link
            href="/schema"
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-600 bg-white dark:bg-gray-700 hover:bg-emerald-50 dark:hover:bg-gray-600 text-emerald-700 dark:text-emerald-300 text-sm md:text-base font-semibold px-3 py-2 transition-colors"
          >
            AI 인식 코드 자동 생성 →
          </Link>
          <a
            href="https://business.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-violet-300 dark:border-violet-600 bg-white dark:bg-gray-700 hover:bg-violet-50 dark:hover:bg-gray-600 text-violet-700 dark:text-violet-300 text-sm md:text-base font-semibold px-3 py-2 transition-colors"
          >
            Google 비즈니스 등록 (무료) →
          </a>
        </div>

        {/* 네이버도 놓치지 마세요 */}
        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 p-3">
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-1.5">
            <Search className="w-4 h-4 shrink-0" aria-hidden="true" />네이버도 놓치지 마세요
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-blue-800 dark:text-blue-200">
            <div className="flex items-start gap-1.5">
              <span className="shrink-0 mt-0.5">•</span>
              <span>
                <strong>네이버 스마트플레이스 SEO</strong> — 리뷰·키워드 최적화로
                네이버 일반 검색 상위 노출 가능
              </span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="shrink-0 mt-0.5">•</span>
              <span>
                <strong>네이버 AI탭</strong> (정식 출시) — 업종 제한 없이 노출 가능.
                소개글 200자·사진 10장·블로그 후기가 핵심
              </span>
            </div>
          </div>
          <div className="mt-2">
            <Link
              href="/guide/ai-tab"
              className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:underline"
            >
              네이버 AI탭 준비 가이드 →
            </Link>
          </div>
        </div>

        <div className="mt-3 flex items-start gap-1.5 text-sm text-gray-600 dark:text-gray-600">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
          <p className="leading-snug break-keep">
            ChatGPT 측정은 AI 학습 데이터 기반이며 실시간 웹 검색 결과와 다를 수 있습니다.
            측정 시점·기기·로그인 상태에 따라 결과가 달라질 수 있습니다.
            업종 비중은 AEOlab 시장 조사 데이터 기반이며 사업장별 차이가 있을 수 있습니다.
            {category === "legal" || category === "accounting"
              ? " 전문직(법무·세무) 업종 특성상 권위 인용·전문지 게재가 노출 향상에 효과적입니다."
              : category === "shopping"
              ? " 온라인 쇼핑 업종은 상품 페이지 구조화 데이터·리뷰 마크업이 핵심입니다."
              : ""}
          </p>
        </div>
      </div>
    </section>
  );
}
