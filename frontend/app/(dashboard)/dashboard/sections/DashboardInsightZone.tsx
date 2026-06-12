"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import KeywordRankCard from "@/components/dashboard/KeywordRankCard";
import { AiInfoTabStatusCard } from "@/components/dashboard/AiInfoTabStatusCard";
import AiTabPreviewCard from "@/components/dashboard/AiTabPreviewCard";
import NaverMultiChannelCard from "@/components/dashboard/NaverMultiChannelCard";
import NaverSeoBaseCard from "@/components/dashboard/NaverSeoBaseCard";
import PhotoCategoryCard from "@/components/dashboard/PhotoCategoryCard";
import ReviewKeywordGapCard from "@/components/dashboard/ReviewKeywordGapCard";
import { SUPPORTED_CATEGORIES as PHOTO_SUPPORTED_CATEGORIES } from "@/lib/photoCategories";
import SeasonalKeywordBanner from "@/components/dashboard/SeasonalKeywordBanner";

interface BriefingMeta {
  eligibility: "active" | "likely" | "inactive";
  ai_info_tab_status: "not_visible" | "off" | "on" | "disabled" | "unknown";
  explanation: string;
}

interface PhotoGuideItem {
  description: string;
  examples: string[];
  tips: string[];
}

interface Props {
  bizId: string;
  accessToken: string;
  subscriptionPlan: string;
  plan: string;
  category: string;
  briefingMeta: BriefingMeta | undefined;
  photoCategories: Record<string, number> | null;
  photoGuides: Record<string, PhotoGuideItem> | null;
  blogMentionCount?: number;
  reviewCount?: number;
  hasIntro?: boolean;
  hasRecentPost?: boolean | null;
  hasReservation?: boolean | null;
  photoCount?: number | null;
  naverPlaceId?: string | null;
  photoSufficient?: boolean;
  recentPostConfirmedAt?: string | null;
  isFranchise?: boolean;
  keywordCount?: number;
  latestAdOnly?: boolean;
  cafeResult?: { mentioned: boolean; mention_count: number; exposure_score: number; top_excerpts: string[] } | null;
  jisikResult?: { mentioned: boolean; mention_count: number; exposure_score: number; top_excerpts: string[] } | null;
  keywords?: string[];
  initialKeywordRanks?: Record<string, unknown> | null;
  userGroup?: "ACTIVE" | "LIKELY" | "INACTIVE";
  region?: string;
}

/** 소섹션 레이블 */
function SubSectionLabel({ icon, label, borderClass }: { icon: string; label: string; borderClass: string }) {
  return (
    <div className={`flex items-center gap-2 mb-3 pb-2 border-b-2 ${borderClass}`}>
      <span className="text-base" aria-hidden="true">{icon}</span>
      <span className="text-sm font-bold text-gray-700">{label}</span>
    </div>
  );
}

export default function DashboardInsightZone({
  bizId,
  accessToken,
  subscriptionPlan,
  plan,
  category,
  briefingMeta,
  photoCategories,
  photoGuides,
  blogMentionCount,
  reviewCount,
  hasIntro,
  hasRecentPost,
  hasReservation,
  photoCount,
  naverPlaceId,
  photoSufficient,
  recentPostConfirmedAt,
  latestAdOnly,
  keywordCount,
  cafeResult,
  jisikResult,
  keywords,
  initialKeywordRanks,
  userGroup,
  region,
}: Props) {
  const [showMore, setShowMore] = useState(false);
  const isPhotoSupported = PHOTO_SUPPORTED_CATEGORIES.includes(category);

  const isActiveOrLikely = userGroup === "ACTIVE" || userGroup === "LIKELY";

  const sectionAiTab = (
    <div id="naver-aitab-anchor">
      <SubSectionLabel icon="🤖" label="네이버 AI탭 — 노출 높이는 방법" borderClass="border-blue-400" />
      {/* 노출 상태(✓/✗/–)는 상단 진단 카드에서 한 번만 표시 — 여기서는 개선 방법만 안내 (중복 제거) */}
      <AiTabPreviewCard
        bizId={bizId}
        subscriptionPlan={subscriptionPlan}
        category={category}
        blogMentionCount={blogMentionCount}
        keywordCount={keywordCount}
      />
    </div>
  );

  const sectionBriefing = accessToken && briefingMeta ? (
    <div id="naver-briefing-anchor">
      <SubSectionLabel icon="✨" label="네이버 AI 브리핑" borderClass="border-purple-400" />
      <AiInfoTabStatusCard
        bizId={bizId}
        accessToken={accessToken}
        currentStatus={briefingMeta.ai_info_tab_status ?? "unknown"}
        eligibility={briefingMeta.eligibility}
        aiTabEligibility="beta"
        explanation={briefingMeta.explanation}
        adOnly={latestAdOnly}
      />
    </div>
  ) : null;

  const sectionNaverSearch = (
    <div id="naver-seo-anchor">
      <SubSectionLabel icon="🔍" label="네이버 일반검색 노출" borderClass="border-green-400" />
      <NaverSeoBaseCard
        reviewCount={reviewCount ?? 0}
        hasIntro={hasIntro ?? false}
        hasRecentPost={hasRecentPost ?? null}
        hasReservation={hasReservation ?? null}
        photoCount={photoCount ?? null}
        blogMentionCount={blogMentionCount ?? 0}
        eligibility={briefingMeta?.eligibility ?? "inactive"}
        naverPlaceId={naverPlaceId}
        photoSufficient={photoSufficient}
        recentPostConfirmedAt={recentPostConfirmedAt}
        bizId={bizId}
        accessToken={accessToken}
      />
      {keywords && keywords.length > 0 && region && (
        <div className="mt-3">
          <KeywordRankCard
            bizId={bizId}
            keywords={keywords}
            initialKeywordRanks={initialKeywordRanks ?? null}
            userGroup={userGroup ?? "INACTIVE"}
            region={region}
          />
        </div>
      )}
    </div>
  );

  return (
    <div id="section-insight" className="space-y-6">

      {/* 이번 달 시즌 키워드 — InsightZone 상단 배치 */}
      <SeasonalKeywordBanner category={category} />

      {/* ACTIVE/LIKELY: AI 브리핑 최상단 → 일반검색 → AI탭 */}
      {/* INACTIVE: 일반검색 → AI탭 → AI 브리핑(마지막) */}
      {isActiveOrLikely ? (
        <>
          {sectionBriefing}
          {sectionNaverSearch}
          {sectionAiTab}
        </>
      ) : (
        <>
          {sectionNaverSearch}
          {sectionAiTab}
          {sectionBriefing}
        </>
      )}

      {/* ─── 부가 분석 — 기본 접힘 ─── */}
      {!showMore ? (
        <button
          onClick={() => setShowMore(true)}
          className="w-full flex items-center justify-center gap-1 py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors border border-dashed border-gray-200 rounded-lg"
        >
          <ChevronDown className="w-4 h-4" />
          카페·지식채널 · 사진 카테고리 · 리뷰 키워드 상세 보기
        </button>
      ) : (
        <div className="space-y-3">
          {(cafeResult || jisikResult) && (
            <NaverMultiChannelCard cafeResult={cafeResult ?? null} jisikResult={jisikResult ?? null} />
          )}
          {isPhotoSupported && (
            <PhotoCategoryCard
              photoCategories={photoCategories}
              category={category}
              photoGuides={photoGuides}
            />
          )}
          <ReviewKeywordGapCard bizId={bizId} plan={plan} />
          <button
            onClick={() => setShowMore(false)}
            className="w-full flex items-center justify-center gap-1 py-2 text-sm text-gray-400 hover:text-gray-600"
          >
            <ChevronUp className="w-4 h-4" />
            접기
          </button>
        </div>
      )}
    </div>
  );
}
