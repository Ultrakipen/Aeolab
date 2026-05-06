import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { TrendingUp, Lock } from "lucide-react";
import GrowthClient from "./GrowthClient";
import { getActiveBusinessId } from "@/lib/active-business";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

const PLAN_RANK: Record<string, number> = {
  free: 0, basic: 1, startup: 1.5, pro: 2, biz: 3,
};

interface ActionLog {
  action_type: string;
  action_label: string;
  action_date: string;
  score_before: number | null;
  score_after: number | null;
}

export default async function GrowthPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (!user || error) redirect("/login");

  // 구독 정보 조회
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status, plan")
    .eq("user_id", user.id)
    .in("status", ["active", "grace_period"])
    .maybeSingle();

  const activePlan =
    (subscription?.status === "active" || subscription?.status === "grace_period")
      ? (subscription?.plan ?? "free")
      : "free";

  // Free 플랜 차단 (Basic 이상 필요)
  if ((PLAN_RANK[activePlan] ?? 0) < PLAN_RANK["basic"]) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 md:p-8 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7 text-gray-400" strokeWidth={1.5} />
          </div>
          <h2 className="text-lg md:text-xl font-bold text-gray-700 mb-2">
            성장 기록은 Basic 이상 요금제에서 사용 가능합니다
          </h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            내 가게가 AI에 얼마나 자주 노출되는지 30일간 추적하고,<br />
            업종 평균과 비교해 볼 수 있습니다.
          </p>
          <Link
            href="/pricing"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            요금제 보기 →
          </Link>
        </div>
      </div>
    );
  }

  // cookie 기반 활성 사업장 결정
  const activeBizId = await getActiveBusinessId(user.id)

  const { data: business } = activeBizId
    ? await supabase
        .from("businesses")
        .select("id, name, category, region")
        .eq("id", activeBizId)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  // 사업장 미등록
  if (!business) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 md:p-8 text-center">
          <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg md:text-xl font-bold text-gray-700 mb-2">
            사업장을 먼저 등록해주세요
          </h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            성장 기록은 사업장을 등록한 후 AI 스캔을 진행하면 확인할 수 있습니다.
          </p>
          <Link
            href="/onboarding"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            사업장 등록하기 →
          </Link>
        </div>
      </div>
    );
  }

  // 스캔 기록 확인
  const { data: scans } = await supabase
    .from("scan_results")
    .select("id")
    .eq("business_id", business.id)
    .limit(1);

  if (!scans || scans.length === 0) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 md:p-8 text-center">
          <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg md:text-xl font-bold text-gray-700 mb-2">
            첫 AI 스캔을 실행해주세요
          </h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            성장 기록은 스캔 기록이 있어야 확인할 수 있습니다.
            <br />
            대시보드에서 첫 AI 스캔을 실행해보세요.
          </p>
          <Link
            href="/dashboard"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            대시보드로 이동 →
          </Link>
        </div>
      </div>
    );
  }

  // 액세스 토큰 조회
  let token = ""
  try {
    const { data: { session } } = await supabase.auth.getSession()
    token = session?.access_token ?? ""
  } catch { /* token = "" */ }

  // 점수 이력 · 성장카드 · 벤치마크 · 행동 로그 병렬 조회
  const [historyRes, growthCardRes, benchmarkRes, actionLogRes] = await Promise.all([
    fetch(`${BACKEND}/api/report/history/${business.id}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 300 },
    }).catch(() => null),
    fetch(`${BACKEND}/api/report/growth-card/${business.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null),
    fetch(
      `${BACKEND}/api/report/benchmark/${encodeURIComponent(business.category)}/${encodeURIComponent(business.region)}`,
      { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 3600 } }
    ).catch(() => null),
    fetch(`${BACKEND}/api/report/action-log/${business.id}?days=60`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null),
  ]);

  let historyData: Array<{
    scanned_at?: string;
    score_date?: string;
    unified_score: number;
    track1_score: number;
    track2_score: number;
    exposure_freq?: number;
    rank_in_category?: number;
    total_in_category?: number;
    weekly_change?: number;
  }> = [];
  if (historyRes?.ok) {
    const raw = await historyRes.json().catch(() => []);
    // 백엔드가 desc 반환 → 차트·최신 판단 모두 asc(과거→최신) 기준으로 정렬
    historyData = Array.isArray(raw)
      ? raw.sort((a: Record<string, string>, b: Record<string, string>) => {
          const da = a.score_date ?? a.scanned_at ?? "";
          const db = b.score_date ?? b.scanned_at ?? "";
          return da.localeCompare(db);
        })
      : [];
  }

  let growthCardUrl: string | null = null;
  if (growthCardRes?.ok) {
    const d = await growthCardRes.json().catch(() => null);
    growthCardUrl = d?.card_url ?? null;
  }

  let benchmarkData: {
    avg_score: number;
    top10_score: number;
    my_score: number;
    rank_percentile: number;
  } | null = null;
  if (benchmarkRes?.ok) {
    const raw = await benchmarkRes.json().catch(() => null);
    if (raw) {
      const latestScore = historyData.length > 0
        ? (historyData[historyData.length - 1].unified_score ?? 0)
        : 0;
      const rankPct = raw.avg_score > 0
        ? Math.round(Math.min(100, Math.max(0, (latestScore / raw.top10_score) * 90)))
        : 0;
      benchmarkData = {
        avg_score: raw.avg_score ?? 0,
        top10_score: raw.top10_score ?? 0,
        my_score: latestScore,
        rank_percentile: rankPct,
      };
    }
  }

  let actionLogs: ActionLog[] = [];
  if (actionLogRes?.ok) {
    const raw = await actionLogRes.json().catch(() => null);
    if (Array.isArray(raw)) {
      actionLogs = raw;
    } else if (raw?.logs && Array.isArray(raw.logs)) {
      actionLogs = raw.logs;
    }
  }

  return (
    <GrowthClient
      businessName={business.name}
      category={business.category}
      region={business.region}
      historyData={historyData}
      growthCardUrl={growthCardUrl}
      benchmarkData={benchmarkData}
      actionLogs={actionLogs}
    />
  );
}
