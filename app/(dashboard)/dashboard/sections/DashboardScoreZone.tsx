import DashboardHeroCard from "@/components/dashboard/DashboardHeroCard";
import KeywordRankCard from "@/components/dashboard/KeywordRankCard";
import { IneligibleBusinessNotice } from "@/components/dashboard/IneligibleBusinessNotice";
import { ExpectationBanner } from "@/components/dashboard/ExpectationBanner";
import { CATEGORY_LABEL } from "@/lib/categories";
import { getUserGroup } from "@/lib/userGroup";

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
  } | null;
  chatgpt_result?: { mentioned?: boolean } | null;
  keyword_ranks?: Record<string, unknown> | null;
  track1_score?: number | null;
}

interface Props {
  business: BusinessShape;
  latestScan: ScanShape | null | undefined;
  briefingEligibility: "active" | "likely" | "inactive";
  isFranchise: boolean;
  unifiedScore: number;
  scoreChangeDiff: number | null;
  myRankInList: number;
  totalCompetitors: number;
  topMissingKeywords: string[];
  todayTasks: { no: number; title: string; desc: string; time: string; link: string }[];
  gapCloseable: number | null;
  recentActionType: string | null;
  recentScoreGain: number | null;
  userCreatedAt?: string | null;
  lastScannedLabel?: string | null;
}

export default function DashboardScoreZone({
  business,
  latestScan,
  briefingEligibility,
  isFranchise,
  unifiedScore,
  scoreChangeDiff,
  myRankInList,
  totalCompetitors,
  topMissingKeywords,
  todayTasks,
  gapCloseable,
  recentActionType,
  recentScoreGain,
  userCreatedAt,
  lastScannedLabel,
}: Props) {
  const rawGroup = getUserGroup(business.category ?? "", isFranchise);
  const userGroup: "ACTIVE" | "LIKELY" | "INACTIVE" = rawGroup === "franchise" ? "INACTIVE" : rawGroup;
  const track1ScoreForHero = (latestScan?.track1_score as number | null) ?? undefined;

  return (
    <>
      {/* 기대치 안내 배너 — 최초 1회만 표시 */}
      <ExpectationBanner />

      {/* Hero 카드 — 스캔 결과 있을 때만 표시 */}
      {latestScan && (
        <DashboardHeroCard
          businessName={business.name}
          unifiedScore={unifiedScore}
          track1Score={track1ScoreForHero}
          scoreChangeDiff={scoreChangeDiff}
          naverInBriefing={!!latestScan.naver_result?.in_briefing}
          naverCaptchaBlocked={
            latestScan.naver_result?.captcha_detected === true ||
            latestScan.naver_result?.error === "captcha_or_blocked"
          }
          myRankInList={myRankInList}
          totalCompetitors={totalCompetitors}
          topMissingKeywordCount={topMissingKeywords.length}
          topMissingKeyword={topMissingKeywords[0] ?? null}
          todayAction={
            todayTasks?.[0]?.desc ??
            (topMissingKeywords[0] ? `'${topMissingKeywords[0]}' 키워드를 소개글·소식에 추가` : null)
          }
          todayActionLink="/guide"
          estimatedGain={null}
          recentActionLabel={recentActionType}
          recentActionScoreGain={recentScoreGain}
          eligibility={briefingEligibility}
          lastScannedLabel={lastScannedLabel}
        />
      )}

      {/* 키워드 검색 노출 카드 */}
      <KeywordRankCard
        bizId={business.id}
        keywords={business.keywords ?? []}
        initialKeywordRanks={(latestScan?.keyword_ranks as Record<string, unknown> | null) ?? null}
        userGroup={userGroup}
        region={business.region}
      />

      {/* AI 브리핑 비대상 업종 안내 (프랜차이즈 포함) */}
      {briefingEligibility !== "active" && business.category && (
        <IneligibleBusinessNotice
          category={business.category}
          categoryLabel={CATEGORY_LABEL[business.category] ?? business.category}
          eligibility={briefingEligibility}
          isFranchise={isFranchise}
        />
      )}
    </>
  );
}
