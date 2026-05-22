import DashboardHeroCard from "@/components/dashboard/DashboardHeroCard";
import KeywordRankCard from "@/components/dashboard/KeywordRankCard";
import { IneligibleBusinessNotice } from "@/components/dashboard/IneligibleBusinessNotice";
import { CATEGORY_LABEL } from "@/lib/categories";
import { getBriefingEligibility, getUserGroup } from "@/lib/userGroup";

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
}: Props) {
  const daysSinceSignup = userCreatedAt
    ? Math.floor((Date.now() - new Date(userCreatedAt).getTime()) / 86_400_000)
    : null;
  const rawGroup = getUserGroup(business.category ?? "", isFranchise);
  const userGroup: "ACTIVE" | "LIKELY" | "INACTIVE" = rawGroup === "franchise" ? "INACTIVE" : rawGroup;

  return (
    <>
      {/* INACTIVE 업종 첫 7일 안내 배너 — 가입 7일 이내 신규 사용자 전용 */}
      {briefingEligibility === "inactive" && daysSinceSignup !== null && daysSinceSignup <= 7 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
          <span className="text-amber-500 text-base">💡</span>
          <p className="text-sm text-amber-800 break-keep">
            네이버 AI 브리핑은 음식점·카페 등 일부 업종만 해당되지만,{" "}
            <strong>AI탭(모든 업종 베타) + ChatGPT·Gemini 노출은 정상 측정 중</strong>입니다.
          </p>
        </div>
      )}

      {/* INACTIVE 업종 안내 배너 */}
      {briefingEligibility === "inactive" && (
        <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex-shrink-0 text-indigo-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-indigo-800">
                이 업종 · 네이버 AI 검색 노출 안내
              </p>
              <div className="mt-2 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-sm text-gray-700 flex-shrink-0">AI 브리핑</span>
                  <p className="text-sm text-indigo-700">음식점·카페·숙박 등 일부 업종만 해당 (이 업종은 아직 미대상)</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="inline-flex items-center rounded-full bg-indigo-600 px-2 py-0.5 text-sm text-white flex-shrink-0">AI탭 (신규)</span>
                  <p className="text-sm text-indigo-700">
                    <strong>모든 업종 노출 가능</strong> — 스마트플레이스 완성도·소개글·예약 연동이 핵심.
                    현재 네이버플러스 구독자 대상 베타, 상반기 전체 확대 예정.
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-3">
                <a href="/guide/ai-tab" className="text-sm text-indigo-600 underline hover:text-indigo-800 font-semibold">
                  AI탭 최적화 가이드 →
                </a>
                <a href="/guide/ai-info-tab" className="text-sm text-indigo-500 underline hover:text-indigo-700">
                  전체 AI 노출 가이드
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero 카드 — 스캔 결과 있을 때만 표시 */}
      {latestScan && (
        <DashboardHeroCard
          businessName={business.name}
          unifiedScore={unifiedScore}
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
            (topMissingKeywords[0] ? `'${topMissingKeywords[0]}' 키워드를 FAQ에 추가` : null)
          }
          todayActionLink="/guide"
          estimatedGain={gapCloseable !== null ? Math.round(gapCloseable * 0.3) : null}
          recentActionLabel={recentActionType}
          recentActionScoreGain={recentScoreGain}
          eligibility={briefingEligibility}
        />
      )}

      {/* 키워드 검색 노출 카드 */}
      <KeywordRankCard
        bizId={business.id}
        keywords={business.keywords ?? []}
        initialKeywordRanks={(latestScan?.keyword_ranks as Record<string, unknown> | null) ?? null}
        userGroup={userGroup}
      />

      {/* AI 브리핑 비대상 업종 안내 (프랜차이즈 포함) */}
      {business.category && getBriefingEligibility(business.category, isFranchise) !== "active" && (
        <IneligibleBusinessNotice
          category={business.category}
          categoryLabel={CATEGORY_LABEL[business.category] ?? business.category}
          eligibility={getBriefingEligibility(business.category, isFranchise)}
          isFranchise={isFranchise}
        />
      )}
    </>
  );
}
