"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, MapPin, Bot } from "lucide-react";
import NaverTrackCard from "@/components/trial/NaverTrackCard";
import TrialKeywordRecommendCard from "@/components/trial/TrialKeywordRecommendCard";
import TrialCompetitorGapCard from "@/components/trial/TrialCompetitorGapCard";
import GlobalAiActionCard from "@/components/trial/GlobalAiActionCard";
import FactEvidenceSection from "@/components/trial/FactEvidenceSection";
import AIProblemDiagnosis from "@/components/trial/AIProblemDiagnosis";
import OneLineConclusion from "@/components/trial/OneLineConclusion";
import CompetitorGapHighlightCard from "@/components/trial/CompetitorGapHighlightCard";

// ── Props 타입 ───────────────────────────────────────────────────────

interface NaverTrackCardProps {
  track1Score: number;
  inBriefing: boolean | null;
  isSmartPlace: boolean;
  blogCount: number;
  hasFaq: boolean;
  hasIntro: boolean;
  userGroup: "ACTIVE" | "LIKELY" | "INACTIVE" | "franchise";
  businessName: string;
}

interface CompetitorGapCardProps {
  businessName: string;
  searchQuery?: string;
  myRank?: number | null;
  blogCount: number;
  topCompetitorName?: string | null;
  topCompetitorBlogCount?: number;
  naverCompetitors?: { rank: number; name: string; address?: string }[];
  blogSearchQuery?: string;
  compBlogSearchQuery?: string;
  keywordRanks?: Array<{ query: string; rank: number | null; exposed: boolean }>;
}

interface KeywordCardProps {
  missingKws: string[];
  faqText: string | null;
  categoryLabel: string;
  dismissed: string[];
  onDismiss: (kw: string) => void;
  keywordMeta?: Record<string, { subcategory: string; weight: number }>;
  userGroup?: string;
  introAnalyzed?: boolean;
  isPaidUser?: boolean;
}

interface GlobalAiActionCardProps {
  track2Score: number;
  chatgptMentioned: boolean | undefined;
  chatgptSampleSize: number;
  geminiExposureFreq: number | undefined;
  blogCount: number;
  hasWebsite: boolean | null;
  missingKeywords: string[];
  businessName: string;
  category: string;
  region: string;
  userGroup: string;
}

interface FactEvidenceSectionProps {
  chatgptResult: unknown;
  naver: unknown;
  exposureFreq: unknown;
  totalSamples: number;
  aiEvidence: unknown;
  analyzedKeyword?: string;
  region?: string;
  userGroup?: string;
}

interface ProblemDiagnosisProps {
  businessName: string;
  category: string;
  track1Score: number;
  track2Score: number;
  missingKeywords: string[];
  hasFaq: boolean;
  hasRecentPost: boolean;
  hasIntro: boolean;
  isSmartPlace: boolean;
  blogMentions: number;
  faqCopyText?: string | null;
  pioneerKeywords?: string[];
  reviewCopyText?: string;
  selectedTags?: string[];
  region?: string;
  userGroup?: string;
}

interface ScoreBreakdownProps {
  userGroup: "ACTIVE" | "LIKELY" | "INACTIVE" | "franchise";
  naverChannelScore: number;
  globalChannelScore: number;
  groupBannerNode: React.ReactNode;
}

export interface TrialDetailAccordionProps {
  naverTrackCardProps: NaverTrackCardProps;
  competitorGapCardProps: CompetitorGapCardProps;
  keywordCardProps: KeywordCardProps | null;
  globalAiActionCardProps: GlobalAiActionCardProps;
  factEvidenceSectionProps: FactEvidenceSectionProps;
  problemDiagnosisProps: ProblemDiagnosisProps;
  scoreBreakdownProps: ScoreBreakdownProps;
}

// ── 트랙 섹션 헤더 ───────────────────────────────────────────────────

function TrackSectionHeader({
  icon,
  title,
  subtitle,
  bgColor,
  textColor,
  borderColor,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}) {
  return (
    <div className={`${bgColor} ${borderColor} border rounded-xl px-4 py-3 mb-3 flex items-center gap-3`}>
      <div className={`shrink-0 w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className={`text-base font-black ${textColor} leading-tight`}>{title}</p>
        <p className={`text-sm ${textColor} opacity-80 leading-snug`}>{subtitle}</p>
      </div>
    </div>
  );
}

// ── 심층 진단 아코디언 헤더 ──────────────────────────────────────────

function DiagnosisAccordionHeader({
  isOpen,
  onClick,
}: {
  isOpen: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-4 bg-white hover:bg-gray-50 rounded-2xl border border-gray-200 transition-colors text-left"
    >
      <span className="flex items-center gap-2 min-w-0">
        {isOpen
          ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
          : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
        <span className="text-base font-bold text-gray-900">심층 진단 · 측정 상세</span>
      </span>
      <span className="text-sm text-gray-400 shrink-0 ml-2">
        {isOpen ? "접기" : "자세히 보기"}
      </span>
    </button>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────

export default function TrialDetailAccordion({
  naverTrackCardProps,
  competitorGapCardProps,
  keywordCardProps,
  globalAiActionCardProps,
  factEvidenceSectionProps,
  problemDiagnosisProps,
  scoreBreakdownProps,
}: TrialDetailAccordionProps) {
  const { userGroup } = naverTrackCardProps;
  const isGlobalFocus = userGroup === "INACTIVE" || userGroup === "franchise";
  const [showDiagnosis, setShowDiagnosis] = useState(false);

  const {
    naverChannelScore,
    globalChannelScore,
    groupBannerNode,
  } = scoreBreakdownProps;

  return (
    <div className="space-y-6 mb-4">

      {/* ─── 네이버 트랙 ─────────────────────────────────────────── */}
      {!isGlobalFocus && (
        <div>
          <TrackSectionHeader
            icon={<MapPin className="w-5 h-5 text-white" />}
            title="네이버 트랙"
            subtitle={userGroup === "LIKELY" ? "스마트플레이스 · 경쟁 순위 · 블로그" : "스마트플레이스 · AI 브리핑 · 경쟁 순위 · 블로그"}
            bgColor="bg-blue-600"
            textColor="text-white"
            borderColor="border-blue-700"
          />
          <div className="space-y-3">
            <NaverTrackCard
              track1Score={naverTrackCardProps.track1Score}
              inBriefing={naverTrackCardProps.inBriefing}
              isSmartPlace={naverTrackCardProps.isSmartPlace}
              blogCount={naverTrackCardProps.blogCount}
              hasFaq={naverTrackCardProps.hasFaq}
              hasIntro={naverTrackCardProps.hasIntro}
              userGroup={naverTrackCardProps.userGroup}
              businessName={naverTrackCardProps.businessName}
            />
            <TrialCompetitorGapCard
              businessName={competitorGapCardProps.businessName}
              searchQuery={competitorGapCardProps.searchQuery}
              myRank={competitorGapCardProps.myRank}
              blogCount={competitorGapCardProps.blogCount}
              topCompetitorName={competitorGapCardProps.topCompetitorName}
              topCompetitorBlogCount={competitorGapCardProps.topCompetitorBlogCount}
              naverCompetitors={competitorGapCardProps.naverCompetitors}
              blogSearchQuery={competitorGapCardProps.blogSearchQuery}
              compBlogSearchQuery={competitorGapCardProps.compBlogSearchQuery}
            />
            {keywordCardProps && (
              <TrialKeywordRecommendCard
                missingKws={keywordCardProps.missingKws}
                faqText={keywordCardProps.faqText}
                categoryLabel={keywordCardProps.categoryLabel}
                dismissed={keywordCardProps.dismissed}
                onDismiss={keywordCardProps.onDismiss}
                keywordMeta={keywordCardProps.keywordMeta}
                userGroup={userGroup}
                introAnalyzed={keywordCardProps.introAnalyzed}
                isPaidUser={keywordCardProps.isPaidUser}
              />
            )}
          </div>
        </div>
      )}

      {/* INACTIVE/프랜차이즈: 네이버 트랙 축약 (경쟁 순위만) */}
      {isGlobalFocus && (competitorGapCardProps.naverCompetitors?.length || competitorGapCardProps.topCompetitorName) && (
        <div>
          <TrackSectionHeader
            icon={<MapPin className="w-5 h-5 text-white" />}
            title="네이버 순위 참고"
            subtitle="글로벌 AI 최적화가 핵심이지만, 네이버 순위도 확인합니다"
            bgColor="bg-slate-500"
            textColor="text-white"
            borderColor="border-slate-600"
          />
          <TrialCompetitorGapCard
            businessName={competitorGapCardProps.businessName}
            searchQuery={competitorGapCardProps.searchQuery}
            myRank={competitorGapCardProps.myRank}
            blogCount={competitorGapCardProps.blogCount}
            topCompetitorName={competitorGapCardProps.topCompetitorName}
            topCompetitorBlogCount={competitorGapCardProps.topCompetitorBlogCount}
            naverCompetitors={competitorGapCardProps.naverCompetitors}
            blogSearchQuery={competitorGapCardProps.blogSearchQuery}
            compBlogSearchQuery={competitorGapCardProps.compBlogSearchQuery}
          />
        </div>
      )}

      {/* ─── 글로벌 AI 트랙 ──────────────────────────────────────── */}
      <div>
        <TrackSectionHeader
          icon={<Bot className="w-5 h-5 text-white" />}
          title="글로벌 AI 트랙"
          subtitle="ChatGPT · Gemini · Google AI 노출 현황 및 개선"
          bgColor="bg-purple-600"
          textColor="text-white"
          borderColor="border-purple-700"
        />
        <div className="space-y-3">
          <GlobalAiActionCard
            track2Score={globalAiActionCardProps.track2Score}
            chatgptMentioned={globalAiActionCardProps.chatgptMentioned}
            chatgptSampleSize={globalAiActionCardProps.chatgptSampleSize}
            geminiExposureFreq={globalAiActionCardProps.geminiExposureFreq}
            blogCount={globalAiActionCardProps.blogCount}
            hasWebsite={globalAiActionCardProps.hasWebsite}
            missingKeywords={globalAiActionCardProps.missingKeywords}
            businessName={globalAiActionCardProps.businessName}
            category={globalAiActionCardProps.category}
            region={globalAiActionCardProps.region}
            userGroup={globalAiActionCardProps.userGroup}
          />
          <FactEvidenceSection
            chatgptResult={
              factEvidenceSectionProps.chatgptResult as Parameters<typeof FactEvidenceSection>[0]["chatgptResult"]
            }
            naver={
              factEvidenceSectionProps.naver as Parameters<typeof FactEvidenceSection>[0]["naver"]
            }
            exposureFreq={
              factEvidenceSectionProps.exposureFreq as Parameters<typeof FactEvidenceSection>[0]["exposureFreq"]
            }
            totalSamples={factEvidenceSectionProps.totalSamples}
            aiEvidence={
              factEvidenceSectionProps.aiEvidence as Parameters<typeof FactEvidenceSection>[0]["aiEvidence"]
            }
            analyzedKeyword={factEvidenceSectionProps.analyzedKeyword}
            region={factEvidenceSectionProps.region}
            userGroup={userGroup}
          />
          {/* INACTIVE/프랜차이즈: 키워드 카드도 글로벌 트랙에 포함 */}
          {isGlobalFocus && keywordCardProps && (
            <TrialKeywordRecommendCard
              missingKws={keywordCardProps.missingKws}
              faqText={keywordCardProps.faqText}
              categoryLabel={keywordCardProps.categoryLabel}
              dismissed={keywordCardProps.dismissed}
              onDismiss={keywordCardProps.onDismiss}
              keywordMeta={keywordCardProps.keywordMeta}
              userGroup={userGroup}
              introAnalyzed={keywordCardProps.introAnalyzed}
              isPaidUser={keywordCardProps.isPaidUser}
            />
          )}
        </div>
      </div>

      {/* ─── 심층 진단 · 측정 상세 (접기/펼치기) ────────────────── */}
      <div>
        <DiagnosisAccordionHeader
          isOpen={showDiagnosis}
          onClick={() => setShowDiagnosis((p) => !p)}
        />
        {showDiagnosis && (
          <div className="mt-2 space-y-3">
            <AIProblemDiagnosis
              businessName={problemDiagnosisProps.businessName}
              category={problemDiagnosisProps.category}
              track1Score={problemDiagnosisProps.track1Score}
              track2Score={problemDiagnosisProps.track2Score}
              missingKeywords={problemDiagnosisProps.missingKeywords}
              hasFaq={problemDiagnosisProps.hasFaq}
              hasRecentPost={problemDiagnosisProps.hasRecentPost}
              hasIntro={problemDiagnosisProps.hasIntro}
              isSmartPlace={problemDiagnosisProps.isSmartPlace}
              blogMentions={problemDiagnosisProps.blogMentions}
              faqCopyText={problemDiagnosisProps.faqCopyText}
              pioneerKeywords={problemDiagnosisProps.pioneerKeywords}
              reviewCopyText={problemDiagnosisProps.reviewCopyText}
              selectedTags={problemDiagnosisProps.selectedTags}
              region={problemDiagnosisProps.region}
              userGroup={problemDiagnosisProps.userGroup ?? userGroup}
            />

            {/* 업종 그룹 배너 */}
            {groupBannerNode}

            {/* 채널 분리 점수 2카드 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-gray-200 px-3 md:px-4 py-4">
                <p className="text-sm font-semibold text-gray-600 mb-0.5">
                  네이버 AI 노출 점수
                </p>
                <p className="text-sm text-gray-500 mb-2 leading-tight">
                  네이버 브리핑 · 카카오맵
                </p>
                <div
                  className={`text-2xl md:text-3xl font-black mb-1 ${
                    naverChannelScore >= 70
                      ? "text-green-500"
                      : naverChannelScore >= 40
                        ? "text-amber-500"
                        : "text-red-400"
                  }`}
                >
                  {Math.round(naverChannelScore)}점
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      naverChannelScore >= 70
                        ? "bg-emerald-500"
                        : naverChannelScore >= 40
                          ? "bg-blue-500"
                          : "bg-red-400"
                    }`}
                    style={{ width: `${Math.round(naverChannelScore)}%` }}
                  />
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 px-3 md:px-4 py-4">
                <p className="text-sm font-semibold text-gray-600 mb-0.5">
                  ChatGPT·구글 AI 노출 점수
                </p>
                <p className="text-sm text-gray-500 mb-2 leading-tight">
                  요즘 손님이 많이 쓰는 AI
                </p>
                <div
                  className={`text-2xl md:text-3xl font-black mb-1 ${
                    globalChannelScore >= 70
                      ? "text-green-500"
                      : globalChannelScore >= 40
                        ? "text-blue-500"
                        : "text-red-400"
                  }`}
                >
                  {Math.round(globalChannelScore)}점
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-purple-400"
                    style={{ width: `${Math.round(globalChannelScore)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
