"use client";

import { useState, useEffect, useCallback, memo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./LogoutButton";
import {
  LayoutDashboard, Store, Lightbulb, Code2, History, FileText,
  Settings, MessageSquare, Menu, X, Lock, TrendingUp, BookOpen, ShoppingBag,
  Search, HelpCircle, MessageCircle, Shield, BarChart2, Sparkles, BookMarked,
  type LucideIcon,
} from "lucide-react";
import { SidebarBusinessSwitcher } from "@/components/dashboard/SidebarBusinessSwitcher";
import { SidebarSearchBox } from "@/components/dashboard/SidebarSearchBox";
import { NotificationBell } from "@/components/dashboard/NotificationBell";

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
    label: "내 가게 현황",
    items: [
      { href: "/dashboard",   label: "대시보드",    Icon: LayoutDashboard },
      { href: "/competitors", label: "경쟁사 관리", Icon: Store,         requiresBusiness: true },
      { href: "/history",     label: "변화 기록",   Icon: History,    requiredPlan: "basic", requiresBusiness: true },
      { href: "/growth",      label: "성장 리포트", Icon: TrendingUp, requiredPlan: "basic", requiresBusiness: true },
    ],
  },
  {
    label: "개선 실행",
    items: [
      { href: "/guide",         label: "개선 가이드",         Icon: Lightbulb,     requiresBusiness: true },
      { href: "/schema",        label: "소개글 · 콘텐츠",     Icon: Code2,         requiredPlan: "basic", requiresBusiness: true },
      { href: "/blog-analysis", label: "블로그 진단",         Icon: FileText,      requiredPlan: "basic", requiresBusiness: true },
      { href: "/review-inbox",  label: "리뷰 답변",           Icon: MessageSquare, requiredPlan: "basic", requiresBusiness: true },
      { href: "/ad-defense",    label: "AI 광고 대비",         Icon: Shield,        requiredPlan: "pro",   requiresBusiness: true },
    ],
  },
  {
    label: "전문 서비스",
    items: [
      { href: "/delivery", label: "대행 서비스",    Icon: ShoppingBag, badge: "인기" },
      { href: "/startup",  label: "창업 시장 분석", Icon: BarChart2,   requiredPlan: "startup" },
    ],
  },
];

// 하단 서비스 링크 (검색 포함 여부 선택 — 여기선 포함)
const FOOTER_ITEMS: NavItem[] = [
  { href: "/guide/ai-info-tab",    label: "AI 브리핑 5단계",       Icon: BookOpen },
  { href: "/guide/chatgpt-search", label: "ChatGPT 가이드",        Icon: Sparkles },
  { href: "/how-it-works",         label: "서비스 매뉴얼",         Icon: BookMarked },
  { href: "/support",              label: "자주 묻는 질문",        Icon: HelpCircle },
  { href: "/support/tickets",      label: "1:1 문의",              Icon: MessageCircle },
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

// ---------------------------------------------------------------------------
// SidebarContent — 모듈 최상위 레벨로 추출
//
// 내부 컴포넌트(const SidebarContent = () => {...})로 두면 DashboardSidebar가
// 렌더될 때마다 새로운 함수 참조가 생성된다. React는 참조 동등성으로 컴포넌트
// 타입을 식별하므로 매 렌더마다 언마운트→재마운트가 발생하고,
// Link가 재마운트될 때마다 Next.js 프리페치가 재트리거된다.
// 모듈 최상위로 이동하면 타입 참조가 고정되어 이 문제가 해결된다.
// ---------------------------------------------------------------------------
interface SidebarContentProps {
  query: string;
  setQuery: (q: string) => void;
  onClose: () => void;
  planKey: string;
  isFree: boolean;
  hasBusiness: boolean;
  canAddMore: boolean;
  email: string;
}

// React.memo 적용 — DashboardShell이 children 변경으로 재렌더될 때
// (app/loading.tsx → (dashboard)/loading.tsx Suspense 해소 연쇄)
// SidebarContent의 모든 props가 안정적이므로 재렌더를 완전히 건너뜀.
// usePathname() 훅 구독은 memo와 무관하게 작동하므로 활성 링크 하이라이트는 유지됨.
const SidebarContent = memo(function SidebarContent({
  query,
  setQuery,
  onClose,
  planKey,
  isFree,
  hasBusiness,
  canAddMore,
  email,
}: SidebarContentProps) {
  const pathname = usePathname();

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
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-blue-600" onClick={onClose}>
            AEOlab
          </Link>
          <NotificationBell />
        </div>
        <div className="mt-1 flex items-center gap-1">
          <span className="text-sm bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
            {PLAN_LABEL[planKey] ?? "무료"} 요금제
          </span>
          {isFree && (
            <a
              href="/pricing"
              className="text-sm text-gray-500 hover:text-blue-600 transition-colors"
              onClick={onClose}
            >
              업그레이드
            </a>
          )}
        </div>
      </div>

      {/* 사업장 전환 */}
      <div className="pt-3">
        <SidebarBusinessSwitcher onClose={onClose} />
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
                    onClick={onClose}
                    className={[
                      "flex items-center gap-2.5 px-3 py-3 rounded-lg text-[15px] transition-colors min-h-[44px]",
                      active
                        ? "bg-blue-50 text-blue-700 font-semibold border border-blue-300"
                        : locked
                        ? "text-gray-500 hover:bg-gray-50"
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
                      <span className="text-sm bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-semibold shrink-0">{item.badge}</span>
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
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">도움말</p>
            </div>
            <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-2 space-y-1">
              {filteredFooter.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
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
            <p className="text-sm text-gray-500">검색 결과 없음</p>
          </div>
        )}
      </nav>

      {/* 가게 등록 / 추가 등록 버튼 */}
      {canAddMore && (
        <div className="px-4 pb-3">
          <a
            href="/onboarding"
            onClick={onClose}
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
          onClick={onClose}
        >
          <Settings className="w-[18px] h-[18px] shrink-0" />
          <span className="flex flex-col min-w-0">
            <span className="font-medium text-[15px]">설정</span>
            <span className="truncate text-sm text-gray-500">{email}</span>
          </span>
        </Link>
        <LogoutButton />
      </div>
    </div>
  );
});

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

  // useCallback으로 안정화 — DashboardShell 재렌더 시 함수 참조가 바뀌지 않아야
  // SidebarContent(memo)가 재렌더를 건너뛸 수 있다
  const setOpen = useCallback((v: boolean) => {
    if (onOpenChange) {
      onOpenChange(v);
    } else {
      setOpenInternal(v);
    }
  }, [onOpenChange]);

  // onClose: setOpen이 안정적이므로 이 함수도 안정적
  const onClose = useCallback(() => setOpen(false), [setOpen]);

  const [query, setQuery] = useState("");

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

  return (
    <>
      {/* 모바일 상단 바 */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-blue-600" prefetch={false}>AEOlab</Link>
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

      {/* 사이드바
           모바일(< lg): fixed overlay, open=false → translate-x-full + visibility:hidden
           데스크톱(≥ lg): sticky flex 참여, 항상 보임
      */}
      <aside
        className={[
          "fixed lg:sticky lg:top-0 inset-y-0 left-0 z-40",
          "w-60 bg-white border-r border-gray-100 flex flex-col lg:shrink-0 lg:h-screen",
          "transition-transform duration-200 ease-in-out",
          /* 모바일 슬라이드 + visibility 제어 */
          open ? "translate-x-0" : "-translate-x-full max-lg:invisible",
          /* 데스크톱: 항상 보임·translate 0 */
          "lg:translate-x-0 lg:visible",
        ].join(" ")}
      >
        <SidebarContent
          query={query}
          setQuery={setQuery}
          onClose={onClose}
          planKey={planKey}
          isFree={isFree}
          hasBusiness={hasBusiness}
          canAddMore={canAddMore}
          email={email}
        />
      </aside>
    </>
  );
}
