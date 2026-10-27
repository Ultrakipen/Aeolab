"use client";

import DashboardHeroCard from "@/components/dashboard/DashboardHeroCard";
import { isNaverUnmeasured, type LastGoodNaver } from "@/lib/naverMeasure";
import { getKeywordRankState } from "@/lib/keywordExposure";

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
  /** 이번 네이버 측정이 실패했을 때 보여줄 직전 성공 측정 (30일 이내, 없으면 null) */
  lastGoodNaver?: LastGoodNaver | null;
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
  lastGoodNaver,
}: Props) {
  const track1ScoreForHero = (latestScan?.track1_score as number | null) ?? undefined;

  const naverResult = latestScan?.naver_result ?? null;
  const naverInBriefing = naverResult?.in_briefing ?? false;
  // 캡차뿐 아니라 접속 실패·대기열 초과·일일 상한 등 "측정이 안 된" 모든 경우 — 미노출로 보이면 안 된다
  const naverCaptchaBlocked = isNaverUnmeasured(naverResult);
  const latestAdOnly = naverResult?.ad_only ?? false;
  const keywordRank = getKeywordRankState(latestScan?.keyword_ranks, business.name, latestScan?.scanned_at);

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
            // 오늘의 할 일은 근거가 있는 항목(가이드·점수 구성)만 — 업종 표준 키워드 "누락"은 근거가 약해 미션으로 쓰지 않는다
            todayAction={todayTasks?.[0]?.desc ?? null}
            todayActionLink="#section-action"
            lastScannedLabel={lastScannedLabel}
            scannedAt={latestScan?.scanned_at ?? null}
            naverInBriefing={naverInBriefing}
            naverCaptchaBlocked={naverCaptchaBlocked}
            lastGoodNaver={lastGoodNaver ?? null}
            keywordRank={keywordRank}
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
