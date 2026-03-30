import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LogoutButton } from "./LogoutButton";
import {
  LayoutDashboard, Store, Lightbulb, Code2, History,
  Rocket, Shield, Settings, type LucideIcon,
} from "lucide-react";

const NAV_ITEMS: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/dashboard",   label: "대시보드",      Icon: LayoutDashboard },
  { href: "/competitors", label: "경쟁사 관리",   Icon: Store },
  { href: "/guide",       label: "개선 가이드",   Icon: Lightbulb },
  { href: "/schema",      label: "AI 검색 등록",  Icon: Code2 },
  { href: "/history",     label: "변화 기록",     Icon: History },
  { href: "/startup",     label: "창업 시장 분석",Icon: Rocket },
  { href: "/ad-defense",  label: "광고 대응 전략",Icon: Shield },
  { href: "/settings",    label: "설정·구독",     Icon: Settings },
];

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

  // 구독 정보 조회
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", user.id)
    .maybeSingle();

  const planLabel: Record<string, string> = {
    free: "무료", basic: "Basic", pro: "Pro", biz: "Biz",
    startup: "창업패키지", enterprise: "Enterprise",
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 사이드바 */}
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col shrink-0">
        <div className="px-6 py-5 border-b border-gray-100">
          <Link href="/" className="text-xl font-bold text-blue-600">AEOlab</Link>
          <div className="mt-1 flex items-center gap-1">
            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
              {planLabel[sub?.plan ?? "free"] ?? "무료"} 요금제
            </span>
            {(!sub || sub.plan === "free") && (
              <a href="/pricing" className="text-xs text-gray-400 hover:text-blue-600 transition-colors">업그레이드</a>
            )}
          </div>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              <item.Icon className="w-4 h-4 shrink-0" strokeWidth={1.5} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-gray-100 space-y-2">
          <Link href="/settings" className="text-xs text-gray-400 hover:text-blue-600 truncate px-1 transition-colors">{user.email}</Link>
          <LogoutButton />
        </div>
      </aside>

      {/* 메인 */}
      <main className="flex-1 overflow-auto min-w-0">{children}</main>
    </div>
  );
}
