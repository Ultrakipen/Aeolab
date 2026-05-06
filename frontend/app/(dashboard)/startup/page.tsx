import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { StartupClient } from "./StartupClient";
import { PlanGate } from "@/components/common/PlanGate";
import { BarChart2, MapPin, TrendingUp, Lightbulb } from "lucide-react";

export default async function StartupPage() {
  const supabase = await createClient();
  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) user = data.user;
  } catch {
    // Invalid Refresh Token 등
  }
  if (!user) redirect("/login");

  // startup/biz 플랜 게이트 — 구독 status까지 검증
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", user.id)
    .maybeSingle();

  const activePlan = (sub?.status === "active" || sub?.status === "grace_period") ? (sub?.plan ?? "free") : "free";
  const STARTUP_PLANS = ["startup", "biz"];

  if (!STARTUP_PLANS.includes(activePlan)) {
    const features = [
      {
        Icon: BarChart2,
        title: "업종 경쟁 강도 분석",
        desc: "목표 업종·지역의 AI 검색 경쟁 강도를 수치로 확인합니다.",
      },
      {
        Icon: MapPin,
        title: "지역 시장 현황",
        desc: "내가 창업하려는 지역의 경쟁 업체 수와 AI 노출 분포를 파악합니다.",
      },
      {
        Icon: TrendingUp,
        title: "시장 진입 전략",
        desc: "Claude AI가 분석한 업종별 진입 전략과 차별화 포인트를 제시합니다.",
      },
      {
        Icon: Lightbulb,
        title: "선점 키워드 발굴",
        desc: "경쟁사가 아직 선점하지 못한 AI 검색 키워드를 찾아드립니다.",
      },
    ];

    return (
      <div className="p-4 md:p-8 max-w-2xl">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">창업 시장 분석</h1>
        <p className="text-base text-gray-500 mb-6">업종·지역 AI 노출 경쟁 강도 + 진입 전략 (창업 패키지 이상 전용)</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {features.map((f) => (
            <div key={f.title} className="bg-white rounded-2xl p-5 shadow-sm flex gap-4">
              <div className="shrink-0 w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                <f.Icon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="font-medium text-gray-900 text-sm mb-0.5">{f.title}</div>
                <div className="text-sm text-gray-500">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <PlanGate
          requiredPlan="startup"
          currentPlan={activePlan}
          feature="창업 시장 분석"
        >
          <div className="bg-white rounded-2xl p-6 shadow-sm" />
        </PlanGate>
      </div>
    );
  }

  return <StartupClient />;
}
