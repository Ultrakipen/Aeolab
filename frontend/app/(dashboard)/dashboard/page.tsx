import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ScoreCard } from "@/components/dashboard/ScoreCard";
import { RankingBar } from "@/components/dashboard/RankingBar";
import { TrendLine } from "@/components/dashboard/TrendLine";
import { ResultTable } from "@/components/scan/ResultTable";
import { ChannelScoreCards } from "@/components/dashboard/ChannelScoreCards";
import { GlobalAIBanner } from "@/components/dashboard/GlobalAIBanner";
import { PlatformDistributionChart } from "@/components/dashboard/PlatformDistributionChart";
import { WebsiteCheckCard } from "@/components/dashboard/WebsiteCheckCard";
import { ScanTrigger } from "./ScanTrigger";
import Link from "next/link";
import { Search } from "lucide-react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

interface Benchmark {
  count: number
  avg_score: number
  top10_score: number
  distribution: { range: string; count: number }[]
}

const BREAKDOWN_LABELS: Record<string, string> = {
  exposure_freq: "AI 검색 노출 횟수",
  review_quality: "리뷰 수·평점",
  schema_score: "AI 인식 최적화",
  online_mentions: "온라인 언급 빈도",
  info_completeness: "사업장 정보 완성도",
  content_freshness: "최신 정보 업데이트",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user || error) redirect("/login");

  const { data: businesses } = await supabase
    .from("businesses")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1);

  const business = businesses?.[0];

  if (!business) {
    redirect("/onboarding");
  }

  const [{ data: scanResults }, { data: competitors }, { data: history }, benchmarkRes, { data: subscription }] = await Promise.all([
    supabase
      .from("scan_results")
      .select("id, scanned_at, query_used, gemini_result, chatgpt_result, perplexity_result, grok_result, naver_result, claude_result, zeta_result, google_result, kakao_result, website_check_result, exposure_freq, total_score, score_breakdown, naver_channel_score, global_channel_score, rank_in_query, competitor_scores")
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
      .select("*")
      .eq("business_id", business.id)
      .order("score_date", { ascending: false })
      .limit(30),
    fetch(`${BACKEND}/api/report/benchmark/${business.category}/${encodeURIComponent(business.region)}`)
      .then((r) => r.ok ? r.json() : null)
      .catch(() => null),
    supabase
      .from("subscriptions")
      .select("plan, status")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const benchmark: Benchmark | null = benchmarkRes ?? null;

  const latestScan = scanResults?.[0];
  const prevScan = scanResults?.[1];
  const plan = subscription?.plan ?? "basic";
  const scanInfo = nextScanLabel(plan);

  const competitorScores: Record<string, { name: string; score: number }> =
    latestScan?.competitor_scores ?? {};
  const rankingItems = [
    ...(competitors ?? []).map((c) => ({
      name: c.name,
      score: competitorScores[c.id]?.score ?? 0,
    })),
    { name: business.name, score: latestScan?.total_score ?? 0, isMe: true },
  ];

  // 채널 점수
  const naverChannelScore  = latestScan?.naver_channel_score  ?? null
  const globalChannelScore = latestScan?.global_channel_score ?? null

  // 플랫폼별 결과 병합 (카카오맵 노출 여부 포함)
  const allPlatformResults: Record<string, { mentioned: boolean; exposure_freq?: number; in_briefing?: boolean; in_ai_overview?: boolean; error?: string }> = {
    ...(latestScan?.gemini_result     ? { gemini:     latestScan.gemini_result }     : {}),
    ...(latestScan?.chatgpt_result    ? { chatgpt:    latestScan.chatgpt_result }    : {}),
    ...(latestScan?.perplexity_result ? { perplexity: latestScan.perplexity_result } : {}),
    ...(latestScan?.grok_result       ? { grok:       latestScan.grok_result }       : {}),
    ...(latestScan?.naver_result      ? { naver:      latestScan.naver_result }      : {}),
    ...(latestScan?.claude_result     ? { claude:     latestScan.claude_result }     : {}),
    ...(latestScan?.zeta_result       ? { zeta:       latestScan.zeta_result }       : {}),
    ...(latestScan?.google_result     ? { google:     latestScan.google_result }     : {}),
  }

  const kakaoResult = latestScan?.kakao_result ?? null
  const websiteCheckResult = latestScan?.website_check_result ?? null

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{business.name}</h1>
          <p className="text-gray-500 text-sm">{business.region} · {business.category}</p>
          <p className="text-xs text-blue-500 mt-1" title={scanInfo.desc}>
            🔄 {scanInfo.label}
          </p>
        </div>
        <ScanTrigger
          businessId={business.id}
          businessName={business.name}
          category={business.category}
          region={business.region}
        />
      </div>

      {latestScan ? (
        <div className="space-y-6">
          {/* Row 1: 점수 + 항목별 분석 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ScoreCard
              score={Math.round(latestScan.total_score)}
              grade={scoreToGrade(latestScan.total_score)}
              exposureFreq={latestScan.exposure_freq}
              prevScore={prevScan?.total_score}
              scannedAt={latestScan.scanned_at}
            />
            <div className="bg-white rounded-2xl p-6 shadow-sm col-span-2">
              <div className="text-sm font-medium text-gray-700 mb-1">항목별 분석</div>
              <p className="text-xs text-gray-400 mb-4">각 항목 점수가 높을수록 AI 검색에 더 잘 노출됩니다.</p>
              {latestScan.score_breakdown && (
                <div className="space-y-3">
                  {Object.entries(latestScan.score_breakdown).map(([key, value]) => {
                    const v = Math.round(Number(value));
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <div className="text-sm text-gray-600 w-32 shrink-0">
                          {BREAKDOWN_LABELS[key] ?? key}
                        </div>
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div
                            className={`${scoreBarColor(v)} h-2 rounded-full transition-all`}
                            style={{ width: `${Math.min(100, v)}%` }}
                          />
                        </div>
                        <div className={`text-sm w-10 text-right font-medium ${v >= 70 ? "text-green-600" : v >= 40 ? "text-yellow-600" : "text-red-500"}`}>
                          {v}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TrendLine data={history ?? []} />
            <RankingBar items={rankingItems} />
          </div>

          {/* Row 5: 업종 벤치마크 */}
          {benchmark && benchmark.count > 1 && (
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="text-sm font-medium text-gray-700 mb-1">
                같은 지역·업종 비교 — {business.region} {business.category}
              </div>
              <p className="text-xs text-gray-400 mb-4">같은 지역의 동종 점포 {benchmark.count}곳과 AI 노출 점수를 비교한 결과입니다.</p>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{Math.round(latestScan.total_score)}</div>
                  <div className="text-xs text-gray-500 mt-0.5">내 점수</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-700">{benchmark.avg_score}</div>
                  <div className="text-xs text-gray-500 mt-0.5">업종 평균</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-600">{benchmark.top10_score}</div>
                  <div className="text-xs text-gray-500 mt-0.5">상위 10%</div>
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
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0</span>
                <span>100</span>
              </div>
              {latestScan.total_score >= benchmark.top10_score ? (
                <p className="text-xs text-green-600 font-medium mt-2">상위 10% 달성!</p>
              ) : (
                <p className="text-xs text-gray-500 mt-2">
                  상위 10%까지 {Math.ceil(benchmark.top10_score - latestScan.total_score)}점 남았습니다.
                </p>
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

          {/* 빠른 액션 링크 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { href: "/guide", label: "AI 개선 가이드", desc: "AI가 추천하는 개선 방법" },
              { href: "/schema", label: "AI 검색 등록", desc: "검색엔진에 정보 등록하기" },
              { href: "/competitors", label: "경쟁사 비교", desc: "주변 경쟁 점포와 비교" },
              { href: "/history", label: "변화 기록", desc: "점수 변화 추이 보기" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow text-center"
              >
                <div className="font-medium text-gray-900 text-sm">{item.label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{item.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
          <Search className="w-14 h-14 text-blue-300 mx-auto" strokeWidth={1} />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">첫 AI 스캔을 시작하세요</h2>
            <p className="text-gray-500 max-w-md">
              손님이 &ldquo;{business.region} {business.category} 추천&rdquo; 이라고 AI에 물어봤을 때<br />
              <strong>{business.name}</strong>이 나오는지 8개 AI에서 동시에 확인합니다.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-500 max-w-lg w-full">
            {[
              { name: "Gemini", note: "100회 측정" },
              { name: "ChatGPT", note: "인용 여부" },
              { name: "네이버 AI 브리핑", note: "브리핑 포함" },
              { name: "Perplexity", note: "출처 검색" },
              { name: "Grok AI", note: "최신 검색" },
              { name: "Claude", note: "AI 노출" },
              { name: "뤼튼(Zeta)", note: "국내 AI" },
              { name: "Google AI", note: "AI 오버뷰" },
            ].map((p) => (
              <div key={p.name} className="bg-gray-50 rounded-lg py-2 px-3">
                <div className="font-medium text-gray-700">{p.name}</div>
                <div className="text-gray-400">{p.note}</div>
              </div>
            ))}
          </div>
          <div className="bg-blue-50 rounded-2xl px-6 py-4 max-w-md w-full text-left">
            <p className="text-sm font-semibold text-blue-800 mb-2">스캔 후 바로 확인할 수 있습니다</p>
            <ul className="space-y-1 text-xs text-blue-700">
              <li>→ 8개 AI 중 몇 개에서 내 가게가 나오는지</li>
              <li>→ 네이버·카카오 지역 검색 순위</li>
              <li>→ 경쟁 가게와의 AI 노출 점수 비교</li>
              <li>→ 점수를 올리는 맞춤 개선 가이드</li>
            </ul>
          </div>
          <p className="text-sm text-gray-400">상단 <strong className="text-gray-600">AI 스캔 시작</strong> 버튼을 눌러주세요 · 약 2~3분 소요</p>
        </div>
      )}
    </div>
  );
}

function scoreToGrade(score: number): string {
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 50) return "C";
  if (score >= 35) return "D";
  return "F";
}

function scoreBarColor(value: number): string {
  if (value >= 70) return "bg-green-500";
  if (value >= 40) return "bg-yellow-400";
  return "bg-red-400";
}

function nextScanLabel(plan: string | null | undefined): { label: string; desc: string } {
  const p = plan ?? "basic";
  if (p === "biz" || p === "enterprise") return { label: "매일 새벽 자동 스캔", desc: "내일 새벽 2시에 자동 분석합니다" };
  if (p === "pro") return { label: "매주 월요일 자동 스캔", desc: "다음 월요일 새벽 2시에 자동 분석합니다" };
  return { label: "매월 1일 자동 스캔", desc: "다음 달 1일에 자동 분석합니다" };
}
