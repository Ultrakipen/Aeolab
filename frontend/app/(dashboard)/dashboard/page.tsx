import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DualTrackCard from "@/components/dashboard/DualTrackCard";
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
import { RescanBanner } from "./RescanBanner";
import { NewCompetitorAlert } from "@/components/dashboard/NewCompetitorAlert";
import Link from "next/link";
import { MentionContextSection } from "./MentionContextSection";
import { Search, ChevronRight, Share2 } from "lucide-react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

interface Benchmark {
  count: number
  avg_score: number
  top10_score: number
  distribution: { range: string; count: number }[]
}

const BREAKDOWN_LABELS: Record<string, string> = {
  // v3.0 Track 1 항목
  keyword_gap_score:        "키워드 커버리지",
  review_quality:           "리뷰 수·평점",
  smart_place_completeness: "스마트플레이스 완성도",
  naver_exposure_confirmed: "네이버 AI 브리핑 노출",
  // v3.0 Track 2 항목
  multi_ai_exposure:        "글로벌 AI 노출",
  schema_seo:               "웹사이트 구조화",
  online_mentions_t2:       "온라인 언급 수",
  google_presence:          "Google AI 노출",
  // 하위호환 항목
  exposure_freq:            "AI 검색 노출 횟수",
  schema_score:             "AI 인식 최적화",
  online_mentions:          "온라인 언급 빈도",
  info_completeness:        "사업장 정보 완성도",
  content_freshness:        "최신 정보 업데이트",
};

// breakdown에서 UI에 표시할 항목 순서 (v3.0 Track 우선, 하위호환 제외)
const BREAKDOWN_DISPLAY_KEYS = [
  "keyword_gap_score", "review_quality", "smart_place_completeness", "naver_exposure_confirmed",
  "multi_ai_exposure", "schema_seo", "online_mentions_t2", "google_presence",
];

// 각 항목에 대한 소상공인 눈높이 설명 (ⓘ tooltip용)
const BREAKDOWN_DESCRIPTIONS: Record<string, string> = {
  exposure_freq: "Gemini AI에서 100번 질문했을 때 내 가게가 답변에 나온 횟수입니다. 높을수록 AI 검색에서 잘 노출됩니다.",
  review_quality: "리뷰 수와 평균 별점이 반영됩니다. AI는 리뷰가 많고 평점이 높은 가게를 더 자주 추천합니다.",
  schema_score: "스마트플레이스 정보 등록 완성도입니다. 영업시간·전화번호·메뉴가 정확히 등록돼야 AI가 잘 인식합니다.",
  online_mentions: "블로그·SNS에 가게가 언급된 빈도입니다. 온라인에 자주 등장할수록 AI가 신뢰도 높게 인식합니다.",
  info_completeness: "주소·전화·영업시간·메뉴 등 가게 기본 정보가 얼마나 완전히 입력됐는지입니다.",
  content_freshness: "최근에 올라온 블로그·리뷰·공지가 있는지 확인합니다. 오래된 정보만 있으면 AI가 최신 가게로 인식하지 못합니다.",
};

// 항목 점수가 낮을 때 바로 실천할 행동
const BREAKDOWN_ACTIONS: Record<string, { action: string; link: string }> = {
  exposure_freq:      { action: "스마트플레이스 대표 키워드를 추가·정리하세요",               link: "/schema" },
  review_quality:     { action: "단골 손님 1명에게 네이버 리뷰를 요청하세요",               link: "/guide" },
  schema_score:       { action: "스마트플레이스 소개글·영업시간·메뉴를 업데이트하세요",       link: "/schema" },
  online_mentions:    { action: "블로그 후기 1건을 요청하거나 직접 작성하세요",              link: "/schema" },
  info_completeness:  { action: "전화번호·영업시간·주소 정보를 확인하고 채워주세요",         link: "/schema" },
  content_freshness:  { action: "최근 공지나 메뉴 변경 사항을 스마트플레이스에 등록하세요",   link: "/schema" },
};

// 플랜별 하루 수동 스캔 한도
const SCAN_DAILY_LIMITS: Record<string, number> = {
  free: 0, basic: 2, pro: 5, startup: 3, biz: 999, enterprise: 999,
};

// 플랜별 자동 스캔 레이블 (실제 스케줄러 동작과 일치)
function nextScanLabel(plan: string | null | undefined): { label: string; desc: string } {
  const p = plan ?? "free";
  if (p === "biz" || p === "enterprise")
    return { label: "매일 새벽 자동 스캔", desc: "내일 새벽 2시에 7개 AI 전체 분석합니다" };
  if (p === "startup")
    return { label: "매일 자동 스캔 (월요일 전체)", desc: "매일 Gemini+네이버, 월요일 새벽 2시에 7개 AI 전체 분석합니다" };
  if (p === "pro")
    return { label: "주 3회 자동 스캔 (월·수·금)", desc: "월·수·금 새벽 2시에 7개 AI 전체 분석, 나머지 날은 Gemini+네이버만 분석합니다" };
  if (p === "basic")
    return { label: "매일 자동 스캔 (월요일 전체)", desc: "매일 Gemini+네이버, 월요일 새벽 2시에 7개 AI 전체 분석합니다" };
  return { label: "자동 스캔 없음", desc: "유료 플랜으로 업그레이드하면 자동 스캔을 이용할 수 있습니다" };
}

function scoreToGrade(score: number): string {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "D";
}

function scoreBarColor(value: number): string {
  if (value >= 70) return "bg-green-500";
  if (value >= 40) return "bg-yellow-400";
  return "bg-red-400";
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

  const { data: businesses } = await supabase
    .from("businesses")
    .select("*")
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
          .select("id, scanned_at, query_used, gemini_result, chatgpt_result, perplexity_result, grok_result, naver_result, claude_result, google_result, kakao_result, website_check_result, exposure_freq, total_score, unified_score, track1_score, track2_score, naver_weight, global_weight, growth_stage, growth_stage_label, is_keyword_estimated, keyword_coverage, score_breakdown, naver_channel_score, global_channel_score, rank_in_query, competitor_scores, top_missing_keywords")
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
        fetch(`${BACKEND}/api/report/benchmark/${business.category}/${encodeURIComponent(business.region)}`)
          .then((r) => r.ok ? r.json() : null)
          .catch(() => null),
        fetch(`${BACKEND}/api/report/ranking/${business.category}/${encodeURIComponent(business.region)}`)
          .then((r) => r.ok ? r.json() : null)
          .catch(() => null),
        supabase
          .from("guides")
          .select("priority_json")
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
  const plan = subscription?.status === "active" ? (subscription?.plan ?? "free") : "free";
  const scanInfo = nextScanLabel(plan);
  const scanLimit = SCAN_DAILY_LIMITS[plan] ?? 0;
  const scanUsed = scanUsedToday ?? 0;

  // 오늘의 할 일 도출: 가이드 최상위 항목 > 가장 낮은 점수 항목
  let todayAction: { text: string; link: string } | null = null;
  const guideTopAction = (latestGuide as { priority_json?: string[] } | null)?.priority_json?.[0] ?? null;
  if (guideTopAction) {
    todayAction = { text: guideTopAction, link: "/guide" };
  } else if (latestScan?.score_breakdown) {
    const lowest = Object.entries(latestScan.score_breakdown as Record<string, number>)
      .sort(([, a], [, b]) => Number(a) - Number(b))[0];
    if (lowest && BREAKDOWN_ACTIONS[lowest[0]]) {
      todayAction = { text: BREAKDOWN_ACTIONS[lowest[0]].action, link: BREAKDOWN_ACTIONS[lowest[0]].link };
    }
  }

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

  return (
    <div className="p-3 md:p-6">
      {/* 스캔 요청 후 리다이렉트 시 안내 배너 */}
      {showRescanNotice && <RescanBanner />}

      {/* 사업장 미등록 시 CTA 배너 */}
      {!business && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 md:p-8 mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
            <div className="flex-1">
              <h2 className="text-xl md:text-2xl font-bold text-blue-900 mb-2">
                내 가게를 등록하고 AI 검색 분석을 시작하세요
              </h2>
              <p className="text-blue-700 text-base mb-3">
                가게 이름과 업종만 입력하면 AI 검색 노출 현황을 즉시 확인할 수 있습니다.
              </p>
              <ul className="space-y-1.5 text-sm text-blue-600">
                <li>✓ 7개 AI 플랫폼 노출 현황 분석</li>
                <li>✓ 경쟁 사업장과 비교</li>
                <li>✓ AI 브리핑 노출 개선 가이드</li>
              </ul>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <a
                href="/onboarding"
                className="inline-flex items-center justify-center w-full md:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-base transition-colors"
              >
                내 가게 등록하고 시작하기
              </a>
              <p className="text-sm text-blue-500 text-center">무료로 시작 · 1분 소요</p>
            </div>
          </div>
        </div>
      )}

      {business && (<>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">{business.name}</h1>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full cursor-default ${
                plan === 'biz' || plan === 'enterprise' ? 'bg-purple-100 text-purple-700' :
                plan === 'pro'     ? 'bg-blue-100 text-blue-700' :
                plan === 'startup' ? 'bg-green-100 text-green-700' :
                plan === 'basic'   ? 'bg-gray-100 text-gray-600' :
                'bg-gray-50 text-gray-400'
              }`}
              title={
                plan === 'basic'   ? 'Basic 플랜 — 경쟁사 3개 · 가이드 월 1회 · 히스토리 30일' :
                plan === 'pro'     ? 'Pro 플랜 — 경쟁사 10개 · 가이드 월 5회 · 히스토리 90일' :
                plan === 'biz'     ? 'Biz 플랜 — 경쟁사 무제한 · 가이드 월 20회 · 히스토리 무제한' :
                plan === 'startup' ? '창업패키지 — 경쟁사 10개 · 가이드 월 5회 · 시장 분석 리포트 포함' :
                '무료 — 자동 스캔 없음'
              }
            >
              {plan === 'enterprise' ? 'Enterprise' :
               plan === 'biz'        ? 'Biz' :
               plan === 'pro'        ? 'Pro' :
               plan === 'startup'    ? '창업패키지' :
               plan === 'basic'      ? 'Basic' : '무료'}
            </span>
          </div>
          <p className="text-gray-500">{business.region} · {business.category}</p>
          <p className="text-sm text-blue-500 mt-1" title={scanInfo.desc}>
            🔄 {scanInfo.label}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={`/share/${business.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-blue-600 border border-gray-200 hover:border-blue-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" /> 결과 공유
          </a>
          <ScanTrigger
            businessId={business.id}
            businessName={business.name}
            category={business.category}
            region={business.region}
            scanUsed={scanUsed}
            scanLimit={scanLimit}
          />
        </div>
      </div>

      {/* 신규 경쟁사 알림 배너 */}
      <NewCompetitorAlert businessId={business.id} />

      {latestScan ? (
        <div className="space-y-4 md:space-y-5">
          {/* 오늘의 할 일 */}
          {todayAction && (
            <Link
              href={todayAction.link}
              className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5 hover:bg-amber-100 transition-colors group"
            >
              <div>
                <div className="text-sm font-semibold text-amber-700 mb-0.5">오늘의 할 일 1가지</div>
                <p className="text-base text-amber-900 font-medium">{todayAction.text}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-500 shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          )}

          {/* Row 1: 듀얼트랙 점수 카드 */}
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
          />

          {/* 개선 가이드 CTA — 갭 ③ */}
          <Link
            href="/guide"
            className="flex items-center justify-between gap-3 bg-blue-600 text-white rounded-xl px-5 py-4 hover:bg-blue-700 transition-colors group"
          >
            <div>
              <div className="text-sm font-semibold text-blue-200 mb-0.5">점수를 올리려면</div>
              <p className="text-base font-bold">AI 개선 가이드 보기 → 지금 바로 복사해서 쓸 수 있는 문구 제공</p>
              <p className="text-sm text-blue-200 mt-1">⏱ 스마트플레이스 개선 후 보통 2~4주 뒤 점수 변화가 시작됩니다</p>
            </div>
            <ChevronRight className="w-5 h-5 shrink-0 opacity-80 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          {/* Row 2: 항목별 분석 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm col-span-3 md:col-span-2">
              <div className="text-sm font-medium text-gray-700 mb-1">항목별 분석</div>
              <p className="text-sm text-gray-400 mb-4 leading-relaxed">각 항목이 높을수록 AI 검색에서 더 자주 노출됩니다. 항목명을 탭하면 설명을 볼 수 있습니다.</p>
              {latestScan.score_breakdown && (
                <div className="space-y-3">
                  {(BREAKDOWN_DISPLAY_KEYS.some(k => k in latestScan.score_breakdown)
                    ? BREAKDOWN_DISPLAY_KEYS
                    : Object.keys(latestScan.score_breakdown)
                  ).filter(key => key in latestScan.score_breakdown && BREAKDOWN_LABELS[key]).map((key) => {
                    const v = Math.round(Number((latestScan.score_breakdown as Record<string, number>)[key] ?? 0));
                    const desc = BREAKDOWN_DESCRIPTIONS[key];
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <div
                          className="text-sm md:text-base text-gray-600 w-28 md:w-40 shrink-0 flex items-center gap-1 cursor-default leading-tight"
                          title={desc}
                        >
                          {BREAKDOWN_LABELS[key] ?? key}
                          {desc && <span className="text-gray-300 text-sm hidden md:inline">ⓘ</span>}
                        </div>
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div
                            className={`${scoreBarColor(v)} h-2 rounded-full transition-all`}
                            style={{ width: `${Math.min(100, v)}%` }}
                          />
                        </div>
                        <div className={`text-sm md:text-base w-10 md:w-12 text-right font-medium shrink-0 ${v >= 70 ? "text-green-600" : v >= 40 ? "text-yellow-600" : "text-red-500"}`}>
                          {v}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 업그레이드 넛지 (Basic 사용자) */}
          {plan === 'basic' && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-blue-900 mb-0.5">Pro로 업그레이드하면...</div>
                <p className="text-sm text-blue-700 leading-relaxed">7개 AI 전체 스캔 주 3회 · 경쟁사 10개 비교 · CSV/PDF 내보내기 · 90일 히스토리</p>
              </div>
              <a href="/pricing" className="shrink-0 text-sm font-semibold bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors text-center">
                요금제 보기 →
              </a>
            </div>
          )}

          {/* Row 2: 채널 분리 점수 카드 */}
          {naverChannelScore !== null && globalChannelScore !== null && (
            <ChannelScoreCards
              naverScore={naverChannelScore}
              globalScore={globalChannelScore}
              isSmartPlace={!!(latestScan.naver_result as { in_briefing?: boolean } | null)?.in_briefing || (latestScan.score_breakdown?.schema_score ?? 0) >= 60}
              isOnKakao={kakaoResult?.is_on_kakao ?? false}
              kakaoRank={(kakaoResult as { my_rank?: number | null } | null)?.my_rank ?? null}
              kakaoCompetitorCount={((kakaoResult as { kakao_competitors?: unknown[] } | null)?.kakao_competitors ?? []).length}
              naverMentioned={latestScan.naver_result?.mentioned ?? false}
              chatgptMentioned={latestScan.chatgpt_result?.mentioned ?? false}
              hasWebsite={!!business.website_url}
              googlePlaceRegistered={!!business.google_place_id}
            />
          )}

          {/* Row 3: 글로벌 AI 미노출 교육 배너 */}
          {globalChannelScore !== null && (
            <GlobalAIBanner
              globalScore={globalChannelScore}
              hasWebsite={!!business.website_url}
            />
          )}

          {/* Row 4: 추세 + 경쟁사 순위 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TrendLine data={history ?? []} />
            <RankingBar items={rankingItems} />
          </div>

          {/* Row 5: 업종 벤치마크 */}
          {benchmark && benchmark.count > 1 && (
            <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm">
              <div className="text-sm font-medium text-gray-700 mb-1">
                같은 지역·업종 비교 — {business.region} {business.category}
              </div>
              <p className="text-sm text-gray-400 mb-4">같은 지역의 동종 점포 {benchmark.count}곳과 AI 노출 점수를 비교한 결과입니다.</p>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-xl md:text-2xl font-bold text-blue-600">{Math.round(latestScan.total_score)}</div>
                  <div className="text-sm text-gray-500 mt-0.5">내 점수</div>
                </div>
                <div className="text-center">
                  <div className="text-xl md:text-2xl font-bold text-gray-700">{benchmark.avg_score}</div>
                  <div className="text-sm text-gray-500 mt-0.5">업종 평균</div>
                </div>
                <div className="text-center">
                  <div className="text-xl md:text-2xl font-bold text-amber-600">{benchmark.top10_score}</div>
                  <div className="text-sm text-gray-500 mt-0.5">상위 10%</div>
                </div>
              </div>
              <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="absolute h-full bg-gray-300 rounded-full"
                  style={{ width: `${Math.min(100, benchmark.avg_score)}%` }}
                />
                <div
                  className="absolute h-full w-1 bg-blue-600 rounded-full"
                  style={{ left: `${Math.min(99, latestScan.total_score)}%` }}
                />
              </div>
              <div className="flex justify-between text-sm text-gray-400 mt-1">
                <span>0</span>
                <span>100</span>
              </div>
              {latestScan.total_score >= benchmark.top10_score ? (
                <p className="text-sm text-green-600 font-medium mt-2">상위 10% 달성!</p>
              ) : (
                <p className="text-sm text-gray-500 mt-2">
                  상위 10%까지 {Math.ceil(benchmark.top10_score - latestScan.total_score)}점 남았습니다.
                </p>
              )}
              {rankingTop5.length > 0 && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <div className="text-sm font-semibold text-gray-500 mb-2">지역 TOP {rankingTop5.length} 순위</div>
                  <div className="space-y-1.5">
                    {rankingTop5.map((item, idx) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <span className={`text-sm font-bold w-5 text-center ${idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-orange-400' : 'text-gray-300'}`}>
                          {idx + 1}
                        </span>
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${idx === 0 ? 'bg-amber-400' : 'bg-gray-300'}`}
                            style={{ width: `${Math.min(100, item.total_score)}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600 max-w-[80px] truncate text-right">{item.name}</span>
                        <span className="text-sm font-semibold text-gray-700 w-8 text-right shrink-0">{Math.round(item.total_score)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Row 6: AI 플랫폼 분포 차트 */}
          {Object.keys(allPlatformResults).length > 0 && (
            <PlatformDistributionChart
              results={allPlatformResults}
              naverChannelScore={naverChannelScore ?? undefined}
              globalChannelScore={globalChannelScore ?? undefined}
            />
          )}

          {/* Row 7: 플랫폼별 상세 결과 테이블 */}
          {Object.keys(allPlatformResults).length > 0 && (
            <ResultTable results={allPlatformResults} />
          )}

          {/* Row 8: 웹사이트 SEO 체크 */}
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

          {/* Row: AI 언급 맥락 (Pro+ 전용 — 클라이언트 fetch) */}
          {(plan === 'pro' || plan === 'biz' || plan === 'enterprise') && latestScan && (
            <MentionContextSection bizId={business.id} token="" />
          )}

          {/* 빠른 액션 링크 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { href: "/guide",       label: "AI 개선 가이드",         desc: "AI가 추천하는 개선 방법" },
              { href: "/schema",      label: "스마트플레이스 최적화",   desc: "소개글·블로그 자동 생성" },
              { href: "/competitors", label: "경쟁사 비교",             desc: "주변 경쟁 점포와 비교" },
              { href: "/history",     label: "변화 기록",               desc: "점수 변화 추이 보기" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="bg-white rounded-xl p-3 md:p-4 shadow-sm hover:shadow-md transition-shadow text-center"
              >
                <div className="font-semibold text-gray-900 text-base leading-tight">{item.label}</div>
                <div className="text-sm text-gray-400 mt-1 leading-snug">{item.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-2">
          <Search className="w-12 h-12 md:w-14 md:h-14 text-blue-300 mx-auto" strokeWidth={1} />
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">첫 AI 스캔을 시작하세요</h2>
            <p className="text-base text-gray-500 max-w-md leading-relaxed">
              손님이 &ldquo;{business.region} {business.category} 추천&rdquo; 이라고 AI에 물어봤을 때<br />
              <strong>{business.name}</strong>이 나오는지 7개 AI에서 동시에 확인합니다.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-500 max-w-lg w-full">
            {[
              { name: "Gemini", note: "100회 측정" },
              { name: "ChatGPT", note: "인용 여부" },
              { name: "네이버 AI 브리핑", note: "브리핑 포함" },
              { name: "Perplexity", note: "출처 검색" },
              { name: "Grok AI", note: "최신 검색" },
              { name: "Claude", note: "AI 노출" },
              { name: "Google AI", note: "AI 오버뷰" },
            ].map((p) => (
              <div key={p.name} className="bg-gray-50 rounded-lg py-2.5 px-3">
                <div className="font-semibold text-gray-700">{p.name}</div>
                <div className="text-gray-400 text-sm mt-0.5">{p.note}</div>
              </div>
            ))}
          </div>
          <div className="bg-blue-50 rounded-2xl px-5 py-4 max-w-md w-full text-left">
            <p className="text-sm font-semibold text-blue-800 mb-2">스캔 후 바로 확인할 수 있습니다</p>
            <ul className="space-y-1.5 text-base text-blue-700">
              <li>→ 7개 AI 중 몇 개에서 내 가게가 나오는지</li>
              <li>→ 네이버·카카오 지역 검색 순위</li>
              <li>→ 경쟁 가게와의 AI 노출 점수 비교</li>
              <li>→ 점수를 올리는 맞춤 개선 가이드</li>
            </ul>
          </div>
          <p className="text-base text-gray-400">상단 <strong className="text-gray-600">AI 스캔 시작</strong> 버튼을 눌러주세요 · 약 2~3분 소요</p>
        </div>
      )}
      </>)}
    </div>
  );
}
