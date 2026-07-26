import { createClient, getCachedUser, getCachedActivePlan } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { StartupClient } from "./StartupClient";
import { PlanGate } from "@/components/common/PlanGate";
import { BarChart2, MapPin, TrendingUp, LineChart } from "lucide-react";

export default async function StartupPage() {
  const user = await getCachedUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  // startup/biz 플랜 게이트 — 구독 status까지 검증
  // 관리자 우회 — competitors/page.tsx:78-80, dashboard/page.tsx:142-143 등과 동일 패턴.
  // 이 페이지엔 빠져있어 backend get_user_plan()은 관리자를 biz로 취급하는데도
  // 프론트 게이트만 자유 요금제로 보고 잠금 화면을 보여주던 버그(2026-07-15 스크린샷으로 발견)
  const ADMIN_EMAILS_LIST = (process.env.ADMIN_EMAILS ?? "hoozdev@gmail.com").split(",").map((e) => e.trim().toLowerCase());
  const isAdmin = ADMIN_EMAILS_LIST.includes((user.email ?? "").toLowerCase());
  const activePlan = isAdmin ? "biz" : await getCachedActivePlan(user.id);
  const STARTUP_PLANS = ["startup", "biz", "enterprise"];

  if (!STARTUP_PLANS.includes(activePlan)) {
    const features = [
      {
        Icon: BarChart2,
        title: "업종 경쟁 강도 분석",
        desc: "목표 업종·지역의 AEOlab 가입 사업장 기준 AI 검색 경쟁 강도를 파악합니다.",
      },
      {
        Icon: MapPin,
        title: "지역 시장 현황",
        desc: "내가 창업하려는 지역의 AEOlab 등록 사업장 수와 AI 노출 분포를 파악합니다.",
      },
      {
        Icon: TrendingUp,
        title: "시장 진입 전략",
        desc: "Claude AI가 분석한 업종별 진입 전략과 차별화 포인트를 제시합니다.",
      },
      {
        Icon: LineChart,
        title: "네이버 검색 수요 트렌드",
        desc: "네이버 DataLab 실측 데이터로 최근 3개월 검색 수요 증감을 확인합니다.",
      },
    ];

    return (
      <div className="p-4 md:p-8 max-w-2xl">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">창업 시장 분석</h1>
        <p className="text-base text-gray-500 mb-6">업종·지역 AI 노출 경쟁 강도 + 진입 전략 (창업 패키지·Biz 전용, Enterprise는 별도 문의)</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {features.map((f) => (
            <div key={f.title} className="bg-white rounded-xl p-5 shadow-sm flex gap-4">
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
          <div className="bg-white rounded-xl p-6 shadow-sm space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="h-16 bg-gray-100 rounded-xl" />
              <div className="h-16 bg-gray-100 rounded-xl" />
              <div className="h-16 bg-gray-100 rounded-xl" />
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-100 rounded w-full" />
              <div className="h-3 bg-gray-100 rounded w-5/6" />
              <div className="h-3 bg-gray-100 rounded w-4/6" />
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-100 rounded w-full" />
              <div className="h-3 bg-gray-100 rounded w-3/4" />
            </div>
          </div>
        </PlanGate>
      </div>
    );
  }

  return <StartupClient />;
}
