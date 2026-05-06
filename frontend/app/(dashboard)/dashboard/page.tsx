import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AIDiagnosisCard from "@/components/dashboard/AIDiagnosisCard";
import { RankingBar } from "@/components/dashboard/RankingBar";
import { TrendLine } from "@/components/dashboard/TrendLine";
import { ResultTable } from "@/components/scan/ResultTable";
import { WebsiteCheckCard } from "@/components/dashboard/WebsiteCheckCard";
import ScanWithModal from "./ScanWithModal";
import { BriefingTimeline } from "@/components/dashboard/BriefingTimeline";
import KakaoChecklistCard from "@/components/dashboard/KakaoChecklistCard";
import { RescanBanner } from "./RescanBanner";
import { NewCompetitorAlert } from "@/components/dashboard/NewCompetitorAlert";
import ConversionGuideSection from "@/components/dashboard/ConversionGuideSection";
import Link from "next/link";
import { MentionContextSection } from "./MentionContextSection";
import { Search, ChevronRight, Share2, CheckCircle2, RefreshCw, Lightbulb, Store, BarChart2, TrendingUp } from "lucide-react";
import DashboardHeroCard from "@/components/dashboard/DashboardHeroCard";
import BusinessQuickEditButton from "./BusinessQuickEditButton";
import { CATEGORY_LABEL } from "@/lib/categories";
import { OnboardingProgressBar } from "@/components/dashboard/OnboardingProgressBar";
import { IneligibleBusinessNotice } from "@/components/dashboard/IneligibleBusinessNotice";
import { MultiBizTable } from "@/components/dashboard/MultiBizTable";
import { SentimentDashboard } from "@/components/dashboard/SentimentDashboard";
import ConditionSearchCard from "@/components/dashboard/ConditionSearchCard";
import AICitationCard from "@/components/dashboard/AICitationCard";
import ProUpgradePreview from "@/components/dashboard/ProUpgradePreview";
import DashboardAccordion from "./DashboardAccordion";
import DualTrackCard from "@/components/dashboard/DualTrackCard";
import CompetitorKeywordCompare from "@/components/dashboard/CompetitorKeywordCompare";
import AISearchScreenshotCard from "@/components/dashboard/AISearchScreenshotCard";
import AIAssistant from "@/components/common/AIAssistant";
import SmartplaceAutoCheck from "@/components/dashboard/SmartplaceAutoCheck";
import KeywordTrendChart from "@/components/dashboard/KeywordTrendChart";
import DailyMissionCard from "@/components/dashboard/DailyMissionCard";
import BasicTrialBanner from "@/components/dashboard/BasicTrialBanner";
import { PlatformDistributionChart } from "@/components/dashboard/PlatformDistributionChart";
import { ChannelScoreCards } from "@/components/dashboard/ChannelScoreCards";
import { GlobalAIBanner } from "@/components/dashboard/GlobalAIBanner";
import { GlobalAIChecklist } from "@/components/dashboard/GlobalAIChecklist";
import ScoreEvidenceCard from "@/components/dashboard/ScoreEvidenceCard";
import ChatGPTDiffCard from "@/components/dashboard/ChatGPTDiffCard";
import Action7DayChart from "@/components/dashboard/Action7DayChart";
import CompetitorFAQCard from "@/components/dashboard/CompetitorFAQCard";
import Day7ActionCard from "@/components/dashboard/Day7ActionCard";
import TrialAttachTracker from "@/components/dashboard/TrialAttachTracker";
import OnboardingTour from "@/components/dashboard/OnboardingTour";
import VisitDeltaBanner from "@/components/dashboard/VisitDeltaBanner";
import MonthlyChecklistCard from "@/components/dashboard/MonthlyChecklistCard";
import ScoreAttributionCard from "@/components/dashboard/ScoreAttributionCard";
import { AiInfoTabStatusCard } from "@/components/dashboard/AiInfoTabStatusCard";
import { IntroGeneratorCard } from "@/components/dashboard/IntroGeneratorCard";
import { TalktalkFAQGeneratorCard } from "@/components/dashboard/TalktalkFAQGeneratorCard";
import KeywordRankCard from "@/components/dashboard/KeywordRankCard";
import AiTabPreviewCard from "@/components/dashboard/AiTabPreviewCard";
import PhotoCategoryCard from "@/components/dashboard/PhotoCategoryCard";
import ReviewKeywordGapCard from "@/components/dashboard/ReviewKeywordGapCard";
import type { MissingItem } from "@/types/diagnosis";
import { getBriefingEligibility } from "@/lib/userGroup";
import { getActiveBusinessId } from "@/lib/active-business";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface Benchmark {
  count: number;
  avg_score: number;
  top10_score: number;
  distribution: { range: string; count: number }[];
}

const BREAKDOWN_ACTIONS: Record<string, { action: string; link: string }> = {
  exposure_freq:            { action: "스마트플레이스 대표 키워드를 추가·정리하세요",              link: "/schema" },
  review_quality:           { action: "단골 손님 1명에게 네이버 리뷰를 요청하세요",              link: "/guide" },
  schema_score:             { action: "스마트플레이스 소개글·영업시간·메뉴를 업데이트하세요",      link: "/schema" },
  online_mentions:          { action: "블로그 후기 1건을 요청하거나 직접 작성하세요",             link: "/schema" },
  info_completeness:        { action: "전화번호·영업시간·주소 정보를 확인하고 채워주세요",        link: "/schema" },
  content_freshness:        { action: "최근 공지나 메뉴 변경 사항을 스마트플레이스에 등록하세요",  link: "/schema" },
  keyword_gap_score:        { action: "부족한 키워드를 소개글·톡톡 채팅방 메뉴에 추가하세요",    link: "/guide" },
  smart_place_completeness: { action: "소개글 하단에 Q&A를 추가하면 점수가 즉시 오릅니다",       link: "/guide" },
  naver_exposure_confirmed: { action: "소개글에 Q&A를 포함하고 소개글 키워드를 보강하세요",      link: "/guide" },
};

const SCAN_DAILY_LIMITS: Record<string, number> = {
  free: 0, basic: 2, pro: 5, startup: 3, biz: 999,
};

function iGa(name: string): string {
  const last = name[name.length - 1];
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return `${name}이(가)`;
  return (code - 0xac00) % 28 !== 0 ? `${name}이` : `${name}가`;
}

function nextScanLabel(plan: string | null | undefined): { label: string; desc: string } {
  const p = plan ?? "free";
  if (p === "biz")     return { label: "매일 새벽 자동 스캔", desc: "내일 새벽 2시에 전체 AI 채널 분석합니다" };
  if (p === "startup") return { label: "매일 빠른 스캔 (월요일 전체)", desc: "매일 주요 AI 빠른 스캔, 월요일 새벽 2시에 전체 분석합니다" };
  if (p === "pro")     return { label: "주 3회 자동 스캔 (월·수·금)", desc: "월·수·금 새벽 2시에 전체 AI 채널 분석합니다" };
  if (p === "basic")   return { label: "매일 빠른 스캔 (월요일 전체)", desc: "매일 주요 AI 빠른 스캔, 월요일 새벽 2시에 전체 분석합니다" };
  return { label: "자동 스캔 없음", desc: "유료 플랜으로 업그레이드하면 자동 스캔을 이용할 수 있습니다" };
}

const PLAN_BIZ_LIMITS: Record<string, number> = { free: 1, basic: 1, startup: 1, pro: 2, biz: 5 };


export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ rescan?: string; biz_id?: string }>;
}) {
  const params = await searchParams;
  const showRescanNotice = params.rescan === "1";
  const selectedBizId = params.biz_id ?? null;

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user || error) redirect("/login");
  // getUser()는 accessToken을 반환하지 않으므로 서버→백엔드 Bearer 토큰 전달에 getSession() 필요
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token ?? "";

  // URL param이 없으면 cookie 기반 활성 사업장 결정
  const activeBizId = selectedBizId ?? await getActiveBusinessId(user.id);

  // 기본 컬럼 SELECT (v4.1 신규 컬럼 is_franchise/naver_intro_draft 등은 별도 페치)
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name, category, region, business_type, website_url, naver_place_id, google_place_id, kakao_place_id, kakao_score, kakao_checklist, kakao_registered, is_active, naver_place_url, review_count, avg_rating, keywords, is_smart_place, has_faq, has_recent_post, has_intro, visitor_review_count, receipt_review_count, blog_url, blog_keyword_coverage, blog_post_count, blog_analyzed_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(5);

  // v4.1 컬럼 (is_franchise, ai_info_tab_status, naver_intro_draft 등) 별도 SELECT (미존재 시 graceful skip)
  const businessIds = (businesses ?? []).map((b) => b.id);
  let v41ExtraMap: Record<string, { is_franchise?: boolean; ai_info_tab_status?: string; naver_intro_draft?: string; naver_intro_generated_at?: string; talktalk_faq_draft?: unknown; talktalk_faq_generated_at?: string }> = {};
  if (businessIds.length > 0) {
    try {
      const v41Res = await supabase
        .from("businesses")
        .select("id, is_franchise, ai_info_tab_status, naver_intro_draft, naver_intro_generated_at, talktalk_faq_draft, talktalk_faq_generated_at")
        .in("id", businessIds);
      if (!v41Res.error && v41Res.data) {
        v41ExtraMap = Object.fromEntries(v41Res.data.map((r: Record<string, unknown>) => [r.id as string, r]));
      }
    } catch {
      // v4.1 컬럼 미존재 — 무시하고 기본값 사용
    }
  }

  const business = (activeBizId
    ? businesses?.find((b) => b.id === activeBizId)
    : businesses?.[0]) ?? null;

  // v4.1 신규 컬럼 추출 (선택된 사업장 기준)
  const v41Extra = business ? v41ExtraMap[business.id] : undefined;

  const todayISO = new Date().toISOString().split("T")[0];

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", user.id)
    .maybeSingle();

  // 플랜별 소개글/FAQ 자동 생성 한도 (faq_monthly 공유, plan_gate.py 기준)
  const _activePlan = (subscription?.status === "active" || subscription?.status === "grace_period") ? subscription.plan : "free";
  const planLabel = ({ free: "Free", basic: "Basic", startup: "창업패키지", pro: "Pro", biz: "Biz", enterprise: "Enterprise" } as Record<string, string>)[_activePlan ?? "free"] ?? "Free";
  // 백엔드 plan_gate.py PLAN_LIMITS.faq_monthly와 동기화 (Pro·창업패키지·Biz·Enterprise = 무제한 999)
  const planFaqLimit = ({ free: 0, basic: 5, startup: 999, pro: 999, biz: 999, enterprise: 999 } as Record<string, number>)[_activePlan ?? "free"] ?? 0;

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("onboarding_done")
    .eq("id", user.id)
    .maybeSingle();
  let onboardingDone = profileRow?.onboarding_done ?? false;
  // 사업장이 이미 있는데 onboarding_done=false 로 남은 경우 → 자동 완료 처리 (버그 복구)
  if (!onboardingDone && business) {
    await supabase
      .from("profiles")
      .upsert({ id: user.id, onboarding_done: true }, { onConflict: "id" });
    onboardingDone = true;
  }

  const [
    { data: scanResults },
    { data: competitors },
    { data: history },
    benchmarkRes,
    { data: latestGuide },
    { count: scanUsedToday },
    actionLogRes,
    gapRes,
  ] = business
    ? await Promise.all([
        supabase
          .from("scan_results")
          .select("id, scanned_at, query_used, gemini_result, chatgpt_result, naver_result, google_result, kakao_result, website_check_result, smart_place_completeness_result, exposure_freq, total_score, unified_score, track1_score, track2_score, naver_weight, global_weight, growth_stage, growth_stage_label, is_keyword_estimated, keyword_coverage, score_breakdown, naver_channel_score, global_channel_score, rank_in_query, competitor_scores, top_missing_keywords, keyword_ranks, photo_categories")
          .eq("business_id", business.id)
          .order("scanned_at", { ascending: false })
          .limit(1),
        supabase
          .from("competitors")
          .select("id, name")
          .eq("business_id", business.id)
          .eq("is_active", true),
        supabase
          .from("score_history")
          .select("id, business_id, score_date, total_score, exposure_freq, unified_score, track1_score, track2_score, context, created_at")
          .eq("business_id", business.id)
          .order("score_date", { ascending: false })
          .limit(30),
        business.category && business.region
          ? fetch(`${BACKEND}/api/report/benchmark/${business.category}/${encodeURIComponent(business.region)}`)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          : Promise.resolve(null),
        supabase
          .from("guides")
          .select("priority_json, next_month_goal, tools_json")
          .eq("business_id", business.id)
          .order("generated_at", { ascending: false })
          .limit(1)
          .then((r) => ({ data: r.data?.[0] ?? null })),
        supabase
          .from("scan_results")
          .select("id", { count: "exact", head: true })
          .eq("business_id", business.id)
          .gte("scanned_at", todayISO + "T00:00:00"),
        accessToken
          ? fetch(`${BACKEND}/api/report/action-log/${business.id}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            })
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          : Promise.resolve(null),
        accessToken
          ? fetch(`${BACKEND}/api/report/gap/${business.id}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            })
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          : Promise.resolve(null),
      ])
    : [
        { data: null },
        { data: null },
        { data: null },
        null,
        { data: null },
        { count: 0 },
        null,
        null,
      ];

  const benchmark: Benchmark | null = benchmarkRes ?? null;
  const actionLogs: Array<{
    action_type: string;
    action_label: string;
    action_date: string;
    score_before: number | null;
    score_after: number | null;
  }> =
    (actionLogRes as { logs?: unknown[] } | null)?.logs as Array<{
      action_type: string;
      action_label: string;
      action_date: string;
      score_before: number | null;
      score_after: number | null;
    }> ?? [];
  const latestScan = scanResults?.[0];
  const competitorKeywordSources: Record<string, string[]> =
    (gapRes as { keyword_gap?: { competitor_keyword_sources?: Record<string, string[]> } } | null)
      ?.keyword_gap?.competitor_keyword_sources ?? {};

  const ADMIN_EMAILS_LIST = (process.env.ADMIN_EMAILS ?? "hoozdev@gmail.com")
    .split(",")
    .map((e) => e.trim().toLowerCase());
  const isAdmin = ADMIN_EMAILS_LIST.includes((user.email ?? "").toLowerCase());
  const plan = isAdmin
    ? "biz"
    : subscription?.status === "active" || subscription?.status === "grace_period"
    ? subscription?.plan ?? "free"
    : "free";
  const subscriptionPlan =
    subscription?.status === "active" || subscription?.status === "grace_period"
      ? subscription?.plan ?? "free"
      : "free";
  const scanInfo = isAdmin
    ? { label: "자동 스캔 없음 (관리자)", desc: "관리자 계정은 자동 스캔 대상에서 제외됩니다" }
    : nextScanLabel(plan);
  const devMode = process.env.NEXT_PUBLIC_DEV_MODE === "true";
  const scanLimit = (isAdmin || devMode) ? 999 : SCAN_DAILY_LIMITS[plan] ?? 0;
  const scanUsed = scanUsedToday ?? 0;

  type GuideData = {
    priority_json?: string[];
    next_month_goal?: string;
    tools_json?: {
      faq_list?: { question: string; answer: string }[];
      review_request_message?: string;
      naver_post_template?: string;
      briefing_summary?: string;
      direct_briefing_paths?: { path_label?: string; ready_text?: string; minutes?: number }[];
      smart_place_checklist?: string[];
      keyword_list?: string[];
    };
  } | null;
  const guideData = latestGuide as GuideData;

  let todayAction: { text: string; link: string } | null = null;
  const guideTopAction = guideData?.priority_json?.[0] ?? null;
  if (guideTopAction) {
    todayAction = { text: guideTopAction, link: "/guide" };
  } else if (latestScan?.score_breakdown) {
    const completedKeys = new Set<string>();
    if (business?.has_intro) completedKeys.add("schema_score");
    if (business?.has_faq) completedKeys.add("smart_place_completeness");
    const sorted = Object.entries(latestScan.score_breakdown as Record<string, number>)
      .filter(([key]) => BREAKDOWN_ACTIONS[key] && !completedKeys.has(key))
      .sort(([, a], [, b]) => Number(a) - Number(b));
    const lowest = sorted[0];
    if (lowest && BREAKDOWN_ACTIONS[lowest[0]]) {
      todayAction = { text: BREAKDOWN_ACTIONS[lowest[0]].action, link: BREAKDOWN_ACTIONS[lowest[0]].link };
    }
  }

  const briefingPathLabel = guideData?.tools_json?.direct_briefing_paths?.[0]?.path_label ?? null;
  const faqQuestion = guideData?.tools_json?.faq_list?.[0]?.question ?? null;

  const topMissingKeywords: string[] = Array.isArray(latestScan?.top_missing_keywords)
    ? latestScan.top_missing_keywords.slice(0, 5)
    : [];

  // v단계1 — briefing_meta: 백엔드가 track1_detail.briefing_meta로 반환, scan_result 최상위에도 병합 가능
  const briefingMeta = (latestScan as Record<string, unknown> | null)?.briefing_meta as {
    eligibility: "active" | "likely" | "inactive";
    ai_info_tab_status: "not_visible" | "off" | "on" | "disabled" | "unknown";
    explanation: string;
  } | undefined;

  // v단계1 — missing 항목 (priority === "critical" 포함)
  const missingItems: MissingItem[] = Array.isArray(
    (latestScan as Record<string, unknown> | null)?.missing
  )
    ? ((latestScan as Record<string, unknown>).missing as MissingItem[])
    : [];

  const actionCardToday: string | null = (() => {
    if (todayAction?.text) return todayAction.text;
    if (briefingPathLabel) return `오늘 스마트플레이스에서 '${briefingPathLabel}'을 실행하세요`;
    if (faqQuestion) return `소개글 하단에 '${faqQuestion}' Q&A를 추가하세요`;
    const kw = topMissingKeywords[0] ?? null;
    if (kw) return `소개글·톡톡 채팅방 메뉴에 '${kw}' 관련 Q&A를 1개 추가하세요 (AI 브리핑 노출 효과)`;
    return null;
  })();

  const actionCardWeek = topMissingKeywords[1]
    ? `소개글·포스트에 '${topMissingKeywords[1]}' 키워드를 자연스럽게 포함하세요`
    : topMissingKeywords[0]
    ? `소개글·포스트에 '${topMissingKeywords[0]}' 키워드를 자연스럽게 포함하세요`
    : guideData?.tools_json?.naver_post_template
    ? "스마트플레이스 '소식' 탭에 새 공지를 등록하세요"
    : null;
  const actionCardMonth = guideData?.next_month_goal ?? null;

  const competitorScores: Record<string, { name: string; score: number }> =
    latestScan?.competitor_scores ?? {};
  const rankingItems = [
    ...(competitors ?? []).map((c) => ({
      name: c.name,
      score: competitorScores[c.id]?.score ?? 0,
    })),
    { name: business?.name ?? "", score: latestScan?.total_score ?? 0, isMe: true },
  ];

  const naverChannelScore = latestScan?.naver_channel_score ?? null;
  const globalChannelScore = latestScan?.global_channel_score ?? null;
  const track1Score = latestScan?.track1_score ?? naverChannelScore ?? 0;
  const track2Score = latestScan?.track2_score ?? globalChannelScore ?? latestScan?.total_score ?? 0;
  const unifiedScore = latestScan?.unified_score ?? latestScan?.total_score ?? 0;
  const naverWeight = latestScan?.naver_weight ?? 0.65;
  const globalWeight = latestScan?.global_weight ?? 0.35;
  const growthStage = latestScan?.growth_stage ?? "stability";
  const growthStageLabel = latestScan?.growth_stage_label ?? "성장 중";
  const isKeywordEstimated = latestScan?.is_keyword_estimated ?? false;

  // 마지막 스캔 시각 표시 계산
  const lastScannedLabel: string | null = (() => {
    const scannedAt = latestScan?.scanned_at;
    if (!scannedAt) return null;
    const scannedDate = new Date(scannedAt);
    const now = new Date();
    const diffMs = now.getTime() - scannedDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
      const hh = scannedDate.getHours().toString().padStart(2, "0");
      const mm = scannedDate.getMinutes().toString().padStart(2, "0");
      return `오늘 ${hh}:${mm}`;
    }
    return `${diffDays}일 전`;
  })();
  const actionCopyText =
    actionCardToday ??
    (topMissingKeywords[0]
      ? `'${topMissingKeywords[0]}' 키워드를 스마트플레이스 소개글 또는 FAQ에 추가하세요`
      : null);

  const spAuto = (latestScan as Record<string, unknown>)
    ?.smart_place_completeness_result as Record<string, unknown> | null;
  const smartPlaceStatus = {
    hasFaq: !!(spAuto?.has_faq) || !!(business?.has_faq),
    hasIntro: !!(spAuto?.has_intro) || !!(business?.has_intro),
    hasRecentPost: !!(spAuto?.has_recent_post) || !!(business?.has_recent_post),
    hasWebsite: !!(business?.website_url),
  };

  const allPlatformResults: Record<
    string,
    { mentioned: boolean; exposure_freq?: number; in_briefing?: boolean; in_ai_overview?: boolean; error?: string }
  > = {
    ...(latestScan?.gemini_result     ? { gemini:  latestScan.gemini_result }  : {}),
    ...(latestScan?.chatgpt_result    ? { chatgpt: latestScan.chatgpt_result } : {}),
    ...(latestScan?.naver_result      ? { naver:   latestScan.naver_result }   : {}),
    ...(latestScan?.google_result     ? { google:  latestScan.google_result }  : {}),
  };

  const kakaoResult = latestScan?.kakao_result ?? null;
  const websiteCheckResult = latestScan?.website_check_result ?? null;

  const kakaoScore = (business as { kakao_score?: number })?.kakao_score;
  const kakaoChecklist = (business as { kakao_checklist?: Record<string, boolean> })?.kakao_checklist;
  const kakaoRegistered =
    (business as { kakao_registered?: boolean })?.kakao_registered ??
    kakaoResult?.is_on_kakao ??
    !!(business?.kakao_place_id);

  const displayCity = business?.region
    ? business.region.trim().split(" ")[0].replace(/(특별시|광역시|특별자치시|특별자치도|시|도|군|구)$/, "")
    : "";

  const todayTasks: { no: number; title: string; desc: string; time: string; link: string }[] = [];
  if (actionCardToday) {
    todayTasks.push({ no: 1, title: "오늘 바로", desc: actionCardToday, time: "5분", link: "/guide" });
  }
  if (actionCardWeek) {
    todayTasks.push({ no: 2, title: "이번 주", desc: actionCardWeek, time: "15분", link: "/guide" });
  }
  if (actionCardMonth) {
    todayTasks.push({ no: 3, title: "이번 달 목표", desc: actionCardMonth, time: "꾸준히", link: "/guide" });
  }
  if (todayTasks.length === 0 && topMissingKeywords.length > 0) {
    todayTasks.push({
      no: 1,
      title: "오늘 바로",
      desc: `'${topMissingKeywords[0]}' 키워드를 소개글·톡톡 채팅방 메뉴에 추가하세요`,
      time: "5분",
      link: "/guide",
    });
  }

  const myRankInList =
    [...rankingItems]
      .sort((a, b) => b.score - a.score)
      .findIndex((r) => (r as { isMe?: boolean }).isMe) + 1;
  const topCompetitor =
    rankingItems
      .filter((r) => !(r as { isMe?: boolean }).isMe)
      .sort((a, b) => b.score - a.score)[0] ?? null;

  const scoreChangeDiff =
    history && history.length >= 2
      ? Math.round(
          (history[0]?.unified_score ?? history[0]?.total_score ?? 0) -
            (history[1]?.unified_score ?? history[1]?.total_score ?? 0)
        )
      : null;

  return (
    <div className="p-4 pb-24 md:p-8 md:pb-12 max-w-4xl mx-auto space-y-6 md:space-y-10">
      {/* Trial → 가입 연결 GA4 트래커 (?from=trial_claim 진입 시 1회 발송) */}
      <TrialAttachTracker />

      {/* 온보딩 투어 — onboarding_done=false 신규 사용자에게만 표시
          사업장이 이미 등록된 경우 "내 사업장 등록하기" 1단계는 건너뜀 */}
      {!onboardingDone && (
        <OnboardingTour
          userId={user.id}
          initialOnboardingDone={false}
          initialStep={business ? 1 : 0}
        />
      )}

      {/* ── 사업장 탭 (최상단 — 어떤 가게 기준인지 먼저 인지) ── */}
      {businesses && (businesses.length > 1 || businesses.length < (PLAN_BIZ_LIMITS[plan] ?? 1)) && (
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
          {businesses.map((b) => (
            <a
              key={b.id}
              href={`/dashboard?biz_id=${b.id}`}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border transition-colors ${
                b.id === business?.id
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
              }`}
            >
              {b.name}
            </a>
          ))}
          {(() => {
            const limit = PLAN_BIZ_LIMITS[plan] ?? 1;
            return businesses.length < limit ? (
              <a
                href="/onboarding"
                className="px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap border border-dashed border-blue-400 text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-1"
                title={`사업장을 ${limit}개까지 등록할 수 있습니다`}
              >
                <span className="text-base leading-none">+</span> 사업장 추가
              </a>
            ) : null;
          })()}
        </div>
      )}

      {showRescanNotice && <RescanBanner />}

      {/* 재방문 변화 요약 배너 — 마지막 방문 이후 점수 변화 표시 */}
      {business?.id && (
        <VisitDeltaBanner bizId={business.id} />
      )}

      {/* ── 사업장 미등록 ── */}
      {!business && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 md:p-10 mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-8">
            <div className="flex-1">
              <h2 className="text-2xl md:text-3xl font-bold text-blue-900 mb-3">
                내 가게를 등록하고 AI 검색 분석을 시작하세요
              </h2>
              <p className="text-blue-700 text-base md:text-lg mb-4">
                가게 이름과 업종만 입력하면 AI 검색 노출 현황을 즉시 확인할 수 있습니다.
              </p>
              <ul className="space-y-2 text-base text-blue-600">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> 네이버·ChatGPT·Google AI 노출 현황 분석
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> 경쟁 사업장과 비교
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> AI 브리핑 노출 개선 가이드
                </li>
              </ul>
            </div>
            <div className="flex flex-col gap-3 shrink-0">
              <a
                href="/onboarding"
                data-onboarding-tour="register-business"
                className="inline-flex items-center justify-center w-full md:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-lg transition-colors"
              >
                내 가게 등록하고 시작하기
              </a>
              <p className="text-sm text-blue-500 text-center">무료로 시작 · 1분 소요</p>
            </div>
          </div>
        </div>
      )}

      {business && (
        <>
          <OnboardingProgressBar userId={user.id} token={accessToken} />

          {/* ── 헤더: 가게명 + 수정/공유 버튼 ── */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 break-keep">{business.name}</h1>
                <span
                  className={`text-sm font-semibold px-3 py-1 rounded-full ${
                    isAdmin
                      ? "bg-slate-100 text-slate-600"
                      : plan === "biz"
                      ? "bg-purple-100 text-purple-700"
                      : plan === "pro"
                      ? "bg-blue-100 text-blue-700"
                      : plan === "startup"
                      ? "bg-green-100 text-green-700"
                      : plan === "basic"
                      ? "bg-gray-100 text-gray-600"
                      : "bg-gray-50 text-gray-400"
                  }`}
                >
                  {isAdmin
                    ? "관리자"
                    : plan === "biz"
                    ? "Biz"
                    : plan === "pro"
                    ? "Pro"
                    : plan === "startup"
                    ? "창업패키지"
                    : plan === "basic"
                    ? "Basic"
                    : "무료"}
                </span>
              </div>
              <div className="mt-0.5 space-y-0.5">
                <p className="text-sm text-gray-500 break-keep">{displayCity} · {CATEGORY_LABEL[business.category] ?? business.category}</p>
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 shrink-0" />
                  <span className="break-keep">{scanInfo.label}</span>
                </p>
                {lastScannedLabel && (
                  <p className="text-sm text-gray-400">마지막 분석: {lastScannedLabel}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 pt-1">
              <BusinessQuickEditButton
                bizId={business.id}
                bizName={business.name}
                authToken={accessToken}
                initialData={{
                  keywords: (business as { keywords?: string[] })?.keywords ?? [],
                  has_faq: business.has_faq ?? false,
                  has_intro: business.has_intro ?? false,
                  has_recent_post: business.has_recent_post ?? false,
                  visitor_review_count: (business as { visitor_review_count?: number })?.visitor_review_count ?? 0,
                  receipt_review_count: (business as { receipt_review_count?: number })?.receipt_review_count ?? 0,
                  avg_rating: business.avg_rating ?? 0,
                  naver_place_url: (business as { naver_place_url?: string })?.naver_place_url ?? "",
                }}
              />
              <a
                href={`/share/${business.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-300 px-3 py-2 rounded-lg transition-colors"
              >
                <Share2 className="w-4 h-4" /> 공유
              </a>
            </div>
          </div>

          {/* ── 스캔 섹션: 키워드 선택 + AI 스캔 버튼 (전체 너비) ── */}
          <div className="mb-5" data-onboarding-tour="scan-button">
            <ScanWithModal
              businessId={business.id}
              businessName={business.name}
              category={business.category}
              region={business.region}
              keywords={(business as { keywords?: string[] })?.keywords}
              scanUsed={scanUsed}
              scanLimit={scanLimit}
              plan={plan}
              lastQueryUsed={(latestScan as { query_used?: string })?.query_used}
            />
          </div>

          {/* 키워드 미등록 안내 */}
          {!(business as { keywords?: string[] })?.keywords?.length && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800 flex items-start gap-1.5">
                  <Search className="w-4 h-4 shrink-0 mt-0.5" />
                  키워드를 등록하면 실제 검색어로 AI 노출 여부를 확인할 수 있습니다
                </p>
                <p className="text-sm text-amber-700 mt-0.5">
                  현재는 업종 전체 검색어로만 확인됩니다
                </p>
              </div>
              <a
                href="/settings?tab=business"
                className="shrink-0 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
              >
                키워드 추가하기 →
              </a>
            </div>
          )}

          <NewCompetitorAlert businessId={business.id} />

          {/* ── ZONE 1: 지금 내 상태 ── */}

          {/* Hero 카드 — 스캔 결과 있을 때만 표시 */}
          {latestScan && (
            <DashboardHeroCard
              businessName={business.name}
              unifiedScore={unifiedScore}
              scoreChangeDiff={scoreChangeDiff}
              naverInBriefing={!!latestScan.naver_result?.in_briefing}
              naverCaptchaBlocked={
                latestScan.naver_result?.captcha_detected === true ||
                latestScan.naver_result?.error === 'captcha_or_blocked'
              }
              myRankInList={myRankInList}
              totalCompetitors={rankingItems.length}
              topMissingKeywordCount={topMissingKeywords.length}
              topMissingKeyword={topMissingKeywords[0] ?? null}
              todayAction={
                todayTasks?.[0]?.desc ??
                (topMissingKeywords[0]
                  ? `'${topMissingKeywords[0]}' 키워드를 FAQ에 추가`
                  : null)
              }
              todayActionLink="/guide"
              estimatedGain={
                (gapRes as { vs_top?: { closeable_gap?: number } } | null)?.vs_top?.closeable_gap
                  ? Math.round((gapRes as { vs_top: { closeable_gap: number } }).vs_top.closeable_gap * 0.3)
                  : null
              }
              recentActionLabel={
                Array.isArray(actionLogs) && actionLogs.length > 0
                  ? (actionLogs[0] as { action_type?: string })?.action_type ?? null
                  : null
              }
              recentActionScoreGain={scoreChangeDiff !== null && scoreChangeDiff > 0 ? scoreChangeDiff : null}
            />
          )}

          {/* 키워드 검색 노출 카드 (v3.1 Track1 핵심 항목) */}
          {business?.id && (
            <KeywordRankCard
              bizId={business.id}
              keywords={(business as { keywords?: string[] })?.keywords ?? []}
              initialKeywordRanks={(latestScan?.keyword_ranks as Record<string, unknown> | null) ?? null}
              userGroup={
                (() => {
                  const cat = business?.category ?? "";
                  const isFr = Boolean((business as { is_franchise?: boolean })?.is_franchise);
                  if (isFr) return "INACTIVE";
                  if (["restaurant","cafe","bakery","bar","accommodation"].includes(cat)) return "ACTIVE";
                  if (["beauty","nail","pet","fitness","yoga","pharmacy"].includes(cat)) return "LIKELY";
                  return "INACTIVE";
                })()
              }
            />
          )}

          {/* ── ZONE 2: 오늘 할 일 ── */}

          {/* DailyMissionCard — 스캔 결과 있을 때만 표시 */}
          {latestScan && accessToken && (
            <DailyMissionCard
              bizId={business.id}
              token={accessToken}
              initialDimensions={
                (gapRes as { dimensions?: Array<{ dimension_key: string; dimension_label: string; current_score: number; max_score: number; gap_to_top: number; gap_reason: string; priority: number }> } | null)?.dimensions
              }
              todayTasks={todayTasks}
              actionCopyText={actionCopyText ?? null}
              topMissingKeyword={topMissingKeywords[0] ?? null}
            />
          )}

          {/* 액션 카드 — 7일 이내: first-week 모드 / 이후: weekly 모드 (매주 새 카드) */}
          {business?.id && (
            <Day7ActionCard
              bizId={business.id}
              userCreatedAt={user.created_at ?? null}
            />
          )}

          {/* 행동-점수 귀인 카드 — Basic+ 플랜, 행동 기록이 있을 때 */}
          {latestScan && accessToken && (
            <ScoreAttributionCard
              bizId={business.id}
              authToken={accessToken}
            />
          )}

          {/* 이달의 할 일 체크리스트 */}
          {business?.id && accessToken && (
            <MonthlyChecklistCard
              bizId={business.id}
              authToken={accessToken}
            />
          )}

          {/* ── ZONE 3: 네이버 AI 브리핑 ── */}

          {/* ── 네이버 AI 브리핑 비대상 업종 안내 (프랜차이즈 포함) ── */}
          {business.category && getBriefingEligibility(business.category, !!v41Extra?.is_franchise) !== "active" && (
            <IneligibleBusinessNotice
              category={business.category}
              categoryLabel={CATEGORY_LABEL[business.category] ?? business.category}
              eligibility={getBriefingEligibility(business.category, !!v41Extra?.is_franchise)}
              isFranchise={!!v41Extra?.is_franchise}
            />
          )}

          {/* ── AI 브리핑 노출 설정 (active/likely 업종 + 스캔 데이터 있을 때) ── */}
          {business.id && accessToken && briefingMeta && briefingMeta.eligibility !== "inactive" && (
            <AiInfoTabStatusCard
              bizId={business.id}
              accessToken={accessToken}
              currentStatus={briefingMeta.ai_info_tab_status ?? "unknown"}
              eligibility={briefingMeta.eligibility}
              explanation={briefingMeta.explanation}
            />
          )}

          {/* ── AI탭 답변 미리보기 (ACTIVE/LIKELY 업종, Basic+) ── */}
          {business.id && (() => {
            const cat = business.category ?? "";
            const isFr = Boolean((business as { is_franchise?: boolean })?.is_franchise);
            const eligibility = getBriefingEligibility(cat, isFr);
            return eligibility !== "inactive" ? (
              <AiTabPreviewCard
                bizId={business.id}
                subscriptionPlan={subscriptionPlan}
                category={cat}
              />
            ) : null;
          })()}

          {/* ── 스마트플레이스 사진 카테고리 현황 (ACTIVE 업종 + 스캔 데이터 있을 때) ── */}
          {business.id && (() => {
            const PHOTO_ACTIVE = ["restaurant","cafe","bakery","bar","accommodation","beauty","nail"];
            if (!PHOTO_ACTIVE.includes(business.category ?? "")) return null;
            const photoCategories = (latestScan as Record<string, unknown> | null)
              ?.photo_categories as Record<string, number> | null ?? null;
            return (
              <PhotoCategoryCard
                photoCategories={photoCategories}
                category={business.category}
              />
            );
          })()}

          {/* ── 리뷰 키워드 분포 — 경쟁사 비교 (Basic+ 플랜 체크는 카드 내부) ── */}
          {business.id && (
            <ReviewKeywordGapCard
              bizId={business.id}
              plan={plan}
            />
          )}

          {/* ── 5단계 가이드 + 매뉴얼 링크 (브리핑 대상 + 비대상 모두 노출) ── */}
          {business.id && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 md:p-5">
              <p className="text-sm md:text-base text-gray-800 mb-3 leading-relaxed break-keep">
                <strong>네이버 AI 브리핑 노출 5단계 가이드</strong> — 단계별 체크리스트로 직접 설정하세요 (15분).
              </p>
              <div className="flex flex-col md:flex-row gap-2">
                <a
                  href={`/guide/ai-info-tab?biz_id=${business.id}`}
                  className="inline-block px-4 py-2 bg-blue-600 text-white text-sm md:text-base rounded font-medium hover:bg-blue-700 text-center"
                >
                  5단계 가이드 열기 →
                </a>
                <a
                  href="/how-it-works"
                  className="inline-block px-4 py-2 border border-blue-600 text-blue-600 text-sm md:text-base rounded font-medium hover:bg-blue-100 text-center"
                >
                  AEOlab 동작 원리 보기 (매뉴얼)
                </a>
              </div>
            </div>
          )}

          {/* ── ZONE 4: 콘텐츠 생성 ── */}

          {/* ── 소개글 AI 생성 + 톡톡 채팅방 메뉴 생성 (업종 무관 항상 노출) ── */}
          {business.id && (
            <>
              <IntroGeneratorCard
                bizId={business.id}
                currentIntro={v41Extra?.naver_intro_draft as string | undefined}
                currentLength={(v41Extra?.naver_intro_draft as string | undefined)?.length ?? 0}
                generatedAt={v41Extra?.naver_intro_generated_at as string | undefined}
                planLabel={planLabel}
                planMonthlyLimit={planFaqLimit}
              />
              <TalktalkFAQGeneratorCard
                bizId={business.id}
                initialDraft={v41Extra?.talktalk_faq_draft as { items: Array<{ question: string; answer: string; category: string }>; chat_menus: string[] } | null | undefined}
                generatedAt={v41Extra?.talktalk_faq_generated_at as string | undefined}
                planLabel={planLabel}
                planMonthlyLimit={planFaqLimit}
              />
            </>
          )}

          {/* ── ZONE 5: 더 자세히 ── */}
          {latestScan ? (
            <DashboardAccordion
                tab1Content={
                  /* 탭1: 내 점수 분석 */
                  <div className="space-y-5">
                    {/* 행동-결과 7일 타임라인 — 최상단 배치 */}
                    {accessToken && business && (
                      <Action7DayChart bizId={business.id} accessToken={accessToken} />
                    )}
                    {/* 두 가지 AI 채널 점수 카드 */}
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
                      benchmarkAvg={benchmark?.avg_score}
                      smartPlaceStatus={smartPlaceStatus}
                      hasRegisteredKeywords={!!((business as { keywords?: string[] })?.keywords?.length)}
                      blogContribution={(business as { blog_url?: string; blog_analyzed_at?: string; blog_post_count?: number; blog_keyword_coverage?: number })?.blog_url ? {
                        active: !!((business as { blog_analyzed_at?: string })?.blog_analyzed_at) && !isKeywordEstimated,
                        postCount: (business as { blog_post_count?: number })?.blog_post_count ?? 0,
                        keywordCoverage: (business as { blog_keyword_coverage?: number })?.blog_keyword_coverage ?? 0,
                        analyzedAt: (business as { blog_analyzed_at?: string })?.blog_analyzed_at,
                        blogUrl: (business as { blog_url?: string })?.blog_url,
                      } : undefined}
                      bizId={business.id}
                      token={accessToken ?? undefined}
                    />
                    {/* AI별 노출 결과표 */}
                    {Object.keys(allPlatformResults).length > 0 && (
                      <ResultTable results={allPlatformResults} />
                    )}
                    {/* AI 플랫폼별 노출 분포 */}
                    {Object.keys(allPlatformResults).length > 0 && (
                      <PlatformDistributionChart
                        results={allPlatformResults}
                        naverChannelScore={naverChannelScore ?? undefined}
                        globalChannelScore={globalChannelScore ?? undefined}
                      />
                    )}
                    {/* 두 채널 체크리스트 카드 */}
                    {latestScan && (
                      <ChannelScoreCards
                        naverScore={track1Score}
                        globalScore={track2Score}
                        isSmartPlace={!!(latestScan.naver_result?.is_smart_place || (business as { naver_place_id?: string })?.naver_place_id)}
                        isOnKakao={!!kakaoResult?.is_on_kakao}
                        kakaoRank={kakaoResult?.my_rank ?? null}
                        naverMentioned={!!latestScan.naver_result?.in_briefing}
                        chatgptMentioned={!!latestScan.chatgpt_result?.mentioned}
                        hasWebsite={!!(business as { website_url?: string })?.website_url}
                        googlePlaceRegistered={!!(business as { google_place_id?: string })?.google_place_id}
                      />
                    )}
                    {/* 글로벌 AI 미노출 교육 배너 */}
                    <GlobalAIBanner
                      globalScore={track2Score}
                      hasWebsite={!!(business as { website_url?: string })?.website_url}
                      eligibility={getBriefingEligibility(business.category, !!v41Extra?.is_franchise)}
                    />
                    {/* INACTIVE 업종 전용 글로벌 AI 체크리스트 */}
                    {getBriefingEligibility(business.category, !!v41Extra?.is_franchise) === "inactive" && latestScan && (
                      <GlobalAIChecklist
                        hasWebsite={!!(business as { website_url?: string })?.website_url}
                        googlePlaceRegistered={!!(business as { google_place_id?: string })?.google_place_id}
                        websiteSeoScore={(latestScan as Record<string, unknown> & { channel_scores?: { website_seo?: number } })?.channel_scores?.website_seo ?? 0}
                        chatgptMentioned={!!latestScan.chatgpt_result?.mentioned}
                        geminiMentioned={!!(latestScan as Record<string, unknown> & { gemini_result?: { mentioned?: boolean } })?.gemini_result?.mentioned}
                        hasScanned={true}
                      />
                    )}
                    {/* 키워드 트렌드 차트 (Basic+) */}
                    {["basic", "startup", "pro", "biz"].includes(plan) && accessToken && (
                      <KeywordTrendChart
                        bizId={business.id}
                        accessToken={accessToken}
                        categoryKo={CATEGORY_LABEL[business.category] ?? business.category}
                      />
                    )}
                    {/* AI가 실제로 한 말 (Basic+) */}
                    {["basic", "startup", "pro", "biz"].includes(plan) && business && accessToken && (
                      <AICitationCard bizId={business.id} token={accessToken} />
                    )}
                    {/* ChatGPT 샘플링 증거 카드 */}
                    {latestScan && (
                      <ChatGPTDiffCard
                        geminiCount={Number(latestScan.gemini_result?.exposure_freq ?? 0)}
                        geminiSampleSize={
                          latestScan.gemini_result?.sample_size !== undefined
                            ? Number(latestScan.gemini_result.sample_size)
                            : undefined
                        }
                        chatgptCount={
                          latestScan.chatgpt_result?.exposure_freq !== undefined
                            ? Number(latestScan.chatgpt_result.exposure_freq)
                            : undefined
                        }
                        chatgptSampleSize={
                          latestScan.chatgpt_result?.sample_size !== undefined
                            ? Number(latestScan.chatgpt_result.sample_size)
                            : undefined
                        }
                        competitorCount={competitors?.length ?? 0}
                        naverBriefing={!!latestScan.naver_result?.in_briefing}
                        topMissingKeywords={
                          Array.isArray(latestScan.top_missing_keywords)
                            ? latestScan.top_missing_keywords.map(String)
                            : []
                        }
                      />
                    )}
                    {/* AI 브리핑 시계열 변화 */}
                    {history && history.length >= 2 && (
                      <BriefingTimeline history={history} businessName={business.name} />
                    )}
                    {/* 리뷰 감정 분석 (Basic+) */}
                    {["basic", "startup", "pro", "biz"].includes(plan) && accessToken && business && (
                      <SentimentDashboard bizId={business.id} token={accessToken} />
                    )}
                    {/* 언급 맥락 (Basic+) */}
                    {["basic", "startup", "pro", "biz"].includes(plan) && latestScan && (
                      <MentionContextSection
                        bizId={business.id}
                        token={accessToken}
                        currentPlan={subscriptionPlan}
                        isPro={["pro", "biz"].includes(plan)}
                      />
                    )}
                    {/* 상황별 검색 노출 (Pro+) */}
                    {business && accessToken && ["pro", "biz"].includes(plan) && (
                      <ConditionSearchCard
                        bizId={business.id}
                        token={accessToken}
                        isPro={true}
                      />
                    )}
                    {/* AI 검색 스크린샷 증거 (Basic+) */}
                    {["basic", "startup", "pro", "biz", "enterprise"].includes(plan) && accessToken && (
                      <AISearchScreenshotCard
                        bizId={business.id}
                        plan={plan}
                        authToken={accessToken}
                      />
                    )}
                  </div>
                }
                tab2Content={
                  /* 탭2: 경쟁사 비교 */
                  <div className="space-y-5">
                    {/* 경쟁 순위 */}
                    <div className="bg-white rounded-xl border p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-bold text-gray-900">경쟁사와 비교</h2>
                        <Link href="/competitors" className="text-sm text-blue-600 font-medium flex items-center gap-1">
                          전체 보기 <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                      {rankingItems.length > 1 ? (
                        <div className="space-y-4">
                          <div className={`rounded-xl p-4 text-center ${myRankInList === 1 ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
                            <p className="text-sm text-gray-500 mb-1">근처 {rankingItems.length}곳 중</p>
                            <p className={`text-4xl font-bold ${myRankInList === 1 ? "text-emerald-700" : "text-amber-700"}`}>{myRankInList}위</p>
                            {topCompetitor && myRankInList > 1 && (
                              <p className="text-sm text-gray-600 mt-1">1위 {topCompetitor.name} 대비 {Math.ceil(topCompetitor.score - unifiedScore)}점 부족</p>
                            )}
                          </div>
                          <RankingBar items={rankingItems} />
                        </div>
                      ) : (
                        <div className="text-center py-6">
                          <p className="text-sm text-gray-500 mb-3">경쟁 가게를 등록하면 AI 노출 점수를 비교할 수 있습니다</p>
                          <Link href="/competitors" className="inline-flex items-center gap-1.5 text-sm font-semibold bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">경쟁사 등록하기 →</Link>
                        </div>
                      )}
                    </div>
                    {/* 점수 추이 */}
                    {history && history.length > 0 && (
                      <div className="bg-white rounded-xl border p-4">
                        <h2 className="text-base font-bold text-gray-900 mb-3">점수 변화 추이</h2>
                        <TrendLine data={history} actionLogs={actionLogs} />
                      </div>
                    )}
                    <CompetitorKeywordCompare competitorKeywordSources={competitorKeywordSources} />
                    {["basic", "startup", "pro", "biz"].includes(plan) && accessToken && business && (
                      <CompetitorFAQCard bizId={business.id} accessToken={accessToken} />
                    )}
                  </div>
                }
                tab3Content={
                  /* 탭3: 내 가게 개선하기 */
                  <div className="space-y-5">
                    {/* 2. 종합 AI 진단 — 탭2 핵심 스토리 (점수 근거 포함) */}
                    <AIDiagnosisCard
                      businessName={business.name}
                      category={business.category}
                      region={business.region}
                      keywords={(business as { keywords?: string[] })?.keywords}
                      allPlatformResults={allPlatformResults}
                      reviewCount={(business as { review_count?: number })?.review_count ?? 0}
                      avgRating={(business as { avg_rating?: number })?.avg_rating ?? 0}
                      smartPlaceScore={
                        ((latestScan.score_breakdown as Record<string, number>)?.smart_place_completeness) ?? 0
                      }
                      naverMentioned={latestScan.naver_result?.mentioned ?? false}
                      categoryKo={CATEGORY_LABEL[business.category] ?? business.category}
                      inBriefing={latestScan.naver_result?.in_briefing ?? false}
                      naverPlaceUrl={(business as { naver_place_url?: string })?.naver_place_url ?? null}
                    />
                    {/* 2-B. 점수 근거 카드 — 왜 이 점수인지 6개 항목으로 설명 (AIDiagnosisCard와 보완: 진단=개선 경로, Evidence=채점 근거) */}
                    {latestScan.score_breakdown && (
                      <ScoreEvidenceCard
                        breakdown={(latestScan.score_breakdown as Record<string, number>) ?? {}}
                        naverResult={latestScan.naver_result ?? null}
                        kakaoResult={kakaoResult ?? null}
                        topMissingKeywords={topMissingKeywords}
                        isKeywordEstimated={isKeywordEstimated}
                        track1Score={track1Score}
                        track2Score={track2Score}
                        naverWeight={naverWeight}
                        allPlatformResults={allPlatformResults}
                        reviewCount={(business as { review_count?: number })?.review_count ?? 0}
                        avgRating={(business as { avg_rating?: number })?.avg_rating ?? 0}
                        hasSmartPlace={smartPlaceStatus.hasFaq || smartPlaceStatus.hasIntro || smartPlaceStatus.hasRecentPost}
                        hasFaq={smartPlaceStatus.hasFaq}
                        hasRecentPost={smartPlaceStatus.hasRecentPost}
                        hasIntro={smartPlaceStatus.hasIntro}
                        bizId={business.id}
                        token={accessToken ?? undefined}
                        missingItems={missingItems}
                      />
                    )}
                    {/* 3. 스마트플레이스 자동 점검 (naver_place_url 있는 사용자만) */}
                    {accessToken && (business as { naver_place_url?: string })?.naver_place_url && (
                      <SmartplaceAutoCheck
                        bizId={business.id}
                        naverPlaceUrl={(business as { naver_place_url?: string }).naver_place_url ?? null}
                        accessToken={accessToken}
                      />
                    )}
                    {/* 4. 카카오맵 체크리스트 */}
                    <KakaoChecklistCard
                      bizId={business.id}
                      initialScore={kakaoScore}
                      initialChecklist={kakaoChecklist}
                      kakaoRegistered={kakaoRegistered}
                    />
                    {/* 5. 웹사이트 SEO 점검 */}
                    <WebsiteCheckCard
                      websiteUrl={business.website_url}
                      checkResult={websiteCheckResult}
                    />
                    {/* 6. 업종 트렌드 — DataLab 연동 전까지 임시 숨김
                    {["basic", "startup", "pro", "biz"].includes(plan) && (
                      <IndustryTrendClientWrapper
                        category={CATEGORY_LABEL[business.category] ?? business.category}
                        categoryCode={business.category}
                        region={business.region}
                        isPro={["pro", "biz"].includes(plan)}
                      />
                    )}
                    */}
                    <ConversionGuideSection bizId={business.id} plan={plan} />

                    {/* ── 키워드별 블로그 노출 비교 ── */}
                    {(latestScan.naver_result?.keyword_blog_comparison?.length ?? 0) > 0 && (
                      <div className="bg-white rounded-xl border p-4 md:p-6">
                        <h3 className="text-base md:text-lg font-bold text-gray-800 mb-1">
                          내 가게 키워드가 네이버 블로그에 얼마나 있나요?
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">
                          네이버 블로그 포스트 수 기준 비교입니다 (리뷰 키워드가 아닌, 블로그에 언급된 횟수).
                        </p>
                        <div className="space-y-4">
                          {latestScan.naver_result!.keyword_blog_comparison!.map(
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
                                      <div
                                        className="bg-gray-400 h-2.5 rounded-full"
                                        style={{ width: `${compPct}%` }}
                                      />
                                    </div>
                                    <span className="text-sm text-gray-600 w-14 text-right">
                                      {kbc.competitor_count.toLocaleString()}건
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-blue-700 w-24 truncate">
                                      내 가게
                                    </span>
                                    <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                                      <div
                                        className={`h-2.5 rounded-full ${
                                          kbc.my_count >= kbc.competitor_count
                                            ? "bg-green-500"
                                            : "bg-blue-500"
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

                    {/* ── 최근 사람들이 내 가게를 어떻게 쓰고 있나요? ── */}
                    {(latestScan.naver_result?.top_blogs?.length ?? 0) > 0 && (
                      <div className="bg-white rounded-xl border p-4 md:p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-base md:text-lg font-bold text-gray-800">
                            최근 사람들이 내 가게를 어떻게 쓰고 있나요?
                          </h3>
                          <span className="text-sm text-gray-400">
                            {latestScan.naver_result?.blog_mentions?.toLocaleString()}건 언급
                          </span>
                        </div>
                        <div className="divide-y">
                          {latestScan.naver_result!.top_blogs!
                            .slice(0, 5)
                            .map(
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
                                  <p className="text-sm font-medium text-gray-800 line-clamp-1">
                                    {blog.title}
                                  </p>
                                  {blog.description && (
                                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                                      {blog.description}
                                    </p>
                                  )}
                                  {blog.postdate && (
                                    <p className="text-sm text-gray-400 mt-1">
                                      {blog.postdate.replace(
                                        /(\d{4})(\d{2})(\d{2})/,
                                        "$1.$2.$3"
                                      )}
                                    </p>
                                  )}
                                </a>
                              )
                            )}
                        </div>
                      </div>
                    )}

                    {/* Pro 업그레이드 유도 (Basic 플랜 단일 표시) */}
                    {subscriptionPlan === "basic" && (
                      <ProUpgradePreview
                        businessName={business.name}
                        category={business.category}
                        plan={subscriptionPlan}
                      />
                    )}
                    {plan === "biz" && accessToken && <MultiBizTable token={accessToken} />}
                  </div>
                }
              />
          ) : (
            /* 스캔 없는 Empty State */
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
                  { name: "Gemini",     note: "50회 측정" },
                  { name: "ChatGPT",    note: "50회 측정" },
                  { name: "네이버 AI",  note: "브리핑 포함" },
                  { name: "Google AI",  note: "AI Overview" },
                ].map((p) => (
                  <div
                    key={p.name}
                    className="bg-gray-50 rounded-xl py-3 px-2 border border-gray-100 text-center"
                  >
                    <div className="font-semibold text-gray-800 text-sm">{p.name}</div>
                    <div className="text-gray-400 text-sm mt-0.5">{p.note}</div>
                  </div>
                ))}
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-2xl px-6 py-5 max-w-md w-full text-left">
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
          )}

          {/* ── 하단 업셀 — 점수 확인 후 업그레이드 안내 ── */}
          {accessToken && business.id && business.name && (
            <BasicTrialBanner
              businessId={business.id}
              businessName={business.name}
              authToken={accessToken}
            />
          )}

        </>
      )}

      {/* ── 빠른 이동 그리드 — 모바일에서 다음 행동으로 바로 이동 ── */}
      {business && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[
            { href: "/guide",       Icon: Lightbulb,  label: "오늘 할 일 보기",      desc: "AI가 추천하는 개선 방법" },
            { href: "/schema",      Icon: Store,      label: "소개글 · 스키마 만들기", desc: "소개글·블로그 자동 생성" },
            { href: "/competitors", Icon: BarChart2,  label: "경쟁사 관리",           desc: "주변 경쟁 점포와 비교" },
            { href: "/history",     Icon: TrendingUp, label: "30일 변화 기록",        desc: "점수 변화 추이 보기" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="bg-white rounded-xl p-4 md:p-6 shadow-sm hover:shadow-md transition-shadow text-center border border-gray-100 hover:border-blue-300"
            >
              <div className="flex justify-center mb-2">
                <item.Icon className="w-8 h-8 text-blue-600" strokeWidth={1.5} />
              </div>
              <div className="font-bold text-gray-900 text-base md:text-lg leading-tight break-keep">
                {item.label}
              </div>
              <div className="text-sm text-gray-500 mt-1.5 leading-snug break-keep">{item.desc}</div>
            </Link>
          ))}
        </div>
      )}

      {/* AI 도우미 플로팅 채팅 — Basic+ 전용 */}
      {business && ["basic", "startup", "pro", "biz", "enterprise"].includes(plan) && accessToken && (
        <AIAssistant bizId={business.id} plan={plan} authToken={accessToken} />
      )}
    </div>
  );
}
