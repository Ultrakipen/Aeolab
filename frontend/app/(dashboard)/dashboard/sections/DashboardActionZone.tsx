import DailyMissionCard from "@/components/dashboard/DailyMissionCard";
import Day7ActionCard from "@/components/dashboard/Day7ActionCard";
import ScoreAttributionCard from "@/components/dashboard/ScoreAttributionCard";
import MonthlyChecklistCard from "@/components/dashboard/MonthlyChecklistCard";
import SeasonalKeywordBanner from "@/components/dashboard/SeasonalKeywordBanner";
import DeliveryRecommendCard from "@/components/dashboard/DeliveryRecommendCard";
import UpgradeNudgeCard from "@/components/dashboard/UpgradeNudgeCard";
import { Calendar, Target, TrendingUp, ListChecks } from "lucide-react";

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
}

/**
 * 액션 카드 우선순위 계층 (4단계):
 *   ① 오늘 (DailyMissionCard) — 시급 강조 (rose/orange 톤)
 *   ② 이번 주 (Day7ActionCard) — 단기 (blue 톤)
 *   ③ 점수 변화 회고 (ScoreAttributionCard) — 분석 (slate 톤)
 *   ④ 이번 달 (MonthlyChecklistCard) — 장기 (green 톤)
 *
 * 각 그룹에 헤더 + 좌측 컬러바로 시각적 우선순위 명확화.
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
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/70 text-current text-xs">
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
}: Props) {
  return (
    <section aria-label="액션 가이드" className="flex flex-col gap-3">
      {/* 무료 플랜 업그레이드 유도 — 최상단 */}
      <UpgradeNudgeCard plan={plan} hasLatestScan={hasLatestScan} />

      {/* 시즌 키워드 배너 */}
      <SeasonalKeywordBanner />

      {/* ① 오늘 — 시급 */}
      {hasLatestScan && accessToken && (
        <>
          <ZoneHeader
            step={1}
            icon={<Target className="w-3.5 h-3.5" />}
            label="오늘 할 일"
            description="가장 시급한 1개 미션 — 지금 바로 실행"
            accent="bg-rose-500"
            badgeBg="bg-rose-100"
            badgeText="text-rose-800"
          />
          <DailyMissionCard
            bizId={bizId}
            token={accessToken}
            initialDimensions={dimensions}
            todayTasks={todayTasks}
            actionCopyText={actionCopyText}
            topMissingKeyword={topMissingKeyword}
          />
        </>
      )}

      {/* ② 이번 주 — 단기 */}
      <ZoneHeader
        step={2}
        icon={<Calendar className="w-3.5 h-3.5" />}
        label="이번 주 액션"
        description="가입 후 7일 이내는 환영 가이드 · 이후는 주간 권장"
        accent="bg-blue-500"
        badgeBg="bg-blue-100"
        badgeText="text-blue-800"
      />
      <Day7ActionCard bizId={bizId} userCreatedAt={userCreatedAt} />

      {/* ③ 점수 변화 회고 — 분석 */}
      {hasLatestScan && accessToken && (
        <>
          <ZoneHeader
            step={3}
            icon={<TrendingUp className="w-3.5 h-3.5" />}
            label="내 행동의 효과"
            description="지난 행동 후 점수 변화 — 효과가 큰 행동 우선"
            accent="bg-slate-500"
            badgeBg="bg-slate-100"
            badgeText="text-slate-800"
          />
          <ScoreAttributionCard bizId={bizId} authToken={accessToken} />
        </>
      )}

      {/* ④ 이번 달 — 장기 체크리스트 */}
      {accessToken && (
        <>
          <ZoneHeader
            step={4}
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

      {/* 대행 서비스 추천 카드 — 스코어가 있을 때 하단 */}
      {hasLatestScan && unifiedScore !== null && unifiedScore !== undefined && (
        <DeliveryRecommendCard
          score={unifiedScore}
          isSmartPlace={isSmartPlace}
        />
      )}
    </section>
  );
}
