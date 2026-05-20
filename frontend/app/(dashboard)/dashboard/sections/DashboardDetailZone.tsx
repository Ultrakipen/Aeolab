import Link from "next/link";
import { Search, ChevronRight } from "lucide-react";
import DashboardAccordion from "../DashboardAccordion";
import Action7DayChart from "@/components/dashboard/Action7DayChart";
import DualTrackCard from "@/components/dashboard/DualTrackCard";
import { ResultTable } from "@/components/scan/ResultTable";
import { PlatformDistributionChart } from "@/components/dashboard/PlatformDistributionChart";
import { ChannelScoreCards } from "@/components/dashboard/ChannelScoreCards";
import { GlobalAIBanner } from "@/components/dashboard/GlobalAIBanner";
import { GlobalAIChecklist } from "@/components/dashboard/GlobalAIChecklist";
import KeywordTrendChart from "@/components/dashboard/KeywordTrendChart";
import AICitationCard from "@/components/dashboard/AICitationCard";
import ChatGPTDiffCard from "@/components/dashboard/ChatGPTDiffCard";
import { BriefingTimeline } from "@/components/dashboard/BriefingTimeline";
import { SentimentDashboard } from "@/components/dashboard/SentimentDashboard";
import { MentionContextSection } from "../MentionContextSection";
import ConditionSearchCard from "@/components/dashboard/ConditionSearchCard";
import AISearchScreenshotCard from "@/components/dashboard/AISearchScreenshotCard";
import { RankingBar } from "@/components/dashboard/RankingBar";
import { TrendLine } from "@/components/dashboard/TrendLine";
import CompetitorKeywordCompare from "@/components/dashboard/CompetitorKeywordCompare";
import CompetitorFAQCard from "@/components/dashboard/CompetitorFAQCard";
import AIDiagnosisCard from "@/components/dashboard/AIDiagnosisCard";
import ScoreEvidenceCard from "../ScoreEvidenceCard";
import SmartplaceAutoCheck from "@/components/dashboard/SmartplaceAutoCheck";
import KakaoChecklistCard from "@/components/dashboard/KakaoChecklistCard";
import { WebsiteCheckCard } from "@/components/dashboard/WebsiteCheckCard";
import ConversionGuideSection from "@/components/dashboard/ConversionGuideSection";
import ProUpgradePreview from "@/components/dashboard/ProUpgradePreview";
import { MultiBizTable } from "@/components/dashboard/MultiBizTable";
import { CATEGORY_LABEL } from "@/lib/categories";
import { calcScoreVariation } from "@/lib/scoreVariation";
import type { MissingItem } from "@/types/diagnosis";
import type { WebsiteCheckResult } from "@/types";

interface ActionLog {
  action_type: string;
  action_label: string;
  action_date: string;
  score_before: number | null;
  score_after: number | null;
}

interface HistoryItem {
  id: string;
  business_id: string;
  score_date: string;
  total_score: number;
  exposure_freq: number;
  unified_score?: number;
  track1_score?: number;
  track2_score?: number;
  context?: string;
  created_at?: string;
}

interface RankingItem {
  name: string;
  score: number;
  isMe?: boolean;
}

interface PlatformResult {
  mentioned: boolean;
  exposure_freq?: number;
  in_briefing?: boolean;
  in_ai_overview?: boolean;
  error?: string;
}

interface BlogContribution {
  active: boolean;
  postCount: number;
  keywordCoverage: number;
  analyzedAt?: string;
  blogUrl?: string;
}

interface SmartPlaceStatus {
  hasFaq: boolean;
  hasIntro: boolean;
  hasRecentPost: boolean;
  hasWebsite: boolean;
}

interface Props {
  business: {
    id: string;
    name: string;
    category: string;
    region: string;
    website_url?: string | null;
    keywords?: string[];
    review_count?: number;
    avg_rating?: number;
    naver_place_id?: string | null;
    naver_place_url?: string | null;
    google_place_id?: string | null;
    blog_url?: string | null;
    blog_analyzed_at?: string | null;
    blog_post_count?: number;
    blog_keyword_coverage?: number;
    is_franchise?: boolean;
  };
  latestScan: Record<string, unknown> | null | undefined;
  hasLatestScan: boolean;
  accessToken: string;
  plan: string;
  subscriptionPlan: string;
  briefingEligibility: "active" | "likely" | "inactive";
  isFranchise: boolean;
  track1Score: number;
  track2Score: number;
  naverWeight: number;
  globalWeight: number;
  unifiedScore: number;
  growthStage: string;
  growthStageLabel: string;
  isKeywordEstimated: boolean;
  topMissingKeywords: string[];
  benchmarkAvg?: number;
  smartPlaceStatus: SmartPlaceStatus;
  allPlatformResults: Record<string, PlatformResult>;
  naverChannelScore: number | null;
  globalChannelScore: number | null;
  kakaoResult: Record<string, unknown> | null;
  kakaoScore?: number;
  kakaoChecklist?: Record<string, boolean>;
  kakaoRegistered: boolean;
  websiteCheckResult: WebsiteCheckResult | null | undefined;
  history: HistoryItem[] | null;
  actionLogs: ActionLog[];
  rankingItems: RankingItem[];
  myRankInList: number;
  topCompetitor: RankingItem | null;
  competitorKeywordSources: Record<string, string[]>;
  missingItems: MissingItem[];
  aiExposureData?: {
    chatgptFreq?: number;
    chatgptSampleSize?: number;
    geminiFreq?: number;
    geminiSampleSize?: number;
  };
  blogContribution?: BlogContribution;
  scoreChangeDiff: number | null;
}

function iGa(name: string): string {
  const last = name[name.length - 1];
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return `${name}이(가)`;
  return (code - 0xac00) % 28 !== 0 ? `${name}이` : `${name}가`;
}

export default function DashboardDetailZone({
  business,
  latestScan,
  hasLatestScan,
  accessToken,
  plan,
  subscriptionPlan,
  briefingEligibility,
  isFranchise,
  track1Score,
  track2Score,
  naverWeight,
  globalWeight,
  unifiedScore,
  growthStage,
  growthStageLabel,
  isKeywordEstimated,
  topMissingKeywords,
  benchmarkAvg,
  smartPlaceStatus,
  allPlatformResults,
  naverChannelScore,
  globalChannelScore,
  kakaoResult,
  kakaoScore,
  kakaoChecklist,
  kakaoRegistered,
  websiteCheckResult,
  history,
  actionLogs,
  rankingItems,
  myRankInList,
  topCompetitor,
  competitorKeywordSources,
  missingItems,
  aiExposureData,
  blogContribution,
  scoreChangeDiff,
}: Props) {
  if (!hasLatestScan) {
    /* 스캔 없는 Empty State */
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
        <Search className="w-14 h-14 text-blue-300 mx-auto" strokeWidth={1} />
        <div>
          <p className="text-lg md:text-xl font-bold text-slate-800 mb-2">
            ChatGPT에게 &ldquo;{CATEGORY_LABEL[business.category] ?? business.category} 추천해줘&rdquo;라고 물어봤을 때
          </p>
          <p className="text-base md:text-lg font-bold text-blue-700 mb-4">
            {iGa(business.name)} 나오는지 아직 모릅니다.
          </p>
          <p className="text-sm md:text-base text-slate-500 max-w-md mx-auto leading-relaxed">
            지금 AI 스캔을 시작하면 네이버·ChatGPT·Google AI에서<br className="hidden md:block" />
            내 가게가 언급되는지 1분 안에 확인합니다.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-lg w-full">
          {[
            { name: "Gemini", note: "50회 측정" },
            { name: "ChatGPT", note: "50회 측정" },
            { name: "네이버 AI", note: "브리핑 포함" },
            { name: "Google AI", note: "AI Overview" },
          ].map((p) => (
            <div key={p.name} className="bg-gray-50 rounded-xl py-3 px-2 border border-gray-100 text-center">
              <div className="font-semibold text-gray-800 text-sm">{p.name}</div>
              <div className="text-gray-400 text-sm mt-0.5">{p.note}</div>
            </div>
          ))}
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-6 py-5 max-w-md w-full text-left">
          <p className="text-base font-semibold text-blue-800 mb-3">스캔 후 바로 확인할 수 있습니다</p>
          <ul className="space-y-2 text-base text-blue-700">
            <li>→ 네이버·카카오·ChatGPT 3채널에서 내 가게가 나오는지</li>
            <li>→ 네이버 AI 브리핑에 내 가게가 포함되는지</li>
            <li>→ 경쟁 가게와의 AI 노출 점수 비교</li>
            <li>→ 점수를 올리는 맞춤 개선 가이드</li>
          </ul>
        </div>
        <p className="text-base text-gray-500">
          상단 <strong className="text-gray-700">AI 스캔 시작</strong> 버튼을 눌러주세요 · 약 2~3분 소요
        </p>
      </div>
    );
  }

  // latestScan은 hasLatestScan=true 이후이므로 non-null 보장
  const scan = latestScan!;

  const naverResult = scan.naver_result as {
    in_briefing?: boolean;
    mentioned?: boolean;
    is_smart_place?: boolean;
    blog_mentions?: number;
    keyword_blog_comparison?: Array<{
      keyword: string;
      my_count: number;
      competitor_count: number;
      competitor_name?: string;
    }>;
    top_blogs?: Array<{
      title: string;
      link: string;
      description?: string;
      postdate?: string;
    }>;
  } | null;

  const chatgptResult = scan.chatgpt_result as {
    mentioned?: boolean;
    exposure_freq?: number;
    sample_size?: number;
  } | null;

  const geminiResult = scan.gemini_result as {
    mentioned?: boolean;
    exposure_freq?: number;
    sample_size?: number;
  } | null;

  const scoreBreakdown = scan.score_breakdown as Record<string, number> | null;
  const channelScores = (scan as Record<string, unknown> & { channel_scores?: { website_seo?: number } })
    ?.channel_scores;

  return (
    <DashboardAccordion
      tab1Content={
        <div className="space-y-5">
          {accessToken && (
            <Action7DayChart bizId={business.id} accessToken={accessToken} />
          )}
          <DualTrackCard
            track1Score={track1Score}
            track2Score={track2Score}
            naverWeight={naverWeight}
            globalWeight={globalWeight}
            unifiedScore={unifiedScore}
            category={business.category}
            growthStage={growthStage}
            growthStageLabel={growthStageLabel}
            isKeywordEstimated={isKeywordEstimated}
            topMissingKeywords={topMissingKeywords}
            benchmarkAvg={benchmarkAvg}
            smartPlaceStatus={smartPlaceStatus}
            hasRegisteredKeywords={!!business.keywords?.length}
            blogContribution={blogContribution}
            eligibility={briefingEligibility}
            aiExposureData={aiExposureData}
            bizId={business.id}
            token={accessToken ?? undefined}
          />
          {/* 점수 변동 폭 안내 — 실측 7일 이상 데이터 기반 (CLAUDE.md 원칙: 임의 수치 금지) */}
          {(() => {
            const variation = calcScoreVariation(history ?? []);
            if (variation.hasData) {
              return (
                <p className="text-sm text-gray-400 mt-1 px-1">
                  지난 30일 변동 폭: ±{Math.round((variation.range ?? 0) / 2)}점 (측정 조건 따라 자연 변동)
                </p>
              );
            }
            return (
              <p className="text-sm text-gray-400 mt-1 px-1">
                측정 시점·기기·로그인 상태에 따라 결과가 달라질 수 있습니다 (실측 데이터 축적 후 변동 폭 표시)
              </p>
            );
          })()}
          {Object.keys(allPlatformResults).length > 0 && (
            <ResultTable results={allPlatformResults} />
          )}
          {Object.keys(allPlatformResults).length > 0 && (
            <PlatformDistributionChart
              results={allPlatformResults}
              naverChannelScore={naverChannelScore ?? undefined}
              globalChannelScore={globalChannelScore ?? undefined}
            />
          )}
          <ChannelScoreCards
            naverScore={track1Score}
            globalScore={track2Score}
            isSmartPlace={!!(naverResult?.is_smart_place || business.naver_place_id)}
            isOnKakao={!!(kakaoResult as { is_on_kakao?: boolean } | null)?.is_on_kakao}
            kakaoRank={(kakaoResult as { my_rank?: number | null } | null)?.my_rank ?? null}
            naverMentioned={!!naverResult?.in_briefing}
            aiTabMentioned={undefined}
            chatgptMentioned={!!chatgptResult?.mentioned}
            hasWebsite={!!business.website_url}
            googlePlaceRegistered={!!business.google_place_id}
            naverWeight={hasLatestScan ? naverWeight : undefined}
          />
          <GlobalAIBanner
            globalScore={track2Score}
            hasWebsite={!!business.website_url}
            eligibility={briefingEligibility}
          />
          {briefingEligibility === "inactive" && (
            <GlobalAIChecklist
              hasWebsite={!!business.website_url}
              googlePlaceRegistered={!!business.google_place_id}
              websiteSeoScore={channelScores?.website_seo ?? 0}
              chatgptMentioned={!!chatgptResult?.mentioned}
              geminiMentioned={!!geminiResult?.mentioned}
              hasScanned={true}
            />
          )}
          {["basic", "startup", "pro", "biz"].includes(plan) && accessToken && (
            <KeywordTrendChart
              bizId={business.id}
              accessToken={accessToken}
              categoryKo={CATEGORY_LABEL[business.category] ?? business.category}
            />
          )}
          {["basic", "startup", "pro", "biz"].includes(plan) && accessToken && (
            <AICitationCard bizId={business.id} token={accessToken} />
          )}
          <ChatGPTDiffCard
            geminiCount={Number(geminiResult?.exposure_freq ?? 0)}
            geminiSampleSize={
              geminiResult?.sample_size !== undefined ? Number(geminiResult.sample_size) : undefined
            }
            chatgptCount={
              chatgptResult?.exposure_freq !== undefined ? Number(chatgptResult.exposure_freq) : undefined
            }
            chatgptSampleSize={
              chatgptResult?.sample_size !== undefined ? Number(chatgptResult.sample_size) : undefined
            }
            competitorCount={0}
            naverBriefing={!!naverResult?.in_briefing}
            topMissingKeywords={
              Array.isArray(scan.top_missing_keywords)
                ? (scan.top_missing_keywords as unknown[]).map(String)
                : []
            }
          />
          {history && history.length >= 2 && (
            <BriefingTimeline history={history} businessName={business.name} />
          )}
          {["basic", "startup", "pro", "biz"].includes(plan) && accessToken && (
            <SentimentDashboard bizId={business.id} token={accessToken} />
          )}
          {["basic", "startup", "pro", "biz"].includes(plan) && (
            <MentionContextSection
              bizId={business.id}
              token={accessToken}
              currentPlan={subscriptionPlan}
              isPro={["pro", "biz"].includes(plan)}
            />
          )}
          {accessToken && ["pro", "biz"].includes(plan) && (
            <ConditionSearchCard bizId={business.id} token={accessToken} isPro={true} />
          )}
          {["basic", "startup", "pro", "biz", "enterprise"].includes(plan) && accessToken && (
            <AISearchScreenshotCard bizId={business.id} plan={plan} authToken={accessToken} />
          )}
        </div>
      }
      tab2Content={
        <div className="space-y-5">
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900">경쟁사와 비교</h2>
              <Link href="/competitors" className="text-sm text-blue-600 font-medium flex items-center gap-1">
                전체 보기 <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            {rankingItems.length > 1 ? (
              <div className="space-y-4">
                <div
                  className={`rounded-xl p-4 text-center ${
                    myRankInList === 1
                      ? "bg-emerald-50 border border-emerald-200"
                      : "bg-amber-50 border border-amber-200"
                  }`}
                >
                  <p className="text-sm text-gray-500 mb-1">근처 {rankingItems.length}곳 중</p>
                  <p className={`text-4xl font-bold ${myRankInList === 1 ? "text-emerald-700" : "text-amber-700"}`}>
                    {myRankInList}위
                  </p>
                  {topCompetitor && myRankInList > 1 && (
                    <p className="text-sm text-gray-600 mt-1">
                      1위 {topCompetitor.name} 대비 {Math.ceil(topCompetitor.score - unifiedScore)}점 부족
                    </p>
                  )}
                </div>
                <RankingBar items={rankingItems} />
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-gray-500 mb-3">
                  경쟁 가게를 등록하면 AI 노출 점수를 비교할 수 있습니다
                </p>
                <Link
                  href="/competitors"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  경쟁사 등록하기 →
                </Link>
              </div>
            )}
          </div>
          {history && history.length > 0 && (
            <div className="bg-white rounded-xl border p-4">
              <h2 className="text-base font-bold text-gray-900 mb-3">점수 변화 추이</h2>
              <TrendLine data={history} actionLogs={actionLogs} />
            </div>
          )}
          <CompetitorKeywordCompare competitorKeywordSources={competitorKeywordSources} />
          {["basic", "startup", "pro", "biz"].includes(plan) && accessToken && (
            <CompetitorFAQCard bizId={business.id} accessToken={accessToken} />
          )}
        </div>
      }
      tab3Content={
        <div className="space-y-5">
          <AIDiagnosisCard
            businessName={business.name}
            category={business.category}
            region={business.region}
            keywords={business.keywords}
            allPlatformResults={allPlatformResults}
            reviewCount={business.review_count ?? 0}
            avgRating={business.avg_rating ?? 0}
            smartPlaceScore={scoreBreakdown?.smart_place_completeness ?? 0}
            naverMentioned={naverResult?.mentioned ?? false}
            categoryKo={CATEGORY_LABEL[business.category] ?? business.category}
            inBriefing={naverResult?.in_briefing ?? false}
            naverPlaceUrl={business.naver_place_url ?? null}
          />
          {scoreBreakdown && (
            <ScoreEvidenceCard
              breakdown={scoreBreakdown}
              naverResult={naverResult ?? null}
              kakaoResult={kakaoResult ?? null}
              topMissingKeywords={topMissingKeywords}
              isKeywordEstimated={isKeywordEstimated}
              track1Score={track1Score}
              track2Score={track2Score}
              naverWeight={naverWeight}
              allPlatformResults={allPlatformResults}
              reviewCount={business.review_count ?? 0}
              avgRating={business.avg_rating ?? 0}
              hasSmartPlace={smartPlaceStatus.hasFaq || smartPlaceStatus.hasIntro || smartPlaceStatus.hasRecentPost}
              hasFaq={smartPlaceStatus.hasFaq}
              hasRecentPost={smartPlaceStatus.hasRecentPost}
              hasIntro={smartPlaceStatus.hasIntro}
              bizId={business.id}
              token={accessToken ?? undefined}
              missingItems={missingItems}
            />
          )}
          {accessToken && business.naver_place_url && (
            <SmartplaceAutoCheck
              bizId={business.id}
              naverPlaceUrl={business.naver_place_url ?? null}
              accessToken={accessToken}
            />
          )}
          <KakaoChecklistCard
            bizId={business.id}
            initialScore={kakaoScore}
            initialChecklist={kakaoChecklist}
            kakaoRegistered={kakaoRegistered}
          />
          <WebsiteCheckCard websiteUrl={business.website_url ?? undefined} checkResult={websiteCheckResult} />

          {/* 키워드별 블로그 노출 비교 */}
          {(naverResult?.keyword_blog_comparison?.length ?? 0) > 0 && (
            <div className="bg-white rounded-xl border p-4 md:p-6">
              <h3 className="text-base md:text-lg font-bold text-gray-800 mb-1">
                내 가게 키워드가 네이버 블로그에 얼마나 있나요?
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                네이버 블로그 포스트 수 기준 비교입니다 (리뷰 키워드가 아닌, 블로그에 언급된 횟수).
              </p>
              <div className="space-y-4">
                {naverResult!.keyword_blog_comparison!.map(
                  (
                    kbc: {
                      keyword: string;
                      my_count: number;
                      competitor_count: number;
                      competitor_name?: string;
                    },
                    i: number
                  ) => {
                    const maxCount = Math.max(kbc.my_count, kbc.competitor_count, 1);
                    const myPct = Math.round((kbc.my_count / maxCount) * 100);
                    const compPct = Math.round((kbc.competitor_count / maxCount) * 100);
                    return (
                      <div key={i}>
                        <p className="text-sm font-semibold text-gray-700 mb-1.5">
                          &ldquo;{kbc.keyword}&rdquo; 키워드
                        </p>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm text-gray-500 w-24 truncate">
                            {kbc.competitor_name ?? "경쟁 1위"}
                          </span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                            <div className="bg-gray-400 h-2.5 rounded-full" style={{ width: `${compPct}%` }} />
                          </div>
                          <span className="text-sm text-gray-600 w-14 text-right">
                            {kbc.competitor_count.toLocaleString()}건
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-blue-700 w-24 truncate">내 가게</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                            <div
                              className={`h-2.5 rounded-full ${
                                kbc.my_count >= kbc.competitor_count ? "bg-green-500" : "bg-blue-500"
                              }`}
                              style={{ width: `${myPct}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold text-blue-700 w-14 text-right">
                            {kbc.my_count.toLocaleString()}건
                          </span>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )}

          {/* 최근 블로그 언급 */}
          {(naverResult?.top_blogs?.length ?? 0) > 0 && (
            <div className="bg-white rounded-xl border p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base md:text-lg font-bold text-gray-800">
                  최근 사람들이 내 가게를 어떻게 쓰고 있나요?
                </h3>
                <span className="text-sm text-gray-400">
                  {naverResult?.blog_mentions?.toLocaleString()}건 언급
                </span>
              </div>
              <div className="divide-y">
                {naverResult!.top_blogs!.slice(0, 5).map(
                  (
                    blog: {
                      title: string;
                      link: string;
                      description?: string;
                      postdate?: string;
                    },
                    i: number
                  ) => (
                    <a
                      key={i}
                      href={blog.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block py-3 hover:bg-gray-50 rounded transition-colors"
                    >
                      <p className="text-sm font-medium text-gray-800 line-clamp-1">{blog.title}</p>
                      {blog.description && (
                        <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{blog.description}</p>
                      )}
                      {blog.postdate && (
                        <p className="text-sm text-gray-400 mt-1">
                          {blog.postdate.replace(/(\d{4})(\d{2})(\d{2})/, "$1.$2.$3")}
                        </p>
                      )}
                    </a>
                  )
                )}
              </div>
            </div>
          )}

          {subscriptionPlan === "basic" && (
            <ProUpgradePreview
              businessName={business.name}
              category={business.category}
              plan={subscriptionPlan}
            />
          )}
          {plan === "biz" && accessToken && <MultiBizTable token={accessToken} />}

          <ConversionGuideSection bizId={business.id} plan={plan} />
        </div>
      }
    />
  );
}
