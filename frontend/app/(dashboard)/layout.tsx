import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { DashboardSidebar } from "./DashboardSidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (!user || error) {
    redirect("/login");
  }

  // 현재 pathname (proxy.ts에서 x-pathname 헤더로 전달)
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";

  // 구독 정보 + 사업장 유무 + 온보딩 완료 여부 조회
  const [{ data: sub }, { count: bizCount }, { data: profile }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("plan, status")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_active", true),
    supabase
      .from("profiles")
      .select("onboarding_done")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const hasBusiness = (bizCount ?? 0) > 0;
  const onboardingDone = profile?.onboarding_done ?? false;

  // 신규 사용자(사업장 없음 + 온보딩 미완료)는 온보딩으로 리다이렉트
  // /onboarding 자체에서는 리다이렉트 제외 (무한 루프 방지)
  if (!hasBusiness && !onboardingDone && !pathname.startsWith("/onboarding")) {
    redirect("/onboarding");
  }

  // 관리자 이메일 → 개발 기간 enterprise 플랜 부여
  const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "hoozdev@gmail.com")
    .split(",").map((e) => e.trim().toLowerCase());
  const isAdmin = ADMIN_EMAILS.includes((user.email ?? "").toLowerCase());

  // 만료/비활성 구독은 free로 처리 (sidebar 플랜 뱃지 오표시 방지)
  const activePlan = isAdmin ? "enterprise" : ((sub?.status === "active" || sub?.status === "grace_period") ? (sub?.plan ?? null) : null);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <DashboardSidebar email={user.email ?? ""} plan={activePlan} hasBusiness={hasBusiness} />

      {/* 메인 — 모바일에서 상단 바 높이(14) 만큼 패딩 */}
      <main className="flex-1 overflow-auto min-w-0 pt-14 lg:pt-0">{children}</main>
    </div>
  );
}
