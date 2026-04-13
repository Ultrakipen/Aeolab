import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { TrendingUp, Lock } from "lucide-react";
import GrowthClient from "./GrowthClient";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

const PLAN_RANK: Record<string, number> = {
  free: 0, basic: 1, startup: 1.5, pro: 2, biz: 3, enterprise: 4,
};

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
    .single();

  const activePlan =
    subscription?.status === "active"
      ? (subscription?.plan ?? "free")
      : "free";

  // Free 플랜 차단 (Basic 이상 필요)
  if ((PLAN_RANK[activePlan] ?? 0) < PLAN_RANK["basic"]) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7 text-gray-400" strokeWidth={1.5} />
          </div>
          <h2 className="text-lg md:text-xl font-bold text-gray-700 mb-2">
            성장 리포트는 Basic 이상 요금제에서 사용 가능합니다
          </h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            30일 성장 추이 · 듀얼트랙 점수 변화 · 키워드 갭 히스토리를<br />
            매주 자동으로 추적하려면 구독을 시작해주세요.
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

  // 사업장 조회
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name, category, region")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1);

  const business = businesses?.[0] ?? null;

  // 사업장 미등록
  if (!business) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg md:text-xl font-bold text-gray-700 mb-2">
            사업장을 먼저 등록해주세요
          </h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            성장 리포트는 사업장 등록 후 AI 스캔을 진행하면 사용할 수 있습니다.
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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg md:text-xl font-bold text-gray-700 mb-2">
            첫 AI 스캔을 실행해주세요
          </h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            성장 리포트는 스캔 기록이 있어야 확인할 수 있습니다.
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
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token ?? "";

  // 성장 리포트 API 호출
  let growthData = null;
  try {
    const res = await fetch(`${BACKEND}/api/report/growth/${business.id}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 300 }, // 5분 캐시
    });
    if (res.ok) {
      growthData = await res.json();
    }
  } catch {
    // API 에러 시 null 유지
  }

  if (!growthData) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg md:text-xl font-bold text-gray-700 mb-2">
            성장 리포트를 불러올 수 없습니다
          </h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            잠시 후 다시 시도해주세요. 문제가 계속되면 스캔을 한 번 더 실행해보세요.
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

  return <GrowthClient data={growthData} />;
}
