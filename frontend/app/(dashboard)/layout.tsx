import { createClient, getCachedUser, getCachedActivePlan } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "./DashboardShell";
import { PageHeader } from "./PageHeader";
import HelpFAQFloat from "@/components/landing/HelpFAQFloat";
import { DashboardErrorBoundary } from "@/components/common/DashboardErrorBoundary";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCachedUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  // TypeScript non-null 보장 (redirect() 위에서 처리됨)
  const userId = user!.id;
  const userEmail = user!.email ?? "";

  // 구독 정보 + 사업장 수 병렬 조회
  const [activePlanResolved, { data: bizData, count: bizCount }] = await Promise.all([
    getCachedActivePlan(userId),
    supabase
      .from("businesses")
      .select("id", { count: "exact" })
      .eq("user_id", userId)
      .eq("is_active", true),
  ]);

  // 관리자 이메일 → 개발 기간 biz 플랜 부여
  const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "hoozdev@gmail.com")
    .split(",").map((e) => e.trim().toLowerCase());
  const isAdmin = ADMIN_EMAILS.includes(userEmail.toLowerCase());

  // 플랜별 사업장 등록 한도 (plan_gate.py PLAN_LIMITS와 동기화)
  const PLAN_BIZ_LIMITS: Record<string, number> = {
    free: 1, basic: 1, startup: 1, pro: 2, biz: 5,
  };

  // 만료/비활성 구독은 free로 처리 (sidebar 플랜 뱃지 오표시 방지)
  const activePlan = isAdmin ? "biz" : (activePlanResolved !== "free" ? activePlanResolved : null);
  const planKey = activePlan ?? "free";
  const bizLimit = PLAN_BIZ_LIMITS[planKey] ?? 1;
  const currentBizCount = bizCount ?? (bizData?.length ?? 0);
  const hasBusiness = currentBizCount > 0;
  const canAddMore = currentBizCount < bizLimit;

  return (
    <DashboardErrorBoundary>
      <DashboardShell
        email={userEmail}
        plan={activePlan}
        hasBusiness={hasBusiness}
        canAddMore={canAddMore}
      >
        {/* 데스크톱 페이지 헤더 (lg+ 에서만 표시) */}
        <PageHeader email={userEmail} plan={activePlan} />
        {children}
        {/* 모바일 FAQ 플로팅 버튼 (md:hidden — 모바일 전용) */}
        <HelpFAQFloat />
      </DashboardShell>
    </DashboardErrorBoundary>
  );
}
