"use client";

import DashboardHeroCard from "@/components/dashboard/DashboardHeroCard";
import { isNaverUnmeasured } from "@/lib/naverMeasure";
import { getFirstScreenKeywords } from "@/lib/keywordExposure";

interface BusinessShape {
  id: string;
  name: string;
  category: string;
  region: string;
  keywords?: string[];
  is_franchise?: boolean;
}

interface ScanShape {
  scanned_at?: string | null;
  naver_result?: {
    in_briefing?: boolean;
    captcha_detected?: boolean;
    error?: string;
    quota_skipped?: boolean;
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
  // 캡차뿐 아니라 접속 실패·대기열 초과·일일 상한 등 "측정이 안 된" 모든 경우 — 미노출로 보이면 안 된다
  const naverCaptchaBlocked = isNaverUnmeasured(naverResult);
  const latestAdOnly = naverResult?.ad_only ?? false;
  const firstScreenKeywords = getFirstScreenKeywords(
    latestScan?.keyword_ranks,
    business.name,
    latestScan?.scanned_at,
  );

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
            firstScreenKeywords={firstScreenKeywords}
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
