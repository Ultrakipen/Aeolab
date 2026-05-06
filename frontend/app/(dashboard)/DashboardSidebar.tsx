"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./LogoutButton";
import {
  LayoutDashboard, Store, Lightbulb, Code2, History, FileText,
  Settings, MessageSquare, Menu, X, Lock, TrendingUp, BookOpen, ShoppingBag,
  Search, HelpCircle, MessageCircle,
  type LucideIcon,
} from "lucide-react";
import { SidebarBusinessSwitcher } from "@/components/dashboard/SidebarBusinessSwitcher";
import { SidebarSearchBox } from "@/components/dashboard/SidebarSearchBox";

// 메뉴 그룹 정의
interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
  requiredPlan?: string;
  requiresBusiness?: boolean;
  badge?: string;
}

const NAV_GROUPS: {
  label: string;
  items: NavItem[];
}[] = [
  {
    label: "진단",
    items: [
      { href: "/dashboard",   label: "대시보드",    Icon: LayoutDashboard },
      { href: "/competitors", label: "경쟁사 관리", Icon: Store,         requiresBusiness: true },
    ],
  },
  {
    label: "개선 실행",
    items: [
      { href: "/guide",         label: "개선 가이드",           Icon: Lightbulb,     requiresBusiness: true },
      { href: "/schema",        label: "소개글 · 검색태그",       Icon: Code2,         requiredPlan: "basic", requiresBusiness: true },
      { href: "/blog-analysis", label: "블로그 진단",           Icon: FileText,      requiredPlan: "basic", requiresBusiness: true },
      { href: "/review-inbox",  label: "리뷰 답변",             Icon: MessageSquare, requiredPlan: "basic", requiresBusiness: true },
    ],
  },
  {
    label: "변화 보기",
    items: [
      { href: "/history", label: "변화 기록",   Icon: History,    requiredPlan: "basic", requiresBusiness: true },
      { href: "/growth",  label: "성장 리포트", Icon: TrendingUp, requiredPlan: "basic", requiresBusiness: true },
    ],
  },
  {
    label: "전문 대행",
    items: [
      { href: "/delivery", label: "대행 서비스", Icon: ShoppingBag, badge: "인기" },
    ],
  },
];

// 하단 서비스 링크 (검색 포함 여부 선택 — 여기선 포함)
const FOOTER_ITEMS: NavItem[] = [
  { href: "/how-it-works",      label: "서비스 매뉴얼",  Icon: BookOpen },
  { href: "/support",           label: "자주 묻는 질문", Icon: HelpCircle },
  { href: "/support/tickets",   label: "1:1 문의",       Icon: MessageCircle },
];

const PLAN_LABEL: Record<string, string> = {
  free: "무료", basic: "Basic", pro: "Pro", biz: "Biz",
  startup: "창업패키지",
};

const PLAN_RANK: Record<string, number> = {
  free: 0, basic: 1, startup: 1.5, pro: 2, biz: 3,
};

function isPlanLocked(currentPlan: string, requiredPlan?: string): boolean {
  if (!requiredPlan) return false;
  return (PLAN_RANK[currentPlan] ?? 0) < (PLAN_RANK[requiredPlan] ?? 0);
}

/** 검색 쿼리와 라벨이 일치하는지 확인 (대소문자·공백 무시) */
function matchesQuery(label: string, query: string): boolean {
  if (!query.trim()) return true;
  return label.replace(/\s/g, "").toLowerCase().includes(query.replace(/\s/g, "").toLowerCase());
}

interface Props {
  email: string;
  plan: string | null;
  hasBusiness?: boolean;
  canAddMore?: boolean;
  /** 외부에서 open 상태를 제어할 때 사용 (layout.tsx → MobileBottomTabs 연결용) */
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}

export function DashboardSidebar({
  email,
  plan,
  hasBusiness = true,
  canAddMore = false,
  open: openProp,
  onOpenChange,
}: Props) {
  // open state를 외부 제어 or 내부 제어 모두 지원
  const [openInternal, setOpenInternal] = useState(false);
  const open = openProp !== undefined ? openProp : openInternal;
  const setOpen = (v: boolean) => {
    if (onOpenChange) {
      onOpenChange(v);
    } else {
      setOpenInternal(v);
    }
  };

  const [query, setQuery] = useState("");
  const pathname = usePathname();

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

  const SidebarContent = () => {
    // 검색 필터 적용
    const filteredGroups = NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => matchesQuery(item.label, query)),
    })).filter((group) => group.items.length > 0);

    const filteredFooter = FOOTER_ITEMS.filter((item) => matchesQuery(item.label, query));

    return (
      <div className="flex flex-col h-full">
        {/* 상단 로고 + 플랜 */}
        <div className="px-6 py-5 border-b border-gray-100">
          <Link href="/" className="text-xl font-bold text-blue-600" onClick={() => setOpen(false)}>
            AEOlab
          </Link>
          <div className="mt-1 flex items-center gap-1">
            <span className="text-sm bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
              {PLAN_LABEL[planKey] ?? "무료"} 요금제
            </span>
            {isFree && (
              <a
                href="/pricing"
                className="text-sm text-gray-400 hover:text-blue-600 transition-colors"
                onClick={() => setOpen(false)}
              >
                업그레이드
              </a>
            )}
          </div>
        </div>

        {/* 사업장 전환 */}
        <div className="pt-3">
          <SidebarBusinessSwitcher onClose={() => setOpen(false)} />
        </div>

        {/* 메뉴 검색 */}
        <SidebarSearchBox value={query} onChange={setQuery} />

        {/* 내비게이션 그룹 */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto">
          {filteredGroups.map((group) => (
            <div
              key={group.label}
              className="mb-6"
            >
              {/* 그룹 라벨 — 카드 외부에 배치하여 시각 분리 강화 */}
              <div className="flex items-center gap-2 px-2 mb-2">
                <span className="w-1.5 h-4 rounded-full bg-blue-500 shrink-0" aria-hidden="true" />
                <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                  {group.label}
                </p>
              </div>
              <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-2 space-y-1">
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  const locked = isPlanLocked(planKey, item.requiredPlan);
                  const needsBiz = !hasBusiness && !!item.requiresBusiness;
                  return (
                    <Link
                      key={item.href}
                      href={locked ? "/pricing" : item.href}
                      onClick={() => setOpen(false)}
                      className={[
                        "flex items-center gap-2.5 px-3 py-3 rounded-lg text-[15px] transition-colors min-h-[44px]",
                        active
                          ? "bg-blue-50 text-blue-700 font-semibold border border-blue-300"
                          : locked
                          ? "text-gray-400 hover:bg-gray-50"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                      ].join(" ")}
                      title={locked ? "업그레이드 후 이용 가능" : undefined}
                      {...(item.href === "/competitors"
                        ? { "data-onboarding-tour": "competitors-menu" }
                        : {})}
                    >
                      <item.Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.5} />
                      <span className="flex-1 font-medium truncate min-w-0">{item.label}</span>
                      {item.badge && !locked && (
                        <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-semibold shrink-0">{item.badge}</span>
                      )}
                      {locked && !needsBiz && <Lock className="w-3.5 h-3.5 text-gray-300 shrink-0" />}
                      {needsBiz && !locked && (
                        <span className="text-sm text-gray-300 shrink-0 whitespace-nowrap">등록 필요</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {/* 하단 서비스 링크 — "기타" 그룹으로 통일 */}
          {filteredFooter.length > 0 && (
            <div className="mb-6 mt-2 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 px-2 mb-2">
                <span className="w-1.5 h-4 rounded-full bg-blue-500 shrink-0" aria-hidden="true" />
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">기타</p>
              </div>
              <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-2 space-y-1">
                {filteredFooter.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={[
                        "flex items-center gap-2.5 px-3 py-3 rounded-lg text-[15px] transition-colors min-h-[44px]",
                        active
                          ? "bg-blue-50 text-blue-700 font-semibold border border-blue-300"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                      ].join(" ")}
                    >
                      <item.Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.5} />
                      <span className="flex-1 font-medium truncate min-w-0">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* 검색 결과 없음 */}
          {query && filteredGroups.length === 0 && filteredFooter.length === 0 && (
            <div className="px-3 py-8 text-center">
              <Search className="w-8 h-8 text-gray-200 mx-auto mb-2" aria-hidden="true" />
              <p className="text-sm text-gray-400">검색 결과 없음</p>
            </div>
          )}
        </nav>

        {/* 가게 등록 / 추가 등록 버튼 */}
        {canAddMore && (
          <div className="px-4 pb-3">
            <a
              href="/onboarding"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1.5 w-full px-3 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors min-h-[44px]"
            >
              <span className="text-base leading-none">+</span>
              {hasBusiness ? "사업장 추가 등록" : "가게 등록하기"}
            </a>
          </div>
        )}

        {/* 하단 설정 + 로그아웃 */}
        <div className="px-4 py-4 border-t border-gray-100 space-y-2">
          <Link
            href="/settings"
            className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors px-1 py-2 rounded-lg hover:bg-gray-50 min-h-[44px]"
            onClick={() => setOpen(false)}
          >
            <Settings className="w-[18px] h-[18px] shrink-0" />
            <span className="flex flex-col min-w-0">
              <span className="font-medium text-[15px]">설정</span>
              <span className="truncate text-sm text-gray-400">{email}</span>
            </span>
          </Link>
          <LogoutButton />
        </div>
      </div>
    );
  };

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

      {/* 사이드바 */}
      <aside
        className={[
          "fixed lg:sticky lg:top-0 inset-y-0 left-0 z-40",
          "w-60 bg-white border-r border-gray-100 flex flex-col shrink-0 lg:h-screen",
          "transform transition-transform duration-200 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
        ].join(" ")}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
