import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DualTrackCard from "@/components/dashboard/DualTrackCard";
import AIDiagnosisCard from "@/components/dashboard/AIDiagnosisCard";
import ScoreEvidenceCard from "@/components/dashboard/ScoreEvidenceCard";
import { RankingBar } from "@/components/dashboard/RankingBar";
import { TrendLine } from "@/components/dashboard/TrendLine";
import { ResultTable } from "@/components/scan/ResultTable";
import { ChannelScoreCards } from "@/components/dashboard/ChannelScoreCards";
import { GlobalAIBanner } from "@/components/dashboard/GlobalAIBanner";
import { PlatformDistributionChart } from "@/components/dashboard/PlatformDistributionChart";
import { WebsiteCheckCard } from "@/components/dashboard/WebsiteCheckCard";
import { ScanTrigger } from "./ScanTrigger";
import { SmartPlaceScorecard } from "@/components/dashboard/SmartPlaceScorecard";
import { BriefingTimeline } from "@/components/dashboard/BriefingTimeline";
import InstagramSignalCard from "@/components/dashboard/InstagramSignalCard";
import KakaoChecklistCard from "@/components/dashboard/KakaoChecklistCard";
import { RescanBanner } from "./RescanBanner";
import { NewCompetitorAlert } from "@/components/dashboard/NewCompetitorAlert";
import ConversionGuideSection from "@/components/dashboard/ConversionGuideSection";
import Link from "next/link";
import { MentionContextSection } from "./MentionContextSection";
import { Search, ChevronRight, Share2, CheckCircle2, RefreshCw } from "lucide-react";
import { IndustryTrendClientWrapper } from "./IndustryTrendClientWrapper";
import { CATEGORY_LABEL } from "@/lib/categories";
import FirstTimeEducationCard from "@/components/dashboard/FirstTimeEducationCard";
import { OnboardingProgressBar } from "@/components/dashboard/OnboardingProgressBar";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

interface Benchmark {
  count: number
  avg_score: number
  top10_score: number
  distribution: { range: string; count: number }[]
}

// 영문 점수 키 → 소상공인 이해 가능한 한국어 레이블
const SCORE_LABELS: Record<string, string> = {
  exposure_freq:             "AI 검색 노출",
  review_quality:            "리뷰 평판",
  schema_score:              "온라인 정보 정리",
  online_mentions:           "온라인 언급 수",
  info_completeness:         "기본 정보 완성도",
  content_freshness:         "최근 활동",
  keyword_gap_score:         "키워드 커버리지",
  smart_place_completeness:  "스마트플레이스 완성도",
  naver_exposure_confirmed:  "네이버 AI 노출 확인",
  track1_score:              "네이버 AI 채널 점수",
  track2_score:              "글로벌 AI 채널 점수",
  unified_score:             "AI 노출 종합점수",
};

// 항목 점수가 낮을 때 바로 실천할 행동 (오늘의 할 일 도출에 사용)
const BREAKDOWN_ACTIONS: Record<string, { action: string; link: string }> = {
  exposure_freq:      { action: "스마트플레이스 대표 키워드를 추가·정리하세요",               link: "/schema" },
  review_quality:     { action: "단골 손님 1명에게 네이버 리뷰를 요청하세요",               link: "/guide" },
  schema_score:       { action: "스마트플레이스 소개글·영업시간·메뉴를 업데이트하세요",       link: "/schema" },
  online_mentions:    { action: "블로그 후기 1건을 요청하거나 직접 작성하세요",              link: "/schema" },
  info_completeness:  { action: "전화번호·영업시간·주소 정보를 확인하고 채워주세요",         link: "/schema" },
  content_freshness:  { action: "최근 공지나 메뉴 변경 사항을 스마트플레이스에 등록하세요",   link: "/schema" },
  keyword_gap_score:  { action: "부족한 키워드를 스마트플레이스 FAQ·소개글에 추가하세요",    link: "/guide" },
  smart_place_completeness: { action: "스마트플레이스 FAQ를 등록하면 점수가 즉시 오릅니다", link: "/guide" },
  naver_exposure_confirmed: { action: "스마트플레이스 FAQ와 소개글을 보강해 AI 브리핑 노출을 높이세요", link: "/guide" },
};

// 플랜별 하루 수동 스캔 한도
const SCAN_DAILY_LIMITS: Record<string, number> = {
  free: 0, basic: 2, pro: 5, startup: 3, biz: 999, enterprise: 999,
};

// 플랜별 자동 스캔 레이블 (실제 스케줄러 동작과 일치)
function iGa(name: string): string {
  const last = name[name.length - 1];
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return `${name}이(가)`;
  return (code - 0xac00) % 28 !== 0 ? `${name}이` : `${name}가`;
}

function nextScanLabel(plan: string | null | undefined): { label: string; desc: string } {
  const p = plan ?? "free";
  if (p === "biz" || p === "enterprise")
    return { label: "매일 새벽 자동 스캔", desc: "내일 새벽 2시에 전체 AI 채널 분석합니다" };
  if (p === "startup")
    return { label: "매일 빠른 스캔 (월요일 전체 AI 스캔)", desc: "매일 주요 AI 빠른 스캔, 월요일 새벽 2시에 전체 AI 채널 분석합니다" };
  if (p === "pro")
    return { label: "주 3회 자동 스캔 (월·수·금)", desc: "월·수·금 새벽 2시에 전체 AI 채널 분석, 나머지 날은 Gemini+네이버만 분석합니다" };
  if (p === "basic")
    return { label: "매일 빠른 스캔 (월요일 전체 AI 스캔)", desc: "매일 주요 AI 빠른 스캔, 월요일 새벽 2시에 전체 AI 채널 분석합니다" };
  return { label: "자동 스캔 없음", desc: "유료 플랜으로 업그레이드하면 자동 스캔을 이용할 수 있습니다" };
}

function scoreToGrade(score: number): string {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
}


export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ rescan?: string }>
}) {
  const params = await searchParams;
  const showRescanNotice = params.rescan === '1';

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user || error) redirect("/login");
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token ?? '';

  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name, category, region, business_type, website_url, naver_place_id, google_place_id, kakao_place_id, kakao_score, kakao_checklist, kakao_registered, is_active, naver_place_url, review_count, avg_rating, keywords, is_smart_place, has_faq, has_recent_post, has_intro")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1);

  const business = businesses?.[0] ?? null;
  // 사업장 미등록 시 빈 상태 UI 표시 (강제 리다이렉트 제거)

  const todayISO = new Date().toISOString().split('T')[0];

  // 구독 정보는 사업장 유무와 무관하게 조회
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", user.id)
    .maybeSingle();

  // 사업장이 있을 때만 관련 데이터 조회
  const [
    { data: scanResults },
    { data: competitors },
    { data: history },
    benchmarkRes,
    rankingRes,
    { data: latestGuide },
    { count: scanUsedToday },
  ] = business
    ? await Promise.all([
        supabase
          .from("scan_results")
          .select("id, scanned_at, query_used, gemini_result, chatgpt_result, perplexity_result, grok_result, naver_result, claude_result, google_result, kakao_result, website_check_result, instagram_result, smart_place_completeness_result, exposure_freq, total_score, unified_score, track1_score, track2_score, naver_weight, global_weight, growth_stage, growth_stage_label, is_keyword_estimated, keyword_coverage, score_breakdown, naver_channel_score, global_channel_score, rank_in_query, competitor_scores, top_missing_keywords")
          .eq("business_id", business.id)
          .order("scanned_at", { ascending: false })
          .limit(2),
        supabase
          .from("competitors")
          .select("id, name")
          .eq("business_id", business.id)
          .eq("is_active", true),
        supabase
          .from("score_history")
          .select("id, business_id, score_date, total_score, exposure_freq, unified_score, track1_score, track2_score, created_at")
          .eq("business_id", business.id)
          .order("score_date", { ascending: false })
          .limit(30),
        (business.category && business.region)
          ? fetch(`${BACKEND}/api/report/benchmark/${business.category}/${encodeURIComponent(business.region)}`)
              .then((r) => r.ok ? r.json() : null)
              .catch(() => null)
          : Promise.resolve(null),
        (business.category && business.region)
          ? fetch(`${BACKEND}/api/report/ranking/${business.category}/${encodeURIComponent(business.region)}`)
              .then((r) => r.ok ? r.json() : null)
              .catch(() => null)
          : Promise.resolve(null),
        supabase
          .from("guides")
          .select("priority_json, next_month_goal, tools_json")
          .eq("business_id", business.id)
          .order("generated_at", { ascending: false })
          .limit(1)
          .then(r => ({ data: r.data?.[0] ?? null })),
        supabase
          .from("scan_results")
          .select("id", { count: 'exact', head: true })
          .eq("business_id", business.id)
          .gte("scanned_at", todayISO + "T00:00:00"),
      ])
    : [
        { data: null },
        { data: null },
        { data: null },
        null,
        null,
        { data: null },
        { count: 0 },
      ];

  const benchmark: Benchmark | null = benchmarkRes ?? null;
  const rankingTop5: Array<{ name: string; total_score: number }> = rankingRes?.slice(0, 5) ?? [];
  const latestScan = scanResults?.[0];
  const prevScan = scanResults?.[1];
  // 관리자 이메일 확인 (배지 표시·수동 스캔 한도용, 자동 스캔 대상 아님)
  // layout.tsx와 동일한 방식 사용 (NEXT_PUBLIC_ — 이메일 주소는 민감 시크릿 아님)
  const ADMIN_EMAILS_LIST = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "hoozdev@gmail.com")
    .split(",").map((e) => e.trim().toLowerCase());
  const isAdmin = ADMIN_EMAILS_LIST.includes((user.email ?? "").toLowerCase());
  // 관리자는 모든 기능 이용 가능 (enterprise 권한) — 배지만 "관리자"로 표시
  const plan = isAdmin ? "enterprise" : ((subscription?.status === "active" || subscription?.status === "grace_period") ? (subscription?.plan ?? "free") : "free");
  const scanInfo = isAdmin
    ? { label: "자동 스캔 없음 (관리자)", desc: "관리자 계정은 자동 스캔 대상에서 제외됩니다" }
    : nextScanLabel(plan);
  const scanLimit = isAdmin ? 999 : (SCAN_DAILY_LIMITS[plan] ?? 0);
  const scanUsed = scanUsedToday ?? 0;

  // 오늘의 할 일 도출: 가이드 최상위 항목 > 가장 낮은 점수 항목
  type GuideData = {
    priority_json?: string[];
    next_month_goal?: string;
    // tools_json은 ActionTools 구조 그대로 DB에 저장됨
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
    // 이미 완료된 항목은 건너뛰기 (예: 소개글 작성됨 → schema_score 액션 스킵)
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

  // 3단 행동 카드 데이터
  // "오늘": 실제 행동 지시문 우선 — FAQ 답변 본문·붙여넣기 텍스트는 제외
  const briefingPathLabel = guideData?.tools_json?.direct_briefing_paths?.[0]?.path_label ?? null;
  const faqQuestion = guideData?.tools_json?.faq_list?.[0]?.question ?? null;

  const actionCardToday: string | null = (() => {
    // 1순위: 가이드 우선 실행 항목 (priority_json)
    if (todayAction?.text) return todayAction.text;
    // 2순위: AI 브리핑 경로 레이블 → "오늘 [경로명] 하세요" 형식
    if (briefingPathLabel) return `오늘 스마트플레이스에서 '${briefingPathLabel}'을 실행하세요`;
    // 3순위: FAQ 질문이 있으면 등록 유도
    if (faqQuestion) return `스마트플레이스 Q&A에 '${faqQuestion}' 질문을 등록하세요`;
    // 4순위: 누락 키워드 기반 행동
    const topMissingKw0 = Array.isArray((latestScan as { top_missing_keywords?: string[] })?.top_missing_keywords)
      ? (latestScan as { top_missing_keywords?: string[] }).top_missing_keywords![0]
      : null;
    if (topMissingKw0) return `'${topMissingKw0}' 키워드를 스마트플레이스 소개글 또는 FAQ에 추가하세요`;
    return null;
  })();

  // "이번 주": 누락 키워드 → 스마트플레이스 FAQ 등록 유도
  const topMissingKw = Array.isArray((latestScan as { top_missing_keywords?: string[] })?.top_missing_keywords)
    ? (latestScan as { top_missing_keywords?: string[] }).top_missing_keywords![0]
    : null;
  const actionCardWeek = topMissingKw
    ? `"${topMissingKw}" 키워드를 스마트플레이스 FAQ에 등록하세요`
    : (guideData?.tools_json?.naver_post_template
        ? "스마트플레이스 '소식' 탭에 새 공지를 등록하세요"
        : null);

  const actionCardMonth   = guideData?.next_month_goal ?? null;
  const showActionCards   = !!(actionCardToday || actionCardWeek || actionCardMonth);

  const competitorScores: Record<string, { name: string; score: number }> =
    latestScan?.competitor_scores ?? {};
  const rankingItems = [
    ...(competitors ?? []).map((c) => ({
      name: c.name,
      score: competitorScores[c.id]?.score ?? 0,
    })),
    { name: business?.name ?? "", score: latestScan?.total_score ?? 0, isMe: true },
  ];

  const naverChannelScore  = latestScan?.naver_channel_score  ?? null;
  const globalChannelScore = latestScan?.global_channel_score ?? null;

  // v3.0 듀얼트랙 점수 (ScanResult 타입에 v3.0 필드 포함)
  const track1Score        = latestScan?.track1_score        ?? naverChannelScore  ?? latestScan?.total_score ?? 0;
  const track2Score        = latestScan?.track2_score        ?? globalChannelScore ?? latestScan?.total_score ?? 0;
  const unifiedScore       = latestScan?.unified_score       ?? latestScan?.total_score ?? 0;
  const naverWeight        = latestScan?.naver_weight        ?? 0.65;
  const globalWeight       = latestScan?.global_weight       ?? 0.35;
  const growthStage        = latestScan?.growth_stage        ?? "stability";
  const growthStageLabel   = latestScan?.growth_stage_label  ?? "성장 중";
  const isKeywordEstimated = latestScan?.is_keyword_estimated ?? false;
  const topMissingKeywords: string[] = Array.isArray(latestScan?.top_missing_keywords) ? latestScan.top_missing_keywords.slice(0, 3) : [];

  // 스마트플레이스 실제 상태: Playwright 자동 체크 OR 사용자 체크박스 (어느 하나라도 true면 완료)
  const spAuto = (latestScan as Record<string, unknown>)?.smart_place_completeness_result as Record<string, unknown> | null;
  const smartPlaceStatus = {
    hasFaq: !!(spAuto?.has_faq) || !!(business?.has_faq),
    hasIntro: !!(spAuto?.has_intro) || !!(business?.has_intro),
    hasRecentPost: !!(spAuto?.has_recent_post) || !!(business?.has_recent_post),
    hasWebsite: !!(business?.website_url),
  };

  const allPlatformResults: Record<string, { mentioned: boolean; exposure_freq?: number; in_briefing?: boolean; in_ai_overview?: boolean; error?: string }> = {
    ...(latestScan?.gemini_result     ? { gemini:     latestScan.gemini_result }     : {}),
    ...(latestScan?.chatgpt_result    ? { chatgpt:    latestScan.chatgpt_result }    : {}),
    ...(latestScan?.perplexity_result ? { perplexity: latestScan.perplexity_result } : {}),
    ...(latestScan?.grok_result       ? { grok:       latestScan.grok_result }       : {}),
    ...(latestScan?.naver_result      ? { naver:      latestScan.naver_result }      : {}),
    ...(latestScan?.claude_result     ? { claude:     latestScan.claude_result }     : {}),
    ...(latestScan?.google_result     ? { google:     latestScan.google_result }     : {}),
  };

  const kakaoResult = latestScan?.kakao_result ?? null;
  const websiteCheckResult = latestScan?.website_check_result ?? null;
  const instagramResult = latestScan?.instagram_result ?? null;
  const isInstagramConnected = (business as { instagram_connected?: boolean })?.instagram_connected ?? false;

  // 카카오맵 체크리스트
  const kakaoScore       = (business as { kakao_score?: number })?.kakao_score;
  const kakaoChecklist   = (business as { kakao_checklist?: Record<string, boolean> })?.kakao_checklist;
  const kakaoRegistered  =
    (business as { kakao_registered?: boolean })?.kakao_registered  // DB 저장값 우선
    ?? kakaoResult?.is_on_kakao                                     // 스캔 결과 fallback
    ?? !!(business?.kakao_place_id);                                // place_id 보유 여부 최종 fallback

  // 지역명 표시용: "창원시 성산구" → "창원" (시/도/군/구 접미사 제거)
  const displayCity = business?.region
    ? business.region.trim().split(" ")[0].replace(/(특별시|광역시|특별자치시|특별자치도|시|도|군|구)$/, "")
    : "";

  // 검색 쿼리용 키워드
  const bizKeywords = (business as { keywords?: string[] } | null)?.keywords ?? [];
  // 단일 검색어 (쿼리 문구용): 첫 번째 키워드
  const displaySearchKw = bizKeywords[0] ?? CATEGORY_LABEL[business?.category ?? ""] ?? business?.category ?? "";
  // 복수 키워드 표시 (배너 안내문용): 최대 3개 나열
  const displayKeywordList = bizKeywords.length > 0
    ? bizKeywords.slice(0, 3).join(", ")
    : (CATEGORY_LABEL[business?.category ?? ""] ?? business?.category ?? "");

  // scoreToGrade 사용 참조 유지 (미사용 경고 방지)
  void scoreToGrade;
  void SCORE_LABELS;
  // prevScan 참조 유지
  void prevScan;

  return (
    <div className="p-4 md:p-8">
      {/* 스캔 요청 후 리다이렉트 시 안내 배너 */}
      {showRescanNotice && <RescanBanner />}

      {/* 사업장 미등록 시 CTA 배너 */}
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
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" /> 네이버·카카오·ChatGPT 등 7개 AI 노출 현황 분석</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" /> 경쟁 사업장과 비교</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" /> AI 브리핑 노출 개선 가이드</li>
              </ul>
            </div>
            <div className="flex flex-col gap-3 shrink-0">
              <a
                href="/onboarding"
                className="inline-flex items-center justify-center w-full md:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-lg transition-colors"
              >
                내 가게 등록하고 시작하기
              </a>
              <p className="text-sm text-blue-500 text-center">무료로 시작 · 1분 소요</p>
            </div>
          </div>
        </div>
      )}

      {business && (<>
      {/* 온보딩 진행 바 (7일 이내 완료 체크리스트) */}
      <OnboardingProgressBar userId={user.id} />

      {/* 첫 방문자 AI 브리핑 교육 카드 (localStorage 기반 1회 표시) */}
      <FirstTimeEducationCard />

      {/* 사업장 헤더 카드 */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-6 mb-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-2 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{business.name}</h1>
              {isAdmin ? (
                <span className="text-sm font-semibold px-3 py-1 rounded-full cursor-default bg-slate-100 text-slate-600" title="관리자 계정 — 자동 스캔 제외">
                  관리자
                </span>
              ) : (
                <span
                  className={`text-sm font-semibold px-3 py-1 rounded-full cursor-default ${
                    plan === 'biz' || plan === 'enterprise' ? 'bg-purple-100 text-purple-700' :
                    plan === 'pro'     ? 'bg-blue-100 text-blue-700' :
                    plan === 'startup' ? 'bg-green-100 text-green-700' :
                    plan === 'basic'   ? 'bg-gray-100 text-gray-600' :
                    'bg-gray-50 text-gray-400'
                  }`}
                  title={
                    plan === 'basic'   ? 'Basic 플랜 — 경쟁사 3개 · 가이드 월 1회 · 히스토리 30일' :
                    plan === 'pro'     ? 'Pro 플랜 — 경쟁사 10개 · 가이드 월 8회 · 히스토리 90일' :
                    plan === 'biz'     ? 'Biz 플랜 — 경쟁사 무제한 · 가이드 월 20회 · 히스토리 무제한' :
                    plan === 'startup' ? '창업패키지 — 경쟁사 5개 · 가이드 월 5회 · 시장 분석 리포트 포함' :
                    plan === 'enterprise' ? 'Enterprise 플랜' :
                    '무료 — 자동 스캔 없음'
                  }
                >
                  {plan === 'enterprise' ? 'Enterprise' :
                   plan === 'biz'        ? 'Biz' :
                   plan === 'pro'        ? 'Pro' :
                   plan === 'startup'    ? '창업패키지' :
                   plan === 'basic'      ? 'Basic' : '무료'}
                </span>
              )}
            </div>
            <p className="text-base md:text-lg text-gray-600 font-medium">
              {displayCity} · {CATEGORY_LABEL[business.category] ?? business.category}
            </p>
            <p className="text-sm text-blue-500 mt-1.5 flex items-center gap-1.5" title={scanInfo.desc}>
              <RefreshCw className="w-3.5 h-3.5 shrink-0" /> {scanInfo.label}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap sm:shrink-0">
            <a
              href={`/share/${business.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-300 px-3 py-2 rounded-lg transition-colors"
            >
              <Share2 className="w-4 h-4" /> 결과 공유
            </a>
            <ScanTrigger
              businessId={business.id}
              businessName={business.name}
              category={business.category}
              region={business.region}
              keywords={(business as { keywords?: string[] })?.keywords}
              scanUsed={scanUsed}
              scanLimit={scanLimit}
            />
          </div>
        </div>
      </div>

      {/* 키워드 미등록 안내 배너 */}
      {(!(business as { keywords?: string[] })?.keywords?.length) && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-5 py-4 mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800 flex items-start gap-1.5">
              <Search className="w-4 h-4 shrink-0 mt-0.5" />
              <span>키워드를 등록하면 &quot;{displayCity} {displaySearchKw} 추천해줘&quot; 같은 실제 검색어로 AI에 내 가게가 노출되는지 확인할 수 있습니다</span>
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              등록된 키워드로 AI 검색 진단 — 예: {displayCity} &quot;{displayKeywordList}&quot; 각각 검색합니다.
              키워드 미등록 시 &quot;{CATEGORY_LABEL[business.category] ?? business.category} 추천&quot;(업종 전체 검색)으로만 검색됩니다.
            </p>
          </div>
          <a
            href="/settings?tab=business"
            className="shrink-0 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            키워드 추가하기 →
          </a>
        </div>
      )}

      {/* 점수 낮음 안내 배너 — AI 점수 의미 설명 + 정보 입력 유도 */}
      {latestScan && unifiedScore < 30 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-5 py-4 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-start gap-3">
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800 mb-1">
                AI 검색 노출 점수가 낮습니다 — 이 점수가 낮은 이유를 먼저 확인하세요
              </p>
              <p className="text-sm text-amber-700 leading-relaxed">
                이 점수는 Gemini·ChatGPT 등 AI가 내 가게를 검색 결과에 얼마나 언급하는지를 측정합니다.
                네이버 스마트플레이스에 등록되어 있어도, AI가 아직 내 가게를 충분히 학습하지 못했거나
                리뷰 수·FAQ·소개글 정보가 입력되지 않으면 점수가 낮게 나올 수 있습니다.
              </p>
              <p className="text-xs text-amber-600 mt-1.5">
                아래에서 네이버 리뷰 수, 스마트플레이스 등록 여부를 직접 입력하면 다음 스캔부터 정확한 분석이 가능합니다.
              </p>
            </div>
            <a
              href="/settings?tab=business&edit=1"
              className="shrink-0 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap"
            >
              정보 입력하기 →
            </a>
          </div>
        </div>
      )}

      {/* 신규 경쟁사 알림 배너 */}
      <NewCompetitorAlert businessId={business.id} />

      {latestScan ? (
        <div className="space-y-5 md:space-y-6">
          {/* 이번 주 변화 요약 카드 — 소상공인 직접 체감 지표 */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-blue-900">이번 주 내 가게 현황</h3>
              <span className="text-xs text-blue-400">
                {latestScan.scanned_at
                  ? new Date(latestScan.scanned_at).toLocaleDateString("ko-KR", { month: "long", day: "numeric" }) + " 기준"
                  : "최근 스캔 기준"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 md:gap-3">
              {/* 네이버 순위 */}
              <div className="bg-white rounded-lg p-2.5 md:p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">네이버 순위</p>
                <p className="text-lg md:text-xl font-bold text-gray-800">
                  {latestScan.naver_result?.my_rank
                    ? `${latestScan.naver_result.my_rank}위`
                    : "–"}
                </p>
              </div>
              {/* 블로그 후기 */}
              <div className="bg-white rounded-lg p-2.5 md:p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">블로그 후기</p>
                <p className="text-lg md:text-xl font-bold text-gray-800">
                  {typeof latestScan.naver_result?.blog_mentions === "number"
                    ? `${latestScan.naver_result.blog_mentions.toLocaleString()}건`
                    : "–"}
                </p>
              </div>
              {/* AI 언급 여부 */}
              <div className="bg-white rounded-lg p-2.5 md:p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">AI 언급</p>
                <p className="text-base md:text-lg font-bold text-gray-800">
                  {(latestScan.exposure_freq ?? 0) > 0 ? "노출됨" : "미노출"}
                </p>
              </div>
            </div>
            {/* 경쟁사 대비 한 줄 메시지 */}
            {latestScan.naver_result?.top_competitor_name && (
              <p className="mt-3 text-xs md:text-sm text-blue-700 bg-blue-100 rounded-lg px-3 py-2">
                경쟁사 <strong>{latestScan.naver_result.top_competitor_name}</strong> 대비
                블로그 후기{" "}
                {Math.abs(
                  (latestScan.naver_result.top_competitor_blog_count ?? 0) -
                    (latestScan.naver_result.blog_mentions ?? 0)
                ).toLocaleString()}
                건{" "}
                {(latestScan.naver_result.blog_mentions ?? 0) >=
                (latestScan.naver_result.top_competitor_blog_count ?? 0)
                  ? "앞서고 있습니다"
                  : "뒤처져 있습니다"}
              </p>
            )}
            {/* 경쟁사 데이터 없을 때: 경쟁사 등록 유도 */}
            {!latestScan.naver_result?.top_competitor_name && (
              <p className="mt-3 text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                경쟁 가게를 등록하면 블로그 후기·AI 노출 격차를 비교할 수 있습니다.{" "}
                <a href="/competitors" className="font-semibold underline">경쟁사 등록 →</a>
              </p>
            )}
          </div>

          {/* Row 1: 듀얼트랙 점수 카드 — 점수 파악 먼저 */}
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
            benchmarkAvg={benchmark?.avg_score ?? undefined}
            smartPlaceStatus={smartPlaceStatus}
          />

          {/* ── Basic 강화 카드 1: 키워드별 블로그 비교 ── */}
          {(latestScan.naver_result?.keyword_blog_comparison?.length ?? 0) > 0 && (
            <div className="bg-white rounded-xl border p-4 md:p-6">
              <h3 className="text-base md:text-lg font-bold text-gray-800 mb-4">
                📊 키워드별 블로그 비교
              </h3>
              <div className="space-y-4">
                {latestScan.naver_result!.keyword_blog_comparison!.map((kbc: { keyword: string; my_count: number; competitor_count: number; competitor_name?: string }, i: number) => {
                  const maxCount = Math.max(kbc.my_count, kbc.competitor_count, 1)
                  const myPct   = Math.round((kbc.my_count / maxCount) * 100)
                  const compPct = Math.round((kbc.competitor_count / maxCount) * 100)
                  return (
                    <div key={i}>
                      <p className="text-sm font-semibold text-gray-700 mb-1.5">
                        &ldquo;{kbc.keyword}&rdquo; 키워드
                      </p>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-500 w-24 truncate">{kbc.competitor_name ?? '경쟁 1위'}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                          <div className="bg-gray-400 h-2.5 rounded-full" style={{width:`${compPct}%`}}/>
                        </div>
                        <span className="text-xs text-gray-600 w-14 text-right">{kbc.competitor_count.toLocaleString()}건</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-blue-700 w-24 truncate">내 가게</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                          <div className={`h-2.5 rounded-full ${kbc.my_count >= kbc.competitor_count ? 'bg-green-500' : 'bg-blue-500'}`} style={{width:`${myPct}%`}}/>
                        </div>
                        <span className="text-xs font-bold text-blue-700 w-14 text-right">{kbc.my_count.toLocaleString()}건</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Basic 강화 카드 2: 최신 블로그 후기 ── */}
          {(latestScan.naver_result?.top_blogs?.length ?? 0) > 0 && (
            <div className="bg-white rounded-xl border p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base md:text-lg font-bold text-gray-800">📝 최신 블로그 후기</h3>
                <span className="text-xs text-gray-400">
                  {latestScan.naver_result?.blog_mentions?.toLocaleString()}건 언급
                </span>
              </div>
              <div className="divide-y">
                {latestScan.naver_result!.top_blogs!.slice(0, 3).map((blog: { title: string; link: string; description?: string; postdate?: string }, i: number) => (
                  <a key={i} href={blog.link} target="_blank" rel="noopener noreferrer"
                    className="block py-3 hover:bg-gray-50 rounded transition-colors">
                    <p className="text-sm font-medium text-gray-800 line-clamp-1">{blog.title}</p>
                    {blog.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{blog.description}</p>
                    )}
                    {blog.postdate && (
                      <p className="text-xs text-gray-400 mt-1">
                        {blog.postdate.replace(/(\d{4})(\d{2})(\d{2})/, '$1.$2.$3')}
                      </p>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* ── Basic 강화 카드 3: 오늘 할 일 퀵 액션 ── */}
          {(latestScan.naver_result?.keyword_ranks?.length ?? 0) > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 md:p-6">
              <h3 className="text-base font-bold text-amber-900 mb-3">📌 오늘 할 일</h3>
              <div className="space-y-2">
                {latestScan.naver_result!.keyword_ranks!
                  .filter((kr: { query: string; exposed: boolean }) => !kr.exposed)
                  .slice(0, 2)
                  .map((kr: { query: string; exposed: boolean }, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-amber-500 mt-0.5">•</span>
                      <span className="text-amber-800">
                        <strong>&ldquo;{kr.query}&rdquo;</strong> 검색에서 미노출 — 스마트플레이스 Q&amp;A에 해당 키워드 포함 등록 권장
                      </span>
                    </div>
                  ))}
                <Link href="/guide" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-amber-700 hover:text-amber-900">
                  전체 개선 가이드 보기 →
                </Link>
              </div>
            </div>
          )}

          {/* AI 검색 진단 카드 — 진단 이해 */}
          <AIDiagnosisCard
            businessName={business.name}
            category={business.category}
            region={business.region}
            keywords={(business as { keywords?: string[] })?.keywords}
            allPlatformResults={allPlatformResults}
            reviewCount={(business as { review_count?: number })?.review_count ?? 0}
            avgRating={(business as { avg_rating?: number })?.avg_rating ?? 0}
            smartPlaceScore={(latestScan.score_breakdown as Record<string, number>)?.smart_place_completeness ?? 0}
            naverMentioned={latestScan.naver_result?.mentioned ?? false}
            totalScore={latestScan.total_score ?? 0}
            competitorItems={rankingItems}
            categoryKo={CATEGORY_LABEL[business.category] ?? business.category}
            inBriefing={latestScan.naver_result?.in_briefing ?? false}
          />

          {/* 행동 카드 — 오늘 1개 강조 + 이번주·이번달 접힌 형태 */}
          {showActionCards && (
            <div className="space-y-3">
              {actionCardToday && (
                <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                    <span className="text-base font-bold text-green-700">오늘 할 일 1가지</span>
                  </div>
                  <p className="text-sm text-green-800 leading-relaxed mb-3">{actionCardToday}</p>
                  <Link href="/guide" className="text-xs text-green-600 hover:underline font-medium">
                    가이드에서 해결책 보기 →
                  </Link>
                </div>
              )}
              {(actionCardWeek || actionCardMonth) && (
                <div className="border border-gray-200 rounded-xl px-4 py-3 space-y-1.5">
                  {actionCardWeek && (
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-blue-500 font-bold shrink-0">이번 주</span>
                      <span>{actionCardWeek}</span>
                    </div>
                  )}
                  {actionCardMonth && (
                    <div className="flex items-start gap-2 text-sm text-gray-500">
                      <span className="text-purple-500 font-bold shrink-0">이번 달</span>
                      <span>{actionCardMonth}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 개선 가이드 CTA */}
          <Link
            href="/guide"
            className="flex items-center justify-between gap-3 bg-blue-600 text-white rounded-xl px-5 py-4 md:py-5 hover:bg-blue-700 transition-colors group"
          >
            <div>
              <div className="text-sm font-semibold text-blue-200 mb-1">점수를 올리려면</div>
              <p className="text-base md:text-lg font-bold">AI 개선 가이드 보기 → 지금 바로 복사해서 쓸 수 있는 문구 제공</p>
              <p className="text-sm text-blue-200 mt-1">⏱ 스마트플레이스 개선 후 보통 2~4주 뒤 점수 변화가 시작됩니다</p>
            </div>
            <ChevronRight className="w-5 h-5 shrink-0 opacity-80 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          {/* 네이버 기반 점수 근거 */}
          <ScoreEvidenceCard
            breakdown={latestScan.score_breakdown as Record<string, number> ?? {}}
            naverResult={latestScan.naver_result ?? null}
            kakaoResult={kakaoResult}
            topMissingKeywords={topMissingKeywords}
            isKeywordEstimated={isKeywordEstimated}
            track1Score={track1Score}
            track2Score={track2Score}
            naverWeight={naverWeight}
            allPlatformResults={allPlatformResults}
            reviewCount={(business as { review_count?: number })?.review_count ?? undefined}
            avgRating={(business as { avg_rating?: number })?.avg_rating ?? undefined}
          />

          {/* 무료→유료 전환 섹션: ScoreEvidenceCard 바로 다음 */}
          <ConversionGuideSection
            breakdown={latestScan.score_breakdown as Record<string, number> ?? {}}
            businessName={business.name}
            topMissingKeywords={topMissingKeywords}
            reviewCount={(business as { review_count?: number })?.review_count ?? 0}
            plan={plan}
          />

          {/* 업그레이드 넛지 (Basic 사용자) */}
          {plan === 'basic' && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4 md:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-blue-900 mb-1">Pro로 업그레이드하면...</div>
                <p className="text-sm md:text-base text-blue-700 leading-relaxed">Gemini·ChatGPT·Perplexity 등 7개 AI 전체 스캔 주 3회 · 경쟁사 10개 비교 · CSV/PDF 내보내기 · 90일 히스토리</p>
              </div>
              <a href="/pricing" className="shrink-0 text-base font-semibold bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors text-center whitespace-nowrap">
                요금제 보기 →
              </a>
            </div>
          )}

          {/* 채널 분리 점수 카드 */}
          {naverChannelScore !== null && globalChannelScore !== null && (
            <ChannelScoreCards
              naverScore={naverChannelScore}
              globalScore={globalChannelScore}
              isSmartPlace={!!(business as { is_smart_place?: boolean } | null)?.is_smart_place}
              isOnKakao={kakaoResult?.is_on_kakao ?? false}
              kakaoRank={(kakaoResult as { my_rank?: number | null } | null)?.my_rank ?? null}
              kakaoCompetitorCount={((kakaoResult as { kakao_competitors?: unknown[] } | null)?.kakao_competitors ?? []).length}
              naverMentioned={latestScan.naver_result?.mentioned ?? false}
              chatgptMentioned={latestScan.chatgpt_result?.mentioned ?? false}
              hasWebsite={!!business.website_url}
              googlePlaceRegistered={!!business.google_place_id}
            />
          )}

          {/* 인스타그램 AI 인용 신호 카드 */}
          <InstagramSignalCard
            instagramResult={instagramResult}
            isConnected={isInstagramConnected}
          />

          {/* 카카오맵 완성도 체크리스트 */}
          <KakaoChecklistCard
            bizId={business.id}
            initialScore={kakaoScore}
            initialChecklist={kakaoChecklist}
            kakaoRegistered={kakaoRegistered}
          />

          {/* 글로벌 AI 미노출 교육 배너 */}
          {globalChannelScore !== null && (
            <GlobalAIBanner
              globalScore={globalChannelScore}
              hasWebsite={!!business.website_url}
            />
          )}

          {/* 추세 + 경쟁사 순위 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <TrendLine data={history ?? []} />
            <RankingBar items={rankingItems} />
          </div>

          {/* 업종 벤치마크 */}
          {benchmark && benchmark.count > 1 && (
            <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm">
              <h2 className="text-base md:text-lg font-semibold text-gray-800 mb-1">
                같은 지역·업종 비교
              </h2>
              <p className="text-sm text-gray-500 mb-1">
                {displayCity} {CATEGORY_LABEL[business.category] ?? business.category}
              </p>
              <p className="text-sm text-gray-400 mb-5">
                같은 지역의 동종 점포 {benchmark.count}곳과 AI 노출 점수를 비교한 결과입니다.
              </p>
              <div className="grid grid-cols-3 gap-3 md:gap-4 mb-5">
                <div className="text-center bg-blue-50 rounded-xl py-3 md:py-4">
                  <div className="text-2xl md:text-3xl font-bold text-blue-600">{Math.round(unifiedScore)}</div>
                  <div className="text-sm text-gray-500 mt-1">내 점수</div>
                </div>
                <div className="text-center bg-gray-50 rounded-xl py-3 md:py-4">
                  <div className="text-2xl md:text-3xl font-bold text-gray-700">{benchmark.avg_score}</div>
                  <div className="text-sm text-gray-500 mt-1">업종 평균</div>
                </div>
                <div className="text-center bg-amber-50 rounded-xl py-3 md:py-4">
                  <div className="text-2xl md:text-3xl font-bold text-amber-600">{benchmark.top10_score}</div>
                  <div className="text-sm text-gray-500 mt-1">상위 10%</div>
                </div>
              </div>
              <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="absolute h-full bg-gray-300 rounded-full"
                  style={{ width: `${Math.min(100, benchmark.avg_score)}%` }}
                />
                <div
                  className="absolute h-full w-1.5 bg-blue-600 rounded-full"
                  style={{ left: `${Math.min(99, unifiedScore)}%` }}
                />
              </div>
              <div className="flex justify-between text-sm text-gray-400 mt-1.5">
                <span>0</span>
                <span>100</span>
              </div>
              {unifiedScore >= benchmark.top10_score ? (
                <p className="text-sm font-semibold text-green-600 mt-2">상위 10% 달성!</p>
              ) : (
                <p className="text-sm text-gray-500 mt-2">
                  상위 10%까지 {Math.ceil(benchmark.top10_score - unifiedScore)}점 남았습니다.
                </p>
              )}
              {rankingTop5.length > 0 && (
                <div className="mt-5 border-t border-gray-100 pt-4">
                  <div className="text-sm font-semibold text-gray-600 mb-3">지역 TOP {rankingTop5.length} 순위</div>
                  <div className="space-y-2.5">
                    {rankingTop5.map((item: { name: string; total_score: number }, idx: number) => (
                      <div key={item.name} className="flex items-center gap-2.5">
                        <span className={`text-sm font-bold w-5 text-center shrink-0 ${idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-orange-400' : 'text-gray-300'}`}>
                          {idx + 1}
                        </span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${idx === 0 ? 'bg-amber-400' : 'bg-gray-300'}`}
                            style={{ width: `${Math.min(100, item.total_score)}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600 max-w-[96px] truncate text-right">{item.name}</span>
                        <span className="text-sm font-semibold text-gray-700 w-8 text-right shrink-0">{Math.round(item.total_score)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI 플랫폼 분포 차트 */}
          {Object.keys(allPlatformResults).length > 0 && (
            <PlatformDistributionChart
              results={allPlatformResults}
              naverChannelScore={naverChannelScore ?? undefined}
              globalChannelScore={globalChannelScore ?? undefined}
            />
          )}

          {/* 플랫폼별 상세 결과 테이블 */}
          {Object.keys(allPlatformResults).length > 0 && (
            <ResultTable results={allPlatformResults} />
          )}

          {/* 웹사이트 SEO 체크 */}
          <WebsiteCheckCard
            websiteUrl={business.website_url}
            checkResult={websiteCheckResult}
          />

          {/* 스마트플레이스 스코어카드 */}
          <SmartPlaceScorecard businessId={business.id} />

          {/* AI 브리핑 타임라인 */}
          {history && history.length >= 2 && (
            <BriefingTimeline history={history} businessName={business.name} />
          )}

          {/* AI 언급 맥락 (Pro+ 전용) */}
          {(plan === 'pro' || plan === 'biz' || plan === 'enterprise') && latestScan && (
            <MentionContextSection bizId={business.id} token={accessToken} />
          )}

          {/* 업종 트렌드 (Pro+) */}
          {(plan === 'pro' || plan === 'biz' || plan === 'enterprise') && (
            <IndustryTrendClientWrapper
              category={CATEGORY_LABEL[business.category] ?? business.category}
              categoryCode={business.category}
              region={business.region}
            />
          )}

          {/* 빠른 액션 링크 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {[
              { href: "/guide",       label: "AI 개선 가이드",         desc: "AI가 추천하는 개선 방법" },
              { href: "/schema",      label: "스마트플레이스 최적화",   desc: "소개글·블로그 자동 생성" },
              { href: "/competitors", label: "경쟁사 비교",             desc: "주변 경쟁 점포와 비교" },
              { href: "/history",     label: "변화 기록",               desc: "점수 변화 추이 보기" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="bg-white rounded-xl p-3 md:p-5 shadow-sm hover:shadow-md transition-shadow text-center border border-gray-100 hover:border-blue-200"
              >
                <div className="font-semibold text-gray-900 text-base md:text-lg leading-tight">{item.label}</div>
                <div className="text-sm text-gray-400 mt-1.5 leading-snug">{item.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        /* 스캔 없는 Empty State */
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
          <Search className="w-14 h-14 md:w-16 md:h-16 text-blue-300 mx-auto" strokeWidth={1} />
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">첫 AI 스캔을 시작하세요</h2>
            <p className="text-base md:text-lg text-gray-500 max-w-md leading-relaxed">
              손님이 <strong className="text-gray-700">&ldquo;{displayCity} {displaySearchKw} 추천&rdquo;</strong>이라고
              AI에 물어봤을 때 <strong>{iGa(business.name)}</strong> 나오는지 네이버·카카오·ChatGPT 3채널에서 동시에 확인합니다.
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2 md:gap-3 max-w-lg w-full">
            {[
              { name: "Gemini",      note: "100회 측정" },
              { name: "ChatGPT",     note: "인용 여부"  },
              { name: "네이버 AI",   note: "브리핑 포함" },
              { name: "Perplexity",  note: "출처 검색"  },
              { name: "Google AI",   note: "AI 오버뷰"  },
            ].map((p) => (
              <div key={p.name} className="bg-gray-50 rounded-xl py-3 px-2 border border-gray-100 text-center">
                <div className="font-semibold text-gray-800 text-xs md:text-sm leading-tight">{p.name}</div>
                <div className="text-gray-400 text-xs mt-0.5 leading-tight">{p.note}</div>
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
          <p className="text-base text-gray-500">상단 <strong className="text-gray-700">AI 스캔 시작</strong> 버튼을 눌러주세요 · 약 2~3분 소요</p>
        </div>
      )}
      </>)}
    </div>
  );
}
