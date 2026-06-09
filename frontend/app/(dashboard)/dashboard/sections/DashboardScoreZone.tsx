"use client";

import DashboardHeroCard from "@/components/dashboard/DashboardHeroCard";

interface BusinessShape {
  id: string;
  name: string;
  category: string;
  region: string;
  keywords?: string[];
  is_franchise?: boolean;
}

interface ScanShape {
  naver_result?: {
    in_briefing?: boolean;
    captcha_detected?: boolean;
    error?: string;
    ad_only?: boolean;
  } | null;
  chatgpt_result?: { mentioned?: boolean } | null;
  keyword_ranks?: Record<string, unknown> | null;
  track1_score?: number | null;
  naver_ai_tab_visible?: boolean | null;
}

interface Props {
  business: BusinessShape;
  latestScan: ScanShape | null | undefined;
  briefingEligibility: "active" | "likely" | "inactive";
  unifiedScore: number;
  scoreChangeDiff: number | null;
  myRankInList: number;
  totalCompetitors: number;
  topMissingKeywords: string[];
  todayTasks: { no: number; title: string; desc: string; time: string; link: string }[];
  recentActionType: string | null;
  recentScoreGain: number | null;
  lastScannedLabel?: string | null;
}

export default function DashboardScoreZone({
  business,
  latestScan,
  briefingEligibility,
  unifiedScore,
  scoreChangeDiff,
  myRankInList,
  totalCompetitors,
  topMissingKeywords,
  todayTasks,
  recentActionType,
  recentScoreGain,
  lastScannedLabel,
}: Props) {
  const track1ScoreForHero = (latestScan?.track1_score as number | null) ?? undefined;

  return (
    <>
      {/* Hero 카드 */}
      {latestScan && (
        <div id="section-score">
          <DashboardHeroCard
            businessName={business.name}
            unifiedScore={unifiedScore}
            track1Score={track1ScoreForHero}
            scoreChangeDiff={scoreChangeDiff}
            myRankInList={myRankInList}
            totalCompetitors={totalCompetitors}
            topMissingKeywordCount={topMissingKeywords.length}
            topMissingKeyword={topMissingKeywords[0] ?? null}
            todayAction={
              todayTasks?.[0]?.desc ??
              (topMissingKeywords[0] ? `'${topMissingKeywords[0]}' 키워드를 소개글·소식에 추가` : null)
            }
            todayActionLink="/guide"
            recentActionLabel={recentActionType}
            recentActionScoreGain={recentScoreGain}
            lastScannedLabel={lastScannedLabel}
          />
        </div>
      )}

    </>
  );
}
