"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import DailyMissionCard from "@/components/dashboard/DailyMissionCard";
import Day7ActionCard from "@/components/dashboard/Day7ActionCard";
import ScoreAttributionCard from "@/components/dashboard/ScoreAttributionCard";
import MonthlyChecklistCard from "@/components/dashboard/MonthlyChecklistCard";
import DeliveryRecommendCard from "@/components/dashboard/DeliveryRecommendCard";
import Link from "next/link";
import { Calendar, Target, TrendingUp, ListChecks, Zap } from "lucide-react";

interface Dimension {
  dimension_key: string;
  dimension_label: string;
  current_score: number;
  max_score: number;
  gap_to_top: number;
  gap_reason: string;
  priority: number;
}

interface Props {
  bizId: string;
  accessToken: string;
  hasLatestScan: boolean;
  userCreatedAt: string | null;
  dimensions?: Dimension[];
  todayTasks: { no: number; title: string; desc: string; time: string; link: string }[];
  actionCopyText: string | null;
  topMissingKeyword: string | null;
  unifiedScore?: number | null;
  isSmartPlace?: boolean;
  plan?: string;
  /** INACTIVE 업종 — 오늘 미션에서 글로벌 채널 후순위(네이버 quick-win 우선) */
  deprioritizeGlobal?: boolean;
  /** Basic 무료 체험 사용자 — 가이드 잠금 처리 */
  isTrialUser?: boolean;
}

/**
 * 액션 카드 우선순위 계층 (4단계):
 *   ① 오늘 (DailyMissionCard) — 시급 강조 (rose/orange 톤)
 *   ② 이번 주 (Day7ActionCard) — 단기 (blue 톤)
 *   ③ 이번 달 (MonthlyChecklistCard) — 장기 (green 톤) — 기본 접힘
 *   ④ 점수 변화 회고 (ScoreAttributionCard) — 분석 (slate 톤) — 기본 접힘
 *
 * ①, ②는 항상 노출. ③, ④, 대행 추천은 "더 보기" 토글 뒤에 배치.
 */

interface ZoneHeaderProps {
  step: 1 | 2 | 3 | 4;
  icon: React.ReactNode;
  label: string;
  description: string;
  accent: string; // 좌측 컬러바 색상 (bg-*)
  badgeBg: string;
  badgeText: string;
}

function ZoneHeader({ step, icon, label, description, accent, badgeBg, badgeText }: ZoneHeaderProps) {
  return (
    <div className="flex items-start gap-3 mt-6 mb-2 first:mt-0">
      <div className={`w-1 self-stretch rounded-full ${accent} shrink-0`} aria-hidden="true" />
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 ${badgeBg} ${badgeText} text-sm font-bold px-2.5 py-1 rounded-full`}>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/70 text-current text-sm">
              {step}
            </span>
            {icon}
            <span>{label}</span>
          </span>
        </div>
        <p className="text-sm text-gray-600 leading-snug">{description}</p>
      </div>
    </div>
  );
}

export default function DashboardActionZone({
  bizId,
  accessToken,
  hasLatestScan,
  userCreatedAt,
  dimensions,
  todayTasks,
  actionCopyText,
  topMissingKeyword,
  unifiedScore,
  isSmartPlace = false,
  plan = "free",
  deprioritizeGlobal = false,
  isTrialUser = false,
}: Props) {
  const [showMore, setShowMore] = useState(false);

  // 앵커 id는 외부 CollapseSectionWrapper(id="section-action")가 제공 — 중복 id 방지로 여기선 미부착
  return (
    <section aria-label="액션 가이드" className="flex flex-col gap-3 pb-36 md:pb-0">
      {/* 체험 사용자 가이드 잠금 카드 */}
      {isTrialUser && (
        <div className="rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 px-4 py-4 mb-2">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-lg">🔒</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 leading-snug">맞춤 AI 개선 가이드가 준비됐습니다</p>
              <p className="text-sm text-gray-500 mt-1 leading-snug">
                이번 스캔 결과를 바탕으로 네이버 AI 브리핑 노출을 높이는<br />
                3가지 우선 개선 항목이 생성됐습니다.
              </p>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-1.5 mt-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                Basic 구독으로 가이드 확인 →
              </Link>
              <p className="text-xs text-gray-500 mt-1.5">첫 달 5,950원 · 이후 11,900원/월</p>
            </div>
          </div>
        </div>
      )}

      {/* ① 오늘 — 시급 */}
      <ZoneHeader
        step={1}
        icon={<Target className="w-3.5 h-3.5" />}
        label="오늘 할 일"
        description="가장 시급한 1개 미션 — 지금 바로 실행"
        accent="bg-rose-500"
        badgeBg="bg-rose-100"
        badgeText="text-rose-800"
      />
      {hasLatestScan && accessToken && !isTrialUser ? (
        <DailyMissionCard
          bizId={bizId}
          token={accessToken}
          initialDimensions={dimensions}
          todayTasks={todayTasks}
          actionCopyText={actionCopyText}
          topMissingKeyword={topMissingKeyword}
          deprioritizeGlobal={deprioritizeGlobal}
        />
      ) : isTrialUser ? null : (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-rose-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 leading-snug">
              첫 스캔 후 AI 노출 개선 미션이 표시됩니다
            </p>
            <p className="text-sm text-gray-500 mt-0.5">스캔하면 경쟁 가게 대비 부족한 항목부터 안내합니다</p>
          </div>
          <Link
            href="/scan"
            className="shrink-0 text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 px-3 py-1.5 rounded-lg"
          >
            스캔하기
          </Link>
        </div>
      )}

      {/* ② 이번 주 — 단기 */}
      <ZoneHeader
        step={2}
        icon={<Calendar className="w-3.5 h-3.5" />}
        label="이번 주 액션"
        description="이번 주 네이버 AI 노출을 높이는 실행 항목"
        accent="bg-blue-500"
        badgeBg="bg-blue-100"
        badgeText="text-blue-800"
      />
      <Day7ActionCard bizId={bizId} userCreatedAt={userCreatedAt} />

      {/* ③, ④, 대행 추천 — 기본 접힘 */}
      {!showMore ? (
        <button
          onClick={() => setShowMore(true)}
          aria-expanded={false}
          className="w-full flex items-center justify-center gap-1 py-2 text-sm text-gray-500 hover:text-gray-600 transition-colors"
        >
          <ChevronDown className="w-4 h-4" />
          이달 체크리스트 · 행동 효과 · 대행 추천 보기
        </button>
      ) : (
        <>
          {/* ③ 이번 달 — 장기 체크리스트 */}
          {accessToken && (
            <>
              <ZoneHeader
                step={3}
                icon={<ListChecks className="w-3.5 h-3.5" />}
                label="이달의 체크리스트"
                description="한 달 동안 꾸준히 달성하는 5개 항목"
                accent="bg-emerald-500"
                badgeBg="bg-emerald-100"
                badgeText="text-emerald-800"
              />
              <MonthlyChecklistCard bizId={bizId} authToken={accessToken} />
            </>
          )}

          {/* ④ 점수 변화 회고 — 행동 효과 확인 (Basic+, 장기 행동 목록 이후) */}
          {hasLatestScan && accessToken && plan && plan !== "free" && (
            <>
              <ZoneHeader
                step={4}
                icon={<TrendingUp className="w-3.5 h-3.5" />}
                label="내 행동의 효과"
                description="지난 행동 후 노출 변화 — 효과가 큰 행동 우선"
                accent="bg-slate-500"
                badgeBg="bg-slate-100"
                badgeText="text-slate-800"
              />
              <ScoreAttributionCard bizId={bizId} authToken={accessToken} />
            </>
          )}

          {/* 대행 서비스 추천 카드 — 스코어가 있을 때 하단 */}
          {hasLatestScan && unifiedScore !== null && unifiedScore !== undefined && (
            <DeliveryRecommendCard
              score={unifiedScore}
              isSmartPlace={isSmartPlace}
            />
          )}
        </>
      )}
    </section>
  );
}
