"use client";

/**
 * 결과 종합 결론 히어로 — demo·trial 공용
 *
 * components/dashboard/DashboardHeroCard.tsx 의 마크업(128–206행)을 구조 복제한 것.
 * 대시보드 컴포넌트를 import하지 않고 동일 레이아웃을 재현해 무료(demo)·비로그인(trial)
 * 결과 화면을 구독자 대시보드와 같은 첫인상으로 맞춘다.
 *
 * 점수 숫자는 표시하지 않는다(텍스트 레이블 전용). 색·문구는 lib/scoreLabels.ts 단일 소스.
 */

import { getStageView, type ChannelTile } from "@/lib/scoreLabels";

interface ResultSummaryHeroProps {
  /** 성장단계 산출 점수 (track1 기준 권장). 숫자 자체는 노출되지 않음 */
  stageScore: number;
  inactive?: boolean;
  isFranchise?: boolean;
  /** 채널 그리드 상단 라벨 — 기본 "네이버 AI 현황" */
  groupLabel?: string;
  /** 실측근거 한 줄 (예: "경쟁 5곳 중 4위 · 키워드 2개 보강 필요") */
  evidenceText?: string | null;
  /** 네이버 3채널 타일 (lib/scoreLabels 빌더로 구성) */
  tiles: ChannelTile[];
  /** 오늘 할 일 CTA */
  todayAction?: string | null;
  todayActionLink?: string;
}

export default function ResultSummaryHero({
  stageScore,
  inactive = false,
  isFranchise = false,
  groupLabel,
  evidenceText,
  tiles,
  todayAction,
  todayActionLink,
}: ResultSummaryHeroProps) {
  const stage = getStageView(stageScore, { inactive, isFranchise });
  const isInactiveOrFranchise = inactive || isFranchise;

  return (
    <div className={`bg-white rounded-xl border-2 shadow-md overflow-hidden ${stage.cardBorder}`}>

      {/* ── 종합 상태 헤더 ── */}
      <div className={`px-5 pt-4 pb-4 border-b border-gray-100 ${stage.bg}`}>
        <div className="min-w-0">
          <p className={`text-xl font-black leading-tight break-keep ${stage.labelColor}`}>{stage.label}</p>
          {stage.sub && (
            <p className="text-sm font-semibold text-green-700 mt-1 break-keep">{stage.sub}</p>
          )}
          {evidenceText && (
            <p className="text-sm font-bold text-gray-800 mt-1 break-keep">{evidenceText}</p>
          )}
        </div>
      </div>

      {/* ── 네이버 AI 채널 (소상공인 핵심) ── */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-1.5 mb-3">
          <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" aria-hidden="true" />
          <p className="text-sm font-bold text-gray-700">{groupLabel ?? (isInactiveOrFranchise ? "네이버 노출 현황" : "네이버 AI 현황")}</p>
          <span className="ml-1 text-xs text-gray-400 hidden sm:inline">소상공인 핵심 채널</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {tiles.map((card) => (
            <div
              key={card.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm px-2 py-3 flex flex-col items-center gap-1.5 text-center"
            >
              <span className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${card.iconClass}`}>
                {card.icon}
              </span>
              <div>
                <p className="text-sm font-medium text-gray-500 leading-tight break-keep">{card.platform}</p>
                <p className={`text-sm font-bold mt-0.5 leading-tight ${card.statusClass}`}>{card.status}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-tight break-keep hidden sm:block">{card.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 오늘 할 일 요약 CTA ── */}
      {todayAction && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          <a
            href={todayActionLink ?? "/trial"}
            className="flex items-center justify-between gap-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl px-4 py-3 transition-colors group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-rose-500 text-base shrink-0">↳</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-rose-600 leading-tight">지금 할 일</p>
                <p className="text-sm font-semibold text-gray-800 leading-snug break-keep line-clamp-2 mt-0.5">{todayAction}</p>
              </div>
            </div>
            <span className="text-sm font-bold text-rose-500 group-hover:text-rose-700 shrink-0 whitespace-nowrap">실행 →</span>
          </a>
        </div>
      )}
    </div>
  );
}
