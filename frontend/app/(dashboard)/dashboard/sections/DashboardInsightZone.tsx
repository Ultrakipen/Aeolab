"use client";

import { useState, useEffect, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Bot, Sparkles, Search, BarChart2, Target, type LucideIcon } from "lucide-react";
import KeywordRankCard from "@/components/dashboard/KeywordRankCard";
import { AiInfoTabStatusCard } from "@/components/dashboard/AiInfoTabStatusCard";
import AiTabPreviewCard from "@/components/dashboard/AiTabPreviewCard";
import NaverMultiChannelCard from "@/components/dashboard/NaverMultiChannelCard";
import NaverSeoBaseCard from "@/components/dashboard/NaverSeoBaseCard";
import PhotoCategoryCard from "@/components/dashboard/PhotoCategoryCard";
import ReviewKeywordGapCard from "@/components/dashboard/ReviewKeywordGapCard";
import { SUPPORTED_CATEGORIES as PHOTO_SUPPORTED_CATEGORIES } from "@/lib/photoCategories";
import SeasonalKeywordBanner from "@/components/dashboard/SeasonalKeywordBanner";
import NaverSearchStrengthCard from "@/components/dashboard/NaverSearchStrengthCard";

/** 키워드 순위 접힘 상태에서도 모바일 발견성을 지키기 위한 1줄 요약 집계.
    "1페이지"는 KeywordRankCard.tsx의 rankBadge() 기준(rank<=10)과 동일 — 임의 수치 금지 원칙 준수 */
function summarizeKeywordRanks(
  keywords: string[] | undefined,
  ranks: Record<string, unknown> | null | undefined
): { total: number; measured: number; onFirstPage: number } | null {
  if (!keywords || keywords.length === 0) return null;
  let measured = 0;
  let onFirstPage = 0;
  keywords.forEach((kw) => {
    const r = ranks?.[kw];
    if (r && typeof r === "object" && !Array.isArray(r)) {
      const d = r as { pc_rank?: number | null; mobile_rank?: number | null; place_rank?: number | null };
      const vals = [d.pc_rank, d.mobile_rank, d.place_rank].filter(
        (v): v is number => typeof v === "number" && v > 0
      );
      if (vals.length > 0) {
        measured += 1;
        if (vals.some((v) => v <= 10)) onFirstPage += 1;
      }
    }
  });
  return { total: keywords.length, measured, onFirstPage };
}

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
function SubSectionLabel({ icon: Icon, label, borderClass }: { icon: LucideIcon; label: string; borderClass: string }) {
  return (
    <div className={`flex items-center gap-2 mb-3 pb-2 border-b-2 ${borderClass}`}>
      <Icon className="w-4 h-4 text-gray-600" aria-hidden="true" />
      <span className="text-sm font-bold text-gray-700">{label}</span>
    </div>
  );
}

/** 접이식 소섹션 — 헤더가 SubSectionLabel과 동일 스타일이되 클릭 토글.
    점진적 공개: 무거운 카드(순위표·AI탭·브리핑)를 기본 접힘으로 두어 읽기 부담 감소 */
function CollapsibleSub({
  icon: Icon, label, borderClass, defaultOpen = false, mobileDefaultOpen, id, children,
}: { icon: LucideIcon; label: string; borderClass: string; defaultOpen?: boolean; mobileDefaultOpen?: boolean; id?: string; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);

  // 모바일(<768px) 전용 기본 상태 — CollapseSectionWrapper와 동일 패턴 (하이드레이션 후 적용)
  useEffect(() => {
    if (mobileDefaultOpen === undefined) return;
    if (window.innerWidth < 768) {
      setOpen(mobileDefaultOpen);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div id={id}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`w-full flex items-center justify-between gap-2 mb-3 pb-2 border-b-2 ${borderClass} text-left hover:opacity-80 transition-opacity`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <Icon className="w-4 h-4 text-gray-600 shrink-0" aria-hidden="true" />
          <span className="text-sm font-bold text-gray-700 break-keep">{label}</span>
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-gray-600 shrink-0" />
        ) : (
          <span className="flex items-center gap-1 text-xs text-gray-600 font-medium shrink-0 whitespace-nowrap">
            눌러서 보기 <ChevronDown className="w-4 h-4" />
          </span>
        )}
      </button>
      {open && children}
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
    <CollapsibleSub id="naver-aitab-anchor" icon={Bot} label="네이버 AI탭 — 노출 높이는 방법" borderClass="border-blue-400" defaultOpen={false}>
      {/* 노출 상태(✓/✗/–)는 상단 진단 카드에서 한 번만 표시 — 여기서는 개선 방법만 안내 (중복 제거) */}
      <AiTabPreviewCard
        bizId={bizId}
        subscriptionPlan={subscriptionPlan}
        category={category}
        blogMentionCount={blogMentionCount}
        keywordCount={keywordCount}
      />
    </CollapsibleSub>
  );

  const sectionBriefing = accessToken && briefingMeta ? (
    // ACTIVE/LIKELY는 브리핑이 핵심 채널 → 펼침. INACTIVE는 비대상 → 접힘
    <CollapsibleSub id="naver-briefing-anchor" icon={Sparkles} label="네이버 AI 브리핑" borderClass="border-purple-400" defaultOpen={isActiveOrLikely}>
      <AiInfoTabStatusCard
        bizId={bizId}
        accessToken={accessToken}
        currentStatus={briefingMeta.ai_info_tab_status ?? "unknown"}
        eligibility={briefingMeta.eligibility}
        aiTabEligibility="beta"
        explanation={briefingMeta.explanation}
        adOnly={latestAdOnly}
      />
    </CollapsibleSub>
  ) : null;

  const sectionNaverSearch = (
    <div id="naver-seo-anchor">
      {/* 체크리스트는 가볍고 핵심 → 항상 펼침. 순위표(무거움)만 접힘 처리 */}
      <SubSectionLabel icon={Search} label="네이버 일반검색 노출" borderClass="border-green-400" />
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
          {/* 모바일 전용 1줄 요약 — 토글이 접혀도 발견성 유지 (2026-07-25 스크롤 길이 개선) */}
          {(() => {
            const summary = summarizeKeywordRanks(keywords, initialKeywordRanks);
            if (!summary) return null;
            return (
              <p className="md:hidden flex items-start gap-1.5 text-sm font-semibold text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-2 break-keep">
                <Target className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  {summary.measured === 0
                    ? `등록 키워드 ${summary.total}개 — 순위 측정 전, 눌러서 확인`
                    : `등록 키워드 ${summary.total}개 중 ${summary.onFirstPage}개 1페이지 노출 중`}
                </span>
              </p>
            );
          })()}
          <CollapsibleSub icon={BarChart2} label="내 키워드 네이버 검색 순위" borderClass="border-green-400" defaultOpen={true} mobileDefaultOpen={false}>
            <KeywordRankCard
              bizId={bizId}
              keywords={keywords}
              initialKeywordRanks={initialKeywordRanks ?? null}
              userGroup={userGroup ?? "INACTIVE"}
              region={region}
            />
          </CollapsibleSub>
        </div>
      )}
    </div>
  );

  return (
    <div id="section-insight" className="space-y-6">

      {/* 핵심 가치 제안 한 줄 배너 — 상세 설명은 하단 "상세 분석 데이터" ScoreEvidenceCard가 유일 소스(중복 금지 원칙 유지),
          여기는 항상 보이는 섹션 최상단에 짧게 노출해 클릭 2회 없이도 인지 가능하게 함 (2026-07-11) */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 flex items-start gap-2">
        <Search className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-sm text-blue-900 leading-relaxed break-keep">
          {isActiveOrLikely ? (
            <><strong>아래 AI 브리핑·AI탭 노출을 높이는 개선 활동은 네이버 일반 검색 상위 노출에도 함께 도움이 됩니다.</strong> 소개글·리뷰·블로그를 채울수록 검색 순위와 AI 노출이 같이 올라갑니다.</>
          ) : (
            <><strong>네이버 일반 검색 상위 노출은 지금도 가능합니다.</strong> 스마트플레이스 최적화·블로그 후기로 검색 결과 상위에 노출될 수 있습니다.</>
          )}
        </p>
      </div>

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

      {/* ─── 네이버 검색 기반 강화 현황 ─── */}
      <NaverSearchStrengthCard businessId={bizId} token={accessToken} />

      {/* ─── 부가 분석 — 기본 접힘 ─── */}
      {!showMore ? (
        <button
          onClick={() => setShowMore(true)}
          aria-expanded={false}
          className="w-full flex items-center justify-center gap-1 py-2.5 text-sm text-gray-600 hover:text-gray-700 transition-colors border border-dashed border-gray-200 rounded-lg"
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
            aria-expanded={true}
            className="w-full flex items-center justify-center gap-1 py-2 text-sm text-gray-600 hover:text-gray-700"
          >
            <ChevronUp className="w-4 h-4" />
            접기
          </button>
        </div>
      )}
    </div>
  );
}
