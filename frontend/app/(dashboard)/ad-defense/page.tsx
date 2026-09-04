import { createClient, getCachedUser, getCachedActivePlan } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AdDefenseClient } from "./AdDefenseClient";
import { NoBusiness } from "@/components/dashboard/NoBusiness";
import { PlanGate } from "@/components/common/PlanGate";
import { getActiveBusinessId } from "@/lib/active-business";
import { Shield, TrendingUp, Bot, BarChart2 } from "lucide-react";

export default async function AdDefensePage() {
  const user = await getCachedUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  // Pro 플랜 게이트 — 구독 status까지 검증. 관리자 우회(competitors/page.tsx:78-80과 동일 패턴)
  const ADMIN_EMAILS_LIST = (process.env.ADMIN_EMAILS ?? "hoozdev@gmail.com").split(",").map((e) => e.trim().toLowerCase());
  const isAdmin = ADMIN_EMAILS_LIST.includes((user.email ?? "").toLowerCase());
  const activePlan = isAdmin ? "biz" : await getCachedActivePlan(user.id);
  const PRO_PLANS = ["pro", "biz", "enterprise"];

  if (!PRO_PLANS.includes(activePlan)) {
    const features = [
      {
        Icon: Bot,
        title: "ChatGPT 광고 환경 분석",
        desc: "ChatGPT 광고 확대가 내 업종에 미치는 영향을 분석합니다.",
      },
      {
        Icon: TrendingUp,
        title: "유기적 노출 강화 전략",
        desc: "광고 없이도 AI 검색에 지속 노출되는 콘텐츠·AI 노출 전략을 제시합니다.",
      },
      {
        Icon: BarChart2,
        title: "경쟁사 대비 리스크 진단",
        desc: "현재 AI 점수 기반으로 광고 경쟁 시 리스크 수준을 진단합니다.",
      },
      {
        Icon: Shield,
        title: "즉시 실행 액션 플랜",
        desc: "지금 당장 실행 가능한 우선순위별 광고 대응 방안을 제공합니다.",
      },
    ];

    return (
      <div className="p-4 md:p-8 max-w-2xl">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">AI 광고 대비 가이드</h1>
        <p className="text-sm text-gray-600 mb-6">2026년 8월 11일 한국에도 도입된 ChatGPT 광고 속에서 유기적 AI 노출을 유지하는 전략 (Pro 이상 전용)</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {features.map((f) => (
            <div key={f.title} className="bg-white rounded-xl p-5 shadow-sm flex gap-4">
              <div className="shrink-0 w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                <f.Icon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="font-medium text-gray-900 text-sm mb-0.5">{f.title}</div>
                <div className="text-sm text-gray-600">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <PlanGate
          requiredPlan="pro"
          currentPlan={activePlan}
          feature="ChatGPT 광고 대응 가이드"
        >
          <div className="bg-white rounded-xl p-6 shadow-sm space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="h-16 bg-gray-100 rounded-xl" />
              <div className="h-16 bg-gray-100 rounded-xl" />
              <div className="h-16 bg-gray-100 rounded-xl" />
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-100 rounded w-full" />
              <div className="h-3 bg-gray-100 rounded w-5/6" />
              <div className="h-3 bg-gray-100 rounded w-4/6" />
            </div>
          </div>
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
        description="2026년 8월 11일 한국에도 도입된 ChatGPT 광고 속에서 유기적 AI 노출을 유지하는 전략을 제공합니다."
        features={[
          { Icon: Bot,        title: "AI 광고 환경 분석",     desc: "ChatGPT 광고 도입이 내 사업장에 미치는 영향을 분석합니다." },
          { Icon: TrendingUp, title: "유기적 노출 강화 전략", desc: "광고 없이도 AI 검색에 지속 노출되는 콘텐츠·Schema 전략을 제시합니다." },
          { Icon: BarChart2,  title: "경쟁사 대비 리스크 평가", desc: "현재 AI 점수를 기반으로 광고 경쟁 리스크 수준을 진단합니다." },
          { Icon: Shield,     title: "즉시 실행 액션 플랜",   desc: "지금 당장 실행할 수 있는 우선순위별 대응 방안을 제공합니다." },
        ]}
      />
    );
  }

  // 사업장별 마지막 스캔 날짜 — scan_results에는 created_at 컬럼이 없어(존재하는 컬럼은
  // scanned_at) 이 쿼리가 항상 42703 에러로 조용히 실패, lastScanByBiz가 매번 빈 객체가
  // 되어 실제로 스캔 이력이 있는 계정에도 "스캔 데이터 없음"이 상시 노출되던 버그.
  const bizIds = businesses.map((b) => b.id);
  const { data: recentScans } = await supabase
    .from("scan_results")
    .select("business_id, scanned_at")
    .in("business_id", bizIds)
    .order("scanned_at", { ascending: false });

  const lastScanByBiz: Record<string, string> = {};
  recentScans?.forEach((s) => {
    if (!lastScanByBiz[s.business_id]) lastScanByBiz[s.business_id] = s.scanned_at;
  });

  // 사업장별 마지막 생성 결과 복원 — 기존엔 생성 결과가 React state에만 존재해 새로고침·
  // 재방문 시 영구 소실됐음(유료 플랜 월 5~10회 한도를 태워 만든 Claude Sonnet 결과인데
  // 다시 보려면 또 한도를 소모해 재생성해야 했던 문제, 2026-09-02 수정).
  const { data: recentGuides } = await supabase
    .from("guides")
    .select("id, business_id, items_json, checklist_done, generated_at")
    .in("business_id", bizIds)
    .eq("context", "ad_defense")
    .order("generated_at", { ascending: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB에서 그대로 전달, 실제 shape은 AdDefenseClient의 AdDefenseResult
  const lastResultByBiz: Record<string, { result: any; checklistDone: number[]; generatedAt: string }> = {};
  recentGuides?.forEach((g) => {
    if (!lastResultByBiz[g.business_id] && g.items_json) {
      // items_json엔 자기 행의 id가 없음(insert 당시엔 id가 아직 없었음) — 체크리스트
      // API(PATCH /api/guide/{id}/checklist)가 필요로 하므로 여기서 채워 넣음
      lastResultByBiz[g.business_id] = {
        result: { ...g.items_json, id: g.id },
        checklistDone: g.checklist_done ?? [],
        generatedAt: g.generated_at,
      };
    }
  });

  // 다른 페이지(대시보드·경쟁사·가이드 등)와 동일하게 aeolab_active_biz 쿠키 기준으로 기본
  // 선택 사업장을 맞춘다 — businesses[0] 고정 시 사업장 전환 후 이 페이지로 오면 항상
  // 첫 번째 등록 사업장으로 되돌아가던 버그(553bc54와 동일 클래스, 이 페이지는 누락돼 있었음).
  const activeBizId = await getActiveBusinessId(user.id);
  const initialBizId = (activeBizId && businesses.some((b) => b.id === activeBizId))
    ? activeBizId
    : businesses[0].id;

  return (
    <AdDefenseClient
      businesses={businesses}
      lastScanByBiz={lastScanByBiz}
      lastResultByBiz={lastResultByBiz}
      initialBizId={initialBizId}
    />
  );
}
