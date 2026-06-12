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
  chatgpt_result?: { mentioned?: boolean; exposure_freq?: number; sample_size?: number } | null;
  gemini_result?: { exposure_freq?: number; sample_size?: number } | null;
  google_result?: { mentioned?: boolean; exposure_freq?: number; sample_size?: number } | null;
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
  topMissingKeywords: string[];
  todayTasks: { no: number; title: string; desc: string; time: string; link: string }[];
  lastScannedLabel?: string | null;
  myRankInList?: number;
  totalCompetitors?: number;
  benchmarkAvg?: number;
  showStaleRescan?: boolean;
}

export default function DashboardScoreZone({
  business,
  latestScan,
  briefingEligibility,
  unifiedScore,
  scoreChangeDiff,
  topMissingKeywords,
  todayTasks,
  lastScannedLabel,
  myRankInList,
  totalCompetitors,
  benchmarkAvg,
  showStaleRescan,
}: Props) {
  const track1ScoreForHero = (latestScan?.track1_score as number | null) ?? undefined;

  const naverResult = latestScan?.naver_result ?? null;
  const naverInBriefing = naverResult?.in_briefing ?? false;
  const naverCaptchaBlocked =
    naverResult?.captcha_detected === true || naverResult?.error === "captcha_or_blocked";
  const latestAdOnly = naverResult?.ad_only ?? false;

  /* ── HeroCard 채널 데이터 ── */
  const naverAiTabVisible = latestScan?.naver_ai_tab_visible ?? null;

  return (
    <>
      {latestScan && (
        <div id="section-score">
          <DashboardHeroCard
            unifiedScore={unifiedScore}
            track1Score={track1ScoreForHero}
            scoreChangeDiff={scoreChangeDiff}
            topMissingKeywordCount={topMissingKeywords.length}
            todayAction={
              todayTasks?.[0]?.desc ??
              (topMissingKeywords[0] ? `'${topMissingKeywords[0]}' 키워드를 소개글·소식에 추가` : null)
            }
            todayActionLink="#section-action"
            lastScannedLabel={lastScannedLabel}
            naverInBriefing={naverInBriefing}
            naverCaptchaBlocked={naverCaptchaBlocked}
            latestAdOnly={latestAdOnly}
            briefingEligibility={briefingEligibility}
            isFranchise={business.is_franchise}
            naverAiTabVisible={naverAiTabVisible ?? null}
            myRankInList={myRankInList}
            totalCompetitors={totalCompetitors}
            benchmarkAvg={benchmarkAvg}
            staleRescan={showStaleRescan}
          />
        </div>
      )}
    </>
  );
}
