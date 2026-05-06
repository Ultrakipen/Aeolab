"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  Lightbulb,
  History,
  Menu,
  type LucideIcon,
} from "lucide-react";

interface Tab {
  href?: string;
  label: string;
  Icon: LucideIcon;
  action?: "more";
}

const TABS: Tab[] = [
  { href: "/dashboard", label: "대시보드", Icon: LayoutDashboard },
  { href: "/competitors", label: "경쟁사", Icon: Store },
  { href: "/guide", label: "가이드", Icon: Lightbulb },
  { href: "/history", label: "변화", Icon: History },
  { label: "더보기", Icon: Menu, action: "more" },
];

interface Props {
  onMoreClick: () => void;
}

export function MobileBottomTabs({ onMoreClick }: Props) {
  const pathname = usePathname();

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-100 flex items-stretch"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="모바일 하단 탭바"
    >
      {TABS.map((tab) => {
        const active = tab.href
          ? pathname === tab.href || pathname.startsWith(tab.href + "/")
          : false;
        const cls = [
          "flex-1 flex flex-col items-center justify-center gap-0.5",
          "min-h-[56px] text-xs font-medium transition-colors",
          active
            ? "text-blue-600"
            : "text-gray-500 hover:text-gray-900",
        ].join(" ");

        const inner = (
          <>
            <tab.Icon
              className="w-5 h-5"
              strokeWidth={active ? 2 : 1.5}
              aria-hidden="true"
            />
            <span>{tab.label}</span>
          </>
        );

        if (tab.action === "more") {
          return (
            <button
              key={tab.label}
              type="button"
              onClick={onMoreClick}
              className={cls}
              aria-label="더보기 메뉴"
            >
              {inner}
            </button>
          );
        }

        return (
          <Link key={tab.href} href={tab.href!} className={cls}>
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}
