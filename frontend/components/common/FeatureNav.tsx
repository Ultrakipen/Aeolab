"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 사장님 계산기·우리 동네 상권 페이지 상단 메뉴 — 홈으로 돌아가지 않고 서로 오갈 수 있게 한다.
// inline: PC 헤더 안에 놓는 가로 메뉴 / row: 모바일에서 헤더 아래에 놓는 가로 스크롤 줄
const ITEMS = [
  { href: "/tools", label: "사장님 계산기", prefix: "/tools" },
  { href: "/area", label: "우리 동네 상권", prefix: "/area" },
  { href: "/how-it-works", label: "서비스 안내", prefix: "/how-it-works" },
  { href: "/pricing", label: "요금제", prefix: "/pricing" },
  { href: "/faq", label: "FAQ", prefix: "/faq" },
];

function isActive(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export default function FeatureNav({ variant }: { variant: "inline" | "row" }) {
  const pathname = usePathname() ?? "";

  if (variant === "inline") {
    return (
      <nav aria-label="주요 메뉴" className="ml-6 hidden items-center gap-1 md:flex">
        {ITEMS.map((i) => {
          const active = isActive(pathname, i.prefix);
          return (
            <Link
              key={i.href}
              href={i.href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-[44px] items-center whitespace-nowrap rounded-lg px-3 text-sm ${
                active ? "bg-blue-50 font-semibold text-blue-700" : "font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              {i.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="주요 메뉴" className="border-b border-gray-100 bg-white md:hidden">
      <ul className="flex gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ITEMS.map((i) => {
          const active = isActive(pathname, i.prefix);
          return (
            <li key={i.href} className="shrink-0">
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-[44px] items-center whitespace-nowrap rounded-full border px-4 text-sm ${
                  active
                    ? "border-blue-600 bg-blue-50 font-semibold text-blue-700"
                    : "border-gray-300 bg-white font-medium text-gray-700"
                }`}
              >
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
