import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AdDefenseClient } from "./AdDefenseClient";
import { NoBusiness } from "@/components/dashboard/NoBusiness";
import { Shield, TrendingUp, Bot, BarChart2 } from "lucide-react";

export default async function AdDefensePage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");
  const user = session.user;

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
