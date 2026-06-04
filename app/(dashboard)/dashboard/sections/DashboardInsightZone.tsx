import { AiInfoTabStatusCard } from "@/components/dashboard/AiInfoTabStatusCard";
import AiTabPreviewCard from "@/components/dashboard/AiTabPreviewCard";
import GlobalAiFocusCard from "@/components/dashboard/GlobalAiFocusCard";
import InactiveUserBanner from "@/components/dashboard/InactiveUserBanner";
import NaverAiPathwayCard from "@/components/dashboard/NaverAiPathwayCard";
import NaverMultiChannelCard from "@/components/dashboard/NaverMultiChannelCard";
import NaverSeoBaseCard from "@/components/dashboard/NaverSeoBaseCard";
import PhotoCategoryCard from "@/components/dashboard/PhotoCategoryCard";
import ReviewKeywordGapCard from "@/components/dashboard/ReviewKeywordGapCard";
import SchemaCheckCard from "@/components/dashboard/SchemaCheckCard";
import { CATEGORY_LABEL } from "@/lib/categories";
import { SUPPORTED_CATEGORIES as PHOTO_SUPPORTED_CATEGORIES } from "@/lib/photoCategories";
import type { WebsiteCheckResult } from "@/types";

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
  schemaSeoScore: number | null;
  websiteUrl?: string | null;
  websiteCheckResult?: WebsiteCheckResult | null;
  /** blog_analyzer.py에서 파생된 블로그 발견 수 (naver_result.blog_mentions) */
  blogMentionCount?: number;
  /** 리뷰 수 — NaverSeoBaseCard 체크리스트 */
  reviewCount?: number;
  /** 소개글 작성 여부 */
  hasIntro?: boolean;
  /** 14일 이내 소식 게시 여부 */
  hasRecentPost?: boolean;
  /** 예약 연동 여부 (null=미측정) */
  hasReservation?: boolean | null;
  /** 총 사진 수 (photo_categories 합계, null=스캔 없음) */
  photoCount?: number | null;
  /** 프랜차이즈 가맹점 여부 — AI 브리핑 제외 안내용 */
  isFranchise?: boolean;
  /** businesses.keywords 길이 — AI탭 시뮬레이션 0개 분기용 */
  keywordCount?: number;
  /** 최근 스캔 naver_result.ad_only — M3 광고/자연 배지용 */
  latestAdOnly?: boolean;
  /** 가입일 ISO 문자열 — INACTIVE 7일 배너 표시 조건 계산용 */
  userCreatedAt?: string | null;
  /** 글로벌 AI 비중 (0~1). DUAL_TRACK_RATIO[category].global — global ≥0.65 업종에 ChatGPT·Gemini 주전장 카드 표시 */
  globalWeight?: number;
  /** Google Business 프로필 등록 여부 — SchemaCheckCard 10점 항목 표시용 */
  googlePlaceRegistered?: boolean;
  /** naver_result.cafe_result — NAVER_MULTICH_ENABLED=true 시 포함 */
  cafeResult?: { mentioned: boolean; mention_count: number; exposure_score: number; top_excerpts: string[] } | null;
  /** naver_result.jisik_result — NAVER_MULTICH_ENABLED=true 시 포함 */
  jisikResult?: { mentioned: boolean; mention_count: number; exposure_score: number; top_excerpts: string[] } | null;
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
  schemaSeoScore,
  websiteUrl,
  websiteCheckResult,
  blogMentionCount,
  reviewCount,
  hasIntro,
  hasRecentPost,
  hasReservation,
  photoCount,
  isFranchise,
  keywordCount,
  latestAdOnly,
  userCreatedAt,
  globalWeight,
  googlePlaceRegistered,
  cafeResult,
  jisikResult,
}: Props) {
  const isPhotoSupported = PHOTO_SUPPORTED_CATEGORIES.includes(category);

  return (
    <>
      {/* INACTIVE 업종 가입자 첫 7일 한정 안내 배너 */}
      {briefingMeta?.eligibility === "inactive" && userCreatedAt && (
        <InactiveUserBanner userCreatedAt={userCreatedAt} />
      )}

      {/* 네이버 AI 검색 두 경로 비교 — AI 브리핑 vs AI탭 (사용자 노출 화면 명확 구분) */}
      {briefingMeta && (
        <NaverAiPathwayCard
          briefingEligibility={briefingMeta.eligibility}
          isFranchise={isFranchise}
          latestAdOnly={latestAdOnly}
          globalWeight={globalWeight}
        />
      )}

      {/* 글로벌 AI 주전장 안내 — legal·shopping·accounting 등 globalWeight ≥0.65 업종 */}
      {globalWeight !== undefined && globalWeight >= 0.65 && (
        <GlobalAiFocusCard
          globalWeight={globalWeight}
          categoryLabel={CATEGORY_LABEL[category] ?? category}
          category={category}
        />
      )}

      {/* AI 브리핑 노출 설정 (모든 업종 — AI탭은 업종 무관 beta 노출 가능) */}
      {accessToken && briefingMeta && (
        <AiInfoTabStatusCard
          bizId={bizId}
          accessToken={accessToken}
          currentStatus={briefingMeta.ai_info_tab_status ?? "unknown"}
          eligibility={briefingMeta.eligibility}
          aiTabEligibility="beta"
          explanation={briefingMeta.explanation}
          adOnly={latestAdOnly}
        />
      )}

      {/* AI탭 답변 미리보기 (모든 업종, Basic+) */}
      <AiTabPreviewCard
        bizId={bizId}
        subscriptionPlan={subscriptionPlan}
        category={category}
        blogMentionCount={blogMentionCount}
        keywordCount={keywordCount}
      />

      {/* 네이버 검색 기반 강화 현황 — 플레이스탭 노출 준비도 + 블로그 언급 + AI 노출 연결 */}
      <NaverSeoBaseCard
        reviewCount={reviewCount ?? 0}
        hasIntro={hasIntro ?? false}
        hasRecentPost={hasRecentPost ?? false}
        hasReservation={hasReservation ?? null}
        photoCount={photoCount ?? null}
        blogMentionCount={blogMentionCount ?? 0}
        eligibility={briefingMeta?.eligibility ?? "inactive"}
      />

      {/* 네이버 카페·지식인 언급 현황 — NAVER_MULTICH_ENABLED=true 시 자동 표시 */}
      {(cafeResult || jisikResult) && (
        <NaverMultiChannelCard cafeResult={cafeResult ?? null} jisikResult={jisikResult ?? null} />
      )}

      {/* 스마트플레이스 사진 카테고리 현황 */}
      {isPhotoSupported && (
        <PhotoCategoryCard
          photoCategories={photoCategories}
          category={category}
          photoGuides={photoGuides}
        />
      )}

      {/* 리뷰 키워드 분포 — 경쟁사 비교 */}
      <ReviewKeywordGapCard bizId={bizId} plan={plan} />

      {/* JSON-LD AI 검색 등록 점수 카드 (§3.4) */}
      <SchemaCheckCard
        schemaSeoScore={schemaSeoScore}
        websiteUrl={websiteUrl}
        websiteCheckResult={websiteCheckResult}
        plan={plan}
        googlePlaceRegistered={googlePlaceRegistered}
      />

      {/* 채널별 맞춤 가이드 링크 */}
      {(() => {
        const eligibility = briefingMeta?.eligibility;
        const isInactive = eligibility === "inactive";
        const isLikely = eligibility === "likely";
        const guideHref = isInactive
          ? "/guide/chatgpt-search"
          : isLikely
          ? `/guide/ai-tab?biz_id=${bizId}`
          : `/guide/ai-info-tab?biz_id=${bizId}`;
        const guideLabel = isInactive
          ? "ChatGPT·Gemini 가이드 보기 →"
          : isLikely
          ? "AI탭 가이드 열기 →"
          : "5단계 가이드 열기 →";
        const guideTitle = isInactive
          ? "ChatGPT·Gemini·Google AI 노출 가이드"
          : "네이버 AI 검색 노출 5단계 가이드";
        const guideDesc = isInactive
          ? "글로벌 AI 채널 노출 준비 상태를 점검하세요. 개선 반영은 수개월~1년 소요됩니다."
          : "AI 브리핑·AI탭 대응 체크리스트로 직접 설정하세요 (15분).";
        const colorMain = isInactive ? "bg-purple-600 hover:bg-purple-700" : "bg-blue-600 hover:bg-blue-700";
        const colorBorder = isInactive ? "border-purple-200 bg-purple-50" : "border-blue-200 bg-blue-50";
        const colorOutline = isInactive
          ? "border-purple-600 text-purple-600 hover:bg-purple-100"
          : "border-blue-600 text-blue-600 hover:bg-blue-100";
        return (
          <div className={`rounded-lg border p-4 md:p-5 ${colorBorder}`}>
            <p className="text-sm md:text-base text-gray-800 mb-3 leading-relaxed break-keep">
              <strong>{guideTitle}</strong> — {guideDesc}
            </p>
            <div className="flex flex-col md:flex-row gap-2">
              <a
                href={guideHref}
                className={`block w-full md:w-auto text-center px-4 py-2 text-white text-sm md:text-base rounded font-medium ${colorMain}`}
              >
                {guideLabel}
              </a>
              <a
                href="/how-it-works"
                className={`block w-full md:w-auto text-center px-4 py-2 border text-sm md:text-base rounded font-medium ${colorOutline}`}
              >
                AEOlab 동작 원리 보기 (매뉴얼)
              </a>
            </div>
          </div>
        );
      })()}
    </>
  );
}
