"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./LogoutButton";
import {
  LayoutDashboard, Store, Lightbulb, Code2, History,
  Rocket, Shield, Settings, MessageSquare, Menu, X, Lock,
  Bell, HelpCircle,
  type LucideIcon,
} from "lucide-react";

// requiredPlan: 이 요금제 미만이면 잠금 뱃지 표시 (null = 항상 열림)
const NAV_ITEMS: { href: string; label: string; Icon: LucideIcon; requiredPlan?: string }[] = [
  { href: "/dashboard",     label: "대시보드",       Icon: LayoutDashboard },
  { href: "/competitors",   label: "경쟁사 관리",    Icon: Store },
  { href: "/guide",         label: "개선 가이드",    Icon: Lightbulb },
  { href: "/review-inbox",  label: "리뷰 답변 생성", Icon: MessageSquare, requiredPlan: "basic" },
  { href: "/schema",        label: "AI 검색 등록",   Icon: Code2,         requiredPlan: "basic" },
  { href: "/history",       label: "변화 기록",      Icon: History,       requiredPlan: "basic" },
  { href: "/startup",       label: "창업 시장 분석", Icon: Rocket,        requiredPlan: "startup" },
  { href: "/ad-defense",    label: "광고 대응 전략", Icon: Shield,        requiredPlan: "pro" },
  { href: "/notices",       label: "공지사항",       Icon: Bell },
  { href: "/faq",           label: "FAQ · 문의",       Icon: HelpCircle },
  { href: "/settings",      label: "설정·구독",      Icon: Settings },
];

const PLAN_LABEL: Record<string, string> = {
  free: "무료", basic: "Basic", pro: "Pro", biz: "Biz",
  startup: "창업패키지", enterprise: "Enterprise",
};

const PLAN_RANK: Record<string, number> = {
  free: 0, basic: 1, startup: 2, pro: 3, biz: 4, enterprise: 5,
};

function isPlanLocked(currentPlan: string, requiredPlan?: string): boolean {
  if (!requiredPlan) return false;
  return (PLAN_RANK[currentPlan] ?? 0) < (PLAN_RANK[requiredPlan] ?? 0);
}

interface Props {
  email: string;
  plan: string | null;
  hasBusiness?: boolean;
}

export function DashboardSidebar({ email, plan, hasBusiness = true }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // 모바일 메뉴 열릴 때 body 스크롤 잠금
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const planKey = plan ?? "free";
  const isFree  = !plan || plan === "free";

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-gray-100">
        <Link href="/" className="text-xl font-bold text-blue-600" onClick={() => setOpen(false)}>
          AEOlab
        </Link>
        <div className="mt-1 flex items-center gap-1">
          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
            {PLAN_LABEL[planKey] ?? "무료"} 요금제
          </span>
          {isFree && (
            <a
              href="/pricing"
              className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
              onClick={() => setOpen(false)}
            >
              업그레이드
            </a>
          )}
        </div>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const locked = isPlanLocked(planKey, item.requiredPlan);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : locked
                  ? "text-gray-400 hover:bg-gray-50"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <item.Icon className="w-4 h-4 shrink-0" strokeWidth={1.5} />
              <span className="flex-1">{item.label}</span>
              {locked && <Lock className="w-3 h-3 text-gray-300 shrink-0" />}
            </Link>
          );
        })}
      </nav>

      {!hasBusiness && (
        <div className="px-4 pb-3">
          <a
            href="/onboarding"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1.5 w-full px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <span className="text-base leading-none">+</span> 가게 등록하기
          </a>
        </div>
      )}

      <div className="px-4 py-4 border-t border-gray-100 space-y-2">
        <Link
          href="/settings"
          className="text-xs text-gray-400 hover:text-blue-600 truncate px-1 transition-colors block"
          onClick={() => setOpen(false)}
        >
          {email}
        </Link>
        <LogoutButton />
      </div>
    </div>
  );

  return (
    <>
      {/* 모바일 상단 바 */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-blue-600">AEOlab</Link>
        <button
          onClick={() => setOpen(!open)}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          aria-label="메뉴 열기"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* 모바일 오버레이 */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/30"
          onClick={() => setOpen(false)}
        />
      )}

      {/* 사이드바 — 모바일: 드로어, PC: 고정 */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-40
          w-56 bg-white border-r border-gray-100 flex flex-col shrink-0
          transform transition-transform duration-200 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
