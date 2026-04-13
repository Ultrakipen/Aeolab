import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AdDefenseClient } from "./AdDefenseClient";
import { NoBusiness } from "@/components/dashboard/NoBusiness";
import { PlanGate } from "@/components/common/PlanGate";
import { Shield, TrendingUp, Bot, BarChart2 } from "lucide-react";

export default async function AdDefensePage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user || error) redirect("/login");

  // Pro 플랜 게이트 — 구독 status까지 검증
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", user.id)
    .maybeSingle();

  const activePlan = (sub?.status === "active" || sub?.status === "grace_period") ? (sub?.plan ?? "free") : "free";
  const PRO_PLANS = ["pro", "biz", "enterprise"];

  if (!PRO_PLANS.includes(activePlan)) {
    const features = [
      {
        Icon: Bot,
        title: "ChatGPT 광고 환경 분석",
        desc: "ChatGPT SearchGPT 광고 도입이 내 업종에 미치는 영향을 분석합니다.",
      },
      {
        Icon: TrendingUp,
        title: "유기적 노출 강화 전략",
        desc: "광고 없이도 AI 검색에 지속 노출되는 콘텐츠·Schema 전략을 제시합니다.",
      },
      {
        Icon: BarChart2,
        title: "경쟁사 대비 리스크 진단",
        desc: "현재 AI 점수 기반으로 광고 경쟁 시 리스크 수준을 수치로 진단합니다.",
      },
      {
        Icon: Shield,
        title: "즉시 실행 액션 플랜",
        desc: "지금 당장 실행 가능한 우선순위별 광고 대응 방안을 제공합니다.",
      },
    ];

    return (
      <div className="p-4 md:p-8 max-w-2xl">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">ChatGPT 광고 대응 가이드</h1>
        <p className="text-sm text-gray-500 mb-6">ChatGPT SearchGPT 광고 도입 시 유기적 AI 노출을 유지하는 전략 (Pro 이상 전용)</p>

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
          requiredPlan="pro"
          currentPlan={activePlan}
          feature="ChatGPT 광고 대응 가이드"
        >
          <div className="bg-white rounded-2xl p-6 shadow-sm" />
        </PlanGate>
      </div>
    );
  }

  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (!businesses || businesses.length === 0) {
    return (
      <NoBusiness
        Icon={Shield}
        title="ChatGPT 광고 대응 가이드"
        description="ChatGPT SearchGPT 광고 도입 시 유기적 AI 노출을 유지하는 전략을 제공합니다."
        features={[
          { Icon: Bot,        title: "AI 광고 환경 분석",     desc: "ChatGPT 광고 도입이 내 사업장에 미치는 영향을 분석합니다." },
          { Icon: TrendingUp, title: "유기적 노출 강화 전략", desc: "광고 없이도 AI 검색에 지속 노출되는 콘텐츠·Schema 전략을 제시합니다." },
          { Icon: BarChart2,  title: "경쟁사 대비 리스크 평가", desc: "현재 AI 점수를 기반으로 광고 경쟁 리스크 수준을 진단합니다." },
          { Icon: Shield,     title: "즉시 실행 액션 플랜",   desc: "지금 당장 실행할 수 있는 우선순위별 대응 방안을 제공합니다." },
        ]}
      />
    );
  }

  return <AdDefenseClient businesses={businesses} />;
}
