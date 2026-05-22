import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SUPPORTED_CATEGORIES as PHOTO_SUPPORTED_CATEGORIES } from "@/lib/photoCategories";
import { getBriefingEligibility } from "@/lib/userGroup";
import { fetchBriefingCategories } from "@/lib/briefingCategoriesServer";
import { getActiveBusinessId } from "@/lib/active-business";
import type { WebsiteCheckResult } from "@/types";
import DashboardHeader from "./sections/DashboardHeader";
import FirstScanBanner from "@/components/onboarding/FirstScanBanner";
import { MaintenanceBanner } from "@/components/dashboard/MaintenanceBanner";
import { ContextTipBanner } from "@/components/dashboard/ContextTipBanner";
import DashboardScoreZone from "./sections/DashboardScoreZone";
import DashboardActionZone from "./sections/DashboardActionZone";
import DashboardInsightZone from "./sections/DashboardInsightZone";
import DashboardGeneratorZone from "./sections/DashboardGeneratorZone";
import DashboardDetailZone from "./sections/DashboardDetailZone";
import DashboardFooter from "./sections/DashboardFooter";
import {
  SCAN_DAILY_LIMITS,
  nextScanLabel,
  calcLastScannedLabel,
  calcDisplayCity,
  calcTodayAction,
  buildAllPlatformResults,
  buildSmartPlaceStatus,
  castWebsiteCheckResult,
  extractMissingItems,
} from "./sections/pageHelpers";
import { getDefaultGlobalWeight } from "@/lib/dualTrack";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";


export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ rescan?: string; biz_id?: string; onboarding?: string }>;
}) {
  // ── 인증 ─────────────────────────────────────────────────────
  const params = await searchParams;
  const showRescanNotice = params.rescan === "1";
  const isFromOnboarding = params.onboarding === "1";
  const selectedBizId = params.biz_id ?? null;

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user || error) redirect("/login");

  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token ?? "";
  const activeBizId = selectedBizId ?? await getActiveBusinessId(user.id);

  // ── 사업장 목록 ──────────────────────────────────────────────
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name, category, region, business_type, website_url, naver_place_id, google_place_id, kakao_place_id, kakao_score, kakao_checklist, kakao_registered, is_active, naver_place_url, review_count, avg_rating, keywords, is_smart_place, has_faq, has_recent_post, has_intro, visitor_review_count, receipt_review_count, blog_url, blog_keyword_coverage, blog_post_count, blog_analyzed_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(5);

  // v4.1 컬럼 별도 SELECT
  const businessIds = (businesses ?? []).map((b) => b.id);
  let v41ExtraMap: Record<string, {
    is_franchise?: boolean; ai_info_tab_status?: string;
    naver_intro_draft?: string; naver_intro_generated_at?: string;
    talktalk_faq_draft?: unknown; talktalk_faq_generated_at?: string;
  }> = {};
  if (businessIds.length > 0) {
    try {
      const v41Res = await supabase
        .from("businesses")
        .select("id, is_franchise, ai_info_tab_status, naver_intro_draft, naver_intro_generated_at, talktalk_faq_draft, talktalk_faq_generated_at")
        .in("id", businessIds);
      if (!v41Res.error && v41Res.data) {
        v41ExtraMap = Object.fromEntries(v41Res.data.map((r: Record<string, unknown>) => [r.id as string, r]));
      }
    } catch { /* v4.1 컬럼 미존재 — 무시 */ }
  }

  const business = (activeBizId
    ? businesses?.find((b) => b.id === activeBizId)
    : businesses?.[0]) ?? null;
  const v41Extra = business ? v41ExtraMap[business.id] : undefined;
  const todayISO = new Date().toISOString().split("T")[0];

  // ── 구독 ─────────────────────────────────────────────────────
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", user.id)
    .maybeSingle();

  const _activePlan = (subscription?.status === "active" || subscription?.status === "grace_period")
    ? subscription.plan : "free";
  const planLabel = ({ free:"Free", basic:"Basic", startup:"창업패키지", pro:"Pro", biz:"Biz", enterprise:"Enterprise" } as Record<string,string>)[_activePlan ?? "free"] ?? "Free";
  const planFaqLimit = ({ free:0, basic:5, startup:999, pro:999, biz:999, enterprise:999 } as Record<string,number>)[_activePlan ?? "free"] ?? 0;

  // ── 온보딩 ───────────────────────────────────────────────────
  const { data: profileRow } = await supabase
    .from("profiles").select("onboarding_done").eq("id", user.id).maybeSingle();
  let onboardingDone = profileRow?.onboarding_done ?? false;
  if (!onboardingDone && business) {
    await supabase.from("profiles").upsert({ id: user.id, onboarding_done: true }, { onConflict: "id" });
    onboardingDone = true;
  }

  // ── 병렬 페칭 ────────────────────────────────────────────────
  const [
    { data: scanResults }, { data: competitors }, { data: history },
    benchmarkRes, { data: latestGuide }, { count: scanUsedToday },
    actionLogRes, gapRes, photoGuideRes,
  ] = business
    ? await Promise.all([
        supabase.from("scan_results")
          .select("id, scanned_at, query_used, gemini_result, chatgpt_result, naver_result, google_result, kakao_result, website_check_result, smart_place_completeness_result, exposure_freq, total_score, unified_score, track1_score, track2_score, naver_weight, global_weight, growth_stage, growth_stage_label, is_keyword_estimated, keyword_coverage, score_breakdown, naver_channel_score, global_channel_score, rank_in_query, competitor_scores, top_missing_keywords, keyword_ranks, photo_categories")
          .eq("business_id", business.id).order("scanned_at", { ascending: false }).limit(1),
        supabase.from("competitors").select("id, name").eq("business_id", business.id).eq("is_active", true),
        supabase.from("score_history")
          .select("id, business_id, score_date, total_score, exposure_freq, unified_score, track1_score, track2_score, context, created_at")
          .eq("business_id", business.id).order("score_date", { ascending: false }).limit(30),
        business.category && business.region
          ? fetch(`${BACKEND}/api/report/benchmark/${business.category}/${encodeURIComponent(business.region)}`).then((r) => r.ok ? r.json() : null).catch(() => null)
          : Promise.resolve(null),
        supabase.from("guides").select("priority_json, next_month_goal, tools_json")
          .eq("business_id", business.id).order("generated_at", { ascending: false }).limit(1)
          .then((r) => ({ data: r.data?.[0] ?? null })),
        supabase.from("scan_results").select("id", { count: "exact", head: true })
          .eq("business_id", business.id).gte("scanned_at", todayISO + "T00:00:00"),
        accessToken
          ? fetch(`${BACKEND}/api/report/action-log/${business.id}`, { headers: { Authorization: `Bearer ${accessToken}` } }).then((r) => r.ok ? r.json() : null).catch(() => null)
          : Promise.resolve(null),
        accessToken
          ? fetch(`${BACKEND}/api/report/gap/${business.id}`, { headers: { Authorization: `Bearer ${accessToken}` } }).then((r) => r.ok ? r.json() : null).catch(() => null)
          : Promise.resolve(null),
        business.category && PHOTO_SUPPORTED_CATEGORIES.includes(business.category)
          ? fetch(`${BACKEND}/api/report/photo-guide/${business.category}`).then((r) => r.ok ? r.json() : null).catch(() => null)
          : Promise.resolve(null),
      ])
    : [
        { data: null }, { data: null }, { data: null }, null, { data: null },
        { count: 0 }, null, null, null,
      ];

  // ── 데이터 조합 ──────────────────────────────────────────────
  const photoGuides = (photoGuideRes as { guides?: Record<string, { description: string; examples: string[]; tips: string[] }> } | null)?.guides ?? null;
  const benchmark = (benchmarkRes ?? null) as { avg_score?: number; fallback?: string } | null;
  const actionLogs = ((actionLogRes as { logs?: unknown[] } | null)?.logs ?? []) as Array<{
    action_type: string; action_label: string; action_date: string;
    score_before: number | null; score_after: number | null;
  }>;
  const latestScan = scanResults?.[0] as Record<string, unknown> | undefined;
  const competitorKeywordSources = ((gapRes as { keyword_gap?: { competitor_keyword_sources?: Record<string, string[]> } } | null)
    ?.keyword_gap?.competitor_keyword_sources ?? {});

  // ── 플랜 ─────────────────────────────────────────────────────
  const ADMIN_EMAILS_LIST = (process.env.ADMIN_EMAILS ?? "hoozdev@gmail.com").split(",").map((e) => e.trim().toLowerCase());
  const isAdmin = ADMIN_EMAILS_LIST.includes((user.email ?? "").toLowerCase());
  const plan = isAdmin ? "biz"
    : subscription?.status === "active" || subscription?.status === "grace_period"
    ? subscription?.plan ?? "free" : "free";
  const subscriptionPlan = subscription?.status === "active" || subscription?.status === "grace_period"
    ? subscription?.plan ?? "free" : "free";
  const devMode = process.env.NEXT_PUBLIC_DEV_MODE === "true";
  const scanLimit = (isAdmin || devMode) ? 999 : SCAN_DAILY_LIMITS[plan] ?? 0;
  const scanUsed = scanUsedToday ?? 0;
  const scanInfo = isAdmin
    ? { label: "자동 스캔 없음 (관리자)", desc: "관리자 계정은 자동 스캔 대상에서 제외됩니다" }
    : nextScanLabel(plan);

  // ── 가이드 파생 ───────────────────────────────────────────────
  type GuideData = { priority_json?: string[]; next_month_goal?: string; tools_json?: { faq_list?: { question: string; answer: string }[]; naver_post_template?: string; direct_briefing_paths?: { path_label?: string }[]; } } | null;
  const guideData = latestGuide as GuideData;
  const guideTopAction = guideData?.priority_json?.[0] ?? null;
  const briefingPathLabel = guideData?.tools_json?.direct_briefing_paths?.[0]?.path_label ?? null;
  const faqQuestion = guideData?.tools_json?.faq_list?.[0]?.question ?? null;
  const topMissingKeywords: string[] = Array.isArray(latestScan?.top_missing_keywords)
    ? (latestScan!.top_missing_keywords as string[]).slice(0, 5) : [];

  const todayActionText = calcTodayAction(
    guideTopAction,
    latestScan?.score_breakdown as Record<string, number> | null ?? null,
    !!(business?.has_intro), !!(business?.has_faq),
  );
  const actionCardWeek = topMissingKeywords[1]
    ? `소개글·포스트에 '${topMissingKeywords[1]}' 키워드를 자연스럽게 포함하세요`
    : topMissingKeywords[0]
    ? `소개글·포스트에 '${topMissingKeywords[0]}' 키워드를 자연스럽게 포함하세요`
    : guideData?.tools_json?.naver_post_template ? "스마트플레이스 '소식' 탭에 새 공지를 등록하세요" : null;
  const actionCardMonth = guideData?.next_month_goal ?? null;

  const todayTasks: { no: number; title: string; desc: string; time: string; link: string }[] = [];
  if (todayActionText) todayTasks.push({ no: 1, title: "오늘 바로", desc: todayActionText, time: "5분", link: "/guide" });
  if (actionCardWeek) todayTasks.push({ no: 2, title: "이번 주", desc: actionCardWeek, time: "15분", link: "/guide" });
  if (actionCardMonth) todayTasks.push({ no: 3, title: "이번 달 목표", desc: actionCardMonth, time: "꾸준히", link: "/guide" });
  if (todayTasks.length === 0 && topMissingKeywords.length > 0)
    todayTasks.push({ no: 1, title: "오늘 바로", desc: `'${topMissingKeywords[0]}' 키워드를 소개글·톡톡 채팅방 메뉴에 추가하세요`, time: "5분", link: "/guide" });

  const actionCopyText = (() => {
    if (todayActionText) return todayActionText;
    if (briefingPathLabel) return `오늘 스마트플레이스에서 '${briefingPathLabel}'을 실행하세요`;
    if (faqQuestion) return `소개글 하단에 '${faqQuestion}' Q&A를 추가하세요`;
    const kw = topMissingKeywords[0] ?? null;
    return kw ? `소개글·톡톡 채팅방 메뉴에 '${kw}' 관련 Q&A를 1개 추가하세요 (AI 브리핑 노출 효과)` : null;
  })();

  // ── 점수 계산 ────────────────────────────────────────────────
  const naverChannelScore = (latestScan?.naver_channel_score as number | null) ?? null;
  const globalChannelScore = (latestScan?.global_channel_score as number | null) ?? null;
  const track1Score = (latestScan?.track1_score as number | null) ?? naverChannelScore ?? 0;
  const track2Score = (latestScan?.track2_score as number | null) ?? globalChannelScore ?? (latestScan?.total_score as number | null) ?? 0;
  const unifiedScore = (latestScan?.unified_score as number | null) ?? (latestScan?.total_score as number | null) ?? 0;
  const naverWeight = (latestScan?.naver_weight as number | null)
    ?? (1 - getDefaultGlobalWeight((business?.category as string | null | undefined) ?? "other"));
  const globalWeight = (latestScan?.global_weight as number | null)
    ?? getDefaultGlobalWeight((business?.category as string | null | undefined) ?? "other");
  const growthStage = (latestScan?.growth_stage as string | null) ?? "stability";
  const growthStageLabel = (latestScan?.growth_stage_label as string | null) ?? "성장 중";
  const isKeywordEstimated = (latestScan?.is_keyword_estimated as boolean | null) ?? false;

  const scoreChangeDiff = history && history.length >= 2
    ? Math.round(((history[0]?.unified_score ?? history[0]?.total_score ?? 0) as number) - ((history[1]?.unified_score ?? history[1]?.total_score ?? 0) as number))
    : null;

  const lastScannedLabel = calcLastScannedLabel(latestScan?.scanned_at as string | null | undefined);
  const displayCity = calcDisplayCity(business?.region);

  const smartPlaceStatus = buildSmartPlaceStatus(latestScan, business ?? { has_faq: false, has_intro: false, has_recent_post: false });
  const allPlatformResults = buildAllPlatformResults(latestScan);
  const websiteCheckResult = castWebsiteCheckResult(latestScan?.website_check_result);
  const missingItems = extractMissingItems(latestScan);

  const kakaoResult = (latestScan?.kakao_result ?? null) as Record<string, unknown> | null;
  const kakaoScore = (business as { kakao_score?: number })?.kakao_score;
  const kakaoChecklist = (business as { kakao_checklist?: Record<string, boolean> })?.kakao_checklist;
  const kakaoRegistered =
    (business as { kakao_registered?: boolean })?.kakao_registered ??
    (kakaoResult as { is_on_kakao?: boolean } | null)?.is_on_kakao ??
    !!(business?.kakao_place_id);

  const competitorScores = (latestScan?.competitor_scores as Record<string, { name: string; score: number }> | null) ?? {};
  const rankingItems = [
    ...(competitors ?? []).map((c) => ({ name: c.name, score: competitorScores[c.id]?.score ?? 0 })),
    { name: business?.name ?? "", score: (latestScan?.total_score as number | null) ?? 0, isMe: true },
  ];
  const myRankInList = [...rankingItems].sort((a, b) => b.score - a.score).findIndex((r) => (r as { isMe?: boolean }).isMe) + 1;
  const topCompetitor = rankingItems.filter((r) => !(r as { isMe?: boolean }).isMe).sort((a, b) => b.score - a.score)[0] ?? null;

  const briefingCats = await fetchBriefingCategories();
  const briefingEligibility = getBriefingEligibility(
    business?.category ?? "",
    !!v41Extra?.is_franchise,
    briefingCats.active,
    briefingCats.likely,
  );
  const aiTabEligibility = (process.env.NEXT_PUBLIC_AI_TAB_STATUS ?? "beta") as "beta" | "available";
  const isFranchise = !!v41Extra?.is_franchise;

  const briefingMeta = (latestScan?.briefing_meta as {
    eligibility: "active" | "likely" | "inactive";
    ai_info_tab_status: "not_visible" | "off" | "on" | "disabled" | "unknown";
    explanation: string;
  } | undefined);

  const aiExposureData = latestScan ? {
    chatgptFreq: latestScan.chatgpt_result ? Number((latestScan.chatgpt_result as Record<string,unknown>).exposure_freq ?? undefined) : undefined,
    chatgptSampleSize: latestScan.chatgpt_result ? Number((latestScan.chatgpt_result as Record<string,unknown>).sample_size ?? undefined) : undefined,
    geminiFreq: latestScan.gemini_result ? Number((latestScan.gemini_result as Record<string,unknown>).exposure_freq ?? undefined) : undefined,
    geminiSampleSize: latestScan.gemini_result ? Number((latestScan.gemini_result as Record<string,unknown>).sample_size ?? undefined) : undefined,
  } : undefined;

  const photoCategories = (latestScan?.photo_categories as Record<string, number> | null) ?? null;
  const gapCloseable = (gapRes as { vs_top?: { closeable_gap?: number } } | null)?.vs_top?.closeable_gap ?? null;

  const blogBiz = business as { blog_url?: string; blog_analyzed_at?: string; blog_post_count?: number; blog_keyword_coverage?: number } | null;
  const blogContribution = blogBiz?.blog_url ? {
    active: !!(blogBiz.blog_analyzed_at) && !isKeywordEstimated,
    postCount: blogBiz.blog_post_count ?? 0,
    keywordCoverage: blogBiz.blog_keyword_coverage ?? 0,
    analyzedAt: blogBiz.blog_analyzed_at,
    blogUrl: blogBiz.blog_url,
  } : undefined;

  const dimensions = (gapRes as { dimensions?: Array<{ dimension_key: string; dimension_label: string; current_score: number; max_score: number; gap_to_top: number; gap_reason: string; priority: number }> } | null)?.dimensions;

  // ── 타입 단순화 헬퍼 ─────────────────────────────────────────
  const bizBase = business as {
    id: string; name: string; category: string; region: string;
    website_url?: string | null; naver_place_id?: string | null;
    naver_place_url?: string | null; google_place_id?: string | null;
    review_count?: number; avg_rating?: number; keywords?: string[];
    has_faq?: boolean | null; has_intro?: boolean | null; has_recent_post?: boolean | null;
    visitor_review_count?: number; receipt_review_count?: number;
    blog_url?: string; blog_analyzed_at?: string; blog_post_count?: number; blog_keyword_coverage?: number;
  } | null;

  // ── 렌더링 ───────────────────────────────────────────────────
  return (
    <div className="p-4 pb-24 md:p-8 md:pb-12 max-w-4xl mx-auto space-y-6 md:space-y-10">
      <MaintenanceBanner />
      <DashboardHeader
        user={user}
        businesses={businesses ? businesses.map((b) => ({ ...b, naver_place_url: b.naver_place_url ?? undefined })) : null}
        business={bizBase ? { ...bizBase, naver_place_url: bizBase.naver_place_url ?? undefined } : null}
        plan={plan}
        isAdmin={isAdmin}
        onboardingDone={onboardingDone}
        briefingEligibility={briefingEligibility}
        accessToken={accessToken}
        scanInfo={scanInfo}
        lastScannedLabel={lastScannedLabel}
        scanUsed={scanUsed}
        scanLimit={scanLimit}
        showRescanNotice={showRescanNotice}
        lastQueryUsed={(latestScan?.query_used as string | undefined)}
        displayCity={displayCity}
      />

      {isFromOnboarding && bizBase && (
        <FirstScanBanner
          businessId={bizBase.id}
          businessName={bizBase.name}
          plan={plan}
          hasScanResult={!!latestScan}
        />
      )}

      {bizBase && (
        <>
          <DashboardScoreZone
            business={{ id: bizBase.id, name: bizBase.name, category: bizBase.category, region: bizBase.region, keywords: bizBase.keywords, is_franchise: isFranchise }}
            latestScan={latestScan ?? null}
            briefingEligibility={briefingEligibility}
            isFranchise={isFranchise}
            unifiedScore={unifiedScore}
            scoreChangeDiff={scoreChangeDiff}
            myRankInList={myRankInList}
            totalCompetitors={rankingItems.length}
            topMissingKeywords={topMissingKeywords}
            todayTasks={todayTasks}
            gapCloseable={gapCloseable}
            recentActionType={actionLogs[0]?.action_type ?? null}
            recentScoreGain={scoreChangeDiff !== null && scoreChangeDiff > 0 ? scoreChangeDiff : null}
            userCreatedAt={user.created_at ?? null}
            lastScannedLabel={lastScannedLabel}
          />

          <ContextTipBanner section="score" industry={bizBase.category} />

          <DashboardActionZone
            bizId={bizBase.id}
            accessToken={accessToken}
            hasLatestScan={!!latestScan}
            userCreatedAt={user.created_at ?? null}
            dimensions={dimensions}
            todayTasks={todayTasks}
            actionCopyText={actionCopyText}
            topMissingKeyword={topMissingKeywords[0] ?? null}
            unifiedScore={unifiedScore}
            isSmartPlace={!!(business?.naver_place_id)}
            plan={plan}
          />

          <DashboardInsightZone
            bizId={bizBase.id}
            accessToken={accessToken}
            subscriptionPlan={subscriptionPlan}
            plan={plan}
            category={bizBase.category}
            briefingMeta={briefingMeta}
            photoCategories={photoCategories}
            photoGuides={photoGuides}
            schemaSeoScore={(latestScan?.score_breakdown as Record<string, number> | null | undefined)?.schema_seo ?? null}
            websiteUrl={bizBase.website_url}
            websiteCheckResult={websiteCheckResult}
            blogMentionCount={(latestScan?.naver_result as { blog_mentions?: number } | null | undefined)?.blog_mentions ?? 0}
            isFranchise={isFranchise}
            keywordCount={bizBase.keywords?.length ?? 0}
            latestAdOnly={(latestScan?.naver_result as { ad_only?: boolean } | null | undefined)?.ad_only ?? false}
            userCreatedAt={user.created_at ?? null}
            globalWeight={globalWeight}
          />

          <DashboardGeneratorZone
            bizId={bizBase.id}
            planLabel={planLabel}
            planFaqLimit={planFaqLimit}
            naver_intro_draft={v41Extra?.naver_intro_draft}
            naver_intro_generated_at={v41Extra?.naver_intro_generated_at}
            talktalk_faq_draft={v41Extra?.talktalk_faq_draft as { items: Array<{ question: string; answer: string; category: string }>; chat_menus: string[] } | null | undefined}
            talktalk_faq_generated_at={v41Extra?.talktalk_faq_generated_at}
          />

          <DashboardDetailZone
            business={{
              id: bizBase.id, name: bizBase.name, category: bizBase.category, region: bizBase.region,
              website_url: bizBase.website_url, keywords: bizBase.keywords,
              review_count: bizBase.review_count, avg_rating: bizBase.avg_rating,
              naver_place_id: bizBase.naver_place_id, naver_place_url: bizBase.naver_place_url,
              google_place_id: bizBase.google_place_id,
              blog_url: bizBase.blog_url, blog_analyzed_at: bizBase.blog_analyzed_at,
              blog_post_count: bizBase.blog_post_count, blog_keyword_coverage: bizBase.blog_keyword_coverage,
              is_franchise: isFranchise,
            }}
            latestScan={latestScan}
            hasLatestScan={!!latestScan}
            accessToken={accessToken}
            plan={plan}
            subscriptionPlan={subscriptionPlan}
            briefingEligibility={briefingEligibility}
            isFranchise={isFranchise}
            track1Score={track1Score}
            track2Score={track2Score}
            naverWeight={naverWeight}
            globalWeight={globalWeight}
            unifiedScore={unifiedScore}
            growthStage={growthStage}
            growthStageLabel={growthStageLabel}
            isKeywordEstimated={isKeywordEstimated}
            topMissingKeywords={topMissingKeywords}
            benchmarkAvg={benchmark?.fallback ? undefined : benchmark?.avg_score}
            smartPlaceStatus={smartPlaceStatus}
            allPlatformResults={allPlatformResults}
            naverChannelScore={naverChannelScore}
            globalChannelScore={globalChannelScore}
            kakaoResult={kakaoResult}
            kakaoScore={kakaoScore}
            kakaoChecklist={kakaoChecklist}
            kakaoRegistered={kakaoRegistered}
            websiteCheckResult={websiteCheckResult}
            history={history ? history.map((h) => ({ ...h, exposure_freq: (h.exposure_freq as number | null) ?? 0 })) : null}
            actionLogs={actionLogs}
            rankingItems={rankingItems}
            myRankInList={myRankInList}
            topCompetitor={topCompetitor}
            competitorKeywordSources={competitorKeywordSources}
            missingItems={missingItems}
            aiExposureData={aiExposureData}
            blogContribution={blogContribution}
            scoreChangeDiff={scoreChangeDiff}
          />

          <DashboardFooter
            bizId={bizBase.id}
            bizName={bizBase.name}
            plan={plan}
            accessToken={accessToken}
          />
        </>
      )}
    </div>
  );
}
