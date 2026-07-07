import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SUPPORTED_CATEGORIES as PHOTO_SUPPORTED_CATEGORIES } from "@/lib/photoCategories";
import { getBriefingEligibility, getUserGroup } from "@/lib/userGroup";
import { fetchBriefingCategories } from "@/lib/briefingCategoriesServer";
import { getActiveBusinessId } from "@/lib/active-business";
import type { WebsiteCheckResult } from "@/types";
import DashboardHeader from "./sections/DashboardHeader";
import ScanWithModal from "./ScanWithModal";
import FirstScanBanner from "@/components/onboarding/FirstScanBanner";
import { MaintenanceBanner } from "@/components/dashboard/MaintenanceBanner";
import DashboardScoreZone from "./sections/DashboardScoreZone";
import DashboardActionZone from "./sections/DashboardActionZone";
import DashboardInsightZone from "./sections/DashboardInsightZone";

import DashboardDetailZone from "./sections/DashboardDetailZone";
import DashboardGuidanceZone from "./sections/DashboardGuidanceZone";
import DashboardGlobalAiZone from "./sections/DashboardGlobalAiZone";
import DashboardContentZone from "./sections/DashboardContentZone";
import CollapseSectionWrapper from "./sections/CollapseSectionWrapper";
import DashboardFooter from "./sections/DashboardFooter";
import NaverAiPathwayCard from "@/components/dashboard/NaverAiPathwayCard";
import ScanResultNavBar from "@/components/dashboard/ScanResultNavBar";
import DashboardDeliverableSignal from "@/components/dashboard/DashboardDeliverableSignal";
import DashboardEvidencePreview from "@/components/dashboard/DashboardEvidencePreview";
import BasicTrialBanner from "@/components/dashboard/BasicTrialBanner";
import { IneligibleBusinessNotice } from "@/components/dashboard/IneligibleBusinessNotice";
import { CATEGORY_LABEL } from "@/lib/categories";
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
    .select("id, name, category, region, business_type, website_url, naver_place_id, google_place_id, kakao_place_id, kakao_score, kakao_checklist, kakao_registered, is_active, naver_place_url, review_count, avg_rating, keywords, is_smart_place, has_faq, has_recent_post, has_intro, visitor_review_count, receipt_review_count, blog_url, blog_keyword_coverage, blog_post_count, blog_mention_count, blog_analyzed_at, checklist_overrides, is_franchise, ai_info_tab_status, naver_intro_draft, naver_intro_generated_at, global_intro_draft, global_intro_generated_at, talktalk_faq_draft, talktalk_faq_generated_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(5);

  const business = (activeBizId
    ? businesses?.find((b) => b.id === activeBizId)
    : businesses?.[0]) ?? null;
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
    .from("profiles").select("onboarding_done, basic_trial_used").eq("id", user.id).maybeSingle();
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
          .select("id, scanned_at, query_used, gemini_result, chatgpt_result, naver_result, google_result, kakao_result, website_check_result, smart_place_completeness_result, exposure_freq, total_score, unified_score, track1_score, track2_score, naver_weight, global_weight, growth_stage, growth_stage_label, is_keyword_estimated, keyword_coverage, score_breakdown, naver_channel_score, global_channel_score, rank_in_query, competitor_scores, top_missing_keywords, keyword_ranks, photo_categories, naver_ai_tab_visible, naver_ai_tab_excerpt")
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
  const subscriptionPlan = isAdmin ? "biz"
    : subscription?.status === "active" || subscription?.status === "grace_period"
    ? subscription?.plan ?? "free" : "free";
  const isTrialUser = !!(profileRow?.basic_trial_used) && plan === "free";
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
  const _allMissingKeywords: string[] = Array.isArray(latestScan?.top_missing_keywords)
    ? (latestScan!.top_missing_keywords as string[]) : [];
  const topMissingKeywords: string[] = isTrialUser
    ? _allMissingKeywords.slice(0, 4)
    : _allMissingKeywords.slice(0, 8);
  const trialHiddenKeywordCount = isTrialUser
    ? Math.max(0, _allMissingKeywords.slice(0, 8).length - 4)
    : 0;

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

  const latestScannedAt = latestScan?.scanned_at as string | null | undefined;
  const daysSinceScan = latestScannedAt
    ? Math.floor((Date.now() - new Date(latestScannedAt).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const showRescanIsStale = !showRescanNotice && daysSinceScan !== null && daysSinceScan >= 7;
  const showRescanNoticeFinal = showRescanNotice || showRescanIsStale;

  const lastScannedLabel = calcLastScannedLabel(latestScannedAt);
  const displayCity = calcDisplayCity(business?.region);

  const smartPlaceStatus = buildSmartPlaceStatus(latestScan, business ?? { has_faq: false, has_intro: false, has_recent_post: false, checklist_overrides: null });
  const allPlatformResults = buildAllPlatformResults(latestScan);
  const websiteCheckResult = castWebsiteCheckResult(latestScan?.website_check_result);
  const missingItems = extractMissingItems(latestScan);

  const kakaoResult = (latestScan?.kakao_result ?? null) as Record<string, unknown> | null;
  const kakaoScore = (business as { kakao_score?: number })?.kakao_score;
  const kakaoChecklist = (business as { kakao_checklist?: Record<string, boolean> })?.kakao_checklist;
  // OR 로직: 어느 소스든 true면 등록 확인. ?? 대신 || 사용 — false ?? true = false 버그 방지
  const kakaoRegistered =
    !!((kakaoResult as { is_on_kakao?: boolean } | null)?.is_on_kakao) ||
    !!((business as { kakao_registered?: boolean })?.kakao_registered) ||
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
    !!business?.is_franchise,
    briefingCats.active,
    briefingCats.likely,
  );
  const isFranchise = !!business?.is_franchise;

  const briefingMeta = (((latestScan?.score_breakdown as Record<string, unknown>)
    ?.track1_detail as Record<string, unknown> | undefined)
    ?.briefing_meta as {
      eligibility: "active" | "likely" | "inactive";
      ai_info_tab_status: "not_visible" | "off" | "on" | "disabled" | "unknown";
      explanation: string;
    } | undefined) ?? {
      eligibility: briefingEligibility,
      ai_info_tab_status: "unknown" as const,
      explanation: "",
    };

  const aiExposureData = latestScan ? {
    chatgptFreq: latestScan.chatgpt_result ? Number((latestScan.chatgpt_result as Record<string,unknown>).exposure_freq ?? 0) : undefined,
    chatgptSampleSize: latestScan.chatgpt_result ? Number((latestScan.chatgpt_result as Record<string,unknown>).sample_size ?? 0) : undefined,
    geminiFreq: latestScan.gemini_result ? Number((latestScan.gemini_result as Record<string,unknown>).exposure_freq ?? 0) : undefined,
    geminiSampleSize: latestScan.gemini_result ? Number((latestScan.gemini_result as Record<string,unknown>).sample_size ?? 0) : undefined,
  } : undefined;

  // 🔎 실측 증거 — ChatGPT가 내 가게를 실제 언급한 인용문 (없으면 미표시)
  const chatgptCitation: string | null = (() => {
    const cites = (latestScan?.chatgpt_result as { citations?: unknown[] } | null)?.citations;
    if (Array.isArray(cites)) {
      const first = cites.find((c) => typeof c === "string" && (c as string).trim().length > 0);
      if (first) return first as string;
    }
    return null;
  })();

  const photoCategories = (latestScan?.photo_categories as Record<string, number> | null) ?? null;
  const spCompleteness = (latestScan?.smart_place_completeness_result as { has_reservation?: boolean; photo_count?: number } | null) ?? null;
  const hasReservationVal: boolean | null = spCompleteness?.has_reservation ?? null;
  // photo_categories가 빈 {}이면 0이 되므로, 내용이 있을 때만 합산. 없으면 completeness 홈탭 실측값 폴백
  const photoCountTotal: number | null = photoCategories && Object.keys(photoCategories).length > 0
    ? Object.values(photoCategories).reduce((sum, v) => sum + (v as number), 0)
    : spCompleteness?.photo_count != null
      ? spCompleteness.photo_count
      : null;
  const cafeResult = (latestScan?.naver_result as Record<string, unknown> | null | undefined)?.cafe_result as { mentioned: boolean; mention_count: number; exposure_score: number; top_excerpts: string[] } | null ?? null;
  const jisikResult = (latestScan?.naver_result as Record<string, unknown> | null | undefined)?.jisik_result as { mentioned: boolean; mention_count: number; exposure_score: number; top_excerpts: string[] } | null ?? null;
  const blogBiz = business as { blog_url?: string; blog_analyzed_at?: string; blog_post_count?: number; blog_keyword_coverage?: number } | null;
  const blogContribution = blogBiz?.blog_url ? {
    active: !!(blogBiz.blog_analyzed_at) && !isKeywordEstimated,
    postCount: blogBiz.blog_post_count ?? 0,
    keywordCoverage: blogBiz.blog_keyword_coverage ?? 0,
    analyzedAt: blogBiz.blog_analyzed_at,
    blogUrl: blogBiz.blog_url,
  } : undefined;

  const dimensions = (gapRes as { dimensions?: Array<{ dimension_key: string; dimension_label: string; current_score: number; max_score: number; gap_to_top: number; gap_reason: string; priority: number }>; is_competitor_estimated?: boolean } | null)?.dimensions;
  const isCompetitorEstimated = !!(gapRes as { is_competitor_estimated?: boolean } | null)?.is_competitor_estimated;

  // ── 최근 행동 로그 파생 ───────────────────────────────────────
  const recentActionType = actionLogs[0]?.action_label ?? null;
  const recentScoreGain = (actionLogs[0]?.score_after != null && actionLogs[0]?.score_before != null)
    ? Math.round(actionLogs[0].score_after - actionLogs[0].score_before)
    : null;

  // ── 타입 단순화 헬퍼 ─────────────────────────────────────────
  const bizBase = business as {
    id: string; name: string; category: string; region: string;
    website_url?: string | null; naver_place_id?: string | null;
    naver_place_url?: string | null; google_place_id?: string | null;
    review_count?: number; avg_rating?: number; keywords?: string[];
    has_faq?: boolean | null; has_intro?: boolean | null; has_recent_post?: boolean | null;
    visitor_review_count?: number; receipt_review_count?: number;
    blog_url?: string; blog_analyzed_at?: string; blog_post_count?: number; blog_keyword_coverage?: number;
    blog_mention_count?: number;
    checklist_overrides?: Record<string, unknown> | null;
  } | null;

  const photoSufficient = !!(bizBase?.checklist_overrides?.['__photo_sufficient']);

  // 🎁 "받은 것" 신호 — AI 생성 산출물(실측, 없으면 미표시)
  const deliverableBiz = business as { naver_intro_draft?: string; global_intro_draft?: string; talktalk_faq_draft?: unknown } | null;
  const naverIntroReady = !!(deliverableBiz?.naver_intro_draft && String(deliverableBiz.naver_intro_draft).trim().length > 0);
  const globalIntroReady = !!(deliverableBiz?.global_intro_draft && String(deliverableBiz.global_intro_draft).trim().length > 0);
  const _ttDraft = deliverableBiz?.talktalk_faq_draft as { items?: unknown[]; chat_menus?: unknown[] } | unknown[] | null | undefined;
  const talktalkMenuCount = Array.isArray(_ttDraft)
    ? _ttDraft.length
    : Array.isArray((_ttDraft as { items?: unknown[] })?.items)
    ? (_ttDraft as { items: unknown[] }).items.length
    : Array.isArray((_ttDraft as { chat_menus?: unknown[] })?.chat_menus)
    ? (_ttDraft as { chat_menus: unknown[] }).chat_menus.length
    : 0;

  // ── 렌더링 ───────────────────────────────────────────────────
  return (
    <div className="p-4 pb-24 md:p-8 md:pb-12 space-y-6 md:space-y-10 max-w-6xl mx-auto">
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
        showRescanNotice={showRescanNoticeFinal}
        rescanIsStale={showRescanIsStale}
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
          {/* ① 진단 Hero + 스캔 트리거 — lg(≥1024) 2단(좌 진단·우 스캔).
              그 미만 세로: 스캔 이력 있으면(재방문) 진단(현황) 먼저, 없으면(신규) 스캔 먼저 — 사장님 "현황 먼저" 철학 반영.
              md(768~1023)에서 2단을 막는 이유: 사이드바 w-60(240px)+스캔 340px를 빼면 hero가 너무 좁아 3채널 그리드가 깨짐 */}
          <div className="flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-5">
            {/* 스캔 트리거 — 모바일: 진단 있으면 order-2(진단 뒤), 없으면 order-1(먼저). lg에서 항상 order-2(우측 고정폭) */}
            <div className={`${latestScan ? "order-2" : "order-1"} lg:order-2 w-full lg:w-[340px] lg:shrink-0`} data-onboarding-tour="scan-button">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <ScanWithModal
                  businessId={bizBase.id}
                  businessName={bizBase.name}
                  category={bizBase.category}
                  region={bizBase.region}
                  keywords={bizBase.keywords}
                  scanUsed={scanUsed}
                  scanLimit={scanLimit}
                  plan={plan}
                  lastQueryUsed={(latestScan?.query_used as string | undefined)}
                  stacked
                  secondary={!!latestScan}
                />
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-0.5">
                  <p className="text-sm font-semibold text-slate-600 leading-snug">📅 개선 후 반영 예상 기간</p>
                  <p className="text-sm text-slate-500 leading-snug">· 스마트플레이스 정보 업데이트: <strong className="text-slate-700">즉시~수일</strong></p>
                  <p className="text-sm text-slate-500 leading-snug">· 네이버 검색 순위 변화: <strong className="text-slate-700">1~4주</strong> <span className="text-xs text-gray-400">(경쟁·지역 따라 다름)</span></p>
                  <p className="text-sm text-slate-500 leading-snug">· 네이버 AI 브리핑·AI탭: <strong className="text-slate-700">2~4주</strong> <span className="text-xs text-gray-400">(추정, 네이버 미공개)</span></p>
                  <p className="text-sm text-slate-500 leading-snug">· Gemini: <strong className="text-slate-700">수 주~수개월</strong> (Google 검색 실시간 연동)</p>
                  <p className="text-sm text-slate-500 leading-snug">· ChatGPT: <strong className="text-slate-700">수개월~1년</strong> (학습 데이터 기반)</p>
                </div>
              </div>
            </div>

            {/* 진단 hero — 모바일: 스캔 있으면 order-1(먼저), 없으면 order-2(스캔 다음). lg에서 항상 order-1(좌측 flex-1) */}
            <div className={`${latestScan ? "order-1" : "order-2"} lg:order-1 lg:flex-1 min-w-0`}>
              {latestScan ? (
                <DashboardScoreZone
                  business={{
                    id: bizBase.id, name: bizBase.name, category: bizBase.category, region: bizBase.region,
                    keywords: bizBase.keywords, is_franchise: isFranchise,
                  }}
                  latestScan={{
                    naver_result: (latestScan.naver_result as { in_briefing?: boolean; captcha_detected?: boolean; error?: string; ad_only?: boolean } | null) ?? null,
                    chatgpt_result: (latestScan.chatgpt_result as { mentioned?: boolean; exposure_freq?: number; sample_size?: number } | null) ?? null,
                    gemini_result: (latestScan.gemini_result as { exposure_freq?: number; sample_size?: number } | null) ?? null,
                    google_result: (latestScan.google_result as { mentioned?: boolean; exposure_freq?: number; sample_size?: number } | null) ?? null,
                    keyword_ranks: (latestScan.keyword_ranks as Record<string, unknown> | null) ?? null,
                    track1_score: latestScan.track1_score as number | null,
                    naver_ai_tab_visible: latestScan.naver_ai_tab_visible as boolean | null,
                  }}
                  briefingEligibility={briefingEligibility}
                  unifiedScore={unifiedScore}
                  scoreChangeDiff={scoreChangeDiff}
                  topMissingKeywords={topMissingKeywords}
                  todayTasks={todayTasks}
                  lastScannedLabel={lastScannedLabel}
                  myRankInList={myRankInList}
                  totalCompetitors={rankingItems.length}
                  benchmarkAvg={benchmark?.fallback ? undefined : benchmark?.avg_score}
                  showStaleRescan={showRescanIsStale}
                />
              ) : (
                /* 첫 스캔 온보딩 — 스캔 후 나타날 정보 미리보기 */
                <div className="bg-gradient-to-br from-slate-50 to-blue-50 border border-blue-100 rounded-xl p-5 space-y-4">
                  <div>
                    <p className="text-base font-bold text-gray-800">스캔하면 이런 정보가 나옵니다</p>
                    <p className="text-sm text-gray-500 mt-0.5 leading-snug">오른쪽에서 키워드를 선택하고 AI 스캔을 시작하세요</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {([
                      { icon: "🔍", title: "네이버 3채널 실측", desc: "AI 브리핑·AI탭·일반검색 노출 여부" },
                      { icon: "🤖", title: "ChatGPT·Gemini 측정", desc: "50회 질문 중 내 가게 언급 횟수" },
                      { icon: "📊", title: "경쟁사 순위 비교", desc: "동네 경쟁 가게 대비 내 위치" },
                      { icon: "✅", title: "오늘 할 일 안내", desc: "AI 노출 높이는 구체적 액션" },
                    ] as { icon: string; title: string; desc: string }[]).map(({ icon, title, desc }) => (
                      <div key={title} className="bg-white rounded-lg border border-gray-100 px-3 py-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-base leading-none">{icon}</span>
                          <p className="text-sm font-semibold text-gray-800 leading-tight">{title}</p>
                        </div>
                        <p className="text-xs text-gray-500 leading-snug">{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 🎁 Basic 무료 체험 배너 — 비구독 사용자에게만 표시 (체험 전: 유도 / 체험 후: 구독 CTA) */}
          {plan === "free" && accessToken && bizBase && (
            <BasicTrialBanner businessId={bizBase.id} businessName={bizBase.name} authToken={accessToken} />
          )}

          {/* 📊 경쟁사 미등록 — 등록 유도 CTA */}
          {latestScan && (competitors?.length ?? 0) === 0 && (
            <div className="flex items-center justify-between gap-3 bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base shrink-0">📊</span>
                <p className="text-sm text-gray-700 leading-snug">
                  <span className="font-semibold">경쟁사를 등록</span>하면 내 가게 순위와 키워드 격차를 확인할 수 있습니다
                </p>
              </div>
              <a
                href="/competitors"
                className="shrink-0 text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors"
              >
                등록하기
              </a>
            </div>
          )}

          {/* ① 네이버 채널별 개선 방법 — 소상공인 최우선 채널. Hero 바로 다음에 배치 */}
          <CollapseSectionWrapper id="section-naver" title="네이버 채널별 개선 방법" description="노출 높이는 구체적 방법 — 요약 상태는 위 진단 카드 참고" iconColor="text-green-600" defaultOpen={true} highlight={true}>
            <>
              {/* 4타일 NavBar — 섹션 최상단 */}
              {latestScan && (
                <div className="mb-4">
                  <ScanResultNavBar
                    eligibility={briefingEligibility}
                    naverInBriefing={
                      (latestScan.naver_result as { in_briefing?: boolean } | null)?.in_briefing ?? false
                    }
                    naverCaptchaBlocked={
                      (latestScan.naver_result as { captcha_detected?: boolean } | null)?.captcha_detected ?? false
                    }
                    myRankInList={myRankInList}
                    totalCompetitors={rankingItems.length}
                    topMissingKeywordCount={topMissingKeywords.length}
                    latestAdOnly={
                      (latestScan.naver_result as { ad_only?: boolean } | null)?.ad_only ?? false
                    }
                    naverAiTabVisible={latestScan.naver_ai_tab_visible as boolean | null ?? null}
                    isFranchise={isFranchise}
                  />
                </div>
              )}
              {/* 비해당 업종 안내 */}
              {briefingEligibility !== "active" && bizBase?.category && (
                <div className="mb-4">
                  <IneligibleBusinessNotice
                    category={bizBase.category}
                    categoryLabel={CATEGORY_LABEL[bizBase.category] ?? bizBase.category}
                    eligibility={briefingEligibility}
                    isFranchise={isFranchise}
                  />
                </div>
              )}
              <DashboardInsightZone
                bizId={bizBase.id}
                accessToken={accessToken}
                subscriptionPlan={subscriptionPlan}
                plan={plan}
                category={bizBase.category}
                briefingMeta={briefingMeta}
                photoCategories={photoCategories}
                photoGuides={photoGuides}
                blogMentionCount={bizBase?.blog_mention_count ?? 0}
                reviewCount={bizBase.review_count ?? 0}
                hasIntro={smartPlaceStatus.hasIntro}
                hasRecentPost={smartPlaceStatus.hasRecentPost}
                hasReservation={hasReservationVal}
                photoCount={photoCountTotal}
                naverPlaceId={bizBase.naver_place_id ?? null}
                photoSufficient={photoSufficient}
                recentPostConfirmedAt={smartPlaceStatus.recentPostConfirmedAt}
                isFranchise={isFranchise}
                keywordCount={bizBase.keywords?.length ?? 0}
                latestAdOnly={(latestScan?.naver_result as { ad_only?: boolean } | null | undefined)?.ad_only ?? false}
                cafeResult={cafeResult}
                jisikResult={jisikResult}
                keywords={bizBase.keywords ?? []}
                initialKeywordRanks={(latestScan?.keyword_ranks as Record<string, unknown> | null) ?? null}
                userGroup={(() => { const rawGroup = getUserGroup(bizBase.category, isFranchise, briefingCats.active, briefingCats.likely); return rawGroup === "franchise" ? "INACTIVE" : rawGroup as "ACTIVE" | "LIKELY" | "INACTIVE"; })()}
                region={bizBase.region}
                />
            </>
          </CollapseSectionWrapper>

          {/* ② 콘텐츠 생성 도구 — 네이버 소개글·톡톡 메뉴 (네이버 도구 → 네이버 섹션 바로 다음 배치) */}
          <CollapseSectionWrapper id="section-content" title="콘텐츠 생성 도구" description="네이버 소개글 · 톡톡 채팅방 메뉴 초안 — 펼쳐서 생성·복사" iconColor="text-purple-600" defaultOpen={false} badgeText={latestScan && !naverIntroReady ? "소개글 없음" : undefined} badgeColor="amber">
            <DashboardContentZone
              bizId={bizBase.id}
              plan={plan}
              planLabel={planLabel}
              planFaqLimit={planFaqLimit}
              naverIntroDraft={business?.naver_intro_draft}
              naverIntroGeneratedAt={business?.naver_intro_generated_at}
              talktalkFaqDraft={business?.talktalk_faq_draft as { items: Array<{ question: string; answer: string; category: string }>; chat_menus: string[] } | null | undefined}
              talktalkFaqGeneratedAt={business?.talktalk_faq_generated_at}
            />
          </CollapseSectionWrapper>

          {/* ③ 오늘 할 일 — 네이버 현황·도구 파악 후 행동 지시 (모바일: 기본 접힘 → 스크롤 단축) */}
          <CollapseSectionWrapper id="section-action" title="오늘 할 일" description="지금 바로 실행할 액션" iconColor="text-rose-500" defaultOpen={true} mobileDefaultOpen={false}>
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
              deprioritizeGlobal={true}
              isTrialUser={isTrialUser}
            />
          </CollapseSectionWrapper>

          {/* 🔎 실측 증거 미리보기 — ChatGPT 실제 인용문 (글로벌 AI 데이터, 없으면 미표시) */}
          {latestScan && (
            <DashboardEvidencePreview
              chatgptCitation={chatgptCitation}
              myRankInList={myRankInList}
              totalCompetitors={rankingItems.length}
            />
          )}

          {/* 🎁 받은 것 신호 — AI 생성 산출물 (실측, 없으면 미표시) */}
          <DashboardDeliverableSignal
            naverIntroReady={naverIntroReady}
            talktalkMenuCount={talktalkMenuCount}
            globalIntroReady={globalIntroReady}
          />

          {/* ⑤ 상세 분석 데이터 — 접힘 */}
          <CollapseSectionWrapper id="section-detail" title="상세 분석 데이터" description="채널별 분석 · 경쟁사 비교 · AI 인용" iconColor="text-indigo-600">
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
          </CollapseSectionWrapper>

          {/* ⑥ 글로벌 AI — INACTIVE/프랜차이즈는 핵심 대안 채널이나, 자동 펼침 시 ①③과 겹쳐 페이지 과다 길어짐(2026-07-07 실측) → 배지로 우선순위만 표시 */}
          <CollapseSectionWrapper id="section-global" title="글로벌 AI 현황" description="ChatGPT · Gemini · Google AI 실측 · 글로벌 소개글" iconColor="text-blue-500" defaultOpen={false} badgeText={(briefingEligibility === "inactive" || isFranchise) ? "핵심 채널" : undefined} badgeColor="blue">
            <DashboardGlobalAiZone
              category={bizBase.category}
              plan={plan}
              schemaSeoScore={(latestScan?.score_breakdown as Record<string, number> | null | undefined)?.schema_seo ?? null}
              websiteUrl={bizBase.website_url}
              websiteCheckResult={websiteCheckResult}
              globalWeight={globalWeight}
              googlePlaceRegistered={!!bizBase.google_place_id}
              bizId={bizBase.id}
              planLabel={planLabel}
              planFaqLimit={planFaqLimit}
              globalIntroDraft={business?.global_intro_draft}
              globalIntroGeneratedAt={business?.global_intro_generated_at}
              chatgptFreq={aiExposureData?.chatgptFreq}
              chatgptSampleSize={aiExposureData?.chatgptSampleSize}
              geminiFreq={aiExposureData?.geminiFreq}
              geminiSampleSize={aiExposureData?.geminiSampleSize}
              googleMentioned={(() => { const g = allPlatformResults.google; if (!g || g.error) return null; return !!(g.in_ai_overview ?? g.mentioned); })()}
              googleError={!!allPlatformResults.google?.error}
            />
          </CollapseSectionWrapper>

          {/* ⑧ AI 채널 안내 · 심화 가이드 — 접힘, 최하단 */}
          <CollapseSectionWrapper id="section-guidance" title="AI 채널 안내 · 심화 가이드" description="채널 노출 조건 · 단계 가이드 · 경쟁사 분석" iconColor="text-gray-400">
            <>
              <NaverAiPathwayCard
                briefingEligibility={briefingEligibility}
                isFranchise={isFranchise}
                latestAdOnly={(latestScan?.naver_result as { ad_only?: boolean } | null | undefined)?.ad_only ?? false}
                globalWeight={globalWeight}
              />
              <DashboardGuidanceZone
                bizId={bizBase.id}
                eligibility={briefingEligibility}
                plan={plan}
                hasLatestScan={!!latestScan}
                isCompetitorEstimated={isCompetitorEstimated}
                userCreatedAt={user.created_at ?? null}
                category={bizBase.category}
              />
            </>
          </CollapseSectionWrapper>

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
