"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeaderLogoutButton } from "@/components/common/HeaderLogoutButton";

const NAV_ITEMS = [
  { href: "/admin/growth-funnel", label: "성장 퍼널" },
  { href: "/admin/delivery", label: "대행 의뢰" },
  { href: "/admin/support", label: "Q&A 문의" },
  { href: "/admin/stories", label: "성공 사례" },
  { href: "/admin/feedback", label: "피드백" },
  { href: "/admin/notices", label: "공지사항" },
  { href: "/admin/comms", label: "소통 관리" },
  { href: "/admin/score-comparison", label: "점수 모델 비교" },
  { href: "/admin/business", label: "사업장 조회" },
  { href: "/admin/ops", label: "운영 현황" },
];

export function AdminHeaderNav() {
  const pathname = usePathname();

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-3 flex items-center gap-3">
      <Link href="/admin" className="text-base font-bold text-gray-900 shrink-0">
        AEOlab 관리자
      </Link>
      {/* 항목 수가 많아 모바일에서 줄바꿈 대신 가로 스크롤 — 브랜드·로그아웃은 항상 고정 노출 */}
      <nav className="flex gap-1 overflow-x-auto flex-1 min-w-0">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                active
                  ? "bg-blue-50 text-blue-700 font-semibold"
                  : "text-gray-600 hover:text-blue-600 hover:bg-gray-100"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="shrink-0">
        <HeaderLogoutButton />
      </div>
    </div>
  );
}
