import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { RegisterBusinessForm } from "@/components/dashboard/RegisterBusinessForm";
import { ScoreCard } from "@/components/dashboard/ScoreCard";
import { RankingBar } from "@/components/dashboard/RankingBar";
import { TrendLine } from "@/components/dashboard/TrendLine";
import { ResultTable } from "@/components/scan/ResultTable";
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
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");
  const user = session.user;

  const { data: businesses } = await supabase
    .from("businesses")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1);

  const business = businesses?.[0];

  if (!business) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">대시보드</h1>
        <p className="text-gray-500 mb-6">사업장을 먼저 등록하면 AI 스캔이 자동으로 시작됩니다.</p>
        <RegisterBusinessForm userId={user.id} />
      </div>
    );
  }

  const [{ data: scanResults }, { data: competitors }, { data: history }, benchmarkRes] = await Promise.all([
    supabase
      .from("scan_results")
      .select("*")
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
  ]);

  const benchmark: Benchmark | null = benchmarkRes ?? null;

  const latestScan = scanResults?.[0];
  const prevScan = scanResults?.[1];

  const competitorScores: Record<string, { name: string; score: number }> =
    latestScan?.competitor_scores ?? {};
  const rankingItems = [
    ...(competitors ?? []).map((c) => ({
      name: c.name,
      score: competitorScores[c.id]?.score ?? 0,
    })),
    { name: business.name, score: latestScan?.total_score ?? 0, isMe: true },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{business.name}</h1>
          <p className="text-gray-500 text-sm">{business.region} · {business.category}</p>
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
              grade={latestScan.score_breakdown ? scoreToGrade(latestScan.total_score) : "—"}
              exposureFreq={latestScan.exposure_freq}
              prevScore={prevScan?.total_score}
              scannedAt={latestScan.scanned_at}
            />
            <div className="bg-white rounded-2xl p-6 shadow-sm col-span-2">
              <div className="text-sm font-medium text-gray-700 mb-1">항목별 분석</div>
              <p className="text-xs text-gray-400 mb-4">각 항목 점수가 높을수록 AI 검색에 더 잘 노출됩니다.</p>
              {latestScan.score_breakdown && (
                <div className="space-y-3">
                  {Object.entries(latestScan.score_breakdown).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-3">
                      <div className="text-sm text-gray-600 w-32 shrink-0">
                        {BREAKDOWN_LABELS[key] ?? key}
                      </div>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${Math.min(100, Number(value))}%` }}
                        />
                      </div>
                      <div className="text-sm text-gray-500 w-10 text-right">
                        {Math.round(Number(value))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row 2: 추세 + 경쟁사 순위 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TrendLine data={history ?? []} />
            <RankingBar items={rankingItems} />
          </div>

          {/* Row 3: 업종 벤치마크 */}
          {benchmark && benchmark.count > 1 && latestScan && (
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
                  title={`평균: ${benchmark.avg_score}`}
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

          {/* Row 4: 플랫폼별 결과 */}
          {(latestScan.gemini_result || latestScan.chatgpt_result) && (
            <ResultTable
              results={{
                ...(latestScan.gemini_result ? { gemini: latestScan.gemini_result } : {}),
                ...(latestScan.chatgpt_result ? { chatgpt: latestScan.chatgpt_result } : {}),
                ...(latestScan.perplexity_result ? { perplexity: latestScan.perplexity_result } : {}),
                ...(latestScan.grok_result ? { grok: latestScan.grok_result } : {}),
                ...(latestScan.naver_result ? { naver: latestScan.naver_result } : {}),
                ...(latestScan.claude_result ? { claude: latestScan.claude_result } : {}),
              }}
            />
          )}

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
            <h2 className="text-2xl font-bold text-gray-900 mb-2">첫 번째 AI 스캔을 실행하세요</h2>
            <p className="text-gray-500 max-w-md">
              8개 AI 플랫폼에서 <strong>{business.name}</strong>이(가) 얼마나 검색되는지 확인합니다.
              <br />첫 스캔은 약 2~3분 소요됩니다.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-500 max-w-lg">
            {["Gemini (100회)", "ChatGPT", "네이버 AI 브리핑", "Perplexity", "Grok", "Claude", "뤼튼(Zeta)", "Google AI"].map((p) => (
              <div key={p} className="bg-gray-50 rounded-lg py-2 px-3">{p}</div>
            ))}
          </div>
          <p className="text-xs text-gray-400">상단의 &ldquo;AI 스캔 시작&rdquo; 버튼을 눌러주세요</p>
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
