import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
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

  // 구독 정보 + 사업장 유무 조회
  const [{ data: sub }, { count: bizCount }] = await Promise.all([
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
  ]);

  const hasBusiness = (bizCount ?? 0) > 0;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <DashboardSidebar email={user.email ?? ""} plan={sub?.plan ?? null} hasBusiness={hasBusiness} />

      {/* 메인 — 모바일에서 상단 바 높이(14) 만큼 패딩 */}
      <main className="flex-1 overflow-auto min-w-0 pt-14 lg:pt-0">{children}</main>
    </div>
  );
}
